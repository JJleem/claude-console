"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GitCompare, Loader2, FlaskConical, Trophy, Minus, History, ArrowDownLeft, ArrowUpRight, Clock, ChevronDown, ChevronUp, RotateCcw, DollarSign, AlertCircle } from "lucide-react";
import { HarnessLibrary } from "@/components/HarnessLibrary";
import type { Harness, HarnessRun } from "@/lib/db/schema";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku" },
  { id: "claude-sonnet-4-6", label: "Sonnet" },
  { id: "claude-opus-4-6", label: "Opus" },
];

type Result = {
  response: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number;
};
type Winner = "A" | "B" | "tie" | null;

// ─── 슬롯 선택기 ───────────────────────────────────────────────────────────────

function SlotSelector({
  side,
  selected,
  harnessList,
  onChange,
}: {
  side: "A" | "B";
  selected: Harness | null;
  harnessList: Harness[];
  onChange: (h: Harness | null) => void;
}) {
  const color = side === "A" ? "text-blue-400" : "text-green-400";
  const ringColor = side === "A" ? "focus:ring-blue-500/40" : "focus:ring-green-500/40";

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
      <span className={`text-[11px] font-bold ${color}`}>슬롯 {side}</span>
      <select
        value={selected?.id ?? "__default__"}
        onChange={(e) => {
          if (e.target.value === "__default__") onChange(null);
          else onChange(harnessList.find((h) => h.id === e.target.value) ?? null);
        }}
        className={`flex-1 text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 ${ringColor}`}
      >
        <option value="__default__">기본값 (시스템 없음)</option>
        {harnessList.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
    </div>
  );
}

// ─── 결과 패널 ────────────────────────────────────────────────────────────────

