import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { runs, hookEvents } from "@/lib/db/schema";
import { calcCost } from "@/lib/claude";
import { pushEvent } from "@/lib/live-emitter";

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

const tools: Anthropic.Tool[] = [
  {
    name: "get_current_time",
    description: "현재 날짜와 시간을 ISO 형식으로 반환합니다.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "count_words",
    description: "주어진 텍스트의 단어 수를 반환합니다.",
    input_schema: { type: "object" as const, properties: { text: { type: "string", description: "단어를 셀 텍스트" } }, required: ["text"] },
  },
  {
    name: "convert_temperature",
    description: "섭씨(C)와 화씨(F) 사이의 온도를 변환합니다.",
    input_schema: { type: "object" as const, properties: { value: { type: "number" }, from: { type: "string", enum: ["C", "F"] } }, required: ["value", "from"] },
  },
];

function executeTool(name: string, input: Record<string, unknown>): string {
  if (name === "get_current_time") return new Date().toISOString();
  if (name === "count_words") {
    const text = (input.text as string) ?? "";
    return `단어 수: ${text.trim().split(/\s+/).filter((w) => w.length > 0).length}개`;
  }
  if (name === "convert_temperature") {
    const value = input.value as number;
    const from = input.from as "C" | "F";
    if (from === "C") return `${value}°C = ${((value * 9) / 5 + 32).toFixed(2)}°F`;
    return `${value}°F = ${(((value - 32) * 5) / 9).toFixed(2)}°C`;
  }
  return "알 수 없는 도구";
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string };
  if (!prompt?.trim()) return new Response(JSON.stringify({ error: "prompt required" }), { status: 400 });

  const encoder = new TextEncoder();
  const start = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n")); } catch {}
      };

      try {
        const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
        let totalInput = 0, totalOutput = 0;
        let finalResponse = "";

        while (true) {
          const response = await anthropic.messages.create({
            model: MODEL, max_tokens: 1024, tools, messages,
          });

          totalInput += response.usage.input_tokens;
          totalOutput += response.usage.output_tokens;
          messages.push({ role: "assistant", content: response.content });

          if (response.stop_reason === "end_turn") {
            for (const block of response.content) {
              if (block.type === "text") {
                finalResponse = block.text;
                const words = block.text.split(" ");
                for (const word of words) send({ type: "token", data: word + " " });
              }
            }
            send({ type: "done" });
            break;
          }

          if (response.stop_reason === "tool_use") {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of response.content) {
              if (block.type !== "tool_use") continue;
              const input = block.input as Record<string, unknown>;
              send({ type: "tool_call", data: { name: block.name, input } });
              const result = executeTool(block.name, input);
              send({ type: "tool_result", data: { name: block.name, result } });
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
            }
            messages.push({ role: "user", content: toolResults });
          }
        }

        const durationMs = Date.now() - start;
        const costUsd = calcCost(MODEL, totalInput, totalOutput);

        await db.insert(runs).values({
          model: MODEL, inputTokens: totalInput, outputTokens: totalOutput, costUsd, durationMs,
          userPrompt: `[Tool Use] ${prompt}`, response: finalResponse,
          metadata: JSON.stringify({ source: "lab-tools" }),
        });

        try {
          const id = randomUUID();
          await db.insert(hookEvents).values({ id, event: "LabToolUse", tool: "Tool Use", input: prompt, output: `${finalResponse.slice(0, 200)} | in:${totalInput} out:${totalOutput} $${costUsd.toFixed(4)}` });
          pushEvent({ id, event: "LabToolUse", tool: "Tool Use", input: prompt, output: finalResponse.slice(0, 200), timestamp: Date.now() });
        } catch {}

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "오류가 발생했습니다" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
