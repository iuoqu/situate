# Transformational tradition — v0 research spec

**Status**: research in progress, not yet referenced by code. Lives here so
the parallel infra/schema window (which is building `src/lib/traditions/`
and the data-layer Story Bible) knows what *content* this side will
eventually populate.

This document defines **one narrative tradition** — the one we currently
call "transformational" — as a teaching scaffold for authors writing flash
fiction. Other traditions (zuihitsu, classical 笔记, prose poem, lyric
meditation) will get their own specs later; this is not Situate's only
shape, just the first one we're making teachable.

## 1. What this tradition IS

A piece succeeds in the transformational tradition when:

> An **equilibrium** is **disturbed** along a **causally connected**
> trajectory that arrives at a **changed equilibrium**, and the change
> **matters to some consciousness**.

Familiar instances: Aristotelian dramatic structure, Chekhovian quiet
stories where what changes is understanding rather than situation, mystery
revelations, fated falls, coming-of-age incidents, betrayals, recognitions.

It is **explicitly tradition-bounded**. It is not a universal definition
of "story". A zuihitsu meditation or a place-anchored prose poem may be
excellent without being a transformational story; they are evaluated in
their own traditions, not this one.

A piece judged "not a transformational story" is **not failing** — it is
working in a different tradition. The coach's job is to ask the author
which tradition they intend and help them there.

## 2. The five units

The conceptual atoms. Authors compose by filling these slots (in spine
order if writing into the Situate Spine template, in whatever order if
writing free-form).

### S0 — Equilibrium
The starting state. Includes:
- **Situation**: where we are, who is here, what is going on (the
  ordinary truth of this corner of the world before something shifts)
- **Understanding**: what the consciousness through which this story is
  carried *knows or believes* at the start

**Recognized when**: a reader could pause after this passage and describe
the unchanged life that's about to be disturbed. There is texture, not
just exposition. Specific people in a specific place doing specific things.

