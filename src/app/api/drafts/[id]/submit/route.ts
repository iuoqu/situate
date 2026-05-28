import { NextResponse, type NextRequest } from "next/server";

import { submitFromDraft } from "@/app/actions";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/drafts/[id]/submit
 *
 * Hands the draft off to the editorial pipeline:
 *   1. Authenticate the caller.
 *   2. Validate the form body (coordinate + relocation test + attestation).
 *   3. Delegate the transaction to `submitFromDraft` (in actions.ts) —
 *      that's where the shared edit-vs-template prose-validation rules
 *      live (word count, relocation-test minimum, etc).
 *   4. Return `{submissionId}` so the client can redirect to
 *      `/submit/thanks/[id]` (the existing thank-you page).
 *
 * The AI editor runs inside `submitFromDraft` after the DB transaction
 * commits. We accept the latency (an Anthropic round-trip) here rather
 * than returning early — the existing /submit form does the same and
 * the editorial flow expects a finished AI pass before exposing the
 * submission to human editors.
 */

export const runtime = "nodejs";
export const maxDuration = 60; // AI review may take 20–40s.

type RouteCtx = { params: Promise<{ id: string }> };

interface Body {
  longitude?: unknown;
  latitude?: unknown;
  relocationTest?: unknown;
  legalAttestation?: unknown;
  authorPenName?: unknown;
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "auth user has no email — cannot submit" },
      { status: 400 },
    );
  }

  const body = (await safeJson(req)) as Body | null;
  if (!body) {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }

  const lon = numberOrNaN(body.longitude);
  const lat = numberOrNaN(body.latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return NextResponse.json(
      { error: "longitude and latitude are required" },
      { status: 400 },
    );
  }

  const relocationTest =
    typeof body.relocationTest === "string" ? body.relocationTest.trim() : "";
  if (relocationTest.length === 0) {
    return NextResponse.json(
      { error: "relocationTest is required" },
      { status: 400 },
    );
  }

  const legalAttestation = body.legalAttestation === true;
  if (!legalAttestation) {
    return NextResponse.json(
      { error: "legal attestation must be accepted" },
      { status: 400 },
    );
  }

  // Pen name defaults to the email local part. Authors can change it
  // later from their account; for Slice 1 we don't surface a pen-name
  // editor.
  const authorPenName =
    typeof body.authorPenName === "string" && body.authorPenName.trim().length > 0
      ? body.authorPenName.trim().slice(0, 80)
      : user.email.split("@")[0];

  try {
    const result = await submitFromDraft({
      draftId: id,
      userId: user.id,
      authorEmail: user.email,
      authorPenName,
      longitude: lon,
      latitude: lat,
      relocationTest,
      legalAttestation,
    });
    return NextResponse.json({
      submissionId: result.submissionId,
      status: result.status,
      redirectTo: `/submit/thanks/${result.submissionId}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "submit failed";
    // The action's error messages are user-facing and stable. Mapping
    // them to a 400 is fine — none of the failure modes are server bugs
    // (ownership / word-count / attestation / coords).
    const status = message === "draft not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function numberOrNaN(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

async function safeJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
