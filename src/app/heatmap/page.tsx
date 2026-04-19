"use client";

import { useEffect, useState, useCallback } from "react";
import { LayoutGrid, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HourStat = { hour: number; tokens: number; calls: number };
type DowStat = { dow: number; label: string; tokens: number; calls: number };
type GridCell = { dow: number; hour: number; tokens: number };

type HeatmapData = {
  byHour: HourStat[];
  byDow: DowStat[];
  grid: GridCell[];
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTokens(t: number): string {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`;
  if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K`;
  return String(t);
}

function HourBarChart({ data }: { data: HourStat[] }) {
  const max = Math.max(...data.map((d) => d.tokens), 1);
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
          Tokens by Hour (UTC)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-end gap-px h-20">
          {data.map((d) => {
            const pct = d.tokens / max;
            return (
              <div
                key={d.hour}
                className="flex-1 flex flex-col items-center gap-px group relative"
              >
                <div
                  className="w-full rounded-sm bg-primary transition-all"
                  style={{ height: `${Math.max(pct * 72, d.tokens > 0 ? 2 : 0)}px`, opacity: 0.2 + pct * 0.8 }}
                />
                {/* tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="bg-popover border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap shadow-md">
                    {d.hour}:00 — {formatTokens(d.tokens)} tokens · {d.calls} calls
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex mt-1">
          {data.map((d) => (
            <div key={d.hour} className="flex-1 text-center text-[8px] text-muted-foreground/60">
              {d.hour % 6 === 0 ? d.hour : ""}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DowBarChart({ data }: { data: DowStat[] }) {
  const max = Math.max(...data.map((d) => d.tokens), 1);
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
          Tokens by Day of Week
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-end gap-1.5 h-20">
          {data.map((d) => {
            const pct = d.tokens / max;
            return (
              <div
                key={d.dow}
                className="flex-1 flex flex-col items-center gap-1 group relative"
              >
                <div
                  className="w-full rounded-sm bg-primary transition-all"
                  style={{ height: `${Math.max(pct * 72, d.tokens > 0 ? 2 : 0)}px`, opacity: 0.2 + pct * 0.8 }}
                />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                  <div className="bg-popover border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap shadow-md">
                    {d.label} — {formatTokens(d.tokens)} tokens · {d.calls} calls
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex mt-1 gap-1.5">
          {data.map((d) => (
            <div key={d.dow} className="flex-1 text-center text-[9px] text-muted-foreground/70">
              {d.label.slice(0, 2)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HeatmapGrid({ grid }: { grid: GridCell[] }) {
  const maxTokens = Math.max(...grid.map((c) => c.tokens), 1);

  // Build lookup: dow → hour → tokens
  const lookup: Record<number, Record<number, number>> = {};
  for (const cell of grid) {
    if (!lookup[cell.dow]) lookup[cell.dow] = {};
    lookup[cell.dow][cell.hour] = cell.tokens;
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
          7 × 24 Heatmap (rows = day, cols = hour UTC)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 overflow-x-auto">
        {/* Hour labels */}
        <div className="flex mb-1 ml-10">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[8px] text-muted-foreground/60 min-w-[18px]">
              {h % 6 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {/* Rows */}
        {DOW_LABELS.map((label, dow) => (
          <div key={dow} className="flex items-center mb-0.5">
            <span className="w-10 text-[9px] text-muted-foreground shrink-0">{label}</span>
            <div className="flex flex-1 gap-px">
              {Array.from({ length: 24 }, (_, h) => {
                const tokens = lookup[dow]?.[h] ?? 0;
                const opacity = tokens > 0 ? 0.12 + (tokens / maxTokens) * 0.88 : 0.06;
                return (
                  <div
                    key={h}
                    className="flex-1 rounded-sm bg-primary group relative"
                    style={{ height: 18, minWidth: 18, opacity }}
                  >
                    {tokens > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex z-10 pointer-events-none">
                        <div className="bg-popover border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap shadow-md">
                          {label} {h}:00 — {formatTokens(tokens)} tokens
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[9px] text-muted-foreground">Less</span>
          {[0.06, 0.25, 0.45, 0.65, 0.88].map((op) => (
            <div key={op} className="w-4 h-3 rounded-sm bg-primary" style={{ opacity: op }} />
          ))}
          <span className="text-[9px] text-muted-foreground">More</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HeatmapPage() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/heatmap");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalTokens = data ? data.byHour.reduce((s, d) => s + d.tokens, 0) : 0;
  const totalCalls = data ? data.byHour.reduce((s, d) => s + d.calls, 0) : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid size={14} className="text-primary" />
          <h1 className="text-sm font-semibold text-foreground">Token Heatmap</h1>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-mono">
                {formatTokens(totalTokens)} tokens total
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                {totalCalls} calls
              </Badge>
            </div>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-border transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <HourBarChart data={data.byHour} />
              <DowBarChart data={data.byDow} />
            </div>
            <HeatmapGrid grid={data.grid} />
          </>
        ) : null}
      </div>
    </div>
  );
}
