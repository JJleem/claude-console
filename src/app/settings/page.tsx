"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProject } from "@/lib/project-context";
import type { Project } from "@/lib/db/schema";
import {
  FolderOpen,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  FolderSearch,
  KeyRound,
  AlertCircle,
} from "lucide-react";

type ScannedProject = {
  key: string;
  detectedPath: string | null;
};

export default function SettingsPage() {
  const { selectedProject, setSelectedProject } = useProject();
  const [registered, setRegistered] = useState<Project[]>([]);
  const [unregistered, setUnregistered] = useState<ScannedProject[]>([]);
  const [name, setName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ set: boolean; masked?: string } | null>(null);

  async function fetchProjects() {
    const res = await fetch("/api/settings/projects");
    const data = await res.json();
    setRegistered(data.registered ?? []);
    setUnregistered(data.unregistered ?? []);
  }

  useEffect(() => {
    fetchProjects();
    fetch("/api/settings/api-key").then(r => r.json()).then(setApiKeyStatus);
  }, []);

  async function handleAdd() {
    if (!name.trim() || !projectPath.trim()) return;
    setAdding(true);
    const res = await fetch("/api/settings/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectPath }),
    });
    if (res.ok) {
      setName("");
      setProjectPath("");
      setShowAddForm(false);
      await fetchProjects();
    } else {
      const err = await res.json();
      alert(err.error);
    }
    setAdding(false);
  }

  async function handleQuickAdd(scanned: ScannedProject) {
    if (!scanned.detectedPath) return;
    const autoName = scanned.detectedPath.split("/").pop() ?? scanned.key;
    const res = await fetch("/api/settings/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: autoName, projectPath: scanned.detectedPath }),
    });
    if (res.ok) await fetchProjects();
  }

  async function handleDelete(id: string) {
    await fetch("/api/settings/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selectedProject?.id === id) setSelectedProject(null);
    await fetchProjects();
  }

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          프로젝트를 등록하면 CLAUDE.md, Hooks, Memory를 관리할 수 있습니다
        </p>
      </div>

      {/* API Key status */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Anthropic API Key</h2>
        </div>
        {apiKeyStatus === null ? (
          <Card><CardContent className="py-3 px-4 text-xs text-muted-foreground">확인 중...</CardContent></Card>
        ) : apiKeyStatus.set ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                <span className="text-sm text-foreground">설정됨</span>
                <code className="ml-auto text-xs text-muted-foreground font-mono">{apiKeyStatus.masked}</code>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-4 px-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-500 shrink-0" />
                <span className="text-sm text-foreground">API 키가 설정되지 않았습니다</span>
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                프로젝트 루트의 <code className="font-mono bg-secondary px-1 py-0.5 rounded">.env</code> 파일에 아래 내용을 추가하고 서버를 재시작하세요.
              </p>
              <pre className="ml-5 text-xs font-mono bg-secondary text-foreground px-3 py-2 rounded-md select-all">
                ANTHROPIC_API_KEY=sk-ant-...
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Registered Projects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">등록된 프로젝트</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={13} className="mr-1" />
            직접 추가
          </Button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card className="border-primary/30">
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">프로젝트 이름</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="claude-hub"
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">절대 경로</label>
                <input
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/Users/molt/Desktop/project"
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={adding}>
                  {adding ? "추가 중..." : "추가"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {registered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              등록된 프로젝트가 없습니다
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {registered.map((project) => {
              const isSelected = selectedProject?.id === project.id;
              return (
                <Card
                  key={project.id}
                  className={`cursor-pointer transition-colors hover:border-primary/50 ${
                    isSelected ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedProject(isSelected ? null : project)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <CheckCircle2 size={15} className="text-primary shrink-0" />
                      ) : (
                        <Circle size={15} className="text-muted-foreground shrink-0" />
                      )}
                      <FolderOpen size={15} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {project.path}
                        </p>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="text-xs shrink-0">
                          활성
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Auto-detected (unregistered) */}
      {unregistered.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderSearch size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">
              자동 감지된 프로젝트
            </h2>
            <Badge variant="secondary" className="text-xs">
              {unregistered.length}개
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            ~/.claude/projects/ 에서 감지됨. 클릭해서 빠르게 등록하세요.
          </p>
          <ScrollArea className="h-64">
            <div className="space-y-1.5 pr-2">
              {unregistered.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center gap-3 px-3 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-accent/30 transition-colors group"
                >
                  <FolderOpen size={13} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {s.detectedPath?.split("/").pop() ?? s.key}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {s.detectedPath ?? s.key}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleQuickAdd(s)}
                  >
                    <Plus size={11} className="mr-1" />
                    등록
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
