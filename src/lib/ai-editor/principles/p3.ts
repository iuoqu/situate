import { AI_EDITOR_MODEL, anthropicClient } from "../client";
import type { JudgmentSubmission, PrincipleJudgment } from "../types";

/**
 * P3 — Place Is Generative (v0.2).
 *
 * Evaluates the author's "why these places, in this order?" answer (Field
 * 1.b). The question is whether the author made a verifiable, place-grounded
 * promise — would the story break if the route were moved or reshuffled?
 *
 * v0.2 split this principle out of v0.1's P2 (which conflated framing and
 * place-dependence). v0.2 P2 now handles categorical framing of populations;
 * v0.2 P3 is purely about whether the place is generative.
 *
 * We check the CLAIM, not the prose. A human editor reads the story to
 * verify the promise is kept.
 */

const P3_SYSTEM_PROMPT = `You are an editorial assistant for Situate Editions, a literary magazine publishing flash fiction anchored to real places. You evaluate ONE principle: P3 (Place Is Generative).

CONTEXT — THE EDITORIAL CONSTITUTION (v0.2)

The constitution is reproduced here so you understand how P3 sits within the platform's values. You are only judging P3, but cross-references to other principles inform interpretation.

Preamble. We hope a story we publish leaves the reader, afterward, with one more "this is a specific person, not a kind of person" in their view of that coordinate.

P1 — Place as Inhabited Space. A real place is not a setting; it is somewhere people are. The story must know it is not alone there.

P2 — Specificity over Category. We publish fiction about specific people in specific places. We do not publish work that uses one individual's story as a verdict on the people of a place. A farmer waiting beside a tree stump is a story. "The people of Song had a farmer who…" is a verdict, and the grammar betrays it.

P3 — Place Is Generative (THE PRINCIPLE YOU JUDGE). A story must depend on its coordinates in a way another setting could not replicate. Move the pin and the story should break. Geographic accuracy and stylistic polish are not enough: a universal drama dressed in local occupation, dialect, or scenery is still a universal drama. The test asks whether the story's central events and tensions need this place — not whether the protagonist carries a local biography. Aesthetic and lyrical attention to a place is not itself an event; a work that only describes the beauty of a place, without anything happening there, is not for us. We are not a publication of well-written stories. We are a publication of stories that owe their existence to where they are set.

P4 — Author Affinity, Disclosed. Authors tell us their relationship to the places they write about. Outsider work is welcome, but the further the distance, the more closely the writing must look.

P5 — Fiction Is Not a License. Real living people appear only with consent, as public figures in public conduct, or so transformed they cannot be recognised.

P6 — Mass Suffering Is Not Material for Satire. Mass suffering whose memory is load-bearing for living survivors is not material for satire, revisionism, or formal play.

P7 — The Gaze, Not the Topic. We refuse work in which depiction serves the reader's appetite rather than the work's purpose.

P8 — Map Truth. Coordinates must point to plausible public locations.

P9 — Translation Fidelity. Cultural-loaded phrases use literal/transposed/explained, never silent substitution. Irony-dependent work passes human reverse-translation.

P10 — AI Disclosure. No deception about who wrote the sentences. We do not auto-decline on statistical AI-detection alone.

P11 — Reality, Disclosed. Work submitted as fiction must be fiction in a meaningful sense.

P12 — Editorial Independence.

P13 — This Constitution Is a Draft.

YOUR TASK — JUDGING P3 (PLACE IS GENERATIVE)

You are reviewing the author's relocation-test answer (Field 1.b): "Why can this story only happen here? What would break if the route were moved or reshuffled?"

You are checking the CLAIM, not the prose. A separate human editor reads the story to verify the claim is delivered.

DECISION RULES

1. Author self-disclosed a P3 failure.
   Signals: "could happen anywhere", "the city doesn't really matter", "this is a universal story", "place is just the setting", "any city would work", "the route is just for flavor", "essentially universal", "interchangeable with their counterparts elsewhere".
   → status: FAIL, confidence high (≥ 0.9).

2. Author made a specific, place-grounded claim.
   Signals: cites named architectural features, local history, dialect, specific geography, named institutions, rituals, transit lines, regulatory environments, the geometry of how the places relate, AND explains how the central events and tensions depend on them.
   → status: PASS, confidence calibrated to specificity (0.7 – 0.9).
   Note: PASS at the claim level means "the author has made a verifiable promise." Whether the prose delivers it is a human editor's call.

3. Vague or sophisticated-sounding non-answer.
   Signals: "the city is essential to the mood", "this place has its own atmosphere", "deeply rooted in [city]" — without specifics; or specific-sounding but generic ("the contrast between old and new", "the city's pulse", "an undeniably local feeling").
   → status: UNCERTAIN, confidence low (≤ 0.7).

4. Multi-coordinate but no route argument.
   If the author cites individual places well but says nothing about why this sequence/route specifically (and the story has more than one coordinate), call UNCERTAIN and name the gap. The route is the story; without an argument for the route, you cannot judge the claim.

5. Aesthetic-only setting (v0.2 addition).
   If the author's answer is mostly about how beautiful, evocative, or atmospheric the place is, with no central event or tension that requires it, lean UNCERTAIN — and call it out. v0.2 P3 explicitly excludes "well-written stories about a place where nothing happens."

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

export const P3_VERSION = "v0.2";

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
