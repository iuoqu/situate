import { NextResponse, type NextRequest } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/auth/set-password
 *
 * Body: { password: string }
 *
 * Sets or replaces the signed-in user's password. Requires an active
 * session (cookie-based) — there's no separate "current password"
 * check because possessing a valid session is itself proof of
 * authentication (came from a magic link or a prior password).
 *
 * Minimum length is 8 — Supabase enforces its own minimum (configured
 * in the dashboard, default 6) but we want at least 8 regardless.
 */

export const runtime = "nodejs";

const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 200;

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await safeJson(req);
  if (!body || typeof body.password !== "string") {
    return NextResponse.json(
      { error: "password is required" },
      { status: 400 },
    );
  }
  const password = body.password;
  if (password.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      { status: 400 },
    );
  }
  if (password.length > MAX_PASSWORD_LEN) {
    return NextResponse.json(
      { error: `Password must be at most ${MAX_PASSWORD_LEN} characters.` },
      { status: 400 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json(
      { error: error.message || "could not update password" },
      { status: 400 },
    );
  }

  return NextResponse.json({ status: "ok" });
}

async function safeJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
