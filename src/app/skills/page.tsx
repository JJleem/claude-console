"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Zap, Plus, Trash2, Save, Globe, FolderOpen, Pencil, Terminal, Wrench } from "lucide-react";
import type { Skill } from "@/app/api/skills/route";
import { NoProjectSelected } from "@/components/NoProjectSelected";

const DEFAULT_SKILL_TEMPLATE = (name: string) =>
`---
name: ${name}
description: 스킬에 대한 한 줄 설명 (Claude가 자동 호출 여부 판단에 사용)
allowed-tools: Read Bash
argument-hint: <선택적 인자 힌트, 예: [file]>
---

# ${name}

## 이 스킬이 하는 일
여기에 스킬의 목적을 설명하세요.

## 실행 방법
1. 첫 번째 단계
2. 두 번째 단계
3. 결과 출력

## 예시
사용자가 \`/${name} src/app\` 처럼 호출하면:
- $ARGUMENTS 환경변수로 인자를 받을 수 있음
- Read, Bash 등 allowed-tools 에 명시된 툴만 사용 가능

## 참고
- allowed-tools: 이 스킬에서 허용할 툴 목록 (Read, Bash, Edit, Write, Grep 등)
- argument-hint: 슬래시 커맨드 자동완성 시 보여줄 힌트
- description: Claude가 언제 이 스킬을 쓸지 판단하는 기준
`;

const EXAMPLE_SKILLS = [
  {
    dirName: "summarize",
    description: "현재 프로젝트의 변경사항을 요약해줌",
    allowedTools: ["Read", "Bash"],
    argumentHint: "",
  },
  {
    dirName: "review-pr",
    description: "PR 코드를 리뷰하고 피드백 제공",
    allowedTools: ["Read", "Bash", "Grep"],
    argumentHint: "<PR번호>",
  },
  {
    dirName: "commit",
    description: "변경사항을 분석해 커밋 메시지 자동 생성 후 커밋",
    allowedTools: ["Bash"],
    argumentHint: "",
  },
];

