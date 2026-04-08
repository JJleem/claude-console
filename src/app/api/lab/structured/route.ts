import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { runs, hookEvents } from "@/lib/db/schema";
import { calcCost } from "@/lib/claude";
import { pushEvent } from "@/lib/live-emitter";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

interface Field { name: string; type: string; description: string; }

function fieldTypeToJsonSchema(type: string): Record<string, unknown> {
  switch (type) {
    case "number":  return { type: "number" };
    case "boolean": return { type: "boolean" };
    case "array":   return { type: "array", items: { type: "string" } };
    default:        return { type: "string" };
  }
}

export async function POST(req: NextRequest) {
  const { prompt, fields } = await req.json() as { prompt: string; fields: Field[] };

  if (!prompt?.trim() || !fields?.length) {
    return new Response(JSON.stringify({ error: "prompt and fields required" }), { status: 400 });
  }

  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    properties[field.name] = { ...fieldTypeToJsonSchema(field.type), description: field.description };
  }

  const extractTool: Anthropic.Tool = {
    name: "extract",
    description: "주어진 텍스트에서 구조화된 정보를 추출합니다.",
    input_schema: { type: "object" as const, properties, required: fields.map((f) => f.name) },
  };

  const start = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024,
      tools: [extractTool], tool_choice: { type: "tool", name: "extract" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return new Response(JSON.stringify({ error: "도구 호출 결과를 찾을 수 없습니다" }), { status: 500 });
    }

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const durationMs = Date.now() - start;
    const costUsd = calcCost(MODEL, inputTokens, outputTokens);
    const resultStr = JSON.stringify(toolBlock.input);

    await db.insert(runs).values({
      model: MODEL, inputTokens, outputTokens, costUsd, durationMs,
      userPrompt: `[Structured Output] ${prompt.slice(0, 200)}`, response: resultStr,
      metadata: JSON.stringify({ source: "lab-structured", fields: fields.map(f => f.name) }),
    });

    try {
      const id = randomUUID();
      await db.insert(hookEvents).values({ id, event: "LabStructured", tool: "Structured Output", input: prompt.slice(0, 200), output: `${resultStr.slice(0, 200)} | in:${inputTokens} out:${outputTokens} $${costUsd.toFixed(4)}` });
      pushEvent({ id, event: "LabStructured", tool: "Structured Output", input: prompt.slice(0, 200), output: resultStr.slice(0, 200), timestamp: Date.now() });
    } catch {}

    return new Response(JSON.stringify({ result: toolBlock.input, inputTokens, outputTokens }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "오류가 발생했습니다" }), { status: 500 });
  }
}
