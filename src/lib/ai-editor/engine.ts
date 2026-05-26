import { checkP3 } from "./principles/p3";
import {
  evaluateEngagementScore,
  type EditorialPriorityReport,
} from "./triage/engagement-score";
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

// ─── Per-principle routing overrides (constitution v0.2) ────────────────────
//
// The default routing rules (any high-confidence FAIL → AUTO_REJECT;
// any UNCERTAIN or human_review_needed → HUMAN_REVIEW) work for most
// principles, but v0.2 calls out a few special cases that must override
// the default. These are the principles whose nature makes machine
// auto-rejection inappropriate.
type PrincipleRoutingPolicy = {
  // If true, a FAIL on this principle never triggers AUTO_REJECT. The
  // judgment is instead routed to a human editor.
  neverAutoReject: boolean;
  // If true, ANY judgment on this principle (including PASS) forces
  // HUMAN_REVIEW. Used for P7 where gaze cannot be machine-judged.
  alwaysHumanReview: boolean;
};

const PRINCIPLE_ROUTING: Record<string, PrincipleRoutingPolicy> = {
  // P1 (Place as Inhabited Space) — v0.2 demotes machine-driven rejection.
  // Stories with zero on-page humans can still inhabit a place
  // (post-apocalyptic, nature-meditative); only a human can read the gaze.
  P1: { neverAutoReject: true, alwaysHumanReview: false },

  // P7 (The Gaze, Not the Topic) — pure literary judgment. AI can flag
  // surface density of explicit content, but cannot judge gaze.
  P7: { neverAutoReject: true, alwaysHumanReview: true },

  // P10 (AI Disclosure) — v0.2 explicitly forbids auto-decline on
  // statistical AI-detection alone. Classifiers carry documented bias
  // against non-native English writing (Stanford, 2023) and minoritised
  // registers. A human always reads before any decline is issued.
  P10: { neverAutoReject: true, alwaysHumanReview: false },
};

function policyFor(principleCode: string): PrincipleRoutingPolicy {
  return (
    PRINCIPLE_ROUTING[principleCode] ?? {
      neverAutoReject: false,
      alwaysHumanReview: false,
    }
  );
}

export async function evaluateSubmission(
  submission: JudgmentSubmission,
): Promise<SubmissionReport> {
  // Parallel execution of every principle checker AND the editor-side
  // triage. The triage is on a separate track — its failure never affects
  // routing, and its score never gates anything; it's pure editor-queue
  // priority signal. See docs/ai-editor-triage-rationale.md.
  const [settled, triageResult] = await Promise.all([
    Promise.allSettled(CHECKERS.map((fn) => fn(submission))),
    evaluateEngagementScore(submission).then(
      (r) => ({ ok: true as const, value: r }),
      (e) => ({ ok: false as const, error: e }),
    ),
  ]);

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

  const triage: EditorialPriorityReport | null = triageResult.ok
    ? triageResult.value
    : null;

  if (failures.length > 0) {
    // Any checker failure forces human review — the agreed "API down" fallback.
    return {
      submission_id: submission.meta.submission_id,
      judgments,
      triage,
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
    triage,
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

  // Per v0.2: principles in `alwaysHumanReview` (currently P7) take
  // precedence over the AUTO_REJECT path. Any judgment on these
  // principles — pass, fail, or uncertain — routes to a human editor.
  const alwaysHuman = judgments.filter(
    (j) => policyFor(j.principle).alwaysHumanReview,
  );
  if (alwaysHuman.length > 0) {
    return {
      decision: "HUMAN_REVIEW",
      reason: `${alwaysHuman
        .map((j) => j.principle)
        .join(", ")} require human editorial judgment by policy`,
    };
  }

  const hardFails = judgments.filter(
    (j) =>
      j.status === "FAIL" &&
      j.confidence >= HIGH_CONFIDENCE_THRESHOLD &&
      !policyFor(j.principle).neverAutoReject,
  );
  if (hardFails.length > 0) {
    return {
      decision: "AUTO_REJECT",
      reason: `High-confidence FAIL on ${hardFails
        .map((j) => j.principle)
        .join(", ")}`,
    };
  }

  // FAILs on principles in `neverAutoReject` (P1, P7, P10) are surfaced as
  // human-review work rather than auto-rejection.
  const policyProtectedFails = judgments.filter(
    (j) => j.status === "FAIL" && policyFor(j.principle).neverAutoReject,
  );

  const needsHuman = judgments.filter(
    (j) => j.status === "UNCERTAIN" || j.human_review_needed,
  );
  if (needsHuman.length > 0 || policyProtectedFails.length > 0) {
    const names = [
      ...needsHuman.map((j) => j.principle),
      ...policyProtectedFails.map((j) => `${j.principle} (policy-protected FAIL)`),
    ];
    return {
      decision: "HUMAN_REVIEW",
      reason: `Human review required on ${names.join(", ")}`,
    };
  }

  return {
    decision: "PASS_TO_EDITOR",
    reason: "All checked principles PASS with high confidence",
  };
}
