import { NextRequest, NextResponse } from "next/server";
import { pushEvent, type LiveEvent } from "@/lib/live-emitter";
import { db } from "@/lib/db";
import { hookEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const id = randomUUID();
  const event: LiveEvent = {
    id,
    event: body.event ?? "PostToolUse",
    tool: body.tool,
    input: body.input,
    output: body.output,
    sessionId: body.sessionId,
    timestamp: Date.now(),
  };

  // persist to SQLite
  await db.insert(hookEvents).values({
    id,
    event: event.event,
    tool: event.tool,
    input: event.input,
    output: event.output,
    sessionId: event.sessionId,
  });

  // push to SSE clients
  pushEvent(event);

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 200);
  const rows = await db
    .select()
    .from(hookEvents)
    .orderBy(desc(hookEvents.createdAt))
    .limit(limit);
  return NextResponse.json(rows.reverse());
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.id) {
    // 단일 삭제
    await db.delete(hookEvents).where(eq(hookEvents.id, body.id));
  } else {
    // 전체 삭제
    await db.delete(hookEvents);
  }

  return NextResponse.json({ ok: true });
}
