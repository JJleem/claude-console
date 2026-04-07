"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FlaskConical, Loader2, ArrowDownLeft, ArrowUpRight, Clock, DollarSign, ListChecks } from "lucide-react";
import type { Run } from "@/lib/db/schema";

type EvalResult = {
  evaluation: {
    id: string;
    createdAt: string;
    runId: string;
    relevance: number;
    quality: number;
    accuracy: number;
    totalScore: number;
    feedback: string;
    judgeModel: string;
  };
  run: {
    userPrompt: string;
    systemPrompt: string | null;
    response: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    durationMs: number;
  };
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 4 ? "bg-green-500/10 text-green-400 border-green-500/20"
    : score >= 3 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
    : "bg-red-500/10 text-red-400 border-red-500/20";
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 4 ? "bg-green-500" : score >= 3 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <ScoreBadge score={score} />
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${(score / 5) * 100}%` }} />
      </div>
    </div>
  );
}

export default function EvalPage() {
  const [results, setResults] = useState<EvalResult[]>([]);
  const [selected, setSelected] = useState<EvalResult | null>(null);
  const [summary, setSummary] = useState("");
  const [progress, setProgress] = useState("");
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(5);

  // 직접 선택 모드
  const [pickMode, setPickMode] = useState(false);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  async function fetchResults() {
    const res = await fetch("/api/eval");
    const data = await res.json();
    setResults(data);
  }

  async function fetchRecentRuns() {
    const res = await fetch("/api/runs");
    const data = await res.json();
    setRecentRuns(data);
  }

  useEffect(() => { fetchResults(); }, []);

  function togglePickMode() {
    setPickMode((v) => {
      if (!v) fetchRecentRuns();
      return !v;
    });
    setCheckedIds(new Set());
  }

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function runEval() {
    setLoading(true);
    setSummary("");
    setProgress("");
    setSelected(null);

    try {
      const body = pickMode && checkedIds.size > 0
        ? { runIds: [...checkedIds] }
        : { limit };

      const res = await fetch("/api/eval/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) { setLoading(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === "progress") setProgress(data.message);
          else if (data.type === "text") setSummary((p) => p + data.text);
          else if (data.type === "done") { setResults(data.results); setProgress(""); }
          else if (data.type === "error") setProgress(`오류: ${data.message}`);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const rightContent = () => {
    // 채점 중 — 진행 상황 + 스트리밍 요약
    if (loading) return (
      <div className="p-6 space-y-4 max-w-3xl">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={14} className="animate-spin text-primary shrink-0" />
          <span className="text-xs animate-pulse">{progress || "채점 준비 중..."}</span>
        </div>
        {summary && (
          <div className="rounded-md border border-border p-4 bg-accent/10">
            <p className="text-xs text-muted-foreground mb-2 font-medium">요약 작성 중...</p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {summary}
              <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5 align-middle" />
            </p>
          </div>
        )}
      </div>
    );

    // 항목 선택됨
    if (selected) {
      const { evaluation: ev, run } = selected;
      return (
        <ScrollArea className="h-full">
          <div className="p-6 space-y-5 max-w-3xl">
            {/* 헤더 */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="font-mono text-xs">{run.model.replace("claude-", "")}</Badge>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">종합</span>
                <ScoreBadge score={ev.totalScore} />
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(ev.createdAt + "Z").toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
              </span>
            </div>

            {/* 통계 */}
            <div className="flex gap-4 text-xs font-mono">
              <span className="flex items-center gap-1 text-blue-400"><ArrowDownLeft size={11} />{run.inputTokens.toLocaleString()}</span>
              <span className="flex items-center gap-1 text-green-400"><ArrowUpRight size={11} />{run.outputTokens.toLocaleString()}</span>
              <span className="flex items-center gap-1 text-amber-400"><Clock size={11} />{run.durationMs.toLocaleString()}ms</span>
              <span className="flex items-center gap-1 text-violet-400"><DollarSign size={11} />${run.costUsd.toFixed(4)}</span>
            </div>

            {/* 점수 바 */}
            <div className="space-y-2.5 p-4 rounded-md border border-border bg-accent/10">
              <ScoreBar label="관련성" score={ev.relevance} />
              <ScoreBar label="품질"   score={ev.quality} />
              <ScoreBar label="정확성" score={ev.accuracy} />
            </div>

            {/* 피드백 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI 피드백</p>
              <p className="text-sm text-foreground leading-relaxed bg-accent/10 rounded-md border border-border px-4 py-3">
                {ev.feedback}
              </p>
            </div>

            <Separator />

            {/* 시스템 프롬프트 */}
            {run.systemPrompt && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System</p>
                <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-md px-3 py-2.5 whitespace-pre-wrap leading-relaxed">
                  {run.systemPrompt}
                </pre>
              </div>
            )}

            {/* 유저 프롬프트 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-primary uppercase tracking-wide">User</p>
              <p className="text-sm text-foreground bg-primary/5 border border-primary/20 rounded-md px-4 py-3 whitespace-pre-wrap leading-relaxed">
                {run.userPrompt}
              </p>
            </div>

            {/* 응답 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assistant</p>
              <p className="text-sm text-foreground bg-secondary rounded-md px-4 py-3 whitespace-pre-wrap leading-relaxed">
                {run.response}
              </p>
            </div>
          </div>
        </ScrollArea>
      );
    }

    // 요약 완료
    if (summary) return (
      <div className="p-6 max-w-3xl space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-primary" />
          <span className="text-sm font-medium">채점 요약</span>
        </div>
        <Separator />
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{summary}</p>
        <p className="text-xs text-muted-foreground mt-4">← 왼쪽 항목을 클릭하면 상세 내용을 확인할 수 있습니다</p>
      </div>
    );

    return (
      <div className="flex items-center justify-center h-full text-center px-8">
        <div className="space-y-2">
          <FlaskConical size={28} className="text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Eval 실행 후 항목을 클릭하면<br />상세 채점 결과를 확인할 수 있습니다</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-3 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground">Eval</h1>
          <p className="text-xs text-muted-foreground mt-0.5">LLM-as-judge 자동 채점</p>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-border space-y-3">
          {/* 모드 전환 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">채점할 runs</span>
            <button
              onClick={togglePickMode}
              className={`ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                pickMode ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListChecks size={11} />
              직접 선택
            </button>
          </div>

          {/* 빠른 선택 (pickMode 아닐 때) */}
          {!pickMode && (
            <div className="flex gap-1">
              {[3, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                    limit === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  최근 {n}개
                </button>
              ))}
            </div>
          )}

          {/* 직접 선택 목록 */}
          {pickMode && (
            <div className="border border-border rounded-md overflow-hidden">
              <div className="px-3 py-1.5 bg-secondary/50 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">최근 runs</span>
                {checkedIds.size > 0 && (
                  <span className="text-[10px] text-primary">{checkedIds.size}개 선택</span>
                )}
              </div>
              <ScrollArea className="max-h-48">
                {recentRuns.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">runs가 없습니다</p>
                ) : recentRuns.map((run) => (
                  <label
                    key={run.id}
                    className="flex items-start gap-2.5 px-3 py-2 hover:bg-accent/30 cursor-pointer border-b border-border/50 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={checkedIds.has(run.id)}
                      onChange={() => toggleCheck(run.id)}
                      className="mt-0.5 accent-primary shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate">{run.userPrompt}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {run.model.replace("claude-", "")} · {new Date(run.createdAt + "Z").toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </p>
                    </div>
                  </label>
                ))}
              </ScrollArea>
            </div>
          )}

          <Button
            onClick={runEval}
            disabled={loading || (pickMode && checkedIds.size === 0)}
            className="w-full"
            size="sm"
          >
            {loading
              ? <><Loader2 size={14} className="mr-2 animate-spin" />채점 중...</>
              : <><FlaskConical size={14} className="mr-2" />
                {pickMode && checkedIds.size > 0 ? `${checkedIds.size}개 Eval 실행` : "Eval 실행"}
              </>}
          </Button>
          {loading && progress && (
            <p className="text-[11px] text-muted-foreground animate-pulse leading-snug">{progress}</p>
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            {results.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">아직 채점 결과가 없습니다</div>
            ) : (
              <div className="divide-y divide-border">
                {results.map((r) => (
                  <button
                    key={r.evaluation.id}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-4 py-3 space-y-1.5 hover:bg-accent/50 transition-colors ${
                      selected?.evaluation.id === r.evaluation.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs shrink-0">
                        {r.run.model.replace("claude-", "")}
                      </Badge>
                      <ScoreBadge score={r.evaluation.totalScore} />
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(r.evaluation.createdAt + "Z").toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate">{r.run.userPrompt}</p>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>관련 <ScoreBadge score={r.evaluation.relevance} /></span>
                      <span>품질 <ScoreBadge score={r.evaluation.quality} /></span>
                      <span>정확 <ScoreBadge score={r.evaluation.accuracy} /></span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {rightContent()}
      </div>
    </div>
  );
}
