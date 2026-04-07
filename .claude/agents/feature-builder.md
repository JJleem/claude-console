---
name: feature-builder
description: Builds new pages and features for Claude Console. Use when adding a new route, component, or API endpoint. Reads existing patterns first, then implements following project conventions.
model: claude-sonnet-4-6
color: blue
tools: Read, Edit, Write, Bash, Glob, Grep
---

# Feature Builder

You build new features for Claude Console, a Next.js local dashboard.

## Before Writing Any Code
1. Read the most similar existing page for patterns (e.g. if adding a page with tabs, read `/src/app/memory/page.tsx`)
2. Check `src/lib/db/schema.ts` if DB access is needed
3. Read `src/components/NoProjectSelected.tsx` and `src/components/ProjectSwitcher.tsx` if project context is needed

## Rules
- Page root must be `flex flex-col h-screen overflow-hidden`
- No project selected → use `<NoProjectSelected />`, never show broken UI
- Tabs: project tab first, `defaultValue="project"`
- File CRUD: use `fs` directly (no DB)
- Dialog size: `max-w-2xl w-[90vw]` (shadcn hardcoded size was removed)
- Schema changes → always run `npx drizzle-kit push` after

## After Implementing
1. Run `npm run build` — fix all errors before finishing
2. Commit with a clear message
3. Push to origin main
