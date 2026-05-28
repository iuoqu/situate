import type { StoryTemplate } from "./registry";

/**
 * Situate Spine v0.1 — the Year-1 default writing template.
 *
 * A five-section flash-fiction skeleton: arrival → inhabitants → incident
 * → aftermath → closing image. Total target ≈ 1500 words (range
 * 930–1850), well inside the publish range of 800–2500.
 *
 * Each section's prompt is constitutional in spirit: the section forces
 * the author to commit to specific people in a specific place at a
 * specific moment, instead of abstract framings. Adjust the prompt copy
 * here and the entire write surface picks up the change at next reload —
 * no UI code touches.
 *
 * Curation TODO: 5 examples per section from already-published pieces,
 * surfaced inline. Lives outside this file (planned `template_examples`
 * table). Until then the prompt itself does all the editorial scaffolding.
 */
export const SITUATE_SPINE: StoryTemplate = {
  id: "situate-spine",
  name: "Situate Spine",
  description:
    "A five-section path from arrival to closing image. The shape most Situate stories take.",
  sections: [
    {
      id: "arrival",
      label: "Arrival",
      prompt:
        "Walk us into this place. What's the first concrete sensory detail that anchors the reader? Not a description of the city — one thing: the smell of warm asphalt, the buzz of a transformer, the particular yellow of a streetlight in this hour. Stay close to the ground.",
      wordRange: { min: 150, max: 250 },
      canHaveOwnLocation: true,
      showHookSelector: true,
      principleAnchors: ["P1", "P3"],
    },
    {
      id: "inhabitants",
      label: "Inhabitants",
      prompt:
        "Who is here? Name them. Show one specific thing they're doing — their hands, their wait, their habit. Not a type of person (a fisherman, a clerk, an old man) — this person. What are they wearing or carrying that nobody else here would be?",
      wordRange: { min: 200, max: 350 },
      canHaveOwnLocation: false,
      principleAnchors: ["P1", "P2"],
    },
    {
      id: "incident",
      label: "Incident",
      prompt:
        "Something shifts. A small event, a chance encounter, a decision made or refused. What changes? Stay close — minutes, not hours. The incident should be one we couldn't transplant: it depends on this place, this hour, these particular people being here.",
      wordRange: { min: 300, max: 500 },
      canHaveOwnLocation: true,
      principleAnchors: ["P3"],
    },
    {
      id: "aftermath",
      label: "Aftermath",
      prompt:
        "Sit with what just happened. What does the place hold differently now? What's the smaller thing your character notices that the bigger thing has made visible? Avoid summary or explanation — show the change through what's now seen.",
      wordRange: { min: 200, max: 400 },
      canHaveOwnLocation: false,
      principleAnchors: ["P1", "P3"],
    },
    {
      id: "closing",
      label: "Closing image",
      prompt:
        "End on a single concrete image. Not a moral, not a summary, not a lesson. The thing your character — or the place — leaves you with. One sentence, two at most.",
      wordRange: { min: 80, max: 150 },
      canHaveOwnLocation: false,
      principleAnchors: ["P7"],
    },
  ],
};
