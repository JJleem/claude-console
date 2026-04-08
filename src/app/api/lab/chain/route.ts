import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { runs, hookEvents } from "@/lib/db/schema";
import { calcCost } from "@/lib/claude";
import { pushEvent } from "@/lib/live-emitter";

export const maxDuration = 180;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

interface ChainStep { name: string; system: string; prompt: string; }

function resolveTemplate(template: string, input: string, prev: string): string {
  return template.replace(/\{\{input\}\}/g, input).replace(/\{\{prev\}\}/g, prev);
}

export async function POST(req: NextRequest) {
  const { input, steps } = await req.json() as { input: string; steps: ChainStep[] };

  if (!input?.trim() || !steps?.length) {
    return new Response(JSON.stringify({ error: "input and steps required" }), { status: 400 });
  }

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
        let prevOutput = "";
        let totalInput = 0, totalOutput = 0;
        const stepOutputs: string[] = [];

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          send({ type: "step_start", data: { index: i, name: step.name } });

          const resolvedPrompt = resolveTemplate(step.prompt, input, prevOutput);
          let stepOutput = "";

          const msgStream = anthropic.messages.stream({
            model: MODEL, max_tokens: 2048,
            ...(step.system?.trim() && { system: step.system }),
            messages: [{ role: "user", content: resolvedPrompt }],
          });

          for await (const event of msgStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ type: "token", data: event.delta.text });
              stepOutput += event.delta.text;
            }
          }

          const final = await msgStream.finalMessage();
          totalInput += final.usage.input_tokens;
          totalOutput += final.usage.output_tokens;

          prevOutput = stepOutput;
          stepOutputs.push(stepOutput);
          send({ type: "step_done", data: { index: i, output: stepOutput } });

          // Log each step as a separate run
          const stepCost = calcCost(MODEL, final.usage.input_tokens, final.usage.output_tokens);
          await db.insert(runs).values({
            model: MODEL,
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
            costUsd: stepCost,
            durationMs: Date.now() - start,
            systemPrompt: step.system || null,
            userPrompt: `[Chain: ${step.name}] ${resolvedPrompt.slice(0, 200)}`,
            response: stepOutput,
            metadata: JSON.stringify({ source: "lab-chain", stepIndex: i, stepName: step.name }),
          });
        }

        const durationMs = Date.now() - start;
        const totalCost = calcCost(MODEL, totalInput, totalOutput);

        try {
          const id = randomUUID();
          await db.insert(hookEvents).values({ id, event: "LabChain", tool: `Chain (${steps.length}단계)`, input: input.slice(0, 200), output: `${prevOutput.slice(0, 200)} | in:${totalInput} out:${totalOutput} $${totalCost.toFixed(4)}` });
          pushEvent({ id, event: "LabChain", tool: `Chain (${steps.length}단계)`, input: input.slice(0, 200), output: prevOutput.slice(0, 200), timestamp: Date.now() });
        } catch {}

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
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
