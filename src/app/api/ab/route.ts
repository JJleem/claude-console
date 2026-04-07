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

// AI judge: compare A vs B
export async function PUT(req: NextRequest) {
  const { systemA, systemB, userMessage, responseA, responseB } = await req.json();

  const judgePrompt = `You are evaluating two AI responses to the same user message, generated with different system prompts.

User message:
<user_message>
${userMessage}
</user_message>

System Prompt A:
<system_a>
${systemA || "(없음)"}
</system_a>

Response A:
<response_a>
${responseA}
</response_a>

System Prompt B:
<system_b>
${systemB || "(없음)"}
</system_b>

Response B:
<response_b>
${responseB}
</response_b>

Compare the two responses and judge which system prompt produced a better result. Consider: accuracy, helpfulness, clarity, and alignment with the system prompt's intent.

Reply in Korean. Start with either "A가 더 낫습니다" or "B가 더 낫습니다" or "비슷합니다", then explain why in 2-4 sentences.`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: judgePrompt }],
  });

  const text = msg.content.find((b) => b.type === "text");
  const verdict = text?.type === "text" ? text.text : "";
  const winner = verdict.startsWith("B") ? "B" : verdict.startsWith("비슷") ? "tie" : "A";

  return NextResponse.json({ verdict, winner });
}
