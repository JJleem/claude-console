import { NextRequest, NextResponse } from "next/server";
import { loggedClaude } from "@/lib/claude";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
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
