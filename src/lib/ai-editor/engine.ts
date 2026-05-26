import { checkP3 } from "./principles/p3";
import type {
  JudgmentSubmission,
  PrincipleJudgment,
  RoutingDecision,
  SubmissionReport,
} from "./types";

/**
 * Runs every enabled principle checker in parallel and aggregates into a
 * routing decision. v0 architecture: each principle is its own API call so
 * one checker's reasoning never contaminates another's.
 *
 * Adding a principle is one line — add the function to `checkers` and
 * write src/lib/ai-editor/principles/p<N>.ts following P3 as a template.
 *
 * Routing rules (deliberately simple):
 *   - Any FAIL with confidence ≥ 0.85          → AUTO_REJECT
 *   - Any UNCERTAIN or human_review_needed     → HUMAN_REVIEW
 *   - All PASS with high confidence            → PASS_TO_EDITOR
 *
 * Note: "PASS_TO_EDITOR" never means "auto-publish." A human editor still
 * makes the final call — this is the fast lane, not a bypass.
 */

type Checker = (submission: JudgmentSubmission) => Promise<PrincipleJudgment>;

const CHECKERS: Checker[] = [
  checkP3,
  // checkP4, checkP5, checkP8 ... — add here as principles are wired
];

const HIGH_CONFIDENCE_THRESHOLD = 0.85;

export async function evaluateSubmission(
  submission: JudgmentSubmission,
): Promise<SubmissionReport> {
  // Parallel execution. If one principle's API call fails, we surface the
  // failure rather than silently dropping it — the caller decides whether
  // to retry or escalate to human review.
  const settled = await Promise.allSettled(
    CHECKERS.map((fn) => fn(submission)),
  );

  const judgments: PrincipleJudgment[] = [];
  const failures: { principle: string; error: unknown }[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      judgments.push(result.value);
    } else {
      // We don't know which checker failed without metadata; tag positionally.
      failures.push({
        principle: `position_${i}`,
        error: result.reason,
      });
    }
  }

  if (failures.length > 0) {
    // Any checker failure forces human review — the agreed "API down" fallback.
    return {
      submission_id: submission.meta.submission_id,
      judgments,
      routing: "HUMAN_REVIEW",
      routing_reason: `AI editor unreachable for ${failures.length} principle(s); routing to human queue. First error: ${
        failures[0].error instanceof Error
          ? failures[0].error.message
          : String(failures[0].error)
      }`,
      cited_principles: judgments.map(
        (j) => `${j.principle}:${j.version}`,
      ),
    };
  }

  const routing = decideRouting(judgments);

  return {
    submission_id: submission.meta.submission_id,
    judgments,
    routing: routing.decision,
    routing_reason: routing.reason,
    cited_principles: judgments
      .filter((j) => j.status !== "PASS")
      .map((j) => `${j.principle}:${j.version}`),
  };
}

function decideRouting(judgments: PrincipleJudgment[]): {
  decision: RoutingDecision;
  reason: string;
} {
  if (judgments.length === 0) {
    return {
      decision: "HUMAN_REVIEW",
      reason: "No principle checkers ran — routing to human queue.",
    };
  }

  const hardFails = judgments.filter(
    (j) => j.status === "FAIL" && j.confidence >= HIGH_CONFIDENCE_THRESHOLD,
  );
  if (hardFails.length > 0) {
    return {
      decision: "AUTO_REJECT",
      reason: `High-confidence FAIL on ${hardFails
        .map((j) => j.principle)
        .join(", ")}`,
    };
  }

  const needsHuman = judgments.filter(
    (j) => j.status === "UNCERTAIN" || j.human_review_needed,
  );
  if (needsHuman.length > 0) {
    return {
      decision: "HUMAN_REVIEW",
      reason: `Human review required on ${needsHuman
        .map((j) => j.principle)
        .join(", ")}`,
    };
  }

  return {
    decision: "PASS_TO_EDITOR",
    reason: "All checked principles PASS with high confidence",
  };
}
