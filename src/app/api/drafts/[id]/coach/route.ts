import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { coachingEvents, storyDrafts } from "@/db/schema";
import { getDiagnoser } from "@/lib/coach/diagnosers/registry";
import { getServerSupabase } from "@/lib/supabase/server";
import { getTradition } from "@/lib/traditions/registry";

/**
 * Coaching engine — B.5.
 *
 * GET  /api/drafts/[id]/coach
 *   Returns the latest surfaced + unacknowledged coaching event for
 *   this draft, so the UI can restore state across page loads.
 *
 * POST /api/drafts/[id]/coach
 *   Body: { text, sectionId? }
 *   Runs the tradition's enabled diagnosers against the prose text
 *   (default provider, no fanout), severity-ranks findings, logs all
 *   to coaching_events, and returns the single highest-leverage event.
 *
 * PATCH /api/drafts/[id]/coach
 *   Body: { eventId }
 *   Sets authorResponse="acknowledged" on the given coaching event.
 *
 * Auth: caller must own the draft.
 */

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// ── Verdict → (severity, observation, question) ───────────────────────────

interface VerdictTemplate {
  severity: number;
  observation: string;
  question: string;
}

const VERDICT_TEMPLATES: Record<string, VerdictTemplate> = {
  // stakes_absent
  K_absent: {
    severity: 9,
    observation:
      "这段散文里，没有任何意识承担着正在发生之事的分量——读起来像事件的记录，而不是有人在经历事件。",
    question:
      "这段里，有谁因这次事件有所得失？那个得失，在哪里被显示出来了？",
  },
  K_implicit: {
    severity: 5,
    observation:
      "这段里承担事件的那个意识是隐含的——存在，但没有被推到台前。",
    question:
      "有没有一个具体的时刻，可以让那个意识在文本里现身——通过一个细节、一个反应、或一句内心的感知？",
  },
  // causal_spine
  causal_absent: {
    severity: 7,
    observation:
      "这段事件之间的关系是“然后——然后——然后”，还没有形成“因为——所以”的骨架。",
    question:
      "这段里最重要的那个转变，为什么发生？它发生的那个特定理由，在文本里显示出来了吗？",
  },
  causal_implicit: {
    severity: 4,
    observation:
      "事件之间有因果痕迹，但联系是隐含的——读者需要自己推断为什么 A 导致了 B。",
    question:
      "让这次转变发生的那个特定原因，有没有可能在文本里更直接地显示出来？",
  },
  // place_arc
  place_arc_absent: {
    severity: 6,
    observation:
      "中心地点在这段里是静态的——它目击了事件，但它自己没有以任何方式被标记或改变。",
    question:
      "这个地点，在事件发生之后，与之前有什么不同？如果有，文本里有没有把那个差异显示出来？",
  },
  place_arc_implicit: {
    severity: 3,
    observation:
      "地点的变化痕迹是轻微的——可以感觉到它在参与，但弧光还不够清晰。",
    question:
      "这个地点最能与故事的核心转变共鸣的那个状态变化，在文本里有没有明确的一刻？",
  },
  // economy
  economy_absent: {
    severity: 5,
    observation:
      "这段里有些元素没有充分赚到它们的位置——读者的注意力被分散到不承担叙事重量的内容上。",
    question:
      "这段里，如果必须删去一整句话，哪一句话的消失对故事最无影响？",
  },
  economy_implicit: {
    severity: 3,
    observation:
      "整体是紧的，但有局部松弛——某些细节还没有完全赚到它们的位置。",
    question:
      "这段里有没有一个可以删去、而读者不会感到缺失的句子？",
  },
};

function extractVerdict(diagnoserId: string, result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null;
  const r = result as Record<string, unknown>;
  if (typeof r.verdict !== "string") return null;
  return r.verdict;
}

// ── Shared auth + draft lookup ────────────────────────────────────────────

async function getAuthedDraft(draftId: string) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, draft: null };

  const [draft] = await db
    .select({ id: storyDrafts.id, traditionProfileId: storyDrafts.traditionProfileId })
    .from(storyDrafts)
    .where(and(eq(storyDrafts.id, draftId), eq(storyDrafts.userId, user.id)))
    .limit(1);
  return { user, draft: draft ?? null };
}

function rowToFinding(row: typeof coachingEvents.$inferSelect): CoachFinding {
  return {
    diagnoser: row.diagnoser,
    scale: row.scale,
    severityScore: row.severityScore ?? 0,
    observation: row.observation ?? "",
    socraticQuestion: row.socraticQuestion ?? "",
    eventId: row.id,
  };
}

