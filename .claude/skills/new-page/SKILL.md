---
name: new-page
description: Scaffold a new page for Claude Console following project conventions. Creates the page file, API route, and adds the sidebar entry.
allowed-tools: Read, Write, Edit, Bash, Glob
argument-hint: <page-name> [description]
---

Scaffold a new page for Claude Console. The page name is: $ARGUMENTS

Steps:
1. Read `src/app/memory/page.tsx` as the reference pattern
2. Create `src/app/[page-name]/page.tsx` with:
   - `"use client"` directive
   - Standard header: icon + title + ProjectSwitcher
   - `<NoProjectSelected />` when no project selected
   - `flex flex-col h-screen overflow-hidden` root
3. Create `src/app/api/[page-name]/route.ts` with GET handler stub
4. Add entry to `src/components/Sidebar.tsx` navItems array
5. Run `npm run build` to verify

Follow all conventions in CLAUDE.md.
