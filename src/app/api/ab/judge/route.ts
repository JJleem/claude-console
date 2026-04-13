import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let verdict = "";
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch {}
      };

      try {
        const msgStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          messages: [{ role: "user", content: judgePrompt }],
        });

        for await (const event of msgStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            verdict += event.delta.text;
            send({ type: "text", text: event.delta.text });
          }
        }

        const winner = verdict.startsWith("B") ? "B" : verdict.startsWith("비슷") ? "tie" : "A";
        send({ type: "done", winner, verdict });
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
