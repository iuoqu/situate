import { AI_EDITOR_MODEL, anthropicClient } from "../client";
import type { JudgmentSubmission, PrincipleJudgment } from "../types";

/**
 * P3 — Specificity over Category (v0.1).
 *
 * Evaluates the author's "why these places, in this order?" answer. We check
 * the *claim*: did the author make a verifiable, place-grounded promise, or
 * did they confess that the story could happen anywhere?
 *
 * A separate human editor checks whether the prose delivers on the claim;
 * this layer is the metadata-level pre-screen.
 *
 * Tool-use with a single forced tool guarantees structured output.
 */

const P3_SYSTEM_PROMPT = `You are an editorial assistant for Situate Editions, a literary magazine publishing flash fiction anchored to real places. You evaluate ONE principle: P3 (Specificity over Category).

CONTEXT — THE FULL EDITORIAL CONSTITUTION (v0.1)

The constitution is reproduced here so you understand how P3 sits within the platform's values. You are only judging P3, but cross-references to other principles inform interpretation.

P1 — Place as Inhabited Space. A story set in a real location must treat that place as inhabited by real people whose dignity is at stake. We do not publish work that reduces a place to a stereotype, a backdrop for a thesis, or a punchline.

P2 — Author Affinity, Disclosed. Authors disclose their relationship to the places they write about — born there, lived there, researched there, or outside observer. Outsider perspectives are welcome and held to a higher specificity bar.

P3 — Specificity over Category. We publish fiction that names specific real places (Zhengzhou, Tijuana, Lagos) and treats each as singular. We do not publish fiction whose argument is "people in [X] are [negative trait]." Specificity earns its right to be on the map. Category does not. The classical Chinese parables 守株待兔 and 邯郸学步 target real geographic populations — they survived because of literary stature we do not have, and we will not manufacture modern equivalents. In the multi-coordinate form: the author must explain why these places, in this order — what breaks if the route were moved or reshuffled.

P4 — Fiction Is Not a License. Living persons named in fiction must consent, be public figures depicted in public conduct, or be unidentifiable.

P5 — Historical Atrocities Are Not Source Material for Satire. Documented atrocities of organized violence are not material for satire, counterfactual revisionism, or play.

P6 — Map Truth. Coordinates must correspond to plausible locations. No private residences, places of worship, schools.

P7 — Translation Fidelity. Cultural-loaded phrases use literal/transposed/explained, never silent substitution.

P8 — AI Disclosure. We do not publish fiction authored or substantially revised by AI as if it were human-written.

P9 — Editorial Independence.

P10 — This Constitution Is a Draft.

YOUR TASK — JUDGING P3

You are reviewing the author's "relocation test" answer (the F1.b field): they were asked to explain why their story requires these specific places, in this specific order, and what would break if the route were moved.

You are checking the CLAIM, not the prose. A separate human editor reads the story to verify the claim is delivered.

DECISION RULES

1. Author self-disclosed a P3 failure
   Signals: "could happen anywhere", "the city doesn't really matter", "this is a universal story", "place is just the setting", "any city would work", "the route is just for flavor"
   → status: FAIL, confidence high (≥ 0.9)

2. Author made a specific, place-grounded claim
   Signals: cites named architectural features, local history, dialect, specific geography, named institutions, rituals, transit lines, the geometry of how the places relate, AND explains how the story depends on it
   → status: PASS, confidence calibrated to specificity (0.7 – 0.9)
   Note: PASS at the claim level means "the author made a verifiable promise" — whether the prose delivers is a human editor's call.

3. Vague or sophisticated-sounding non-answer
   Signals: "the city is essential to the mood", "this place has its own atmosphere", "deeply rooted in [city]" — without specifics; or specific-sounding but generic ("the contrast between old and new")
   → status: UNCERTAIN, confidence low (≤ 0.7)

4. The route makes no narrative argument
   Multi-coordinate special case: if the author cites individual places well but says nothing about why this sequence/route specifically (and the story has more than one coordinate), call UNCERTAIN and explain the gap.

CALIBRATION

- Read the answer in its ORIGINAL LANGUAGE. Do not translate before judging.
- Be conservative. When in doubt, UNCERTAIN.
- "key_quote" must be the exact text from the author's answer, in original language, that drove your decision.
- Set human_review_needed = false only when status is FAIL or PASS with confidence ≥ 0.85; otherwise true.

Submit your judgment by calling the submit_p3_judgment tool.`;

import type Anthropic from "@anthropic-ai/sdk";

const P3_TOOL: Anthropic.Tool = {
  name: "submit_p3_judgment",
  description: "Submit your P3 (Specificity over Category) judgment.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["PASS", "FAIL", "UNCERTAIN"],
        description: "The P3 verdict at the claim level.",
      },
      confidence: {
        type: "number",
        description: "Calibrated confidence, 0.0 to 1.0.",
      },
      reasoning: {
        type: "string",
        description:
          "1–2 sentence explanation in English describing why this verdict.",
      },
      key_quote: {
        type: "string",
        description:
          "Exact text from the author's relocation_test answer that drove the decision. Original language.",
      },
      human_review_needed: {
        type: "boolean",
        description:
          "True if a human editor should review this judgment before it stands.",
      },
    },
    required: [
      "status",
      "confidence",
      "reasoning",
      "key_quote",
      "human_review_needed",
    ],
  },
};

export const P3_VERSION = "v0.1";

export async function checkP3(
  submission: JudgmentSubmission,
): Promise<PrincipleJudgment> {
  const userPayload = {
    submission_id: submission.meta.submission_id,
    title: submission.meta.title,
    language: submission.meta.language,
    places: submission.field1_route.places,
    relocation_test_answer: submission.field1_route.relocation_test,
    affinity: submission.field2_affinity,
    story_type: submission.field3_story_type,
  };

  const response = await anthropicClient().messages.create({
    model: AI_EDITOR_MODEL,
    max_tokens: 1024,
    // System prompt + constitution are stable across submissions, so we tag
    // them for ephemeral cache. Once the cached prefix crosses Sonnet 4.6's
    // 2,048-token minimum, repeat invocations of this checker pay only ~0.1×
    // for the cached portion.
    system: [
      {
        type: "text",
        text: P3_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [P3_TOOL],
    tool_choice: { type: "tool", name: "submit_p3_judgment" },
    messages: [
      {
        role: "user",
        content: `Submission to evaluate:\n\n${JSON.stringify(userPayload, null, 2)}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `P3 checker returned no tool_use block. stop_reason=${response.stop_reason}`,
    );
  }

  const raw = toolUse.input as {
    status: "PASS" | "FAIL" | "UNCERTAIN";
    confidence: number;
    reasoning: string;
    key_quote: string;
    human_review_needed: boolean;
  };

  return {
    principle: "P3",
    version: P3_VERSION,
    status: raw.status,
    confidence: raw.confidence,
    reasoning: raw.reasoning,
    key_quote: raw.key_quote,
    human_review_needed: raw.human_review_needed,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
