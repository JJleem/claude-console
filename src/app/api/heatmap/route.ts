import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function GET() {
  const allRuns = await db.select().from(runs);

  // Initialize accumulators
  const byHourMap = new Map<number, { tokens: number; calls: number }>();
  const byDowMap = new Map<number, { tokens: number; calls: number }>();
  const gridMap = new Map<string, number>(); // "dow-hour" → tokens

  for (let h = 0; h < 24; h++) byHourMap.set(h, { tokens: 0, calls: 0 });
  for (let d = 0; d < 7; d++) byDowMap.set(d, { tokens: 0, calls: 0 });

  for (const run of allRuns) {
    // createdAt is stored as "YYYY-MM-DD HH:MM:SS" UTC
    const date = new Date(run.createdAt + "Z");
    const hour = date.getUTCHours();
    const dow = date.getUTCDay();
    const tokens = run.inputTokens + run.outputTokens;

    const h = byHourMap.get(hour)!;
    h.tokens += tokens;
    h.calls += 1;

    const d = byDowMap.get(dow)!;
    d.tokens += tokens;
    d.calls += 1;

    const key = `${dow}-${hour}`;
    gridMap.set(key, (gridMap.get(key) ?? 0) + tokens);
  }

  const byHour = Array.from(byHourMap.entries()).map(([hour, v]) => ({
    hour,
    tokens: v.tokens,
    calls: v.calls,
  }));

  const byDow = Array.from(byDowMap.entries()).map(([dow, v]) => ({
    dow,
    label: DOW_LABELS[dow],
    tokens: v.tokens,
    calls: v.calls,
  }));

  const grid: { dow: number; hour: number; tokens: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.push({ dow: d, hour: h, tokens: gridMap.get(`${d}-${h}`) ?? 0 });
    }
  }

  return NextResponse.json({ byHour, byDow, grid });
}
