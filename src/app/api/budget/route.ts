import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

const FILE = path.join(process.cwd(), "db", "budget.json");

export type BudgetConfig = {
  daily: number | null;   // USD
  monthly: number | null; // USD
};

export type BudgetStatus = {
  budget: BudgetConfig;
  today: { cost: number; exceeded: boolean };
  month: { cost: number; exceeded: boolean };
};

function loadBudget(): BudgetConfig {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return { daily: null, monthly: null };
  }
}

function saveBudget(b: BudgetConfig) {
  fs.writeFileSync(FILE, JSON.stringify(b, null, 2));
}

export async function GET() {
  const budget = loadBudget();
  const allRuns = await db.select().from(runs).orderBy(desc(runs.createdAt));

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayCost  = allRuns
    .filter(r => new Date(r.createdAt + "Z") >= todayStart)
    .reduce((s, r) => s + r.costUsd, 0);

  const monthCost  = allRuns
    .filter(r => new Date(r.createdAt + "Z") >= monthStart)
    .reduce((s, r) => s + r.costUsd, 0);

  return NextResponse.json({
    budget,
    today: { cost: todayCost,  exceeded: budget.daily   !== null && todayCost  > budget.daily  },
    month: { cost: monthCost,  exceeded: budget.monthly !== null && monthCost  > budget.monthly },
  } satisfies BudgetStatus);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config: BudgetConfig = {
    daily:   body.daily   != null ? Number(body.daily)   : null,
    monthly: body.monthly != null ? Number(body.monthly) : null,
  };
  saveBudget(config);
  return NextResponse.json({ ok: true });
}
