import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export type MemoryFile = {
  filename: string;
  name: string;
  description: string;
  type: "user" | "feedback" | "project" | "reference" | "unknown";
  body: string;
  projectKey: string;
  scope: "global" | "project";
};

// Parse frontmatter from memory .md files
function parseFrontmatter(content: string): {
  name: string;
  description: string;
  type: string;
  body: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  if (!match) return { name: "", description: "", type: "unknown", body: content };

  const frontmatter = match[1];
  const body = match[2].trim();

  const getName = (fm: string) => fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const getDesc = (fm: string) => fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const getType = (fm: string) => fm.match(/^type:\s*(.+)$/m)?.[1]?.trim() ?? "unknown";

  return {
    name: getName(frontmatter),
    description: getDesc(frontmatter),
    type: getType(frontmatter),
    body,
  };
}

function readMemoryDir(
  dirPath: string,
  projectKey: string,
  scope: "global" | "project"
): MemoryFile[] {
  if (!fs.existsSync(dirPath)) return [];

  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith(".md") && f !== "MEMORY.md")
    .map((filename) => {
      const filePath = path.join(dirPath, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      const { name, description, type, body } = parseFrontmatter(content);
      return {
        filename,
        name: name || filename.replace(".md", ""),
        description,
        type: type as MemoryFile["type"],
        body,
        projectKey,
        scope,
      };
    });
}

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");

  const claudeHome = path.join(os.homedir(), ".claude");

  // Global memory: ~/.claude/memory/
  const globalMemoryDir = path.join(claudeHome, "memory");
  const globalMemory = readMemoryDir(globalMemoryDir, "global", "global");

  // Project memory: ~/.claude/projects/[key]/memory/
  let projectMemory: MemoryFile[] = [];
  if (projectPath) {
    // Convert project path to key
    const key = projectPath.replace(/[/_]/g, "-");
    const projectMemoryDir = path.join(claudeHome, "projects", key, "memory");
    projectMemory = readMemoryDir(projectMemoryDir, key, "project");
  }

  return NextResponse.json({
    global: globalMemory,
    project: projectMemory,
  });
}

export async function PUT(req: NextRequest) {
  const { projectPath, filename, scope, raw } = await req.json();

  const claudeHome = path.join(os.homedir(), ".claude");
  let dir: string;

  if (scope === "global") {
    dir = path.join(claudeHome, "memory");
  } else {
    const key = projectPath.replace(/[/_]/g, "-");
    dir = path.join(claudeHome, "projects", key, "memory");
  }

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), raw, "utf-8");

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { projectPath, filename, scope } = await req.json();

  const claudeHome = path.join(os.homedir(), ".claude");
  let filePath: string;

  if (scope === "global") {
    filePath = path.join(claudeHome, "memory", filename);
  } else {
    const key = projectPath.replace(/[/_]/g, "-");
    filePath = path.join(claudeHome, "projects", key, "memory", filename);
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return NextResponse.json({ success: true });
}
