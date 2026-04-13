"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Save, GitBranch, Clock, FileText, AtSign, ChevronRight, Info, X, GitCompare, Download } from "lucide-react";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { NoProjectSelected } from "@/components/NoProjectSelected";
import type { PromptVersion } from "@/lib/db/schema";

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

// ── Line-level diff (LCS-based) ───────────────────────────────────────────────

type DiffLine =
  | { type: "added";     text: string; newLine: number }
  | { type: "removed";   text: string; oldLine: number }
  | { type: "unchanged"; text: string; oldLine: number; newLine: number };

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length, n = newLines.length;

  // LCS DP (safe for typical CLAUDE.md sizes < 1000 lines)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const result: DiffLine[] = [];
  let i = 0, j = 0, ol = 1, nl = 1;
  while (i < m || j < n) {
    if (i < m && j < n && oldLines[i] === newLines[j]) {
      result.push({ type: "unchanged", text: oldLines[i], oldLine: ol++, newLine: nl++ });
      i++; j++;
    } else if (j < n && (i >= m || dp[i + 1][j] <= dp[i][j + 1])) {
      result.push({ type: "added", text: newLines[j], newLine: nl++ });
      j++;
    } else {
      result.push({ type: "removed", text: oldLines[i], oldLine: ol++ });
      i++;
    }
  }
  return result;
}

// content에서 @filename 패턴 추출
function extractAtRefs(text: string): string[] {
  const matches = text.match(/@[\w./\\-]+\.\w+/g) ?? [];
  return [...new Set(matches)];
}

