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

// 시맨틱 서치 효과를 잘 보여주는 예제 — AI 엔지니어링 핵심 개념
const DEMO_DOCUMENT = `# AI 엔지니어링 핵심 개념 가이드

## 프롬프트 엔지니어링
LLM의 출력 품질은 입력 프롬프트 설계에 크게 좌우됩니다. 시스템 프롬프트에 역할(Role)과 출력 형식을 명시하면 일관된 응답을 얻을 수 있습니다. Chain-of-Thought(CoT) 기법은 "단계별로 생각하라"는 지시를 추가해 복잡한 추론 정확도를 높입니다. Few-shot 예시를 2~5개 포함하면 모델이 원하는 패턴을 빠르게 파악합니다. 온도(temperature)를 낮추면 결정론적 출력, 높이면 창의적 출력을 얻습니다.

## 임베딩과 벡터 데이터베이스
임베딩은 텍스트를 고차원 숫자 벡터로 변환하는 기술입니다. 의미가 유사한 문장은 벡터 공간에서 가까운 거리에 위치합니다. 코사인 유사도로 두 벡터의 방향 유사성을 0~1 사이 값으로 측정합니다. Pinecone, Weaviate, pgvector 같은 벡터 DB는 수백만 개의 임베딩을 밀리초 내에 검색합니다. Voyage AI, OpenAI의 text-embedding 모델이 대표적인 임베딩 제공업체입니다.

## RAG (검색 증강 생성)
RAG는 LLM의 지식 한계를 외부 문서로 보완하는 아키텍처입니다. 문서를 청크로 분할하고 임베딩으로 인덱싱한 뒤, 질문과 유사한 청크를 검색해 컨텍스트로 주입합니다. Naive RAG는 단순 유사도 검색을 사용하고, Advanced RAG는 재순위화(reranking)와 하이브리드 검색을 추가합니다. 청크 크기는 검색 정밀도와 문맥 보존 사이의 트레이드오프입니다. 작은 청크(50~100토큰)는 정밀 검색에, 큰 청크(500토큰+)는 문맥 유지에 유리합니다.

## 파인튜닝과 RLHF
파인튜닝은 사전 학습된 모델을 도메인 특화 데이터로 추가 학습시키는 방법입니다. LoRA(Low-Rank Adaptation)는 전체 파라미터 대신 소수의 어댑터 가중치만 학습해 비용을 크게 줄입니다. RLHF(인간 피드백 강화학습)는 사람의 선호도 데이터로 모델을 정렬하는 기술로, ChatGPT·Claude 훈련에 핵심적으로 사용됩니다. DPO(Direct Preference Optimization)는 RLHF보다 단순한 구현으로 비슷한 정렬 효과를 냅니다.

## LLM 평가 (Evaluation)
LLM 출력의 품질을 자동으로 측정하는 것은 AI 엔지니어링의 핵심 과제입니다. LLM-as-Judge 패턴은 더 강력한 모델(예: Claude Opus)로 다른 모델의 출력을 채점합니다. 평가 지표로는 정확성(Accuracy), 관련성(Relevance), 충실도(Faithfulness), 완전성(Completeness)이 있습니다. Ragas, ARES 같은 프레임워크가 RAG 파이프라인 평가를 자동화합니다.

## 에이전트와 Tool Use
LLM 에이전트는 도구(Tool)를 호출해 실제 작업을 수행하는 시스템입니다. 함수 호출(Function Calling) API를 통해 LLM이 웹 검색, 코드 실행, DB 조회를 직접 수행합니다. ReAct 패턴은 추론(Reasoning)과 행동(Acting)을 번갈아 반복해 복잡한 멀티스텝 태스크를 처리합니다. 멀티 에이전트 시스템은 여러 전문화된 에이전트가 협력해 복잡한 워크플로우를 처리합니다.

## 컨텍스트 윈도우 관리
최신 LLM은 100K~1M 토큰의 컨텍스트 윈도우를 지원하지만, 긴 컨텍스트는 비용과 지연시간이 증가합니다. Lost-in-the-middle 현상으로 인해 컨텍스트 중간 정보는 양 끝보다 덜 활용되는 경향이 있습니다. 슬라이딩 윈도우, 요약 압축, 메모리 계층화 등으로 컨텍스트를 효율적으로 관리합니다.`;

interface RagHistoryItem {
  id: string;
  createdAt: string;
  userPrompt: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  metadata: string | null;
}

