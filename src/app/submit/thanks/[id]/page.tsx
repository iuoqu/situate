import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  moderationDecisions,
  principleJudgments,
  submissions,
  type PrincipleVerdict,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VERDICT_COLOR: Record<PrincipleVerdict, string> = {
  PASS: "#16a34a",
  FAIL: "#dc2626",
  UNCERTAIN: "#ca8a04",
};

// What the AI pre-screen actually concluded for this submission. Derived from
// the latest ai-layer moderation_decisions row + the submission's status, so
// we can show copy that matches what really happened (not just what the
// submission's status enum says).
type AiOutcome =
  | "passed"      // PASS_TO_EDITOR — AI batch approval, on to human review
  | "flagged"     // HUMAN_REVIEW — at least one UNCERTAIN or escalation flag
  | "declined"    // AUTO_REJECT — high-conf FAIL, returned to author
  | "unavailable" // AI editor failed (no API key, billing, 5xx) — sent direct to human
  | "pending"     // No AI decision row yet — editor still running or pre-AI status
  | "published";

interface OutcomeCopy {
  headline: string;
  lead: string;
}

const OUTCOME_COPY: Record<AiOutcome, OutcomeCopy> = {
  passed: {
    headline: "Your piece passed the AI pre-screen.",
    lead: "Every principle the AI editor evaluated came back with a high-confidence PASS. The piece is now in the human review queue — typically 7 days for the fast lane.",
  },
  flagged: {
    headline: "The AI editor flagged your piece for editorial attention.",
    lead: "At least one principle came back uncertain. A human editor reviews next; you'll hear back within 14 days.",
  },
  declined: {
    headline: "The AI editor declined your piece.",
    lead: "The AI editor's pre-screen surfaced a high-confidence concern against the constitution. The piece has been returned to draft — revise the issue cited below and you can resubmit.",
  },
  unavailable: {
    headline: "Your piece is in human review.",
    lead: "The AI pre-screen is temporarily unavailable, so your piece went straight to the human queue. You'll hear back within 14 days.",
  },
  pending: {
    headline: "The AI editor is still reading your piece.",
    lead: "Hold tight — refresh this page in a moment. If nothing appears, the AI pre-screen failed silently and your piece is already in the human queue.",
  },
  published: {
    headline: "Your piece has been published.",
    lead: "It's live. Thank you for trusting us with it.",
  },
};

export default async function ThanksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);
  if (!submission) notFound();

  // Latest ai-layer moderation decision — tells us which of the three v0
  // routing branches actually fired (or if the AI editor was unreachable).
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

  const outcome = deriveOutcome(submission.status, aiDecision);
  const { headline, lead } = OUTCOME_COPY[outcome];

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "72px 28px 120px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: "#999",
          textDecoration: "none",
        }}
      >
        ← Situate Editions
      </Link>

      <div style={{ marginTop: 32 }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#9b8a6b",
            marginBottom: 8,
          }}
        >
          Submission {id.slice(0, 8)}…
        </div>
        <h1
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 400,
            fontSize: 40,
            letterSpacing: -0.5,
            margin: 0,
          }}
        >
          {headline}
        </h1>
        <p
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 17,
            color: "#555",
            lineHeight: 1.6,
            marginTop: 14,
          }}
        >
          {lead}
        </p>
      </div>

      {submission.title && (
        <div
          style={{
            marginTop: 40,
            padding: 20,
            background: "#fafaf7",
            borderRadius: 4,
            border: "1px solid #e8e3d8",
          }}
        >
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: "#888",
              marginBottom: 4,
            }}
          >
            Your piece
          </div>
          <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 22 }}>
            {submission.title}
          </div>
          {submission.abstract && (
            <div
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontStyle: "italic",
                color: "#666",
                marginTop: 6,
                fontSize: 15,
              }}
            >
              {submission.abstract}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
            {submission.wordCount} words · {submission.sourceLanguage} ·{" "}
            {submission.storyType}
          </div>
        </div>
      )}

      <section style={{ marginTop: 48 }}>
        <h2
          style={{
            fontFamily: "system-ui",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#9b8a6b",
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          AI editor's per-principle read
        </h2>

        {judgments.length === 0 ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>
            {outcome === "unavailable"
              ? "The AI editor wasn't reached on this submission — there are no per-principle reads to show. A human editor takes it from here."
              : "No judgments recorded yet. Refresh in a moment if the AI editor is still running."}
          </p>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            {judgments.map((j) => (
              <li
                key={j.id}
                style={{
                  border: "1px solid #e8e3d8",
                  padding: 18,
                  borderRadius: 4,
                  background: "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        color: "#9b8a6b",
                      }}
                    >
                      {j.principleCode} · {j.principleVersion}
                    </span>
                    <span
                      style={{
                        marginLeft: 10,
                        padding: "2px 8px",
                        borderRadius: 3,
                        background: VERDICT_COLOR[j.verdict],
                        color: "white",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                      }}
                    >
                      {j.verdict}
                    </span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: "#888",
                      }}
                    >
                      confidence {Math.round(j.confidence * 100)}%
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: "#aaa" }}>{j.model}</span>
                </div>
                <p
                  style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: 15,
                    lineHeight: 1.55,
                    marginTop: 8,
                    marginBottom: 8,
                  }}
                >
                  {j.reasoning}
                </p>
                {j.keyQuote && (
                  <blockquote
                    style={{
                      borderLeft: "3px solid #c8c2b3",
                      paddingLeft: 12,
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontStyle: "italic",
                      color: "#555",
                      fontSize: 14,
                      margin: 0,
                    }}
                  >
                    “{j.keyQuote}”
                  </blockquote>
                )}
                {j.humanReviewNeeded && (
                  <div style={{ fontSize: 11, color: "#888", marginTop: 10 }}>
                    flagged for human review
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p
        style={{
          marginTop: 48,
          fontSize: 12,
          color: "#888",
          lineHeight: 1.6,
        }}
      >
        The AI editor is a pre-screen, not the publication decision. A human
        editor always makes the final call. Decisions reference the public{" "}
        <Link
          href="/about/constitution"
          style={{ color: "#666", textDecoration: "underline" }}
        >
          editorial constitution
        </Link>
        .
      </p>
    </main>
  );
}

function deriveOutcome(
  status: typeof submissions.$inferSelect["status"],
  aiDecision:
    | typeof moderationDecisions.$inferSelect
    | undefined,
): AiOutcome {
  if (status === "published") return "published";

  // No AI row yet — the editor hasn't finished, or never started.
  if (!aiDecision) return "pending";

  // Engine's "all checkers failed" path writes a rationale that starts with
  // this prefix; the submission lands in human_review with no judgments.
  if (aiDecision.rationale?.startsWith("AI editor unreachable")) {
    return "unavailable";
  }

  switch (aiDecision.decision) {
    case "reject":
      return "declined";
    case "approve":
      return "passed";
    case "request_changes":
    case "flag_for_legal":
      return "flagged";
    default:
      return "flagged";
  }
}
