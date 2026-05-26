# Situate Editions — Editorial Constitution v0.2

**Version 0.2** · effective on publication

This document supersedes [v0.1](./constitution-v0.1.md). A [changelog](./constitution-v0.1-to-v0.2-changelog.md) records the changes between versions.

---

## Preamble

Situate Editions publishes flash fiction anchored to real places. Each story lives at the coordinates where it could only have happened. A map is a kind of claim: *this happened here, to people who could have been you*. Because we make that claim many times, across many languages, we have written down what we believe and how we decide.

We hope a story we publish leaves the reader, afterward, with one more *this is a specific person, not a kind of person* in their view of that coordinate.

Our model rests on three pillars: **author disclosure**, **automated verification**, and **human judgment where it matters**. Authors make binding commitments about their work before submission. We use automated systems to catch obvious violations and inconsistencies. We reserve human editorial judgment for the questions that require literary understanding, cultural knowledge, or ethical discernment — the questions machines cannot settle.

Authors disclose seven things when they submit: their relationship to the place they write about (P4), whether the story is fiction or drawn from reality (P3/P11), whether real people appear and whether they consented (P5), the role AI played in composition (P10), and any known risks (P6, P7). These disclosures are binding legal attestations. If an author later proves to have lied about any of them, the story is deleted, the account is permanently disabled, and we notify any person who was harmed.

Every declined submission cites a principle by code. Every published story has implicitly passed all of them. We write our standards in public because no single editor's judgment can hold a line across many languages. We expect to be wrong about something here. We commit to updating in public when that happens.

This is version 0.2. Prior versions live in our public archive.

---

## The Seven Disclosure Fields

Before submission, every author completes seven fields. These are not optional. Your signature on the form is a legal attestation.

### Field 1 — Coordinates & Place Generativity

> *Where is your story set, and why can it only happen there?*

The author attests: the coordinates I provide are real and verifiable. I cannot move this story to another place without breaking its central conflict.

- **Latitude / Longitude** (decimal, e.g. `35.6595, 139.7006`)
- **Why can this story only happen here?** (minimum 50 words)

**How we verify.** Coordinates are validated against public map data. Private addresses (homes, schools, clinics, places of worship) are rejected by the system (see P8). If the author writes "this story could work anywhere," the submission is auto-declined under P3. If the author claims place-dependence, a human editor may verify the claim against the story text.

### Field 2 — Your Relationship to This Place

> *How do you know this place?*

The author attests: my stated relationship to this place is truthful.

- Choose one: *born there* / *lived there (___ years)* / *worked there (___ years)* / *researched* / *passing through* / *never been there*
- Optional: **I request confidentiality for safety reasons.** (Reason: ___)

**How we verify.** All six relationship options are equally valid. If the author requests confidentiality, we honour it without further question and publish a redacted note alongside the piece. If the AI editor flags a mismatch between claimed affinity and the story's detail density, the case escalates to human review. Confirmed dishonesty results in account suspension and removal of the work.

### Field 3 — Fiction or Reality?

> *Is this story invented, or based on things that really happened?*

The author attests: if I say this is fiction, I have invented or sufficiently altered the core elements. If I say it's based on reality, the story derives from real events or real people.

- **FICTION** — invented, composited, or transformed so thoroughly that people cannot be recognised.
- **BASED ON REALITY** — drawn from real events or people I witnessed, experienced, or researched.

**How we verify.** If the author claims FICTION, the AI editor scans for real names, real dates, and specific identifiable events. Where it flags strong matches to documented people or events, the case is **referred to a human editor under P11** — not auto-declined, because historical-fiction stories often correctly engage real events. If the author claims BASED ON REALITY, they must complete Field 4.

### Field 4 — Real People & Consent

*(This field appears only if you chose "Based on Reality" in Field 3.)*

> *Are there real people in your story? If so, did they consent?*

