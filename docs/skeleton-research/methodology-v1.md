# Methodology v1 — focused diagnoser bank

Status: captured end of May 2026, after dual-family center_consensus (PR #22). This document records what we built, what we learned, and what's unproven, for future-you (and future-others) to ramp into.

For the underlying framework, see `transformational-v0.md`. For the next-step planning that preceded this, see `next-steps-after-pdr.md`.

---

## Provenance

The framework these diagnosers test — skeleton S0/D/T/S1/K, engines, diagnostics, three failure types — is a synthesis built in this project. It is **not** borrowed wholesale from any single tradition. Each component maps onto something older, but the specific combination, naming, and tiered structure was constructed during this work.

Map:

| Component | Older source |
|---|---|
| S0 → D → T → S1 | Todorov's equilibrium → disturbance → recognition → attempt → new equilibrium (compressed to four) |
| K (stakes-binding consciousness) | James's "center of consciousness" + Chinese 承担 + creative-writing "stakes" |
| causal_spine | Pixar's but/therefore rule; John Yorke; Wood's *How Fiction Works* |
| the_turn (planned) | Aristotle's anagnorisis; Baxter; Francine Prose |
| economy | Chekhov's gun; Strunk & White |
| inferred_intent.subtext_signal | Hemingway's iceberg; Pinter's subtext |
| Conflict / recontextualize / revelation / inevitability engines | Egri, McKee, Aristotle, Wood respectively |

The eval validates this synthesis as **internally coherent and externally distinguishable to LLMs**. It does not validate it as "the right" framework. We sit on path A (research our own synthesis), not path B (adopt McKee / Truby / Burroway as-is).

## Architecture: focused diagnoser bank

Each diagnoser is a separate file under `src/lib/coach/diagnosers/`, with its own:

- system prompt (single-axis, no skeleton flooding)
- output schema (`additionalProperties: false`, strict mode)
- run function calling `focusedCall`
- registry entry with `pair_axis`, `requires_intent`, `provider_fanout` flags

Currently built:

| Diagnoser | Verdict tier | Axis test | Coach role |
|---|---|---|---|
| stakes_absent | K_present / K_implicit / K_absent | contrast pair × PDR | silent / indicate-K / ask "对谁是一件事" |
| causal_spine | causal_present / _implicit / _absent | contrast pair × PDR | silent / indicate-chain / ask "B 因为 A 吗" |
| intent_realization | intent_implemented / _partial / _unimplemented | per-call (requires intent block) | silent / show realized vs unrealized / ask "保留 prose 还是回到 intent" |
| inferred_intent | (no tier — extractor) | n/a | mirror: show AI-read K / changes / center / subtext |
| economy | economy_present / _implicit / _absent | pair_axis registered, **no corpus yet** | silent / show slack / ask "什么不挣位置" |
| center_consensus | (no tier — vote distribution) | dual-family intra-model multi-sample | confirms inferred_intent's structural anchor or flags scatter |

The route `/api/dev/coach-preview` fans out per (diagnoser × provider) when `provider_fanout: true`, runs once internally for `provider_fanout: false` (center_consensus).

## The two robustness signals

The architecturally novel finding: there are two distinct robustness signals you can measure for "is this center / pattern real?":

| Signal | How | Asks |
|---|---|---|
| **Inter-model consensus** | 4 diverse providers each × 1 call | "Do different careful readers agree on what this prose is doing?" |
| **Intra-model multi-sample** | 2 cheap providers × N=7 samples at temp 0.9 | "Is the structural cue robust under sampling noise?" |

Both pointing the same way → strong center. Either alone → soft signal. Both diverging → no center.

The 4-quadrant coach decision table that falls out:

| Inter-model | Intra-model (center_consensus) | Reading | Coach action |
|---|---|---|---|
| All agree | Joint family consensus | Textbook-clear center | Silent / "this is your support pillar — keep it" |
| All agree | No joint consensus | Real but subtle anchor | Silent / "the line your story turns on" |
| Models split | Joint family consensus | **Structural anchor hidden from careful readers** | Indicate — "an anchor most readers will miss; consider making it more visible" |
| Models split | No joint consensus | Distributed emotional terrain (or no center) | Question — "is this single-pivot or rich terrain? Either is fine, but choose" |

The third row is the most interesting case — it's where cheap multi-sample adds information that diverse careful readers can't.

## PDR validation results

### stakes_absent: 94%

4 contrast pairs (mother-daughter, stranger-encounter, father-son, old-friends), 4 providers. Path A binarization (strict K_present) after initial 6% PDR exposed that models reliably return K_implicit on stripped prose. Key finding: **the K axis is reproducible across providers** — the line between K_present and K_implicit is a coherent judgment, not noise.

### causal_spine: 88%

4 pairs (layoff, diagnosis, letter, argument). Qwen3 Max is stricter than other models — it demands explicit logical connectives ("因此/所以") rather than temporal arrangement to call something causal_present. This isn't wrong, it's a higher threshold for the "literary register vs heavy-handed marker" boundary. Cross-axis pattern: causal_implicit is the dominant residence of negative specimens, just like K_implicit was for stakes_absent.

### Other axes: not pair-tested

- `intent_realization` — validated by direct A/B/C use, not PDR. The diagnoser explicitly only runs when intent is supplied; no specimen-side gold.
- `inferred_intent` — no formal eval. Validated by cross-model agreement on 5 ad-hoc samples + manual judgment.
- `economy` — pair_axis registered (`_taut.txt` / `_slack.txt`) but no contrast pairs authored.
- `center_consensus` — measures robustness of inferred_intent's center field. Validated by dual-family agreement on 4 ad-hoc samples.

## Cross-model findings

After running ~20 diagnoses across the providers, characters emerge:

| Provider | Character |
|---|---|
| **Sonnet 4.6** | Charitable — re-interprets prose to find harmony. Good for confirmation, weak for catching declared-vs-realized gaps. |
| **Opus 4.7** | Discriminating — catches gaps Sonnet smooths over. Confidence sinks when it's reaching. |
| **DeepSeek V3.1** | Sharp Chinese narrative reading. Sometimes over-imaginative (case B inferred "流产" from minimal cues). |
| **DeepSeek V4 Flash** | Rich subtext detection when thinking is disabled. Hybrid model — defaults to thinking-on. |
| **Qwen3 Max** | Baseline reader proxy. When it doesn't see subtext that others do, your prose may be sub-text-only-for-careful-readers. |
| **Qwen Plus / Flash** | Sticky preferences. Single-family multi-sample on these is informative only if cross-checked with another family. |

For inferred_intent and intent_realization, **divergence between Sonnet and Opus is itself a signal** — if Sonnet says "matches intent" but Opus catches a gap, the prose probably has a partial implementation that polite readers will gloss over.

## Vendor-specific API knobs (institutional knowledge)

Painful trial-and-error condensed:

### DeepSeek

- V4 Flash defaults to **thinking on**
- Thinking mode **rejects forced tool_choice** (HTTP 400)
- Thinking mode **rejects `temperature` / `top_p` / `presence_penalty` / `frequency_penalty`** (HTTP 400)
- Correct disable: `extra_body: { thinking: { type: "disabled" } }`
- NOT `enable_thinking`, NOT `chat_template_kwargs.enable_thinking`, NOT `reasoning_effort: "minimal"` (this last actually returned a useful error showing the field is parsed but `minimal` isn't a valid value — allowed: `high`, `low`, `medium`, `max`, `xhigh`)

### Qwen (DashScope OpenAI-compat)

- qwen-flash, qwen-plus, qwen3-max are all hybrid-thinking
- Correct disable: `extra_body: { enable_thinking: false }` (flat boolean — different convention from DeepSeek)
- qwen-flash empirically worked even without explicit disable, but explicit is defensive
- Use endpoint `https://dashscope.aliyuncs.com/compatible-mode/v1`; do NOT use `dashscope-intl.aliyuncs.com` unless you have an international account (cross-auth fails 401)

### Architecture solution

Both vendor disables are applied at provider config level (`defaultExtraBody` in `providerIdToOpenAICompatConfig`), so every call inherits them. Per-call `extraBody` merges on top. Code: `src/lib/coach/_call.ts`.

## What this work has NOT proven

Honest list:

1. **Sample contamination.** Every contrast pair and ad-hoc sample was written by me. My stylistic bias is in the gold standard. The single biggest legitimacy gap.
2. **Short text only.** All specimens are 200-700 chars. Situate submissions are 800-2500. Long-form behavior is unknown (see "next" below).
3. **Single language.** All Chinese. Multilingual behavior untested.
4. **N=4 contrast pairs.** Statistically weak. 88% PDR has wide confidence intervals.
5. **No holdout testing.** Every specimen we validate against is one we also wrote or selected. The 36-specimen original corpus exists but hasn't been run through the new focused diagnosers.
6. **No human-author validation.** The coach action mapping (present → silent / implicit → indicate / absent → question) is a hypothesis. No writer has tested whether the suggested action is actually useful.
7. **Inferred_intent has no formal eval.** Validated only by cross-model agreement, which is a tautology if all models share training biases.
8. **Mixed-input fragility.** When the textarea contained two pasted samples (monitor + Chengdu) the diagnosers smoothly produced fluent nonsense, treating both as the same text. Real world has noisier inputs.

## Open methodological questions

- Should PDR threshold scale with axis difficulty? 70% might be too lax for stakes (K is a strong cue) and too strict for the_turn (endings are interpretively variable).
- 3-tier structure recurred for K, causal, intent_realization, economy. Hypothesis: every craft axis has this structure. Untested for the_turn, flat_subtext.
- Cross-model character is a real product input. We should formalize the per-model weights instead of treating them as equal.
- Dual-family vs triple-family (add a Western-trained cheap like haiku?) — unknown if a third family adds information or noise.
- "Editing the failing specimen until it passes" loop is data-fitting. At what point does it become methodologically dishonest? Currently no formal stopping rule.

## What's next (the actual roadmap, sorted by value)

Skip-able now:
- More PDR pairs (incremental, doesn't change anything)
- More diagnosers (we have enough to make decisions)
- Methodology theory work (won't change implementation)

Priority:
1. **Contrast pairs written by someone other than me** — eliminates the single biggest legitimacy gap. 4-6 pairs from any external writer is enough to materially change credibility.
2. **Long-form handling.** Current architecture untested on 1500+ char prose. Coach product must work there. See `long-form-handling.md` (companion doc, written same day).
3. **User testing.** 2-3 writers in front of coach-preview. Measures whether coach actions are useful, not just whether verdicts are accurate.
4. The 4-quadrant decision table → actual coach UI logic. The strongest derived insight from this whole project, currently still a mental model.

Lower priority but cheap:
5. economy contrast pairs (suffixes are already registered).
6. Run all 6 diagnosers against the original 36-specimen corpus for cross-population validation.

## See also

- `transformational-v0.md` — framework spec (the synthesis being tested)
- `next-steps-after-pdr.md` — earlier planning doc (mostly obsolete after PR #15-#22)
- `long-form-handling.md` — companion analysis of how the architecture might handle 1500-2500 char prose
- `src/lib/coach/diagnosers/` — actual diagnoser implementations
- `src/lib/coach/_call.ts` — provider abstraction layer, including vendor-specific defaults
- `src/app/dev/coach-preview/` — research UI used for all ad-hoc validation
