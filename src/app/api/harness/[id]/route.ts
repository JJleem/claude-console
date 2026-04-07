import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { harnessRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runs = await db.select().from(harnessRuns).where(eq(harnessRuns.harnessId, id)).orderBy(desc(harnessRuns.createdAt));
  return NextResponse.json(runs);
}
