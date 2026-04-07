import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { calcCost } from "@/lib/claude";
import { pushEvent } from "@/lib/live-emitter";
import { randomUUID } from "crypto";

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TOKENS: Record<string, number> = {
  "claude-haiku-4-5-20251001": 8192,
  "claude-sonnet-4-6": 16000,
  "claude-opus-4-6": 16000,
};

export async function POST(req: NextRequest) {
  try {
    const { systemA, systemB, userMessage, model } = await req.json();

    if (!userMessage?.trim()) {
      return NextResponse.json({ error: "userMessage를 입력해주세요" }, { status: 400 });
    }

    const resolvedModel = model || "claude-sonnet-4-6";
    const maxTokens = MAX_TOKENS[resolvedModel] ?? 8192;

    const call = async (system: string, slot: "A" | "B") => {
      const start = Date.now();
      const msg = await anthropic.messages.create({
        model: resolvedModel,
        max_tokens: maxTokens,
        ...(system?.trim() && { system }),
        messages: [{ role: "user", content: userMessage }],
      });
      const text = msg.content.find((b) => b.type === "text");
      const response = text?.type === "text" ? text.text : "";
      const inputTokens = msg.usage.input_tokens;
      const outputTokens = msg.usage.output_tokens;
      const durationMs = Date.now() - start;
      const costUsd = calcCost(resolvedModel, inputTokens, outputTokens);

      // runs 테이블 기록
      await db.insert(runs).values({
        model: resolvedModel,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
        systemPrompt: system?.trim() || null,
        userPrompt: userMessage,
        response,
        metadata: JSON.stringify({ source: "ab-test", slot }),
      });

      // live monitor push
      pushEvent({
        id: randomUUID(),
        event: "ABTest",
        tool: `Slot ${slot} · ${resolvedModel}`,
        input: `${system?.trim() ? `[System] ${system.trim().slice(0, 100)}\n` : ""}${userMessage.slice(0, 200)}`,
        output: `${response.slice(0, 300)} | in:${inputTokens} out:${outputTokens} ${durationMs}ms $${costUsd.toFixed(4)}`,
        timestamp: Date.now(),
      });

      return { response, inputTokens, outputTokens, durationMs, costUsd };
    };

    const [a, b] = await Promise.all([call(systemA ?? "", "A"), call(systemB ?? "", "B")]);
    return NextResponse.json({ a, b });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[/api/ab POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// AI judge: compare A vs B
export async function PUT(req: NextRequest) {
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[/api/ab PUT]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
