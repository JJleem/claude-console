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

// key → 실제 경로 역탐색 (Mac/Windows 공통)
function resolveKeyToPath(key: string): string | null {
  const IS_WIN = process.platform === "win32";
  // Claude Code: path separators (/ \ :) and underscores all become "-"
  const tokens = key.replace(/^-+/, "").split("-").filter(Boolean);

  function dfs(currentPath: string, idx: number, maxDepth: number): string | null {
    if (idx === tokens.length) return fs.existsSync(currentPath) ? currentPath : null;
    if (maxDepth <= 0) return null;

    for (let n = 1; idx + n <= tokens.length; n++) {
      const slice = tokens.slice(idx, idx + n);
      const candidates = new Set([
        slice.join("-"),
        slice.join("_"),
        slice.join(" "),
      ]);
      for (const candidate of candidates) {
        const tryPath = path.join(currentPath, candidate);
        try {
          if (fs.statSync(tryPath).isDirectory()) {
            const result = dfs(tryPath, idx + n, maxDepth - 1);
            if (result !== null) return result;
          }
        } catch { /* skip */ }
      }
    }
    return null;
  }

  const home = os.homedir();

  // 1) 홈 디렉토리를 앵커로 시도 (Mac + Windows 공통)
  const homeNorm = home.replace(/\\/g, "/").replace(/:/g, "");
  const homeKey = homeNorm.replace(/[/_]/g, "-").replace(/^-+/, "");
  const homeTokens = homeKey.split("-").filter(Boolean);
  if (tokens.slice(0, homeTokens.length).join("-") === homeTokens.join("-")) {
    const result = dfs(home, homeTokens.length, tokens.length - homeTokens.length + 2);
    if (result) return result;
  }

  // 2) Windows: 드라이브 문자 추출 후 시도 (C:\ D:\ 등)
  if (IS_WIN) {
    // 첫 토큰이 드라이브 문자인 경우 (e.g., "C" from "C:" → Claude normalizes ":" to "-")
    // try "C:\", "D:\", etc.
    const drives = ["C", "D", "E", "F"];
    for (const drive of drives) {
      if (tokens[0]?.toUpperCase() === drive) {
        const result = dfs(drive + ":\\", 1, tokens.length + 2);
        if (result) return result;
      }
    }
    // Also try without matching first token (brute-force drives)
    for (const drive of drives) {
      const drivePath = drive + ":\\";
      if (fs.existsSync(drivePath)) {
        const result = dfs(drivePath, 0, tokens.length + 2);
        if (result) return result;
      }
    }
    return null;
  }

  // 3) Unix: 루트에서 DFS
  return dfs("/", 0, tokens.length + 2);
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
