import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export type McpServer = {
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  scope: "global" | "project";
};

function settingsPath(scope: "global" | "project", projectPath?: string): string {
  if (scope === "global") return path.join(os.homedir(), ".claude", "settings.json");
  if (!projectPath) throw new Error("projectPath required for project scope");
  return path.join(projectPath, ".claude", "settings.json");
}

function readSettings(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); }
  catch { return {}; }
}

function writeSettings(filePath: string, settings: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
}

function parseMcpServers(settings: Record<string, unknown>, scope: "global" | "project"): McpServer[] {
  const servers = (settings.mcpServers ?? {}) as Record<string, Record<string, unknown>>;
  return Object.entries(servers).map(([name, cfg]) => ({
    name,
    scope,
    type: cfg.type === "sse" ? "sse" : "stdio",
    command: cfg.command as string | undefined,
    args: cfg.args as string[] | undefined,
    env: cfg.env as Record<string, string> | undefined,
    url: cfg.url as string | undefined,
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectPath = searchParams.get("projectPath") ?? undefined;

  const globalSettings = readSettings(settingsPath("global"));
  const globalServers = parseMcpServers(globalSettings, "global");

  let projectServers: McpServer[] = [];
  if (projectPath) {
    const projectSettings = readSettings(settingsPath("project", projectPath));
    projectServers = parseMcpServers(projectSettings, "project");
  }

  return NextResponse.json({ global: globalServers, project: projectServers });
}

export async function PUT(req: NextRequest) {
  const { scope, projectPath, name, server } = await req.json();
  if (!name || !scope) return NextResponse.json({ error: "name, scope required" }, { status: 400 });

  const filePath = settingsPath(scope, projectPath);
  const settings = readSettings(filePath);
  const servers = (settings.mcpServers ?? {}) as Record<string, unknown>;

  // Build server config (exclude nulls)
  const cfg: Record<string, unknown> = {};
  if (server.type === "sse") {
    cfg.type = "sse";
    cfg.url = server.url;
  } else {
    cfg.command = server.command;
    if (server.args?.length) cfg.args = server.args;
    if (server.env && Object.keys(server.env).length) cfg.env = server.env;
  }

  servers[name] = cfg;
  settings.mcpServers = servers;
  writeSettings(filePath, settings);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { scope, projectPath, name } = await req.json();
  const filePath = settingsPath(scope, projectPath);
  const settings = readSettings(filePath);
  const servers = (settings.mcpServers ?? {}) as Record<string, unknown>;
  delete servers[name];
  settings.mcpServers = servers;
  writeSettings(filePath, settings);
  return NextResponse.json({ success: true });
}
