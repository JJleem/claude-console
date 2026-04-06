"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Save, GitBranch, Clock, FileText, AlertCircle } from "lucide-react";
import type { PromptVersion } from "@/lib/db/schema";

// 대략적인 토큰 수 계산 (4자 = 1토큰)
function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export default function PromptsPage() {
  const { selectedProject } = useProject();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [showVersionSave, setShowVersionSave] = useState(false);

  const isDirty = content !== savedContent;
  const tokenCount = estimateTokens(content);

  const fetchContent = useCallback(async () => {
    if (!selectedProject) return;
    const res = await fetch(`/api/prompts?projectPath=${encodeURIComponent(selectedProject.path)}`);
    const data = await res.json();
    setContent(data.content);
    setSavedContent(data.content);
  }, [selectedProject]);

  const fetchVersions = useCallback(async () => {
    if (!selectedProject) return;
    const res = await fetch(`/api/prompts/versions?projectId=${selectedProject.id}`);
    const data = await res.json();
    setVersions(data);
  }, [selectedProject]);

  useEffect(() => {
    fetchContent();
    fetchVersions();
  }, [fetchContent, fetchVersions]);

  async function handleSave() {
    if (!selectedProject) return;
    setSaving(true);
    await fetch("/api/prompts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: selectedProject.path, content }),
    });
    setSavedContent(content);
    setSaving(false);
  }

  async function handleSaveVersion() {
    if (!selectedProject || !versionLabel.trim()) return;
    await fetch("/api/prompts/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: selectedProject.id,
        label: versionLabel,
        content,
        tokenCount,
      }),
    });
    setVersionLabel("");
    setShowVersionSave(false);
    await fetchVersions();
  }

  function handleLoadVersion(version: PromptVersion) {
    setContent(version.content);
  }

  if (!selectedProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <AlertCircle size={32} className="text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Settings에서 프로젝트를 먼저 선택해주세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <FileText size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">CLAUDE.md</span>
          <span className="text-xs text-muted-foreground font-mono truncate">
            {selectedProject.path}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs font-mono ${
                tokenCount > 8000
                  ? "border-red-500/50 text-red-400"
                  : tokenCount > 4000
                  ? "border-yellow-500/50 text-yellow-400"
                  : "border-border text-muted-foreground"
              }`}
            >
              ~{tokenCount.toLocaleString()} tokens
            </Badge>
            {isDirty && (
              <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                수정됨
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowVersionSave(!showVersionSave)}
            >
              <GitBranch size={13} className="mr-1" />
              버전 저장
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
              <Save size={13} className="mr-1" />
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>

        {/* Version save input */}
        {showVersionSave && (
          <div className="px-5 py-2 border-b border-border bg-accent/30 flex items-center gap-2">
            <input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="버전 이름 (예: v1, before-refactor)"
              className="flex-1 text-sm bg-background border border-border rounded-md px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => e.key === "Enter" && handleSaveVersion()}
            />
            <Button size="sm" onClick={handleSaveVersion} disabled={!versionLabel.trim()}>
              저장
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowVersionSave(false)}>
              취소
            </Button>
          </div>
        )}

        {/* Textarea Editor */}
        <div className="flex-1 overflow-hidden">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full resize-none bg-background text-foreground text-sm font-mono p-5 focus:outline-none leading-relaxed"
            placeholder={`# ${selectedProject.name}\n\nCLAUDE.md 파일이 없습니다. 내용을 작성하고 저장하면 파일이 생성됩니다.`}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Version History Panel */}
      <div className="w-64 shrink-0 border-l border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">버전 히스토리</span>
            {versions.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {versions.length}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {versions.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              버전이 없습니다.
              <br />
              "버전 저장" 버튼으로 스냅샷을 찍으세요.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => handleLoadVersion(v)}
                  className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">{v.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono">
                      ~{(v.tokenCount ?? 0).toLocaleString()}t
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.createdAt).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {v.content.slice(0, 50)}...
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />
        <div className="p-3">
          <Card className="border-border bg-card">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground">현재 파일</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xs font-mono text-foreground">
                {content.split("\n").length} lines
              </p>
              <p className="text-xs text-muted-foreground">
                {content.length.toLocaleString()} chars
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
