import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tool definitions ──────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "get_current_time",
    description: "현재 날짜와 시간을 ISO 형식으로 반환합니다.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "count_words",
    description: "주어진 텍스트의 단어 수를 반환합니다.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "단어를 셀 텍스트" },
      },
      required: ["text"],
    },
  },
  {
    name: "convert_temperature",
    description: "섭씨(C)와 화씨(F) 사이의 온도를 변환합니다.",
    input_schema: {
      type: "object" as const,
      properties: {
        value: { type: "number", description: "변환할 온도 값" },
        from: { type: "string", enum: ["C", "F"], description: "입력 단위 (C: 섭씨, F: 화씨)" },
      },
      required: ["value", "from"],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

function executeTool(name: string, input: Record<string, unknown>): string {
  if (name === "get_current_time") {
    return new Date().toISOString();
  }
  if (name === "count_words") {
    const text = (input.text as string) ?? "";
    const count = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    return `단어 수: ${count}개`;
  }
  if (name === "convert_temperature") {
    const value = input.value as number;
    const from = input.from as "C" | "F";
    if (from === "C") {
      const f = (value * 9) / 5 + 32;
      return `${value}°C = ${f.toFixed(2)}°F`;
    } else {
      const c = ((value - 32) * 5) / 9;
      return `${value}°F = ${c.toFixed(2)}°C`;
    }
  }
  return "알 수 없는 도구";
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string };

  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: "prompt required" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {}
      };

      try {
        const messages: Anthropic.MessageParam[] = [
          { role: "user", content: prompt },
        ];

        while (true) {
          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            tools,
            messages,
          });

          messages.push({ role: "assistant", content: response.content });

          if (response.stop_reason === "end_turn") {
            // Stream final text tokens
            for (const block of response.content) {
              if (block.type === "text") {
                // Send tokens character by character for streaming feel
                const text = block.text;
                const words = text.split(" ");
                for (const word of words) {
                  send({ type: "token", data: word + " " });
                  // Small delay for streaming effect is not needed — just send all
                }
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

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }

            messages.push({ role: "user", content: toolResults });
          }
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "오류가 발생했습니다" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
