import { and, asc, desc, eq, or } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import {
  blockTranslations,
  moderationDecisions,
  narrativeBlocks,
  principleJudgments,
  submissions,
  type PrincipleVerdict,
  type SubmissionStatus,
} from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = {
  title: "Submission · Situate Editions",
};

export const dynamic = "force-dynamic";

const VERDICT_COLOR: Record<PrincipleVerdict, string> = {
  PASS: "#16a34a",
  FAIL: "#dc2626",
  UNCERTAIN: "#ca8a04",
};

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: "Draft",
  ai_review: "AI editorial in progress",
  human_review: "Editor reviewing",
  revisions_requested: "Revisions requested",
  accepted_pending_publish: "Accepted · queued for publish",
  published: "Published",
  published_l1: "Published · Tier 1",
  published_l2: "Published · Tier 2",
  published_l3: "Published · Tier 3",
  withdrawn: "Withdrawn",
};

const STATUS_HELP: Record<SubmissionStatus, string> = {
  draft: "This submission hasn't been picked up yet.",
  ai_review:
    "The AI editor is reading your piece. This usually takes 20–60 seconds; reload to check.",
  human_review:
    "An editor is reading your piece. We'll email you when there's a decision.",
  revisions_requested:
    "The editor has asked for changes before the piece can publish. Check the report below for specifics.",
  accepted_pending_publish:
    "Accepted! It will appear in the next issue or on the open feed (depending on tier).",
  published: "Live on Situate.",
  published_l1:
    "Live on Situate · Tier 1 (open feed, anthology eligible).",
  published_l2:
    "Live on Situate · Tier 2 (anthology pick).",
  published_l3:
    "Live on Situate · Tier 3 (print + anthology + prize-eligible).",
  withdrawn:
    "You withdrew this submission. It's no longer in the editorial queue.",
};

type RouteParams = Promise<{ id: string }>;

