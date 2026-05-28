import { NextResponse, type NextRequest } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/auth/password-login
 *
 * Body: { email: string, password: string, next?: string }
 *
 * Calls `signInWithPassword` on the SSR client; on success the auth
 * cookies are written via the setAll adapter and ride along on the
 * response. Returns `{status: "ok", next}` so the client knows where
 * to redirect.
 *
 * If the email exists but has never had a password set, Supabase
 * returns "Invalid login credentials" — the same error as a wrong
 * password. We surface a softer message that nudges the user toward
 * the magic-link path so they can set one.
 *
 * Rate-limited by Supabase's built-in auth policies (defaults: 30
 * requests per 5 min per IP). No extra application-level limit.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }
  const email = body.email.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }
  const next =
    typeof body.next === "string" && body.next.startsWith("/")
      ? body.next
      : "/";

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate") || msg.includes("too many")) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a minute and try again." },
        { status: 429 },
      );
    }
    // Supabase deliberately returns the same opaque error for "wrong
    // password" and "user has no password". We can't distinguish, so
    // we tell the user about both possibilities in one message.
    return NextResponse.json(
      {
        error:
          "Wrong password — or you haven't set one yet. Sign in with a magic link, then set a password from your account.",
        reason: "invalid_credentials",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({ status: "ok", next });
}

async function safeJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
