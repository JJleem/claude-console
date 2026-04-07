"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GitCompare, Loader2, FlaskConical, Trophy, Minus, Plus, Trash2, Save, History, ChevronRight } from "lucide-react";
import type { Harness, HarnessRun } from "@/lib/db/schema";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku" },
  { id: "claude-sonnet-4-6", label: "Sonnet" },
  { id: "claude-opus-4-6", label: "Opus" },
];

type Result = { response: string; inputTokens: number; outputTokens: number; durationMs: number };
type Winner = "A" | "B" | "tie" | null;

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-muted-foreground font-mono">
      {label} <span className="text-foreground">{value}</span>
    </span>
  );
}

function Panel({
  label, side, system, onSystem, result, loading, winner, manualWinner, onPick, disabled,
}: {
  label: string; side: "A" | "B"; system: string; onSystem: (v: string) => void;
  result: Result | null; loading: boolean; winner: Winner; manualWinner: Winner;
  onPick: () => void; disabled: boolean;
}) {
  const isWinner = (winner ?? manualWinner) === side;
  const isTie = (winner ?? manualWinner) === "tie";

  return (
    <div className={`flex-1 flex flex-col min-w-0 border-r last:border-r-0 border-border ${isWinner ? "bg-yellow-500/[0.02]" : ""}`}>
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isWinner ? "bg-yellow-500/15 text-yellow-400" : "bg-secondary text-muted-foreground"}`}>
          {label}
        </span>
        {isWinner && <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30 bg-yellow-500/10 gap-1"><Trophy size={9} />Winner</Badge>}
        {isTie && side === "A" && <Badge variant="outline" className="text-xs text-muted-foreground gap-1"><Minus size={9} />Draw</Badge>}
        {result && (
          <div className="ml-auto flex items-center gap-3">
            <StatBadge label="in" value={result.inputTokens.toLocaleString()} />
            <StatBadge label="out" value={result.outputTokens.toLocaleString()} />
            <StatBadge label="ms" value={result.durationMs.toLocaleString()} />
          </div>
        )}
      </div>
      <div className="px-4 pt-3 pb-2 border-b border-border shrink-0">
        <label className="text-xs text-muted-foreground block mb-1.5">System Prompt {label}</label>
        <textarea
          value={system} onChange={(e) => onSystem(e.target.value)}
          rows={5} spellCheck={false} disabled={disabled}
          placeholder="System prompt (비워두면 system 없이 호출)"
          className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none leading-relaxed disabled:opacity-50"
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 size={14} className="animate-spin text-primary" />응답 대기 중...
            </div>
          ) : result ? (
            <>
              <pre className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans">{result.response}</pre>
              {!(winner ?? manualWinner) && (
                <button onClick={onPick} className="mt-4 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-md px-3 py-1.5 transition-colors">
                  {side}가 더 낫다
                </button>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground py-4">결과가 여기 표시됩니다</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ABPage() {
  const [harnessList, setHarnessList] = useState<Harness[]>([]);
  const [selectedHarness, setSelectedHarness] = useState<Harness | null>(null);
  const [runHistory, setRunHistory] = useState<HarnessRun[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [systemA, setSystemA] = useState("");
  const [systemB, setSystemB] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [model, setModel] = useState(MODELS[1].id);
  const [loading, setLoading] = useState(false);
  const [judging, setJudging] = useState(false);
  const [resultA, setResultA] = useState<Result | null>(null);
  const [resultB, setResultB] = useState<Result | null>(null);
  const [aiWinner, setAiWinner] = useState<Winner>(null);
  const [aiVerdict, setAiVerdict] = useState("");
  const [manualWinner, setManualWinner] = useState<Winner>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");

  const hasResults = !!(resultA && resultB);
  const finalWinner = aiWinner ?? manualWinner;

  const fetchHarnesses = useCallback(async () => {
    const res = await fetch("/api/harness");
    setHarnessList(await res.json());
  }, []);

  useEffect(() => { fetchHarnesses(); }, [fetchHarnesses]);

  async function fetchHistory(harnessId: string) {
    const res = await fetch(`/api/harness/${harnessId}`);
    setRunHistory(await res.json());
  }

  function loadHarness(h: Harness) {
    setSelectedHarness(h);
    setSystemA(h.systemA);
    setSystemB(h.systemB);
    setModel(h.model);
    setResultA(null); setResultB(null);
    setAiWinner(null); setAiVerdict(""); setManualWinner(null);
  }

  function newHarness() {
    setSelectedHarness(null);
    setSystemA(""); setSystemB("");
    setModel(MODELS[1].id);
    setResultA(null); setResultB(null);
    setAiWinner(null); setAiVerdict(""); setManualWinner(null);
  }

  async function handleSave() {
    if (!saveName.trim()) return;
    await fetch("/api/harness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", name: saveName, model, systemA, systemB, description: saveDesc }),
    });
    setSaveOpen(false); setSaveName(""); setSaveDesc("");
    fetchHarnesses();
  }

  async function handleDelete(id: string) {
    await fetch("/api/harness", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selectedHarness?.id === id) newHarness();
    fetchHarnesses();
  }

  async function handleRun() {
    if (!userMessage.trim()) return;
    setLoading(true);
    setResultA(null); setResultB(null);
    setAiWinner(null); setAiVerdict(""); setManualWinner(null);
    try {
      const res = await fetch("/api/ab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemA, systemB, userMessage, model }),
      });
      const data = await res.json();
      setResultA(data.a);
      setResultB(data.b);

      // 하네스가 선택된 경우 run 저장
      if (selectedHarness) {
        await fetch("/api/harness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "run", harnessId: selectedHarness.id, userMessage,
            responseA: data.a.response, responseB: data.b.response,
            tokensA: data.a.inputTokens + data.a.outputTokens,
            tokensB: data.b.inputTokens + data.b.outputTokens,
            msA: data.a.durationMs, msB: data.b.durationMs,
          }),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleJudge() {
    if (!hasResults) return;
    setJudging(true);
    setAiWinner(null); setAiVerdict(""); setManualWinner(null);
    try {
      const res = await fetch("/api/ab", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemA, systemB, userMessage, responseA: resultA!.response, responseB: resultB!.response }),
      });
      const data = await res.json();
      setAiWinner(data.winner);
      setAiVerdict(data.verdict);

      // run 있으면 winner 업데이트 (마지막 run)
      if (selectedHarness) {
        const history = await fetch(`/api/harness/${selectedHarness.id}`).then(r => r.json());
        if (history[0]) {
          await fetch("/api/harness", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "run", harnessId: selectedHarness.id, userMessage, responseA: resultA!.response, responseB: resultB!.response, tokensA: resultA!.inputTokens + resultA!.outputTokens, tokensB: resultB!.inputTokens + resultB!.outputTokens, msA: resultA!.durationMs, msB: resultB!.durationMs, winner: data.winner, verdict: data.verdict }),
          });
        }
      }
    } finally {
      setJudging(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: Harness Library */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Harness Library</span>
          <button onClick={() => setSaveOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Plus size={14} />
          </button>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-1">
            <button
              onClick={newHarness}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center gap-2 ${!selectedHarness ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
            >
              <Plus size={11} />새 하네스
            </button>
            {harnessList.map((h) => (
              <div
                key={h.id}
                className={`group flex items-center px-4 py-2.5 cursor-pointer transition-colors ${selectedHarness?.id === h.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                onClick={() => loadHarness(h)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{h.name}</p>
                  <p className="text-xs opacity-50 truncate">{h.model.replace("claude-", "").replace(/-\d+.*/, "")}</p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); fetchHistory(h.id); setHistoryOpen(true); }}
                    className="p-1 hover:text-primary transition-colors"
                  >
                    <History size={11} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(h.id); }}
                    className="p-1 hover:text-destructive transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <GitCompare size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">
            {selectedHarness ? selectedHarness.name : "A/B Test"}
          </span>
          {selectedHarness && <ChevronRight size={12} className="text-muted-foreground" />}
          <div className="flex gap-1 ml-2">
            {MODELS.map((m) => (
              <button
                key={m.id} onClick={() => setModel(m.id)}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${model === m.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!selectedHarness && (systemA || systemB) && (
              <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
                <Save size={13} className="mr-1.5" />저장
              </Button>
            )}
            {hasResults && (
              <Button size="sm" variant="outline" onClick={handleJudge} disabled={judging}>
                {judging ? <><Loader2 size={13} className="mr-1.5 animate-spin" />판정 중...</> : <><FlaskConical size={13} className="mr-1.5" />AI 판정</>}
              </Button>
            )}
            <Button size="sm" onClick={handleRun} disabled={loading || !userMessage.trim()}>
              {loading ? <><Loader2 size={13} className="mr-1.5 animate-spin" />실행 중...</> : <><GitCompare size={13} className="mr-1.5" />둘 다 실행</>}
            </Button>
          </div>
        </div>

        {/* AI verdict */}
        {aiVerdict && (
          <div className="px-5 py-2.5 border-b border-border bg-yellow-500/5 flex items-start gap-2 shrink-0">
            <FlaskConical size={13} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed">{aiVerdict}</p>
          </div>
        )}

        {/* A/B panels */}
        <div className="flex flex-1 overflow-hidden">
          <Panel label="A" side="A" system={systemA} onSystem={setSystemA} result={resultA} loading={loading} winner={aiWinner} manualWinner={manualWinner} onPick={() => setManualWinner("A")} disabled={!!selectedHarness} />
          <Panel label="B" side="B" system={systemB} onSystem={setSystemB} result={resultB} loading={loading} winner={aiWinner} manualWinner={manualWinner} onPick={() => setManualWinner("B")} disabled={!!selectedHarness} />
        </div>

        {/* User message */}
        <div className="border-t border-border px-4 py-3 shrink-0 bg-background">
          <label className="text-xs text-muted-foreground block mb-1.5">User Message <span className="opacity-50">(A, B 공통)</span></label>
          <textarea
            value={userMessage} onChange={(e) => setUserMessage(e.target.value)}
            rows={3} spellCheck={false}
            placeholder="두 프롬프트에 공통으로 보낼 메시지를 입력하세요"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun(); }}
            className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
          />
          <p className="text-xs text-muted-foreground mt-1.5">⌘Enter로 실행</p>
        </div>
      </div>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">하네스 저장</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">이름</label>
              <input
                value={saveName} onChange={(e) => setSaveName(e.target.value)}
                placeholder="예: 친절한 CS vs 전문가 CS"
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">설명 (선택)</label>
              <input
                value={saveDesc} onChange={(e) => setSaveDesc(e.target.value)}
                placeholder="어떤 가설을 검증하는 하네스인지"
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button onClick={handleSave} disabled={!saveName.trim()} className="w-full">
              <Save size={13} className="mr-1.5" />저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">테스트 히스토리</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {runHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">아직 실행 기록이 없습니다</p>
            ) : (
              <div className="space-y-3 pr-4">
                {runHistory.map((r) => (
                  <div key={r.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString("ko-KR")}</span>
                      {r.winner && (
                        <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30 bg-yellow-500/10 gap-1 ml-auto">
                          <Trophy size={9} />{r.winner === "tie" ? "Draw" : `${r.winner} Win`}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground">{r.userMessage}</p>
                    {r.verdict && <p className="text-xs text-muted-foreground leading-relaxed">{r.verdict}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      {(["A", "B"] as const).map((side) => (
                        <div key={side} className="bg-secondary rounded-md p-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Response {side}</p>
                          <p className="text-xs text-foreground line-clamp-3">{side === "A" ? r.responseA : r.responseB}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
