"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, Search, Trash2, Globe, FolderOpen, User, MessageSquare, Folder, Link, Plus, Pencil, Save } from "lucide-react";
import type { MemoryFile } from "@/app/api/memory/route";
import { NoProjectSelected } from "@/components/NoProjectSelected";

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  user:      { label: "User",      color: "text-blue-400 border-blue-500/30 bg-blue-500/10",       icon: User },
  feedback:  { label: "Feedback",  color: "text-green-400 border-green-500/30 bg-green-500/10",    icon: MessageSquare },
  project:   { label: "Project",   color: "text-orange-400 border-orange-500/30 bg-orange-500/10", icon: Folder },
  reference: { label: "Reference", color: "text-purple-400 border-purple-500/30 bg-purple-500/10", icon: Link },
  unknown:   { label: "Unknown",   color: "text-muted-foreground border-border",                    icon: Brain },
};

const MEMORY_TYPES = ["user", "feedback", "project", "reference"] as const;

function buildRaw(name: string, description: string, type: string, body: string) {
  return `---\nname: ${name}\ndescription: ${description}\ntype: ${type}\n---\n\n${body}`;
}

const DEFAULT_BODY: Record<string, string> = {
  user:      "사용자의 역할, 목표, 선호도, 지식 수준 등을 기록합니다.",
  feedback:  "작업 방식에 대한 피드백을 기록합니다.\n\n**Why:** \n**How to apply:** ",
  project:   "프로젝트 관련 결정, 일정, 컨텍스트를 기록합니다.\n\n**Why:** \n**How to apply:** ",
  reference: "외부 시스템, 문서, 리소스의 위치를 기록합니다.",
};