The author attests: any real, identifiable person in the story has consented, or is a public figure in their public conduct, or is sufficiently transformed, or is deceased (and I disclose how long ago).

- *Does the story include real, identifiable people?* yes / no / n.a.
- If yes: *Do they have explicit consent?*
- If no consent: *Public figure? Deceased? Transformed?*
- *Brief description of who these people are.*

**How we verify.** The author's attestation is accepted as legal fact. We do not attempt to verify consent across multiple languages and jurisdictions. If a third party later disputes consent and the author's original disclosure proves false, the story is removed and the account suspended. **Where both Field 4 (real persons) and Field 3 (real events) are at issue in the same piece, P5 — consent for individual depiction — takes precedence as the primary cited principle.**

### Field 5 — AI in Composition

> *What role did AI play in writing this story?*

The author attests: my labelling of AI use is accurate.

- **No AI**
- **AI translation** (from another language)
- **AI editing** (copy-editing, structure, clarity)
- **AI creation** (text generation, plot ideas, dialogue)
- **Unsure**

If "AI creation" is checked, the story will be labelled "AI-assisted" or "AI-generated," not "human-written."

**How we verify.** The author's attestation stands. Where automated detection flags statistical markers of AI composition, a human editor reviews. **We do not auto-decline on the basis of detection alone.** Detection classifiers carry documented bias against non-native English writers (Stanford, 2023) and other minoritised registers; the verdict is not delegated to detectors.

### Field 6 — Known Harm Risks

> *Do you know your story might harm, offend, or involve someone?*

The author attests: if any box below is checked, I have considered the risks and am proceeding with full awareness.

- The story depicts a real, recently deceased person (≤ 10 years).
- The story involves a real, recent disaster or tragedy.
- The story references an ongoing conflict or trauma.
- I know a specific person or community will have a strong reaction.
- Other concern.

If any box is checked, briefly explain.

**How we verify.** Upfront disclosure is good-faith notice and earns more careful (not stricter) review. Hidden risks discovered later trigger faster escalation.

### Field 7 — Story Metadata & Legal Attestation

> *Basic facts about your submission.*

The author attests: everything in this form is true and accurate. I understand that lies result in account termination and removal of the work.

- Word count (800–2500)
- Source language
- Author name or pen name
- Author email

Four legal attestation checkboxes must be ticked:

- [ ] I have read and understand the active principles (P1–P13, v0.2).
- [ ] All information in this form is true and accurate.
- [ ] I am legally responsible for claims about real people's consent.
- [ ] I understand my story may be removed if legal issues arise.

---

## The Thirteen Principles

### P1 — Place as Inhabited Space

A real place is not a setting; it is somewhere people are. If a story names a city, a province, a village, that name belongs to the people who live there as much as to the writer. We do not publish work that empties a real place of its inhabitants, uses it as a thesis-stage, or treats it as a punchline. The story does not have to feature local characters. It does have to know it is not alone there.

> **Decision authority.** Automated systems may flag candidates; **human editors decide every case**. P1 is never the basis for automatic rejection.

### P2 — Specificity over Category

We publish fiction about specific people in specific places. Specificity is the price of being on the map — and the courtesy we owe to the people the map names. We do not publish work that uses one individual's story as a verdict on the people of a place. *A farmer waiting beside a tree stump* is a story. *The people of Song had a farmer who…* is a verdict, and the grammar betrays it. We publish the former. We decline the latter, however ancient the form, however well-turned the joke. Institutions and governments are not populations; they may be satirised.

### P3 — Place Is Generative

A story must depend on its coordinates in a way another setting could not replicate. Move the pin and the story should break. Geographic accuracy and stylistic polish are not enough: a universal drama dressed in local occupation, dialect, or scenery is still a universal drama. The test asks whether the story's central events and tensions need this place — not whether the protagonist carries a local biography. Aesthetic and lyrical attention to a place is not itself an event; a work that only describes the beauty of a place, without anything happening there, is not for us. We are not a publication of well-written stories. We are a publication of stories that owe their existence to where they are set.

