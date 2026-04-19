import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { db } from "@/lib/db";
import { runs } from "@/lib/db/schema";

type JsonlMsg = {
  type: "user" | "assistant" | string;
  isMeta?: boolean;
  message?: { role: string; content: string | unknown[] };
  timestamp?: string;
  sessionId?: string;
  uuid?: string;
};

function extractText(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const block = c as Record<string, unknown>;
        if (block.type === "text" && typeof block.text === "string") return block.text;
        if (block.type === "tool_result") return "";
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

export async function POST(req: NextRequest) {
  const { filePath, sessionId } = await req.json();
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 400 });
  }

  const lines: JsonlMsg[] = fs.readFileSync(filePath, "utf-8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l));

  // Pair user + assistant messages into runs
  const msgs = lines.filter((l) => (l.type === "user" || l.type === "assistant") && !l.isMeta);

  const imported: string[] = [];
  let i = 0;
  while (i < msgs.length) {
    const userMsg = msgs[i];
    if (userMsg.type !== "user") { i++; continue; }

    const userText = extractText(userMsg.message?.content ?? "");
    if (!userText.trim()) { i++; continue; }

    // Look for following assistant message
    const assistantMsg = msgs[i + 1];
    const responseText = assistantMsg?.type === "assistant"
      ? extractText(assistantMsg.message?.content ?? "")
      : "";

    if (!responseText.trim()) { i++; continue; }

    const createdAt = userMsg.timestamp
      ? new Date(userMsg.timestamp).toISOString().replace("T", " ").split(".")[0]
      : undefined;

    const [run] = await db.insert(runs).values({
      ...(createdAt ? { createdAt } : {}),
      model: "claude (session)",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: 0,
      userPrompt: userText.slice(0, 8000),
      response: responseText.slice(0, 8000),
      metadata: JSON.stringify({ source: "session-import", sessionId }),
    }).returning();

    imported.push(run.id);
    i += 2; // skip assistant msg
  }

  return NextResponse.json({ imported: imported.length });
}
