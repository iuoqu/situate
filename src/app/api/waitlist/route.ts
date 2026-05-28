import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { waitlistRequests } from "@/db/schema";

/**
 * POST /api/waitlist
 *
 * Public endpoint — no auth (it's the path to GET auth in the first place).
 * Drops a row into `waitlist_requests` for a human admin to triage. Idempotent
 * per email (case-insensitive) — re-submitting a known email returns
 * `{status: "queued"}` without inserting a duplicate.
 *
 * Body: { email: string, note?: string, source?: string }
 *
 * Spam defence is intentionally minimal for now (the surface area is
 * small and the cost of an entry is negligible). If we get hit, add an
 * IP/email rate limit via the existing `db` connection plus a small
 * sliding-window check.
 */

export const runtime = "nodejs";

interface WaitlistRequestBody {
  email?: unknown;
  note?: unknown;
  source?: unknown;
  kind?: unknown;
}

const VALID_KINDS = new Set(["write_invite", "newsletter"]);

export async function POST(req: NextRequest) {
  const body = await safeJson(req);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const note =
    typeof body?.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 600)
      : null;
  const source =
    typeof body?.source === "string" && body.source.trim().length > 0
      ? body.source.trim().slice(0, 60)
      : "landing";
  const kind =
    typeof body?.kind === "string" && VALID_KINDS.has(body.kind)
      ? body.kind
      : "write_invite";

  if (!email || !isPlausibleEmail(email)) {
    return NextResponse.json(
      { error: "a valid email is required" },
      { status: 400 },
    );
  }

  // The per-kind unique index lets the same email be on both lists, so we
  // upsert against (lower(email), kind). Treat ON CONFLICT as idempotent
  // success — the user just resubmitted.
  await db.execute(sql`
    INSERT INTO waitlist_requests (email, note, source, kind)
    VALUES (${email}, ${note}, ${source}, ${kind})
    ON CONFLICT (lower(email), kind) DO NOTHING
  `);

  return NextResponse.json({ status: "queued" });
}

async function safeJson(req: NextRequest): Promise<WaitlistRequestBody | null> {
  try {
    return (await req.json()) as WaitlistRequestBody;
  } catch {
    return null;
  }
}

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