### P4 — Author Affinity, Disclosed

Authors tell us their relationship to the places they write about: born there, lived there, worked there, researched there, passing through, never been. The disclosure runs beside the published story. Outsider work is welcome and often necessary — but the further an author stands from a place, the more closely the writing must look. Brilliance does not waive this; we will sometimes decline elegant work by writers who have not done the seeing. When disclosure itself could endanger an author, the editors hold the affinity in confidence and publish a redacted note in its place.

### P5 — Fiction Is Not a License

Real living people appear in our fiction only with their consent, as public figures depicted in their public conduct, or so transformed they cannot be recognised. The same applies to named businesses and small institutions where the staff are identifiable. Historical or fictional masks do not lift this protection: if contemporary readers in the work's geographic context would recognise the target, the principle applies as if the target were named. The point is not legal cover. The form does not, by itself, license what would otherwise be a trespass on a stranger's life. The recently deceased (≤ 10 years) count as living; the long dead do not.

### P6 — Mass Suffering Is Not Material for Satire

Mass suffering — the Shoah, the Cultural Revolution, the Rwandan genocide, the Trail of Tears, the Nakba; the Tangshan earthquake, the Great Chinese Famine, the 2004 Indian Ocean tsunami, the AIDS pandemic, COVID-19; **any documented catastrophe whose suffering memory remains load-bearing for living survivors and contemporary communities**, whether caused by humans, by nature, or by disease — is not material for satire, counterfactual revisionism, or formal play. The protection is for the dead and the survivors, not for the event's category. Fiction set during, after, or in the long shadow of these events is welcome and necessary, including satire of those who failed the moment — negligent officials, exploitative profiteers, denialists. Fiction that treats the suffering itself as raw material for cleverness is not. The list is illustrative; we extend it in public as cases arise.

### P7 — The Gaze, Not the Topic

Crime, violence, sex, addiction, abuse — all are subjects literature has always engaged, and they are welcome here. What we decline is work in which the depiction serves the reader's appetite rather than the work's purpose. Violence as spectacle, sex as titillation, drug use as cost-free transcendence, suffering as scenery — these we refuse, however polished the surrounding craft. The test is the gaze, not the topic. A war story can be either. A scene of sexual violence can be either. The work itself shows which.

> **Decision authority.** P7 is always decided by a human editor. Automated systems may flag candidates by surface density of explicit content, but cannot judge gaze.

### P8 — Map Truth

Coordinates must point to a real place where the story could plausibly be set. We do not pin to private homes, places of worship, schools, clinics, or any address whose exposure could harm its occupants. We will move a pin to a nearby public landmark when the story is otherwise sound, and we will note in the publication that we have done so. The map is a claim; we are careful what we claim.

### P9 — Translation Fidelity

Culturally loaded phrases are handled by a *literal / transposed / explained* mechanism rather than silent substitution. Translators sign their work. AI translations are labelled as such.

Any work whose effect depends on irony — satire, dark comedy, unreliable narration, deadpan — passes a reverse-translation review by a human translator in each published language before publication, regardless of how it was translated. We trigger this review broadly: when the author marks the piece as satirical, when the piece carries cultural-rendering annotations, when automated detection surfaces ironic signals, when the work exceeds 1,500 words, and when the author's relationship to the place is *passing through* or *never been*. We would rather over-trigger this review than let irony die in translation. Irony is the first thing a machine loses, and the last thing a reader notices is gone.

### P10 — AI Disclosure

We do not publish fiction whose composition or substantive revision was done by AI, presented as if written by a human. AI translation, AI copy-editing, and AI-assisted research are different categories with different labels. The line is not *no AI ever*. The line is *no deception about who wrote the sentences*.