// ── GET ───────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: draftId } = await ctx.params;
  const { user, draft } = await getAuthedDraft(draftId);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [row] = await db
    .select()
    .from(coachingEvents)
    .where(
      and(
        eq(coachingEvents.draftId, draftId),
        eq(coachingEvents.surfacedToAuthor, true),
        isNull(coachingEvents.authorResponse),
      ),
    )
    .orderBy(desc(coachingEvents.createdAt))
    .limit(1);

  return NextResponse.json({ finding: row ? rowToFinding(row) : null });
}

// ── PATCH ─────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id: draftId } = await ctx.params;
  const { user, draft } = await getAuthedDraft(draftId);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.eventId !== "string" || !obj.eventId.trim())
    return NextResponse.json({ error: "eventId required" }, { status: 400 });

  await db
    .update(coachingEvents)
    .set({
      authorResponse: "acknowledged",
      authorRespondedAt: new Date(),
    })
    .where(
      and(
        eq(coachingEvents.id, obj.eventId),
        eq(coachingEvents.draftId, draftId),
      ),
    );

  return NextResponse.json({ ok: true });
}

// ── POST ──────────────────────────────────────────────────────────────────

interface PostBody {
  text: string;
  sectionId?: string;
}

function parseBody(raw: unknown): PostBody | string {
  if (typeof raw !== "object" || raw === null) return "body must be object";
  const obj = raw as Record<string, unknown>;
  if (typeof obj.text !== "string" || obj.text.trim().length < 50)
    return "text must be at least 50 characters";
  return {
    text: obj.text,
    sectionId: typeof obj.sectionId === "string" ? obj.sectionId : undefined,
  };
}

export interface CoachFinding {
  diagnoser: string;
  scale: string;
  severityScore: number;
  observation: string;
  socraticQuestion: string;
  eventId: string;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: draftId } = await ctx.params;
  const { user, draft } = await getAuthedDraft(draftId);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = parseBody(raw);
  if (typeof parsed === "string")
    return NextResponse.json({ error: parsed }, { status: 400 });

  const tradition = getTradition(draft.traditionProfileId ?? "flash_situate_anchored");
  const enabledDiagnoserIds = tradition?.diagnosers ?? [];
  if (enabledDiagnoserIds.length === 0) {
    return NextResponse.json({ finding: null, reason: "no_diagnosers" });
  }

  // Run all enabled diagnosers in parallel (default provider, no intent)
  const diagnoserRuns = enabledDiagnoserIds.map(async (id) => {
    const def = getDiagnoser(id);
    if (!def || def.requires_intent) return null;
    try {
      const callResult = await def.run(parsed.text) as { result: unknown };
      return { id, result: callResult.result };
    } catch {
      return null;
    }
  });
  const rawResults = await Promise.all(diagnoserRuns);

  // Map each result to a template (skip successes / no template)
  interface Finding {
    diagnoserId: string;
    verdict: string;
    template: VerdictTemplate;
    payload: unknown;
  }
  const findings: Finding[] = [];
  for (const r of rawResults) {
    if (!r) continue;
    const verdict = extractVerdict(r.id, r.result);
    if (!verdict) continue;
    const template = VERDICT_TEMPLATES[verdict];
    if (!template) continue;
    findings.push({ diagnoserId: r.id, verdict, template, payload: r.result });
  }

  // Sort by severity descending; pick winner
  findings.sort((a, b) => b.template.severity - a.template.severity);
  const traditionId = tradition?.id ?? "flash_situate_anchored";

  // Log all findings to coaching_events; surface only the winner
  const winnerId = findings.length > 0 ? findings[0].diagnoserId + ":" + findings[0].verdict : null;
  let surfacedEventId: string | null = null;
  let surfacedFinding: Finding | null = findings[0] ?? null;

  await Promise.all(
    findings.map(async (f) => {
      const isWinner = `${f.diagnoserId}:${f.verdict}` === winnerId;
      const [row] = await db
        .insert(coachingEvents)
        .values({
          draftId,
          sectionId: parsed.sectionId ?? null,
          traditionProfileId: traditionId,
          diagnoser: f.diagnoserId,
          scale: f.verdict,
          severityScore: f.template.severity,
          observation: f.template.observation,
          socraticQuestion: f.template.question,
          surfacedToAuthor: isWinner,
          payload: f.payload as object,
        })
        .returning({ id: coachingEvents.id });
      if (isWinner && row) surfacedEventId = row.id;
    }),
  );

  if (!surfacedFinding || !surfacedEventId) {
    return NextResponse.json({ finding: null, reason: "no_issues_detected" });
  }

  const response: CoachFinding = {
    diagnoser: surfacedFinding.diagnoserId,
    scale: surfacedFinding.verdict,
    severityScore: surfacedFinding.template.severity,
    observation: surfacedFinding.template.observation,
    socraticQuestion: surfacedFinding.template.question,
    eventId: surfacedEventId,
  };

  return NextResponse.json({ finding: response });
}
