import { NextResponse, type NextRequest } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/auth/request-login
 *
 * Body: { email: string, next?: string }
 *
 * Flow:
 *   - Use the anon client to call `signInWithOtp({shouldCreateUser: false})`.
 *   - If the email already exists in `auth.users`: Supabase sends the magic
 *     link (subject to its own rate limits). We return `{status: "sent"}`.
 *   - If the email is unknown OR Supabase has signups disabled: Supabase
 *     errors. We translate to `{status: "needs_invite"}` so the client can
 *     flip to invite-code mode.
 *
 * This route does NOT touch the service role key. Existing users don't need
 * one — only new emails do (`/api/auth/invite`).
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  if (!body || typeof body.email !== "string") {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 },
    );
  }
  const email = body.email.trim().toLowerCase();
  if (!isPlausibleEmail(email)) {
    return NextResponse.json(
      { error: "that doesn't look like an email" },
      { status: 400 },
    );
  }
  const next =
    typeof body.next === "string" && body.next.startsWith("/")
      ? body.next
      : "/";
  const origin = new URL(req.url).origin;
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });

  if (error) {
    // Supabase returns slightly different messages depending on whether
    // signups are disabled vs the user simply doesn't exist. Both map to
    // "needs invite" from our UX's point of view.
    const msg = error.message.toLowerCase();
    if (
      msg.includes("signup") ||
      msg.includes("not found") ||
      msg.includes("user not allowed") ||
      msg.includes("disabled")
    ) {
      return NextResponse.json({ status: "needs_invite" });
    }
    if (msg.includes("rate") || msg.includes("too many")) {
      return NextResponse.json(
        { error: "rate-limited; try again in a minute" },
        { status: 429 },
      );
    }
    // Otherwise: real failure. Don't leak the upstream error verbatim — it's
    // generally a developer-oriented English string. Surface a generic.
    return NextResponse.json({ error: "could not send link" }, { status: 502 });
  }

  return NextResponse.json({ status: "sent" });
}

async function safeJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    return body;
  } catch {
    return null;
  }
}

function isPlausibleEmail(s: string): boolean {
  // Deliberately permissive — full RFC 5322 is silly here. Block obvious
  // garbage; let Supabase reject the rest.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
