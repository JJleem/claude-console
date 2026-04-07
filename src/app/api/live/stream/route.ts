import { liveEmitter, type LiveEvent } from "@/lib/live-emitter";
import { db } from "@/lib/db";
import { hookEvents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  // load history from DB
  const rows = await db
    .select()
    .from(hookEvents)
    .orderBy(desc(hookEvents.createdAt))
    .limit(200);

  const history: LiveEvent[] = rows.reverse().map((r) => ({
    id: r.id,
    event: r.event as LiveEvent["event"],
    tool: r.tool ?? undefined,
    input: r.input ?? undefined,
    output: r.output ?? undefined,
    sessionId: r.sessionId ?? undefined,
    timestamp: new Date(r.createdAt).getTime(),
  }));

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "history", events: history })}\n\n`)
      );

      function onEvent(e: LiveEvent) {
        if (controller.desiredSize === null) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "event", event: e })}\n\n`)
          );
        } catch {
          liveEmitter.off("event", onEvent);
        }
      }

      liveEmitter.on("event", onEvent);

      const hb = setInterval(() => {
        if (controller.desiredSize === null) {
          clearInterval(hb);
          liveEmitter.off("event", onEvent);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(hb);
          liveEmitter.off("event", onEvent);
        }
      }, 15000);

      cleanup = () => {
        liveEmitter.off("event", onEvent);
        clearInterval(hb);
      };
    },
    cancel() {
      cleanup?.();
      cleanup = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
