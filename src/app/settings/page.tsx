"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProject } from "@/lib/project-context";
import type { Project } from "@/lib/db/schema";
import {
  FolderOpen, FolderSearch, Plus, Trash2, CheckCircle2, Circle,
  KeyRound, AlertCircle, ChevronRight, Home, ArrowLeft, Download,
} from "lucide-react";

type SessionMeta = {
  sessionId: string;
  projectKey: string;
  filePath: string;
  messageCount: number;
  firstTs: string;
  lastTs: string;
};

function SessionImporter() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sessions");
    setSessions(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleImport(s: SessionMeta) {
    setImporting(s.sessionId);
    const res = await fetch("/api/sessions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: s.filePath, sessionId: s.sessionId }),
    });
    const data = await res.json();
    setImported((prev) => ({ ...prev, [s.sessionId]: data.imported }));
    setImporting(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Download size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">세션 임포트</h2>
        <p className="text-xs text-muted-foreground">— ~/.claude/projects 대화 기록 → Runs</p>
      </div>
      {loading ? (
        <Card><CardContent className="py-3 px-4 text-xs text-muted-foreground">로딩 중...</CardContent></Card>
      ) : sessions.length === 0 ? (
        <Card><CardContent className="py-3 px-4 text-xs text-muted-foreground">감지된 세션이 없습니다</CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {sessions.map((s) => (
            <div key={s.sessionId} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:border-primary/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground truncate">{s.sessionId.slice(0, 8)}…</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.projectKey.replace(/^-Users-[^-]+-/, "~/")} · {s.messageCount}개 메시지</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(s.lastTs).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {imported[s.sessionId] !== undefined ? (
                <Badge variant="secondary" className="text-xs shrink-0">{imported[s.sessionId]}개 임포트됨</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 text-xs"
                  disabled={importing === s.sessionId}
                  onClick={() => handleImport(s)}
                >
                  {importing === s.sessionId ? "임포트 중..." : "임포트"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ScannedProject = { key: string; detectedPath: string | null };
type FsEntry = { name: string; path: string; hasClaude: boolean };
type FsData = {
  current: string;
  parent: string | null;
  home: string;
  isWindows: boolean;
  breadcrumbs: { name: string; path: string }[];
  dirs: FsEntry[];
};

// ─────────────────────────── Folder Browser ───────────────────────────
function FolderBrowser({ onSelect }: { onSelect: (p: string) => void }) {
  const [data, setData] = useState<FsData | null>(null);
  const [loading, setLoading] = useState(false);

  const browse = useCallback(async (p?: string) => {
    setLoading(true);
    const url = p ? `/api/fs?path=${encodeURIComponent(p)}` : "/api/fs";
    const res = await fetch(url);
    const json = await res.json();
    if (!json.error) setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { browse(); }, [browse]);

  if (!data) return <div className="py-8 text-center text-xs text-muted-foreground">로딩 중...</div>;

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground bg-secondary rounded-md px-3 py-2">
        <button onClick={() => browse(data.home)} className="hover:text-foreground transition-colors shrink-0">
          <Home size={12} />
        </button>
        {data.breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={10} className="text-muted-foreground/50" />
            <button onClick={() => browse(crumb.path)} className="hover:text-foreground transition-colors font-mono">
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Directory list */}
      <ScrollArea className="h-64 border border-border rounded-md">
        <div className="p-1">
          {data.parent && (
            <button
              onClick={() => browse(data.parent!)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-accent/50 transition-colors text-left"
            >
              <ArrowLeft size={13} className="text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">..</span>
            </button>
          )}
          {loading && (
            <div className="px-3 py-4 text-xs text-center text-muted-foreground">로딩 중...</div>
          )}
          {!loading && data.dirs.length === 0 && (
            <div className="px-3 py-4 text-xs text-center text-muted-foreground">하위 폴더가 없습니다</div>
          )}
          {!loading && data.dirs.map((d) => (
            <button
              key={d.path}
              onClick={() => browse(d.path)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-accent/50 transition-colors text-left group"
            >
              <FolderOpen size={13} className={`shrink-0 ${d.hasClaude ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-xs text-foreground flex-1 truncate">{d.name}</span>
              {d.hasClaude && <Badge variant="secondary" className="text-xs h-4 px-1 shrink-0">Claude</Badge>}
              <ChevronRight size={11} className="text-muted-foreground/40 shrink-0" />
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Current path + select button */}
      {data.current !== "drives" && (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-muted-foreground bg-secondary px-3 py-2 rounded-md truncate">
            {data.current}
          </code>
          <Button size="sm" onClick={() => onSelect(data.current)}>
            이 폴더 선택
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Main Page ───────────────────────────
export default function SettingsPage() {
  const { selectedProject, setSelectedProject } = useProject();
  const [registered, setRegistered] = useState<Project[]>([]);
  const [unregistered, setUnregistered] = useState<ScannedProject[]>([]);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ set: boolean; masked?: string } | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [adding, setAdding] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserTarget, setBrowserTarget] = useState<"form" | string>("form"); // "form" or scanned key

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

  function openBrowser(target: "form" | string) {
    setBrowserTarget(target);
    setBrowserOpen(true);
  }

  function handleBrowserSelect(path: string) {
    setBrowserOpen(false);
    if (browserTarget === "form") {
      setProjectPath(path);
      if (!name) setName(path.split(/[\\/]/).pop() ?? "");
    } else {
      // Quick-add a scanned project with the selected path
      const autoName = path.split(/[\\/]/).pop() ?? browserTarget;
      fetch("/api/settings/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: autoName, projectPath: path }),
      }).then(() => fetchProjects());
    }
  }

  async function handleAdd() {
    if (!name.trim() || !projectPath.trim()) return;
    setAdding(true);
    const res = await fetch("/api/settings/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectPath }),
    });
    if (res.ok) {
      setName(""); setProjectPath(""); setShowAddForm(false);
      await fetchProjects();
    } else {
      const err = await res.json();
      alert(err.error);
    }
    setAdding(false);
  }

  async function handleQuickAdd(s: ScannedProject) {
    if (!s.detectedPath) return;
    const autoName = s.detectedPath.split(/[\\/]/).pop() ?? s.key;
    const res = await fetch("/api/settings/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: autoName, projectPath: s.detectedPath }),
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

      {/* API Key */}
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
              <pre className="ml-5 text-xs font-mono bg-secondary text-foreground px-3 py-2 rounded-md select-all">ANTHROPIC_API_KEY=sk-ant-...</pre>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Registered Projects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">등록된 프로젝트</h2>
          <Button size="sm" variant="outline" onClick={() => { setShowAddForm(!showAddForm); setName(""); setProjectPath(""); }}>
            <Plus size={13} className="mr-1" />직접 추가
          </Button>
        </div>

        {showAddForm && (
          <Card className="border-primary/30">
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">프로젝트 이름</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-project"
                  className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">절대 경로</label>
                <div className="flex gap-2">
                  <input
                    value={projectPath}
                    onChange={(e) => setProjectPath(e.target.value)}
                    placeholder="/Users/yourname/projects/my-project"
                    className="flex-1 text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={() => openBrowser("form")}>
                    <FolderSearch size={13} />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={adding || !name.trim() || !projectPath.trim()}>
                  {adding ? "추가 중..." : "추가"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>취소</Button>
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
                  className={`cursor-pointer transition-colors hover:border-primary/50 ${isSelected ? "border-primary bg-primary/5" : ""}`}
                  onClick={() => setSelectedProject(isSelected ? null : project)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {isSelected
                        ? <CheckCircle2 size={15} className="text-primary shrink-0" />
                        : <Circle size={15} className="text-muted-foreground shrink-0" />}
                      <FolderOpen size={15} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{project.path}</p>
                      </div>
                      {isSelected && <Badge variant="default" className="text-xs shrink-0">활성</Badge>}
                      <Button
                        size="sm" variant="ghost"
                        className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
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

      <SessionImporter />

      <Separator />

      {/* Auto-detected */}
      {unregistered.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderSearch size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">자동 감지된 프로젝트</h2>
            <Badge variant="secondary" className="text-xs">{unregistered.length}개</Badge>
          </div>
          <p className="text-xs text-muted-foreground">~/.claude/projects/ 에서 감지됨.</p>
          <div className="space-y-1.5">
            {unregistered.map((s) => (
              <div key={s.key} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:border-primary/40 hover:bg-accent/30 transition-colors">
                <FolderOpen size={13} className={`shrink-0 ${s.detectedPath ? "text-muted-foreground" : "text-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {s.detectedPath?.split(/[\\/]/).pop() ?? s.key}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {s.detectedPath ?? "경로를 자동으로 찾지 못했습니다"}
                  </p>
                </div>
                {s.detectedPath ? (
                  <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => handleQuickAdd(s)}>
                    <Plus size={11} className="mr-1" />등록
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => openBrowser(s.key)}>
                    <FolderSearch size={11} className="mr-1" />경로 찾기
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Folder Browser Dialog */}
      <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
        <DialogContent className="max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">폴더 선택</DialogTitle>
          </DialogHeader>
          <FolderBrowser onSelect={handleBrowserSelect} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
