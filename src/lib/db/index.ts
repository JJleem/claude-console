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