**Missing when**: opening is generic ("In a small town, there lived a
man…"), too internal (only mood, no anchored detail), or already
mid-disturbance with no baseline to fall back on.

### D — Disturbance
The thing that makes the equilibrium untenable. Four flavors (see §3):
conflict, recontextualization, revelation, inevitability.

**Recognized when**: a reader can name what changed and from where it
came (external pressure / internal recognition / hidden truth surfaced /
fate triggered).

**Missing when**: nothing actually happens, only mood drifts; or
something happens but it's not engaged with — the equilibrium absorbs it
unchanged.

### T — Trajectory
The causal line from D to S1. **Causation, not coincidence**.

**Recognized when**: each step reads as "and therefore" not "and then".
The reader can articulate why the disturbance leads to *this* outcome
rather than some other.

**Missing when**: the piece drifts associatively (随笔), or jumps to an
ending that doesn't follow from what came before.

### S1 — New equilibrium
The changed state. What's true now that wasn't before.

**Recognized when**: the reader can articulate *what changed* — situation
or understanding or both — and that the change is **load-bearing**, not
decorative.

**Missing when**: ending only summarizes / explains / repeats S0 in
different words / leaves things exactly as they were.

### K — Stakes-binding
The consciousness for whom this transformation has *weight*. Without K,
even a transformed-by-causal-chain piece reads as a **说明文** — a
demonstration with no one for whom it matters.

**Recognized when**: a reader can say whose stakes this is, and why this
change is non-trivial for them.

**Missing when**: events happen but no one is shown to care; or events
happen to people but the piece is structured as observation, not as
weight on those people.

## 3. The four engines

The *type* of disturbance that drives transformation. A piece may use
more than one but usually one is primary.

### conflict
**Shape**: goal vs obstacle, pursuit and escalation.
**Dimension**: usually situational (D and S1 differ in what's happening
out there).
**Recognized when**: there is something a consciousness wants, something
in the way, and the pursuit changes things.
**Distinct from inevitability**: in conflict, the outcome is contested —
the resistance might win. In inevitability, the outcome is structurally
foreordained from the moment D fires.

### recontextualize
**Shape**: an element appears that doesn't fit the existing frame; the
frame shifts to absorb it.
**Dimension**: usually understanding (D and S1 differ in what is *known*).
**Recognized when**: nothing dramatic happens externally, but by the end
the consciousness sees things differently — and that difference is the
story.
**Distinct from revelation**: recontextualization is the consciousness
re-organizing what it *already had*, surfacing a new pattern. Revelation
is *new information arriving from outside*.

### revelation
**Shape**: a hidden truth surfaces; what was concealed becomes seen.
**Dimension**: understanding.
**Recognized when**: there is a *moment of finding out* — a discovery,
a confession, an evidence — and the rest of the piece responds to it.
**Distinct from recontextualization**: the source of the change is
external — a letter, a stranger's remark, an artifact. Not the
consciousness rearranging its own data.

### inevitability
**Shape**: a fate is triggered and falls.
**Dimension**: usually situational, with understanding running underneath.
**Recognized when**: D is small but the chain that follows is structurally
unavoidable — and the consciousness, often, *recognizes* this is so.
**Distinct from conflict**: there is no contest. Resistance is decorative
or absent. The trajectory is a falling, not a fighting.

> **Open question from eval data**: models systematically confuse
> `revelation` vs `recontextualize` and `revelation` vs `inevitability`.
> Need a sharper definition pass — possibly collapse to 3 engines, possibly
> use clearer operational tests (e.g. "where does the new information
> originate?"). Flagged for v0.1.

## 4. Failure types — when a piece is NOT in this tradition

If the gate predicates fail, the piece is doing something else. Identify
*what else*, don't just say "fail":

| Gate failure | Other tradition this piece may belong to |
|---|---|
| transformation absent | **静物 / 描摹**: lyric stillness, place-portrait, sensory tableau. Often a deliberate choice — many lyric forms work this way. |
| transformation but no causal spine | **随笔 / zuihitsu**: associative meditation, mood drift, essayistic exploration. The piece moves but not because-and-therefore. |
| transformation + causation but no stakes | **说明 / instruction**: recipe, manual, neutral demonstration. The change has no carrier of weight. |

The coach's response when one of these fires:
> "This piece reads as a [random tradition] rather than a transformational
> story. That's a real form. Want to switch tradition, or revise toward
> transformational?"

It is **not** an editorial fail. It is a tradition mismatch.

## 5. Additional skeleton axes — beyond the core five

These are not part of the gate predicates but are essential craft
concerns. Each may become its own coach diagnoser layer:

### Cast & relationships
The set of consciousnesses in the piece + their relations. Required
because:
- K (stakes) needs a consciousness — but multi-character pieces have
  *inter-character* dynamics not captured by K alone
- **Translation depends on this**: addressing forms (你/您, ね/だ, 시/야),
  kinship terms (姐 vs older sister), speech register all need explicit
  relationship data

Lives at draft level, not per-section. Manual input by author, possibly
AI-extracted from prose as a suggestion. Data shape lives in Story Bible
tables (entities + relationships) — schema window's territory.

### Subtext (言不由衷)
Where the surface utterance and the real meaning diverge — but the prose
allows both to be heard. Diagnostic: when a piece has flat subtext, the
coach may surface specific passages and ask the author to make the gap
hearable.

Lives as per-passage annotation. Tradition-internal — every
transformational piece can have subtext but it's not required.

### Setup / payoff (契诃夫的枪)
Elements planted early that pay off later. The principle: every gun on
the wall in Act I must fire by Act III, and conversely, every firing in
Act III must have been a gun on the wall.

Lives at draft level as a registry of (setup_excerpt, payoff_excerpt)
pairs. Authors can be guided to map these explicitly. Loose ones become
a diagnostic.

### Geographic anchoring
The piece's relationship to its coordinates. Already partly captured by
Situate's existing per-section location fields and the `relocation_test`
field on submission. For the transformational tradition specifically:

- S0 should *be at* a place (not just *describe* one)
- D may originate *from* the place (a local feature, a custom, a
  geography-determined fact) — this is the strongest place-grounding
- T may *traverse* multiple locations
- S1 may *transform* the place's meaning to the consciousness

The relocation test ("what would break if the route were moved?") is the
gate question that lives outside this skeleton — it's editorial (P3), not
craft.

## 6. Posture vocabulary — v0 draft

Character postures the coach might tag and track across sections. Not
locked. v0 first pass — to be refined when first diagnoser experiments
run on real drafts.

- `guarded` — protecting something, holding back
- `vulnerable` — exposed, in motion, knowable
- `decisive` — committed to a course, has acted
- `stalled` — wanting movement but unable, in deferral
- `recognizing` — in the moment of seeing something newly
- `complicit` — knowingly participating in something they would not say
- `awaiting` — present but suspended, time-bound
- `withdrawn` — emotionally or physically absent though still on stage

These describe the *standing* of a character at a moment in the prose,
not the character globally. A useful coaching signal: posture drift —
where the prose flips a character's posture without earning it.

## 7. Elision types — v0 draft

What goes unsaid but is load-bearing. Worth tracking because elisions
are often where subtext lives and where Chekhov's gun gets loaded.

- `setup` — an object / detail / fact planted that should pay off
- `payoff` — the return of a setup, completing the arc
- `withheld_information` — a fact the prose deliberately keeps from the
  reader (or one consciousness from another) — payoff comes when it
  surfaces
- `unsaid_relationship` — a connection between characters that the prose
  implies but never names
- `place_subtext` — the place "saying" something the prose doesn't have
  to articulate
- `absent_presence` — a character or fact not on stage whose absence is
  structural

Diagnosers can fire when setups have no payoff, or when payoffs lack
setup.

## 8. Diagnoser catalog — v0 (first cut)

These are the *coaching surfaces* — what the AI says to the author. Each
is a small focused intervention. The coaching engine surfaces **one at
a time**, choosing by leverage (which one, addressed, would help most).

| ID | Triggers when | Socratic question |
|---|---|---|
| `s0_abstract` | S0 reads as type/category, not specific people/things | "Whose hands or face do we see in the first 50 words? Pick one." |
| `stakes_absent` | gate.stakes_bound fails | "Whose stakes is this? What does this consciousness lose or learn?" |
| `tell_dont_show_density` | high ratio of summary/explanation to anchored detail | "The piece is telling us what to feel. Where does the place do that work instead?" |
| `posture_drift` | a character's posture changes without earned cause | "[X] was guarded in Section 1 and vulnerable here. What turned them?" |
| `setup_without_payoff` | an explicit setup elision is registered but no payoff arc completes | "The [thing planted] never fires. Either let it go off or take it off the wall." |
| `flat_subtext` | a dialogue scene has surface utterance but no implicit second layer | "What is each person *not saying* here? Where can the reader hear both?" |
| `causal_chain_break` | between S0 and S1, the prose can't be re-read as a chain | "Why does [D] lead to [S1]? Walk us through the link." |
| `engine_mismatch` | piece reads as conflict but trajectory shows no contest (likely inevitability), or vice versa | "Is the outcome decided? If so, name what's happening as inevitability and let resistance shrink." |
| `closing_summary` | last section explains rather than shows | "The closing says what changed. What does the place / a body / an object show that says it without saying it?" |
| `tradition_mismatch` | gate predicates suggest piece belongs in another tradition | "This reads more like [zuihitsu / 描摹 / instructional]. Switch tradition or move it back toward transformational?" |

This list is **v0**. Each diagnoser needs:
- A precise trigger condition (eventually implementable as model prompt)
- Validation against 5-10 real drafts before going live
- A clear pedagogical justification ("a workshop teacher would say this")

## 9. Validation strategy

The diagnosers above are claims. They need testing. The plan:

1. **Lab**: repurpose existing `/dev/eval` infrastructure — instead of
   measuring "did model classify story right?", measure "did model
   surface the right diagnoser for this draft, where 'right' is
   pre-labeled by a human editor?"
2. **Human gold standard**: pick 5-10 real drafts (from existing
   specimens + ideally a few from real authors once available). For
   each, a human editor (initially the project owner) annotates *which
   diagnoser would have been most useful at what point*.
3. **Implement diagnosers one at a time**: write each as a focused
   Claude prompt. Test on the labeled set. Recall < 70% = needs more
   work. Recall ≥ 70% + low false-positive = ship.
4. **Stay in the lab** until a diagnoser is validated. Then move it to
   `src/lib/coach/diagnosers/<id>.ts` and wire to the registry.

The lab and the catalog evolve together. Many diagnosers in §8 will
change, merge, or split as we get real data.

## 10. What this spec does NOT decide

To keep clear what's coach territory vs other windows' territory:

- **Constitution compliance** (P1/P3/P7) is editorial, lives in
  `src/lib/ai-editor/` and runs on submitted pieces. The coach helps
  craft; the editor decides what to publish. Same RUBRIC frame might be
  re-used but the contracts are different.
- **Translation registers and politeness** depend on cast +
  relationships data. The coach surfaces "name your characters and
  their relations"; the translation layer (B.6) consumes the result.
- **Per-section geography** lives in the existing `DraftSection.longitude /
  latitude / place_description` fields. The coach reads these for the
  geographic-anchoring diagnosers but does not own the schema.
- **Tradition selection UI** is the schema window's job. We just
  guarantee that `tradition_profile_id = "transformational"` will have
  a meaningful spec to point at — and that meaningful spec is this file.

## 11. Versioning

This is **v0** — research draft. Once a critical mass of diagnosers
validate in the lab, this doc becomes v1 and a port lands in
`src/lib/traditions/transformational.ts` as code the registry consumes.
v0 is for human reading; v1 is for the system.

Changes:
- v0 (this file): first pass, post-eval-data reflection. Many open
  questions, especially around engine taxonomy.
