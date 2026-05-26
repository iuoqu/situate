# Constitution v0.1 → v0.2 — Changelog

P13 commits us to updating in public. This is that record.

---

## Why v0.2

Three pressures forced a revision of the v0.1 constitution.

1. **A live AI editor surfaced gaps.** Running v0 of the AI pre-screener against test submissions made it clear that v0.1's P2 was doing two jobs at once — "categorical framing of populations" and "place-dependence of the story" — and the AI checker we could write for it was only credibly judging the second half. Splitting them into separate principles let us judge each independently and write more precise prompts.

2. **A user's stress test surfaced a missing principle.** A reader asked: if the Han Feizi *守株待兔* parable were not allegory but reportage — a real Song farmer, a real stump, Han Feizi as eyewitness — would we publish a modern equivalent? The answer led to a sharper formulation of what v0.1 P2 was actually rejecting: not the event, but the framing. v0.2 P2 keeps the framing rule; v0.2 P3 (new) keeps the place-dependence rule.

3. **Operational honesty on workload, bias, and machine reach.** v0.1 over-promised what automation could do — "60–70% workload reduction" was a guess, "auto-reject on AI detection" reproduced a known bias against non-native English writers, and several principles that turn on literary judgment were marked as machine-checkable. v0.2 walks these back in public.

---

## What changed

### New principles

- **P3 — Place Is Generative.** Split out of v0.1 P2. Asks whether moving the pin would break the story. Field 1's "relocation test" answer is judged against this principle.
- **P7 — The Gaze, Not the Topic.** New. Distinguishes subject from depiction style. Crime, sex, violence, addiction are welcome subjects; spectacle, titillation, scenery-of-suffering are not. Decided by a human editor on every published piece.
- **P11 — Reality, Disclosed.** New. Companion to P5. P5 protects real *persons* from non-consensual fictional depiction; P11 protects readers from real *events* labelled as invented.

### Renamed

- **v0.1 P5 (Historical Atrocities Are Not Source Material for Satire)** → **v0.2 P6 (Mass Suffering Is Not Material for Satire).** The new name lifts the scope from organised human violence to all mass suffering — natural disasters, pandemics, famines — while keeping the same line: the event's category is not the protection; the dead and the survivors are. The list of illustrative events is correspondingly broader (Tangshan, the 2004 tsunami, AIDS, COVID-19, alongside Shoah, Cultural Revolution, Rwanda, Trail of Tears, Nakba).

### Renumbered

| v0.1 | v0.2 | note |
| --- | --- | --- |
| P3 (Author Affinity) | P4 | new confidentiality carveout — see below |
| P4 (Fiction Is Not a License) | P5 | "deceased ≤ 10 years counts as living" made explicit |
| P5 (Historical Atrocities) | P6 | renamed, see above |
| P6 (Map Truth) | P8 | now explicit that we will move pins to nearby landmarks |
| P7 (Translation Fidelity) | P9 | irony-trigger broadened — see below |
| P8 (AI Disclosure) | P10 | explicit non-reliance on AI-detection classifiers — see below |
| P9 (Editorial Independence) | P12 | |
| P10 (This Constitution Is a Draft) | P13 | |

### Textual amendments (within principles that kept their identity)

#### P6 — "recency" replaced with "load-bearing memory"

v0.1's "any catastrophe of comparable scale and recency" was inconsistent with a list that spans 1944 to the present. "Recency" carries no useful operational meaning across an 80-year window. v0.2 replaces it with *"any documented catastrophe whose suffering memory remains load-bearing for living survivors and contemporary communities."* The judgment shifts from time-since-event to whether-the-memory-still-binds-the-living.

#### P9 — Reverse-translation trigger broadened

v0.1 P7 required human reverse-translation only when the work "depended on irony" — a single high-bar test. v0.2 P9 widens the trigger to **any of**: an author marking the work as satirical, the presence of cultural-rendering annotations, automated detection of ironic signals, length over 1,500 words, or an author whose stated affinity is *passing through* or *never been*. Irony detection in machine systems is sufficiently unreliable — especially across the rhetorical distance between Chinese cold-laughs, English deadpan, and Japanese *iyami* — that the bar for triggering human reverse-translation should be low, not high. We would rather over-trigger and pay the cost than let irony die in transit.

