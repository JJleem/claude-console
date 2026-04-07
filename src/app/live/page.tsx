"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radio, Trash2, Copy, Check, ChevronRight, ChevronDown } from "lucide-react";
import type { LiveEvent } from "@/lib/live-emitter";

// ── JSON Tree ────────────────────────────────────────────────────────────────
function JsonNode({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  if (data === null) return <span className="text-muted-foreground/70">null</span>;
  if (data === undefined) return <span className="text-muted-foreground/70">undefined</span>;
  if (typeof data === "boolean") return <span className="text-orange-400">{String(data)}</span>;
  if (typeof data === "number") return <span className="text-blue-400">{data}</span>;
  if (typeof data === "string") {
    return (
      <span className="text-green-400 break-all">
        &ldquo;{data.length > 300 ? data.slice(0, 300) + "…" : data}&rdquo;
      </span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-muted-foreground">[]</span>;
    return (
      <span>
        <button onClick={() => setOpen((v) => !v)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span className="text-muted-foreground/60">[{data.length}]</span>
        </button>
        {open && (
          <div className="pl-3 border-l border-border/40 ml-1 mt-0.5 space-y-0.5">
            {data.map((item, i) => (
              <div key={i} className="flex gap-1">
                <span className="text-muted-foreground/40 select-none shrink-0">{i}</span>
                <JsonNode data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;
    return (
      <span>
        <button onClick={() => setOpen((v) => !v)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span className="text-muted-foreground/60">{`{${entries.length}}`}</span>
        </button>
        {open && (
          <div className="pl-3 border-l border-border/40 ml-1 mt-0.5 space-y-0.5">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-1 flex-wrap">
                <span className="text-sky-300 shrink-0">{k}:</span>
                <JsonNode data={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}

function JsonBlock({ raw, label }: { raw?: string; label: string }) {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }

  return (
    <div className="mt-1.5">
      <span className="text-xs text-muted-foreground/50 uppercase tracking-wide">{label}</span>
      <div className="mt-0.5 bg-secondary rounded px-2 py-1.5 text-xs font-mono">
        {parsed !== null ? <JsonNode data={parsed} /> : (
          <span className="text-muted-foreground whitespace-pre-wrap break-all">{raw}</span>
        )}
      </div>
    </div>
  );
}

const EVENT_COLORS: Record<string, string> = {
  PreToolUse:   "text-blue-400 border-blue-500/30 bg-blue-500/10",
  PostToolUse:  "text-green-400 border-green-500/30 bg-green-500/10",
  Stop:         "text-orange-400 border-orange-500/30 bg-orange-500/10",
  Notification: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  ABTest:       "text-pink-400 border-pink-500/30 bg-pink-500/10",
  Eval:         "text-amber-400 border-amber-500/30 bg-amber-500/10",
};

const TOOL_COLORS: Record<string, string> = {
  Bash:    "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  Read:    "text-sky-400 border-sky-500/30 bg-sky-500/10",
  Edit:    "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  Write:   "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  Grep:    "text-violet-400 border-violet-500/30 bg-violet-500/10",
  Glob:    "text-violet-400 border-violet-500/30 bg-violet-500/10",
  Agent:   "text-pink-400 border-pink-500/30 bg-pink-500/10",
};

const HOOK_CMD = `python3 -c "
import json, os, urllib.request
d = json.dumps({
  'event': os.environ.get('CLAUDE_HOOK_EVENT', 'PostToolUse'),
  'tool': os.environ.get('CLAUDE_TOOL_NAME', ''),
  'input': os.environ.get('CLAUDE_TOOL_INPUT', '')[:500],
  'output': os.environ.get('CLAUDE_TOOL_OUTPUT', '')[:500],
  'sessionId': os.environ.get('CLAUDE_SESSION_ID', ''),
}).encode()
urllib.request.urlopen(
  urllib.request.Request('http://localhost:3000/api/live/event', d, {'Content-Type': 'application/json'}),
  timeout=3
)
" 2>/dev/null || true`;

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

function tryParseInput(input?: string): string {
  if (!input) return "";
  try {
    const obj = JSON.parse(input);
    // Bash command
    if (obj.command) return obj.command;
    // file path
    if (obj.file_path) return obj.file_path;
    if (obj.path) return obj.path;
    if (obj.pattern) return obj.pattern;
    return JSON.stringify(obj).slice(0, 120);
  } catch {
    return input.slice(0, 120);
  }
}

function EventRow({ e, onDelete }: { e: LiveEvent; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const eventColor = EVENT_COLORS[e.event] ?? "text-muted-foreground border-border";
  const toolColor = e.tool ? (TOOL_COLORS[e.tool] ?? "text-muted-foreground border-border bg-secondary") : "";
  const preview = tryParseInput(e.input);
  const canExpand = !!(e.input || e.output);

  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-accent/20 transition-colors">
      <span
        className="text-xs text-muted-foreground/60 font-mono w-20 shrink-0 pt-0.5 cursor-pointer"
        onClick={() => canExpand && setExpanded((v) => !v)}
      >
        {formatTime(e.timestamp)}
      </span>
      <div
        className="flex items-center gap-2 w-28 shrink-0 cursor-pointer"
        onClick={() => canExpand && setExpanded((v) => !v)}
      >
        <Badge variant="outline" className={`text-xs ${eventColor}`}>
          {e.event.replace("ToolUse", "")}
        </Badge>
      </div>
      {e.tool && (
        <Badge
          variant="outline"
          className={`text-xs shrink-0 cursor-pointer ${toolColor}`}
          onClick={() => canExpand && setExpanded((v) => !v)}
        >
          {e.tool}
        </Badge>
      )}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => canExpand && setExpanded((v) => !v)}
      >
        {!expanded ? (
          <code className="text-xs text-muted-foreground font-mono truncate block">
            {preview}
          </code>
        ) : (
          <div className="mt-0.5">
            <JsonBlock raw={e.input} label="input" />
            {e.output && <JsonBlock raw={e.output} label="output" />}
          </div>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive transition-opacity"
        onClick={(ev) => { ev.stopPropagation(); onDelete(); }}
      >
        <Trash2 size={11} />
      </Button>
    </div>
  );
}

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function deleteOne(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    await fetch("/api/live/event", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function deleteAll() {
    setEvents([]);
    await fetch("/api/live/event", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  useEffect(() => {
    const es = new EventSource("/api/live/stream");

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "history") {
        setEvents(data.events);
      } else if (data.type === "event") {
        setEvents((prev) => [...prev, data.event]);
      }
    };

    return () => es.close();
  }, []);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events, autoScroll]);

  function copyHook() {
    navigator.clipboard.writeText(HOOK_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filtered = filter === "all" ? events : events.filter((e) => e.event === filter);
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.event] = (counts[e.event] ?? 0) + 1;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Radio size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">Live Monitor</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{connected ? "연결됨" : "연결 중..."}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSetup((v) => !v)}>
            훅 설정
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={deleteAll}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Setup banner */}
      {showSetup && (
        <div className="px-5 py-3 border-b border-border bg-accent/20 space-y-2 shrink-0">
          <p className="text-xs text-muted-foreground">
            아래 커맨드를 Hooks 페이지에서 <strong>PostToolUse</strong>에 등록하면 실시간으로 이벤트를 받을 수 있습니다.
          </p>
          <div className="flex items-start gap-2">
            <pre className="flex-1 text-xs font-mono text-foreground bg-secondary rounded px-3 py-2 overflow-x-auto">
              {HOOK_CMD}
            </pre>
            <Button size="sm" variant="outline" onClick={copyHook} className="shrink-0">
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </Button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
        {["all", "PreToolUse", "PostToolUse", "Stop", "Notification", "ABTest", "Eval"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              filter === f
                ? f === "all"
                  ? "border-border bg-accent text-foreground"
                  : EVENT_COLORS[f]
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "전체" : f.replace("ToolUse", "")}
            {f !== "all" && counts[f] ? (
              <span className="ml-1 opacity-60">{counts[f]}</span>
            ) : f === "all" && events.length > 0 ? (
              <span className="ml-1 opacity-60">{events.length}</span>
            ) : null}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-primary"
          />
          자동 스크롤
        </label>
      </div>

      {/* Event feed */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <Radio size={28} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">이벤트 대기 중...</p>
            <p className="text-xs text-muted-foreground/50">
              Claude Code에서 툴을 실행하면 여기에 실시간으로 표시됩니다
            </p>
            {!showSetup && (
              <Button size="sm" variant="outline" onClick={() => setShowSetup(true)}>
                훅 설정 방법 보기
              </Button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((e) => (
              <EventRow key={e.id} e={e} onDelete={() => deleteOne(e.id)} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Stats bar */}
      {events.length > 0 && (
        <div className="px-5 py-2 border-t border-border flex items-center gap-4 shrink-0">
          {Object.entries(counts).map(([type, count]) => (
            <div key={type} className="flex items-center gap-1.5">
              <Badge variant="outline" className={`text-xs ${EVENT_COLORS[type] ?? ""}`}>
                {type.replace("ToolUse", "")}
              </Badge>
              <span className="text-xs text-muted-foreground">{count}</span>
            </div>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">총 {events.length}개</span>
        </div>
      )}
    </div>
  );
}
