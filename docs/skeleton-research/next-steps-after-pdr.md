# Next steps after PDR validation

Status: two focused diagnosers validated by contrast-pair × PDR methodology.

| diagnoser | PDR | what we learned |
|---|---|---|
| stakes_absent | 94% | K is reproducible across models; 3-tier structure (K_present / K_implicit / K_absent) emerges from data, not from prompt design. Negative side falls into K_implicit. DeepSeek is the most sensitive (detected K leak in 02_mother_daughter that other models missed). |
| causal_spine | 88% | Methodology generalizes to a second axis. Same 3-tier structure (causal_present / causal_implicit / causal_absent), same "negative side falls into implicit" pattern. Qwen draws a higher threshold for `causal_present` (demands explicit logical connectives, not just temporal arrangement). |

Cross-axis recurring patterns:
- The 3-tier structure recurs (was not pre-specified for causal_spine; we built it in because K data revealed it)
- The middle tier (implicit) is the dominant residence of contrast-pair negative specimens
- Strict binarization (only the strongest tier counts as positive) is the line that tracks model agreement
- Different providers expose different sensitivities — informative not noise

This document expands the four candidate next steps.

---

## (a) Path C — 3-tier coach UX spec

The largest-value next step. We have validated diagnostic axes. Turn them into something a writer interacts with.

### a.1 Define the per-tier coach behavior

For each diagnoser, the three tiers map to three distinct coach actions:

| tier | coach action | example for stakes_absent |
|---|---|---|
| `_present` | **silent** — do not interrupt | K_present → no annotation |
| `_implicit` | **indicate** — point to where the load lands and which element carries it | K_implicit → quote 1-2 phrases that imply the consciousness, name what's being carried |
| `_absent` | **question** — ask a root-level question about whether the axis exists | K_absent → "this section reads as observation. Who is this happening to?" |

Coaching is NOT correction. It does not propose rewrites. It points and asks.

### a.2 Cross-model signal as a UI dimension

We have 4 models per call. Their agreement structure is itself information:

