import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { runs } from "./db/schema";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 도구 정의 타입
export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

// 도구 실행 핸들러: 도구 이름 + 입력값 받아서 결과 반환
export type ToolHandler = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<unknown>;

type LoggedMessageParams = {
  model?: string;
  system?: string;
  userPrompt: string;
  tools?: ToolDefinition[];
  onToolCall?: ToolHandler;
  agentId?: string;
  parentRunId?: string;
};

export async function loggedClaude({
  model = "claude-sonnet-4-5",
  system,
  userPrompt,
  tools,
  onToolCall,
  agentId,
  parentRunId,
}: LoggedMessageParams) {
  const startedAt = Date.now();

  // 대화 히스토리 — Tool Use 루프에서 계속 누적됨
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalResponse = "";

  // Tool Use 루프: stop_reason이 "end_turn"이 될 때까지 반복
  while (true) {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      ...(system && { system }),
      ...(tools && tools.length > 0 && { tools }),
      messages,
    });

    totalInputTokens += message.usage.input_tokens;
    totalOutputTokens += message.usage.output_tokens;

    // Claude의 응답을 히스토리에 추가
    messages.push({ role: "assistant", content: message.content });

    // 도구 호출 없이 종료 → 루프 탈출
    if (message.stop_reason === "end_turn") {
      const textBlock = message.content.find((b) => b.type === "text");
      finalResponse = textBlock?.type === "text" ? textBlock.text : "";
      break;
    }

    // stop_reason === "tool_use" → 도구 실행
    if (message.stop_reason === "tool_use") {
      const toolUseBlocks = message.content.filter((b) => b.type === "tool_use");

      // 모든 도구 병렬 실행
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") return null;

          let result: unknown;
          if (onToolCall) {
            result = await onToolCall(
              block.name,
              block.input as Record<string, unknown>
            );
          } else {
            result = { error: `No handler for tool: ${block.name}` };
          }

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        })
      );

      // 도구 결과를 유저 메시지로 히스토리에 추가
      messages.push({
        role: "user",
        content: toolResults.filter(Boolean) as Anthropic.ToolResultBlockParam[],
      });

      // 루프 계속 → Claude가 다음 응답 생성
    }
  }

  const durationMs = Date.now() - startedAt;
  const costUsd = calcCost(model, totalInputTokens, totalOutputTokens);

  // 전체 대화 (tool call 포함) 를 metadata로 저장
  const [run] = await db
    .insert(runs)
    .values({
      model,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUsd,
      durationMs,
      systemPrompt: system ?? null,
      userPrompt,
      response: finalResponse,
      agentId: agentId ?? null,
      parentRunId: parentRunId ?? null,
      metadata: JSON.stringify({ messages }),
    })
    .returning();

  return { run, response: finalResponse, messages };
}

export function calcCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
    "claude-haiku-4-5": { input: 0.8, output: 4.0 },
    "claude-opus-4-5": { input: 15.0, output: 75.0 },
  };

  const p = pricing[model] ?? { input: 3.0, output: 15.0 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
