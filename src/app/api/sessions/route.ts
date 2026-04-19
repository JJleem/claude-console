import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export type SessionMeta = {
  sessionId: string;
  projectKey: string;
  filePath: string;
  messageCount: number;
  firstTs: string;
  lastTs: string;
};

function parseJsonl(filePath: string): object[] {
  try {
    return fs.readFileSync(filePath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const projectKey = req.nextUrl.searchParams.get("projectKey") ?? "";
  const claudeHome = path.join(os.homedir(), ".claude", "projects");
  const dirs = projectKey ? [projectKey] : (fs.existsSync(claudeHome) ? fs.readdirSync(claudeHome) : []);

  const sessions: SessionMeta[] = [];

  for (const dir of dirs) {
    const dirPath = path.join(claudeHome, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const lines = parseJsonl(filePath);
      const msgs = lines.filter((l: unknown) => {
        const o = l as Record<string, unknown>;
        return (o.type === "user" || o.type === "assistant") && !o.isMeta;
      });
      if (msgs.length === 0) continue;

      const timestamps = msgs
        .map((m) => (m as Record<string, unknown>).timestamp as string)
        .filter(Boolean)
        .sort();

      sessions.push({
        sessionId: file.replace(".jsonl", ""),
        projectKey: dir,
        filePath,
        messageCount: msgs.length,
        firstTs: timestamps[0] ?? "",
        lastTs: timestamps[timestamps.length - 1] ?? "",
      });
    }
  }

  sessions.sort((a, b) => b.lastTs.localeCompare(a.lastTs));
  return NextResponse.json(sessions);
}
