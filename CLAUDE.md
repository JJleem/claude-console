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
/ /runs /prompts /hooks /skills /memory /agents /settings /live /eval /ab /context /mcp /ignore /lab /heatmap

- Context Viewer: Anthropic countTokens API로 정확한 토큰 측정, Hooks·MCP 카테고리 포함
- Streaming: Eval 결과 하나씩 스트리밍, A/B judge 토큰 단위 실시간 출력
- Tool Debugger: Live Monitor에 JsonNode 트리뷰 (depth 기반 expand/collapse, 타입별 색상)
- Budget Alert: 일일/월별 예산 설정 → 초과 시 사이드바 빨간 뱃지

## What's Next
- Run 내보내기 — CSV/JSON export
- Prompt 템플릿 — system prompt 저장/불러오기
- 자동 Eval — 새 run 발생 시 백그라운드 자동 점수
- 세션 임포트 — ~/.claude/projects/*/conversations → runs 테이블
- Run 비교 — 두 run 나란히 diff
- 비용 예측 — 현재 추세로 월말 예상 지출
- Hook 테스터 — hook 명령어 직접 실행 후 결과 확인
- MCP 서버 ping — 연결 상태 실시간 체크
