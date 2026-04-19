import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getEncoding } from "js-tiktoken";
import Anthropic from "@anthropic-ai/sdk";

const enc = getEncoding("cl100k_base");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ContextFile = {
  filename: string;
  path: string;
  tokens: number;       // tiktoken estimate (for per-file breakdown)
  content: string;
};

export type ContextCategory = {
  id: "claude_md" | "memory" | "skills" | "agents" | "settings" | "hooks" | "mcp";
  label: string;
  tokens: number;       // tiktoken sum for this category
  files: ContextFile[];
};

export type ContextPayload = {
  totalTokens: number;          // Anthropic countTokens result (accurate)
  totalTokensFallback: boolean; // true if fell back to tiktoken
  contextLimit: number;
  categories: ContextCategory[];
};

function tiktokenCount(text: string): number {
  return enc.encode(text).length;
}

function readFile(filePath: string, displayName?: string): ContextFile | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  return {
    filename: displayName ?? path.basename(filePath),
    path: filePath,
    tokens: tiktokenCount(content),
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

function readJsonAsFile(filePath: string, displayName: string): ContextFile | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  return {
    filename: displayName,
    path: filePath,
    tokens: tiktokenCount(content),
    content,
  };
}

function sumTokens(files: ContextFile[]): number {
  return files.reduce((s, f) => s + f.tokens, 0);
}

async function getAnthropicTokenCount(systemText: string): Promise<number | null> {
  if (!process.env.ANTHROPIC_API_KEY || !systemText.trim()) return null;
  try {
    const result = await anthropic.messages.countTokens({
      model: "claude-sonnet-4-6",
      system: systemText,
      messages: [{ role: "user", content: "x" }],
    });
    // Subtract the 1 token for the minimal user message "x"
    return Math.max(0, result.input_tokens - 1);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");
  if (!projectPath) {
    return NextResponse.json({ error: "projectPath required" }, { status: 400 });
  }

  const home = os.homedir();
  const claudeHome = path.join(home, ".claude");
  const encoded = projectPath.replace(/[/_]/g, "-");

  // ── CLAUDE.md ──────────────────────────────────────────────────────────────
  const claudeMdFiles: ContextFile[] = [
    readFile(path.join(projectPath, "CLAUDE.md"), "CLAUDE.md (project)"),
    readFile(path.join(claudeHome, "CLAUDE.md"), "CLAUDE.md (global)"),
  ].filter(Boolean) as ContextFile[];

  // ── Memory ─────────────────────────────────────────────────────────────────
  const memoryFiles: ContextFile[] = [
    ...readDirMd(path.join(claudeHome, "projects", encoded, "memory"), "project"),
    ...readDirMd(path.join(claudeHome, "memory"), "global"),
  ];

  // ── Skills ─────────────────────────────────────────────────────────────────
  const skillFiles: ContextFile[] = [
    ...readSkillsDir(path.join(projectPath, ".claude", "skills")),
    ...readSkillsDir(path.join(claudeHome, "skills")),
  ];

  // ── Agents ─────────────────────────────────────────────────────────────────
  const agentFiles: ContextFile[] = [
    ...readDirMd(path.join(projectPath, ".claude", "agents"), "project"),
    ...readDirMd(path.join(claudeHome, "agents"), "global"),
  ];

  // ── Settings (settings.json) ────────────────────────────────────────────────
  const settingsFiles: ContextFile[] = [
    readJsonAsFile(path.join(claudeHome, "projects", encoded, "settings.json"), "settings.json (project)"),
    readJsonAsFile(path.join(claudeHome, "settings.json"), "settings.json (global)"),
  ].filter(Boolean) as ContextFile[];

  // ── Hooks (extracted from settings.json hooks field) ───────────────────────
  const hookFiles: ContextFile[] = [];
  for (const settingsFile of settingsFiles) {
    try {
      const parsed = JSON.parse(settingsFile.content);
      if (parsed.hooks && Object.keys(parsed.hooks).length > 0) {
        const hooksText = JSON.stringify(parsed.hooks, null, 2);
        hookFiles.push({
          filename: settingsFile.filename.replace("settings.json", "hooks"),
          path: settingsFile.path + "#hooks",
          tokens: tiktokenCount(hooksText),
          content: hooksText,
        });
      }
    } catch {
      // not valid JSON, skip
    }
  }

  // ── MCP servers (mcp.json) ─────────────────────────────────────────────────
  const mcpFiles: ContextFile[] = [
    readJsonAsFile(path.join(claudeHome, "mcp.json"), "mcp.json (global)"),
    readJsonAsFile(path.join(projectPath, ".claude", "mcp.json"), "mcp.json (project)"),
  ].filter(Boolean) as ContextFile[];

  const categories: ContextCategory[] = [
    { id: "claude_md", label: "CLAUDE.md",  tokens: sumTokens(claudeMdFiles), files: claudeMdFiles },
    { id: "memory",    label: "Memory",     tokens: sumTokens(memoryFiles),   files: memoryFiles   },
    { id: "skills",    label: "Skills",     tokens: sumTokens(skillFiles),    files: skillFiles    },
    { id: "agents",    label: "Agents",     tokens: sumTokens(agentFiles),    files: agentFiles    },
    { id: "settings",  label: "Settings",   tokens: sumTokens(settingsFiles), files: settingsFiles },
    { id: "hooks",     label: "Hooks",      tokens: sumTokens(hookFiles),     files: hookFiles     },
    { id: "mcp",       label: "MCP",        tokens: sumTokens(mcpFiles),      files: mcpFiles      },
  ];

  // ── Accurate token count via Anthropic API ─────────────────────────────────
  const allContent = categories
    .flatMap((c) => c.files.map((f) => f.content))
    .join("\n\n");

  const anthropicTotal = await getAnthropicTokenCount(allContent);
  const tiktokenTotal = categories.reduce((s, c) => s + c.tokens, 0);

  return NextResponse.json({
    totalTokens: anthropicTotal ?? tiktokenTotal,
    totalTokensFallback: anthropicTotal === null,
    contextLimit: 200_000,
    categories,
  } satisfies ContextPayload);
}
