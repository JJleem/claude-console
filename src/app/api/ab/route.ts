import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { systemA, systemB, userMessage, model } = await req.json();

  if (!userMessage?.trim()) {
    return NextResponse.json({ error: "userMessage required" }, { status: 400 });
  }

  const call = async (system: string) => {
    const start = Date.now();
    const msg = await anthropic.messages.create({
      model: model || "claude-sonnet-4-6",
      max_tokens: 2048,
      ...(system?.trim() && { system }),
      messages: [{ role: "user", content: userMessage }],
    });
    const text = msg.content.find((b) => b.type === "text");
    return {
      response: text?.type === "text" ? text.text : "",
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      durationMs: Date.now() - start,
    };
  };

  const [a, b] = await Promise.all([call(systemA ?? ""), call(systemB ?? "")]);

  return NextResponse.json({ a, b });
}
