import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reqPath = searchParams.get("path") || os.homedir();

  try {
    const entries = fs.readdirSync(reqPath, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: path.join(reqPath, e.name),
        hasClaude: fs.existsSync(path.join(reqPath, e.name, ".claude")),
      }))
      .sort((a, b) => {
        if (a.hasClaude !== b.hasClaude) return a.hasClaude ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const parent = path.dirname(reqPath);
    return NextResponse.json({
      current: reqPath,
      parent: parent !== reqPath ? parent : null,
      home: os.homedir(),
      dirs,
    });
  } catch {
    return NextResponse.json({ error: "접근할 수 없는 경로입니다" }, { status: 400 });
  }
}
