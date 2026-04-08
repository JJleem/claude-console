import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbPath = path.resolve(process.cwd(), "db/console.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const g = global as unknown as { _sqlite?: Database.Database; _ftsDone?: boolean };
if (!g._sqlite) {
  g._sqlite = new Database(dbPath);
  g._sqlite.pragma("journal_mode = WAL");

  // Auto-create tables (equivalent to drizzle-kit push)
  g._sqlite.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      duration_ms INTEGER NOT NULL,
      system_prompt TEXT,
      user_prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      has_image INTEGER DEFAULT 0,
      agent_id TEXT,
      parent_run_id TEXT,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      total_runs INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      project_id TEXT,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      run_id TEXT NOT NULL,
      relevance INTEGER NOT NULL,
      quality INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      total_score REAL NOT NULL,
      feedback TEXT NOT NULL,
      judge_model TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      project_id TEXT NOT NULL,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS hook_events (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      event TEXT NOT NULL,
      tool TEXT,
      input TEXT,
      output TEXT,
      session_id TEXT
    );
    CREATE TABLE IF NOT EXISTS harnesses (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      name TEXT NOT NULL,
      system TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS harness_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      harness_id_a TEXT,
      harness_id_b TEXT,
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
      user_message TEXT NOT NULL,
      response_a TEXT NOT NULL,
      response_b TEXT NOT NULL,
      system_a_snapshot TEXT DEFAULT '',
      system_b_snapshot TEXT DEFAULT '',
      input_tokens_a INTEGER NOT NULL DEFAULT 0,
      output_tokens_a INTEGER NOT NULL DEFAULT 0,
      input_tokens_b INTEGER NOT NULL DEFAULT 0,
      output_tokens_b INTEGER NOT NULL DEFAULT 0,
      ms_a INTEGER NOT NULL DEFAULT 0,
      ms_b INTEGER NOT NULL DEFAULT 0,
      winner TEXT DEFAULT '',
      verdict TEXT DEFAULT ''
    );
  `);

  // FTS5 virtual table for full-text search on runs
  g._sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS runs_fts USING fts5(
      id UNINDEXED,
      user_prompt,
      system_prompt,
      response,
      content=runs,
      content_rowid=rowid
    );
    CREATE TRIGGER IF NOT EXISTS runs_fts_ai AFTER INSERT ON runs BEGIN
      INSERT INTO runs_fts(rowid, id, user_prompt, system_prompt, response)
      VALUES (new.rowid, new.id, new.user_prompt, new.system_prompt, new.response);
    END;
    CREATE TRIGGER IF NOT EXISTS runs_fts_ad AFTER DELETE ON runs BEGIN
      INSERT INTO runs_fts(runs_fts, rowid, id, user_prompt, system_prompt, response)
      VALUES ('delete', old.rowid, old.id, old.user_prompt, old.system_prompt, old.response);
    END;
    CREATE TRIGGER IF NOT EXISTS runs_fts_au AFTER UPDATE ON runs BEGIN
      INSERT INTO runs_fts(runs_fts, rowid, id, user_prompt, system_prompt, response)
      VALUES ('delete', old.rowid, old.id, old.user_prompt, old.system_prompt, old.response);
      INSERT INTO runs_fts(rowid, id, user_prompt, system_prompt, response)
      VALUES (new.rowid, new.id, new.user_prompt, new.system_prompt, new.response);
    END;
  `);

  // 기존 데이터 FTS 인덱스 동기화 (최초 1회)
  if (!g._ftsDone) {
    g._sqlite.exec(`INSERT INTO runs_fts(runs_fts) VALUES('rebuild')`);
    g._ftsDone = true;
  }
}

export const sqlite = g._sqlite;
export const db = drizzle(sqlite, { schema });