function SkillCard({
  skill,
  onEdit,
  onDelete,
}: {
  skill: Skill;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border hover:border-border/80 bg-card transition-colors group">
      <div className="mt-0.5 w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Zap size={13} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">/{skill.dirName}</span>
          {skill.name && skill.name !== skill.dirName && (
            <span className="text-xs text-muted-foreground">{skill.name}</span>
          )}
        </div>
        {skill.description && (
          <p className="text-xs text-muted-foreground">{skill.description}</p>
        )}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {skill.allowedTools.map((t) => (
            <Badge key={t} variant="outline" className="text-xs gap-1 font-mono">
              <Terminal size={9} />
              {t}
            </Badge>
          ))}
          {skill.argumentHint && (
            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
              <Wrench size={9} />
              {skill.argumentHint}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={onEdit}>
          <Pencil size={12} />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  );
}

export default function SkillsPage() {
  const { selectedProject } = useProject();
  const [globalSkills, setGlobalSkills] = useState<Skill[]>([]);
  const [projectSkills, setProjectSkills] = useState<Skill[]>([]);

  // editor dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editScope, setEditScope] = useState<"global" | "project">("global");
  const [editDirName, setEditDirName] = useState("");
  const [editRaw, setEditRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = !globalSkills.find((s) => s.dirName === editDirName && editScope === "global") &&
                !projectSkills.find((s) => s.dirName === editDirName && editScope === "project");

  const fetchSkills = useCallback(async () => {
    const params = selectedProject
      ? `?projectPath=${encodeURIComponent(selectedProject.path)}`
      : "";
    const res = await fetch(`/api/skills${params}`);
    const data = await res.json();
    setGlobalSkills(data.global ?? []);
    setProjectSkills(data.project ?? []);
  }, [selectedProject]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  function openNew(scope: "global" | "project") {
    setEditScope(scope);
    setEditDirName("");
    setEditRaw(DEFAULT_SKILL_TEMPLATE("my-skill"));
    setDialogOpen(true);
  }

  function openEdit(skill: Skill) {
    setEditScope(skill.scope);
    setEditDirName(skill.dirName);
    setEditRaw(skill.raw);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editDirName.trim()) return;
    setSaving(true);
    await fetch("/api/skills", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: editScope,
        projectPath: selectedProject?.path,
        dirName: editDirName.trim(),
        raw: editRaw,
      }),
    });
    setSaving(false);
    setDialogOpen(false);
    fetchSkills();
  }

  async function handleDelete(skill: Skill) {
    await fetch("/api/skills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: skill.scope,
        projectPath: selectedProject?.path,
        dirName: skill.dirName,
      }),
    });
    fetchSkills();
  }

  function SkillList({ skills, scope }: { skills: Skill[]; scope: "global" | "project" }) {
    const scopeLabel = scope === "global" ? "~/.claude/skills/" : ".claude/skills/";
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-mono">{scopeLabel}</p>
          <Button size="sm" variant="outline" onClick={() => openNew(scope)}>
            <Plus size={13} className="mr-1" />
            스킬 추가
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {skills.length === 0 ? (
              <div className="space-y-4 py-4">
                <div className="text-center space-y-1.5 pb-2">
                  <Zap size={24} className="text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground">등록된 스킬이 없습니다</p>
                  <p className="text-xs text-muted-foreground/50">
                    스킬은 Claude Code에서 <code className="font-mono text-xs">/name</code> 으로 호출하는 커스텀 커맨드입니다
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground/60 font-medium px-1">예시 스킬</p>
                  {EXAMPLE_SKILLS.map((ex) => (
                    <div key={ex.dirName} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-dashed border-border bg-accent/10">
                      <div className="mt-0.5 w-7 h-7 rounded-md bg-primary/5 flex items-center justify-center shrink-0">
                        <Zap size={13} className="text-primary/50" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground/60">/{ex.dirName}</span>
                          {ex.argumentHint && (
                            <span className="text-xs text-muted-foreground/50 font-mono">{ex.argumentHint}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground/60">{ex.description}</p>
                        <div className="flex gap-1">
                          {ex.allowedTools.map((t) => (
                            <Badge key={t} variant="outline" className="text-xs font-mono opacity-50">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              skills.map((s) => (
                <SkillCard
                  key={s.dirName}
                  skill={s}
                  onEdit={() => openEdit(s)}
                  onDelete={() => handleDelete(s)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Zap size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">Skills</span>
        <ProjectSwitcher />
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="project" className="h-full flex flex-col">
          <div className="px-5 pt-3 shrink-0">
            <TabsList>
              <TabsTrigger value="project" className="gap-1.5 text-xs">
                <FolderOpen size={12} />
                프로젝트
                {projectSkills.length > 0 && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">{projectSkills.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-1.5 text-xs">
                <Globe size={12} />
                글로벌
                {globalSkills.length > 0 && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">{globalSkills.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="project" className="flex-1 overflow-hidden mt-0">
            {!selectedProject ? <NoProjectSelected /> : <SkillList skills={projectSkills} scope="project" />}
          </TabsContent>
          <TabsContent value="global" className="flex-1 overflow-hidden mt-0">
            <SkillList skills={globalSkills} scope="global" />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit / Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {isNew ? "스킬 추가" : `스킬 편집 — /${editDirName}`}
              <span className="ml-2 text-muted-foreground font-normal">
                ({editScope === "global" ? "글로벌" : "프로젝트"})
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {isNew && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  슬래시 커맨드 이름 <span className="font-normal opacity-60">(디렉토리명, 영문 소문자·하이픈)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">/</span>
                  <input
                    value={editDirName}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                      setEditDirName(val);
                      setEditRaw(DEFAULT_SKILL_TEMPLATE(val || "my-skill"));
                    }}
                    placeholder="my-skill"
                    className="flex-1 text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">SKILL.md</label>
              <textarea
                value={editRaw}
                onChange={(e) => setEditRaw(e.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none leading-relaxed"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving || !editDirName.trim()} className="flex-1">
                <Save size={13} className="mr-1" />
                {saving ? "저장 중..." : "저장"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
