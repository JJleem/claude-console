---
name: commit
description: Stage all changes, write a conventional commit message, and push to origin main.
allowed-tools: Bash
argument-hint: [commit message]
---

Stage, commit, and push changes to origin main.

If $ARGUMENTS is provided, use it as the commit message.
If not, analyze the staged changes with `git diff --staged` and write a concise conventional commit message (feat/fix/docs/refactor).

Steps:
1. `git status` to see what's changed
2. `git add` relevant files (avoid .env, secrets, large binaries)
3. `git commit -m "..." -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`
4. `git push origin main`

Never use --no-verify. Never commit .env files.
