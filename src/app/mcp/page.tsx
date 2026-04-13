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
  WifiOff, Loader2, RefreshCw, AlertCircle, CheckCircle2, Store,
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

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

interface MarketplaceItem {
  id: string;
  name: string;
  serverKey: string;
  description: string;
  category: string;
  categoryColor: string;
  command: string;
  args: string[];
  tools: string[];
  envVars?: { name: string; description: string }[];
  usageNote: string;
  npmPackage: string;
}

const MARKETPLACE: MarketplaceItem[] = [
  {
    id: "filesystem",
    name: "Filesystem",
    serverKey: "filesystem",
    description:
      "로컬 파일 시스템에 대한 읽기·쓰기·탐색 권한을 Claude에게 부여합니다. 허용할 디렉토리를 지정하면 해당 범위 내에서만 파일 작업이 가능합니다.",
    category: "파일 시스템",
    categoryColor: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "~/Desktop"],
    tools: ["read_file", "write_file", "list_directory", "create_directory", "move_file", "search_files", "get_file_info"],
    usageNote:
      "args의 마지막 경로를 접근 허용할 디렉토리로 변경하세요. 여러 경로를 공백으로 구분하여 추가할 수 있습니다.",
    npmPackage: "@modelcontextprotocol/server-filesystem",
  },
  {
    id: "github",
    name: "GitHub",
    serverKey: "github",
    description:
      "GitHub 레포지토리의 이슈·PR·코드를 Claude가 직접 읽고 생성할 수 있게 합니다. 코드 리뷰, 이슈 관리, 레포 탐색을 자동화할 수 있습니다.",
    category: "개발 도구",
    categoryColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    tools: ["create_issue", "list_issues", "search_code", "get_file_contents", "create_pull_request", "list_commits", "fork_repository"],
    envVars: [
      {
        name: "GITHUB_PERSONAL_ACCESS_TOKEN",
        description: "GitHub Settings → Developer settings → Personal access tokens에서 발급",
      },
    ],
    usageNote:
      "~/.zshrc에 GITHUB_PERSONAL_ACCESS_TOKEN을 환경변수로 추가한 뒤 터미널을 재시작하세요.",
    npmPackage: "@modelcontextprotocol/server-github",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    serverKey: "brave-search",
    description:
      "Brave Search API를 통해 실시간 웹 검색을 Claude에게 제공합니다. 최신 뉴스, 문서, 공식 레퍼런스 검색에 활용할 수 있습니다.",
    category: "검색",
    categoryColor: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    tools: ["brave_web_search", "brave_local_search"],
    envVars: [
      {
        name: "BRAVE_API_KEY",
        description: "brave.com/search/api에서 무료 플랜(월 2,000회) API 키 발급",
      },
    ],
    usageNote:
      "~/.zshrc에 BRAVE_API_KEY를 환경변수로 추가하세요. 무료 플랜으로 월 2,000회 검색이 가능합니다.",
    npmPackage: "@modelcontextprotocol/server-brave-search",
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    serverKey: "puppeteer",
    description:
      "Chromium 브라우저를 제어해 웹 스크래핑, 스크린샷 촬영, 폼 자동화를 수행합니다. 별도의 API 키 없이 바로 사용 가능합니다.",
    category: "웹 자동화",
    categoryColor: "bg-green-500/15 text-green-400 border-green-500/30",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    tools: ["puppeteer_navigate", "puppeteer_screenshot", "puppeteer_click", "puppeteer_fill", "puppeteer_select", "puppeteer_evaluate"],
    usageNote:
      "추가 설정 없이 바로 사용 가능합니다. 첫 실행 시 Chromium이 자동으로 다운로드됩니다.",
    npmPackage: "@modelcontextprotocol/server-puppeteer",
  },
  {
    id: "slack",
    name: "Slack",
    serverKey: "slack",
    description:
      "Slack 워크스페이스의 채널·메시지를 Claude가 읽고 전송할 수 있게 합니다. 알림 자동화, 채널 요약, 메시지 검색에 활용할 수 있습니다.",
    category: "커뮤니케이션",
    categoryColor: "bg-pink-500/15 text-pink-400 border-pink-500/30",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    tools: ["list_channels", "post_message", "reply_to_thread", "get_channel_history", "list_users", "get_user_profile"],
    envVars: [
      { name: "SLACK_BOT_TOKEN", description: "api.slack.com/apps에서 Bot Token 발급 (xoxb-...)" },
      { name: "SLACK_TEAM_ID", description: "워크스페이스 URL에서 확인 (T로 시작하는 ID)" },
    ],
    usageNote:
      "Slack App을 생성하고 channels:read, chat:write 권한을 부여한 Bot Token이 필요합니다.",
    npmPackage: "@modelcontextprotocol/server-slack",
  },
];

const MAX_TOOLS_SHOWN = 4;

