import { NextRequest, NextResponse } from "next/server";
import { loggedClaude } from "@/lib/claude";
import { db, sqlite } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (q) {
    // FTS5 full-text search — map snake_case → camelCase to match Drizzle output
    type RawRun = {
      id: string; created_at: string; model: string;
      input_tokens: number; output_tokens: number; cost_usd: number;
      duration_ms: number; system_prompt: string | null; user_prompt: string;
      response: string; has_image: number; agent_id: string | null;
      parent_run_id: string | null; metadata: string | null;
    };
    const raw = sqlite.prepare(`
      SELECT runs.* FROM runs_fts
      JOIN runs ON runs_fts.id = runs.id
      WHERE runs_fts MATCH ?
      ORDER BY rank
      LIMIT 100
    `).all(q) as RawRun[];
    const rows = raw.map((r) => ({
      id: r.id, createdAt: r.created_at, model: r.model,
      inputTokens: r.input_tokens, outputTokens: r.output_tokens,
      costUsd: r.cost_usd, durationMs: r.duration_ms,
      systemPrompt: r.system_prompt, userPrompt: r.user_prompt,
      response: r.response, hasImage: !!r.has_image,
      agentId: r.agent_id, parentRunId: r.parent_run_id, metadata: r.metadata,
    }));
    return NextResponse.json(rows);
  }

  const allRuns = await db
    .select()
    .from(runs)
    .orderBy(desc(runs.createdAt))
    .limit(100);

  return NextResponse.json(allRuns);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { model, system, userPrompt } = body;

  if (!userPrompt) {
    return NextResponse.json({ error: "userPrompt is required" }, { status: 400 });
  }

  const { run, response } = await loggedClaude({ model, system, userPrompt });
  return NextResponse.json({ run, response });
}
