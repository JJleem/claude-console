import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ set: false });
  const masked = key.slice(0, 7) + "..." + key.slice(-4);
  return NextResponse.json({ set: true, masked });
}
