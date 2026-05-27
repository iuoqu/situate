import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { inviteCodeUses, inviteCodes } from "@/db/schema";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * POST /api/auth/invite
 *
 * Body: { email: string, code: string, next?: string }
 *
 * Server-side invite-code redemption + Supabase user creation.
 *
 *   1. Validate code (exists, not expired, uses_count < max_uses).
 *   2. Atomically increment `uses_count` AND insert into `invite_code_uses`.
 *      Both rows in one transaction so we can never double-credit a code.
 *   3. Call `supabase.auth.admin.inviteUserByEmail(email)` with the service
 *      role key. Supabase creates the auth.users row AND sends an invite
 *      email containing a magic link to /auth/callback.
 *
 * The (`code`, `email`) uniqueness constraint on `invite_code_uses` makes
 * step 2 idempotent — if the same caller hits this endpoint twice, the
 * second insert fails and we abort the transaction without burning a
 * second slot on the code. Supabase's own rate-limiting handles the
 * invite-email side.
 */

export const runtime = "nodejs";

interface InviteRequest {
  email?: unknown;
  code?: unknown;
  next?: unknown;
}

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const code =
    typeof body?.code === "string"
      ? body.code.trim().toUpperCase().replace(/\s+/g, "")
      : null;
  const next =
    typeof body?.next === "string" && body.next.startsWith("/")
      ? body.next
      : "/";

  if (!email || !isPlausibleEmail(email)) {
    return NextResponse.json(
      { error: "email is required", reason: "bad_email" },
      { status: 400 },
    );
  }
  if (!code || code.length < 4 || code.length > 32) {
    return NextResponse.json(
      { error: "invite code is required", reason: "bad_code" },
      { status: 400 },
    );
  }

  // Validate + burn the code in one transaction.
  const consumeResult = await db.transaction(async (tx) => {
    const codeRow = await tx
      .select()
      .from(inviteCodes)
      .where(sql`${inviteCodes.code} = ${code}`)
      .limit(1)
      .then((rows) => rows[0]);

    if (!codeRow) return { ok: false as const, reason: "code_unknown" };
    if (codeRow.expiresAt && codeRow.expiresAt.getTime() < Date.now()) {
      return { ok: false as const, reason: "code_expired" };
    }
    if (codeRow.usesCount >= codeRow.maxUses) {
      return { ok: false as const, reason: "code_used_up" };
    }

    // Idempotent insert: if this (code, email) pair already exists,
    // we treat it as a no-op success — the user is just retrying, no
    // need to double-burn a slot.
    const existingUse = await tx
      .select()
      .from(inviteCodeUses)
      .where(
        sql`${inviteCodeUses.code} = ${code} AND ${inviteCodeUses.email} = ${email}`,
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!existingUse) {
      await tx.insert(inviteCodeUses).values({ code, email });
      await tx
        .update(inviteCodes)
        .set({ usesCount: sql`${inviteCodes.usesCount} + 1` })
        .where(sql`${inviteCodes.code} = ${code}`);
    }
    return { ok: true as const };
  });

  if (!consumeResult.ok) {
    return NextResponse.json(
      { error: consumeResult.reason, reason: consumeResult.reason },
      { status: 403 },
    );
  }

  // Code is burned — now ask Supabase to create the user + email them.
  const origin = new URL(req.url).origin;
  const admin = getAdminSupabase();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
  });

  if (error) {
    // The code is already burned. We do NOT roll it back — Supabase might
    // have partially created the user or rate-limited us, and the email
    // owner can retry login via the normal `/api/auth/request-login` once
    // their auth.users row exists. Rolling back here would let someone
    // probe the codes for free.
    const msg = error.message.toLowerCase();
    if (msg.includes("already") && msg.includes("registered")) {
      // The user already exists in auth.users (e.g. previous invite
      // succeeded). Tell the client to fall back to magic-link mode.
      return NextResponse.json({ status: "sent" });
    }
    if (msg.includes("rate")) {
      return NextResponse.json(
        { error: "rate-limited; try again in a minute", reason: "rate_limit" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "could not send invite", reason: "upstream_failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ status: "sent" });
}

async function safeJson(req: NextRequest): Promise<InviteRequest | null> {
  try {
    return (await req.json()) as InviteRequest;
  } catch {
    return null;
  }
}

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
