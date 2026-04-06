import { liveEmitter, liveEvents, type LiveEvent } from "@/lib/live-emitter";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // send recent history on connect
      const history = [...liveEvents];
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "history", events: history })}\n\n`)
      );

      function onEvent(e: LiveEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "event", event: e })}\n\n`)
        );
      }

      liveEmitter.on("event", onEvent);

      // heartbeat every 15s to keep connection alive
      const hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(hb);
        }
      }, 15000);

      return () => {
        liveEmitter.off("event", onEvent);
        clearInterval(hb);
      };
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
