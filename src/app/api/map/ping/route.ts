import { NextResponse } from "next/server";

/**
 * GET /api/map/ping
 *
 * Diagnostic-only endpoint. No auth, no AI call.
 * Returns env-var presence so we can confirm:
 *   1. The /api/map/ route infrastructure loads at all
 *   2. Which API keys are configured in this deployment
 *
 * If this returns ERR_CONNECTION_CLOSED too, the problem is with the
 * basic route setup (Next.js config, Vercel plan, etc.), not the AI modules.
 * If this returns 200 but /api/map/questions fails, the issue is in the
 * module imports (angles.ts → _call.ts → anthropic SDK chain).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
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
