import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { runs, hookEvents } from "@/lib/db/schema";
import { calcCost } from "@/lib/claude";
import { pushEvent } from "@/lib/live-emitter";
import { desc, like } from "drizzle-orm";

export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Voyage AI Embeddings ──────────────────────────────────────────────────────

const VOYAGE_MODEL = "voyage-3-lite"; // free tier, 1024-dim

async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage AI error ${res.status}: ${err}`);
  }

  const json = await res.json() as { data: { index: number; embedding: number[] }[] };
  // sort by index to preserve order
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
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

  if (!process.env.VOYAGE_API_KEY) {
    return new Response(JSON.stringify({ error: "VOYAGE_API_KEY가 설정되지 않았습니다. .env에 추가해주세요." }), { status: 500 });
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

        // 쿼리 + 모든 청크를 한 번의 API 호출로 임베딩 (무료 티어 효율 최대화)
        const allTexts = [query, ...rawChunks];
        const embeddings = await embedTexts(allTexts);
        const queryVec = embeddings[0];
        const chunkVecs = embeddings.slice(1);

        const scored = rawChunks.map((text, index) => ({
          text,
          score: Math.round(cosineSimilarity(queryVec, chunkVecs[index]) * 1000) / 1000,
          index,
        }));

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
          metadata: JSON.stringify({ source: "lab-rag", chunkCount: rawChunks.length, top3: top3.map(c => ({ text: c.text, score: c.score, index: c.index })), embeddingModel: VOYAGE_MODEL }),
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

export async function GET() {
  const history = await db
    .select({
      id: runs.id,
      createdAt: runs.createdAt,
      userPrompt: runs.userPrompt,
      response: runs.response,
      inputTokens: runs.inputTokens,
      outputTokens: runs.outputTokens,
      costUsd: runs.costUsd,
      durationMs: runs.durationMs,
      metadata: runs.metadata,
    })
    .from(runs)
    .where(like(runs.userPrompt, "[RAG]%"))
    .orderBy(desc(runs.createdAt))
    .limit(50);

  return NextResponse.json(history);
}
