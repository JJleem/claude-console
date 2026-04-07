import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { runs, hookEvents } from "@/lib/db/schema";
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
  const { system, userMessage, model, slot } = await req.json();

  if (!userMessage?.trim()) {
    return new Response(JSON.stringify({ error: "userMessage required" }), { status: 400 });
  }

  const resolvedModel = model || "claude-sonnet-4-6";
  const maxTokens = MAX_TOKENS[resolvedModel] ?? 8192;
  const encoder = new TextEncoder();
  const start = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const msgStream = anthropic.messages.stream({
          model: resolvedModel,
          max_tokens: maxTokens,
          ...(system?.trim() && { system }),
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of msgStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "text", text: event.delta.text });
          }
        }

        const final = await msgStream.finalMessage();
        const inputTokens = final.usage.input_tokens;
        const outputTokens = final.usage.output_tokens;
        const durationMs = Date.now() - start;
        const costUsd = calcCost(resolvedModel, inputTokens, outputTokens);
        const response = (final.content.find((b) => b.type === "text") as { text: string } | undefined)?.text ?? "";

        // Save to runs table
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

        // Live monitor (non-critical)
        try {
          const eventId = randomUUID();
          const eventInput = `${system?.trim() ? `[System] ${system.trim().slice(0, 100)}\n` : ""}${userMessage.slice(0, 200)}`;
          const eventOutput = `${response.slice(0, 300)} | in:${inputTokens} out:${outputTokens} ${durationMs}ms $${costUsd.toFixed(4)}`;
          await db.insert(hookEvents).values({
            id: eventId, event: "ABTest",
            tool: `Slot ${slot} · ${resolvedModel}`,
            input: eventInput, output: eventOutput,
          });
          pushEvent({ id: eventId, event: "ABTest", tool: `Slot ${slot} · ${resolvedModel}`, input: eventInput, output: eventOutput, timestamp: Date.now() });
        } catch {}

        send({ type: "done", inputTokens, outputTokens, durationMs, costUsd });
        controller.close();
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "오류" });
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
