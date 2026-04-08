import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import os from "os";

// 경로 → Claude 프로젝트 key 변환
export function pathToProjectKey(absolutePath: string): string {
  return absolutePath.replace(/[/_]/g, "-");
}

// key → 실제 경로 역탐색 (DFS로 파일시스템 확인)
function resolveKeyToPath(key: string): string | null {
  const tokens = key.replace(/^-/, "").split("-").filter(Boolean);

  function dfs(currentPath: string, idx: number): string | null {
    if (idx === tokens.length) return currentPath;

    // 남은 토큰을 1개~N개씩 묶어서 폴더 이름 후보 생성
    for (let n = 1; idx + n <= tokens.length; n++) {
      const slice = tokens.slice(idx, idx + n);
      const candidates = new Set([
        slice.join("-"),  // 하이픈 연결 (literal dash)
        slice.join("_"),  // 언더스코어 연결 (molt_repository 등)
      ]);

      for (const candidate of candidates) {
        const tryPath = path.join(currentPath, candidate);
        try {
          if (fs.statSync(tryPath).isDirectory()) {
            const result = dfs(tryPath, idx + n);
            if (result !== null) return result;
          }
        } catch {
          // 존재하지 않는 경로 — skip
        }
      }
    }
    return null;
  }

  return dfs("/", 0);
}

// ~/.claude/projects/ 스캔 → 실제 경로 역탐색
function scanClaudeProjects(): { key: string; detectedPath: string | null }[] {
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(claudeProjectsDir)) return [];

  return fs
    .readdirSync(claudeProjectsDir)
    .filter((key) => fs.statSync(path.join(claudeProjectsDir, key)).isDirectory())
    .map((key) => ({
      key,
      detectedPath: resolveKeyToPath(key),
    }));
}

export async function GET() {
  const registered = await db.select().from(projects);
  const scanned = scanClaudeProjects();

  // 스캔된 것 중 아직 등록 안 된 것
  // 등록된 프로젝트의 key 계산
  const registeredKeys = new Set(registered.map((p) => pathToProjectKey(p.path)));
  const unregistered = scanned
    .filter((s) => !registeredKeys.has(s.key));

  return NextResponse.json({ registered, unregistered });
}

export async function POST(req: NextRequest) {
  const { name, projectPath } = await req.json();

  if (!name || !projectPath) {
    return NextResponse.json({ error: "name, projectPath required" }, { status: 400 });
  }

  // 경로 존재 확인
  if (!fs.existsSync(projectPath)) {
    return NextResponse.json({ error: "경로가 존재하지 않습니다" }, { status: 400 });
  }

  const [project] = await db
    .insert(projects)
    .values({ name, path: projectPath })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json(project);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ success: true });
}