function RagExperiment() {
  const [document, setDocument] = useState(DEMO_DOCUMENT);
  const [query, setQuery] = useState("외부 데이터로 LLM 답변을 개선하는 방법은?");
  const [chunkSize, setChunkSize] = useState(60);
  const [running, setRunning] = useState(false);
  const [chunks, setChunks] = useState<RagChunk[]>([]);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const isMissingKey = error.includes("VOYAGE_API_KEY");

  const [history, setHistory] = useState<RagHistoryItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"experiment" | "history">("experiment");

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab]);

  async function fetchHistory() {
    const res = await fetch("/api/lab/rag");
    const data = await res.json();
    setHistory(data);
  }

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
    if (score >= 0.7) return "bg-green-500/15 text-green-400 border-green-500/30";
    if (score >= 0.5) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    return "bg-muted text-muted-foreground border-border";
  }

  return (
    <div className="space-y-6">

      {/* ── 탭 ── */}
      <div className="flex gap-1 border-b border-border">
        {(["experiment", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "experiment" ? "실험" : `히스토리${history.length > 0 ? ` (${history.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── 히스토리 탭 ── */}
      {tab === "history" && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">아직 실행 기록이 없습니다</p>
          ) : (
            history.map((item) => {
              const meta = (() => { try { return JSON.parse(item.metadata ?? "{}"); } catch { return {}; } })();
              const isExpanded = expandedId === item.id;
              const queryText = item.userPrompt.replace(/^\[RAG\]\s*/, "");
              return (
                <div key={item.id} className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors"
                  >
                    <ChevronRight size={13} className={cn("shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                    <span className="flex-1 text-xs text-foreground truncate">{queryText}</span>
                    <div className="flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground">
                      <span className="font-mono">{meta.chunkCount ?? "?"} chunks</span>
                      <span className="font-mono">${item.costUsd.toFixed(5)}</span>
                      <span>{new Date(item.createdAt + "Z").toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border divide-y divide-border">
                      {meta.top3?.length > 0 && (
                        <div className="bg-blue-500/5 p-4 space-y-2">
                          <p className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">Step 1 · Voyage AI 검색 결과</p>
                          <div className="space-y-2">
                            {meta.top3.map((c: { text: string; score: number; index: number }, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className={cn("shrink-0 px-1.5 py-0.5 rounded border font-mono", scoreColor(c.score))}>{c.score.toFixed(3)}</span>
                                <p className="text-foreground/80 leading-relaxed">{c.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="bg-purple-500/5 p-4 space-y-2">
                        <p className="text-[10px] font-bold tracking-widest text-purple-400 uppercase">Step 2 · Claude 응답</p>
                        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.response}</p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
                          <span>in {item.inputTokens} / out {item.outputTokens} tokens</span>
                          <span>·</span>
                          <span>{item.durationMs}ms</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── 실험 탭 ── */}
      {tab === "experiment" && <>

      {/* ── 개념 설명 ── */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">RAG란?</h3>
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 font-medium">
            Powered by Voyage AI · voyage-3-lite
          </span>
        </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Retrieval-Augmented Generation</strong> — LLM이 학습 데이터에 없는 정보도 정확하게 답할 수 있도록,
            외부 문서에서 관련 내용을 검색(Retrieve)해서 프롬프트에 주입(Augment)한 뒤 응답을 생성(Generate)하는 기법입니다.
          </p>
        <div className="flex gap-2 text-xs text-muted-foreground items-start">
          <span className="shrink-0 font-mono text-primary">①</span>
          <span>문서를 일정 크기의 <strong className="text-foreground">청크(chunk)</strong>로 분할</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">②</span>
          <span>질문과 각 청크 사이의 <strong className="text-foreground">코사인 유사도</strong> 계산 (Voyage AI 임베딩)</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">③</span>
          <span>상위 청크를 컨텍스트로 LLM에 주입 → 응답 생성</span>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground mb-2">🎯 이 실험에서 배울 것</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>청크 크기가 검색 품질에 미치는 영향 (크기를 조절해보세요)</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>Voyage AI 임베딩 코사인 유사도가 어떻게 의미적으로 관련된 청크를 찾아내는지</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>컨텍스트 주입 전후 LLM 응답의 차이</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>시맨틱 서치 vs 키워드 서치 — 동의어·개념 검색에서 임베딩이 유리한 이유</li>
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
        isMissingKey ? (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-yellow-400">Voyage AI API 키가 필요합니다</p>
            <ol className="space-y-1 text-xs text-muted-foreground list-none">
              <li>① <a href="https://dash.voyageai.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline underline-offset-2">dash.voyageai.com</a> 에서 무료 계정 생성</li>
              <li>② API Keys 메뉴에서 키 발급 (무료 티어 · 월 200M 토큰)</li>
              <li>③ 프로젝트 루트 <code className="bg-secondary px-1 rounded">.env</code> 파일에 추가:</li>
            </ol>
            <pre className="text-xs bg-secondary rounded px-3 py-2 font-mono text-foreground">VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxx</pre>
            <p className="text-xs text-muted-foreground">저장 후 개발 서버를 재시작하면 바로 사용 가능합니다.</p>
          </div>
        ) : (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">{error}</div>
        )
      )}

      {/* ── 파이프라인 결과 ── */}
      {(chunks.length > 0 || response) && (
        <div className="space-y-0">

          {/* STEP 1 — Voyage AI */}
          {chunks.length > 0 && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 overflow-hidden">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-500/20 bg-blue-500/10">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">Step 1</span>
                  <span className="text-xs font-medium text-blue-300">Voyage AI · voyage-3-lite</span>
                  <span className="text-xs text-blue-400/60">— 시맨틱 검색</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{chunks.length}개 청크 임베딩</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500/70 inline-block" />0.7↑ 높음</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500/70 inline-block" />0.5↑ 보통</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-border inline-block" />낮음</span>
                </div>
              </div>
              {/* 청크 목록 */}
              <div className="divide-y divide-blue-500/10 max-h-72 overflow-y-auto">
                {[...chunks].sort((a, b) => b.score - a.score).map((chunk, rank) => (
                  <div key={chunk.index} className={cn(
                    "flex items-start gap-3 px-4 py-2.5 text-xs",
                    top3Indices.has(chunk.index) ? "bg-blue-500/10" : "opacity-50"
                  )}>
                    <span className="shrink-0 font-mono text-muted-foreground w-12">#{chunk.index + 1}</span>
                    <p className="flex-1 text-foreground/80 leading-relaxed line-clamp-2">{chunk.text}</p>
                    <div className="shrink-0 flex items-center gap-2">
                      {top3Indices.has(chunk.index) && (
                        <span className="text-[10px] text-blue-400 font-medium">Top {rank + 1}</span>
                      )}
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border font-mono", scoreColor(chunk.score))}>
                        {chunk.score.toFixed(3)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* 선택된 청크 요약 */}
              <div className="px-4 py-2 border-t border-blue-500/20 bg-blue-500/5">
                <p className="text-[10px] text-blue-400/80">
                  상위 3개 청크 → Claude 컨텍스트로 주입
                  <span className="text-muted-foreground ml-2">
                    (scores: {[...chunks].sort((a, b) => b.score - a.score).slice(0, 3).map(c => c.score.toFixed(3)).join(", ")})
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* 파이프라인 화살표 */}
          {chunks.length > 0 && (response || running) && (
            <div className="flex justify-center py-2">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-px h-3 bg-border" />
                <svg width="10" height="6" viewBox="0 0 10 6" className="text-border fill-current"><path d="M5 6L0 0h10z"/></svg>
              </div>
            </div>
          )}

          {/* STEP 2 — Claude API */}
          {(response || running) && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 overflow-hidden">
              {/* 헤더 */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-purple-500/20 bg-purple-500/10">
                <span className="text-[10px] font-bold tracking-widest text-purple-400 uppercase">Step 2</span>
                <span className="text-xs font-medium text-purple-300">Claude · claude-haiku-4-5</span>
                <span className="text-xs text-purple-400/60">— 컨텍스트 기반 응답 생성</span>
              </div>
              {/* 응답 */}
              <div className="px-4 py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {response}
                {running && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
              </div>
            </div>
          )}

        </div>
      )}

      </>}
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
    <div className="space-y-6">

      {/* ── 개념 설명 ── */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Tool Use란?</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            LLM이 텍스트만 생성하는 것을 넘어, <strong className="text-foreground">외부 함수(도구)를 직접 호출</strong>할 수 있는 기능입니다.
            개발자가 툴의 스펙(이름, 파라미터, 설명)을 정의하면 Claude가 상황에 맞는 툴을 선택하고 인자를 채워 호출합니다.
            결과를 받아 다시 생각하는 루프(Agentic Loop)가 핵심입니다.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground items-start flex-wrap">
          <span className="shrink-0 font-mono text-primary">①</span><span>프롬프트 + 툴 스펙 → Claude 전달</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">②</span><span>Claude가 <strong className="text-foreground">tool_use</strong> 블록으로 호출할 툴과 인자 반환</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">③</span><span>실제 함수 실행 후 결과를 <strong className="text-foreground">tool_result</strong>로 전달</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">④</span><span>Claude가 최종 응답 생성</span>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground mb-2">🎯 이 실험에서 배울 것</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>Claude가 어떤 기준으로 툴을 선택하는지 (tool_call 확인)</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>툴 결과가 최종 응답에 어떻게 반영되는지</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>여러 툴을 한 번에 호출하는 병렬 tool use 패턴</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>Tool Use가 RAG·에이전트·자동화의 기반이 되는 이유</li>
          </ul>
        </div>
      </div>

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
    <div className="space-y-6">

      {/* ── 개념 설명 ── */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Structured Output이란?</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            LLM의 응답을 자유로운 텍스트가 아닌 <strong className="text-foreground">정해진 JSON 스키마</strong>에 맞게 강제로 받아내는 기법입니다.
            Tool Use의 <code className="font-mono text-xs bg-secondary px-1 rounded">tool_choice: forced</code>를 활용해 Claude가 반드시 특정 구조로만 응답하도록 합니다.
            파싱 오류 없이 안정적으로 데이터를 추출할 수 있어 실무에서 많이 쓰입니다.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground items-start flex-wrap">
          <span className="shrink-0 font-mono text-primary">①</span><span>추출할 필드와 타입 정의 (JSON Schema)</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">②</span><span><code className="font-mono bg-secondary px-1 rounded">tool_choice: {"{type: 'tool', name: 'extract'}"}</code>로 강제</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">③</span><span>Claude가 스키마에 맞는 JSON만 반환</span>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground mb-2">🎯 이 실험에서 배울 것</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>필드 타입(string/number/boolean/array)이 출력에 어떤 영향을 주는지</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>description이 정밀할수록 추출 품질이 높아지는 것</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>프리스타일 텍스트 파싱 vs Structured Output의 안정성 차이</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>분류, 감성 분석, 데이터 추출 파이프라인에 적용하는 방법</li>
          </ul>
        </div>
      </div>

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
    <div className="space-y-6">

      {/* ── 개념 설명 ── */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Prompt Chaining이란?</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            복잡한 작업을 여러 단계의 LLM 호출로 나눠 순서대로 처리하는 패턴입니다.
            각 단계의 출력이 다음 단계의 입력으로 전달되며, 단일 프롬프트로는 어려운 작업을
            <strong className="text-foreground"> 분해 → 처리 → 조합</strong>하는 방식으로 해결합니다.
          </p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground items-start flex-wrap">
          <span className="shrink-0 font-mono text-primary">①</span><span><code className="font-mono bg-secondary px-1 rounded">{"{{input}}"}</code> = 원본 입력</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">②</span><span>1단계 실행 → 출력</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">③</span><span><code className="font-mono bg-secondary px-1 rounded">{"{{prev}}"}</code>로 이전 출력 참조</span>
          <span className="text-muted-foreground/30 mx-1">→</span>
          <span className="shrink-0 font-mono text-primary">④</span><span>2단계… N단계 반복</span>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground mb-2">🎯 이 실험에서 배울 것</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>단일 복잡 프롬프트 vs 체인 분해의 품질 차이</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>각 단계에 다른 시스템 프롬프트(역할)를 주는 효과</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>요약 → 번역, 추출 → 검증, 초안 → 다듬기 같은 실전 패턴</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>단계가 많아질수록 비용과 지연이 선형 증가하는 트레이드오프</li>
          </ul>
        </div>
      </div>

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
    <div className="space-y-6">

      {/* ── 개념 설명 ── */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Context Window란?</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            LLM이 한 번에 처리할 수 있는 <strong className="text-foreground">최대 토큰 수</strong>입니다.
            시스템 프롬프트 + 대화 히스토리 + 문서 + 도구 결과가 모두 이 안에 들어가야 합니다.
            토큰은 단어와 비슷하지만 정확히 같지 않아요 — 영어는 단어당 평균 1.3토큰, 한국어는 단어당 2~4토큰입니다.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-md bg-secondary px-3 py-2 space-y-0.5">
            <p className="font-medium text-foreground">영어</p>
            <p className="text-muted-foreground">~1.3 토큰/단어</p>
            <p className="text-muted-foreground font-mono">1000단어 ≈ 1300토큰</p>
          </div>
          <div className="rounded-md bg-secondary px-3 py-2 space-y-0.5">
            <p className="font-medium text-foreground">한국어</p>
            <p className="text-muted-foreground">~2–4 토큰/단어</p>
            <p className="text-muted-foreground font-mono">1000단어 ≈ 3000토큰</p>
          </div>
          <div className="rounded-md bg-secondary px-3 py-2 space-y-0.5">
            <p className="font-medium text-foreground">코드</p>
            <p className="text-muted-foreground">~1–2 토큰/단어</p>
            <p className="text-muted-foreground font-mono">변수명·기호 따라 다름</p>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground mb-2">🎯 이 실험에서 배울 것</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>같은 내용도 언어에 따라 토큰 수가 크게 달라지는 것</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>문서를 통째로 넣을 때 vs RAG로 청크만 넣을 때 토큰 차이</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>200K 컨텍스트가 실제로 얼마나 긴 문서인지 체감</li>
            <li className="flex items-start gap-2"><span className="text-primary shrink-0">•</span>토큰이 많아질수록 비용과 지연이 늘어나는 이유</li>
          </ul>
        </div>
      </div>

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