#### P10 — No auto-decline on AI-detection alone

v0.1's automated layer was prepared to auto-reject submissions on statistical AI-text-detection signal. v0.2 forbids this. The reasoning is in the principle text: AI-detection classifiers carry documented bias against non-native English writing (Stanford, 2023) and against minoritised dialects and registers; auto-decline on a single classifier verdict systematically discriminates against writers whose only "tell" is that English is not their first language. Where a detector flags a piece, a human editor reads it alongside the author's Field 5 disclosure. The verdict is not delegated to detectors.

#### P11 — Hierarchy with P5

v0.2 P11 closes a loophole in the consent / labelling layering: when a single piece appears to engage both real persons (P5 territory) and real events (P11 territory), the editorial citation defaults to P5. Consent for individual depiction takes precedence as the primary principle. P11 applies independently only when the labelling concern is the event itself and no identifiable real person is at stake. This avoids the situation where a single violation gets cited under two different principles and lets each principle do the work it was designed for.

### New disclosure field

#### P4 confidentiality carveout

v0.1 said outsider authors are welcome but did not say how a writer whose disclosure itself could endanger them should disclose. v0.2 P4 adds a confidentiality carveout: an author may tick a Field 2 checkbox requesting that their affinity be held in confidence, with a brief private reason. Where this is elected, the published piece displays a redacted affinity note in place of the usual *born there / lived there / …* label. Schema migration `drizzle/0004_p4_confidentiality.sql` adds the `affinity_confidential` boolean and `affinity_confidential_reason` text columns to the `submissions` table; the F2 form picks them up.

### Operational honesty (in-document notes, not enforceable principles)

- **Workload estimate corrected.** v0.1's pre-launch estimate of "60–70 % editor workload reduction" through automated pre-screening assumed several principles could be reliably auto-judged. v0.2 notes the realistic reduction is **40–50 %**, because P1 (Place as Inhabited Space), P7 (The Gaze), and several disclosure-consistency checks are deliberately human-decided on every published piece.
- **Calibration is a known gap.** v0.2 acknowledges that automated systems' confidence values are reported, not calibrated. Until 50+ submissions provide ground-truth labels, every high-confidence automatic rejection is reviewed monthly to verify calibration. This is internal practice, not a public commitment, but is stated in the constitution because P13 asks us to be public about what we are still learning.
- **Constitution / form coupling.** v0.2 explicitly couples the disclosure fields to the principles they map to. Minor field changes (wording, sub-questions) are tracked as `Form Schema vX.Y` in the operations log and do not require a constitution revision. A new principle, or a meaningful re-scoping, does.

---

## Decisions made under v0.1 remain interpretable

Per P13, every moderation decision in the audit log carries the principle version it was decided under (`P3:v0.1`, `P5:v0.1`, etc.). When we read those decisions back today, we read them against the v0.1 text — even though that text is now archived as superseded. v0.2 does not retroactively change any prior decision.

The v0.1 principles remain in the `editorial_principles` table, with `superseded_by` and `superseded_at` populated. The full v0.1 document is in [constitution-v0.1.md](./constitution-v0.1.md).

---

## What's next

v0.2 is the working draft. Items already on the v0.3 candidate list:

- A clearer definition of "deceased — long dead" for P5 — where the line sits (50 years? 100? "outside living memory"?).
- The form-schema versioning we now treat operationally should probably be linked from the constitution page itself, so readers can see which Form Schema a published piece was submitted under.
- We will revisit P6's illustrative list every six months and add cases in public.
- The "Operational Notes" section at the end of v0.2 is unusual for an editorial code — it may move to a separate Operations Handbook in v0.3 if it gets long enough to deserve one.

We expect more.

---

*Version 0.2 / drafted 2026-05-26 / Situate Editions*
