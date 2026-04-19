import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are an expert at reviewing CLAUDE.md files — the instruction files used to guide Claude Code (an AI coding assistant). Your job is to analyze the given CLAUDE.md and provide actionable improvement suggestions in Korean.

Evaluate and provide feedback on:

1. **구조 및 가독성** — Is it well-organized? Are headings/lists used effectively?
2. **토큰 효율** — Are there verbose/redundant parts that waste tokens? (Remember: CLAUDE.md is read on EVERY message, so token cost compounds)
3. **필수 섹션 체크** — Does it cover: tech stack, coding conventions, build/test commands, common mistakes, behavioral rules for Claude?
4. **구체성** — Are instructions specific enough? Vague rules are often ignored.
5. **개선 제안** — Provide 3-5 concrete, actionable suggestions with before/after examples where helpful.
6. **종합 점수** — Rate the CLAUDE.md on a scale of 1-10 and explain why.

Be direct and specific. Format your response clearly with Korean section headers.`;

export async function POST(req: NextRequest) {
  const { content } = await req.json();

  if (!content?.trim()) {
    return new Response("CLAUDE.md 내용이 없습니다.", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
        );
      };

      try {
        const msgStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM,
          messages: [
            {
              role: "user",
              content: `다음 CLAUDE.md를 분석해주세요:\n\n\`\`\`markdown\n${content}\n\`\`\``,
            },
          ],
        });

        for await (const event of msgStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send(event.delta.text);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.";
        send(`\n\n❌ ${msg}`);
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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