**We do not auto-decline submissions on the basis of statistical AI-detection alone.** Such classifiers carry documented bias against non-native English writing (Stanford, 2023), against minoritised dialects and registers, and against writers whose first drafts read as unusually formal. Where an automated check raises a flag, a human editor reads the piece and the author's Field 5 disclosure together. The verdict is not delegated to detectors.

### P11 — Reality, Disclosed

Work submitted as fiction must be fiction in a meaningful sense: invented, composited, or transformed. If a piece is substantially a true account of a real event — whether the people in it are identifiable or not, whether the author was there or only heard — the author tells us. *"I only heard it"* does not lift the obligation; if the work treats a rumoured event as roughly factual, the reliance is real. We may publish disclosed work; we may publish it unchanged; we will not publish it under the wrong label. The map already invites the reader to believe; we will not cash in that belief without warning.

**Where a single piece appears to engage both real persons (P5) and real events (P11), the editorial citation defaults to P5.** Consent for individual depiction takes precedence as the primary principle. P11 applies independently when the labelling concern is the event itself and no identifiable real person is at stake.

### P12 — Editorial Independence

No advertiser, sponsor, or tourism partner influences which stories we publish, or how a place is framed within them. Money may buy a banner; it does not buy a verdict on a place, or the absence of one. When we accept partnerships, we say so on the page. When we decline them, we usually do not announce it — but we keep the list.

### P13 — This Constitution Is a Draft

Version 0.2. Prior versions live in our public archive. When a principle changes, decisions made under the prior principle remain interpretable by their code (`P3:v0.1`, etc.). We expect to be wrong about something here. We expect a reader to point it out before we notice. We commit to updating in public when that happens.

---

## Decision Authority

| Principle | Basis | Verifier |
|-----------|-------|----------|
| **P1** | Story itself | Human editor (automated *flag* only) |
| **P2** | Story itself | Automated system + human editor |
| **P3** | Author attestation (F1) + story | Automated system + human editor |
| **P4** | Author attestation (F2) | Author legally liable; AI may flag mismatch |
| **P5** | Author attestation (F4) | Author legally liable |
| **P6** | Author disclosure (F6) + human judgment | Human editor |
| **P7** | Story itself + literary judgment | **Human editor** (always) |
| **P8** | Author attestation (F1) | Automated system |
| **P9** | Story + translator judgment | Human translator (whenever reverse-translation triggered) |
| **P10** | Author attestation (F5) | **Human editor** (never auto-decline on detection) |
| **P11** | Author attestation (F3) | Author legally liable; automated *flag* only |
| **P12** | Editorial governance | Editorial board |
| **P13** | Governance | Editorial board |

---

## Operational Notes

**Throughput reality.** The constitution defines what we judge. The constraint is human editorial bandwidth. P7 (the gaze) is decided by a human editor on every published piece; P1 is also always human-decided. Automated pre-screening reduces editor workload by roughly **40–50 %** on a typical submission — less than the 60–70 % some pre-launch estimates suggested. We say this in public because honest workload numbers matter more than impressive ones.

**Confidence calibration.** Our automated systems report a confidence value for each principle judgment. In v0.2 we treat reported confidence as advisory only; threshold-based automatic rejection (currently used for P3) is one of the things we will calibrate empirically once we have ground-truth labels on 50+ submissions. Until then, every high-confidence automatic rejection is reviewed monthly to verify calibration. This is internal practice, not a public commitment, and is noted here because P13 asks us to be public about what we are still learning.

**Constitution / form coupling.** The seven disclosure fields appear in this document because we want authors to know exactly what their signature attests to. The fields themselves evolve more often than the principles do; minor field changes (rewording, adding a sub-question) are tracked as `Form Schema vX.Y` in the operations log and do not require a new constitution version. A new principle, or a meaningful re-scoping of an existing principle, does.

---

*Signed on behalf of Situate Editions, on the day this constitution takes effect.*
