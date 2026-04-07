import { NextRequest, NextResponse } from "next/server";
import { loggedClaude } from "@/lib/claude";
import { db, sqlite } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (q) {
    // FTS5 full-text search
    const rows = sqlite.prepare(`
      SELECT runs.* FROM runs_fts
      JOIN runs ON runs_fts.id = runs.id
      WHERE runs_fts MATCH ?
      ORDER BY rank
      LIMIT 100
    `).all(q) as typeof runs.$inferSelect[];
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
