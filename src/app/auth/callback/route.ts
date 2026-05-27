import { NextResponse, type NextRequest } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * GET /auth/callback?code=...&next=...
 *
 * The magic link in the user's email points here. We exchange the one-time
 * `code` for a session (cookie set by @supabase/ssr) and then redirect to
 * `next` (defaults to `/`).
 *
 * If the exchange fails the user lands back on /auth/login with a reason.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login?reason=missing_code", url.origin),
    );
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL("/auth/login?reason=exchange_failed", url.origin),
    );
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
