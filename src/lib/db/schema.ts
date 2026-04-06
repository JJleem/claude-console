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

export type Project = typeof projects.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Evaluation = typeof evaluations.$inferSelect;
