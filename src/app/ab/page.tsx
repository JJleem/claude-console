"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCompare, Loader2, Zap } from "lucide-react";

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
};

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-muted-foreground font-mono">
      {label} <span className="text-foreground">{value}</span>
    </span>
  );
}

function Panel({
  label,
  system,
  onSystem,
  result,
  loading,
  winner,
}: {
  label: string;
  system: string;
  onSystem: (v: string) => void;
  result: Result | null;
  loading: boolean;
  winner: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0 border-r last:border-r-0 border-border">
      {/* Panel header */}
      <div className={`px-4 py-2.5 border-b border-border flex items-center gap-2 ${winner ? "bg-green-500/5" : ""}`}>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${winner ? "bg-green-500/15 text-green-400" : "bg-secondary text-muted-foreground"}`}>
          {label}
        </span>
        {winner && <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 bg-green-500/10 gap-1"><Zap size={9} />Winner</Badge>}
        {result && (
          <div className="ml-auto flex items-center gap-3">
            <StatBadge label="in" value={result.inputTokens.toLocaleString()} />
            <StatBadge label="out" value={result.outputTokens.toLocaleString()} />
            <StatBadge label="ms" value={result.durationMs.toLocaleString()} />
          </div>
        )}
      </div>

      {/* System prompt editor */}
      <div className="px-4 pt-3 pb-2 border-b border-border shrink-0">
        <label className="text-xs text-muted-foreground block mb-1.5">System Prompt</label>
        <textarea
          value={system}
          onChange={(e) => onSystem(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder="System prompt을 입력하세요 (비워두면 system 없이 호출)"
          className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none leading-relaxed"
        />
      </div>

      {/* Response */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 size={14} className="animate-spin text-primary" />
              응답 대기 중...
            </div>
          ) : result ? (
            <pre className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans">
              {result.response}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground py-4">결과가 여기 표시됩니다</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ABPage() {
  const [systemA, setSystemA] = useState("");
  const [systemB, setSystemB] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [model, setModel] = useState(MODELS[1].id);
  const [loading, setLoading] = useState(false);
  const [resultA, setResultA] = useState<Result | null>(null);
  const [resultB, setResultB] = useState<Result | null>(null);

  const winnerA = !!(resultA && resultB && resultA.durationMs < resultB.durationMs);
  const winnerB = !!(resultA && resultB && resultB.durationMs < resultA.durationMs);

  async function handleRun() {
    if (!userMessage.trim()) return;
    setLoading(true);
    setResultA(null);
    setResultB(null);
    try {
      const res = await fetch("/api/ab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemA, systemB, userMessage, model }),
      });
      const data = await res.json();
      setResultA(data.a);
      setResultB(data.b);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <GitCompare size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground">A/B Test</span>
        <div className="flex gap-1 ml-4">
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
        <Button
          size="sm"
          onClick={handleRun}
          disabled={loading || !userMessage.trim()}
          className="ml-auto"
        >
          {loading ? (
            <><Loader2 size={13} className="mr-1.5 animate-spin" />실행 중...</>
          ) : (
            <><GitCompare size={13} className="mr-1.5" />둘 다 실행</>
          )}
        </Button>
      </div>

      {/* A/B panels */}
      <div className="flex flex-1 overflow-hidden">
        <Panel
          label="A"
          system={systemA}
          onSystem={setSystemA}
          result={resultA}
          loading={loading}
          winner={winnerA}
        />
        <Panel
          label="B"
          system={systemB}
          onSystem={setSystemB}
          result={resultB}
          loading={loading}
          winner={winnerB}
        />
      </div>

      {/* Shared user message */}
      <div className="border-t border-border px-4 py-3 shrink-0 bg-background">
        <label className="text-xs text-muted-foreground block mb-1.5">User Message <span className="opacity-50">(A, B 공통)</span></label>
        <div className="flex gap-2">
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="두 프롬프트에 공통으로 보낼 메시지를 입력하세요"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun(); }}
            className="flex-1 text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">⌘Enter로 실행</p>
      </div>
    </div>
  );
}
