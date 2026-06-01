import { NextResponse, type NextRequest } from "next/server";

import { anthropicClient } from "@/lib/ai-editor/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/map/ping              — env-var check only (no AI call)
 * GET /api/map/ping?test=anthropic — minimal bare Anthropic call (no tools,
 *   no system prompt) to confirm API reachability from this Vercel region.
 *   Returns within 10s or times out with a structured error.
 */
export async function GET(req: NextRequest) {
  const test = new URL(req.url).searchParams.get("test");

  if (test === "anthropic") {
    try {
      const resp = await anthropicClient().messages.create(
        {
          model: "claude-sonnet-4-6",
          max_tokens: 8,
          messages: [{ role: "user", content: "say hi" }],
        },
        { timeout: 10_000 },
      );
      return NextResponse.json({
        ok: true,
        anthropic_reachable: true,
        stop_reason: resp.stop_reason,
        text: resp.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join(""),
      });
    } catch (e) {
      return NextResponse.json({
        ok: false,
        anthropic_reachable: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    env: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
      DASHSCOPE_API_KEY: !!process.env.DASHSCOPE_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  });
}
