# Claude Console

A local-only developer dashboard for Claude Code power users. Runs at `localhost:3000`. No cloud, no auth — everything is local.

## What This Is

Claude Console is a **context engineering workbench** built around Claude Code's local file structure. It gives developers a GUI to manage, test, and observe everything that shapes how Claude behaves in their projects.

The core insight: Claude's behavior is determined by the sum of its context — CLAUDE.md, memory files, skills, hooks, agents, and system prompts. This app is a control panel for that entire context layer.

## Tech Stack

- **Framework**: Next.js App Router (TypeScript)
- **Styling**: Tailwind CSS v4 + shadcn/ui (dark/light theme toggle)
- **Database**: Drizzle ORM + better-sqlite3 → `db/console.db`
- **AI**: `@anthropic-ai/sdk` — `ANTHROPIC_API_KEY` in `.env`
- **Real-time**: Server-Sent Events (SSE) via global EventEmitter singleton (`src/lib/live-emitter.ts`)
- **Config**: `next.config.ts` must include `serverExternalPackages: ["better-sqlite3"]`

## Claude Code File Structure (What We Manage)

```
~/.claude/
  memory/              ← global memory files
  skills/[name]/       ← global skills (SKILL.md per skill)
  agents/              ← global subagents (*.md per agent)
  projects/[key]/
    memory/            ← project-specific memory

[project-root]/
  CLAUDE.md            ← project harness / system context
  .claude/
    agents/            ← project-specific subagents (*.md)
    skills/[name]/     ← project-specific skills
```

Project key encoding: `path.replace(/[/_]/g, "-")`

## Pages / Features

### ✅ Done

| Route | Purpose |
|-------|---------|
| `/` | Overview — cost stats, recent runs summary |
| `/runs` | LLM call log — 2-panel list + detail, token/cost/duration |
| `/prompts` | CLAUDE.md editor — read/write file, token count, version history, @filename navigation |
| `/hooks` | Hook CRUD — PreToolUse / PostToolUse / Stop / Notification, global + project scope |
| `/skills` | Skill file manager — `~/.claude/skills/[name]/SKILL.md`, global + project |
| `/memory` | Memory file manager — frontmatter parsing (name/description/type/body), global + project, full CRUD |
| `/agents` | Subagent file manager — `.claude/agents/*.md`, frontmatter: name/description/model/color/memory/tools |
| `/settings` | Project registration — scan `~/.claude/projects/`, add/remove projects |
| `/live` | Live Monitor — SSE stream of Claude Code hook events, filter by type, persist to SQLite |
| `/eval` | LLM-as-judge — auto-score recent runs on relevance/quality/accuracy (1–5), Claude tool-use loop |
| `/ab` | A/B Test / Harness Testing — side-by-side system prompt comparison, AI judge, save as named harness, run history per harness |

### DB Schema (SQLite via Drizzle)

```
runs           — LLM call log (model, tokens, cost, duration, system/user/response)
agents         — internal agent tracking (separate from .claude/agents/ files)
evaluations    — eval scores per run
projects       — registered projects (name, path)
promptVersions — CLAUDE.md version snapshots per project
hookEvents     — live monitor events (event type, tool, input, output, sessionId)
harnesses      — saved A/B test configs (name, systemA, systemB, model)
harnessRuns    — test run history per harness (responses, tokens, ms, winner, verdict)
```

### Key Shared Components

- `src/components/Sidebar.tsx` — nav + light/dark toggle + active project display
- `src/components/ProjectSwitcher.tsx` — reusable project dropdown (shows name, path in items)
- `src/components/NoProjectSelected.tsx` — consistent empty state linking to /settings
- `src/lib/project-context.tsx` — React Context for selected project (localStorage)
- `src/lib/theme-context.tsx` — light/dark toggle (localStorage, toggles `.dark`/`.light` on `<html>`)
- `src/lib/claude.ts` — `loggedClaude()` wrapper: runs Claude with tool-use loop, saves to `runs` table
- `src/lib/live-emitter.ts` — global EventEmitter singleton for SSE

## Conventions

### UI Patterns
- All pages: `flex flex-col h-screen overflow-hidden` root, header bar with icon + title + ProjectSwitcher
- Tabs with project/global scope: project tab always first (left), `defaultValue="project"`
- No project selected: show `<NoProjectSelected />` — never show broken/empty UI
- Dialogs: `max-w-2xl w-[90vw]` (shadcn Dialog had hardcoded `sm:max-w-sm` removed from component)
- Hover-reveal action buttons: `opacity-0 group-hover:opacity-100 transition-opacity`

### API Routes
- File-based CRUD (memory/skills/agents/hooks): use `fs` directly, no DB
- LLM calls: use `loggedClaude()` or `anthropic.messages.create()` directly
- SSE stream: POST to `/api/live/event` → emits to `/api/live/stream`

### Scope Pattern
- `scope: "global" | "project"` — global = `~/.claude/`, project = `[projectRoot]/.claude/` or `~/.claude/projects/[key]/`
- Always show both scopes via Tabs; project tab disabled/NoProjectSelected when no project chosen

## Planned / Not Yet Done

- **Context Viewer** — visualize the full context Claude actually receives (CLAUDE.md + memory + active agents combined), with token breakdown per layer
- **Semantic search on Runs** — sqlite-vec embedding for content-based run discovery
- **Memory embedding pipeline** — auto-embed memory files on change, ANN search
- **Eval dashboard** — score trend charts over time, per-model comparison
- **Live Monitor token streaming** — show actual token stream in real-time (currently logs events, not token stream)

## Running Locally

```bash
npm install
npx drizzle-kit push   # init/migrate SQLite
npm run dev            # localhost:3000
```

Set `ANTHROPIC_API_KEY` in `.env` for Eval and A/B Test features.

To receive live hook events from Claude Code, register this hook in Claude Code settings:
```bash
curl -s -X POST http://localhost:3000/api/live/event \
  -H "Content-Type: application/json" \
  -d "$CLAUDE_HOOK_DATA"
```
