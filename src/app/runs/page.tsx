"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, X } from "lucide-react";
import type { Run } from "@/lib/db/schema";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
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
          <h1 className="text-sm font-semibold text-foreground">Runs</h1>
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
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelected(run)}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                    selected?.id === run.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {run.model.replace("claude-", "")}
                    </Badge>
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
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(run.createdAt + "Z").toLocaleTimeString("ko-KR")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        </div>

        {/* Test Prompt */}
        <div className="border-t border-border p-4 space-y-2">
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

      {/* Detail Panel */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {selected ? (
            <div className="max-w-3xl space-y-4">
              {/* Meta badges */}
              <div className="flex flex-wrap gap-2">
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
              왼쪽에서 Run을 선택하면 상세 내용이 표시됩니다
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