export default function PromptsPage() {
  const { selectedProject } = useProject();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [showVersionSave, setShowVersionSave] = useState(false);
  const [tipsDismissed, setTipsDismissed] = useState(false);
  const [diffVersion, setDiffVersion] = useState<PromptVersion | null>(null);

  const isDirty = content !== savedContent;
  const tokenCount = estimateTokens(content);
  const atRefs = extractAtRefs(content);

  // @파일명 클릭 → 해당 파일 로드
  const [fileStack, setFileStack] = useState<{ label: string; content: string }[]>([]);

  async function handleAtRefClick(ref: string) {
    if (!selectedProject) return;
    const filename = ref.replace(/^@/, "");
    const filePath = `${selectedProject.path}/${filename}`;
    const res = await fetch(`/api/prompts/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) return;
    const data = await res.json();
    setFileStack((prev) => [...prev, { label: ref, content: data.content }]);
    setContent(data.content);
    setSavedContent(data.content);
  }

  function handleBackToMain() {
    setFileStack([]);
    fetchContent();
  }

  function handleBackToFile(idx: number) {
    const target = fileStack[idx];
    setFileStack((prev) => prev.slice(0, idx + 1));
    setContent(target.content);
    setSavedContent(target.content);
  }

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
      <div className="flex flex-col h-full">
        <div className="px-5 py-3 border-b border-border flex items-center gap-3">
          <FileText size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground shrink-0">CLAUDE.md</span>
          <ProjectSwitcher />
        </div>
        <NoProjectSelected />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <FileText size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground shrink-0">CLAUDE.md</span>
          <ProjectSwitcher />
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

        {/* CLAUDE.md 작성 팁 배너 */}
        {!tipsDismissed && (
          <div className="px-5 py-3 border-b border-border bg-amber-400/30 shrink-0">
            <div className="flex items-start gap-2.5">
              <Info size={13} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-8 gap-y-2">
                {/* 제목 */}
                <p className="col-span-2 text-xs font-medium text-primary">
                  CLAUDE.md는 세션 시작이 아닌 <span className="underline">매 메시지마다</span> 읽혀요 — 길수록 토큰 비용이 쌓입니다
                  <span className="ml-2 font-normal text-muted-foreground">
                    (장황한 ~5,000t → 간결한 ~700t)
                  </span>
                </p>
                {/* 컬럼 1 */}
                <div>
                  <p className="text-xs font-medium text-primary mb-1">넣어두면 좋은 것들</p>
                  <ul className="space-y-0.5">
                    {["아키텍처·기술 스택 결정 사항", "코딩 컨벤션 & 네이밍 규칙", "빌드 / 테스트 / 배포 명령어", "자주 하는 실수와 해결책", "Claude에게 바라는 행동 규칙"].map((t) => (
                      <li key={t} className="text-xs flex gap-1.5"><span className="text-primary/60 shrink-0">·</span>{t}</li>
                    ))}
                  </ul>
                </div>
                {/* 컬럼 2 */}
                <div>
                  <p className="text-xs font-medium text-primary mb-1">다이어트 팁 <span className="font-normal opacity-60">— 200줄부터 정리 타이밍</span></p>
                  <ul className="space-y-0.5">
                    {['"이 프로젝트는.." 서술형 문장 제거', "헤딩 · 리스트 · 테이블로 구조화", "규칙은 최소 단위로 축약", "코드 예시 과도 사용 주의"].map((t) => (
                      <li key={t} className="text-xs flex gap-1.5"><span className="text-primary/60 shrink-0">·</span>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <button onClick={() => setTipsDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5">
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Breadcrumb for @ref navigation */}
        {fileStack.length > 0 && (
          <div className="px-5 py-1.5 border-b border-border bg-accent/20 flex items-center gap-1 shrink-0 flex-wrap">
            <button onClick={handleBackToMain} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              CLAUDE.md
            </button>
            {fileStack.map((f, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight size={11} className="text-muted-foreground/50" />
                <button
                  onClick={() => i < fileStack.length - 1 && handleBackToFile(i)}
                  className={`text-xs transition-colors ${i === fileStack.length - 1 ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* @refs bar */}
        {atRefs.length > 0 && (
          <div className="px-5 py-1.5 border-b border-border flex items-center gap-2 shrink-0 flex-wrap">
            <AtSign size={11} className="text-muted-foreground/50 shrink-0" />
            {atRefs.map((ref) => (
              <button
                key={ref}
                onClick={() => handleAtRefClick(ref)}
                className="text-xs font-mono text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                {ref}
              </button>
            ))}
          </div>
        )}

        {/* Textarea Editor / Diff View */}
        <div className="flex-1 overflow-hidden">
          {diffVersion ? (
            <DiffView
              label={diffVersion.label}
              oldText={diffVersion.content}
              newText={content}
              onClose={() => setDiffVersion(null)}
              onLoad={() => { setContent(diffVersion.content); setDiffVersion(null); }}
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full resize-none bg-background text-foreground text-sm font-mono p-5 focus:outline-none leading-relaxed"
              placeholder={`# ${selectedProject.name}\n\nCLAUDE.md 파일이 없습니다. 내용을 작성하고 저장하면 파일이 생성됩니다.`}
              spellCheck={false}
            />
          )}
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
                <div
                  key={v.id}
                  className={`px-4 py-3 transition-colors ${diffVersion?.id === v.id ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-accent/30"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">{v.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono">
                      ~{(v.tokenCount ?? 0).toLocaleString()}t
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {new Date(v.createdAt + "Z").toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setDiffVersion(diffVersion?.id === v.id ? null : v)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                        diffVersion?.id === v.id
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      <GitCompare size={10} />
                      {diffVersion?.id === v.id ? "닫기" : "비교"}
                    </button>
                    <button
                      onClick={() => { setContent(v.content); setDiffVersion(null); }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-border text-muted-foreground hover:border-border hover:text-foreground transition-colors"
                    >
                      <Download size={10} />
                      불러오기
                    </button>
                  </div>
                </div>
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

// ── DiffView Component ────────────────────────────────────────────────────────

function DiffView({
  label,
  oldText,
  newText,
  onClose,
  onLoad,
}: {
  label: string;
  oldText: string;
  newText: string;
  onClose: () => void;
  onLoad: () => void;
}) {
  const lines = computeDiff(oldText, newText);
  const added   = lines.filter((l) => l.type === "added").length;
  const removed = lines.filter((l) => l.type === "removed").length;

  return (
    <div className="flex flex-col h-full">
      {/* Diff header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-secondary/30 shrink-0">
        <GitCompare size={13} className="text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">↔ 현재</span>
        <div className="flex items-center gap-2 text-xs font-mono ml-2">
          {added   > 0 && <span className="text-green-400">+{added}</span>}
          {removed > 0 && <span className="text-red-400">-{removed}</span>}
          {added === 0 && removed === 0 && <span className="text-muted-foreground">변경 없음</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onLoad}>
            <Download size={12} className="mr-1" />
            이 버전으로 불러오기
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Diff body */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              const isAdded   = line.type === "added";
              const isRemoved = line.type === "removed";
              const oldNum = "oldLine" in line ? line.oldLine : null;
              const newNum = "newLine" in line ? line.newLine : null;

              return (
                <tr
                  key={i}
                  className={
                    isAdded   ? "bg-green-500/10 hover:bg-green-500/15" :
                    isRemoved ? "bg-red-500/10 hover:bg-red-500/15" :
                    "hover:bg-accent/20"
                  }
                >
                  {/* 구 라인 번호 */}
                  <td className="w-10 text-right pr-2 pl-3 text-muted-foreground/40 select-none border-r border-border/40 py-px">
                    {oldNum ?? ""}
                  </td>
                  {/* 신 라인 번호 */}
                  <td className="w-10 text-right pr-2 pl-2 text-muted-foreground/40 select-none border-r border-border/40 py-px">
                    {newNum ?? ""}
                  </td>
                  {/* 기호 */}
                  <td className={`w-5 text-center select-none py-px font-bold ${
                    isAdded ? "text-green-400" : isRemoved ? "text-red-400" : "text-muted-foreground/20"
                  }`}>
                    {isAdded ? "+" : isRemoved ? "−" : " "}
                  </td>
                  {/* 내용 */}
                  <td className={`pl-1 pr-4 py-px whitespace-pre-wrap break-all ${
                    isAdded ? "text-green-300" : isRemoved ? "text-red-300" : "text-foreground/80"
                  }`}>
                    {line.text || " "}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
