"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FlaskConical, Loader2 } from "lucide-react";

type EvalResult = {
  evaluation: {
    id: string;
    createdAt: string;
    runId: string;
    relevance: number;
    quality: number;
    accuracy: number;
    totalScore: number;
    feedback: string;
    judgeModel: string;
  };
  run: {
    userPrompt: string;
    model: string;
  };
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 4
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : score >= 3
      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      : "bg-red-500/10 text-red-400 border-red-500/20";

  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

export default function EvalPage() {
  const [results, setResults] = useState<EvalResult[]>([]);
  const [summary, setSummary] = useState("");
  const [progress, setProgress] = useState("");
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(5);

  async function fetchResults() {
    const res = await fetch("/api/eval");
    const data = await res.json();
    setResults(data);
  }

  useEffect(() => { fetchResults(); }, []);

  async function runEval() {
    setLoading(true);
    setSummary("");
    setProgress("");

    try {
      const res = await fetch("/api/eval/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });

      if (!res.ok || !res.body) { setLoading(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "progress") setProgress(data.message);
          else if (data.type === "text") setSummary((p) => p + data.text);
          else if (data.type === "done") { setResults(data.results); setProgress(""); }
          else if (data.type === "error") { setProgress(`오류: ${data.message}`); }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: controls + results */}
      <div className="w-96 shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground">Eval</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            LLM-as-judge 자동 채점
          </p>
        </div>

        {/* Run eval controls */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">최근 runs</span>
            <div className="flex gap-1 ml-auto">
              {[3, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    limit === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}개
                </button>
              ))}
            </div>
          </div>
          <Button onClick={runEval} disabled={loading} className="w-full" size="sm">
            {loading ? (
              <><Loader2 size={14} className="mr-2 animate-spin" />채점 중...</>
            ) : (
              <><FlaskConical size={14} className="mr-2" />Eval 실행</>
            )}
          </Button>
          {loading && progress && (
            <p className="text-xs text-muted-foreground animate-pulse">{progress}</p>
          )}
          {!loading && !progress && (
            <p className="text-xs text-muted-foreground">Claude가 runs를 가져와서 각 항목을 자동 채점합니다</p>
          )}
        </div>

        {/* Results list */}
        <ScrollArea className="flex-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              아직 채점 결과가 없습니다
            </div>
          ) : (
            <div className="divide-y divide-border">
              {results.map(({ evaluation, run }) => (
                <div key={evaluation.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs shrink-0">
                      {run.model.replace("claude-", "")}
                    </Badge>
                    <ScoreBadge score={evaluation.totalScore} />
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(evaluation.createdAt + "Z").toLocaleTimeString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-xs text-foreground truncate">
                    {run.userPrompt}
                  </p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>관련성 <ScoreBadge score={evaluation.relevance} /></span>
                    <span>품질 <ScoreBadge score={evaluation.quality} /></span>
                    <span>정확성 <ScoreBadge score={evaluation.accuracy} /></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: summary */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl">
          {loading ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <div className="space-y-1">
                      <p className="text-sm text-foreground">Claude가 채점 중입니다</p>
                      <p className="text-xs">
                        get_runs → submit_evaluation 도구를 순서대로 호출하고 있어요
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : summary ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FlaskConical size={14} className="text-primary" />
                  채점 요약
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {summary}
                  {loading && <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5 align-middle" />}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Eval 실행 버튼을 누르면 Claude가 runs를 채점합니다
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
