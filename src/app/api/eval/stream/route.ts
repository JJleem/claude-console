import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { runs, evaluations, hookEvents } from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { pushEvent } from "@/lib/live-emitter";

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const evalTools: Anthropic.Tool[] = [
  {
    name: "get_runs",
    description: "DB에서 최근 LLM 호출 기록(runs)을 가져온다.",
    input_schema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "가져올 runs 개수 (기본 5)" } },
    },
  },
  {
    name: "submit_evaluation",
    description: "특정 run에 대한 채점 결과를 DB에 저장한다.",
    input_schema: {
      type: "object" as const,
      properties: {
        runId:     { type: "string" },
        relevance: { type: "number" },
        quality:   { type: "number" },
        accuracy:  { type: "number" },
        feedback:  { type: "string" },
      },
      required: ["runId", "relevance", "quality", "accuracy", "feedback"],
    },
  },
];

const SYSTEM = `너는 LLM 출력 품질을 평가하는 전문 심사위원이다.
get_runs 도구로 runs를 가져온 뒤, 각 run마다 반드시 submit_evaluation을 호출해서 채점해야 한다.
채점 기준:
- relevance(관련성): 응답이 질문과 얼마나 관련있는가 (1~5)
- quality(품질): 응답이 얼마나 잘 작성되었는가 (1~5)
- accuracy(정확성): 응답 내용이 얼마나 정확한가 (1~5)
모든 runs를 채점한 뒤 전체 요약을 한국어로 작성해라.`;

export async function POST(req: NextRequest) {
  const { limit = 5, runIds, model = "claude-sonnet-4-6" }: { limit?: number; runIds?: string[]; model?: string } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };

      try {
        const messages: Anthropic.MessageParam[] = [
          {
            role: "user",
            content: runIds?.length
              ? `다음 run ID 목록을 채점해줘: ${runIds.join(", ")}`
              : `최근 ${limit}개의 runs를 가져와서 전부 채점해줘.`,
          },
        ];

        let evalCount = 0;

        while (true) {
          // 매 턴 스트리밍으로 호출 — 텍스트 델타 실시간 전송
          const msgStream = anthropic.messages.stream({
            model,
            max_tokens: 4096,
            system: SYSTEM,
            tools: evalTools,
            messages,
          });

          for await (const event of msgStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ type: "text", text: event.delta.text });
            }
          }

          const final = await msgStream.finalMessage();
          messages.push({ role: "assistant", content: final.content });

          // 최종 응답 — 루프 종료
          if (final.stop_reason === "end_turn") {
            // 방금 저장된 evaluations 조회 (GET endpoint와 동일한 구조)
            const results = await db
              .select({
                evaluation: evaluations,
                run: {
                  userPrompt: runs.userPrompt,
                  systemPrompt: runs.systemPrompt,
                  response: runs.response,
                  model: runs.model,
                  inputTokens: runs.inputTokens,
                  outputTokens: runs.outputTokens,
                  costUsd: runs.costUsd,
                  durationMs: runs.durationMs,
                },
              })
              .from(evaluations)
              .innerJoin(runs, eq(evaluations.runId, runs.id))
              .orderBy(desc(evaluations.createdAt))
              .limit(50);

            send({ type: "done", results });
            break;
          }

          // 툴 호출 처리
          if (final.stop_reason === "tool_use") {
            const toolBlocks = final.content.filter((b) => b.type === "tool_use");
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of toolBlocks) {
              if (block.type !== "tool_use") continue;

              if (block.name === "get_runs") {
                const input = block.input as { limit?: number };
                const fetchCount = runIds?.length ?? input.limit ?? limit;
                const progressMsg = runIds?.length
                  ? `선택한 ${runIds.length}개 runs 조회 중...`
                  : `runs 조회 중 (최근 ${fetchCount}개)...`;
                send({ type: "progress", message: progressMsg });

                // Live monitor
                try {
                  const eid = randomUUID();
                  await db.insert(hookEvents).values({ id: eid, event: "Eval", tool: `get_runs · ${model}`, input: progressMsg, output: "" });
                  pushEvent({ id: eid, event: "Eval", tool: `get_runs · ${model}`, input: progressMsg, output: "", timestamp: Date.now() });
                } catch {}

                const fetched = await db
                  .select({
                    id: runs.id, model: runs.model, userPrompt: runs.userPrompt,
                    response: runs.response, inputTokens: runs.inputTokens,
                    outputTokens: runs.outputTokens, costUsd: runs.costUsd, createdAt: runs.createdAt,
                  })
                  .from(runs)
                  .$dynamic()
                  .where(runIds?.length ? inArray(runs.id, runIds) : undefined)
                  .orderBy(desc(runs.createdAt))
                  .limit(runIds?.length ?? fetchCount);

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify(fetched),
                });
              }

              if (block.name === "submit_evaluation") {
                const { runId, relevance, quality, accuracy, feedback } = block.input as {
                  runId: string; relevance: number; quality: number; accuracy: number; feedback: string;
                };
                evalCount++;
                send({
                  type: "progress",
                  message: `run #${evalCount} 채점 중... (관련성 ${relevance} / 품질 ${quality} / 정확성 ${accuracy})`,
                });

                const totalScore = (relevance + quality + accuracy) / 3;
                await db.insert(evaluations).values({
                  runId, relevance, quality, accuracy,
                  totalScore,
                  feedback,
                  judgeModel: model,
                });

                // Live monitor
                try {
                  const eid = randomUUID();
                  const evalInput = `runId: ${runId}`;
                  const evalOutput = `관련성 ${relevance} / 품질 ${quality} / 정확성 ${accuracy} | avg ${totalScore.toFixed(2)} — ${feedback.slice(0, 150)}`;
                  await db.insert(hookEvents).values({ id: eid, event: "Eval", tool: `submit_evaluation · ${model}`, input: evalInput, output: evalOutput });
                  pushEvent({ id: eid, event: "Eval", tool: `submit_evaluation · ${model}`, input: evalInput, output: evalOutput, timestamp: Date.now() });
                } catch {}

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify({ success: true }),
                });
              }
            }

            messages.push({ role: "user", content: toolResults });
          }
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "오류" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
