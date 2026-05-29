import type { TraditionProfile } from "./registry";

/**
 * Flash Situate — anchored.
 *
 * The Year-1 default. Reproduces the existing Situate Spine flow:
 * 5 fixed sections, Section 1 must have its own coordinate at submit
 * time, P3 (place-generativity) gated at the editorial layer. Most
 * Situate work falls here.
 *
 * Diagnosers and unit-types are intentionally empty; the AI-coach
 * skeleton window owns those.
 *
 * To tune section copy or word ranges, edit this file — the entire
 * editor + review surface reads from here at render time.
 */
export const FLASH_SITUATE_ANCHORED: TraditionProfile = {
  id: "flash_situate_anchored",
  name: "Situate Spine · anchored",
  description:
    "A five-section path from arrival to closing image. The shape most Situate stories take. Section 1 must carry a real coordinate.",
  placeRequired: true,
  minSections: 5,
  maxSections: 5,
  allowSectionDeletion: false,
  sections: [
    {
      id: "arrival",
      label: "Arrival",
      prompt:
        "Walk us into this place. What's the first concrete sensory detail that anchors the reader? Not a description of the city — one thing: the smell of warm asphalt, the buzz of a transformer, the particular yellow of a streetlight in this hour. Stay close to the ground.",
      wordRange: { min: 150, max: 250 },
      canHaveOwnLocation: true,
      showHookSelector: true,
      required: true,
      principleAnchors: ["P1", "P3"],
    },
    {
      id: "inhabitants",
      label: "Inhabitants",
      prompt:
        "Who is here? Name them. Show one specific thing they're doing — their hands, their wait, their habit. Not a type of person (a fisherman, a clerk, an old man) — this person. What are they wearing or carrying that nobody else here would be?",
      wordRange: { min: 200, max: 350 },
      canHaveOwnLocation: false,
      required: true,
      principleAnchors: ["P1", "P2"],
    },
    {
      id: "incident",
      label: "Incident",
      prompt:
        "Something shifts. A small event, a chance encounter, a decision made or refused. What changes? Stay close — minutes, not hours. The incident should be one we couldn't transplant: it depends on this place, this hour, these particular people being here.",
      wordRange: { min: 300, max: 500 },
      canHaveOwnLocation: true,
      required: true,
      principleAnchors: ["P3"],
    },
    {
      id: "aftermath",
      label: "Aftermath",
      prompt:
        "Sit with what just happened. What does the place hold differently now? What's the smaller thing your character notices that the bigger thing has made visible? Avoid summary or explanation — show the change through what's now seen.",
      wordRange: { min: 200, max: 400 },
      canHaveOwnLocation: false,
      required: true,
      principleAnchors: ["P1", "P3"],
    },
    {
      id: "closing",
      label: "Closing image",
      prompt:
        "End on a single concrete image. Not a moral, not a summary, not a lesson. The thing your character — or the place — leaves you with. One sentence, two at most.",
      wordRange: { min: 80, max: 150 },
      canHaveOwnLocation: false,
      required: true,
      principleAnchors: ["P7"],
    },
  ],
  // Filled by the AI-coach skeleton window. Empty = coaching layer
  // surfaces nothing for this tradition yet.
  diagnosers: [],
  // Filled by the AI-coach skeleton window. Story-unit gate uses these
  // string ids verbatim against `story_units.unit_type`.
  unitTypes: [],
};
