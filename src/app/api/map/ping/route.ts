import { NextResponse, type NextRequest } from "next/server";

import { anthropicClient } from "@/lib/ai-editor/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/map/ping              — env-var check only (no AI call)
 * GET /api/map/ping?test=anthropic — minimal bare Anthropic call (no tools,
 *   no system prompt) to confirm API reachability from this Vercel region.
 * GET /api/map/ping?test=tool    — Anthropic call WITH tool_choice + system +
 *   cache_control, mirroring focusedCall's exact request shape.
 *   Returns within 30s or times out with a structured error.
 */
export async function GET(req: NextRequest) {
  const test = new URL(req.url).searchParams.get("test");

  if (test === "anthropic" || test === "tool") {
    try {
      const isToolTest = test === "tool";
      const resp = await anthropicClient().messages.create(
        {
          model: "claude-sonnet-4-6",
          max_tokens: isToolTest ? 256 : 8,
          ...(isToolTest
            ? {
                system: [
                  {
                    type: "text" as const,
                    text: "You are a test assistant.",
                    cache_control: { type: "ephemeral" as const },
                  },
                ],
                tools: [
                  {
                    name: "ping_tool",
                    description: "Return a simple ping response.",
                    input_schema: {
                      type: "object" as const,
                      properties: {
                        pong: { type: "string", description: "Return 'pong'" },
                      },
                      required: ["pong"],
                    },
                  },
                ],
                tool_choice: { type: "tool" as const, name: "ping_tool" },
              }
            : {}),
          messages: [
            {
              role: "user",
              content: isToolTest ? "ping" : "say hi",
            },
          ],
        },
        { timeout: 25_000 },
      );
      const toolUse = resp.content.find((b) => b.type === "tool_use");
      return NextResponse.json({
        ok: true,
        anthropic_reachable: true,
        test,
        stop_reason: resp.stop_reason,
        tool_result: toolUse ? (toolUse as { input: unknown }).input : null,
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
