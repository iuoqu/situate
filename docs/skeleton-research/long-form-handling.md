# Long-form handling — analysis

Companion to `methodology-v1.md`. Examines what changes when the prose is 1500-2500 characters instead of 200-700.

Status: analysis, not yet validated. The recommendation at the bottom is "test before redesign."

---

## The gap

All current contrast pairs and ad-hoc samples are 200-700 characters. Situate submissions are 800-2500. So we don't actually know how the diagnoser bank behaves on the texts it's meant to coach.

This document predicts the failure modes and proposes a test-first approach.

## Six things that change with length

### 1. Multiple candidate centers

A 700-char piece typically has one pivot — the structural moment everything turns on. A 2500-char piece can have 3-5:

- a setup ending (S0 → D)
- a middle reversal
- a small concrete detail that locks meaning
- the closing image

Current `center_of_gravity` and `center_consensus` ask for **one** sentence. On long text this either:

- forces collapse to the most dramatic one (loses other anchors)
- scatters intra-model votes (false "no center" reading)
- produces inconsistent picks across runs

**Prediction**: dual-family agreement on long text will be lower than 90%+ we've seen, even when the prose is well-structured.

### 2. K identity can shift or layer

Short text: K is usually one consciousness throughout.

Long text:
- Multi-POV (alternating sections)
- K shifts from character A to character B mid-piece
- Embedded narrators (frame story)
- Reader-projected K (no consciousness in text, but reader carries weight — like documentary fiction)

Current `stakes_absent` schema returns one K verdict for the whole prose. On long text this loses the "K shifted at paragraph 4" insight that's important to a coach.

### 3. Subtext layers

Short text has at most one subtext signal — the dog example's overprotest, the iceberg.

Long text can have:
- a global subtext (the whole story is about X but never names it)
- a recurring motif (water imagery returning at three key moments)
- a single-line subtext at the end (Chekhov-style late landing)

Current `inferred_intent.subtext_signal` is a single string. The schema can't carry layered observation.

### 4. Causal chain density

Short text: each event clearly causes the next, or doesn't. Easy to call causal_present vs absent.

Long text: causation operates at multiple scales — scene-internal causation, between-scene causation, arc-level causation. A piece can have tight scene causation but loose between-scene arc, or vice versa.

`causal_spine` doesn't currently distinguish these. It returns one verdict.

### 5. Economy across distance

Short text: economy is local — can I delete this sentence? Within 700 chars, yes/no is obvious.

Long text: an image in paragraph 2 might pay off in paragraph 9. The model must hold both endpoints to judge the early image's economy. Local economy can stay tight while the far-distance setup-payoff economy goes loose, or vice versa.

`economy` doesn't see this — it gets one verdict for the whole.

### 6. Coach UI navigation

Short text: one verdict per axis, one card, easy to read.

Long text with multiple findings per axis: the coach needs to point to specific paragraphs, possibly with inline annotations. The current "one card per diagnoser" UI doesn't scale.

---

## Four architectural responses

### A. Section-based

Split the prose at paragraph or scene boundaries. Run each section through the existing diagnosers. Aggregate findings into per-section output.

**Pros**: scales linearly; each section is short and behaves like our existing test cases; existing prompts and schemas unchanged.

**Cons**: loses cross-section structure (the arc-level center, the late payoff, K-shifts that span sections). The whole point of long form is the build, which section-by-section misses.

**Verdict**: useful as a complement, not a replacement.

### B. Hierarchical

Run two passes:

1. **Overview pass** — full text, asks for global K, S0/D/T/S1, arc-level center, motif structure
2. **Local pass** — section-by-section through existing diagnosers

Combine: overview gives the spine, local fills in the details.

**Pros**: catches both global arc and local craft; existing diagnosers reused for local.

**Cons**: more calls (cost ~2x); need new "overview" prompts and schema; need UI for combining the two views; risk that overview vs local disagree (which is true source of truth?).

**Verdict**: probably the right architecture, but heaviest to build.

### C. Extended schemas

Keep one-pass architecture, but make schemas long-form aware:

- `center_of_gravity` → `center_passages: Array<{quote, role: "setup_end" | "reversal" | "lock" | "closing"}>` (up to 4)
- `subtext_signal` → `subtext_layers: Array<string>` (1-3)
- `k_inferred` → `k_inferred: { primary, shifts: Array<{paragraph, to_whom}> }`
- Verdict tiers stay 3-way

**Pros**: single pass; clean upgrade of existing diagnosers; no new "overview" diagnoser.