function Panel({
  side,
  harness,
  harnessList,
  onChangeHarness,
  result,
  loading,
  streaming,
  activeWinner,
}: {
  side: "A" | "B";
  harness: Harness | null;
  harnessList: Harness[];
  onChangeHarness: (h: Harness | null) => void;
  result: Result | null;
  loading: boolean;
  streaming: boolean;
  activeWinner: Winner;
}) {
  const isWinner = activeWinner === side;
  const isTie = activeWinner === "tie";
  const color = side === "A" ? "blue" : "green";

  return (
    <div className={`flex-1 flex flex-col min-w-0 overflow-hidden border-r last:border-r-0 border-border ${isWinner ? "bg-yellow-500/[0.03]" : ""}`}>
      {/* 슬롯 선택기 */}
      <SlotSelector
        side={side}
        selected={harness}
        harnessList={harnessList}
        onChange={onChangeHarness}
      />

      {/* 패널 헤더: 상태 배지 + 지표 */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 shrink-0 min-h-[36px]">
        {isWinner && (
          <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30 bg-yellow-500/10 gap-1">
            <Trophy size={9} /> 승자
          </Badge>
        )}
        {isTie && side === "A" && (
          <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
            <Minus size={9} /> 무승부
          </Badge>
        )}
        {result && (
          <div className="ml-auto flex items-center gap-2.5">
            <span className="flex items-center gap-1 text-xs font-mono text-blue-400">
              <ArrowDownLeft size={11} />
              {result.inputTokens.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-xs font-mono text-green-400">
              <ArrowUpRight size={11} />
              {result.outputTokens.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-xs font-mono text-amber-400">
              <Clock size={11} />
              {result.durationMs.toLocaleString()}ms
            </span>
            <span className="flex items-center gap-1 text-xs font-mono text-violet-400">
              <DollarSign size={11} />
              {result.costUsd.toFixed(4)}
            </span>
          </div>
        )}
      </div>

      {/* 시스템 프롬프트 미리보기 */}
      {harness?.system ? (
        <div className={`px-4 py-2 border-b border-border shrink-0 bg-${color}-500/[0.03]`}>
          <p className={`text-[10px] font-medium mb-1 text-${color}-400/70 uppercase tracking-wide`}>
            System Prompt
          </p>
          <p className="text-[11px] font-mono text-muted-foreground line-clamp-3 leading-snug whitespace-pre-wrap">
            {harness.system}
          </p>
        </div>
      ) : (
        <div className="px-4 py-2 border-b border-border shrink-0">
          <p className="text-[11px] text-muted-foreground/50 italic">시스템 프롬프트 없음 (기본값)</p>
        </div>
      )}

      {/* 결과 */}
      <div className="flex-1 min-h-0">
      <ScrollArea className="h-full">
        <div className="p-4">
          {result ? (
            <pre className={`text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans ${!isWinner && activeWinner ? "opacity-50" : ""}`}>
              {result.response}
              {streaming && <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5 align-middle" />}
            </pre>
          ) : loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 size={14} className={`animate-spin ${side === "A" ? "text-blue-400" : "text-green-400"}`} />
              응답 생성 중...
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4">결과가 여기 표시됩니다</p>
          )}
        </div>
      </ScrollArea>
      </div>
    </div>
  );
}

// ─── 판정 바 ──────────────────────────────────────────────────────────────────

function VerdictBar({
  winner,
  saved,
  onSelect,
}: {
  winner: Winner;
  saved: boolean;
  onSelect: (w: Winner) => void;
}) {
  const btn = (w: NonNullable<Winner>, label: string, cls: string) => (
    <button
      onClick={() => onSelect(winner === w ? null : w)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
        winner === w ? cls : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
    >
      {w === "A" && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
      {w === "B" && <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />}
      {w === "tie" && <Minus size={11} />}
      {label}
    </button>
  );

  return (
    <div className="border-t border-border px-4 py-2 flex items-center gap-2 shrink-0 bg-background">
      <span className="text-xs text-muted-foreground">판정</span>
      {btn("A", "A 승리", "bg-blue-500/10 border-blue-500/40 text-blue-400")}
      {btn("tie", "무승부", "bg-secondary border-foreground/20 text-foreground")}
      {btn("B", "B 승리", "bg-green-500/10 border-green-500/40 text-green-400")}
      {winner && saved && (
        <span className="ml-auto text-[11px] text-muted-foreground">저장됨</span>
      )}
    </div>
  );
}

// ─── 히스토리 카드 ─────────────────────────────────────────────────────────────

function HistoryCard({ run, harnessList, onLoad }: { run: HarnessRun; harnessList: Harness[]; onLoad: (run: HarnessRun) => void }) {
  const [expanded, setExpanded] = useState(false);

  const nameA = run.harnessIdA
    ? (harnessList.find((h) => h.id === run.harnessIdA)?.name ?? "삭제된 하네스")
    : "기본값";
  const nameB = run.harnessIdB
    ? (harnessList.find((h) => h.id === run.harnessIdB)?.name ?? "삭제된 하네스")
    : "기본값";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div
        className="w-full text-left px-3 pt-3 pb-2 space-y-2 hover:bg-accent/30 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {new Date(run.createdAt + "Z").toLocaleString("ko-KR")}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">{run.model}</span>
          <div className="flex gap-2 ml-auto items-center">
            <span className="flex items-center gap-1 text-[10px] font-mono text-blue-400/70">
              A <ArrowDownLeft size={9} />{run.inputTokensA} <ArrowUpRight size={9} />{run.outputTokensA} <Clock size={9} />{run.msA}ms
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-green-400/70">
              B <ArrowDownLeft size={9} />{run.inputTokensB} <ArrowUpRight size={9} />{run.outputTokensB} <Clock size={9} />{run.msB}ms
            </span>
          </div>
          {run.winner && (
            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30 bg-yellow-500/10 gap-1">
              <Trophy size={9} />
              {run.winner === "tie" ? "무승부" : `${run.winner} 승리`}
            </Badge>
          )}
          {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
        </div>

        {/* 비교 쌍 + 유저 메시지 */}
        <div className="flex gap-2 text-[11px]">
          <span className="text-blue-400/70">{nameA}</span>
          <span className="text-muted-foreground">vs</span>
          <span className="text-green-400/70">{nameB}</span>
        </div>
        <p className="text-xs font-medium text-foreground">{run.userMessage}</p>
      </div>

      {/* 테스트 뷰 불러오기 버튼 (헤더 밖) */}
      <div className="px-3 pb-2">
        <button
          onClick={() => onLoad(run)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors border border-border hover:border-foreground/30 rounded px-2 py-1"
        >
          <RotateCcw size={10} /> 테스트 뷰에서 보기
        </button>
      </div>

      {/* 접힌 상태: 미리보기 */}
      {!expanded && (
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
          {(["A", "B"] as const).map((side) => (
            <div key={side} className="bg-secondary px-3 py-2 space-y-1">
              <p className={`text-[10px] font-semibold ${side === "A" ? "text-blue-400/70" : "text-green-400/70"}`}>
                {side === "A" ? nameA : nameB}
              </p>
              <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                {side === "A" ? run.responseA : run.responseB}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 펼친 상태: 전체 내용 */}
      {expanded && (
        <div className="border-t border-border">
          {run.verdict && (
            <div className="px-3 py-2 border-b border-border bg-yellow-500/5">
              <p className="text-xs text-muted-foreground italic leading-relaxed">{run.verdict}</p>
            </div>
          )}
          {run.systemASnapshot || run.systemBSnapshot ? (
            <div className="grid grid-cols-2 gap-px bg-border border-b border-border">
              {(["A", "B"] as const).map((side) => (
                <div key={side} className="bg-secondary/50 px-3 py-2">
                  <p className={`text-[10px] font-semibold mb-1 ${side === "A" ? "text-blue-400/60" : "text-green-400/60"}`}>
                    System {side === "A" ? nameA : nameB}
                  </p>
                  <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-snug">
                    {(side === "A" ? run.systemASnapshot : run.systemBSnapshot) || "(없음)"}
                  </pre>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-px bg-border">
            {(["A", "B"] as const).map((side) => (
              <div key={side} className="bg-background px-3 py-3">
                <p className={`text-[10px] font-semibold mb-1.5 ${side === "A" ? "text-blue-400/70" : "text-green-400/70"}`}>
                  {side === "A" ? nameA : nameB}
                </p>
                <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                  {side === "A" ? run.responseA : run.responseB}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ABPage() {
  const [harnessList, setHarnessList] = useState<Harness[]>([]);
  const [slotA, setSlotA] = useState<Harness | null>(null);
  const [slotB, setSlotB] = useState<Harness | null>(null);
  const [model, setModel] = useState(MODELS[1].id);
  const [userMessage, setUserMessage] = useState("");

  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const loading = loadingA || loadingB;
  const [judging, setJudging] = useState(false);
  const [resultA, setResultA] = useState<Result | null>(null);
  const [resultB, setResultB] = useState<Result | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const [aiWinner, setAiWinner] = useState<Winner>(null);
  const [aiVerdict, setAiVerdict] = useState("");
  const [manualWinner, setManualWinner] = useState<Winner>(null);
  const [verdictSaved, setVerdictSaved] = useState(false);

  const [runError, setRunError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runHistory, setRunHistory] = useState<HarnessRun[]>([]);

  const hasResults = !!(resultA && resultB);
  const activeWinner: Winner = aiWinner ?? manualWinner;

  const fetchHarnesses = useCallback(async () => {
    const res = await fetch("/api/harness");
    setHarnessList(await res.json());
  }, []);

  useEffect(() => { fetchHarnesses(); }, [fetchHarnesses]);

  function resetResults() {
    setResultA(null); setResultB(null);
    setCurrentRunId(null);
    setAiWinner(null); setAiVerdict("");
    setManualWinner(null); setVerdictSaved(false);
    setRunError(null);
  }

  // ── 실행 ────────────────────────────────────────────────────────────────────

  async function streamSlot(
    system: string,
    side: "A" | "B"
  ): Promise<{ response: string; inputTokens: number; outputTokens: number; durationMs: number; costUsd: number } | null> {
    const setResult = side === "A" ? setResultA : setResultB;
    const setLoading = side === "A" ? setLoadingA : setLoadingB;

    setLoading(true);
    setResult({ response: "", inputTokens: 0, outputTokens: 0, durationMs: 0, costUsd: 0 });

    let accText = "";

    try {
      const res = await fetch("/api/ab/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, userMessage, model, slot: side }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setRunError(err.error ?? `오류 (${res.status})`);
        return null;
      }

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

          if (data.type === "text") {
            accText += data.text;
            setResult((prev) => prev ? { ...prev, response: accText } : null);
          } else if (data.type === "done") {
            setResult({ response: accText, inputTokens: data.inputTokens, outputTokens: data.outputTokens, durationMs: data.durationMs, costUsd: data.costUsd });
            return { response: accText, ...data };
          } else if (data.type === "error") {
            setRunError(data.message);
            return null;
          }
        }
      }
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    if (!userMessage.trim()) return;
    resetResults();

    const systemA = slotA?.system ?? "";
    const systemB = slotB?.system ?? "";

    const [dataA, dataB] = await Promise.all([
      streamSlot(systemA, "A"),
      streamSlot(systemB, "B"),
    ]);

    if (!dataA || !dataB) return;

    // harness run 기록 저장
    const runRes = await fetch("/api/harness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "run",
        harnessIdA: slotA?.id ?? null,
        harnessIdB: slotB?.id ?? null,
        model,
        userMessage,
        responseA: dataA.response,
        responseB: dataB.response,
        systemASnapshot: systemA,
        systemBSnapshot: systemB,
        inputTokensA: dataA.inputTokens,
        outputTokensA: dataA.outputTokens,
        inputTokensB: dataB.inputTokens,
        outputTokensB: dataB.outputTokens,
        msA: dataA.durationMs,
        msB: dataB.durationMs,
      }),
    });
    const run = await runRes.json();
    setCurrentRunId(run.id);
  }

  // ── AI 판정 ─────────────────────────────────────────────────────────────────

  async function handleJudge() {
    if (!hasResults) return;
    setJudging(true);
    setAiWinner(null); setAiVerdict(""); setManualWinner(null); setVerdictSaved(false);
    try {
      const res = await fetch("/api/ab", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemA: slotA?.system ?? "",
          systemB: slotB?.system ?? "",
          userMessage,
          responseA: resultA!.response,
          responseB: resultB!.response,
        }),
      });
      const data = await res.json();
      setAiWinner(data.winner);
      setAiVerdict(data.verdict);

      if (currentRunId) {
        await fetch("/api/harness", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: currentRunId, winner: data.winner, verdict: data.verdict }),
        });
        setVerdictSaved(true);
      }
    } finally {
      setJudging(false);
    }
  }

  // ── 수동 판정 ────────────────────────────────────────────────────────────────

  async function handleVerdictSelect(w: Winner) {
    if (activeWinner === w) {
      setManualWinner(null); setAiWinner(null); setVerdictSaved(false);
      return;
    }
    setManualWinner(w); setAiWinner(null); setVerdictSaved(false);
    if (currentRunId && w) {
      await fetch("/api/harness", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: currentRunId, winner: w, verdict: "" }),
      });
      setVerdictSaved(true);
    }
  }

  // ── 히스토리 run → 메인 뷰 복원 ────────────────────────────────────────────

  function loadRunIntoView(run: HarnessRun) {
    // 슬롯 복원
    const harnessA = harnessList.find((h) => h.id === run.harnessIdA) ?? null;
    const harnessB = harnessList.find((h) => h.id === run.harnessIdB) ?? null;
    setSlotA(harnessA);
    setSlotB(harnessB);
    setUserMessage(run.userMessage);
    setModel(run.model);
    // 결과 복원
    setResultA({ response: run.responseA, inputTokens: run.inputTokensA, outputTokens: run.outputTokensA, durationMs: run.msA, costUsd: 0 });
    setResultB({ response: run.responseB, inputTokens: run.inputTokensB, outputTokens: run.outputTokensB, durationMs: run.msB, costUsd: 0 });
    setCurrentRunId(run.id);
    setAiWinner((run.winner as Winner) || null);
    setAiVerdict(run.verdict ?? "");
    setManualWinner(null);
    setVerdictSaved(!!run.winner);
    setHistoryOpen(false);
  }

  // ── 히스토리 (전체) ──────────────────────────────────────────────────────────

  async function fetchAllHistory() {
    // 모든 run 기록: 각 하네스의 run을 합쳐 최신순으로
    const ids = harnessList.map((h) => h.id);
    const allRuns: HarnessRun[] = [];
    for (const id of ids) {
      const res = await fetch(`/api/harness/${id}`);
      const runs: HarnessRun[] = await res.json();
      runs.forEach((r) => {
        if (!allRuns.find((x) => x.id === r.id)) allRuns.push(r);
      });
    }
    allRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRunHistory(allRuns);
    setHistoryOpen(true);
  }

  // ─── 렌더링 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 왼쪽: 하네스 라이브러리 */}
      <div className="w-60 shrink-0 border-r border-border flex flex-col">
        <HarnessLibrary
          harnessList={harnessList}
          slotA={slotA}
          slotB={slotB}
          onAssignA={(h) => { setSlotA(h); resetResults(); }}
          onAssignB={(h) => { setSlotB(h); resetResults(); }}
          onDelete={async (id) => {
            await fetch("/api/harness", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            });
            if (slotA?.id === id) setSlotA(null);
            if (slotB?.id === id) setSlotB(null);
            fetchHarnesses();
          }}
          onCreated={fetchHarnesses}
        />
      </div>

      {/* 오른쪽: 메인 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <GitCompare size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">A/B Test</span>

          {/* 모델 선택 */}
          <div className="flex gap-1 ml-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  model === m.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={fetchAllHistory}>
              <History size={13} className="mr-1.5" />기록
            </Button>
            {hasResults && (
              <Button size="sm" variant="outline" onClick={handleJudge} disabled={judging}>
                {judging
                  ? <><Loader2 size={13} className="mr-1.5 animate-spin" />판정 중...</>
                  : <><FlaskConical size={13} className="mr-1.5" />AI 판정</>}
              </Button>
            )}
            <Button size="sm" onClick={handleRun} disabled={loading || !userMessage.trim()}>
              {loading
                ? <><Loader2 size={13} className="mr-1.5 animate-spin" />실행 중...</>
                : <><GitCompare size={13} className="mr-1.5" />둘 다 실행</>}
            </Button>
          </div>
        </div>

        {/* AI 판정 배너 */}
        {aiVerdict && (
          <div className="px-5 py-2.5 border-b border-border bg-yellow-500/5 flex items-start gap-2 shrink-0">
            <FlaskConical size={13} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed">{aiVerdict}</p>
          </div>
        )}

        {/* 오류 배너 */}
        {runError && (
          <div className="px-5 py-2.5 border-b border-border bg-red-500/10 flex items-center gap-2 shrink-0">
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400 flex-1">{runError}</p>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-6 text-xs"
              onClick={handleRun}
              disabled={loading}
            >
              <RotateCcw size={11} className="mr-1" />
              다시 시도
            </Button>
          </div>
        )}

        {/* A / B 패널 */}
        <div className="flex flex-1 overflow-hidden">
          <Panel
            side="A"
            harness={slotA}
            harnessList={harnessList}
            onChangeHarness={(h) => { setSlotA(h); resetResults(); }}
            result={resultA}
            loading={loadingA}
            streaming={loadingA && !!resultA}
            activeWinner={activeWinner}
          />
          <Panel
            side="B"
            harness={slotB}
            harnessList={harnessList}
            onChangeHarness={(h) => { setSlotB(h); resetResults(); }}
            result={resultB}
            loading={loadingB}
            streaming={loadingB && !!resultB}
            activeWinner={activeWinner}
          />
        </div>

        {/* 판정 바 */}
        {hasResults && (
          <VerdictBar
            winner={activeWinner}
            saved={verdictSaved}
            onSelect={handleVerdictSelect}
          />
        )}

        {/* 유저 메시지 */}
        <div className="border-t border-border px-4 py-3 shrink-0 bg-background">
          <label className="text-xs text-muted-foreground block mb-1.5">
            User Message <span className="opacity-50">(A, B 공통)</span>
          </label>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="두 슬롯에 공통으로 보낼 메시지를 입력하세요"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun();
            }}
            className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
          />
          <p className="text-xs text-muted-foreground mt-1.5">⌘Enter로 실행</p>
        </div>
      </div>

      {/* 히스토리 다이얼로그 */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">실행 기록</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            {runHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">아직 실행 기록이 없습니다</p>
            ) : (
              <div className="space-y-3 pr-4">
                {runHistory.map((r) => (
                  <HistoryCard key={r.id} run={r} harnessList={harnessList} onLoad={loadRunIntoView} />
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
