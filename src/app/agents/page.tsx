"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Plus, Trash2, Pencil, Globe, FolderOpen, Save, Brain, Cpu, Wrench, ChevronDown, ChevronRight, Info, X } from "lucide-react";
import { NoProjectSelected } from "@/components/NoProjectSelected";
import type { AgentFile } from "@/app/api/agents/route";
import type { AgentMemoryGroup } from "@/app/api/agent-memory/route";

// ──────────────────────────── Agent colors ────────────────────────────
const AGENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: "bg-green-500/10",  text: "text-green-400",  dot: "bg-green-400"  },
  blue:   { bg: "bg-blue-500/10",   text: "text-blue-400",   dot: "bg-blue-400"   },
  yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-400" },
  red:    { bg: "bg-red-500/10",    text: "text-red-400",    dot: "bg-red-400"    },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  pink:   { bg: "bg-pink-500/10",   text: "text-pink-400",   dot: "bg-pink-400"   },
  cyan:   { bg: "bg-cyan-500/10",   text: "text-cyan-400",   dot: "bg-cyan-400"   },
};

const MODEL_SHORT: Record<string, string> = {
  "opus":   "Opus",
  "sonnet": "Sonnet",
  "haiku":  "Haiku",
};

function getColor(color: string) {
  return AGENT_COLORS[color] ?? { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" };
}

function modelLabel(model: string) {
  for (const [k, v] of Object.entries(MODEL_SHORT)) {
    if (model.toLowerCase().includes(k)) return v;
  }
  return model || "Default";
}

const DEFAULT_TEMPLATE = (name: string) =>
`---
name: ${name}
description: 이 에이전트가 언제 사용될지 설명하세요 (Claude가 자동 선택 기준으로 사용)
model: sonnet
color: blue
memory: project
tools: Read, Bash, Edit, Grep
---

# ${name}

## 역할
이 에이전트의 전문 영역과 역할을 작성하세요.

## 핵심 책임
- 책임 1
- 책임 2

## 동작 원칙
1. 원칙 1
2. 원칙 2
`;

// ──────────────────────────── Agent components ────────────────────────────
function AgentCard({ agent, onEdit, onDelete }: { agent: AgentFile; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const c = getColor(agent.color);
  return (
    <div className="group relative rounded-lg border border-border hover:border-border/80 transition-colors overflow-hidden">
      <div className="p-4 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className={`w-8 h-8 rounded-md ${c.bg} flex items-center justify-center shrink-0`}>
            <Bot size={15} className={c.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{agent.name}</span>
              <Badge variant="outline" className={`text-xs ${c.text} border-current/30 ${c.bg}`}>{agent.color}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Cpu size={10} />{modelLabel(agent.model)}
              </span>
              {agent.memory && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Brain size={10} />memory:{agent.memory}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={onEdit}>
              <Pencil size={12} />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
        {agent.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{agent.description}</p>
        )}
        <div className="flex items-center gap-1 flex-wrap">
          <Wrench size={10} className="text-muted-foreground/50 shrink-0" />
          {agent.tools.length === 0 ? (
            <span className="text-xs text-muted-foreground/50">모든 툴 사용 가능</span>
          ) : (
            <>
              {agent.tools.slice(0, 6).map((t) => (
                <Badge key={t} variant="outline" className="text-xs font-mono px-1.5 py-0">{t}</Badge>
              ))}
              {agent.tools.length > 6 && (
                <span className="text-xs text-muted-foreground">+{agent.tools.length - 6}</span>
              )}
            </>
          )}
        </div>
        {agent.body && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {expanded ? "접기" : "내용 보기"}
            </button>
            {expanded && (
              <pre className="mt-2 text-xs text-foreground bg-secondary rounded-md px-3 py-2 whitespace-pre-wrap font-mono leading-relaxed">
                {agent.body}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentList({ agents, scope, onAdd, onEdit, onDelete }: {
  agents: AgentFile[];
  scope: "global" | "project";
  onAdd: () => void;
  onEdit: (a: AgentFile) => void;
  onDelete: (a: AgentFile) => void;
}) {
  const scopeLabel = scope === "global" ? "~/.claude/agents/" : ".claude/agents/";
  return (
    <div className="h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border">
        <p className="text-xs text-muted-foreground font-mono">{scopeLabel}</p>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus size={13} className="mr-1" />에이전트 추가
        </Button>
      </div>
      <ScrollArea className="h-[calc(100%-41px)]">
        <div className="p-4">
          {agents.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Bot size={28} className="text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">등록된 에이전트가 없습니다</p>
              <p className="text-xs text-muted-foreground/50">
                에이전트는 Claude Code에서 <code className="font-mono">@agent-name</code>으로 호출하거나<br />
                Claude가 자동으로 description을 보고 선택합니다
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {agents.map((a) => (
                <AgentCard key={a.filename} agent={a} onEdit={() => onEdit(a)} onDelete={() => onDelete(a)} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ──────────────────────────── Agent-memory components ────────────────────────────
function AgentMemoryFileCard({ file, onDelete, onEdit }: {
  file: { filename: string; content: string };
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-border hover:border-border/80 transition-colors group">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-foreground">{file.filename}</span>
            </div>
            {file.content && (
              <div>
                <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  {expanded ? "접기" : "내용 보기"}
                </button>
                {expanded && (
                  <pre className="mt-2 text-xs text-foreground bg-secondary rounded-md px-3 py-2 whitespace-pre-wrap font-mono leading-relaxed">
                    {file.content}
                  </pre>
                )}
              </div>
            )}
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
      </CardContent>
    </Card>
  );
}

function AgentMemoryPanel({ groups, projectPath, onRefresh }: {
  groups: AgentMemoryGroup[];
  projectPath: string;
  onRefresh: () => void;
}) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [editDialog, setEditDialog] = useState<{ agentName: string; filename: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleAgent(name: string) {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function openEdit(agentName: string, filename: string, content: string) {
    setEditDialog({ agentName, filename, content });
    setEditContent(content);
  }

  async function handleSave() {
    if (!editDialog) return;
    setSaving(true);
    await fetch("/api/agent-memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, agentName: editDialog.agentName, filename: editDialog.filename, content: editContent }),
    });
    setSaving(false);
    setEditDialog(null);
    onRefresh();
  }

  async function handleDelete(agentName: string, filename: string) {
    await fetch("/api/agent-memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, agentName, filename }),
    });
    onRefresh();
  }

  return (
    <div className="h-full overflow-hidden">
      <div className="flex items-center px-5 py-2.5 border-b border-border">
        <p className="text-xs text-muted-foreground font-mono">.claude/agent-memory/</p>
      </div>
      <ScrollArea className="h-[calc(100%-41px)]">
        <div className="p-5 space-y-4">
          {groups.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Brain size={28} className="text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">에이전트 메모리가 없습니다</p>
              <p className="text-xs text-muted-foreground/50">.claude/agent-memory/ 폴더가 없거나 비어있습니다</p>
            </div>
          ) : (
            groups.map((group) => {
              const isOpen = expandedAgents.has(group.agentName);
              return (
                <div key={group.agentName} className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => toggleAgent(group.agentName)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                  >
                    {isOpen ? <ChevronDown size={13} className="text-muted-foreground shrink-0" /> : <ChevronRight size={13} className="text-muted-foreground shrink-0" />}
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot size={12} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{group.agentName}</span>
                    <Badge variant="secondary" className="text-xs h-4 px-1 ml-auto">
                      {group.files.length === 0 ? "비어있음" : `${group.files.length}개`}
                    </Badge>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-4 py-3 space-y-2 bg-secondary/20">
                      {group.files.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">파일이 없습니다</p>
                      ) : (
                        group.files.map((file) => (
                          <AgentMemoryFileCard
                            key={file.filename}
                            file={file}
                            onEdit={() => openEdit(group.agentName, file.filename, file.content)}
                            onDelete={() => handleDelete(group.agentName, file.filename)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editDialog?.agentName} / {editDialog?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={16}
              spellCheck={false}
              className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none leading-relaxed"
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save size={13} className="mr-1" />{saving ? "저장 중..." : "저장"}
              </Button>
              <Button variant="outline" onClick={() => setEditDialog(null)}>취소</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────────────────── Main page ────────────────────────────
export default function AgentsPage() {
  const { selectedProject } = useProject();

  // agents state
  const [globalAgents, setGlobalAgents] = useState<AgentFile[]>([]);
  const [projectAgents, setProjectAgents] = useState<AgentFile[]>([]);

  // agent dialog state
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentEditScope, setAgentEditScope] = useState<"global" | "project">("project");
  const [agentEditFilename, setAgentEditFilename] = useState("");
  const [agentEditRaw, setAgentEditRaw] = useState("");
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentNewName, setAgentNewName] = useState("");
  const isNewAgent = agentEditFilename === "" || (
    !globalAgents.find(a => a.filename === agentEditFilename && agentEditScope === "global") &&
    !projectAgents.find(a => a.filename === agentEditFilename && agentEditScope === "project")
  );

  // agent-memory state
  const [agentMemoryGroups, setAgentMemoryGroups] = useState<AgentMemoryGroup[]>([]);

  // info banner
  const [infoDismissed, setInfoDismissed] = useState(false);

  const fetchAgents = useCallback(async () => {
    const params = selectedProject ? `?projectPath=${encodeURIComponent(selectedProject.path)}` : "";
    const res = await fetch(`/api/agents${params}`);
    const data = await res.json();
    setGlobalAgents(data.global ?? []);
    setProjectAgents(data.project ?? []);
  }, [selectedProject]);

  const fetchAgentMemory = useCallback(async () => {
    if (!selectedProject) { setAgentMemoryGroups([]); return; }
    const res = await fetch(`/api/agent-memory?projectPath=${encodeURIComponent(selectedProject.path)}`);
    const data = await res.json();
    setAgentMemoryGroups(data.groups ?? []);
  }, [selectedProject]);

  useEffect(() => { fetchAgents(); fetchAgentMemory(); }, [fetchAgents, fetchAgentMemory]);

  // agent handlers
  function openNewAgent(scope: "global" | "project") {
    setAgentEditScope(scope);
    setAgentEditFilename("");
    setAgentNewName("");
    setAgentEditRaw(DEFAULT_TEMPLATE("my-agent"));
    setAgentDialogOpen(true);
  }

  function openEditAgent(agent: AgentFile) {
    setAgentEditScope(agent.scope);
    setAgentEditFilename(agent.filename);
    setAgentNewName("");
    setAgentEditRaw(agent.raw);
    setAgentDialogOpen(true);
  }

  async function handleAgentSave() {
    const filename = isNewAgent
      ? `${agentNewName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "my-agent"}.md`
      : agentEditFilename;
    setAgentSaving(true);
    await fetch("/api/agents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: agentEditScope, projectPath: selectedProject?.path, filename, raw: agentEditRaw }),
    });
    setAgentSaving(false);
    setAgentDialogOpen(false);
    fetchAgents();
  }

  async function handleAgentDelete(agent: AgentFile) {
    await fetch("/api/agents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: agent.scope, projectPath: selectedProject?.path, filename: agent.filename }),
    });
    fetchAgents();
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Bot size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">Subagents</span>
        <ProjectSwitcher />
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{globalAgents.length + projectAgents.length} agents</Badge>
        </div>
      </div>

      {!infoDismissed && (
        <div className="px-5 py-3 border-b border-border bg-amber-400/30 shrink-0">
          <div className="flex items-start gap-2.5">
            <Info size={13} className="text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary mb-1.5">
                에이전트 워크플로우는 단일 세션 대비 최대 10배 더 토큰을 사용해요
              </p>
              <p className="text-xs  mb-2">
                서브에이전트가 깨어날 때마다 자신만의 전체 컨텍스트를 처음부터 다시 로드하기 때문입니다.
              </p>
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-primary font-medium mb-1">현명하게 쓰는 방법</p>
                  <ul className="space-y-0.5">
                    <li className="text-xs  flex items-center gap-1.5"><span className="text-primary/50">•</span>단발성 작업에만 활용</li>
                    <li className="text-xs  flex items-center gap-1.5"><span className="text-primary/50">•</span>탐색 · 리서치 위임</li>
                    <li className="text-xs  flex items-center gap-1.5"><span className="text-primary/50">•</span>20줄 이상의 분석 작업</li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-primary font-medium mb-1">모델 선택 팁</p>
                  <ul className="space-y-0.5">
                    <li className="text-xs  flex items-center gap-1.5"><span className="text-primary/50">•</span>단순 작업은 Haiku로 위임</li>
                    <li className="text-xs  flex items-center gap-1.5"><span className="text-primary/50">•</span>Haiku = Sonnet/Opus보다 훨씬 저렴</li>
                    <li className="text-xs  flex items-center gap-1.5"><span className="text-primary/50">•</span>에이전트 팀은 정말 필요할 때만</li>
                  </ul>
                </div>
              </div>
            </div>
            <button onClick={() => setInfoDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="project" className="h-full flex flex-col">
          <div className="px-5 pt-3 shrink-0">
            <TabsList>
              <TabsTrigger value="project" className="gap-1.5 text-xs">
                <FolderOpen size={12} />프로젝트
                {projectAgents.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{projectAgents.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-1.5 text-xs">
                <Globe size={12} />글로벌
                {globalAgents.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{globalAgents.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="agent-memory" className="gap-1.5 text-xs">
                <FolderOpen size={12} />에이전트 메모리
                {agentMemoryGroups.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{agentMemoryGroups.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="project" className="flex-1 overflow-hidden mt-0">
            {!selectedProject ? <NoProjectSelected /> : (
              <AgentList agents={projectAgents} scope="project" onAdd={() => openNewAgent("project")} onEdit={openEditAgent} onDelete={handleAgentDelete} />
            )}
          </TabsContent>
          <TabsContent value="global" className="flex-1 overflow-hidden mt-0">
            <AgentList agents={globalAgents} scope="global" onAdd={() => openNewAgent("global")} onEdit={openEditAgent} onDelete={handleAgentDelete} />
          </TabsContent>
          <TabsContent value="agent-memory" className="flex-1 overflow-hidden mt-0">
            {!selectedProject ? <NoProjectSelected /> : (
              <AgentMemoryPanel
                groups={agentMemoryGroups}
                projectPath={selectedProject.path}
                onRefresh={fetchAgentMemory}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Agent dialog */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent className="max-w-3xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {isNewAgent ? "에이전트 추가" : `에이전트 편집 — ${agentEditFilename}`}
              <span className="ml-2 text-muted-foreground font-normal">({agentEditScope === "global" ? "글로벌" : "프로젝트"})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {isNewAgent && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">파일명 <span className="font-normal opacity-60">(영문 소문자·하이픈)</span></label>
                <div className="flex items-center gap-1.5">
                  <input
                    value={agentNewName}
                    onChange={(e) => {
                      const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                      setAgentNewName(v);
                      setAgentEditRaw(DEFAULT_TEMPLATE(v || "my-agent"));
                    }}
                    placeholder="my-agent"
                    className="flex-1 text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  <span className="text-xs text-muted-foreground">.md</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">agent.md</label>
              <textarea
                value={agentEditRaw}
                onChange={(e) => setAgentEditRaw(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none leading-relaxed"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAgentSave} disabled={agentSaving || (isNewAgent && !agentNewName.trim())} className="flex-1">
                <Save size={13} className="mr-1" />{agentSaving ? "저장 중..." : "저장"}
              </Button>
              <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>취소</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
