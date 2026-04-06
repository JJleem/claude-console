import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const versions = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.createdAt));

  return NextResponse.json(versions);
}

export async function POST(req: NextRequest) {
  const { projectId, label, content, tokenCount } = await req.json();

  const [version] = await db
    .insert(promptVersions)
    .values({ projectId, label, content, tokenCount: tokenCount ?? 0 })
    .returning();

  return NextResponse.json(version);
}
