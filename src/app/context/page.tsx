"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, RefreshCw, ChevronDown, ChevronUp, Info } from "lucide-react";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { NoProjectSelected } from "@/components/NoProjectSelected";
import { useProject } from "@/lib/project-context";
import type { ContextPayload, ContextCategory, ContextFile } from "@/app/api/context/route";

const CATEGORY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  claude_md: { bg: "bg-violet-500",  text: "text-violet-400",  border: "border-violet-500/30"  },
  memory:    { bg: "bg-blue-500",    text: "text-blue-400",    border: "border-blue-500/30"    },
  skills:    { bg: "bg-amber-500",   text: "text-amber-400",   border: "border-amber-500/30"   },
  agents:    { bg: "bg-green-500",   text: "text-green-400",   border: "border-green-500/30"   },
  settings:  { bg: "bg-rose-500",    text: "text-rose-400",    border: "border-rose-500/30"    },
  hooks:     { bg: "bg-orange-500",  text: "text-orange-400",  border: "border-orange-500/30"  },
  mcp:       { bg: "bg-cyan-500",    text: "text-cyan-400",    border: "border-cyan-500/30"    },
};

function FileRow({ file, expanded, onToggle }: { file: ContextFile; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        <span className="text-xs font-mono text-foreground flex-1 truncate">{file.filename}</span>
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          ~{file.tokens.toLocaleString()} tokens
        </span>
        {expanded ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
      </div>
      {expanded && (
        <pre className="text-[11px] font-mono text-muted-foreground bg-secondary px-3 py-2.5 whitespace-pre-wrap leading-relaxed border-t border-border max-h-80 overflow-y-auto">
          {file.content}
        </pre>
      )}
    </div>
  );
}

function CategorySection({ category, expanded, onToggle }: {
  category: ContextCategory;
  expanded: Set<string>;
  onToggle: (p: string) => void;
}) {
  const style = CATEGORY_STYLE[category.id];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-xs ${style.text} ${style.border}`}>
          {category.label}
        </Badge>
        <span className="text-xs font-mono text-foreground">
          ~{category.tokens.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">tokens</span>
        <span className="text-xs text-muted-foreground/50">·</span>
        <span className="text-xs text-muted-foreground">{category.files.length}개 파일</span>
      </div>

      {category.files.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 pl-1">파일 없음</p>
      ) : (
        <div className="space-y-1.5 pl-1">
          {category.files.map((f) => (
            <FileRow
              key={f.path}
              file={f}
              expanded={expanded.has(f.path)}
              onToggle={() => onToggle(f.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContextPage() {
  const { selectedProject } = useProject();
  const [data, setData] = useState<ContextPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/context?projectPath=${encodeURIComponent(selectedProject.path)}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { refresh(); }, [refresh]);

  function toggleExpand(filePath: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(filePath) ? next.delete(filePath) : next.add(filePath);
      return next;
    });
  }

  const pct = data ? ((data.totalTokens / data.contextLimit) * 100) : 0;

  // Categories with at least one file (skip empties for the bar)
  const nonEmptyCats = data?.categories.filter(c => c.tokens > 0) ?? [];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Layers size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">Context</span>
        <ProjectSwitcher />
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading || !selectedProject}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {!selectedProject ? (
        <NoProjectSelected />
      ) : (
        <>
          {/* Token summary bar */}
          {data && (
            <div className="px-6 py-4 border-b border-border shrink-0 space-y-3">
              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {data.totalTokensFallback ? "≈" : ""}<span className="font-mono text-foreground">{data.totalTokens.toLocaleString()}</span>
                  <span className="ml-1">/ {data.contextLimit.toLocaleString()} tokens</span>
                </span>
                <span className="text-xs font-mono text-muted-foreground">{pct.toFixed(2)}% used</span>
              </div>

              {/* System prompt warning */}
              <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-md px-3 py-2">
                <Info size={12} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-400/80 leading-relaxed">
                  Claude Code 내부 system prompt (~30,000–50,000 tokens)는 포함되지 않습니다. 실제 컨텍스트 사용량은 이보다 높습니다.
                  {data.totalTokensFallback && " · API 키 미설정으로 tiktoken 추정값을 사용 중입니다."}
                </p>
              </div>

              {/* Stacked bar */}
              <div className="h-2.5 rounded-full bg-secondary overflow-hidden flex">
                {nonEmptyCats.map((cat) => (
                  <div
                    key={cat.id}
                    style={{ width: `${(cat.tokens / data.contextLimit) * 100}%` }}
                    className={`${CATEGORY_STYLE[cat.id].bg} h-full transition-all`}
                    title={`${cat.label}: ~${cat.tokens.toLocaleString()} tokens`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex gap-4 flex-wrap">
                {nonEmptyCats.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-sm ${CATEGORY_STYLE[cat.id].bg} shrink-0`} />
                    <span className="text-xs text-muted-foreground">{cat.label}</span>
                    <span className="text-xs font-mono text-foreground">~{cat.tokens.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Token count source note */}
              <p className="text-[10px] text-muted-foreground/40">
                {data.totalTokensFallback
                  ? "※ 전체 합계: tiktoken(cl100k_base) 추정값"
                  : "※ 전체 합계: Anthropic countTokens API (정확) · 파일별: tiktoken 추정값"}
              </p>
            </div>
          )}

          {/* Category list */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-7">
                {loading && !data && (
                  <p className="text-xs text-muted-foreground text-center py-12">로딩 중...</p>
                )}
                {data?.categories.map((cat) => (
                  <CategorySection
                    key={cat.id}
                    category={cat}
                    expanded={expanded}
                    onToggle={toggleExpand}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
