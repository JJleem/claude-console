import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, runs } from "@/lib/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  const projectId = req.nextUrl.searchParams.get("projectId");

  if (agentId) {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
    const agentRuns = await db
      .select()
      .from(runs)
      .where(eq(runs.agentId, agentId))
      .orderBy(desc(runs.createdAt));
    return NextResponse.json({ agent, runs: agentRuns });
  }

  // filter by projectId if provided
  const allAgents = await db
    .select()
    .from(agents)
    .where(
      projectId
        ? eq(agents.projectId, projectId)
        : isNull(agents.projectId)
    )
    .orderBy(desc(agents.createdAt));

  const allRuns = await db.select().from(runs);
  const runsByAgent: Record<string, typeof allRuns> = {};
  for (const r of allRuns) {
    if (r.agentId) {
      if (!runsByAgent[r.agentId]) runsByAgent[r.agentId] = [];
      runsByAgent[r.agentId].push(r);
    }
  }

  return NextResponse.json(
    allAgents.map((a) => ({
      ...a,
      runs: runsByAgent[a.id] ?? [],
    }))
  );
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await db.delete(agents).where(eq(agents.id, id));
  return NextResponse.json({ ok: true });
}
