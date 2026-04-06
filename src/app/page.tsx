import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";
import { desc, gte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";

async function getStats() {
  const now = new Date();

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [todayRuns, weekRuns, allRuns] = await Promise.all([
    db.select().from(runs).where(gte(runs.createdAt, today.toISOString())),
    db.select().from(runs).where(gte(runs.createdAt, weekAgo.toISOString())),
    db.select().from(runs),
  ]);

  const recentRuns = await db
    .select()
    .from(runs)
    .orderBy(desc(runs.createdAt))
    .limit(5);

  return {
    today: {
      calls: todayRuns.length,
      cost: todayRuns.reduce((s, r) => s + r.costUsd, 0),
      tokens: todayRuns.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    },
    week: {
      calls: weekRuns.length,
      cost: weekRuns.reduce((s, r) => s + r.costUsd, 0),
    },
    total: {
      calls: allRuns.length,
      cost: allRuns.reduce((s, r) => s + r.costUsd, 0),
    },
    recentRuns,
  };
}

export default async function OverviewPage() {
  const { today, week, total, recentRuns } = await getStats();

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Claude API 사용 현황</p>
        </div>
        <a
          href="https://console.anthropic.com/settings/billing"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors border border-border rounded-md px-3 py-2"
        >
          <ExternalLink size={12} />
          크레딧 잔액 확인
        </a>
      </div>

      {/* Today stats */}
      <div>
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">오늘</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "API 호출", value: today.calls.toString(), unit: "calls" },
            { label: "비용", value: `$${today.cost.toFixed(4)}`, unit: "USD" },
            { label: "토큰", value: today.tokens.toLocaleString(), unit: "tokens" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.unit}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Week / Total */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              최근 7일
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-semibold text-foreground">
                ${week.cost.toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{week.calls}회 호출</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              누적 총합
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-semibold text-primary">
                ${total.cost.toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{total.calls}회 호출</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">최근 실행</CardTitle>
        </CardHeader>
        <Separator />
        {recentRuns.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            아직 실행 기록이 없습니다.{" "}
            <span className="text-primary">Runs</span> 탭에서 테스트해보세요.
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {recentRuns.map((run) => (
              <div key={run.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <span className="text-muted-foreground font-mono text-xs w-20 shrink-0">
                  {new Date(run.createdAt).toLocaleTimeString("ko-KR")}
                </span>
                <Badge variant="secondary" className="font-mono text-xs shrink-0">
                  {run.model.replace("claude-", "")}
                </Badge>
                <span className="flex-1 text-foreground truncate">{run.userPrompt}</span>
                <span className="text-xs font-mono text-primary shrink-0">
                  ${run.costUsd.toFixed(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
