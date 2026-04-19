import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs, evaluations } from "@/lib/db/schema";
import { desc, notInArray } from "drizzle-orm";

// Returns unscored runs (runs without evaluations), up to `limit`
export async function GET() {
  const scoredRunIds = (await db.select({ runId: evaluations.runId }).from(evaluations))
    .map((e) => e.runId);

  const query = db
    .select({ id: runs.id, userPrompt: runs.userPrompt, model: runs.model, createdAt: runs.createdAt })
    .from(runs)
    .orderBy(desc(runs.createdAt))
    .limit(20);

  const unscored = scoredRunIds.length > 0
    ? await query.where(notInArray(runs.id, scoredRunIds))
    : await query;

  return NextResponse.json({ unscored, count: unscored.length });
}
