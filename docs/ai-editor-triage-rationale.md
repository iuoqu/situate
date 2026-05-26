# AI Editor Triage — Design Rationale

This document records the decision to use an AI-generated **editorial priority score** for back-end queue triage, the guard rails that scope its use, and the bias-monitoring commitment that comes with it.

Per P13 of the constitution, decisions like this belong in public. Per P10, we are explicit that detection-style classifiers cannot be the verdict. The triage score lives in the same intellectual territory: useful as one signal, dangerous as a gate.

---

## What this is, and what it is not

| It is | It is not |
| --- | --- |
| A 0–100 sort signal for the editorial queue | A literary quality judgment |
| Visible only on the editor dashboard | Shown to authors, ever |
| Computed once at submission time | Recomputed under different lenses to "shop" for a score |
| One of several priority signals (alongside word-count vs issue norm, author affinity distance, language uniqueness, cultural-annotation count) | The sole or primary sort key on the queue |
| Auditable: every score carries reasoning, per-signal craft assessments, uncertainties, and a bias self-check | A black-box number |

The name in code is `editorial_priority_score`, not `literary_quality_score`. The framing matters because once a system is named "literary quality," everyone — authors, editors, the model itself in future iterations — starts to treat it as the verdict it is not.

---

## Guard rails (enforced in code, not just policy)

1. **Never exposed to authors.** The `/submit/thanks/[id]` page reads `principle_judgments` and the latest ai-layer `moderation_decisions` row, but does not read `submissions.editorial_priority_*`. There is no path from the public surface to the score.

2. **Never used as a routing gate.** `engine.ts` runs the triage call in parallel with the principle checkers, but the resulting `triage` field is on `SubmissionReport` only as a *passenger*. `decideRouting()` does not read it. There is no threshold, no "score < N auto-rejects," and no plan to add one.

3. **Forced self-disclosure of uncertainty.** The `submit_engagement_score` tool requires the model to emit a `uncertainties[]` array and a `bias_self_check` string on every call. When the model is reading a piece in a tradition its training data underrepresents (Chinese miniaturism, Japanese *zuihitsu*, Latin American *microrelato*, etc.), it must say so. Editors read low-scoring pieces with this self-check in hand.

4. **Monthly bias audit.** We commit to running the SQL audit below at least monthly. If the bottom quartile by score is systematically populated by submissions in non-English source languages, or by authors whose affinity is `born_there` / `lived_there` for non-English contexts, that is a calibration debt. The remedy is prompt revision, not "downweight the audit."

---

## Why single-prompt-multi-lens, not multi-agent

A natural impulse is to run the same submission past several "agents" — a general reader, a literary critic, a regional specialist — and aggregate their scores. We chose not to, for v1:

- **Same base model = same biases.** Three Claude Sonnet personas share the same training data. The "diversity" of perspective is illusory; what looks like three viewpoints is a single distribution wearing three masks.
- **Multiplies cost without multiplying signal.** Three personas = 3× per-submission API spend. The marginal value over a well-structured single-prompt rarely justifies it.
- **Aggregation is its own problem.** Mean? Median? Disagreement-weighted? Each choice changes outcomes in ways we cannot defend without ground-truth data.

What the single prompt does instead: forces the model to report **six craft signals** (`opening_hook`, `voice`, `imagery`, `stakes`, `pacing`, `sentence_rhythm`), each rated `strong | moderate | weak` with a one-sentence note grounded in the text. The model also writes a holistic two-sentence rationale, lists 2–3 strengths and 2–3 concerns, and produces the `uncertainties` / `bias_self_check` outputs above.

**When to upgrade to true multi-agent.** Only under one of the following:

- We have run 100+ scored submissions and find a class of work systematically under-scored that single-prompt prompting cannot fix.
- We want to compare across **different base models** (Claude + GPT + Gemini), where "diversity" is real rather than role-played.
- An editor explicitly wants "model disagreement" as a signal (three models disagree → editor must read carefully).

Until then, single-prompt is the right call.