function MarketplaceTab({
  globalServers,
  projectServers,
  selectedProject,
  onRefresh,
}: {
  globalServers: McpServer[];
  projectServers: McpServer[];
  selectedProject: { path: string } | null;
  onRefresh: () => void;
}) {
  const [setup, setSetup] = useState<{ item: MarketplaceItem; scope: "global" | "project" } | null>(null);
  const [editName, setEditName] = useState("");
  const [editArgs, setEditArgs] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const installedKeys = new Set([
    ...globalServers.map((s) => s.name),
    ...projectServers.map((s) => s.name),
  ]);

  function openSetup(item: MarketplaceItem, scope: "global" | "project") {
    setEditName(item.serverKey);
    setEditArgs(item.args.join(" "));
    setSetup({ item, scope });
  }

  async function handleConfirmAdd() {
    if (!setup) return;
    setAdding(true);
    const args = editArgs.trim().split(/\s+/).filter(Boolean);
    await fetch("/api/mcp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: setup.scope,
        projectPath: setup.scope === "project" && selectedProject ? selectedProject.path : undefined,
        name: editName.trim() || setup.item.serverKey,
        server: { type: "stdio", command: setup.item.command, args },
      }),
    });
    setAdding(false);
    setSetup(null);
    onRefresh();
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
    {/* ── 셋업 다이얼로그 ── */}
    <Dialog open={!!setup} onOpenChange={(open) => !open && setSetup(null)}>
      <DialogContent className="max-w-2xl w-[90vw]">
        {setup && (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <span>{setup.item.name}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${setup.item.categoryColor}`}>{setup.item.category}</span>
                <span className="text-xs font-normal text-muted-foreground">→ {setup.scope === "global" ? "글로벌" : "프로젝트"} 추가</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              {/* 서버 이름 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">서버 이름</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </div>

              {/* Args */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Args
                  {setup.item.id === "filesystem" && (
                    <span className="ml-2 font-normal text-primary">← 마지막 경로를 허용할 디렉토리로 변경하세요</span>
                  )}
                </label>
                <input
                  value={editArgs}
                  onChange={(e) => setEditArgs(e.target.value)}
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <p className="text-[11px] text-muted-foreground">command: <span className="font-mono text-foreground/70">{setup.item.command}</span></p>
              </div>

              {/* 환경변수 안내 */}
              {setup.item.envVars && setup.item.envVars.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                    <AlertCircle size={12} className="text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      아래 환경변수를 <code className="font-mono bg-yellow-500/20 px-1 rounded">~/.zshrc</code> 또는 <code className="font-mono bg-yellow-500/20 px-1 rounded">~/.bashrc</code>에 추가한 뒤 터미널을 재시작하세요.
                      API 키는 여기에 직접 입력하지 마세요.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {setup.item.envVars.map((ev) => {
                      const exportLine = `export ${ev.name}="your_token_here"`;
                      return (
                        <div key={ev.name} className="rounded-md border border-border bg-secondary/50 p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-xs font-mono text-foreground font-medium">{ev.name}</code>
                            <button
                              onClick={() => copyToClipboard(exportLine, ev.name)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border hover:border-primary/40"
                            >
                              {copied === ev.name ? <CheckCircle2 size={10} className="text-green-400" /> : <Terminal size={10} />}
                              {copied === ev.name ? "복사됨" : "복사"}
                            </button>
                          </div>
                          <code className="block text-[11px] font-mono text-muted-foreground bg-background/60 px-2 py-1 rounded">
                            {exportLine}
                          </code>
                          <p className="text-[11px] text-muted-foreground/70">{ev.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button onClick={handleConfirmAdd} disabled={adding || !editName.trim()} className="flex-1">
                  <Plus size={13} className="mr-1" />{adding ? "추가 중..." : "추가"}
                </Button>
                <Button variant="outline" onClick={() => setSetup(null)}>취소</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    <ScrollArea className="h-full">
      <div className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MARKETPLACE.map((item) => {
          const alreadyAdded = installedKeys.has(item.serverKey);
          const visibleTools = item.tools.slice(0, MAX_TOOLS_SHOWN);
          const extraCount = item.tools.length - MAX_TOOLS_SHOWN;

          return (
            <Card key={item.id} className="border-border flex flex-col">
              <CardContent className="py-3 px-4 flex flex-col gap-2.5 flex-1">
                {/* Top row: category + installed badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${item.categoryColor}`}>
                    {item.category}
                  </span>
                  {alreadyAdded && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30">
                      이미 추가됨
                    </span>
                  )}
                </div>

                {/* Name + package */}
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{item.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground/70 mt-0.5">{item.npmPackage}</p>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                {/* Tools */}
                <div className="flex flex-wrap gap-1">
                  {visibleTools.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border"
                    >
                      {t}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                      +{extraCount} more
                    </span>
                  )}
                </div>

                {/* Usage note */}
                <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                    {item.usageNote}
                  </p>
                </div>

                {/* Env vars */}
                {item.envVars && item.envVars.length > 0 && (
                  <div className="space-y-1">
                    {item.envVars.map((ev) => (
                      <div key={ev.name} className="space-y-0.5">
                        <p className="text-[11px] font-mono text-foreground/80">{ev.name}</p>
                        <p className="text-[11px] text-muted-foreground/70">{ev.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Spacer to push buttons to bottom */}
                <div className="flex-1" />

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                    onClick={() => openSetup(item, "global")}
                  >
                    <Globe size={11} className="mr-1" />
                    글로벌 추가
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                    disabled={!selectedProject}
                    onClick={() => openSetup(item, "project")}
                  >
                    <FolderOpen size={11} className="mr-1" />
                    프로젝트 추가
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
    </>
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
              <TabsTrigger value="marketplace" className="gap-1.5 text-xs">
                <Store size={12} />마켓플레이스
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
          <TabsContent value="marketplace" className="flex-1 overflow-hidden mt-0">
            <MarketplaceTab
              globalServers={globalServers}
              projectServers={projectServers}
              selectedProject={selectedProject}
              onRefresh={fetchServers}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
