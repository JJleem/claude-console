import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getEncoding } from "js-tiktoken";

const enc = getEncoding("cl100k_base");

export type ContextFile = {
  filename: string;
  path: string;
  tokens: number;
  content: string;
};

export type ContextCategory = {
  id: "claude_md" | "memory" | "skills" | "agents" | "settings";
  label: string;
  tokens: number;
  files: ContextFile[];
};

export type ContextPayload = {
  totalTokens: number;
  contextLimit: number;
  categories: ContextCategory[];
};

function countTokens(text: string): number {
  return enc.encode(text).length;
}

function readFile(filePath: string, displayName?: string): ContextFile | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  return {
    filename: displayName ?? path.basename(filePath),
    path: filePath,
    tokens: countTokens(content),
    content,
  };
}

function readDirMd(dir: string, labelPrefix?: string): ContextFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readFile(path.join(dir, f), labelPrefix ? `${labelPrefix}/${f}` : f))
    .filter(Boolean) as ContextFile[];
}

function readSkillsDir(dir: string): ContextFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
    .map((dirName) => readFile(path.join(dir, dirName, "SKILL.md"), `${dirName}/SKILL.md`))
    .filter(Boolean) as ContextFile[];
}

function sumTokens(files: ContextFile[]): number {
  return files.reduce((s, f) => s + f.tokens, 0);
}

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");
  if (!projectPath) {
    return NextResponse.json({ error: "projectPath required" }, { status: 400 });
  }

  const home = os.homedir();
  const claudeHome = path.join(home, ".claude");
  const encoded = projectPath.replace(/[/_]/g, "-");

  // ── CLAUDE.md ───────────────────────────────────────────────────────────────
  const claudeMdFiles: ContextFile[] = [
    readFile(path.join(projectPath, "CLAUDE.md"), "CLAUDE.md (project)"),
    readFile(path.join(claudeHome, "CLAUDE.md"), "CLAUDE.md (global)"),
  ].filter(Boolean) as ContextFile[];

  // ── Memory ──────────────────────────────────────────────────────────────────
  const memoryFiles: ContextFile[] = [
    ...readDirMd(path.join(claudeHome, "projects", encoded, "memory"), "project"),
    ...readDirMd(path.join(claudeHome, "memory"), "global"),
  ];

  // ── Skills ──────────────────────────────────────────────────────────────────
  const skillFiles: ContextFile[] = [
    ...readSkillsDir(path.join(projectPath, ".claude", "skills")),
    ...readSkillsDir(path.join(claudeHome, "skills")),
  ];

  // ── Agents ──────────────────────────────────────────────────────────────────
  const agentFiles: ContextFile[] = [
    ...readDirMd(path.join(projectPath, ".claude", "agents"), "project"),
    ...readDirMd(path.join(claudeHome, "agents"), "global"),
  ];

  // ── Settings ────────────────────────────────────────────────────────────────
  const settingsPath = path.join(claudeHome, "projects", encoded, "settings.json");
  const settingsFiles: ContextFile[] = [];
  if (fs.existsSync(settingsPath)) {
    const content = fs.readFileSync(settingsPath, "utf-8");
    settingsFiles.push({
      filename: "settings.json",
      path: settingsPath,
      tokens: countTokens(content),
      content,
    });
  }

  const categories: ContextCategory[] = [
    { id: "claude_md", label: "CLAUDE.md",  tokens: sumTokens(claudeMdFiles), files: claudeMdFiles },
    { id: "memory",    label: "Memory",     tokens: sumTokens(memoryFiles),   files: memoryFiles   },
    { id: "skills",    label: "Skills",     tokens: sumTokens(skillFiles),    files: skillFiles    },
    { id: "agents",    label: "Agents",     tokens: sumTokens(agentFiles),    files: agentFiles    },
    { id: "settings",  label: "Settings",   tokens: sumTokens(settingsFiles), files: settingsFiles },
  ];

  const totalTokens = categories.reduce((s, c) => s + c.tokens, 0);

  return NextResponse.json({ totalTokens, contextLimit: 200_000, categories } satisfies ContextPayload);
}