function MemoryCard({
  memory,
  onEdit,
  onDelete,
}: {
  memory: MemoryFile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[memory.type] ?? TYPE_CONFIG.unknown;
  const Icon = cfg.icon;

  return (
    <Card className="border-border hover:border-border/80 transition-colors group">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                <Icon size={10} />
                {cfg.label}
              </Badge>
              <span className="text-xs font-medium text-foreground">{memory.name}</span>
              <span className="text-xs text-muted-foreground font-mono ml-auto">
                {memory.filename}
              </span>
            </div>
            {memory.description && (
              <p className="text-xs text-muted-foreground">{memory.description}</p>
            )}
            {memory.body && (
              <div>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs text-primary hover:underline"
                >
                  {expanded ? "접기" : "펼치기"}
                </button>
                {expanded && (
                  <pre className="mt-2 text-xs text-foreground bg-secondary rounded-md px-3 py-2 whitespace-pre-wrap font-mono leading-relaxed">
                    {memory.body}
                  </pre>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground" onClick={onEdit}>
              <Pencil size={12} />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MemoryList({
  memories,
  query,
  onEdit,
  onDelete,
}: {
  memories: MemoryFile[];
  query: string;
  onEdit: (m: MemoryFile) => void;
  onDelete: (m: MemoryFile) => void;
}) {
  const filtered = query
    ? memories.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.description.toLowerCase().includes(query.toLowerCase()) ||
          m.body.toLowerCase().includes(query.toLowerCase())
      )
    : memories;

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-1 py-6 text-center">
        {query ? "검색 결과가 없습니다" : "메모리 파일이 없습니다"}
      </p>
    );
  }

  const groups = Object.keys(TYPE_CONFIG).filter((t) => filtered.some((m) => m.type === t));

  return (
    <div className="space-y-6">
      {groups.map((type) => {
        const items = filtered.filter((m) => m.type === type);
        if (items.length === 0) return null;
        const cfg = TYPE_CONFIG[type];
        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
              <span className="text-xs text-muted-foreground">{items.length}개</span>
            </div>
            {items.map((m, i) => (
              <MemoryCard key={i} memory={m} onEdit={() => onEdit(m)} onDelete={() => onDelete(m)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function MemoryPage() {
  const { selectedProject } = useProject();
  const [globalMemory, setGlobalMemory] = useState<MemoryFile[]>([]);
  const [projectMemory, setProjectMemory] = useState<MemoryFile[]>([]);
  const [query, setQuery] = useState("");

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editScope, setEditScope] = useState<"global" | "project">("project");
  const [editFilename, setEditFilename] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<string>("project");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = !editFilename ||
    (!globalMemory.find(m => m.filename === editFilename) &&
     !projectMemory.find(m => m.filename === editFilename));

  const fetchMemory = useCallback(async () => {
    const params = selectedProject ? `?projectPath=${encodeURIComponent(selectedProject.path)}` : "";
    const res = await fetch(`/api/memory${params}`);
    const data = await res.json();
    setGlobalMemory(data.global ?? []);
    setProjectMemory(data.project ?? []);
  }, [selectedProject]);

  useEffect(() => { fetchMemory(); }, [fetchMemory]);

  function openNew(scope: "global" | "project") {
    setEditScope(scope);
    setEditFilename("");
    setEditName("");
    setEditDescription("");
    setEditType("project");
    setEditBody(DEFAULT_BODY.project);
    setDialogOpen(true);
  }

  function openEdit(memory: MemoryFile) {
    setEditScope(memory.scope);
    setEditFilename(memory.filename);
    setEditName(memory.name);
    setEditDescription(memory.description);
    setEditType(memory.type === "unknown" ? "project" : memory.type);
    setEditBody(memory.body);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editName.trim()) return;
    setSaving(true);
    const filename = isNew
      ? `${editName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "")}.md`
      : editFilename;
    const raw = buildRaw(editName.trim(), editDescription.trim(), editType, editBody.trim());

    await fetch("/api/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: selectedProject?.path, filename, scope: editScope, raw }),
    });
    setSaving(false);
    setDialogOpen(false);
    fetchMemory();
  }

  async function handleDelete(memory: MemoryFile) {
    await fetch("/api/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: selectedProject?.path, filename: memory.filename, scope: memory.scope }),
    });
    fetchMemory();
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Brain size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">Memory</span>
        <ProjectSwitcher />
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색..." className="h-7 text-xs pl-7 w-48" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="project" className="h-full flex flex-col">
          <div className="px-6 pt-4 shrink-0">
            <TabsList>
              <TabsTrigger value="project" className="gap-1.5 text-xs">
                <FolderOpen size={12} />프로젝트
                {projectMemory.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{projectMemory.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-1.5 text-xs">
                <Globe size={12} />글로벌
                {globalMemory.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{globalMemory.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          {(["project", "global"] as const).map((scope) => {
            const memories = scope === "project" ? projectMemory : globalMemory;
            const dirLabel = scope === "global"
              ? "~/.claude/memory/"
              : selectedProject ? `~/.claude/projects/${selectedProject.path.replace(/[/_]/g, "-")}/memory/` : ".claude/memory/";

            return (
              <TabsContent key={scope} value={scope} className="flex-1 overflow-hidden mt-0">
                <div className="flex items-center justify-between px-6 py-2.5 border-b border-border">
                  <p className="text-xs text-muted-foreground font-mono">{dirLabel}</p>
                  <Button size="sm" variant="outline" onClick={() => openNew(scope)} disabled={scope === "project" && !selectedProject}>
                    <Plus size={13} className="mr-1" />추가
                  </Button>
                </div>
                {scope === "project" && !selectedProject ? (
                  <NoProjectSelected />
                ) : (
                  <ScrollArea className="h-[calc(100%-44px)]">
                    <div className="p-6 space-y-4">
                      <MemoryList memories={memories} query={query} onEdit={openEdit} onDelete={handleDelete} />
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {isNew ? "메모리 추가" : `메모리 편집 — ${editFilename}`}
              <span className="ml-2 text-muted-foreground font-normal">({editScope === "global" ? "글로벌" : "프로젝트"})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* type selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">타입</label>
              <div className="flex gap-2 flex-wrap">
                {MEMORY_TYPES.map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={t}
                      onClick={() => { setEditType(t); setEditBody(DEFAULT_BODY[t]); }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        editType === t ? cfg.color : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon size={11} />{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">이름</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="memory name"
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">한 줄 설명</label>
                <input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="description"
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">내용</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={10}
                spellCheck={false}
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none leading-relaxed"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !editName.trim()} className="flex-1">
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
