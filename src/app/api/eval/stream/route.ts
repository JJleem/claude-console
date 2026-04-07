import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { runs, evaluations } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

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
  const { limit = 5 } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const messages: Anthropic.MessageParam[] = [
          { role: "user", content: `최근 ${limit}개의 runs를 가져와서 전부 채점해줘.` },
        ];

        let evalCount = 0;

        // Tool-use loop
        while (true) {
          send({ type: "progress", message: "Claude 응답 생성 중..." });

          const msg = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: SYSTEM,
            tools: evalTools,
            messages,
          });

          messages.push({ role: "assistant", content: msg.content });

          if (msg.stop_reason === "end_turn") {
            // Stream the final summary text
            send({ type: "progress", message: "요약 작성 중..." });

            // Re-run last turn as streaming for text output
            const textStream = anthropic.messages.stream({
              model: "claude-sonnet-4-6",
              max_tokens: 1024,
              system: SYSTEM,
              messages,
            });

            for await (const event of textStream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                send({ type: "text", text: event.delta.text });
              }
            }

            // Fetch updated evaluations and send as done
            const results = await db
              .select({
                evaluation: evaluations,
                run: { userPrompt: runs.userPrompt, model: runs.model },
              })
              .from(evaluations)
              .innerJoin(runs, eq(evaluations.runId, runs.id))
              .orderBy(desc(evaluations.createdAt))
              .limit(limit);

            send({ type: "done", results });
            controller.close();
            return;
          }

          if (msg.stop_reason === "tool_use") {
            const toolBlocks = msg.content.filter((b) => b.type === "tool_use");
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of toolBlocks) {
              if (block.type !== "tool_use") continue;

              if (block.name === "get_runs") {
                send({ type: "progress", message: `runs 조회 중 (최근 ${limit}개)...` });
                const input = block.input as { limit?: number };
                const recentRuns = await db
                  .select({
                    id: runs.id, model: runs.model, userPrompt: runs.userPrompt,
                    response: runs.response, inputTokens: runs.inputTokens,
                    outputTokens: runs.outputTokens, costUsd: runs.costUsd, createdAt: runs.createdAt,
                  })
                  .from(runs)
                  .orderBy(desc(runs.createdAt))
                  .limit(input.limit ?? limit);

                toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(recentRuns) });
              }

              if (block.name === "submit_evaluation") {
                const { runId, relevance, quality, accuracy, feedback } = block.input as {
                  runId: string; relevance: number; quality: number; accuracy: number; feedback: string;
                };
                evalCount++;
                send({ type: "progress", message: `run #${evalCount} 채점 중... (관련성 ${relevance} / 품질 ${quality} / 정확성 ${accuracy})` });

                const totalScore = (relevance + quality + accuracy) / 3;
                await db.insert(evaluations).values({
                  runId, relevance, quality, accuracy, totalScore, feedback,
                  judgeModel: "claude-sonnet-4-6",
                });

                toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify({ success: true, totalScore }) });
              }
            }

            messages.push({ role: "user", content: toolResults });
          }
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "오류" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
