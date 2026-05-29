import type { TraditionProfile } from "./registry";

/**
 * Flash Situate — Pearls (遗珠).
 *
 * The carveout for Hemingway-style work whose merit is independent of
 * geographic anchoring ("Hills Like White Elephants" — a railway
 * station, but no generative coordinate). Pearls bypass P3 only;
 * every other principle still applies (the constitution does not
 * relax for Pearls).
 *
 * Operational rules (from `docs/TODO.md` Milestone B locked decisions):
 *   - Authors do NOT self-route to Pearls. They write under this
 *     tradition because they consider their piece non-place-anchored,
 *     but editorial discretion decides whether it actually enters the
 *     Pearls section at publication time.
 *   - Pearls may still tag a coordinate (the railway station has a
 *     station, just not a generative one) — the editor honours what
 *     the author surfaces.
 *   - Pearls use the Situate Spine template, but sections are
 *     deletable; 1-5 sections accepted at submit time. The 5-section
 *     shape is a scaffold, not a contract.
 *
 * The template below is the same five sections as anchored — but only
 * Section 1 is required. Authors trim freely.
 */
export const FLASH_SITUATE_PEARLS: TraditionProfile = {
  id: "flash_situate_pearls",
  name: "Situate Spine · Pearls (遗珠)",
  description:
    "For work whose merit is independent of place — Hemingway-style flash. Sections are deletable; coordinate is optional. Editor discretion decides whether your piece actually enters the Pearls section.",
  placeRequired: false,
  minSections: 1,
  maxSections: 5,
  allowSectionDeletion: true,
  sections: [
    {
      id: "arrival",
      label: "Opening",
      prompt:
        "Walk us in. Sensory if you can; abstract if the piece earns it. Pearls don't owe the reader a specific place — they owe the reader a clear way in.",
      wordRange: { min: 100, max: 300 },
      canHaveOwnLocation: true,
      showHookSelector: false,
      required: true,
      principleAnchors: ["P1"],
    },
    {
      id: "inhabitants",
      label: "Who is here",
      prompt:
        "Even when place isn't generative, people are. Name them. Show one specific thing they're doing. Avoid type — show this person, not a kind of person.",
      wordRange: { min: 150, max: 350 },
      canHaveOwnLocation: false,
      required: false,
      principleAnchors: ["P1", "P2"],
    },
    {
      id: "incident",
      label: "What shifts",
      prompt:
        "Something changes — a decision, an exchange, a refusal. Even a piece without coordinates needs a turn.",
      wordRange: { min: 200, max: 500 },
      canHaveOwnLocation: true,
      required: false,
      principleAnchors: ["P7"],
    },
    {
      id: "aftermath",
      label: "After",
      prompt:
        "What's seen differently now? Avoid summary; show the change.",
      wordRange: { min: 100, max: 400 },
      canHaveOwnLocation: false,
      required: false,
      principleAnchors: ["P1"],
    },
    {
      id: "closing",
      label: "Closing image",
      prompt:
        "End on a single concrete image. Not a moral, not a summary.",
      wordRange: { min: 60, max: 150 },
      canHaveOwnLocation: false,
      required: false,
      principleAnchors: ["P7"],
    },
  ],
  diagnosers: [],
  unitTypes: [],
};
