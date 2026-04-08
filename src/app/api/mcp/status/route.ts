import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

// Check if a command exists on the system
function commandExists(cmd: string): boolean {
  try {
    const check = process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`;
    execSync(check, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Ping an SSE/HTTP URL with timeout
async function pingUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal, method: "GET" });
    clearTimeout(timer);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { type, command, url } = await req.json();

  if (type === "sse" && url) {
    const reachable = await pingUrl(url);
    return NextResponse.json({ status: reachable ? "online" : "offline" });
  }

  if (type === "stdio" && command) {
    const exists = commandExists(command);
    return NextResponse.json({ status: exists ? "ready" : "missing" });
  }

  return NextResponse.json({ status: "unknown" });
}
