# Claude Console

**Claude Code 설정 관리 + LLM Observability 로컬 대시보드**

> RAG · Tool Use · Multi-agent · Prompt Harness · Eval을 직접 구현하며 AI Application Engineering 핵심 역량을 체득하는 프로젝트

📋 **[기획서 보기](https://jjleem.github.io/claude-console/planning.html)**

---

## 개요

Claude Console은 Claude Code의 모든 API 호출을 추적하고, 프롬프트를 버전 관리하며, RAG 기반 메모리를 관리하고, LLM-as-judge Eval을 실행하는 **개발자 전용 로컬 대시보드**입니다.

`npm run dev` 한 번으로 실행되는 로컬 전용 툴입니다. 배포 없음.

---

## 기능

| 섹션 | 설명 | 구현 개념 |
|------|------|-----------|
| 📊 Overview | API 호출 수 / 비용 / 토큰 요약 | LLM API |
| 📋 Runs | 전체 LLM 호출 로그 + 상세 뷰 | LLM API Wrapper |
| 🤖 Agents | 멀티에이전트 실행 흐름 추적 | Multi-agent |
| 📝 Prompts | CLAUDE.md 에디터 + 버전 비교 | Prompt Harness |
| 🪝 Hooks | Claude Code 훅 시각화 + CRUD | Context Eng. |
| ⚡ Skills | 슬래시 커맨드 관리 | - |
| 🧠 Memory | memory 파일 카드 뷰 + 시맨틱 검색 | RAG |
| ⚙️ Settings | 권한 / MCP 서버 / 모델 설정 | - |
| 🧪 Eval | LLM-as-judge 자동 채점 | Tool Use + Eval |
| 🔴 Live | 실시간 LLM 호출 스트림 | SSE |

---

## 기술 스택

```
Frontend   Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui
Backend    Next.js API Routes · Node.js fs
AI         Claude API (Sonnet + Haiku) · Anthropic SDK
DB         SQLite + Drizzle ORM
실행        로컬 전용 (npm run dev → localhost:3000)
```

---

## 시작하기

```bash
# 1. 클론
git clone https://github.com/JJleem/claude-console.git
cd claude-console

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.example .env
# .env에 ANTHROPIC_API_KEY 입력

# 4. DB 초기화
npx drizzle-kit push

# 5. 실행
npm run dev
```

`http://localhost:3000` 접속

---

## 핵심 구조

### loggedClaude 래퍼

모든 Claude API 호출을 자동으로 DB에 기록하는 래퍼. Tool Use 루프를 지원해 에이전트 동작을 추적한다.

```ts
const { response } = await loggedClaude({
  userPrompt: "분석해줘",
  tools: [getRuns, submitEval],          // Claude가 스스로 선택해서 호출
  onToolCall: async (name, input) => {   // 실제 실행 핸들러
    if (name === "get_runs") return await db.select()...
  }
})
```

### Eval 에이전트 흐름

```
유저 요청
  → Claude: get_runs 도구 호출 → DB에서 runs 조회
  → Claude: submit_evaluation 도구 반복 호출 → 채점 결과 저장
  → Claude: 최종 요약 반환
```

---

## 구현 로드맵

- [x] 프로젝트 세팅 (Next.js + shadcn/ui + Drizzle + SQLite)
- [x] loggedClaude 래퍼 (Tool Use 지원)
- [x] Runs 로깅 + 상세 뷰
- [x] Overview 비용 대시보드
- [x] Eval 에이전트 (LLM-as-judge)
- [ ] Memory 시맨틱 검색 (RAG)
- [ ] Prompt A/B 테스트 (Multi-agent)
- [ ] Live Monitor (SSE)
- [ ] Hooks / Skills / Settings CRUD
