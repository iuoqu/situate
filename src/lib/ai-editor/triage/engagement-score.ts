import type Anthropic from "@anthropic-ai/sdk";

import { AI_EDITOR_MODEL, anthropicClient } from "../client";
import type { JudgmentSubmission } from "../types";

/**
 * Editor-side engagement triage. NOT a literary quality judgment.
 *
 * Outputs a 0-100 priority score used to sort the editorial review queue,
 * plus rationale, per-signal craft assessments, strengths/concerns, and an
 * explicit uncertainty + bias self-check.
 *
 * Guard rails (constitution v0.2 + docs/ai-editor-triage-rationale.md):
 *
 *   - This score is NEVER shown to authors.
 *   - This score is NEVER used as a routing gate. It only sorts the queue.
 *   - The model is required to surface uncertainties and known bias risks
 *     in its own output.
 *   - We audit the score distribution against author affinity and source
 *     language monthly; persistent skew triggers prompt revision.
 *
 * Architecture decision: single API call with structured multi-lens output,
 * not multi-agent. Different role-played personas inside the same base
 * model share the same training biases — the "diversity" is illusory and
 * costs N× per submission. See the rationale doc for when to upgrade.
 */

const SYSTEM_PROMPT = `You are an editorial triage assistant for Situate Editions, a literary magazine that publishes flash fiction (800–2,500 words) anchored to real geographic places. Your output is read by human editors only — never by authors — and used to sort the review queue, NEVER to gate submissions.

YOUR ROLE

You score how much editorial attention this submission warrants. High score = read this early; low score = read this later, but still read it. You are NOT judging literary quality, you are NOT predicting "will this win awards," and you are NOT recommending publication. A human editor makes every final decision after reading the full text.

The signal you produce is one input among many. Editors are explicitly trained to read low-scoring pieces with extra attention — especially when the author's affinity is "born_there" or "lived_there" for a non-English context, when the source language is not English, or when the form is experimental, vernacular, or non-Western. Your score is most reliable for English-original conventional short fiction; least reliable everywhere else.

WHAT YOU EVALUATE

Six craft signals, each rated strong / moderate / weak with a one-sentence note:

  1. opening_hook       — Does the first paragraph compel a busy editor to read the second?
  2. voice              — Is there a clear, consistent narrating consciousness? Does the prose have a point of view, not just a procedure?
  3. imagery            — Is the world specific and sensorily present, or built from received phrases and abstract gestures?
  4. stakes             — Is something at stake for someone, and is the reader given enough to care about the outcome?
  5. pacing             — Does the story have movement? Does it earn its length? Does it sit too long in any one beat?
  6. sentence_rhythm    — Are the sentences varied in length and structure? Or is there a single rhythm you can predict three sentences ahead?

From the six signals plus your overall read, choose a score 0–100:

   0–25  Significantly under-developed; major craft issues throughout
  26–50  Developing; competent in places, weak in others
  51–70  Solid; readable, executed, in command of the basics
  71–85  Strong; distinct, controlled, makes good use of its length
  86–100 Exceptional; the kind of piece an editor will want to publish

Use the full range. A score of 65 is fine, common, and meaningful — don't bunch everything between 70 and 80.

WHAT YOU MUST SURFACE (NOT OPTIONAL)

- **rationale**: Two sentences explaining the score holistically. Address the strongest signal and the weakest signal explicitly.
- **strengths**: 2-3 specific observations about what the piece does well. Quote or paraphrase concrete details from the text.
- **concerns**: 2-3 specific observations about what undermines the piece. Be concrete; "the prose is uneven" is not useful, "the second paragraph downshifts into summary" is.
- **uncertainties**: Things you noticed but cannot judge confidently. Examples: "This piece may be deploying a tradition (Chinese miniaturism / Japanese zuihitsu / Latin American microrelato / etc.) my training data underrepresents." "The ironic register here may be sharper in the source language than my read of the translation suggests." "I can't tell if the abrupt ending is a craft choice or a length cap." Be candid. If you're confident, say none — but be honest.
- **bias_self_check**: One sentence explicitly noting how your own training data might be misjudging THIS submission. Examples: "The piece appears to be a Chinese intermissionist short; my training underrepresents this form and I likely under-scored sentence_rhythm." "Author affinity is 'never_been' to Lagos; I have no signal on whether the imagery is true to place — defer to the human reviewer on local accuracy." If the piece is conventional English-original short fiction, say so: "Standard register for which my evaluation should be relatively reliable."

OUTPUT VIA THE submit_engagement_score TOOL. Do not free-text.`;