---

## Monthly bias audit (the SQL)

Run this query at least once per calendar month. Persistent skew is a finding, not noise — it triggers a prompt revision pass on the system prompt in `src/lib/ai-editor/triage/engagement-score.ts`.

```sql
-- Triage score distribution by author affinity
SELECT
  s.author_relationship,
  COUNT(*) AS submissions,
  ROUND(AVG(s.editorial_priority_score)::numeric, 1) AS mean_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.editorial_priority_score) AS median,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY s.editorial_priority_score) AS p25
FROM submissions s
WHERE s.editorial_priority_score IS NOT NULL
GROUP BY s.author_relationship
ORDER BY mean_score DESC;

-- Triage score distribution by source language
SELECT
  s.source_language,
  COUNT(*) AS submissions,
  ROUND(AVG(s.editorial_priority_score)::numeric, 1) AS mean_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.editorial_priority_score) AS median
FROM submissions s
WHERE s.editorial_priority_score IS NOT NULL
GROUP BY s.source_language
ORDER BY mean_score DESC;

-- Bottom quartile: who lands there?
WITH q25 AS (
  SELECT PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY editorial_priority_score) AS threshold
  FROM submissions WHERE editorial_priority_score IS NOT NULL
)
SELECT
  s.source_language,
  s.author_relationship,
  COUNT(*) AS bottom_quartile_count
FROM submissions s, q25
WHERE s.editorial_priority_score <= q25.threshold
GROUP BY s.source_language, s.author_relationship
ORDER BY bottom_quartile_count DESC;
```

**Red flags worth a prompt revision pass:**

- Mean score for any non-English source language is ≥ 10 points lower than English.
- Mean score for `born_there` / `lived_there` for a non-English context is materially below outsider affinity for English contexts.
- A specific form or tradition (asked-about by editors) appears disproportionately in the bottom quartile.

**Not a red flag:**

- High-variance is fine; we expect a wide score range.
- A small absolute gap that disappears with more data.
- Specific authors scoring low — the audit is at the population level, not the author level.

---

## What surfaces to the editor (when `/admin/queue` ships)

This UI does not exist yet. When it does, the editor will see for each submission in the queue:

- Title, author, language, word count.
- Editorial priority score (a 0–100 chip, colour-coded by quartile, **labelled as a triage signal, not a verdict**).
- Per-principle AI judgments (already in `principle_judgments`).
- The model's `uncertainties[]` and `bias_self_check` — surfaced prominently, not buried in metadata. If the model said "I likely under-scored sentence rhythm because this reads as Chinese intermissionist," that note appears next to the score.
- Author affinity distance flag (P4 redacted / `passing_through` / `never_been` for non-local context).
- Cultural-annotation count (P9 trigger signal).
- A "sort by priority" toggle alongside "sort by date submitted" and "sort by oldest in queue" — never the sole sort option.

The constitution v0.2 operational notes acknowledge editor workload reduction is 40–50 %, not 60–70 %. This score is the difference between those two numbers; everything below 50 % was already a human-only call.

---

## What happens if this turns out wrong

If we run six months and conclude that the triage signal is doing more harm than good — editors deferring to it, the bottom quartile is consistently non-Western work, or it's drifted into a *de facto* gate — the remedy hierarchy:

1. **Adjust the prompt.** Strengthen the bias self-check instructions; add explicit examples of forms the model under-weights.
2. **Reduce the surface.** Show only the `uncertainties` and `bias_self_check` to the editor; hide the numeric score.
3. **Disable it.** Set `editorial_priority_score` to NULL on all submissions and remove the sort option from the editor dashboard.
4. **Delete the columns and the code.** v0.2 calls this constitution a draft; this triage layer is even more provisional.

This document survives the deletion path. If we abandon the score, we keep the rationale here as the record of what we tried and why we stopped — so the next person who proposes "let's add an AI quality score" has the prior debate available to them.

---

*Drafted 2026-05-26 / referenced from constitution-v0.2.md and TODO.md*
