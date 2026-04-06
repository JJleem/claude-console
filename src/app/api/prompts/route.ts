import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");
  if (!projectPath) {
    return NextResponse.json({ error: "projectPath required" }, { status: 400 });
  }

  const claudeMdPath = path.join(projectPath, "CLAUDE.md");

  if (!fs.existsSync(claudeMdPath)) {
    return NextResponse.json({ content: "", exists: false });
  }

  const content = fs.readFileSync(claudeMdPath, "utf-8");
  return NextResponse.json({ content, exists: true });
}

export async function PUT(req: NextRequest) {
  const { projectPath, content } = await req.json();
  if (!projectPath || content === undefined) {
    return NextResponse.json({ error: "projectPath, content required" }, { status: 400 });
  }

  const claudeMdPath = path.join(projectPath, "CLAUDE.md");
  fs.writeFileSync(claudeMdPath, content, "utf-8");
  return NextResponse.json({ success: true });
}
