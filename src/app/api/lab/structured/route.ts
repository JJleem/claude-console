import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Field {
  name: string;
  type: string;
  description: string;
}

function fieldTypeToJsonSchema(type: string): Record<string, unknown> {
  switch (type) {
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "array":
      return { type: "array", items: { type: "string" } };
    default:
      return { type: "string" };
  }
}

export async function POST(req: NextRequest) {
  const { prompt, fields } = await req.json() as { prompt: string; fields: Field[] };

  if (!prompt?.trim() || !fields?.length) {
    return new Response(JSON.stringify({ error: "prompt and fields required" }), { status: 400 });
  }

  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    properties[field.name] = {
      ...fieldTypeToJsonSchema(field.type),
      description: field.description,
    };
  }

  const extractTool: Anthropic.Tool = {
    name: "extract",
    description: "주어진 텍스트에서 구조화된 정보를 추출합니다.",
    input_schema: {
      type: "object" as const,
      properties,
      required: fields.map((f) => f.name),
    },
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [extractTool],
      tool_choice: { type: "tool", name: "extract" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return new Response(JSON.stringify({ error: "도구 호출 결과를 찾을 수 없습니다" }), { status: 500 });
    }

    return new Response(
      JSON.stringify({
        result: toolBlock.input,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "오류가 발생했습니다" }),
      { status: 500 }
    );
  }
}
