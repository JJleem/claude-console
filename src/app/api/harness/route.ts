import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { harnesses, harnessRuns } from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";

// 하네스 목록
export async function GET() {
  const list = await db.select().from(harnesses).orderBy(desc(harnesses.createdAt));
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // 새 하네스 저장
  if (action === "save") {
    const { name, system, description } = body;
    const [row] = await db
      .insert(harnesses)
      .values({ name, system: system ?? "", description: description ?? "" })
      .returning();
    return NextResponse.json(row);
  }

  // 실행 결과 저장
  if (action === "run") {
    const {
      harnessIdA, harnessIdB, model,
      userMessage, responseA, responseB,
      systemASnapshot, systemBSnapshot,
      inputTokensA, outputTokensA,
      inputTokensB, outputTokensB,
      msA, msB,
    } = body;
    const [row] = await db
      .insert(harnessRuns)
      .values({
        harnessIdA: harnessIdA ?? null,
        harnessIdB: harnessIdB ?? null,
        model: model ?? "claude-sonnet-4-6",
        userMessage, responseA, responseB,
        systemASnapshot: systemASnapshot ?? "",
        systemBSnapshot: systemBSnapshot ?? "",
        inputTokensA, outputTokensA,
        inputTokensB, outputTokensB,
        msA, msB,
        winner: "", verdict: "",
      })
      .returning();
    return NextResponse.json(row);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

// 승자 / verdict 업데이트
export async function PATCH(req: NextRequest) {
  const { runId, winner, verdict } = await req.json();
  await db
    .update(harnessRuns)
    .set({
      ...(winner !== undefined && { winner }),
      ...(verdict !== undefined && { verdict }),
    })
    .where(eq(harnessRuns.id, runId));
  return NextResponse.json({ success: true });
}

// 하네스 삭제 (연관 run도 삭제)
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await db.delete(harnessRuns).where(
    or(eq(harnessRuns.harnessIdA, id), eq(harnessRuns.harnessIdB, id))
  );
  await db.delete(harnesses).where(eq(harnesses.id, id));
  return NextResponse.json({ success: true });
}
