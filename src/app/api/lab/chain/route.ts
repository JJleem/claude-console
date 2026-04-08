import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 180;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ChainStep {
  name: string;
  system: string;
  prompt: string;
}

function resolveTemplate(template: string, input: string, prev: string): string {
  return template.replace(/\{\{input\}\}/g, input).replace(/\{\{prev\}\}/g, prev);
}

export async function POST(req: NextRequest) {
  const { input, steps } = await req.json() as { input: string; steps: ChainStep[] };

  if (!input?.trim() || !steps?.length) {
    return new Response(JSON.stringify({ error: "input and steps required" }), { status: 400 });
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
        let prevOutput = "";

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          send({ type: "step_start", data: { index: i, name: step.name } });

          const resolvedPrompt = resolveTemplate(step.prompt, input, prevOutput);
          let stepOutput = "";

          const msgStream = anthropic.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            ...(step.system?.trim() && { system: step.system }),
            messages: [{ role: "user", content: resolvedPrompt }],
          });

          for await (const event of msgStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "token", data: event.delta.text });
              stepOutput += event.delta.text;
            }
          }

          prevOutput = stepOutput;
          send({ type: "step_done", data: { index: i, output: stepOutput } });
        }

        send({ type: "done" });
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
