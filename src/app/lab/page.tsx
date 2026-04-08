"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Database,
  Wrench,
  Braces,
  GitMerge,
  Gauge,
  TestTube,
  Play,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowDown,
  Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ExperimentId = "rag" | "tools" | "structured" | "chain" | "context";

interface Experiment {
  id: ExperimentId;
  label: string;
  description: string;
  icon: React.ElementType;
}

const EXPERIMENTS: Experiment[] = [
  { id: "rag", label: "RAG", description: "검색 증강 생성", icon: Database },
  { id: "tools", label: "Tool Use", description: "도구 호출 루프", icon: Wrench },
  { id: "structured", label: "구조화 출력", description: "스키마 기반 추출", icon: Braces },
  { id: "chain", label: "프롬프트 체인", description: "다단계 체인 실행", icon: GitMerge },
  { id: "context", label: "컨텍스트 윈도우", description: "토큰 사용량 분석", icon: Gauge },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readNdjsonStream(
  url: string,
  body: object,
  onEvent: (event: unknown) => void
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onEvent(JSON.parse(trimmed));
      } catch {}
    }
  }
  if (buffer.trim()) {
    try { onEvent(JSON.parse(buffer.trim())); } catch {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG Experiment
// ─────────────────────────────────────────────────────────────────────────────

interface RagChunk {
  text: string;
  score: number;
  index: number;
}

function RagExperiment() {
  const [document, setDocument] = useState(
    "인공지능(AI)은 컴퓨터 시스템이 인간의 지능을 모방할 수 있도록 하는 기술입니다. 머신러닝은 AI의 하위 분야로, 알고리즘이 데이터를 통해 자동으로 학습합니다. 딥러닝은 머신러닝의 한 종류로, 신경망을 사용하여 복잡한 패턴을 학습합니다.\n\n자연어 처리(NLP)는 컴퓨터가 인간의 언어를 이해하고 생성할 수 있도록 합니다. 대형 언어 모델(LLM)은 방대한 텍스트 데이터로 학습된 신경망입니다. GPT, Claude, Gemini 등이 대표적인 LLM입니다.\n\n검색 증강 생성(RAG)은 LLM에 외부 지식을 결합하여 더 정확한 답변을 생성하는 기술입니다. 문서를 청크로 나누고 관련성 높은 청크를 선택하여 컨텍스트로 제공합니다.\n\n프롬프트 엔지니어링은 LLM의 출력을 최적화하기 위해 입력 프롬프트를 설계하는 기술입니다. 체인 오브 생각(CoT), 퓨샷 학습, 역할 부여 등의 기법이 있습니다."
  );
  const [query, setQuery] = useState("RAG가 무엇인가요?");
  const [chunkSize, setChunkSize] = useState(50);
  const [running, setRunning] = useState(false);
  const [chunks, setChunks] = useState<RagChunk[]>([]);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setChunks([]);
    setResponse("");
    setError("");
    try {
      await readNdjsonStream("/api/lab/rag", { document, query, chunkSize }, (ev) => {
        const e = ev as { type: string; data?: unknown; message?: string };
        if (e.type === "chunks") setChunks(e.data as RagChunk[]);
        if (e.type === "token") setResponse((r) => r + (e.data as string));
        if (e.type === "error") setError(e.message ?? "오류 발생");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
    }
    setRunning(false);
  }

  const sortedChunks = [...chunks].sort((a, b) => b.score - a.score);
  const top3Indices = new Set(sortedChunks.slice(0, 3).map((c) => c.index));

  function scoreColor(score: number) {
    if (score >= 0.5) return "bg-green-500/15 text-green-400 border-green-500/30";
    if (score >= 0.2) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    return "bg-muted text-muted-foreground border-border";
  }

  return (
    <div className="space-y-6">

      {/* ── 개념 설명 ── */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">RAG란?</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Retrieval-Augmented Generation</strong> — LLM이 학습 데이터에 없는 정보도 정확하게 답할 수 있도록,
            외부 문서에서 관련 내용을 검색(Retrieve)해서 프롬프트에 주입(Augment)한 뒤 응답을 생성(Generate)하는 기법입니다.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground items-start">
          <span className="shrink-0 font-mono text-primary">①</span>
          <span>문서를 일정 크기의 <strong className="text-foreground">청크(chunk)</strong>로 분할</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">②</span>
          <span>질문과 각 청크 사이의 <strong className="text-foreground">유사도 점수</strong> 계산 (여기선 TF-IDF)</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">③</span>
          <span>상위 청크를 컨텍스트로 LLM에 주입 → 응답 생성</span>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground mb-2">🎯 이 실험에서 배울 것</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>청크 크기가 검색 품질에 미치는 영향 (크기를 조절해보세요)</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>TF-IDF 유사도 점수가 어떻게 관련 청크를 찾아내는지</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>컨텍스트 주입 전후 LLM 응답의 차이</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>RAG의 한계 — 임베딩 없이 키워드 기반 검색의 정확도 한계</li>
          </ul>
        </div>
      </div>

      {/* ── 문서 입력 ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">문서 붙여넣기</label>
          <span className="text-xs text-muted-foreground">{document.split(/\s+/).filter(Boolean).length}단어</span>
        </div>
        <textarea
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          rows={12}
          placeholder="분석할 문서를 여기에 붙여넣으세요. 길수록 RAG의 효과가 더 잘 보입니다."
          className="w-full text-xs bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed font-mono"
        />
      </div>

      {/* ── 질문 + 설정 ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">질문</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="문서에 대한 질문을 입력하세요"
            className="w-full text-xs bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
          />
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">청크 크기</label>
              <span className="text-xs font-mono text-primary">{chunkSize}단어</span>
            </div>
            <input
              type="range" value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              min={20} max={200} step={10}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">작을수록 정밀, 클수록 문맥 보존</p>
          </div>
          <Button onClick={run} disabled={running} className="w-full">
            {running ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Play size={13} className="mr-1.5" />}
            {running ? "실행 중..." : "실행"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">{error}</div>
      )}

      {/* ── 청크 분석 결과 ── */}
      {chunks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-foreground">청크 분석</p>
            <span className="text-xs text-muted-foreground">{chunks.length}개 생성 · 상위 3개가 컨텍스트로 주입됨</span>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500/60 inline-block" />높은 관련도</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500/60 inline-block" />보통</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border inline-block" />낮음</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
            {[...chunks].sort((a, b) => b.score - a.score).map((chunk) => (
              <div
                key={chunk.index}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  top3Indices.has(chunk.index) ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/40"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono">청크 #{chunk.index + 1}</span>
                    {top3Indices.has(chunk.index) && <span className="text-xs text-primary">컨텍스트 주입됨</span>}
                  </div>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded border font-mono", scoreColor(chunk.score))}>
                    {chunk.score.toFixed(3)}
                  </span>
                </div>
                <p className="text-foreground/80 leading-relaxed line-clamp-2">{chunk.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 생성된 응답 ── */}
      {response && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">생성된 응답 <span className="text-muted-foreground font-normal">(주입된 컨텍스트 기반)</span></p>
          <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {response}
            {running && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Use Experiment
// ─────────────────────────────────────────────────────────────────────────────

const PREDEFINED_TOOLS = [
  {
    name: "get_current_time",
    description: "현재 날짜와 시간을 ISO 형식으로 반환합니다",
    params: "없음",
  },
  {
    name: "count_words",
    description: "주어진 텍스트의 단어 수를 반환합니다",
    params: "text: string",
  },
  {
    name: "convert_temperature",
    description: "섭씨/화씨 온도를 변환합니다",
    params: "value: number, from: 'C'|'F'",
  },
];

interface ToolStep {
  type: "tool_call" | "tool_result" | "token" | "error";
  data?: unknown;
  message?: string;
}

function ToolUseExperiment() {
  const [prompt, setPrompt] = useState("현재 시간이 몇 시야? 그리고 'hello world'는 몇 단어야?");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<ToolStep[]>([]);
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setSteps([]);
    setFinalText("");
    setError("");
    try {
      await readNdjsonStream("/api/lab/tools", { prompt }, (ev) => {
        const e = ev as ToolStep;
        if (e.type === "tool_call" || e.type === "tool_result") {
          setSteps((s) => [...s, e]);
        }
        if (e.type === "token") setFinalText((t) => t + (e.data as string));
        if (e.type === "error") setError(e.message ?? "오류 발생");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
    }
    setRunning(false);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {PREDEFINED_TOOLS.map((tool) => (
          <div key={tool.name} className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 space-y-1">
            <p className="text-xs font-medium font-mono text-foreground">{tool.name}</p>
            <p className="text-xs text-muted-foreground">{tool.description}</p>
            <p className="text-xs text-muted-foreground/60 font-mono">{tool.params}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">프롬프트</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        />
        <Button onClick={run} disabled={running} className="w-full">
          {running ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Play size={13} className="mr-1.5" />}
          {running ? "실행 중..." : "실행"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {(steps.length > 0 || finalText) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">실행 과정</p>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i}>
                {step.type === "tool_call" && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                    <p className="text-xs font-medium text-amber-400 mb-1.5">
                      도구 호출: {(step.data as { name: string }).name}
                    </p>
                    <pre className="text-xs text-amber-300/80 font-mono overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify((step.data as { input: unknown }).input, null, 2)}
                    </pre>
                  </div>
                )}
                {step.type === "tool_result" && (
                  <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2.5">
                    <p className="text-xs font-medium text-green-400 mb-1">
                      결과: {(step.data as { name: string }).name}
                    </p>
                    <p className="text-xs text-green-300/80 font-mono">
                      {(step.data as { result: string }).result}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {finalText && (
              <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {finalText}
                {running && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured Output Experiment
// ─────────────────────────────────────────────────────────────────────────────

interface Field {
  name: string;
  type: string;
  description: string;
}

const FIELD_TYPES = ["string", "number", "boolean", "array"];

function StructuredExperiment() {
  const [fields, setFields] = useState<Field[]>([
    { name: "title", type: "string", description: "글의 제목" },
    { name: "sentiment", type: "string", description: "긍정/부정/중립" },
    { name: "keywords", type: "array", description: "핵심 키워드 3개" },
  ]);
  const [prompt, setPrompt] = useState("Claude는 Anthropic이 개발한 AI 어시스턴트입니다. 사용자들은 Claude를 매우 유용하고 안전하다고 평가합니다. Claude는 다양한 언어를 지원하며 코딩, 글쓰기, 분석 등에 탁월합니다.");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [tokens, setTokens] = useState<{ input: number; output: number } | null>(null);
  const [error, setError] = useState("");

  function addField() {
    setFields((f) => [...f, { name: "", type: "string", description: "" }]);
  }

  function removeField(i: number) {
    setFields((f) => f.filter((_, idx) => idx !== i));
  }

  function updateField(i: number, key: keyof Field, value: string) {
    setFields((f) => f.map((field, idx) => idx === i ? { ...field, [key]: value } : field));
  }

  async function run() {
    setRunning(true);
    setResult(null);
    setTokens(null);
    setError("");
    try {
      const res = await fetch("/api/lab/structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, fields }),
      });
      const data = await res.json() as { result?: unknown; inputTokens?: number; outputTokens?: number; error?: string };
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.result);
        if (data.inputTokens !== undefined) {
          setTokens({ input: data.inputTokens, output: data.outputTokens ?? 0 });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
    }
    setRunning(false);
  }

  function renderJson(obj: unknown, depth = 0): React.ReactNode {
    if (obj === null) return <span className="text-muted-foreground">null</span>;
    if (typeof obj === "boolean") return <span className="text-blue-400">{String(obj)}</span>;
    if (typeof obj === "number") return <span className="text-yellow-400">{obj}</span>;
    if (typeof obj === "string") return <span className="text-green-400">&quot;{obj}&quot;</span>;
    if (Array.isArray(obj)) {
      return (
        <span>
          <span className="text-muted-foreground">{"["}</span>
          {obj.map((item, i) => (
            <span key={i}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              {renderJson(item, depth + 1)}
            </span>
          ))}
          <span className="text-muted-foreground">{"]"}</span>
        </span>
      );
    }
    if (typeof obj === "object") {
      const entries = Object.entries(obj as Record<string, unknown>);
      return (
        <span>
          {entries.map(([k, v], i) => (
            <div key={k} style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
              <span className="text-primary/80">&quot;{k}&quot;</span>
              <span className="text-muted-foreground">: </span>
              {renderJson(v, depth + 1)}
              {i < entries.length - 1 && <span className="text-muted-foreground">,</span>}
            </div>
          ))}
        </span>
      );
    }
    return <span>{String(obj)}</span>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">추출 필드 정의</label>
          <Button variant="outline" size="sm" onClick={addField} className="h-7 text-xs">
            <Plus size={11} className="mr-1" />필드 추가
          </Button>
        </div>
        <div className="space-y-1.5">
          {fields.map((field, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={field.name}
                onChange={(e) => updateField(i, "name", e.target.value)}
                placeholder="필드명"
                className="w-32 text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <select
                value={field.type}
                onChange={(e) => updateField(i, "type", e.target.value)}
                className="w-24 text-xs bg-secondary border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                value={field.description}
                onChange={(e) => updateField(i, "description", e.target.value)}
                placeholder="설명"
                className="flex-1 text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeField(i)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">분석할 텍스트</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        />
        <Button onClick={run} disabled={running} className="w-full">
          {running ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Play size={13} className="mr-1.5" />}
          {running ? "실행 중..." : "추출 실행"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {result !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">추출 결과</p>
            {tokens && (
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>입력: <span className="font-mono text-foreground">{tokens.input}</span></span>
                <span>출력: <span className="font-mono text-foreground">{tokens.output}</span></span>
              </div>
            )}
          </div>
          <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-xs font-mono leading-loose">
            <span className="text-muted-foreground">{"{"}</span>
            {renderJson(result)}
            <span className="text-muted-foreground">{"}"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Chain Experiment
// ─────────────────────────────────────────────────────────────────────────────

interface ChainStep {
  name: string;
  system: string;
  prompt: string;
}

interface ChainStepResult {
  index: number;
  output: string;
  streaming: boolean;
}

function ChainExperiment() {
  const [input, setInput] = useState("인공지능이 미래 사회에 미치는 영향에 대해 설명해주세요. 교육, 의료, 경제 분야에서의 변화를 중심으로 논의해주세요.");
  const [steps, setSteps] = useState<ChainStep[]>([
    {
      name: "요약",
      system: "당신은 전문 요약가입니다. 핵심 내용만 간결하게 요약하세요.",
      prompt: "다음 텍스트를 3문장으로 요약하세요:\n\n{{input}}",
    },
    {
      name: "번역",
      system: "당신은 전문 번역가입니다. 자연스러운 영어로 번역하세요.",
      prompt: "다음 한국어 텍스트를 영어로 번역하세요:\n\n{{prev}}",
    },
  ]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ChainStepResult[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [error, setError] = useState("");

  function addStep() {
    setSteps((s) => [
      ...s,
      { name: `단계 ${s.length + 1}`, system: "", prompt: "{{prev}}" },
    ]);
  }

  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i));
  }

  function updateStep(i: number, key: keyof ChainStep, value: string) {
    setSteps((s) => s.map((step, idx) => idx === i ? { ...step, [key]: value } : step));
  }

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0, 1]));

  function toggleStep(i: number) {
    setExpandedSteps((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function run() {
    setRunning(true);
    setResults([]);
    setCurrentStep(-1);
    setError("");

    const initialResults: ChainStepResult[] = steps.map((_, i) => ({
      index: i,
      output: "",
      streaming: false,
    }));
    setResults(initialResults);

    try {
      await readNdjsonStream("/api/lab/chain", { input, steps }, (ev) => {
        const e = ev as { type: string; data?: unknown; message?: string };
        if (e.type === "step_start") {
          const d = e.data as { index: number };
          setCurrentStep(d.index);
          setResults((r) => r.map((res) => res.index === d.index ? { ...res, streaming: true } : res));
        }
        if (e.type === "token") {
          setResults((r) => {
            const active = r.find((res) => res.streaming);
            if (!active) return r;
            return r.map((res) => res.index === active.index ? { ...res, output: res.output + (e.data as string) } : res);
          });
        }
        if (e.type === "step_done") {
          const d = e.data as { index: number; output: string };
          setResults((r) => r.map((res) => res.index === d.index ? { ...res, output: d.output, streaming: false } : res));
        }
        if (e.type === "error") setError(e.message ?? "오류 발생");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
    }
    setCurrentStep(-1);
    setRunning(false);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">원본 텍스트 입력</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">체인 단계</label>
          <Button variant="outline" size="sm" onClick={addStep} className="h-7 text-xs">
            <Plus size={11} className="mr-1" />단계 추가
          </Button>
        </div>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i}>
              <div className="rounded-md border border-border overflow-hidden">
                <div
                  onClick={() => toggleStep(i)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  {expandedSteps.has(i) ? <ChevronDown size={12} className="text-muted-foreground shrink-0" /> : <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
                  <span className="text-xs font-medium text-foreground flex-1">{step.name || `단계 ${i + 1}`}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); removeStep(i); }}
                  >
                    <Trash2 size={11} />
                  </Button>
                </div>
                {expandedSteps.has(i) && (
                  <div className="border-t border-border px-3 py-3 space-y-2.5 bg-secondary/20">
                    <input
                      value={step.name}
                      onChange={(e) => updateStep(i, "name", e.target.value)}
                      placeholder="단계 이름"
                      className="w-full text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <textarea
                      value={step.system}
                      onChange={(e) => updateStep(i, "system", e.target.value)}
                      rows={2}
                      placeholder="시스템 프롬프트 (선택사항)"
                      className="w-full text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
                    />
                    <div className="space-y-1">
                      <textarea
                        value={step.prompt}
                        onChange={(e) => updateStep(i, "prompt", e.target.value)}
                        rows={3}
                        placeholder="{{input}} 또는 {{prev}} 사용 가능"
                        className="w-full text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
                      />
                      <p className="text-xs text-muted-foreground/60">
                        <span className="font-mono">{"{{input}}"}</span> = 원본 텍스트,{" "}
                        <span className="font-mono">{"{{prev}}"}</span> = 이전 단계 출력
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown size={14} className="text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button onClick={run} disabled={running} className="w-full">
        {running ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Play size={13} className="mr-1.5" />}
        {running ? "실행 중..." : "체인 실행"}
      </Button>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">실행 결과</p>
          <div className="space-y-2">
            {results.map((result, i) => (
              <div key={i}>
                <div
                  className={cn(
                    "rounded-md border px-4 py-3 transition-colors",
                    result.streaming
                      ? "border-primary/50 bg-primary/5"
                      : result.output
                      ? "border-border bg-secondary/40"
                      : "border-dashed border-border/50 bg-transparent"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-foreground">{steps[i]?.name || `단계 ${i + 1}`}</span>
                    {result.streaming && (
                      <Loader2 size={11} className="text-primary animate-spin" />
                    )}
                  </div>
                  {result.output ? (
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {result.output}
                      {result.streaming && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/40">대기 중...</p>
                  )}
                </div>
                {i < results.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown size={14} className="text-muted-foreground/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Window Experiment
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_LIMITS = [
  { name: "claude-haiku", limit: 200000, color: "bg-blue-400" },
  { name: "claude-sonnet", limit: 200000, color: "bg-purple-400" },
  { name: "claude-opus", limit: 200000, color: "bg-orange-400" },
  { name: "GPT-4o (참조)", limit: 128000, color: "bg-green-400" },
];

function ContextExperiment() {
  const [text, setText] = useState("");
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const countTokens = useCallback(async (t: string) => {
    if (!t.trim()) { setTokens(0); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/lab/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = await res.json() as { tokens: number };
      setTokens(data.tokens);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => countTokens(text), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, countTokens]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;

  function usageColor(ratio: number) {
    if (ratio >= 0.8) return "text-red-400";
    if (ratio >= 0.5) return "text-yellow-400";
    return "text-green-400";
  }

  function barColor(ratio: number) {
    if (ratio >= 0.8) return "bg-red-400";
    if (ratio >= 0.5) return "bg-yellow-400";
    return "bg-green-400";
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">텍스트 입력</label>
          <div className="flex items-center gap-2">
            {loading && <Loader2 size={11} className="text-muted-foreground animate-spin" />}
            <span className={cn("text-xs font-mono font-medium", usageColor(tokens / 200000))}>
              ~{tokens.toLocaleString()} 토큰
            </span>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="토큰을 분석할 텍스트를 입력하세요..."
          className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-center">
          <p className="text-lg font-mono font-semibold text-foreground">{chars.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">문자 수</p>
        </div>
        <div className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-center">
          <p className="text-lg font-mono font-semibold text-foreground">{words.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">단어 수</p>
        </div>
        <div className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-center">
          <p className={cn("text-lg font-mono font-semibold", usageColor(tokens / 200000))}>
            {tokens.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">토큰 수</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">모델별 컨텍스트 한도</p>
        {MODEL_LIMITS.map((model) => {
          const ratio = Math.min(tokens / model.limit, 1);
          const pct = (ratio * 100).toFixed(1);
          return (
            <div key={model.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", model.color)} />
                  <span className="text-xs text-foreground">{model.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("font-mono", usageColor(ratio))}>{pct}%</span>
                  <span className="font-mono">{model.limit.toLocaleString()}</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", barColor(ratio))}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Lab Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LabPage() {
  const [selected, setSelected] = useState<ExperimentId>("rag");

  const current = EXPERIMENTS.find((e) => e.id === selected)!;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <TestTube size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">AI Lab</span>
        <Badge variant="secondary" className="text-xs">{EXPERIMENTS.length}개 실험</Badge>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-48 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <ScrollArea className="h-[calc(100vh-110px)]">
            <div className="p-2 space-y-0.5">
              {EXPERIMENTS.map((exp) => {
                const Icon = exp.icon;
                const isActive = selected === exp.id;
                return (
                  <button
                    key={exp.id}
                    onClick={() => setSelected(exp.id)}
                    className={cn(
                      "w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-md transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-sidebar-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon
                      size={14}
                      className={cn("mt-0.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-tight">{exp.label}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">{exp.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-2.5">
            {(() => { const Icon = current.icon; return <Icon size={14} className="text-primary shrink-0" />; })()}
            <span className="text-sm font-medium text-foreground">{current.label}</span>
            <span className="text-xs text-muted-foreground">{current.description}</span>
          </div>
          <ScrollArea className="h-[calc(100vh-110px)]">
            <div className="p-5">
              {selected === "rag" && <RagExperiment />}
              {selected === "tools" && <ToolUseExperiment />}
              {selected === "structured" && <StructuredExperiment />}
              {selected === "chain" && <ChainExperiment />}
              {selected === "context" && <ContextExperiment />}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
