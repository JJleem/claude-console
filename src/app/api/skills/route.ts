import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export type Skill = {
  name: string;
  description: string;
  allowedTools: string[];
  argumentHint: string;
  content: string; // body after frontmatter
  raw: string;     // full SKILL.md text
  scope: "global" | "project";
  dirName: string; // directory name (slug)
};

function parseFrontmatter(raw: string): Omit<Skill, "scope" | "dirName"> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { name: "", description: "", allowedTools: [], argumentHint: "", content: raw, raw };
  }
  const fm = match[1];
  const content = match[2].trim();

  const get = (key: string) => fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";

  return {
    name: get("name"),
    description: get("description"),
    allowedTools: get("allowed-tools").split(/\s+/).filter(Boolean),
    argumentHint: get("argument-hint"),
    content,
    raw,
  };
}

function readSkillsDir(dir: string, scope: "global" | "project"): Skill[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
    .flatMap((dirName) => {
      const skillFile = path.join(dir, dirName, "SKILL.md");
      if (!fs.existsSync(skillFile)) return [];
      const raw = fs.readFileSync(skillFile, "utf-8");
      return [{ ...parseFrontmatter(raw), scope, dirName, name: parseFrontmatter(raw).name || dirName }];
    });
}

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");

  const globalDir = path.join(os.homedir(), ".claude", "skills");
  const globalSkills = readSkillsDir(globalDir, "global");

  let projectSkills: Skill[] = [];
  if (projectPath) {
    const projectDir = path.join(projectPath, ".claude", "skills");
    projectSkills = readSkillsDir(projectDir, "project");
  }

  return NextResponse.json({ global: globalSkills, project: projectSkills });
}

export async function PUT(req: NextRequest) {
  const { scope, projectPath, dirName, raw } = await req.json();

  const baseDir =
    scope === "global"
      ? path.join(os.homedir(), ".claude", "skills")
      : path.join(projectPath, ".claude", "skills");

  const skillDir = path.join(baseDir, dirName);
  if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), raw, "utf-8");

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { scope, projectPath, dirName } = await req.json();

  const baseDir =
    scope === "global"
      ? path.join(os.homedir(), ".claude", "skills")
      : path.join(projectPath, ".claude", "skills");

  const skillDir = path.join(baseDir, dirName);
  if (fs.existsSync(skillDir)) fs.rmSync(skillDir, { recursive: true });

  return NextResponse.json({ success: true });
}
