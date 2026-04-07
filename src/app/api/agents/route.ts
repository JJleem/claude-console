import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export type AgentFile = {
  filename: string;
  name: string;
  description: string;
  model: string;
  color: string;
  memory: string;
  tools: string[];
  body: string;
  raw: string;
  scope: "global" | "project";
};

function parseFrontmatter(raw: string): Omit<AgentFile, "filename" | "scope"> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { name: "", description: "", model: "", color: "", memory: "", tools: [], body: raw, raw };

  const fm = match[1];
  const body = match[2].trim();

  const get = (key: string) => fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";

  return {
    name: get("name"),
    description: get("description").slice(0, 200), // description이 매우 길 수 있음
    model: get("model"),
    color: get("color"),
    memory: get("memory"),
    tools: get("tools").split(/,\s*|\s+/).filter(Boolean),
    body,
    raw,
  };
}

function readAgentsDir(dir: string, scope: "global" | "project"): AgentFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(dir, filename), "utf-8");
      const parsed = parseFrontmatter(raw);
      return {
        ...parsed,
        filename,
        name: parsed.name || filename.replace(".md", ""),
        scope,
      };
    });
}

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");

  const globalDir = path.join(os.homedir(), ".claude", "agents");
  const globalAgents = readAgentsDir(globalDir, "global");

  let projectAgents: AgentFile[] = [];
  if (projectPath) {
    const projectDir = path.join(projectPath, ".claude", "agents");
    projectAgents = readAgentsDir(projectDir, "project");
  }

  return NextResponse.json({ global: globalAgents, project: projectAgents });
}

export async function PUT(req: NextRequest) {
  const { scope, projectPath, filename, raw } = await req.json();

  const baseDir =
    scope === "global"
      ? path.join(os.homedir(), ".claude", "agents")
      : path.join(projectPath, ".claude", "agents");

  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, filename), raw, "utf-8");

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { scope, projectPath, filename } = await req.json();

  const baseDir =
    scope === "global"
      ? path.join(os.homedir(), ".claude", "agents")
      : path.join(projectPath, ".claude", "agents");

  const filePath = path.join(baseDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  return NextResponse.json({ ok: true });
}
