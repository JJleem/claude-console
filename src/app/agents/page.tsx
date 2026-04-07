"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bot, Trash2, ChevronRight, ChevronDown,
  Clock, DollarSign, Layers, GitBranch,
} from "lucide-react";
import type { Agent, Run } from "@/lib/db/schema";

type AgentWithRuns = Agent & { runs: Run[] };
type RunNode = Run & { children: RunNode[] };

function buildTree(runs: Run[]): RunNode[] {
  const map: Record<string, RunNode> = {};
  for (const r of runs) map[r.id] = { ...r, children: [] };

  const roots: RunNode[] = [];
  for (const r of runs) {
    if (r.parentRunId && map[r.parentRunId]) {
      map[r.parentRunId].children.push(map[r.id]);
    } else {
      roots.push(map[r.id]);
    }
  }
  return roots;
}

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd: number) {
  if (usd < 0.001) return `$${(usd * 1000).toFixed(3)}m`;
  return `$${usd.toFixed(4)}`;
}

function RunNode({ node, depth = 0 }: { node: RunNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const prompt = node.userPrompt.slice(0, 80);

  return (
    <div>
      <div
        className={`flex items-start gap-2 py-2 px-3 rounded-md hover:bg-accent/30 transition-colors cursor-pointer group ${depth > 0 ? "ml-5 border-l border-border pl-4" : ""}`}
        style={{ marginLeft: depth > 0 ? `${depth * 16}px` : 0 }}
        onClick={() => hasChildren && setExpanded((v) => !v)}
      >
        <div className="shrink-0 mt-0.5 w-4">
          {hasChildren ? (
            expanded ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />
          ) : (
            <div className="w-3 h-3 rounded-full border border-border mt-0.5" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-xs text-foreground truncate">{prompt}{node.userPrompt.length > 80 ? "…" : ""}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">{node.model.split("-").slice(-2).join("-")}</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />{formatMs(node.durationMs)}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign size={10} />{formatCost(node.costUsd)}
            </span>
            <span>{node.inputTokens + node.outputTokens} tok</span>
            {hasChildren && (
              <span className="flex items-center gap-1 text-primary">
                <GitBranch size={10} />{node.children.length}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground/50 shrink-0 font-mono">
          {new Date(node.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <RunNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentDetail({ agent }: { agent: AgentWithRuns }) {
  const tree = buildTree(agent.runs);
  const totalCost = agent.runs.reduce((s, r) => s + r.costUsd, 0);
  const totalTokens = agent.runs.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
  const totalDuration = agent.runs.reduce((s, r) => s + r.durationMs, 0);
  const maxDepth = (nodes: RunNode[], d = 0): number =>
    nodes.length === 0 ? d : Math.max(...nodes.map((n) => maxDepth(n.children, d + 1)));
  const depth = maxDepth(tree);

  return (
    <div className="flex flex-col h-full">
      {/* agent header */}
      <div className="px-5 py-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-primary" />
          <span className="text-sm font-medium text-foreground">{agent.name}</span>
          <Badge
            variant="outline"
            className={`text-xs ml-auto ${
              agent.status === "running"
                ? "text-green-400 border-green-500/30 bg-green-500/10"
                : "text-muted-foreground border-border"
            }`}
          >
            {agent.status}
          </Badge>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Layers, label: "Runs", value: agent.runs.length },
            { icon: DollarSign, label: "비용", value: formatCost(totalCost) },
            { icon: Clock, label: "총 시간", value: formatMs(totalDuration) },
            { icon: GitBranch, label: "깊이", value: depth },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-accent/30 rounded-lg px-3 py-2 space-y-0.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Icon size={10} />
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          총 <span className="text-foreground font-mono">{totalTokens.toLocaleString()}</span> 토큰
          · 생성 {new Date(agent.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* run tree */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground font-medium">실행 트리</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-0.5">
          {tree.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">실행 기록이 없습니다</p>
          ) : (
            tree.map((node) => <RunNode key={node.id} node={node} depth={0} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentWithRuns[]>([]);
  const [selected, setSelected] = useState<AgentWithRuns | null>(null);

  const fetchAgents = useCallback(async () => {
    const res = await fetch("/api/agents");
    const data = await res.json();
    setAgents(data);
    if (data.length > 0 && !selected) setSelected(data[0]);
  }, [selected]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  async function handleDelete(agent: AgentWithRuns) {
    await fetch("/api/agents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: agent.id }),
    });
    setSelected(null);
    fetchAgents();
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <Bot size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground">Agents</span>
        <Badge variant="secondary" className="text-xs">{agents.length}</Badge>
      </div>

      {agents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <Bot size={32} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">등록된 에이전트가 없습니다</p>
          <p className="text-xs text-muted-foreground/60 max-w-sm">
            <code className="font-mono">loggedClaude()</code>에 <code className="font-mono">agentId</code>를 전달하면
            에이전트별 실행 흐름을 여기서 트리 형태로 확인할 수 있습니다
          </p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: agent list */}
          <div className="w-56 shrink-0 border-r border-border flex flex-col">
            <ScrollArea className="flex-1">
              <div className="py-2">
                {agents.map((agent) => {
                  const isActive = selected?.id === agent.id;
                  const cost = agent.runs.reduce((s, r) => s + r.costUsd, 0);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelected(agent)}
                      className={`w-full text-left px-4 py-3 transition-colors group flex items-start gap-2 ${
                        isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            agent.status === "running" ? "bg-green-400 animate-pulse" : "bg-muted-foreground/40"
                          }`} />
                          <span className="text-xs font-medium truncate">{agent.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{agent.runs.length} runs</span>
                          <span>{formatCost(cost)}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0 hover:text-destructive transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleDelete(agent); }}
                      >
                        <Trash2 size={11} />
                      </Button>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            <Separator />
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground">전체</p>
              <p className="text-xs font-mono text-foreground">
                {agents.reduce((s, a) => s + a.runs.length, 0)} runs
                · {formatCost(agents.reduce((s, a) => s + a.runs.reduce((ss, r) => ss + r.costUsd, 0), 0))}
              </p>
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-hidden">
            {selected ? (
              <AgentDetail agent={selected} />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                에이전트를 선택하세요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
