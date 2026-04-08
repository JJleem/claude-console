import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const IS_WIN = process.platform === "win32";

// Windows: list available drives (C:\, D:\, ...)
function getWindowsDrives(): string[] {
  try {
    const out = execSync("wmic logicaldisk get name", { encoding: "utf-8" });
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[A-Za-z]:$/.test(l))
      .map((l) => l + "\\");
  } catch {
    return ["C:\\"];
  }
}

// Build breadcrumbs: [{name, path}] for the current path
function getBreadcrumbs(current: string): { name: string; path: string }[] {
  const crumbs: { name: string; path: string }[] = [];
  if (IS_WIN) {
    const parts = current.split(/[\\/]/).filter(Boolean);
    // parts[0] = "C:", parts[1..] = subdirs
    let acc = parts[0] + "\\"; // "C:\"
    crumbs.push({ name: parts[0], path: acc });
    for (let i = 1; i < parts.length; i++) {
      acc = path.join(acc, parts[i]);
      crumbs.push({ name: parts[i], path: acc });
    }
  } else {
    const parts = current.split("/").filter(Boolean);
    crumbs.push({ name: "/", path: "/" });
    let acc = "";
    for (const p of parts) {
      acc += "/" + p;
      crumbs.push({ name: p, path: acc });
    }
  }
  return crumbs;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reqPath = searchParams.get("path") || os.homedir();

  // Special case: Windows drive list (when path is "drives")
  if (reqPath === "drives") {
    const drives = getWindowsDrives().map((d) => ({
      name: d,
      path: d,
      hasClaude: false,
    }));
    return NextResponse.json({
      current: "drives",
      parent: null,
      home: os.homedir(),
      isWindows: true,
      breadcrumbs: [],
      dirs: drives,
    });
  }

  try {
    const entries = fs.readdirSync(reqPath, { withFileTypes: true });
    const dirs = entries
      .filter((e) => {
        if (!e.isDirectory()) return false;
        if (e.name.startsWith(".")) return false;
        // Windows: skip system dirs
        if (IS_WIN && ["$Recycle.Bin", "System Volume Information", "Recovery", "Windows"].includes(e.name)) return false;
        return true;
      })
      .map((e) => ({
        name: e.name,
        path: path.join(reqPath, e.name),
        hasClaude: fs.existsSync(path.join(reqPath, e.name, ".claude")),
      }))
      .sort((a, b) => {
        if (a.hasClaude !== b.hasClaude) return a.hasClaude ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    // Determine parent
    let parent: string | null = null;
    const parentPath = path.dirname(reqPath);
    if (parentPath !== reqPath) {
      parent = parentPath;
    } else if (IS_WIN) {
      // At drive root (e.g., C:\) → go to drives list
      parent = "drives";
    }

    return NextResponse.json({
      current: reqPath,
      parent,
      home: os.homedir(),
      isWindows: IS_WIN,
      breadcrumbs: getBreadcrumbs(reqPath),
      dirs,
    });
  } catch {
    return NextResponse.json({ error: "접근할 수 없는 경로입니다" }, { status: 400 });
  }
}
