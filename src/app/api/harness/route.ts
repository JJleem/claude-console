import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { harnesses, harnessRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const list = await db.select().from(harnesses).orderBy(desc(harnesses.createdAt));
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // Save a new harness
  if (action === "save") {
    const { name, model, systemA, systemB, description } = body;
    const [row] = await db.insert(harnesses).values({ name, model, systemA, systemB, description: description ?? "" }).returning();
    return NextResponse.json(row);
  }

  // Save a run result
  if (action === "run") {
    const { harnessId, userMessage, responseA, responseB, tokensA, tokensB, msA, msB, winner, verdict } = body;
    const [row] = await db.insert(harnessRuns).values({ harnessId, userMessage, responseA, responseB, tokensA, tokensB, msA, msB, winner: winner ?? "", verdict: verdict ?? "" }).returning();
    return NextResponse.json(row);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await db.delete(harnessRuns).where(eq(harnessRuns.harnessId, id));
  await db.delete(harnesses).where(eq(harnesses.id, id));
  return NextResponse.json({ success: true });
}
