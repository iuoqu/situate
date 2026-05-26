import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  moderationDecisions,
  principleJudgments,
  submissions,
  type PrincipleVerdict,
} from "@/db/schema";
import { LangSwitch } from "@/components/lang-switch";
import { t, type MessageKey } from "@/lib/i18n";
import { getReaderPrefs } from "@/lib/reader-prefs";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VERDICT_COLOR: Record<PrincipleVerdict, string> = {
  PASS: "#16a34a",
  FAIL: "#dc2626",
  UNCERTAIN: "#ca8a04",
};

type AiOutcome =
  | "passed"
  | "flagged"
  | "declined"
  | "unavailable"
  | "pending"
  | "published";

const OUTCOME_HEADLINE_KEY: Record<AiOutcome, MessageKey> = {
  passed: "thanks.headline_passed",
  flagged: "thanks.headline_flagged",
  declined: "thanks.headline_declined",
  unavailable: "thanks.headline_unavailable",
  pending: "thanks.headline_pending",
  published: "thanks.headline_published",
};

const OUTCOME_LEAD_KEY: Record<AiOutcome, MessageKey> = {
  passed: "thanks.lead_passed",
  flagged: "thanks.lead_flagged",
  declined: "thanks.lead_declined",
  unavailable: "thanks.lead_unavailable",
  pending: "thanks.lead_pending",
  published: "thanks.lead_published",
};

type Search = Promise<{ lang?: string }>;

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Search;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { language: locale } = await getReaderPrefs({ langParam: sp.lang });

  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);
  if (!submission) notFound();

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
  const headline = t(locale, OUTCOME_HEADLINE_KEY[outcome]);
  const lead = t(locale, OUTCOME_LEAD_KEY[outcome]);

  // Footer's constitution link sentence — replace the {constitution_link}
  // placeholder with a real anchor.
  const footerTemplate = t(locale, "thanks.footer");
  const constitutionLinkText = t(locale, "common.constitution_link");
  const footerParts = footerTemplate.split("{constitution_link}");

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "72px 28px 120px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <LangSwitch current={locale} />

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
        {t(locale, "common.back_to_situate")}
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
          {t(locale, "common.submission_id_prefix")} {id.slice(0, 8)}…
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
            {t(locale, "thanks.your_piece_label")}
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
            {t(locale, "thanks.piece_meta", {
              words: submission.wordCount ?? "?",
              language: submission.sourceLanguage,
              story_type: submission.storyType ?? "fiction",
            })}
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
          {t(locale, "thanks.section_per_principle")}
        </h2>

        {judgments.length === 0 ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>
            {outcome === "unavailable"
              ? t(locale, "thanks.empty_unavailable")
              : t(locale, "thanks.empty_pending")}
          </p>
        ) : (
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
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
                      style={{ marginLeft: 8, fontSize: 11, color: "#888" }}
                    >
                      {t(locale, "thanks.confidence_label", {
                        percent: Math.round(j.confidence * 100),
                      })}
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
                    {t(locale, "thanks.flagged_for_human")}
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
        {footerParts[0]}
        <Link
          href="/about/constitution"
          style={{ color: "#666", textDecoration: "underline" }}
        >
          {constitutionLinkText}
        </Link>
        {footerParts[1]}
      </p>
    </main>
  );
}

function deriveOutcome(
  status: typeof submissions.$inferSelect["status"],
  aiDecision: typeof moderationDecisions.$inferSelect | undefined,
): AiOutcome {
  if (status === "published") return "published";
  if (!aiDecision) return "pending";
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
