import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export type AgentMemoryFile = {
  agentName: string;
  filename: string;
  content: string;
};

export type AgentMemoryGroup = {
  agentName: string;
  files: AgentMemoryFile[];
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectPath = searchParams.get("projectPath");

  if (!projectPath) {
    return NextResponse.json({ groups: [] });
  }

  const agentMemoryDir = path.join(projectPath, ".claude", "agent-memory");

  if (!fs.existsSync(agentMemoryDir)) {
    return NextResponse.json({ groups: [] });
  }

  const groups: AgentMemoryGroup[] = [];

  try {
    const agentDirs = fs.readdirSync(agentMemoryDir).filter((name) => {
      const fullPath = path.join(agentMemoryDir, name);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const agentName of agentDirs) {
      const agentDir = path.join(agentMemoryDir, agentName);
      const files: AgentMemoryFile[] = [];

      try {
        const entries = fs.readdirSync(agentDir);
        for (const filename of entries) {
          const filePath = path.join(agentDir, filename);
          if (fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath, "utf-8");
            files.push({ agentName, filename, content });
          }
        }
      } catch {
        // skip unreadable dirs
      }

      groups.push({ agentName, files });
    }
  } catch {
    return NextResponse.json({ groups: [] });
  }

  return NextResponse.json({ groups });
}

export async function PUT(req: NextRequest) {
  const { projectPath, agentName, filename, content } = await req.json();
  if (!projectPath || !agentName || !filename) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const dir = path.join(projectPath, ".claude", "agent-memory", agentName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content, "utf-8");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { projectPath, agentName, filename } = await req.json();
  if (!projectPath || !agentName || !filename) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const filePath = path.join(projectPath, ".claude", "agent-memory", agentName, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return NextResponse.json({ ok: true });
}