**Cons**: schema redesign breaks back-compat with short-form runs; prompts must be substantially rewritten; cross-model agreement metrics get more complex (compare arrays now).

**Verdict**: clean conceptually, but the back-compat break makes this awkward to ship.

### D. Length-routed diagnoser bank

Keep existing diagnosers exactly for short text. Add new long-form variants (`stakes_absent_long`, `causal_spine_long`, etc.) with their own schemas. The route picks variant by text length.

**Pros**: zero risk to short-form; long-form gets purpose-built prompts.

**Cons**: doubles the diagnoser bank; threshold of "short vs long" is arbitrary; maintenance burden.

**Verdict**: avoid unless test shows existing diagnosers genuinely break on long text.

---

## Recommended path: test before redesigning

Before committing to any of A/B/C/D, **run the current bank on real long-form prose** and see what actually happens. We've been speculating; one experiment cuts speculation in half.

### Concrete test

1. Pick 3-4 long specimens (1500-2500 chars). Best sources:
   - Existing `story-gate-eval/specimens/` corpus (some may already be long)
   - A short Chekhov translation
   - A Wang Zengqi piece
   - A piece from earlier Situate submissions (real user prose)
2. Add as samples in coach-preview (with `clear textarea` discipline)
3. Run the full diagnoser bank on each, with the 4 strong providers
4. Examine each diagnoser output, asking:
   - **stakes_absent**: does it correctly call K_present? Does the evidence cite a sensible passage, or a random sentence?
   - **causal_spine**: does the verdict make sense? Is the reorder_test field meaningful at this scale?
   - **inferred_intent**: is the center_of_gravity sensible, or arbitrary? Does the subtext_signal capture a real pattern, or is it a guess?
   - **center_consensus**: do the two families converge, or scatter wildly? At what agreement %?
   - **economy**: present, implicit, or absent? Does the slack field cite specific decorative elements, or wave at vague "some redundancy"?

### What different test outcomes mean

| Outcome | Implication |
|---|---|
| All diagnosers behave reasonably; verdicts and evidence are sensible | No redesign needed for v0. Maybe just better UI for displaying findings. |
| Verdicts make sense but evidence is vague / picks random sentences | Schema needs to support multiple centers / layers — go with **Approach C** |
| center_consensus scatters badly even on well-structured long text | Single-center model is wrong — need **Approach C** (multiple centers) or **B** (overview pass) |
| K identity is missed when prose has multiple Ks | Need **Approach C** with K array, or **Approach B** with overview |
| Outputs are visibly worse than on short text (incoherent, contradictory across diagnosers) | Existing diagnosers genuinely break — go with **Approach D** (length-routed) |

### Cost

Half a day to author or curate 3-4 long samples + run + examine outputs. Total cost ~$0.50 across all providers.

This is much cheaper than implementing A/B/C/D speculatively and then having to undo half of it.

---

## Other long-form considerations

### Multi-sample cost scales modestly

`center_consensus` does N=7 samples per family × 2 families = 14 calls. At 700 chars that's ~10k char total per call. At 2500 chars it's ~35k chars total per call — still cheap (~$0.003 on qwen-flash + deepseek-v4-flash).

### Provider capacity

DeepSeek V4 Flash concurrency limit is 2500. Qwen DashScope is roughly 60 req/sec. Both fine for our N.

### Latency

Long-prose multi-sample at temp 0.9 might take 15-30 seconds per family. UX consideration: probably want streaming partial results in coach-preview if we go this route.

### Mixed-length contrast pairs

For PDR validation on long form, we'd want long contrast pairs. Constructing these is harder than short ones — the "axis present vs absent" line is itself fuzzier over distance. May need a different validation approach (e.g., human-labeled subset of existing 36 specimens).

---

## Open questions

- Does long-form prose have **stable** structural anchors, or does it have moving foci that resist single-point identification? (Empirical question — the test above probes this.)
- Is the 3-tier structure (_present / _implicit / _absent) still meaningful at long-form scale, or do we need finer gradations?
- Should subtext_signal output be a single string, an array, or a structured object with motif categories?
- Is per-section analysis even useful for a writer-facing coach? Long-form writers think in arcs; per-section feedback might be too local to act on.

## Bottom line

We don't know what long-form does yet. Speculating about A/B/C/D is premature. The right move is: pick 3-4 long specimens, run the existing bank on them, see what actually happens, then design.

Half-day experiment > weeks of architectural redesign on guesses.
