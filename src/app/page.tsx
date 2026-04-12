"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ExternalLink, TrendingUp, Zap, DollarSign, Hash, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type DayStat  = { date: string; calls: number; cost: number; tokens: number };
type ModelStat = { model: string; calls: number; cost: number; tokens: number };
type SrcStat  = { source: string; calls: number; cost: number };
type RecentRun = { id: string; createdAt: string; model: string; userPrompt: string; costUsd: number; inputTokens: number; outputTokens: number; metadata: string | null };

type OverviewData = {
  today:  { calls: number; cost: number; tokens: number };
  week:   { calls: number; cost: number };
  total:  { calls: number; cost: number; tokens: number };
  daily:  DayStat[];
  byModel: ModelStat[];
  bySource: SrcStat[];
  recentRuns: RecentRun[];
};

const SOURCE_LABELS: Record<string, string> = {
  "ab-test":        "A/B Test",
  "eval":           "Eval",
  "lab-rag":        "Lab · RAG",
  "lab-tools":      "Lab · Tool Use",
  "lab-structured": "Lab · Structured",
  "lab-chain":      "Lab · Chain",
  "direct":         "Direct",
};

const MODEL_COLORS: Record<string, string> = {
  "haiku-4-5": "bg-blue-400",
  "sonnet-4-6": "bg-purple-400",
  "opus-4-6":  "bg-orange-400",
};

function modelColor(model: string) {
  for (const [k, v] of Object.entries(MODEL_COLORS)) {
    if (model.includes(k)) return v;
  }
  return "bg-primary";
}

// Simple CSS bar chart
function BarChart({ data, valueKey, label }: { data: DayStat[]; valueKey: "calls" | "cost" | "tokens"; label: string }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-end gap-1.5 h-20">
        {data.map((d, i) => {
          const ratio = d[valueKey] / max;
          const isToday = i === data.length - 1;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-1.5 py-0.5 text-xs font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                {valueKey === "cost" ? `$${d[valueKey].toFixed(4)}` : d[valueKey].toLocaleString()}
              </div>
              <div className="w-full rounded-t-sm transition-all duration-300 min-h-[2px]"
                style={{ height: `${Math.max(ratio * 72, 2)}px`, backgroundColor: isToday ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)" }}
              />
              <span className="text-[10px] text-muted-foreground/60">{d.date.replace("월 ", "/").replace("일", "")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Horizontal percentage bar
function PctBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<"calls" | "cost">("calls");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/overview");
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={16} className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  const totalModelCalls = data.byModel.reduce((s, m) => s + m.calls, 0) || 1;
  const totalSrcCalls   = data.bySource.reduce((s, m) => s + m.calls, 0) || 1;

  return (
    <div className="p-6 max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Claude Console 사용 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={load}>
            <RefreshCw size={13} />
          </Button>
          <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded-md px-3 py-1.5">
            <ExternalLink size={11} />크레딧 잔액
          </a>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Hash,        label: "오늘 호출",   value: data.today.calls.toString(),             sub: `이번 주 ${data.week.calls}회` },
          { icon: DollarSign,  label: "오늘 비용",   value: `$${data.today.cost.toFixed(4)}`,         sub: `이번 주 $${data.week.cost.toFixed(4)}` },
          { icon: Zap,         label: "오늘 토큰",   value: data.today.tokens.toLocaleString(),       sub: "input + output" },
          { icon: TrendingUp,  label: "누적 총비용", value: `$${data.total.cost.toFixed(4)}`,         sub: `총 ${data.total.calls}회 호출` },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-2xl font-semibold text-foreground leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{s.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* Daily chart */}
        <Card className="col-span-2">
          <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">최근 7일 추세</CardTitle>
            <div className="flex gap-1">
              {(["calls", "cost"] as const).map(m => (
                <button key={m} onClick={() => setChartMode(m)}
                  className={cn("text-xs px-2 py-0.5 rounded transition-colors", chartMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {m === "calls" ? "호출수" : "비용"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <BarChart data={data.daily} valueKey={chartMode} label={chartMode === "calls" ? "API 호출 횟수" : "USD 비용"} />
          </CardContent>
        </Card>

        {/* Model breakdown */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">모델별 사용량</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {data.byModel.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">데이터 없음</p>
            ) : (
              data.byModel.map(m => {
                const pct = (m.calls / totalModelCalls) * 100;
                return (
                  <div key={m.model} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", modelColor(m.model))} />
                        <span className="text-xs text-foreground font-mono">{m.model}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{m.calls}회</span>
                    </div>
                    <PctBar pct={pct} color={modelColor(m.model)} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Source breakdown + Recent runs */}
      <div className="grid grid-cols-3 gap-4">

        {/* Source */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">출처별 호출</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {data.bySource.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">데이터 없음</p>
            ) : (
              data.bySource.map(s => {
                const pct = (s.calls / totalSrcCalls) * 100;
                return (
                  <div key={s.source} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground">{SOURCE_LABELS[s.source] ?? s.source}</span>
                      <span className="text-xs text-muted-foreground font-mono">{s.calls}회</span>
                    </div>
                    <PctBar pct={pct} color="bg-primary/60" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent runs */}
        <Card className="col-span-2">
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-sm font-medium">최근 실행</CardTitle>
          </CardHeader>
          <Separator className="mt-3" />
          {data.recentRuns.length === 0 ? (
            <CardContent className="py-8 text-center text-xs text-muted-foreground">
              아직 기록이 없습니다. Eval이나 AI Lab을 실행해보세요.
            </CardContent>
          ) : (
            <div className="divide-y divide-border">
              {data.recentRuns.map(run => {
                let source = "";
                try { const m = JSON.parse(run.metadata ?? "{}"); source = m.source ?? ""; } catch {}
                return (
                  <div key={run.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground font-mono w-16 shrink-0">
                      {new Date(run.createdAt + "Z").toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge variant="secondary" className="font-mono text-xs shrink-0 h-5 px-1.5">
                      {run.model.replace("claude-", "").replace("-20251001", "")}
                    </Badge>
                    {source && (
                      <Badge variant="outline" className="text-xs shrink-0 h-5 px-1.5">
                        {SOURCE_LABELS[source] ?? source}
                      </Badge>
                    )}
                    <span className="flex-1 text-xs text-foreground truncate">{run.userPrompt}</span>
                    <span className="text-xs font-mono text-primary shrink-0">${run.costUsd.toFixed(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
