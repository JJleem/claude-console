import { NextRequest, NextResponse } from "next/server";
import { pushEvent, type LiveEvent } from "@/lib/live-emitter";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const event: LiveEvent = {
    id: randomUUID(),
    event: body.event ?? "PostToolUse",
    tool: body.tool,
    input: body.input,
    output: body.output,
    sessionId: body.sessionId,
    timestamp: Date.now(),
  };

  pushEvent(event);
  return NextResponse.json({ ok: true });
}
