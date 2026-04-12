import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const allRuns = await db.select().from(runs).orderBy(desc(runs.createdAt));

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);

  const todayRuns = allRuns.filter(r => new Date(r.createdAt + "Z") >= todayStart);
  const weekRuns  = allRuns.filter(r => new Date(r.createdAt + "Z") >= weekAgo);

  // ── Daily trend (last 7 days) ──────────────────────────────────
  const daily: { date: string; calls: number; cost: number; tokens: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const dayRuns = allRuns.filter(r => {
      const t = new Date(r.createdAt + "Z");
      return t >= d && t < next;
    });
    daily.push({
      date: d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
      calls: dayRuns.length,
      cost: dayRuns.reduce((s, r) => s + r.costUsd, 0),
      tokens: dayRuns.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    });
  }

  // ── By model ──────────────────────────────────────────────────
  const modelMap = new Map<string, { calls: number; cost: number; tokens: number }>();
  for (const r of allRuns) {
    const key = r.model.replace("claude-", "").replace("-20251001", "");
    const cur = modelMap.get(key) ?? { calls: 0, cost: 0, tokens: 0 };
    modelMap.set(key, { calls: cur.calls + 1, cost: cur.cost + r.costUsd, tokens: cur.tokens + r.inputTokens + r.outputTokens });
  }
  const byModel = [...modelMap.entries()]
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.calls - a.calls);

  // ── By source (from metadata) ─────────────────────────────────
  const sourceMap = new Map<string, { calls: number; cost: number }>();
  for (const r of allRuns) {
    let source = "direct";
    try {
      const meta = JSON.parse(r.metadata ?? "{}");
      if (meta.source) source = meta.source;
    } catch {}
    const cur = sourceMap.get(source) ?? { calls: 0, cost: 0 };
    sourceMap.set(source, { calls: cur.calls + 1, cost: cur.cost + r.costUsd });
  }
  const bySource = [...sourceMap.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.calls - a.calls);

  return NextResponse.json({
    today: {
      calls: todayRuns.length,
      cost: todayRuns.reduce((s, r) => s + r.costUsd, 0),
      tokens: todayRuns.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    },
    week: {
      calls: weekRuns.length,
      cost: weekRuns.reduce((s, r) => s + r.costUsd, 0),
    },
    total: {
      calls: allRuns.length,
      cost: allRuns.reduce((s, r) => s + r.costUsd, 0),
      tokens: allRuns.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    },
    daily,
    byModel,
    bySource,
    recentRuns: allRuns.slice(0, 8).map(r => ({
      id: r.id, createdAt: r.createdAt, model: r.model,
      userPrompt: r.userPrompt, costUsd: r.costUsd,
      inputTokens: r.inputTokens, outputTokens: r.outputTokens,
      metadata: r.metadata,
    })),
  });
}
