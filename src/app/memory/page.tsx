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
import { Brain, Search, Trash2, Globe, FolderOpen, User, MessageSquare, Folder, Link } from "lucide-react";
import type { MemoryFile } from "@/app/api/memory/route";

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  user:      { label: "User",      color: "text-blue-400 border-blue-500/30 bg-blue-500/10",     icon: User },
  feedback:  { label: "Feedback",  color: "text-green-400 border-green-500/30 bg-green-500/10",  icon: MessageSquare },
  project:   { label: "Project",   color: "text-orange-400 border-orange-500/30 bg-orange-500/10", icon: Folder },
  reference: { label: "Reference", color: "text-purple-400 border-purple-500/30 bg-purple-500/10", icon: Link },
  unknown:   { label: "Unknown",   color: "text-muted-foreground border-border",                   icon: Brain },
};

function MemoryCard({
  memory,
  onDelete,
}: {
  memory: MemoryFile;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[memory.type] ?? TYPE_CONFIG.unknown;
  const Icon = cfg.icon;

  return (
    <Card className="border-border hover:border-border/80 transition-colors">
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MemoryList({
  memories,
  query,
  onDelete,
  projectPath,
}: {
  memories: MemoryFile[];
  query: string;
  onDelete: (m: MemoryFile) => void;
  projectPath?: string;
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

  // Group by type
  const groups = Object.keys(TYPE_CONFIG).filter((t) =>
    filtered.some((m) => m.type === t)
  );

  return (
    <div className="space-y-6">
      {groups.map((type) => {
        const items = filtered.filter((m) => m.type === type);
        if (items.length === 0) return null;
        const cfg = TYPE_CONFIG[type];
        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                {cfg.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{items.length}개</span>
            </div>
            {items.map((m, i) => (
              <MemoryCard key={i} memory={m} onDelete={() => onDelete(m)} />
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

  const fetchMemory = useCallback(async () => {
    const params = selectedProject
      ? `?projectPath=${encodeURIComponent(selectedProject.path)}`
      : "";
    const res = await fetch(`/api/memory${params}`);
    const data = await res.json();
    setGlobalMemory(data.global ?? []);
    setProjectMemory(data.project ?? []);
  }, [selectedProject]);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  async function handleDelete(memory: MemoryFile) {
    await fetch("/api/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectPath: selectedProject?.path,
        filename: memory.filename,
        scope: memory.scope,
      }),
    });
    fetchMemory();
  }

  const totalGlobal = globalMemory.length;
  const totalProject = projectMemory.length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Brain size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">Memory</span>
        <ProjectSwitcher />
        <div className="ml-auto">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색..."
              className="h-7 text-xs pl-7 w-48"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl space-y-4">
          <Tabs defaultValue="project">
            <TabsList>
              <TabsTrigger value="project" className="gap-1.5 text-xs">
                <FolderOpen size={12} />
                프로젝트
                {totalProject > 0 && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">
                    {totalProject}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-1.5 text-xs">
                <Globe size={12} />
                글로벌
                {totalGlobal > 0 && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">
                    {totalGlobal}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="project" className="mt-4">
              {!selectedProject ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  프로젝트를 선택해주세요
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground font-mono mb-4">
                    ~/.claude/projects/{selectedProject.path.replace(/[/_]/g, "-")}/memory/
                  </p>
                  <MemoryList
                    memories={projectMemory}
                    query={query}
                    onDelete={handleDelete}
                    projectPath={selectedProject.path}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="global" className="mt-4">
              <p className="text-xs text-muted-foreground font-mono mb-4">
                ~/.claude/memory/
              </p>
              <MemoryList
                memories={globalMemory}
                query={query}
                onDelete={handleDelete}
              />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
