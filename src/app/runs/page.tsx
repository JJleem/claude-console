"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, X, Download, BookMarked, Trash2, Plus } from "lucide-react";

type Template = { id: string; name: string; content: string; createdAt: string };

function TemplatePicker({ onSelect, currentSystem }: { onSelect: (content: string) => void; currentSystem: string }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [pendingContent, setPendingContent] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/templates");
    setTemplates(await res.json());
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function handleDelete(id: string) {
    await fetch("/api/templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  async function handleSave() {
    if (!newName.trim() || !pendingContent.trim()) return;
    setSaving(true);
    await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, content: pendingContent }) });
    setNewName(""); setShowSave(false); setSaving(false);
    load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <BookMarked size={11} />
        템플릿
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-72 bg-background border border-border rounded-md shadow-lg z-50">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">System Prompt 템플릿</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={11} /></button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border">
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">저장된 템플릿이 없습니다</p>
            ) : templates.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30 group">
                <button className="flex-1 text-left text-xs text-foreground truncate" onClick={() => { onSelect(t.content); setOpen(false); }}>
                  {t.name}
                </button>
                <button onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border">
            {showSave ? (
              <div className="flex gap-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="템플릿 이름"
                  className="flex-1 text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  autoFocus
                />
                <button onClick={handleSave} disabled={saving} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">저장</button>
                <button onClick={() => setShowSave(false)} className="text-xs px-2 py-1 rounded border border-border text-muted-foreground">취소</button>
              </div>
            ) : (
              <button
                onClick={() => { setPendingContent(currentSystem); setShowSave(true); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full"
              >
                <Plus size={10} /> 현재 system prompt 저장하기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import type { Run } from "@/lib/db/schema";

const SOURCE_LABELS: Record<string, string> = {
  "ab-test":        "A/B",
  "eval":           "Eval",
  "lab-rag":        "Lab · RAG",
  "lab-tools":      "Lab · Tools",
  "lab-structured": "Lab · Structured",
  "lab-chain":      "Lab · Chain",
  "direct":         "Direct",
};

const SOURCE_COLORS: Record<string, string> = {
  "ab-test":        "bg-orange-500/15 text-orange-600 border-orange-500/30",
  "eval":           "bg-green-500/15 text-green-600 border-green-500/30",
  "lab-rag":        "bg-blue-500/15 text-blue-600 border-blue-500/30",
  "lab-tools":      "bg-purple-500/15 text-purple-600 border-purple-500/30",
  "lab-structured": "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
  "lab-chain":      "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
  "direct":         "bg-muted text-muted-foreground border-border",
};

function parseSource(metadata: string | null | undefined): string {
  if (!metadata) return "direct";
  try {
    const m = JSON.parse(metadata);
    return m.source ?? "direct";
  } catch {
    return "direct";
  }
}

function SourceBadge({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? source;
  const color = SOURCE_COLORS[source] ?? SOURCE_COLORS["direct"];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {label}
    </span>
  );
}

function exportRuns(runs: Run[], format: "csv" | "json") {
  const source = (r: Run) => parseSource(r.metadata);
  let blob: Blob;
  let filename: string;

  if (format === "json") {
    const data = runs.map((r) => ({
      id: r.id, createdAt: r.createdAt, model: r.model, source: source(r),
      inputTokens: r.inputTokens, outputTokens: r.outputTokens,
      costUsd: r.costUsd, durationMs: r.durationMs,
      systemPrompt: r.systemPrompt ?? "", userPrompt: r.userPrompt, response: r.response,
    }));
    blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    filename = `runs-${Date.now()}.json`;
  } else {
    const escape = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const header = ["id","createdAt","model","source","inputTokens","outputTokens","costUsd","durationMs","userPrompt","systemPrompt","response"].join(",");
    const rows = runs.map((r) => [
      escape(r.id), escape(r.createdAt), escape(r.model), escape(source(r)),
      r.inputTokens, r.outputTokens, r.costUsd, r.durationMs,
      escape(r.userPrompt), escape(r.systemPrompt ?? ""), escape(r.response),
    ].join(","));
    blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    filename = `runs-${Date.now()}.csv`;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function CompareView({ runA, runB, onClose }: { runA: Run; runB: Run; onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center gap-3 shrink-0">
        <span className="text-xs font-medium text-foreground">Run 비교</span>
        <Badge variant="secondary" className="font-mono text-xs">{runA.model.replace("claude-", "")}</Badge>
        <span className="text-xs text-muted-foreground">vs</span>
        <Badge variant="secondary" className="font-mono text-xs">{runB.model.replace("claude-", "")}</Badge>
        <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex">
        {[runA, runB].map((run, idx) => (
          <div key={run.id} className={`flex-1 overflow-y-auto p-4 space-y-3 ${idx === 0 ? "border-r border-border" : ""}`}>
            {/* Meta */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Model", val: run.model.replace("claude-", "") },
                { label: "In", val: `${run.inputTokens}t` },
                { label: "Out", val: `${run.outputTokens}t` },
                { label: "Cost", val: `$${run.costUsd.toFixed(5)}` },
                { label: "ms", val: String(run.durationMs) },
              ].map((m) => (
                <Badge key={m.label} variant="outline" className="font-mono text-[10px]">{m.label}: {m.val}</Badge>
              ))}
            </div>
            {/* System */}
            {run.systemPrompt && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase mb-1">System</p>
                <pre className="text-xs font-mono text-muted-foreground bg-secondary px-3 py-2 rounded whitespace-pre-wrap">{run.systemPrompt}</pre>
              </div>
            )}
            {/* User */}
            <div>
              <p className="text-[10px] text-primary uppercase mb-1">User</p>
              <p className="text-xs text-foreground bg-primary/5 border border-primary/20 rounded px-3 py-2 whitespace-pre-wrap">{run.userPrompt}</p>
            </div>
            {/* Response */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Assistant</p>
              <p className="text-xs text-foreground bg-secondary rounded px-3 py-2 whitespace-pre-wrap">{run.response}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [compareA, setCompareA] = useState<Run | null>(null);
  const [compareB, setCompareB] = useState<Run | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  async function fetchRuns(q?: string) {
    const url = q ? `/api/runs?q=${encodeURIComponent(q)}` : "/api/runs";
    const res = await fetch(url);
    const data = await res.json();
    setRuns(data);
  }

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearching(true);
      fetchRuns(query.trim() || undefined).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function handleSubmit() {
    if (!prompt.trim()) return;
    setLoading(true);
    await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrompt: prompt, system: system || undefined }),
    });
    setPrompt("");
    await fetchRuns();
    setLoading(false);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Run List */}
      <div className="w-96 shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold text-foreground">Runs</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setCompareMode((v) => !v); setCompareA(null); setCompareB(null); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors border ${
                  compareMode ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                비교
              </button>
              {runs.length > 0 && (<>
                <button onClick={() => exportRuns(runs, "csv")} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border border-border">
                  <Download size={10} /> CSV
                </button>
                <button onClick={() => exportRuns(runs, "json")} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border border-border">
                  <Download size={10} /> JSON
                </button>
              </>)}
            </div>
          </div>
          {compareMode && (
            <p className="text-[10px] text-muted-foreground">
              {!compareA ? "첫 번째 Run을 선택하세요" : !compareB ? "두 번째 Run을 선택하세요" : "비교 중"}
            </p>
          )}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색 (FTS5)..."
              className="pl-7 pr-7 h-7 text-xs"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={11} />
              </button>
            )}
          </div>
          {searching && <p className="text-xs text-muted-foreground">검색 중...</p>}
        </div>

        <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {runs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              아직 기록이 없습니다
            </div>
          ) : (
            <div className="divide-y divide-border">
              {runs.map((run) => {
                const isA = compareA?.id === run.id;
                const isB = compareB?.id === run.id;
                return (
                <button
                  key={run.id}
                  onClick={() => {
                    if (!compareMode) { setSelected(run); return; }
                    if (!compareA) { setCompareA(run); }
                    else if (!compareB && run.id !== compareA.id) { setCompareB(run); }
                    else { setCompareA(run); setCompareB(null); }
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                    isA ? "bg-blue-500/10 border-l-2 border-blue-400" :
                    isB ? "bg-green-500/10 border-l-2 border-green-400" :
                    selected?.id === run.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {run.model.replace("claude-", "")}
                    </Badge>
                    <SourceBadge source={parseSource(run.metadata)} />
                    <span className="text-xs text-muted-foreground ml-auto">
                      ${run.costUsd.toFixed(5)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground truncate">
                    {run.userPrompt}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {run.inputTokens + run.outputTokens} tokens
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {run.durationMs}ms
                    </span>
                    {isA && <span className="text-[10px] text-blue-400 ml-auto font-medium">A</span>}
                    {isB && <span className="text-[10px] text-green-400 ml-auto font-medium">B</span>}
                    {!isA && !isB && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(run.createdAt + "Z").toLocaleTimeString("ko-KR")}
                      </span>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        </div>

        {/* Test Prompt */}
        <div className="border-t border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">System prompt</span>
            <TemplatePicker onSelect={(c) => setSystem(c)} currentSystem={system} />
          </div>
          <Textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            placeholder="System prompt (선택)"
            className="text-xs resize-none"
            rows={2}
          />
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="User prompt 입력..."
            className="text-sm resize-none"
            rows={3}
          />
          <Button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className="w-full"
            size="sm"
          >
            {loading ? "실행 중..." : "실행"}
          </Button>
        </div>
      </div>

      {/* Compare / Detail Panel */}
      {compareMode && compareA && compareB ? (
        <CompareView runA={compareA} runB={compareB} onClose={() => { setCompareMode(false); setCompareA(null); setCompareB(null); }} />
      ) : (
      <ScrollArea className="flex-1">
        <div className="p-6">
          {selected ? (
            <div className="max-w-3xl space-y-4">
              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source={parseSource(selected.metadata)} />
                {[
                  { label: "Model", value: selected.model },
                  { label: "Input", value: `${selected.inputTokens} tokens` },
                  { label: "Output", value: `${selected.outputTokens} tokens` },
                  { label: "Cost", value: `$${selected.costUsd.toFixed(6)}` },
                  { label: "Duration", value: `${selected.durationMs}ms` },
                ].map((m) => (
                  <Badge key={m.label} variant="outline" className="font-mono text-xs">
                    {m.label}: {m.value}
                  </Badge>
                ))}
              </div>

              {/* System Prompt */}
              {selected.systemPrompt && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">
                      SYSTEM
                    </CardTitle>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {selected.systemPrompt}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* User Prompt */}
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-primary">USER</CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="pt-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {selected.userPrompt}
                  </p>
                </CardContent>
              </Card>

              {/* Response */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground">
                    ASSISTANT
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="pt-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {selected.response}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {compareMode ? "A, B 두 Run을 선택하면 비교가 시작됩니다" : "왼쪽에서 Run을 선택하면 상세 내용이 표시됩니다"}
            </div>
          )}
        </div>
      </ScrollArea>
      )}
    </div>
  );
}