export default async function SubmissionStatusPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/auth/login?reason=auth_required&next=${encodeURIComponent(
        `/my/submissions/${id}`,
      )}`,
    );
  }

  // Ownership check: author_user_id OR (legacy fallback) author_email
  // match. The OR exists for /submit-form submissions whose
  // author_user_id couldn't be backfilled by 0010 — same logic as the
  // /my dashboard listing.
  const userEmail = user.email ?? "";
  const [submission] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.id, id),
        or(
          eq(submissions.authorUserId, user.id),
          userEmail ? eq(submissions.authorEmail, userEmail) : undefined,
        ),
      ),
    )
    .limit(1);
  if (!submission) notFound();

  // Assembled prose: blocks in sequence, original translation per
  // block. Each block keeps its own coordinate (Slice 4 will surface
  // per-section pins) but for the status page we only show the prose.
  const blocks = await db
    .select({
      id: narrativeBlocks.id,
      sequenceNumber: narrativeBlocks.sequenceNumber,
      content: blockTranslations.content,
    })
    .from(narrativeBlocks)
    .leftJoin(
      blockTranslations,
      and(
        eq(blockTranslations.blockId, narrativeBlocks.id),
        eq(blockTranslations.method, "original"),
      ),
    )
    .where(eq(narrativeBlocks.submissionId, id))
    .orderBy(asc(narrativeBlocks.sequenceNumber));

  // Latest AI editor decision + per-principle judgments. We display
  // the same data as /submit/thanks/[id] but in the dashboard chrome
  // and with the withdrawal action attached.
  const [aiDecision] = await db
    .select()
    .from(moderationDecisions)
    .where(
      and(
        eq(moderationDecisions.submissionId, id),
        eq(moderationDecisions.layer, "ai"),
      ),
    )
    .orderBy(desc(moderationDecisions.createdAt))
    .limit(1);

  const judgments = await db
    .select()
    .from(principleJudgments)
    .where(eq(principleJudgments.submissionId, id))
    .orderBy(desc(principleJudgments.createdAt));

  const isTerminal =
    submission.status === "withdrawn" ||
    submission.status.startsWith("published");
  const canWithdraw = !isTerminal;

  return (
    <main style={mainStyle}>
      <Link href="/my" style={backLinkStyle}>
        ← All your writing
      </Link>

      <header style={{ marginTop: 18, marginBottom: 26 }}>
        <p style={kickerStyle}>Submission · {id.slice(0, 8)}…</p>
        <h1 style={h1Style}>{submission.title ?? "Untitled"}</h1>
        <p style={metaStyle}>
          {submission.wordCount ?? "?"} words ·{" "}
          {submission.sourceLanguage} · submitted{" "}
          {formatAgo(submission.createdAt)}
        </p>
      </header>

      <section style={statusBannerStyle(submission.status)}>
        <p style={statusLabelStyle}>{STATUS_LABEL[submission.status]}</p>
        <p style={statusHelpStyle}>{STATUS_HELP[submission.status]}</p>
        {canWithdraw && (
          <form
            action={`/api/submissions/${submission.id}/withdraw`}
            method="post"
            style={{ margin: 0, marginTop: 12 }}
          >
            <button type="submit" style={withdrawButtonStyle}>
              Withdraw submission
            </button>
          </form>
        )}
      </section>

      {blocks.length > 0 && (
        <section style={proseSectionStyle}>
          <h2 style={sectionHeadingStyle}>What you submitted</h2>
          <div style={proseBoxStyle}>
            {blocks.map((b) => (
              <div key={b.id} style={proseBlockStyle}>
                {(b.content ?? "").split(/\n+/).map((para, i) => (
                  <p key={i} style={proseParaStyle}>
                    {para}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={proseSectionStyle}>
        <h2 style={sectionHeadingStyle}>AI editor report</h2>
        {judgments.length === 0 ? (
          <p style={emptyStyle}>
            {submission.status === "ai_review"
              ? "AI editorial is still running. Reload in a minute."
              : "No AI report on file for this submission."}
          </p>
        ) : (
          <ol style={judgmentListStyle}>
            {judgments.map((j) => (
              <li key={j.id} style={judgmentItemStyle}>
                <div style={judgmentHeaderStyle}>
                  <span style={judgmentPrincipleStyle}>
                    {j.principleCode} · {j.principleVersion}
                  </span>
                  <span style={verdictBadgeStyle(j.verdict)}>{j.verdict}</span>
                  <span style={confidenceStyle}>
                    {Math.round(j.confidence * 100)}% confidence
                  </span>
                </div>
                <p style={reasoningStyle}>{j.reasoning}</p>
                {j.keyQuote && (
                  <blockquote style={quoteStyle}>“{j.keyQuote}”</blockquote>
                )}
              </li>
            ))}
          </ol>
        )}
        {aiDecision && (
          <p style={aiFooterStyle}>
            AI decision: <strong>{aiDecision.decision}</strong>.{" "}
            {aiDecision.rationale}
          </p>
        )}
      </section>

      <p style={footerLinkStyle}>
        Need to look at the original public-style status page?{" "}
        <Link
          href={`/submit/thanks/${submission.id}`}
          style={inlineLinkStyle}
        >
          Open the legacy view →
        </Link>
      </p>
    </main>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function formatAgo(ts: Date | null): string {
  if (!ts) return "never";
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── styles ────────────────────────────────────────────────────────────────

const mainStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "60px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 0.5,
  color: "#666",
  textDecoration: "none",
};
const kickerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
  margin: 0,
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 36,
  fontWeight: 400,
  letterSpacing: -0.6,
  margin: "10px 0 6px",
};
const metaStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#888",
};
const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: "system-ui",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 2,
  color: "#9b8a6b",
  fontWeight: 600,
  marginBottom: 16,
};

function statusBannerStyle(status: SubmissionStatus): React.CSSProperties {
  const palette =
    status === "withdrawn"
      ? { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" }
      : status === "revisions_requested"
        ? { bg: "#fef3c7", border: "#d97706", text: "#7c2d12" }
        : status.startsWith("published")
          ? { bg: "#dcfce7", border: "#16a34a", text: "#14532d" }
          : { bg: "#f0f9ff", border: "#0284c7", text: "#075985" };
  return {
    padding: 18,
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: 3,
    color: palette.text,
  };
}
const statusLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: 0.3,
};
const statusHelpStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 13,
  lineHeight: 1.55,
};
const withdrawButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "white",
  color: "#7f1d1d",
  border: "1px solid #fca5a5",
  borderRadius: 3,
  fontSize: 12,
  letterSpacing: 0.3,
  cursor: "pointer",
  fontFamily: "inherit",
};

const proseSectionStyle: React.CSSProperties = {
  marginTop: 36,
};
const proseBoxStyle: React.CSSProperties = {
  padding: 24,
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  display: "flex",
  flexDirection: "column",
  gap: 18,
};
const proseBlockStyle: React.CSSProperties = {
  paddingBottom: 12,
  borderBottom: "1px dashed #f0ebde",
};
const proseParaStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16,
  lineHeight: 1.7,
  color: "#1a1a1a",
};
const emptyStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#888",
  fontStyle: "italic",
};
const judgmentListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const judgmentItemStyle: React.CSSProperties = {
  padding: 16,
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 4,
};
const judgmentHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "baseline",
  marginBottom: 8,
};
const judgmentPrincipleStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 2,
  color: "#9b8a6b",
};
function verdictBadgeStyle(v: PrincipleVerdict): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 3,
    background: VERDICT_COLOR[v],
    color: "white",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
  };
}
const confidenceStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
};
const reasoningStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 14,
  lineHeight: 1.6,
  margin: "6px 0 8px",
};
const quoteStyle: React.CSSProperties = {
  borderLeft: "3px solid #c8c2b3",
  paddingLeft: 12,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontStyle: "italic",
  color: "#555",
  fontSize: 13,
  margin: 0,
};
const aiFooterStyle: React.CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  color: "#888",
  lineHeight: 1.5,
};
const footerLinkStyle: React.CSSProperties = {
  marginTop: 36,
  fontSize: 12,
  color: "#888",
  lineHeight: 1.5,
};
const inlineLinkStyle: React.CSSProperties = {
  color: "#666",
  textDecoration: "underline",
};
