import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import os from "os";

// ~/.claude/projects/ 스캔 → 등록된 프로젝트 경로 목록 반환
function scanClaudeProjects(): { key: string; detectedPath: string }[] {
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(claudeProjectsDir)) return [];

  return fs
    .readdirSync(claudeProjectsDir)
    .filter((key) => {
      const stat = fs.statSync(path.join(claudeProjectsDir, key));
      return stat.isDirectory();
    })
    .map((key) => ({
      key,
      // -Users-molt-Desktop-project → /Users/molt/Desktop/project
      detectedPath: key.replace(/-/g, "/"),
    }));
}

export async function GET() {
  const registered = await db.select().from(projects);
  const scanned = scanClaudeProjects();

  // 스캔된 것 중 아직 등록 안 된 것
  const registeredPaths = new Set(registered.map((p) => p.path));
  const unregistered = scanned.filter((s) => !registeredPaths.has(s.detectedPath));

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
