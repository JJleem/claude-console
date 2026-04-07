import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  durationMs: integer("duration_ms").notNull(),
  systemPrompt: text("system_prompt"),
  userPrompt: text("user_prompt").notNull(),
  response: text("response").notNull(),
  hasImage: integer("has_image", { mode: "boolean" }).default(false),
  agentId: text("agent_id"),
  parentRunId: text("parent_run_id"),
  metadata: text("metadata"),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("running"),
  totalRuns: integer("total_runs").default(0),
  totalCost: real("total_cost").default(0),
  projectId: text("project_id"),
  metadata: text("metadata"),
});

export const evaluations = sqliteTable("evaluations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  runId: text("run_id").notNull(),
  // 1~5점 기준
  relevance: integer("relevance").notNull(),
  quality: integer("quality").notNull(),
  accuracy: integer("accuracy").notNull(),
  totalScore: real("total_score").notNull(),
  feedback: text("feedback").notNull(),
  judgeModel: text("judge_model").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
});

export const promptVersions = sqliteTable("prompt_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  projectId: text("project_id").notNull(),
  label: text("label").notNull(),   // "v1", "v2", 사용자 지정 이름
  content: text("content").notNull(),
  tokenCount: integer("token_count").default(0),
});

export const hookEvents = sqliteTable("hook_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  event: text("event").notNull(),      // PreToolUse | PostToolUse | Stop | Notification
  tool: text("tool"),                  // Bash, Edit, Write, ...
  input: text("input"),
  output: text("output"),
  sessionId: text("session_id"),
});

export const harnesses = sqliteTable("harnesses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  name: text("name").notNull(),
  system: text("system").notNull().default(""),   // 시스템 프롬프트 단일 저장
  description: text("description").default(""),
});

export const harnessRuns = sqliteTable("harness_runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  harnessIdA: text("harness_id_a"),               // null = 기본값 (시스템 없음)
  harnessIdB: text("harness_id_b"),               // null = 기본값 (시스템 없음)
  model: text("model").notNull().default("claude-sonnet-4-6"),
  userMessage: text("user_message").notNull(),
  responseA: text("response_a").notNull(),
  responseB: text("response_b").notNull(),
  systemASnapshot: text("system_a_snapshot").default(""), // 실행 시점 스냅샷
  systemBSnapshot: text("system_b_snapshot").default(""),
  inputTokensA: integer("input_tokens_a").notNull().default(0),
  outputTokensA: integer("output_tokens_a").notNull().default(0),
  inputTokensB: integer("input_tokens_b").notNull().default(0),
  outputTokensB: integer("output_tokens_b").notNull().default(0),
  msA: integer("ms_a").notNull().default(0),
  msB: integer("ms_b").notNull().default(0),
  winner: text("winner").default(""),       // "A" | "B" | "tie" | ""
  verdict: text("verdict").default(""),     // AI judge 설명
});

export type Project = typeof projects.$inferSelect;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Evaluation = typeof evaluations.$inferSelect;
export type HookEvent = typeof hookEvents.$inferSelect;
export type Harness = typeof harnesses.$inferSelect;
export type HarnessRun = typeof harnessRuns.$inferSelect;