const TRIAGE_TOOL: Anthropic.Tool = {
  name: "submit_engagement_score",
  description:
    "Submit a 0-100 editor-side triage score with structured craft signals, strengths, concerns, uncertainties, and explicit bias self-check.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        description: "Priority score, 0 to 100. Use the full range.",
      },
      rationale: {
        type: "string",
        description:
          "Two sentences. Address the strongest and weakest signals explicitly.",
      },
      craft_signals: {
        type: "array",
        description: "Per-signal craft assessment for all six signals.",
        items: {
          type: "object",
          properties: {
            signal: {
              type: "string",
              enum: [
                "opening_hook",
                "voice",
                "imagery",
                "stakes",
                "pacing",
                "sentence_rhythm",
              ],
            },
            rating: {
              type: "string",
              enum: ["strong", "moderate", "weak"],
            },
            note: {
              type: "string",
              description: "One sentence, concrete to the text.",
            },
          },
          required: ["signal", "rating", "note"],
        },
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        description: "2-3 specific, concrete observations.",
      },
      concerns: {
        type: "array",
        items: { type: "string" },
        description: "2-3 specific, concrete observations.",
      },
      uncertainties: {
        type: "array",
        items: { type: "string" },
        description:
          "Things you noticed but cannot judge confidently. Be candid. Empty array only if truly nothing.",
      },
      bias_self_check: {
        type: "string",
        description:
          "One sentence noting how your training data may be misjudging THIS specific submission.",
      },
    },
    required: [
      "score",
      "rationale",
      "craft_signals",
      "strengths",
      "concerns",
      "uncertainties",
      "bias_self_check",
    ],
  },
};

export type CraftSignalName =
  | "opening_hook"
  | "voice"
  | "imagery"
  | "stakes"
  | "pacing"
  | "sentence_rhythm";

export type CraftSignalRating = "strong" | "moderate" | "weak";

export interface CraftSignal {
  signal: CraftSignalName;
  rating: CraftSignalRating;
  note: string;
}

export interface EditorialPriorityReport {
  score: number;
  rationale: string;
  craft_signals: CraftSignal[];
  strengths: string[];
  concerns: string[];
  uncertainties: string[];
  bias_self_check: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export async function evaluateEngagementScore(
  submission: JudgmentSubmission,
): Promise<EditorialPriorityReport> {
  // The text the model evaluates. Include affinity so it can adjust its
  // bias self-check (e.g. an outsider writing about Lagos should trigger
  // a "I have no signal on local accuracy" note).
  const userPayload = {
    title: submission.meta.title,
    abstract: submission.meta.abstract,
    word_count: submission.meta.word_count,
    language: submission.meta.language,
    author_affinity: submission.field2_affinity,
    story_type: submission.field3_story_type,
    story_blocks: submission.story_blocks,
  };

  const response = await anthropicClient().messages.create({
    model: AI_EDITOR_MODEL,
    max_tokens: 2048,
    // System prompt is stable across submissions; flagged for ephemeral
    // cache so repeated invocations pay only ~0.1× for the cached portion
    // once the prefix crosses Sonnet 4.6's ~2,048-token cache minimum.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [TRIAGE_TOOL],
    tool_choice: { type: "tool", name: "submit_engagement_score" },
    messages: [
      {
        role: "user",
        content: `Submission to triage:\n\n${JSON.stringify(userPayload, null, 2)}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      `engagement-score returned no tool_use block. stop_reason=${response.stop_reason}`,
    );
  }

  const raw = toolUse.input as {
    score: number;
    rationale: string;
    craft_signals: CraftSignal[];
    strengths: string[];
    concerns: string[];
    uncertainties: string[];
    bias_self_check: string;
  };

  return {
    score: clamp(raw.score, 0, 100),
    rationale: raw.rationale,
    craft_signals: raw.craft_signals,
    strengths: raw.strengths,
    concerns: raw.concerns,
    uncertainties: raw.uncertainties,
    bias_self_check: raw.bias_self_check,
    model: AI_EDITOR_MODEL,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
