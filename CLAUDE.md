# Claude Console

Local developer dashboard for Claude Code. Next.js App Router + Drizzle ORM + SQLite + shadcn/ui.

## Stack
- UI: Tailwind v4, shadcn/ui, Lucide icons, dark/light via `.dark`/`.light` on `<html>`
- DB: Drizzle ORM + better-sqlite3 → `db/console.db` | migrate: `npx drizzle-kit push`
- AI: `@anthropic-ai/sdk`, key in `.env` → `ANTHROPIC_API_KEY`
- SSE: global EventEmitter singleton at `src/lib/live-emitter.ts`

## Conventions (non-obvious)
- Page root: `flex flex-col h-screen overflow-hidden`
- No project selected → always `<NoProjectSelected />` component
- Tabs: project scope first, `defaultValue="project"`
- File CRUD: use `fs` directly, no DB
- Dialogs: shadcn `sm:max-w-sm` was removed from component — use `max-w-2xl w-[90vw]`
- After any schema change: `npx drizzle-kit push`

## What's Done
/ /runs /prompts /hooks /skills /memory /agents /settings /live /eval /ab

## What's Next
1. Context Viewer — token breakdown of CLAUDE.md + memory + skills + agents
2. Streaming — real-time token output in Eval / A/B
3. Tool Debugger — JSON tree view of tool input/output in Live Monitor
