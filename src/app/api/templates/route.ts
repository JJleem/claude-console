import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "db", "templates.json");

type Template = { id: string; name: string; content: string; createdAt: string };

function load(): Template[] {
  try { return JSON.parse(fs.readFileSync(FILE, "utf-8")); }
  catch { return []; }
}
function save(t: Template[]) { fs.writeFileSync(FILE, JSON.stringify(t, null, 2)); }

export async function GET() {
  return NextResponse.json(load());
}

export async function POST(req: NextRequest) {
  const { name, content } = await req.json();
  if (!name?.trim() || !content?.trim())
    return NextResponse.json({ error: "name과 content가 필요합니다" }, { status: 400 });
  const list = load();
  const t: Template = { id: crypto.randomUUID(), name, content, createdAt: new Date().toISOString() };
  list.unshift(t);
  save(list);
  return NextResponse.json(t);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const list = load().filter((t) => t.id !== id);
  save(list);
  return NextResponse.json({ ok: true });
}
