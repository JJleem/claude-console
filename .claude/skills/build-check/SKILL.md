---
name: build-check
description: Run Next.js build and report only errors. Use after making changes to verify nothing is broken.
allowed-tools: Bash
---

Run `npm run build` in the project root and report the result.

If the build succeeds, say "✓ Build passed".
If there are errors, list each error with its file path and line number clearly.
Do not show warnings — only errors that cause the build to fail.
