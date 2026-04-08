"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/lib/project-context";
import { ShieldOff, Plus, Save, RotateCcw } from "lucide-react";
import { NoProjectSelected } from "@/components/NoProjectSelected";

// Recommendations per project type
const RECOMMENDATIONS: Record<string, { label: string; patterns: string[] }> = {
  nextjs: {
    label: "Next.js",
    patterns: [".next/", "out/", ".vercel/", "node_modules/"],
  },
  react: {
    label: "React / Vite",
    patterns: ["dist/", "node_modules/", ".vite/"],
  },
  node: {
    label: "Node.js",
    patterns: ["node_modules/", "dist/", "build/", "coverage/", "*.log"],
  },
  python: {
    label: "Python",
    patterns: ["__pycache__/", ".venv/", "venv/", "*.pyc", "*.egg-info/", "dist/", "build/", ".pytest_cache/"],
  },
  rust: {
    label: "Rust",
    patterns: ["target/"],
  },
  go: {
    label: "Go",
    patterns: ["vendor/", "*.test"],
  },
  java: {
    label: "Java",
    patterns: ["target/", "build/", "*.class", ".gradle/"],
  },
};

const ALWAYS_RECOMMENDED = [
  ".git/",
  ".DS_Store",
  "*.log",
  ".env",
  ".env.local",
  ".env*.local",
];

export default function IgnorePage() {
  const { selectedProject } = useProject();
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [detected, setDetected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    if (!selectedProject) return;
    const res = await fetch(`/api/ignore?path=${encodeURIComponent(selectedProject.path)}`);
    const data = await res.json();
    setContent(data.content);
    setOriginal(data.content);
    setDetected(data.detected ?? []);
  }

  useEffect(() => { load(); }, [selectedProject]);

  async function handleSave() {
    if (!selectedProject) return;
    setSaving(true);
    await fetch("/api/ignore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: selectedProject.path, content }),
    });
    setOriginal(content);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addPattern(pattern: string) {
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.includes(pattern)) return;
    setContent((prev) => prev.trimEnd() + (prev.trim() ? "\n" : "") + pattern + "\n");
  }

  function addGroup(patterns: string[]) {
    patterns.forEach(addPattern);
  }

  const currentLines = new Set(content.split("\n").map((l) => l.trim()).filter(Boolean));
  const isDirty = content !== original;

  if (!selectedProject) return <NoProjectSelected />;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <ShieldOff size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground">.claudeignore</span>
        <span className="text-xs text-muted-foreground font-mono truncate">
          {selectedProject.path}/.claudeignore
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isDirty && (
            <Button size="sm" variant="ghost" onClick={() => setContent(original)} className="text-muted-foreground">
              <RotateCcw size={12} className="mr-1" />
              되돌리기
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
            <Save size={12} className="mr-1.5" />
            {saved ? "저장됨" : saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          <div className="px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">편집기</span>
            <span className="text-xs text-muted-foreground/50">· gitignore 문법과 동일</span>
            {isDirty && <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 bg-amber-500/10 ml-auto">수정됨</Badge>}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 resize-none bg-transparent text-sm font-mono text-foreground p-4 focus:outline-none placeholder:text-muted-foreground/40"
            placeholder={"# .claudeignore\n# Claude Code가 읽지 않을 파일/폴더를 지정하세요\n# gitignore 문법과 동일\n\nnode_modules/\n.next/\n"}
            spellCheck={false}
          />
        </div>

        {/* Recommendations panel */}
        <div className="w-72 shrink-0 flex flex-col overflow-y-auto">
          <div className="px-4 py-2 border-b border-border shrink-0">
            <span className="text-xs text-muted-foreground">추천 패턴</span>
          </div>

          <div className="p-3 space-y-4">
            {/* Always recommended */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">공통</span>
                <button
                  onClick={() => addGroup(ALWAYS_RECOMMENDED)}
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  <Plus size={10} /> 전체 추가
                </button>
              </div>
              <div className="space-y-1">
                {ALWAYS_RECOMMENDED.map((p) => (
                  <PatternRow key={p} pattern={p} added={currentLines.has(p)} onAdd={() => addPattern(p)} />
                ))}
              </div>
            </div>

            {/* Detected project types */}
            {detected.length > 0 && detected.map((type) => {
              const rec = RECOMMENDATIONS[type];
              if (!rec) return null;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">{rec.label}</span>
                      <Badge variant="outline" className="text-xs text-sky-400 border-sky-500/30 bg-sky-500/10">감지됨</Badge>
                    </div>
                    <button
                      onClick={() => addGroup(rec.patterns)}
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Plus size={10} /> 전체 추가
                    </button>
                  </div>
                  <div className="space-y-1">
                    {rec.patterns.map((p) => (
                      <PatternRow key={p} pattern={p} added={currentLines.has(p)} onAdd={() => addPattern(p)} />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Other types */}
            {Object.entries(RECOMMENDATIONS)
              .filter(([type]) => !detected.includes(type))
              .map(([type, rec]) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{rec.label}</span>
                    <button
                      onClick={() => addGroup(rec.patterns)}
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                    >
                      <Plus size={10} /> 전체 추가
                    </button>
                  </div>
                  <div className="space-y-1">
                    {rec.patterns.map((p) => (
                      <PatternRow key={p} pattern={p} added={currentLines.has(p)} onAdd={() => addPattern(p)} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PatternRow({ pattern, added, onAdd }: { pattern: string; added: boolean; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 group">
      <code className={`flex-1 text-xs font-mono px-2 py-0.5 rounded ${added ? "text-muted-foreground/40 line-through" : "text-foreground bg-secondary"}`}>
        {pattern}
      </code>
      {!added ? (
        <button
          onClick={onAdd}
          className="text-xs text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <Plus size={12} />
        </button>
      ) : (
        <span className="text-xs text-green-500/60 shrink-0">✓</span>
      )}
    </div>
  );
}
