import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function ignorePath(projectPath: string) {
  return path.join(projectPath, ".claudeignore");
}

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("path");
  if (!projectPath) return NextResponse.json({ error: "path required" }, { status: 400 });

  const file = ignorePath(projectPath);
  const content = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";

  // Detect project type by checking marker files
  const markers: Record<string, string[]> = {
    nextjs:  ["next.config.ts", "next.config.js", "next.config.mjs"],
    react:   ["vite.config.ts", "vite.config.js"],
    node:    ["package.json"],
    python:  ["requirements.txt", "pyproject.toml", "setup.py"],
    rust:    ["Cargo.toml"],
    go:      ["go.mod"],
    java:    ["pom.xml", "build.gradle"],
  };

  const detected: string[] = [];
  for (const [type, files] of Object.entries(markers)) {
    if (files.some((f) => fs.existsSync(path.join(projectPath, f)))) {
      detected.push(type);
    }
  }

  return NextResponse.json({ content, detected });
}

export async function POST(req: NextRequest) {
  const { projectPath, content } = await req.json();
  if (!projectPath) return NextResponse.json({ error: "projectPath required" }, { status: 400 });

  fs.writeFileSync(ignorePath(projectPath), content, "utf-8");
  return NextResponse.json({ ok: true });
}
