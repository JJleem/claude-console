"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { NoProjectSelected } from "@/components/NoProjectSelected";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Trash2, Pencil, Globe, FolderOpen, Save, Terminal, Wifi,
  WifiOff, Loader2, RefreshCw, AlertCircle, CheckCircle2,
} from "lucide-react";
import type { McpServer } from "@/app/api/mcp/route";

type Status = "checking" | "online" | "offline" | "ready" | "missing" | "unknown";

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: React.ElementType }> = {
  checking: { label: "확인 중",   color: "text-muted-foreground", icon: Loader2 },
  online:   { label: "온라인",    color: "text-green-500",        icon: CheckCircle2 },
  offline:  { label: "오프라인",  color: "text-red-500",          icon: WifiOff },
  ready:    { label: "설치됨",    color: "text-green-500",        icon: CheckCircle2 },
  missing:  { label: "미설치",    color: "text-amber-500",        icon: AlertCircle },
  unknown:  { label: "알 수 없음", color: "text-muted-foreground", icon: AlertCircle },
};

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
      <Icon size={11} className={status === "checking" ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  );
}

function ServerCard({
  server, status, onEdit, onDelete, onCheckStatus,
}: {
  server: McpServer;
  status: Status;
  onEdit: () => void;
  onDelete: () => void;
  onCheckStatus: () => void;
}) {
  const isSSE = server.type === "sse";
  return (
    <Card className="border-border hover:border-border/80 transition-colors group">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            {isSSE ? <Wifi size={14} className="text-primary" /> : <Terminal size={14} className="text-primary" />}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{server.name}</span>
              <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                {isSSE ? "sse" : "stdio"}
              </Badge>
              <StatusBadge status={status} />
              <button
                onClick={onCheckStatus}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <RefreshCw size={10} />
              </button>
            </div>
            {isSSE ? (
              <p className="text-xs text-muted-foreground font-mono truncate">{server.url}</p>
            ) : (
              <p className="text-xs text-muted-foreground font-mono truncate">
                {server.command}{server.args?.length ? " " + server.args.join(" ") : ""}
              </p>
            )}
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
      </CardContent>
    </Card>
  );
}

const EMPTY_FORM = {
  name: "", type: "stdio" as "stdio" | "sse",
  command: "", args: "", url: "",
};

function McpList({
  servers, scope, projectPath, onRefresh,
}: {
  servers: McpServer[];
  scope: "global" | "project";
  projectPath?: string;
  onRefresh: () => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editName, setEditName] = useState<string | null>(null); // null = new
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Auto-check status on mount / when servers change
  useEffect(() => {
    servers.forEach((s) => checkStatus(s));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.map((s) => s.name).join(",")]);

  async function checkStatus(server: McpServer) {
    setStatuses((prev) => ({ ...prev, [server.name]: "checking" }));
    const res = await fetch("/api/mcp/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: server.type, command: server.command, url: server.url }),
    });
    const data = await res.json();
    setStatuses((prev) => ({ ...prev, [server.name]: data.status }));
  }

  function openNew() {
    setEditName(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(server: McpServer) {
    setEditName(server.name);
    setForm({
      name: server.name,
      type: server.type,
      command: server.command ?? "",
      args: server.args?.join(" ") ?? "",
      url: server.url ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    // If renaming, delete old first
    if (editName && editName !== form.name) {
      await fetch("/api/mcp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, projectPath, name: editName }),
      });
    }

    await fetch("/api/mcp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope, projectPath, name: form.name.trim(),
        server: {
          type: form.type,
          command: form.type === "stdio" ? form.command.trim() : undefined,
          args: form.type === "stdio" && form.args.trim() ? form.args.trim().split(/\s+/) : undefined,
          url: form.type === "sse" ? form.url.trim() : undefined,
        },
      }),
    });

    setSaving(false);
    setDialogOpen(false);
    onRefresh();
  }

  async function handleDelete(server: McpServer) {
    await fetch("/api/mcp", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, projectPath, name: server.name }),
    });
    onRefresh();
  }

  const scopeLabel = scope === "global" ? "~/.claude/settings.json" : ".claude/settings.json";

  return (
    <div className="h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border">
        <p className="text-xs text-muted-foreground font-mono">{scopeLabel} → mcpServers</p>
        <Button size="sm" variant="outline" onClick={openNew} disabled={scope === "project" && !projectPath}>
          <Plus size={13} className="mr-1" />추가
        </Button>
      </div>
      <ScrollArea className="h-[calc(100%-41px)]">
        <div className="p-4 space-y-2">
          {servers.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Wifi size={28} className="text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">등록된 MCP 서버가 없습니다</p>
              <p className="text-xs text-muted-foreground/50">
                MCP 서버를 추가하면 Claude Code에서 자동으로 사용됩니다
              </p>
            </div>
          ) : (
            servers.map((s) => (
              <ServerCard
                key={s.name}
                server={s}
                status={statuses[s.name] ?? "checking"}
                onEdit={() => openEdit(s)}
                onDelete={() => handleDelete(s)}
                onCheckStatus={() => checkStatus(s)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editName ? `MCP 서버 편집 — ${editName}` : "MCP 서버 추가"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">서버 이름</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="my-mcp-server"
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </div>

            {/* Type toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">타입</label>
              <div className="flex gap-2">
                {(["stdio", "sse"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                      form.type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "stdio" ? <Terminal size={11} /> : <Wifi size={11} />}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {form.type === "stdio" ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Command</label>
                  <input
                    value={form.command}
                    onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                    placeholder="npx"
                    className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Args <span className="font-normal opacity-60">(공백 구분)</span></label>
                  <input
                    value={form.args}
                    onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
                    placeholder="-y @modelcontextprotocol/server-filesystem"
                    className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </div>
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    API 키 등 민감한 값은 여기에 입력하지 마세요.{" "}
                    <code className="font-mono">~/.zshrc</code> 또는 <code className="font-mono">~/.bashrc</code>에
                    OS 환경변수로 설정하면 MCP 서버가 자동으로 상속받습니다.
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">URL</label>
                <input
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="http://localhost:3001/sse"
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1">
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

export default function McpPage() {
  const { selectedProject } = useProject();
  const [globalServers, setGlobalServers] = useState<McpServer[]>([]);
  const [projectServers, setProjectServers] = useState<McpServer[]>([]);

  const fetchServers = useCallback(async () => {
    const params = selectedProject ? `?projectPath=${encodeURIComponent(selectedProject.path)}` : "";
    const res = await fetch(`/api/mcp${params}`);
    const data = await res.json();
    setGlobalServers(data.global ?? []);
    setProjectServers(data.project ?? []);
  }, [selectedProject]);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Wifi size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">MCP Servers</span>
        <ProjectSwitcher />
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {globalServers.length + projectServers.length} servers
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="project" className="h-full flex flex-col">
          <div className="px-5 pt-3 shrink-0">
            <TabsList>
              <TabsTrigger value="project" className="gap-1.5 text-xs">
                <FolderOpen size={12} />프로젝트
                {projectServers.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{projectServers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="global" className="gap-1.5 text-xs">
                <Globe size={12} />글로벌
                {globalServers.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{globalServers.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="project" className="flex-1 overflow-hidden mt-0">
            {!selectedProject ? <NoProjectSelected /> : (
              <McpList
                servers={projectServers}
                scope="project"
                projectPath={selectedProject.path}
                onRefresh={fetchServers}
              />
            )}
          </TabsContent>
          <TabsContent value="global" className="flex-1 overflow-hidden mt-0">
            <McpList
              servers={globalServers}
              scope="global"
              onRefresh={fetchServers}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
