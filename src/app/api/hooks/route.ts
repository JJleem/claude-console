import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export type HookEntry = {
  type: "command";
  command: string;
};

export type HookMatcher = {
  matcher?: string;
  hooks: HookEntry[];
};

export type HooksConfig = {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Stop?: HookMatcher[];
  Notification?: HookMatcher[];
};

function readSettings(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function writeSettings(filePath: string, data: Record<string, unknown>) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Claude Code stores project settings at ~/.claude/projects/{encoded}/settings.json
// where the encoded path replaces all "/" with "-"
function getClaudeProjectSettingsPath(projectPath: string): string {
  const encoded = projectPath.replace(/[/_]/g, "-");
  return path.join(os.homedir(), ".claude", "projects", encoded, "settings.json");
}

export async function GET(req: NextRequest) {
  const projectPath = req.nextUrl.searchParams.get("projectPath");

  const globalPath = path.join(os.homedir(), ".claude", "settings.json");
  const globalSettings = readSettings(globalPath);
  const globalHooks: HooksConfig = (globalSettings.hooks as HooksConfig) ?? {};

  let projectHooks: HooksConfig = {};
  let projectSettingsExists = false;

  if (projectPath) {
    const projectSettingsPath = getClaudeProjectSettingsPath(projectPath);
    projectSettingsExists = fs.existsSync(projectSettingsPath);
    const projectSettings = readSettings(projectSettingsPath);
    projectHooks = (projectSettings.hooks as HooksConfig) ?? {};
  }

  return NextResponse.json({
    global: globalHooks,
    project: projectHooks,
    projectSettingsExists,
  });
}

export async function PUT(req: NextRequest) {
  const { scope, projectPath, hooks } = await req.json();
  // scope: "global" | "project"

  if (scope === "global") {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    const existing = readSettings(globalPath);
    writeSettings(globalPath, { ...existing, hooks });
  } else if (scope === "project" && projectPath) {
    const projectSettingsPath = getClaudeProjectSettingsPath(projectPath);
    const existing = readSettings(projectSettingsPath);
    writeSettings(projectSettingsPath, { ...existing, hooks });
  }

  return NextResponse.json({ success: true });
}
