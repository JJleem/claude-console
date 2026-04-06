"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Webhook, Plus, Trash2, Save, Globe, FolderOpen } from "lucide-react";

type HookEntry = { type: "command"; command: string };
type HookMatcher = { matcher?: string; hooks: HookEntry[] };
type HooksConfig = {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Stop?: HookMatcher[];
  Notification?: HookMatcher[];
};

const EVENT_TYPES = ["PreToolUse", "PostToolUse", "Stop", "Notification"] as const;
type EventType = (typeof EVENT_TYPES)[number];

const EVENT_COLORS: Record<EventType, string> = {
  PreToolUse:    "text-blue-400 border-blue-500/30 bg-blue-500/10",
  PostToolUse:   "text-green-400 border-green-500/30 bg-green-500/10",
  Stop:          "text-orange-400 border-orange-500/30 bg-orange-500/10",
  Notification:  "text-purple-400 border-purple-500/30 bg-purple-500/10",
};

function HookList({
  event,
  matchers,
  onDelete,
}: {
  event: EventType;
  matchers: HookMatcher[];
  onDelete: (idx: number) => void;
}) {
  if (matchers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-1 py-3">
        등록된 훅이 없습니다
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {matchers.map((m, i) => (
        <Card key={i} className="border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                {m.matcher && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">matcher:</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {m.matcher}
                    </Badge>
                  </div>
                )}
                {m.hooks.map((h, j) => (
                  <code key={j} className="block text-xs bg-secondary px-2 py-1 rounded font-mono text-foreground truncate">
                    {h.command}
                  </code>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(i)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function HooksPage() {
  const { selectedProject } = useProject();
  const [globalHooks, setGlobalHooks] = useState<HooksConfig>({});
  const [projectHooks, setProjectHooks] = useState<HooksConfig>({});
  const [saving, setSaving] = useState<"global" | "project" | null>(null);

  // Add hook dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addScope, setAddScope] = useState<"global" | "project">("global");
  const [newEvent, setNewEvent] = useState<EventType>("PostToolUse");
  const [newMatcher, setNewMatcher] = useState("");
  const [newCommand, setNewCommand] = useState("");

  const fetchHooks = useCallback(async () => {
    const params = selectedProject
      ? `?projectPath=${encodeURIComponent(selectedProject.path)}`
      : "";
    const res = await fetch(`/api/hooks${params}`);
    const data = await res.json();
    setGlobalHooks(data.global ?? {});
    setProjectHooks(data.project ?? {});
  }, [selectedProject]);

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  async function handleSave(scope: "global" | "project") {
    setSaving(scope);
    const hooks = scope === "global" ? globalHooks : projectHooks;
    await fetch("/api/hooks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, projectPath: selectedProject?.path, hooks }),
    });
    setSaving(null);
  }

  function handleDelete(scope: "global" | "project", event: EventType, idx: number) {
    const setter = scope === "global" ? setGlobalHooks : setProjectHooks;
    const hooks = scope === "global" ? globalHooks : projectHooks;
    const updated = { ...hooks };
    updated[event] = (updated[event] ?? []).filter((_, i) => i !== idx);
    if (updated[event]?.length === 0) delete updated[event];
    setter(updated);
  }

  function handleAdd() {
    if (!newCommand.trim()) return;
    const setter = addScope === "global" ? setGlobalHooks : setProjectHooks;
    const hooks = addScope === "global" ? globalHooks : projectHooks;
    const newMatcher_obj: HookMatcher = {
      ...(newMatcher.trim() && { matcher: newMatcher.trim() }),
      hooks: [{ type: "command", command: newCommand.trim() }],
    };
    setter({
      ...hooks,
      [newEvent]: [...(hooks[newEvent] ?? []), newMatcher_obj],
    });
    setNewCommand("");
    setNewMatcher("");
    setDialogOpen(false);
  }

  function openAddDialog(scope: "global" | "project") {
    setAddScope(scope);
    setDialogOpen(true);
  }

  const totalCount = (h: HooksConfig) =>
    EVENT_TYPES.reduce((s, e) => s + (h[e]?.length ?? 0), 0);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Webhook size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">Hooks</span>
        <ProjectSwitcher />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl space-y-6">
          <Tabs defaultValue="project">
            <TabsList>
              <TabsTrigger value="project" className="gap-1.5 text-xs">
                <FolderOpen size={12} />
                프로젝트
                {totalCount(projectHooks) > 0 && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">
                    {totalCount(projectHooks)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-1.5 text-xs">
                <Globe size={12} />
                글로벌
                {totalCount(globalHooks) > 0 && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">
                    {totalCount(globalHooks)}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {(["project", "global"] as const).map((scope) => {
              const hooks = scope === "global" ? globalHooks : projectHooks;
              const scopeLabel = scope === "global" ? "~/.claude/settings.json" : `.claude/settings.json`;

              return (
                <TabsContent key={scope} value={scope} className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-mono">{scopeLabel}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openAddDialog(scope)}>
                        <Plus size={13} className="mr-1" />
                        훅 추가
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(scope)}
                        disabled={saving === scope}
                      >
                        <Save size={13} className="mr-1" />
                        {saving === scope ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  </div>

                  {EVENT_TYPES.map((event) => (
                    <div key={event} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${EVENT_COLORS[event]}`} variant="outline">
                          {event}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {(hooks[event]?.length ?? 0)}개
                        </span>
                      </div>
                      <HookList
                        event={event}
                        matchers={hooks[event] ?? []}
                        onDelete={(idx) => handleDelete(scope, event, idx)}
                      />
                    </div>
                  ))}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </ScrollArea>

      {/* Add Hook Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              훅 추가 — {addScope === "global" ? "글로벌" : "프로젝트"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Event Type */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">이벤트</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((e) => (
                  <button
                    key={e}
                    onClick={() => setNewEvent(e)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      newEvent === e
                        ? EVENT_COLORS[e]
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Matcher */}
            {(newEvent === "PreToolUse" || newEvent === "PostToolUse") && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  matcher <span className="text-muted-foreground/60">(선택, 예: Bash, Edit, Write)</span>
                </label>
                <input
                  value={newMatcher}
                  onChange={(e) => setNewMatcher(e.target.value)}
                  placeholder="Bash"
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </div>
            )}

            {/* Command */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">command</label>
              <input
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                placeholder="curl -X POST http://localhost:3000/api/hook"
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleAdd} disabled={!newCommand.trim()} className="flex-1">
                추가
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
