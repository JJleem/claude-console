import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { text } = await req.json() as { text: string };

  if (!text) {
    return new Response(JSON.stringify({ tokens: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Try countTokens if available
    const result = await (anthropic.messages as unknown as {
      countTokens?: (params: unknown) => Promise<{ input_tokens: number }>;
    }).countTokens?.({
      model: "claude-haiku-4-5-20251001",
      messages: [{ role: "user", content: text }],
    });

    if (result) {
      return new Response(JSON.stringify({ tokens: result.input_tokens }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    // Fall through to estimate
  }

  // Fallback estimate
  const tokens = Math.ceil(text.length / 4);
  return new Response(JSON.stringify({ tokens }), {
    headers: { "Content-Type": "application/json" },
  });
}
