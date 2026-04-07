import { NextRequest, NextResponse } from "next/server";
import { loggedClaude, type ToolDefinition, type ToolHandler } from "@/lib/claude";
import { db } from "@/lib/db";
import { runs, evaluations } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

// Claude한테 알려줄 도구 2개
const evalTools: ToolDefinition[] = [
  {
    name: "get_runs",
    description: "DB에서 최근 LLM 호출 기록(runs)을 가져온다. 채점할 runs를 조회할 때 사용.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "가져올 runs 개수 (기본 5)",
        },
      },
    },
  },
  {
    name: "submit_evaluation",
    description: "특정 run에 대한 채점 결과를 DB에 저장한다. 각 run마다 반드시 호출해야 한다.",
    input_schema: {
      type: "object",
      properties: {
        runId: {
          type: "string",
          description: "채점할 run의 id",
        },
        relevance: {
          type: "number",
          description: "관련성 점수 1~5. 응답이 질문과 얼마나 관련있는가",
        },
        quality: {
          type: "number",
          description: "품질 점수 1~5. 응답이 얼마나 잘 작성되었는가",
        },
        accuracy: {
          type: "number",
          description: "정확성 점수 1~5. 응답 내용이 얼마나 정확한가",
        },
        feedback: {
          type: "string",
          description: "이 run에 대한 구체적인 피드백 (한국어)",
        },
      },
      required: ["runId", "relevance", "quality", "accuracy", "feedback"],
    },
  },
];

// 도구 실행 핸들러 — Claude가 도구를 호출하면 여기서 실제 실행
const toolHandler: ToolHandler = async (toolName, input) => {
  if (toolName === "get_runs") {
    const limit = (input.limit as number) ?? 5;
    const recentRuns = await db
      .select({
        id: runs.id,
        model: runs.model,
        userPrompt: runs.userPrompt,
        response: runs.response,
        inputTokens: runs.inputTokens,
        outputTokens: runs.outputTokens,
        costUsd: runs.costUsd,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .orderBy(desc(runs.createdAt))
      .limit(limit);

    return recentRuns;
  }

  if (toolName === "submit_evaluation") {
    const { runId, relevance, quality, accuracy, feedback } = input as {
      runId: string;
      relevance: number;
      quality: number;
      accuracy: number;
      feedback: string;
    };

    const totalScore = (relevance + quality + accuracy) / 3;

    const [evaluation] = await db
      .insert(evaluations)
      .values({
        runId,
        relevance,
        quality,
        accuracy,
        totalScore,
        feedback,
        judgeModel: "claude-sonnet-4-5",
      })
      .returning();

    return { success: true, evaluationId: evaluation.id, totalScore };
  }

  return { error: `Unknown tool: ${toolName}` };
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { limit = 5 } = body;

  const { response, messages } = await loggedClaude({
    model: "claude-sonnet-4-5",
    system: `너는 LLM 출력 품질을 평가하는 전문 심사위원이다.
get_runs 도구로 runs를 가져온 뒤, 각 run마다 반드시 submit_evaluation을 호출해서 채점해야 한다.
채점 기준:
- relevance(관련성): 응답이 질문과 얼마나 관련있는가 (1~5)
- quality(품질): 응답이 얼마나 잘 작성되었는가 (1~5)
- accuracy(정확성): 응답 내용이 얼마나 정확한가 (1~5)
모든 runs를 채점한 뒤 전체 요약을 한국어로 작성해라.`,
    userPrompt: `최근 ${limit}개의 runs를 가져와서 전부 채점해줘.`,
    tools: evalTools,
    onToolCall: toolHandler,
  });

  // 방금 저장된 평가 결과 반환
  const results = await db
    .select()
    .from(evaluations)
    .orderBy(desc(evaluations.createdAt))
    .limit(limit);

  return NextResponse.json({ summary: response, results });
}

export async function GET() {
  const results = await db
    .select({
      evaluation: evaluations,
      run: {
        userPrompt: runs.userPrompt,
        systemPrompt: runs.systemPrompt,
        response: runs.response,
        model: runs.model,
        inputTokens: runs.inputTokens,
        outputTokens: runs.outputTokens,
        costUsd: runs.costUsd,
        durationMs: runs.durationMs,
      },
    })
    .from(evaluations)
    .innerJoin(runs, eq(evaluations.runId, runs.id))
    .orderBy(desc(evaluations.createdAt))
    .limit(50);

  return NextResponse.json(results);
}