- **4/4 same tier** → "stable judgment, the coach voices with confidence"
- **3/4 same tier, 1 disagrees** → "edge case, your call" (surface the disagreeing model's view)
- **2/2 split** → "this passage sits on a craft line — make the choice deliberately"

In the UI: maybe a confidence indicator (filled dot / half dot / hollow dot) next to each annotation. Or hide low-confidence annotations by default and let the writer toggle them on.

### a.3 When does the coach fire

Constraints from our existing work:

- Partial drafts shouldn't get full-skeleton judgment (this is what `RUBRIC_PARTIAL` was designed for)
- The coach should not interrupt typing flow; only show when explicitly requested OR at section breaks
- Existing `/write/template/[id]` flow has a review step — the coach belongs there, not in the typing pane

Three candidate firing modes:

1. **On request** — writer clicks "diagnose section" button, runs all focused diagnosers, displays results
2. **On section completion** — when writer marks a section as done, the diagnoser runs in background
3. **On submit** — runs full diagnostic before submission, displays as a "consider before you send" panel

Recommend (1) for v0 — explicit, predictable, no interruption.

### a.4 Surface design

Open questions to resolve:

- Does the coach quote the prose back? (For K_implicit: must we quote the sentence that carries the implicit K?)
- Does the coach use English jargon (K_present) or natural Chinese (承担明确)?
- Inline annotations vs side panel vs both?
- Does the writer dismiss / accept / mark-as-considered each annotation?
- Is there a record of which annotations were addressed in subsequent revisions?

### a.5 First concrete deliverable

Build a small `/dev/coach-preview` page:

- Textarea on left, paste any prose
- Right side runs all registered focused diagnosers on the text
- Renders the 3-tier output as a mock coach UI (sidebar with annotations)
- Shows per-model verdicts in collapsed detail
- No persistence; just a mockup for testing the UX feel

This lets us iterate the surface design without touching `/write` and without committing schema changes to the main app.

### a.6 Relationship to existing skeleton-diagnostic flow

The current `/write/template/[id]/review` page already runs the monolithic RUBRIC diagnostic. The transition path:

- v0: focused diagnosers run alongside the monolithic version on the dev eval page (already do)
- v1: `/dev/coach-preview` proves out the UX
- v2: the focused-diagnoser bank replaces the monolithic RUBRIC in the production review page
- v3: the diagnostic moves from "review step" to optional in-section button

We are at v0 → v1.

---

## (b) Third focused diagnoser — `the_turn`

Continue methodology validation on a structurally harder axis.

### b.1 Why `the_turn` over `economy` or `flat_subtext`

- `the_turn` is the most structurally important of the remaining three — it's about whether the ending actually closes the transformation arc or merely summarizes themes
- It's the hardest to construct contrast pairs for, which is a useful stress test
- `economy` is more about line-level craft, less about structure
- `flat_subtext` requires full short stories to evaluate — too long for our 4-pair × 2-side × 4-provider budget

### b.2 Verdict structure (3-tier following the pattern)

- `turn_present` — ending recontextualizes or decisively closes; reader's understanding of S0 retroactively shifts
- `turn_implicit` — ending hints at a turn but doesn't crystallize it; reader has to do the interpretive work
- `turn_absent` — ending summarizes or just-ends; no recontextualization, no closure

### b.3 Contrast pair construction (the hard part)

For each pair: keep same setup, same characters, same body — only the **closing 2-3 paragraphs** differ.

- `_turn.txt` — has a real ending move (revelation / recontextualize / decisive S1)
- `_summary.txt` — has the body content of `_turn.txt` but ends with summary, abstraction, or just stops

Candidate scenarios (4 pairs):

1. `01_train_station` — couple parting at platform; turn version has wife discover something in his bag, summary version has them simply waving goodbye
2. `02_inheritance` — meeting at notary; turn version has a single document changing the meaning of everything prior, summary version concludes "they split the money"
3. `03_voicemail` — character listens to a saved voicemail; turn version recasts the relationship, summary version has character reflect on missing the person
4. `04_doctor_visit` — patient returns for follow-up; turn version has a small gesture that re-frames the whole illness arc, summary version closes with a generic statement about acceptance

### b.4 Expected outcome

If PDR > 70% across providers: methodology validated on a 3rd axis. Stronger evidence that the transformational framework hangs together as a coherent set of axes.

If PDR < 70%: tells us something specific — either `the_turn` is harder for LLMs to detect, or my contrast pair construction for endings is less clean.

### b.5 Effort

Comparable to causal_spine. ~1 hour writing diagnoser code, ~2 hours writing 4 pairs (endings are harder than setups), 1 PR.

---

## (c) Fix causal_spine specimens to test Qwen hypothesis

Targeted experiment to validate one specific reading of the data.

### c.1 Hypothesis

Qwen's failures on 02_diagnosis and 03_letter happened because those `_causal` versions use **temporal connectives** ("之后", "才", "那之后") rather than **logical connectives** ("因此", "所以", "正因如此"). Qwen demands the latter to upgrade implicit → present; the other 3 models accept the former.

### c.2 Test

Rewrite the two specimens:

- `02_diagnosis_causal.txt` — replace temporal connectives with explicit logical ones. Add 1-2 sentences that state the causation outright ("因为那次报告，我明白如果再喝下去……").
- `03_letter_causal.txt` — same. Make the causal chain unambiguously verbalized.

### c.3 Expected outcomes

- **If Qwen now hits 100%**: confirms hypothesis. Tells us causal_spine has a "literary register" boundary we should be aware of when coaching. Many writers (Chekhov / 汪曾祺 tradition) will be at "implicit" by Qwen's standards but "present" by 3 other models' standards. This is a real feature, not a bug.
- **If Qwen still fails**: hypothesis wrong. Need to look deeper at Qwen's discrimination criteria.

### c.4 Cost

Low — 1 hour to rewrite + re-run. Single PR.

### c.5 Risk

The "fix" doesn't make the diagnoser better in any product sense. It only validates a hypothesis about the data we already have. Justified only if we want to confirm/refute that hypothesis before designing UI that depends on it.

---

## (d) Methodology write-up document

Codify what we've learned so we can refer back without re-deriving it.

### d.1 Document structure

A new `docs/skeleton-research/methodology-v1.md` that contains:

1. **Provenance statement** — explicit note that the transformational-v0 framework is a synthesis built in this project, not borrowed from a single established source. (We had this conversation; it belongs in writing.)

2. **The contrast-pair × PDR methodology**:
   - Why contrast pairs (construction-based gold standard, sidesteps the question "is this a story")
   - PDR formula (per-provider distinguishment rate, averaged across providers)
   - Threshold choice (70%) and why it's not 90% or 50%

3. **The 3-tier structure**:
   - Where it came from (emerged from K data, not designed)
   - Why it generalized to causal_spine
   - Hypothesis: every focused diagnostic axis has this structure
   - Implication for product: the middle tier is the coaching territory

4. **Cross-axis findings table**:
   - stakes_absent (PDR 94%) — what worked, what surprised us, what the failure case taught
   - causal_spine (PDR 88%) — same
   - the_turn (if (b) is done) — same

5. **Cross-model findings**:
   - Sonnet 4.6: solid on K, slightly less confident on causal — implies Sonnet treats K as more central
   - Opus 4.7: highest agreement with the majority on both axes
   - DeepSeek V3.1: most sensitive on K (detected leak others missed), most discriminating on causal (uses absent more freely)
   - Qwen3 Max: higher threshold for causal_present (demands explicit logical connectives)

6. **Open methodological questions**:
   - Does PDR threshold scale with axis difficulty? Should it be axis-specific?
   - Are 4 pairs enough for a confidence interval we trust?
   - Should we test against holdout specimens (corpus) not just contrast pairs?
   - The "fix the failed specimen" loop is data-fitting — at what point does it become methodologically dishonest?

7. **Limitations**:
   - Sample size: 4 pairs per axis
   - Linguistic register: all specimens are short literary Chinese; behavior on longer or other-language texts is untested
   - Provider coverage: 4 providers, all major. No open-weights tested.
   - Construction bias: I wrote both sides of each pair, which introduces a personal stylistic bias. Could be corrected by having a different writer produce some pairs.

### d.2 Effort

~2-3 hours of writing. No code. Single PR.

### d.3 Why now vs later

Now: while the experiments are fresh and the conversation context is intact. The longer we wait, the more we'll have to re-derive.

Later: once we have a third axis from (b), the document has more material.

Compromise: write d.1–d.5 now, leave d.4 as a placeholder, fill in after (b).

---

## Recommended order

1. **(a.5) only** first — build `/dev/coach-preview` page. This is the most concrete UX experiment. It uses what we already have and doesn't commit to anything we can't undo.
2. After (a.5) reveals which UX questions are real: either continue (a) into full surface design, OR step back to (b) for more axis evidence.
3. (d) anywhere — independent of the others, just don't let it accumulate as undocumented tacit knowledge.
4. (c) only if we want to confirm the Qwen hypothesis before designing UI around the "implicit register is real and reproducible" assumption.

If I had to pick one: **(a.5)**, because it tests whether the validated infrastructure actually maps to writing experience.
