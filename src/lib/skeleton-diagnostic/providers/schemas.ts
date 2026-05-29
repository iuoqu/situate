/**
 * Plain JSON Schemas for the diagnostic tool inputs. Shared by the
 * Anthropic and OpenAI-compatible providers — both transports accept this
 * same shape (Anthropic wraps it in `Tool.input_schema`, OpenAI in
 * `function.parameters`).
 *
 * Anthropic strict mode requires:
 *   - `additionalProperties: false` on every object — without this the call
 *     returns 400 invalid_request_error.
 *   - Every property must appear in `required`.
 * OpenAI-compatible providers (DeepSeek, Qwen) ignore the extra constraint
 * harmlessly, so it's safe to keep one schema for both transports.
 */

export const FULL_TOOL_NAME = "submit_full_diagnostic";
export const PARTIAL_TOOL_NAME = "submit_partial_diagnostic";

export const FULL_TOOL_DESCRIPTION =
  "Submit the structural diagnostic for a completed draft. Mandatory output channel for the full-draft analyser.";
export const PARTIAL_TOOL_DESCRIPTION =
  "Submit the observation for an in-progress draft. Mandatory output channel for the partial-draft analyser.";

const gatePredicate = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "boolean" },
    why: { type: "string" },
  },
  required: ["verdict", "why"],
} as const;

const axisObservation = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["present", "hinted", "not_yet"] },
    note: { type: "string" },
  },
  required: ["status", "note"],
} as const;

export const FULL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title_or_first_line: { type: "string" },
    skeleton: {
      type: "object",
      additionalProperties: false,
      properties: {
        S0: { type: "string", description: "Equilibrium / starting state" },
        D: { type: "string", description: "Disturbance" },
        T: { type: "string", description: "Trajectory" },
        S1: { type: "string", description: "New equilibrium" },
        K: { type: "string", description: "Stakes binding" },
        transformation_dimension: {
          type: "string",
          enum: ["situation", "understanding", "both"],
        },
      },
      required: ["S0", "D", "T", "S1", "K", "transformation_dimension"],
    },
    gate: {
      type: "object",
      additionalProperties: false,
      properties: {
        transformed: gatePredicate,
        causal: gatePredicate,
        stakes_bound: gatePredicate,
        is_story: { type: "boolean" },
        if_not_story_type: {
          type: "string",
          // Anthropic strict mode rejects null in enum, so we use empty
          // string as the "no failure type" sentinel and the providers
          // map "" back to null before returning to the caller.
          enum: ["描摹", "随笔", "说明", ""],
          description:
            "Failure type when is_story is false. Must be empty string when is_story is true.",
        },
        confidence: {
          type: "number",
          description: "0.0 – 1.0. Borderline cases must report low confidence.",
        },
        borderline_note: {
          type: "string",
          description: "Empty when confidence is high; otherwise explain why.",
        },
      },
      required: [
        "transformed",
        "causal",
        "stakes_bound",
        "is_story",
        "if_not_story_type",
        "confidence",
        "borderline_note",
      ],
    },
    engines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          engine: {
            type: "string",
            enum: ["conflict", "recontextualize", "revelation", "inevitability"],
          },
          weight: { type: "number" },
          why: { type: "string" },
        },
        required: ["engine", "weight", "why"],
      },
      description:
        "Empty when the gate said non-story. May list multiple engines with weights.",
    },
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: {
            type: "string",
            enum: ["causal_spine", "the_turn", "economy", "flat_subtext"],
          },
          finding: { type: "string" },
          severity: {
            type: "string",
            enum: ["ok", "note", "warn", "error"],
          },
        },
        required: ["id", "finding", "severity"],
      },
      description:
        "All four ids must appear when the gate said story. Empty when non-story.",
    },
    one_line_verdict: { type: "string" },
  },
  required: [
    "title_or_first_line",
    "skeleton",
    "gate",
    "engines",
    "diagnostics",
    "one_line_verdict",
  ],
} as const;

export const PARTIAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title_or_first_line: { type: "string" },
    skeleton_status: {
      type: "object",
      additionalProperties: false,
      properties: {
        S0: axisObservation,
        D: axisObservation,
        T: axisObservation,
        S1: axisObservation,
        K: axisObservation,
      },
      required: ["S0", "D", "T", "S1", "K"],
    },
    progress_estimate: {
      type: "number",
      description: "0.0 – 1.0. How far through the arc the draft is so far.",
    },
    tentative_engines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          engine: {
            type: "string",
            enum: [
              "conflict",
              "recontextualize",
              "revelation",
              "inevitability",
              "",
            ],
          },
          weight: { type: "number", description: "≤ 0.5 — these are tentative." },
          why: { type: "string" },
        },
        required: ["engine", "weight", "why"],
      },
    },
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", enum: ["causal_spine", "economy"] },
          finding: { type: "string" },
          severity: {
            type: "string",
            enum: ["ok", "note", "warn", "error"],
          },
        },
        required: ["id", "finding", "severity"],
      },
    },
    next_axis_hint: {
      type: "string",
      enum: ["S0", "D", "T", "S1", "K", "none"],
      description: "Which axis should the author work on next.",
    },
    observation_summary: { type: "string" },
  },
  required: [
    "title_or_first_line",
    "skeleton_status",
    "progress_estimate",
    "tentative_engines",
    "diagnostics",
    "next_axis_hint",
    "observation_summary",
  ],
} as const;
