import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { harnessRuns } from "@/lib/db/schema";
import { or, eq, desc } from "drizzle-orm";

// 특정 하네스가 A 또는 B로 등장한 모든 실행 기록
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runs = await db
    .select()
    .from(harnessRuns)
    .where(or(eq(harnessRuns.harnessIdA, id), eq(harnessRuns.harnessIdB, id)))
    .orderBy(desc(harnessRuns.createdAt));
  return NextResponse.json(runs);
}
