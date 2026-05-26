# P3 amendment — v0.2 → v0.2.1

**Scope.** P3 only. All other v0.2 principles (P1, P2, P4–P13) remain at v0.2.

**Date.** 2026-05-26.

**Status.** Active. v0.2 superseded by v0.2.1 in `editorial_principles` (UUID `22222222-0000-0000-0000-000003000201`).

## What changed

v0.2 said: *a universal drama dressed in local occupation, dialect, or scenery is still a universal drama … aesthetic and lyrical attention to a place is not itself an event.*

That sentence over-rejected a real class of literature: short fiction whose place-dependence runs through sensory texture, cultural weight, or environmental quality rather than through plot mechanics. Annie Dillard, Clarice Lispector, the Japanese zuihitsu tradition, and a great deal of contemporary prose-poem-leaning short fiction fall on the wrong side of v0.2's line. We do not want to be the magazine that declines them by policy.

v0.2.1 splits dependence into two admissible kinds:

1. **Explicit dependence** — the story's central event requires this place. A specific architectural feature, a local custom, a geography-determined plot point. Unchanged from v0.2.
2. **Implicit dependence** — the place's sensory texture, cultural weight, or environmental quality *structurally constitutes* the story's central insight or transformation. New in v0.2.1.

To keep "implicit" from becoming a loophole, v0.2.1 adds an operational guardrail and a test:

- **Structural argument, not atmospheric appeal.** "The city is beautiful and that matters" is not a P3 claim. "This exact insight emerges only because the place has THIS specific quality" is.
- **Transplant test.** If the story's meaning would survive moving the pin — even if the surface description loses something — the dependence is decorative, not structural. Decline.

The flagship sentence is preserved as the principle's closing line: *We are not a publication of well-written stories. We are a publication of stories that owe their existence to where they are set.*

## What this means for the AI editor

`src/lib/ai-editor/principles/p3.ts` is bumped to `P3_VERSION = "v0.2.1"`. Decision rules expand from five to six:

1. Author self-disclosed a P3 failure → FAIL.
2. Explicit, place-grounded claim → PASS.
3. **(new)** Implicit dependence with a built structural argument → PASS at 0.7–0.85 confidence.
4. Vague or sophisticated-sounding non-answer → UNCERTAIN.
5. **(new)** Transplant test for implicit claims — if meaning survives the move, UNCERTAIN or FAIL.
6. Multi-coordinate but no route argument → UNCERTAIN, name the gap.

Past decisions made under P3:v0.1 and P3:v0.2 remain interpretable by their version codes. P13 commits us to amending in public; this file is part of that commitment.

## Files touched

- `drizzle/seed_constitution_p3_v021.sql` — UPSERTs P3:v0.2.1 (EN + zh_CN), marks v0.2 superseded.
- `src/lib/ai-editor/principles/p3.ts` — system prompt, decision rules, `P3_VERSION` constant.
- `docs/constitution-v0.2.md` — P3 section replaced with v0.2.1 text + amendment notice.
- `docs/constitution-p3-v0.2.1-amendment.md` — this file.
