---
name: db-push
description: Apply Drizzle ORM schema changes to the local SQLite database. Run this after modifying src/lib/db/schema.ts.
allowed-tools: Bash
---

Run `npx drizzle-kit push` in the project root to apply schema changes to `db/console.db`.

After it completes, confirm which tables were created or modified.
If there's an error, read `src/lib/db/schema.ts` and `drizzle.config.ts` to diagnose.
