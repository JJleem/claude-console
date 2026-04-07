import { EventEmitter } from "events";

export type LiveEvent = {
  id: string;
  event: "PreToolUse" | "PostToolUse" | "Stop" | "Notification" | "ABTest" | "Eval";
  tool?: string;
  input?: string;
  output?: string;
  sessionId?: string;
  timestamp: number;
};

// Global singleton — survives Next.js hot reload in dev
const g = global as unknown as { _liveEmitter?: EventEmitter; _liveEvents?: LiveEvent[] };

if (!g._liveEmitter) {
  g._liveEmitter = new EventEmitter();
  g._liveEmitter.setMaxListeners(100);
}
if (!g._liveEvents) {
  g._liveEvents = [];
}

export const liveEmitter: EventEmitter = g._liveEmitter;
export const liveEvents: LiveEvent[] = g._liveEvents;

export function pushEvent(e: LiveEvent) {
  liveEvents.push(e);
  // keep last 200
  if (liveEvents.length > 200) liveEvents.splice(0, liveEvents.length - 200);
  liveEmitter.emit("event", e);
}
