# Claude Console

**Claude Code 설정 관리 + LLM Observability 로컬 대시보드**

> RAG · Tool Use · Multi-agent · Prompt Harness · Eval을 직접 구현하며 AI Application Engineering 핵심 역량을 체득하는 프로젝트

---

## 개요

Claude Console은 Claude Code의 모든 설정을 한 곳에서 관리하고, LLM 호출을 추적하며, 프롬프트를 버전 관리하고, Eval을 실행하는 **개발자 전용 로컬 대시보드**입니다.


`npm run dev` 한 번으로 실행되는 로컬 전용 툴입니다. 배포 없음.

<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/cdfc3660-df18-478d-b88f-0ebf47fd84a1" />
<br/>
<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/809938fd-10f3-46f5-9f58-dd8ac703e86d" />
<br/>
<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/d75f6906-4d11-4151-9d68-8ca7ed47ef87" />
<br/>
<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/e30b2bac-b80a-4884-8966-40a97f384437" />
<br/>
<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/84cad94c-7b21-475d-90e2-7bae2a51a1a4" />
<br/>
<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/7165210d-fe77-431b-86cb-0dc0af8eae65" />


---

## 기능

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 📋 Runs | `/runs` | Claude Code의 전체 LLM 호출 로그 조회 · 키워드 검색 · 상세 뷰 (토큰/비용/도구 호출) |
| 📝 Prompts | `/prompts` | 프로젝트별 CLAUDE.md 에디터 · 버전 히스토리 · diff 비교 |
| 🪝 Hooks | `/hooks` | Claude Code 이벤트 훅(PreToolUse, PostToolUse 등) CRUD · 스크립트 에디터 |
| ⚡ Skills | `/skills` | 슬래시 커맨드(`/skill-name`) 생성 · 편집 · 삭제 · 마크다운 에디터 |
| 🧠 Memory | `/memory` | 글로벌/프로젝트 메모리 파일 카드 뷰 · 타입별 분류 (user/feedback/project/reference) · CRUD |
| 🤖 Subagents | `/agents` | 서브에이전트 정의 파일 관리 (글로벌/프로젝트) · 에이전트 메모리(`.claude/agent-memory/`) 뷰어 |
| 🚫 Ignore | `/ignore` | `.claudeignore` 파일 편집 · 프로젝트 타입별 패턴 추천 (Node/Python/Go/Rust 등) |
| 📊 Context | `/context` | CLAUDE.md · 메모리 · 스킬 · 에이전트 컨텍스트 토큰 사용량 분석 |
| 🧪 Eval | `/eval` | LLM-as-judge 자동 채점 · 관련성/정확도/품질 스코어링 · 결과 저장 |
| 🔀 A/B | `/ab` | 두 모델/프롬프트 병렬 실행 · 응답 비교 |
| 🔴 Live | `/live` | Claude Code 실행 중 이벤트 실시간 스트림 (SSE) · JSON 트리 뷰 |
| ⚙️ Settings | `/settings` | 프로젝트 등록/삭제 · ~/.claude/projects 자동 감지 · API 키 상태 확인 |

---

## 기술 스택

```
Frontend   Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Lucide Icons
Backend    Next.js API Routes · Node.js fs
AI         Claude API (Opus/Sonnet/Haiku) · Anthropic SDK
DB         SQLite + Drizzle ORM (better-sqlite3)
실시간     Server-Sent Events (SSE) · global EventEmitter singleton
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
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# 4. 실행 (DB는 자동 생성됩니다)
npm run dev
```

`http://localhost:3000` 접속

> API 키 설정 여부는 Settings 페이지에서 확인할 수 있습니다.

---

## 핵심 구조

### loggedClaude 래퍼

모든 Claude API 호출을 자동으로 SQLite DB에 기록하는 래퍼. Tool Use 루프를 지원해 에이전트 동작을 추적한다.

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

### Live Monitor (SSE)

Claude Code 실행 중 발생하는 모든 이벤트를 실시간으로 수신한다. `src/lib/live-emitter.ts`의 전역 EventEmitter 싱글톤이 API 라우트와 프론트엔드 스트림을 연결한다.

---

## 디렉토리 구조

```
src/
├── app/
│   ├── runs/          # LLM 호출 로그
│   ├── prompts/       # CLAUDE.md 버전 관리
│   ├── hooks/         # 훅 CRUD
│   ├── skills/        # 슬래시 커맨드 관리
│   ├── memory/        # 메모리 파일 관리
│   ├── agents/        # 서브에이전트 + 에이전트 메모리
│   ├── ignore/        # .claudeignore 에디터
│   ├── context/       # 컨텍스트 토큰 분석
│   ├── eval/          # LLM-as-judge Eval
│   ├── ab/            # A/B 테스트
│   ├── live/          # 실시간 SSE 모니터
│   └── settings/      # 프로젝트 설정
├── components/        # 공통 UI 컴포넌트 (shadcn/ui 기반)
└── lib/
    ├── db/            # Drizzle ORM 스키마 + 클라이언트
    ├── live-emitter.ts # SSE EventEmitter 싱글톤
    └── project-context.tsx # 프로젝트 전역 상태
```
