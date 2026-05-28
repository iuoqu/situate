import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/dev/login — backdoor login for preview environments.
 *
 * Why this exists: closed-beta uses magic-link email auth. Vercel-style
 * preview deployments hand out a new hostname per build, and Supabase
 * auth cookies are bound to that hostname, so they vanish on redeploy.
 * Repeatedly waiting for email links to test write flows is friction we
 * don't need.
 *
 * Mechanism:
 *   1. Caller posts {email, secret, next?}.
 *   2. We check `DEV_LOGIN_SECRET` is set (feature flag) and the secret
 *      matches via constant-time compare.
 *   3. Admin SDK generates a one-shot magic-link `hashed_token` for the
 *      target email. Fails if the user doesn't exist in auth.users.
 *   4. Server-side SSR client verifies the token, which mints a session
 *      and writes the auth cookies onto the outgoing response.
 *   5. 303-redirect to `next` (or `/`).
 *
 * Safety:
 *   - Disabled by default. The route returns 503 unless DEV_LOGIN_SECRET
 *     is set in the environment.
 *   - NEVER set DEV_LOGIN_SECRET in production. Anyone who knows the
 *     secret can log in as any registered user.
 *   - Only logs into existing users; will not auto-create accounts.
 *   - Constant-time secret comparison resists timing attacks.
 *   - Same opaque "invalid credentials" error for wrong secret AND
 *     unknown email, so a leaked secret can't be used to enumerate
 *     registered emails.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const configured = process.env.DEV_LOGIN_SECRET;
  if (!configured) {
    return NextResponse.json(
      { error: "dev login disabled (DEV_LOGIN_SECRET not set)" },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return redirectWithError(req, "missing_form");
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const secret = String(form.get("secret") ?? "");
  const next = String(form.get("next") ?? "/");

  if (!email || !secret) {
    return redirectWithError(req, "missing_fields", next);
  }
  if (!secretsMatch(secret, configured)) {
    return redirectWithError(req, "invalid_credentials", next);
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    // Could be: user doesn't exist, email malformed, Supabase down. Don't
    // disclose which — preserves the "no enumeration" property.
    return redirectWithError(req, "invalid_credentials", next);
  }

  const supabase = await getServerSupabase();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyErr) {
    return redirectWithError(req, "verify_failed", next);
  }

  // The SSR client's setAll cookie adapter wrote the auth cookies onto
  // the outgoing response during verifyOtp. Returning NextResponse.redirect
  // here carries them along — no manual cookie wiring needed.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, req.url), { status: 303 });
}

function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function redirectWithError(
  req: NextRequest,
  code: string,
  next?: string,
): NextResponse {
  const url = new URL("/dev/login", req.url);
  url.searchParams.set("error", code);
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url, { status: 303 });
}
