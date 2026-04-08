import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { runs, hookEvents } from "@/lib/db/schema";
import { calcCost } from "@/lib/claude";
import { pushEvent } from "@/lib/live-emitter";

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── TF-IDF cosine similarity ──────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function tfIdf(tokens: string[], corpus: string[][]): Map<string, number> {
  const N = corpus.length;
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const result = new Map<string, number>();
  tf.forEach((count, term) => {
    const df = corpus.filter((doc) => doc.includes(term)).length;
    const idf = Math.log((N + 1) / (df + 1)) + 1;
    result.set(term, (count / tokens.length) * idf);
  });
  return result;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0;
  a.forEach((v, k) => { dot += v * (b.get(k) ?? 0); magA += v * v; });
  b.forEach((v) => { magB += v * v; });
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Chunking ─────────────────────────────────────────────────────────────────

function chunkDocument(document: string, chunkSize: number): string[] {
  const words = document.split(/\s+/).filter((w) => w.length > 0);
  const overlap = Math.min(20, Math.floor(chunkSize / 5));
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const end = Math.min(i + chunkSize, words.length);
    chunks.push(words.slice(i, end).join(" "));
    if (end >= words.length) break;
    i += chunkSize - overlap;
  }
  return chunks;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { document, query, chunkSize = 100 } = await req.json() as {
    document: string; query: string; chunkSize?: number;
  };

  if (!document?.trim() || !query?.trim()) {
    return new Response(JSON.stringify({ error: "document and query required" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const MODEL = "claude-haiku-4-5-20251001";
  const start = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n")); } catch {}
      };

      try {
        const rawChunks = chunkDocument(document, Math.max(20, chunkSize));
        const tokenizedChunks = rawChunks.map(tokenize);
        const queryTokens = tokenize(query);
        const queryVec = tfIdf(queryTokens, tokenizedChunks);

        const scored = rawChunks.map((text, index) => {
          const chunkVec = tfIdf(tokenizedChunks[index], tokenizedChunks);
          const score = cosineSimilarity(queryVec, chunkVec);
          return { text, score: Math.round(score * 1000) / 1000, index };
        });

        const top3 = [...scored].sort((a, b) => b.score - a.score).slice(0, 3);
        send({ type: "chunks", data: scored });

        const contextText = top3.map((c, i) => `[청크 ${i + 1}]\n${c.text}`).join("\n\n");
        const userPrompt = `다음 컨텍스트를 참고하여 질문에 답해주세요.\n\n컨텍스트:\n${contextText}\n\n질문: ${query}`;
        const systemPrompt = "당신은 제공된 컨텍스트를 기반으로 질문에 답하는 도우미입니다. 반드시 컨텍스트 내용만 사용하여 답변하고, 컨텍스트에 없는 내용은 추측하지 마세요.";

        const msgStream = anthropic.messages.stream({
          model: MODEL, max_tokens: 1024, system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        let response = "";
        for await (const event of msgStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "token", data: event.delta.text });
            response += event.delta.text;
          }
        }

        const final = await msgStream.finalMessage();
        const inputTokens = final.usage.input_tokens;
        const outputTokens = final.usage.output_tokens;
        const durationMs = Date.now() - start;
        const costUsd = calcCost(MODEL, inputTokens, outputTokens);

        await db.insert(runs).values({
          model: MODEL, inputTokens, outputTokens, costUsd, durationMs,
          systemPrompt, userPrompt: `[RAG] ${query}`, response,
          metadata: JSON.stringify({ source: "lab-rag", chunkCount: rawChunks.length, top3Scores: top3.map(c => c.score) }),
        });

        try {
          const id = randomUUID();
          await db.insert(hookEvents).values({ id, event: "LabRAG", tool: "RAG", input: query, output: `${response.slice(0, 200)} | in:${inputTokens} out:${outputTokens} $${costUsd.toFixed(4)}` });
          pushEvent({ id, event: "LabRAG", tool: "RAG", input: query, output: response.slice(0, 200), timestamp: Date.now() });
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
