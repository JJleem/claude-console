import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const globalSettingsPath = path.join(os.homedir(), ".claude", "settings.json");

export async function GET() {
  if (!fs.existsSync(globalSettingsPath)) {
    return NextResponse.json({ settings: null, raw: "{}" });
  }

  const raw = fs.readFileSync(globalSettingsPath, "utf-8");
  const settings = JSON.parse(raw);
  return NextResponse.json({ settings, raw });
}

export async function PUT(req: NextRequest) {
  const { raw } = await req.json();

  // JSON 유효성 검사
  try {
    JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "유효하지 않은 JSON입니다" }, { status: 400 });
  }

  fs.writeFileSync(globalSettingsPath, raw, "utf-8");
  return NextResponse.json({ success: true });
}
