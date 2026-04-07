"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Plus, Trash2, Pencil, Globe, FolderOpen, Save, Brain, Cpu, Wrench } from "lucide-react";
import type { AgentFile } from "@/app/api/agents/route";

// color → tailwind classes
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

function AgentCard({
  agent,
  onEdit,
  onDelete,
}: {
  agent: AgentFile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = getColor(agent.color);

  return (
    <div className="group relative rounded-lg border border-border hover:border-border/80 transition-colors overflow-hidden">
      <div className="p-4 space-y-2.5">
        {/* header */}
        <div className="flex items-start gap-2.5">
          <div className={`w-8 h-8 rounded-md ${c.bg} flex items-center justify-center shrink-0`}>
            <Bot size={15} className={c.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{agent.name}</span>
              <Badge variant="outline" className={`text-xs ${c.text} border-current/30 ${c.bg}`}>
                {agent.color}
              </Badge>
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

        {/* description */}
        {agent.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{agent.description}</p>
        )}

        {/* tools */}
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
      </div>
    </div>
  );
}

function AgentList({
  agents,
  scope,
  onAdd,
  onEdit,
  onDelete,
}: {
  agents: AgentFile[];
  scope: "global" | "project";
  onAdd: () => void;
  onEdit: (a: AgentFile) => void;
  onDelete: (a: AgentFile) => void;
}) {
  const scopeLabel = scope === "global" ? "~/.claude/agents/" : ".claude/agents/";
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
        <p className="text-xs text-muted-foreground font-mono">{scopeLabel}</p>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus size={13} className="mr-1" />에이전트 추가
        </Button>
      </div>
      <ScrollArea className="flex-1">
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

export default function AgentsPage() {
  const { selectedProject } = useProject();
  const [globalAgents, setGlobalAgents] = useState<AgentFile[]>([]);
  const [projectAgents, setProjectAgents] = useState<AgentFile[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editScope, setEditScope] = useState<"global" | "project">("project");
  const [editFilename, setEditFilename] = useState("");
  const [editRaw, setEditRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = editFilename === "" || (
    !globalAgents.find(a => a.filename === editFilename && editScope === "global") &&
    !projectAgents.find(a => a.filename === editFilename && editScope === "project")
  );
  const [newName, setNewName] = useState("");

  const fetchAgents = useCallback(async () => {
    const params = selectedProject ? `?projectPath=${encodeURIComponent(selectedProject.path)}` : "";
    const res = await fetch(`/api/agents${params}`);
    const data = await res.json();
    setGlobalAgents(data.global ?? []);
    setProjectAgents(data.project ?? []);
  }, [selectedProject]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  function openNew(scope: "global" | "project") {
    setEditScope(scope);
    setEditFilename("");
    setNewName("");
    setEditRaw(DEFAULT_TEMPLATE("my-agent"));
    setDialogOpen(true);
  }

  function openEdit(agent: AgentFile) {
    setEditScope(agent.scope);
    setEditFilename(agent.filename);
    setNewName("");
    setEditRaw(agent.raw);
    setDialogOpen(true);
  }

  async function handleSave() {
    const filename = isNew
      ? `${newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "my-agent"}.md`
      : editFilename;
    setSaving(true);
    await fetch("/api/agents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: editScope, projectPath: selectedProject?.path, filename, raw: editRaw }),
    });
    setSaving(false);
    setDialogOpen(false);
    fetchAgents();
  }

  async function handleDelete(agent: AgentFile) {
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
        <span className="text-sm font-medium text-foreground shrink-0">Agents</span>
        <ProjectSwitcher />
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{globalAgents.length + projectAgents.length}</Badge>
        </div>
      </div>

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
            </TabsList>
          </div>
          <TabsContent value="project" className="flex-1 overflow-hidden mt-0">
            <AgentList agents={projectAgents} scope="project" onAdd={() => openNew("project")} onEdit={openEdit} onDelete={handleDelete} />
          </TabsContent>
          <TabsContent value="global" className="flex-1 overflow-hidden mt-0">
            <AgentList agents={globalAgents} scope="global" onAdd={() => openNew("global")} onEdit={openEdit} onDelete={handleDelete} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {isNew ? "에이전트 추가" : `에이전트 편집 — ${editFilename}`}
              <span className="ml-2 text-muted-foreground font-normal">({editScope === "global" ? "글로벌" : "프로젝트"})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {isNew && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">파일명 <span className="font-normal opacity-60">(영문 소문자·하이픈)</span></label>
                <div className="flex items-center gap-1.5">
                  <input
                    value={newName}
                    onChange={(e) => {
                      const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                      setNewName(v);
                      setEditRaw(DEFAULT_TEMPLATE(v || "my-agent"));
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
                value={editRaw}
                onChange={(e) => setEditRaw(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none leading-relaxed"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || (isNew && !newName.trim())} className="flex-1">
                <Save size={13} className="mr-1" />{saving ? "저장 중..." : "저장"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
