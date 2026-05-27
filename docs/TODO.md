# TODO

Snapshot at the end of the build-out session. Lives in the repo so it
survives between sessions and can be checked in PR diffs.

---

## In flight (parallel work)

- [x] **Editorial Constitution v0.2** — landed. 13 principles (P1–P13),
      `drizzle/seed_constitution_v02.sql` applied locally, v0.1
      superseded. `docs/constitution-v0.2.md` is the canonical text.
- [ ] **8 new AI-editor checkers for v0.2 principles** — P3 (Place Is
      Generative) is live at v0.2.1 (admits implicit dependence with
      structural-argument guardrail; see
      `docs/constitution-p3-v0.2.1-amendment.md`). Remaining: P1, P2,
      P6, P7 (literary-judgment checkers), P4, P5, P10, P11
      (disclosure-consistency checkers). P8 is a system check, P9 is
      a translator workflow trigger, P12/P13 are governance. See
      "Next AI editor work" below.

### Editor-side triage (now live)

- [x] **`editorial_priority_score`** — 0–100 sort signal for the editorial
      queue, computed alongside principle checkers. Backend-only;
      authors never see it; never used as a routing gate. See
      `docs/ai-editor-triage-rationale.md`.
- [ ] **Monthly bias audit cadence** — run the SQL audit in the
      rationale doc on the 1st of every month. If non-English source
      languages or `born_there`/`lived_there` non-English-context
      affinities cluster in the bottom quartile, revise the triage
      prompt.

### Next AI editor work

Order from the v0 judgment project's recommended sequence:

1. **P8 (Map Truth) — system check.** Geocode validation + private-address
   classification. Not an LLM call; uses Mapbox geocoding API + a
   privacy lookup. Add as `src/lib/ai-editor/checks/p8-map-truth.ts`.
2. **P11 (Reality, Disclosed) — flag, never reject.** When author claims
   FICTION but story contains documented-event details, flag for human
   review. Per v0.2 P11 final paragraph, citation precedence with P5
   matters.
3. **P5 (Fiction Is Not a License) — disclosure-consistency check.** When
   author claims FICTION + no real people, but story contains
   identifiable real-person signals (full names + biographical details
   that match a real person), flag for human review.
4. **P2 (Specificity over Category) — literary judgment.** Detect
   grammatical patterns like "people of X had a / are / always" and
   judge whether one individual's story is being offered as a verdict
   on a population.
5. **P10 (AI Disclosure) — flag only, never reject.** Statistical
   AI-text-detection runs as a flag for human review. Per v0.2 P10,
   the verdict is never delegated to detectors.
6. **P1 (Place as Inhabited Space) — flag, never reject.** Read the
   prose and judge whether the story knows it is not alone there.
7. **P6 (Mass Suffering) — flag for human review when keywords +
   tone match the v0.2 P6 list.** Always escalates to human.
8. **P7 (The Gaze) — density flag only.** Surface density of explicit
   content; final verdict is always human (v0.2 P7 Decision Authority).

---

## Map polish (deferred — "效果能用就行")

- [ ] **Tune flyover pacing.** Currently `SECONDS_PER_PIN = 4`, `speed:
      0.7`, `curve: 1.5`. If the intro feels too quick or too slow once
      seen on production, adjust together.
- [ ] **`rootMargin` of the scroll-driven IntersectionObserver.**
      Currently `-30% 0px -50% 0px` (middle 20% of viewport triggers).
      May want to bias toward the upper third so the map flies *as the
      reader starts a block*, not partway through.
- [ ] **Per-edition `lightPreset` and `mapStyle`.** Hardcoded to `dusk`
      in `story-map.tsx` to match Issue #1 "After Midnight." When Issue
      #2 has a different mood, this should live on the `editions` row
      (e.g. `editions.map_config jsonb` with `{lightPreset, basemap}`).
- [ ] **Mini-map on `/editions/[slug]`** showing every piece's first
      block as a pin, with the issue's chosen light preset. Helps the
      issue feel like a place-set.
- [ ] **Mobile sticky behaviour audit.** `min(360px, 42vh)` sticky map
      eats more than half the viewport on small phones. Maybe collapse
      to 24vh on `< 600px` width, or have a "Hide map" toggle.
- [ ] **A11y / reduced motion.** Honour `prefers-reduced-motion` —
      skip the auto flyover, just settle on fit-bounds.

---

## Read-side polish (before public launch)

- [ ] **`/stories/[id]` OG / Twitter card metadata.** `next/metadata`
      `generateMetadata` returning title + abstract + author + a static
      Mapbox image of the route. Required for any social share to look
      like a magazine cover instead of a URL.
- [ ] **Real cover image for Issue #1.** Currently a 404 placeholder
      (`images.example.com/situate/issues/1/cover.jpg`). Need either a
      commissioned photo / illustration or a generative-image experiment
      we can stand behind editorially.
- [ ] **Landing page upgrade.** Currently 3 buttons centered on
      off-white. Needs: latest-issue hero, editor's letter excerpt,
      a 3-piece "from the issue" preview, footer with about /
      constitution / submit / report. Reference: Granta, The Drift.
- [ ] **RSS feed `/feed.xml`** of Issue #1's pieces. Lets readers
      subscribe in a reader; needed before Lit Hub pitch.
- [ ] **`sitemap.xml` + `robots.txt`.** SEO baseline.
- [ ] **`/by/[author_id]` author pages.** Bio + linked affiliations +
      every piece by that author. Needed for the author's own
      promotion.
- [ ] **i18n of UI chrome.** Labels like "Reader language", "Access
      tier", "Back to the map", "Editor's letter", "Translation
      policy" are hardcoded English. Pick a library (`next-intl`
      recommended) and externalize strings for en/zh_CN/zh_TW/ja/ko.
- [ ] **Cultural-rendering switch in the reader UI.** The schema and
      `renderTranslation` support literal/transposed/explained, but
      there's no UI to switch them yet. Could be a small "rendering"
      pill near each annotated span.

---

## Write-side (next major scope)

- [ ] **`/submit` author submission form.**
  - [ ] Fields: title, abstract, source language (dropdown), satire
        disclosure, content flags (`realPlaces`, `realPersons`,
        `realOrgs`, `conflictZone`), author affiliations (P3 enforced
        via UX).
  - [ ] Multi-block UX: a Mapbox map you click to drop pins; for each
        pin an `event_date` + content textarea + (optional) cultural
        annotation editor.
  - [ ] Server submission lands the row in `submissions.status =
        'draft'` and queues for `ai_review`.
  - [ ] Captcha / rate limit (no auth yet).
- [ ] **`/admin/queue` editor dashboard** — list submissions by status,
      open one to read, approve/reject/request_changes citing
      principles by code. Behind Supabase Auth. The smallest credible
      implementation is a single-page table with one detail drawer.
- [ ] **AI review worker.** Background job that runs NER + sentiment on
      a new submission, posts the result into `moderation_decisions`
      as `layer='ai'`, flips status to `human_review` (or `draft` with
      a comment if it self-rejects).
- [ ] **Annotation editor for translators.** Inline UI to highlight a
      span in a translation, pick a kind (idiom/proverb/honorific/...),
      and fill in literal / transposed / explained renderings.
      Necessary for P7 to be a usable workflow rather than a SQL chore.
- [ ] **Report flow.** "Report this story (coming soon)" footer link
      becomes a modal that POSTs into the `reports` table with the
      reader's BCP-47 `locale`. Routes to `legal` queue depending on
      jurisdiction (NetzDG 24h SLA path).

---

## Voice-to-fiction onboarding (next major scope)

Reader-to-author pipeline: speak 5–10 min → AI structures → paragraph
co-edit → conversational disclosure → submit. Target: a reader with no
fiction-writing habit produces a publishable 1500–2500-word draft in
~30 minutes. Differentiator: no other fiction platform (Sudowrite,
Wattpad, 番茄作家助手, Inkitt) offers a guided voice-first scaffold.
Full design rationale in chat session 2026-05-27.

### Schema (Week 2 prerequisite)

- [ ] **`story_drafts` table** in `src/db/schema.ts` — private
      per-author draft state, separate from `submissions`. Columns:
      `location` (geometry), `place_description`, `language`,
      `voice_transcript`, `recording_duration_sec`, `structured_draft`,
      `current_text`, `edit_history jsonb`, `disclosure_chat jsonb`,
      `disclosures jsonb`, `stage`.
- [ ] **`draft_stage` enum**: `recording` / `transcribed` /
      `structured` / `editing` / `disclosure` / `ready`.
- [ ] **Migration `drizzle/0006_story_drafts.sql`**. Hand-written to
      preserve PostGIS SRID modifier (drizzle-kit 0.31 bug — same
      pattern as `0002_fix_geometry_srid.sql`).

### API routes (under `src/app/api/`)

- [ ] **`POST /api/transcribe`** — streaming, proxies OpenAI Whisper.
      $0.006/min. Browser uploads audio chunks; server streams text
      chunks back.
- [ ] **`POST /api/transcribe/suggest`** — Claude Haiku, mid-recording
      follow-up prompts. Returns `{ should_interrupt, questions }`.
      Only interrupt for missing characters / sensory detail /
      why-it-matters; never for style.
- [ ] **`POST /api/structure-draft`** — Claude Sonnet. Transcript +
      place info → prose-structured draft. **Prompt-level rules:**
      preserve speaker's voice, add no facts, mark gaps `[BRACKETED]`.
      Ephemeral-cache the system prompt. ~$0.05/call.
- [ ] **`POST /api/refine-paragraph`** — Claude Sonnet. Paragraph +
      action (`tighten` / `add_detail` / `rewrite`) → 3 alternatives
      with rationales. ~$0.01/call. Must not "literary-ify" the
      author's voice — pass a `voice_sample` to anchor style.
- [ ] **`POST /api/disclosure-chat`** — Claude Sonnet, multi-turn.
      Walks author through F1–F7 conversationally; pre-fills from
      story content; only asks what it can't infer.

### Components

- [ ] **`src/components/voice/VoiceRecorder.tsx`** — browser
      MediaRecorder, pause / resume / timer, 10-min cap, auto-save
      every 30s.
- [ ] **`src/components/voice/LiveTranscript.tsx`** — streaming text
      display + AI-prompt side panel that surfaces suggestions from
      `/api/transcribe/suggest`.
- [ ] **`src/components/draft/DraftCanvas.tsx`** — paragraph-level
      editor; left panel raw transcript (collapsible), right panel
      structured draft.
- [ ] **`src/components/draft/ParagraphAssist.tsx`** — hover-revealed
      buttons (`✂️ tighten` / `➕ add detail` / `🔄 rewrite`) → popup
      with 3 alternatives; writes accepted choice to `edit_history`.
- [ ] **`src/components/draft/DisclosureChat.tsx`** — conversational
      F1–F7 walkthrough; one question per turn with quick-pick options
      + free-text fallback.

### Implementation sequence

- [ ] **Week 1: Voice capture.** `VoiceRecorder` + `LiveTranscript` +
      `/api/transcribe` + `/api/transcribe/suggest`. Ship state: user
      records 5–10 min, sees streamed transcript with periodic AI
      prompts.
- [ ] **Week 2: Structured draft + drafts table.** Migration +
      `/api/structure-draft` + minimal `DraftCanvas` + save/resume.
      **MVP cut point — ship this if Week 3–4 slip and launch with
      manual editing only.**
- [ ] **Week 3: Paragraph co-edit.** `ParagraphAssist` +
      `/api/refine-paragraph` + edit-history tracking. The qualitative
      differentiator vs "AI writes for you" tools.
- [ ] **Week 4: Conversational disclosure + submission handoff.**
      `DisclosureChat` + `/api/disclosure-chat` + map draft fields to
      existing `submissions` insert + three-tier publish UI.

### Three-tier publication (depends on Week 4 ship)

- [ ] **L1 / L2 / L3 path** — replaces binary accept/reject:
  - L1 (Draft Box): AI editorial pass only; author-page visible; not
    in main feed.
  - L2 (Community Featured): AI pass + 5 community upvotes; community
    section visible; still not main feed.
  - L3 (Situate Editions): full editorial review (current bar).
  - DB: add `publication_tier` column or extend `submissions.status`
    enum.

### Cost & metric targets

- Per-submission AI cost **< $0.20** (Whisper $0.03–0.06 + Haiku
  suggestions $0.01–0.015 + ~3 Sonnet calls $0.15). At 1000 / mo:
  ~$200 / mo total LLM spend; covered by single-digit subscribers.
- Track post-launch:
  - "Start recording" CTR (target 5%+ of readers)
  - Recording completion at >3 min (target 60%+)
  - Structured-draft acceptance rate (target 70%+)
  - End-to-end completion record → submit (target 80%+)
  - Median total time record → submit (target <40 min)

### Open product questions

- [ ] **Voice language detection.** Whisper auto-detects but is
      unreliable on code-switching. Ask up front or auto-detect?
- [ ] **Mobile vs desktop entry.** Voice fits mobile; paragraph editing
      fits desktop. Where does the "speak" entry point live? Both?
- [ ] **Anonymous drafts.** Allow anon record-then-signup, or require
      auth first? Trades onboarding friction for storage / abuse risk.
- [ ] **L1 visibility default.** Author-page-only vs visible to logged-in
      subscribers. Affects whether early writers feel seen.

---

## Year-1 priority sequence (around voice-to-fiction launch)

Voice-to-fiction MVP, once shipped, exposes 4 known value gaps that
block conversion: no author downstream, weak reader discovery,
unproven first-time-writer retention, unproven reader payment
willingness. The 5 actions below close those gaps at low marginal cost
(~$15–30K total ex-prize). Order matters; do not skip ahead. Full
rationale: chat session 2026-05-27.

- [ ] **1. Ship voice-to-fiction Week 1–2 MVP first.** See
      "Voice-to-fiction onboarding" above. Validates the strongest
      unique value (30-min reader → author) before any GTM spend.

- [ ] **2. GTM first wave, concurrent with Week 1 ship.** Cross-ref
      the GTM section below: Lit Hub pitch + Substack editor's notes
      + Twitter/X account posting one excerpt + map flyover per day.
      Cost: editorial time only. Closes the reader-discovery gap.

- [ ] **3. Situate Prize, first edition.** ~$5K winner + $1K × 5
      finalists + $300 × 12 nominees ≈ $13K / year. Public call;
      3-person jury (1 founder + 2 outside writers / translators).
      Announce concurrent with MVP launch. Closes the
      author-downstream gap by signalling seriousness.

- [ ] **4. Sister-magazine reciprocal-publication agreements.** Sign
      3–5. Candidate list: Granta Brazil (pt), Asymptote
      (cross-language), one Spanish-language lit magazine, one
      Asian-English lit magazine, one French / German venue. Terms:
      free mutual reprint with attribution; no money changes hands.
      Closes the author-downstream gap — a story appears in 5
      markets, not 1.

- [ ] **5. Set 3-month and 6-month launch-retro dates.** Two
      calendared decision points after MVP ship. Metrics to review:
  - Voice-to-fiction conversion funnel (CTR → completion → publish).
  - L1 → L2 → L3 promotion rate (did anyone climb the ladder?).
  - Paid-subscriber count vs. target.
  - Sister-magazine cross-publish actual volume.
  - Prize submission count.
  - **Rule:** failing 3 of 5 at the 6-month review = re-strategize,
    not push harder.

---

## Infrastructure / ops

- [ ] **Supabase Auth.** Once admin/submit need real identity. Email
      magic-link is simplest; OAuth (GitHub/Google) for editor accounts.
- [ ] **`drizzle-orm` and `drizzle-kit` upgrade.** Currently on 0.36 /
      0.31 (drizzle-kit dropped the SRID in generated SQL — see
      `drizzle/0002_fix_geometry_srid.sql`). Newer versions may emit
      `geometry(point, 4326)` directly, letting us delete the patch
      migration.
- [ ] **Mapbox URL restrictions.** Tighten the public token in the
      Mapbox dashboard to only allow `localhost`, `*.vercel.app`, and
      the eventual custom domain. Currently unrestricted = anyone can
      reuse our quota.
- [ ] **Vercel function region.** Default is `iad1` (Virginia); our
      Supabase project is `ap-northeast-1` (Tokyo). Latency ~150 ms
      round-trip per query. Switch to `hnd1` once we're confident in
      the project to halve it.
- [ ] **Bootstrap.sql ↔ seed split.** Bootstrap currently does schema
      + 2-block demo seed in one file; `seed_demo_3block.sql` then
      replaces the demo. Cleaner: bootstrap = schema only, seed files
      separate. Refactor when the test surface is stable.
- [ ] **Drop `drizzle/fix_annotation_spans.sql`.** Superseded by
      `seed_demo_3block.sql`. Safe to remove once production has run
      the new seed.
- [ ] **CI**: at minimum, `npm run build` and `npm run db:generate`
      diff check on PRs. Vercel preview deployments already cover
      build-on-PR.

---

## Mapbox Studio (visual brand)

- [ ] **Custom Mapbox Studio style** with the editorial look — black /
      ivory / sienna palette, serif label typography, restrained
      density. Pin the style URL into `story-map.tsx` and
      `explore-client.tsx`. Goal: the map alone reads as a *Situate
      Editions* artifact, not a default Mapbox map.

---

## Reader acquisition (Year-1 GTM)

Pattern from 6 case studies (Atlas Obscura, LitHub, The Drift, MUBI,
Asymptote, Astra) reviewed in chat 2026-05-27: literary / curated
platforms grow on **partnerships + distinct voice + multi-channel
distribution**, over 5–10 year horizons. No 2-year explosion exists
in this category. Six actions, ordered by ROI.

### 1. LitHub-style partnership wave (highest ROI)

Benchmark: LitHub hit 1.2M monthly visitors in 18 months via 100+
content partners providing exclusive excerpts. Adapt to Situate:

- [ ] **Compile a 50-target partnership list.** Categories: international
      lit mags (Granta Brazil, Asymptote, The Drift, La Tercera, Caravan),
      independent publishers, translation institutions, travel-meets-
      literature media (Atlas Obscura editorial), literary podcasts.
- [ ] **Pitch one per week for 12 weeks.** Goal: 5–10 signed mutual
      reprint + cross-promo agreements by Year-1 end. No money;
      attribution + cross-link only.
- [ ] **Pitch Lit Hub a reading list:** *"10 Flash Stories That Could
      Only Have Happened in Their City"* — 5 of ours, 5 public-domain
      classics with our annotations. See
      [Lit Hub pitch page](https://lithub.com/how-to-pitch-lit-hub/).
- [ ] **Compile 6 translator-curator candidates** (ko / es / fr / de /
      pt / ja) with public work samples and contact surfaces. Retainer
      $500/mo + revenue share. These translators double as partnership
      channels into their own lit-mag networks.

### 2. Founder "Notes from the Editor" Substack (Elle Griffin model)

Benchmark: Elle Griffin's Substack made $19K Y1 by alternating fiction
with non-fiction craft / behind-the-story content — readers came for
craft, stayed for fiction. Adapt to Situate:

- [ ] **Weekly 1000–1500-word Substack** under your name. Cadence:
      editor's notes ("why I chose this piece"), place-behind-the-story,
      flash-fiction craft commentary. End every post with a Situate
      story link.
- [ ] **Excerpt as Substack Note + Twitter/X thread.** Keep full content
      on Substack so the audience accrues to that surface.

### 3. Multi-format distribution per piece (Granta model)

Benchmark: each Granta launch under John Freeman generated ~10
touchpoints (events, profiles, radio, digital trails). Adapt per
Situate piece — every story published triggers all five:

- [ ] **Twitter/X 5-tweet thread** — opener + 4 scene fragments + link.
- [ ] **Instagram 3-image post** — map screenshot + opening-paragraph
      typography + author/location image.
- [ ] **TikTok / Reels 60-sec video** — Mapbox flyover footage + author
      audio reading the first paragraph.
- [ ] **LinkedIn editor's-view essay** — 500 words on why this piece,
      what about this place.
- [ ] **Substack post** — full piece + behind-the-story (feeds Action 2).

### 4. Festival / institution binding (MUBI festival model)

Benchmark: MUBI's wedge was festival-circuit acquisition rights
(Cannes / Venice / Berlin). Literary equivalents: translation
institutes, book fairs, prize ceremonies. Adapt to Situate:

- [ ] **Apply to LTI Korea Q3 translation-grant cycle.** Subsidises
      KR↔EN translation pairs.
- [ ] **Pre-sell 1 cultural-institution partnership** — Goethe-Institut,
      Japan Foundation, or LTI Korea — for Year-1 PR + supply support.
- [ ] **Attend / present at 1–2 fairs per year** — Frankfurt, London
      Book Fair, AWP, PEN Translates events. Budget $2–5K each.
- [ ] **Festival-issue concept** — once a partnership exists, publish
      one Situate issue per major festival with their curated writers;
      invite festival jury as guest editors.

### 5. SEO / discoverability foundation

Benchmark: MUBI + Atlas Obscura both carry heavy long-tail SEO traffic
("weird places in Kyoto", "Tokyo documentary"). Adapt to Situate:

- [ ] **Per-story SEO completeness** — title / description / location
      `schema.org` markup. Coordinate with the existing
      `generateMetadata` task in "Read-side polish."
- [ ] **`sitemap.xml` + `robots.txt` baseline.** Coordinate with the
      existing item in "Read-side polish."
- [ ] **Geographic long-tail strategy** — each pinned story should rank
      for "[place name] short story" / "fiction set in [place]" within
      90 days of publication. Audit after Issue #2.

### 6. Pricing decision (carry-over)

- [ ] **Confirm pricing tiers** before `/subscribe` page goes live.
      Research-agent suggested $10/mo or $99/yr standard, $4/mo
      LatAm/SEA, $15/mo "patron" with printed postcard.

### Five-year reader-acquisition reality (sanity check)

Based on case-study back-projection (chat 2026-05-27):

| Year | Monthly visitors | Paid subs | Comparable |
|------|------------------|-----------|------------|
| Y1 | 5K–20K | 50–300 | early The Drift |
| Y2 | 20K–80K | 300–1.5K | early Asymptote |
| Y3 | 50K–200K | 1K–5K | early LitHub |
| Y5 | 100K–500K | 3K–15K | mature Asymptote / mid LitHub |
| Y10 | 500K–2M | 10K–50K | mature LitHub / The Drift |

### What NOT to do (failure patterns)

- **Print-first launch.** Astra Magazine (2022): launched April, dead
  by November despite "succeeding by every measure," killed by paper
  price + inflation + parent-company strategy shift.
- **100% paid-subscription bet.** Substack data: 0 fiction newsletters
  in top 50 earners. Asymptote 13 years in, still nonprofit-only.
- **Expensive ad acquisition.** CAC > LTV in literary niche; not
  recoverable at small-platform scale.
- **Short-term explosion targets.** Atlas Obscura: 16 years to profit.
  MUBI: 18 years to $1B. No platform in this category cleared in <5.

---

## Revenue model (Year-1 → Year-5)

Multi-stream design — no single revenue source carries the platform.
Patterns from comparables (Atlas Obscura, MUBI, LitHub, Asymptote,
Substack literary, Granta) in chat 2026-05-27 plus project-specific
economics. Eight streams, ordered by Year-1 contribution.

### Stream 1: Subscriptions (primary anchor, Year-1+)

Reader-paid monthly / annual. Pricing tiers (carry-over from Reader
acquisition Action 6; requires confirmation before /subscribe ships):

- **Standard:** $10/mo or $99/yr — NA / EU adults
- **Regional:** $4/mo — LatAm / SEA / India
- **Patron:** $15/mo with printed postcard — superfans

- [ ] **Confirm pricing tiers** before /subscribe page.
- [ ] **Annual-vs-monthly default.** Substack literary data: annual
      drives 60–70% of total sub revenue. Default annual on
      /subscribe.
- Y1 target: 50–300 paid = $3.6K–21K ARR
- Y3 target: 1K–5K paid = $72K–360K ARR
- Y5 target: 3K–15K paid = $216K–1.08M ARR

### Stream 2: Translation access tiers (Year-1+)

Existing `translationAccessTier` enum (`free` / `metered` / `premium`)
needs a coherent commercial strategy:

- **Free:** original-language + raw AI translation. Open to all.
- **Metered:** AI + light human pass. Limited reads / month for
  non-subscribers; unlimited for subscribers.
- **Premium:** full human polish. Subscriber-only.

- [ ] **`ai_post_edited` quota policy** (cross-ref Decisions pending).
      Starting point: 10 free metered reads / month, then paywall.
- [ ] **Premium tier inclusion bar.** Which translations get human
      polish — editorial pick of ~20% of pieces, or all L3 Editions
      tier (cross-ref Voice-to-fiction three-tier publication)?
- [ ] **Cost-to-revenue gating.** Human polish costs $20–200 per
      translation per language. Only stories above a readership
      threshold qualify, to avoid burning translation budget on
      unread pieces.

### Stream 3: Print anthology (Year-1+, modest breakeven)

Annual print volume — strong supply-side incentive (writers value
print) + modest revenue.

- [ ] **Anthology Volume 1** — curated picks from Year-1; 1000–3000
      print run; Amazon + indie bookstores; $15–25 retail. May slip
      to early Y2 if Y1 lead time runs out.
- Economics per volume:
  - Print + design + distribution: $20–40K
  - Sales: 500–2000 copies × $15–25 = $7.5K–50K
  - Y1 outcome: breakeven to modest loss (cultural capital >> cash)
  - Y3+: profitable as brand strengthens

### Stream 4: Workshops + cohorts (Year-2+)

Author training as revenue + supply-side onramp.

- [ ] **First Story 4-week cohort** — $30–50 / participant initially,
      scaling to $100–200 once curriculum matures. Output: 1
      submission-ready story per participant.
- [ ] **Advanced craft workshops** — $200–500 / 4-week course, led
      by Situate-published authors as a fellowship.
- Y2 target: 2–3 cohorts × 20 × $50 = $2–3K (validation)
- Y3 target: 4–6 cohorts × 20 × $100 = $8–12K
- Y5 target: 200–500 participants / yr at $150 avg = $30–75K

### Stream 5: Translation rights brokerage (Year-2+)

Help Situate authors sell foreign-language book rights. Commission
15–25%. Lumpy, probabilistic revenue.

- [ ] **Standard agency agreement template** with Situate authors
      (opt-in; nonexclusive; only for rights Situate brokers).
- Y2 realistic: 1–2 small deals = $0–10K
- Y5 realistic: 5–10 deals / year = $20–100K (if Situate becomes a
  recognized supply venue)

### Stream 6: Adaptation option fees (Year-3+)

Lottery-style revenue from film / TV / podcast options.

- [ ] **Adaptation rights clause** in standard publication agreement
      — Situate gets agent role with 10–15% commission. Requires
      legal review and an author-comms plan; promote to Decisions
      pending if Y2 rolls around without action.
- [ ] **Adaptation development fund** — $15–30K / yr to proactively
      option 3–5 stories. Most lose; outsized lottery upside if any
      get produced.
- Y3 baseline: 1–2 small option deals = $2K–20K.

### Stream 7: Grants + institutional partnerships (Year-1+)

Translation-focused literary platforms are unusually grant-eligible.

- [ ] **LTI Korea Q3 cycle** (cross-ref Reader acquisition Action 4).
- [ ] **Goethe-Institut / Japan Foundation** (cross-ref).
- [ ] **PEN Translates** — annual project grants up to £3K.
- [ ] **NEA translation fellowship** — up to $25K per project.
- [ ] **Banff International Literary Translation Centre** — residency
      + small stipend.
- Y1 realistic: $5–30K from 1–2 small grants
- Y3+ realistic: $30–100K if recognized in translation circles

### Stream 8: Brand partnerships (Year-3+, careful)

Atlas Obscura model — partnered storytelling for cultural / travel
brands. NOT advertising. Requires Y3+ brand strength.

- [ ] **Pilot 1 partnership** in Y2 with a travel-meets-culture brand
      (e.g. Wildsam, indie tourism board) to test format / pricing.
      $5–15K range.
- [ ] **Editorial firewall policy** — partnerships clearly labeled;
      selection criteria documented; constitution may need P14
      (sponsored-content disclosure) addendum before scaling.
- Y3+ realistic: $30–150K from 2–5 partnerships / year.

### Cost structure (key recurring)

- **AI inference (voice-to-fiction):** $0.20 / submission. 100 / mo
  = $20; 10K / mo = $2K / mo.
- **Translation (AI baseline):** ~$0.50 / translation / language.
  100 stories × 5 languages / mo = $250 / mo.
- **Translation (human polish, premium):** $20–200 per translation
  per language. Gated by Premium revenue.
- **Situate Prize:** $13K / yr (cross-ref Year-1 priority sequence).
- **Editorial team:** Editor + 2–3 part-time = $80–150K / yr (Y1
  lean: 1 editor at $40–60K).
- **Translator retainers:** 6 × $500 / mo = $36K / yr (cross-ref
  Reader acquisition Action 1).
- **Infrastructure:** Vercel + Supabase + Mapbox + Anthropic =
  $200–1000 / mo early, scaling with usage.
- **GTM (festivals, partnerships, travel):** $10–30K / yr.

### Year-by-year ARR scenarios

Three scenarios, using $6 / mo blended sub Y2+:

| Year | Pessimistic | Realistic | Optimistic |
|------|-------------|-----------|------------|
| Y1   | $5K         | $20K      | $50K       |
| Y2   | $15K        | $80K      | $200K      |
| Y3   | $50K        | $250K     | $600K      |
| Y5   | $150K       | $700K     | $2M        |
| Y10  | $400K       | $1.5M     | $4M        |

### Year-5 realistic ARR breakdown ($700K)

- Subscriptions: **$400K** (~5K subs × $80 / yr blended)
- Grants: **$80K** (3–5 small grants annually)
- Sponsorships: **$90K** (3–4 brand partnerships)
- Workshops: **$50K**
- Translation rights: **$50K**
- Anthology: **$30K**
- Adaptation upside: not counted (lumpy; treat as bonus)

### Open revenue questions

- [ ] **Patron tier scope** — Patron gets original-language only, or
      all premium translations? Affects perceived value.
- [ ] **Founding-subscriber lifetime deal** — $300 lifetime for first
      100 subscribers? Common indie-magazine tactic; trades Y1 cash
      for permanent supporter relationship. If yes, promote to Y1
      priority sequence.
- [ ] **Pay-what-you-want option** — for readers who can't afford
      $4 / mo regional pricing.
- [ ] **B2B / institutional subscriptions** — university / library
      subs at $500–2K / institution / year? Common for lit journals,
      viable Y2+; could become Stream 9 if validated.

---

## Decisions pending (need a human to pick)

- [ ] **`ai_post_edited` quota policy.** Schema says "metered" tier;
      product question is *how many per month per free reader*. 10?
      30? Unlimited but throttled?
- [ ] **Real-person policy for the dead.** P4 talks about *living*
      persons. Where does the line sit for deceased public figures,
      especially recent ones (within memory of children)? Constitution
      v0.2 candidate.
- [ ] **Cover image: photograph, illustration, or generated?** Each
      has cost / brand implications.
- [ ] **Custom domain.** `situate-zeta.vercel.app` is fine for
      development; for press it should be `situateeditions.com` or
      similar. Buy / point DNS when ready.

---

## Done in recent sessions

For reference / audit:

- [x] Drizzle ORM + Supabase Postgres + PostGIS schema (7 tables +
      enums + CHECK constraints + GiST index)
- [x] Server actions: createNarrativeBlock, addTranslation,
      getNarrativeBlocksInBoundingBox, recordModerationDecision,
      fileReport, edition lifecycle, publishPrinciple
- [x] Bootstrap SQL (one-paste Supabase setup)
- [x] Vercel deploy with main as production branch
- [x] `/explore` map (Mapbox Light, viewport-driven server action)
- [x] `/stories/[id]` permalink page with sticky 3D Mapbox Standard
      map, cinematic flyTo intro tour, scroll-driven flyTo while
      reading, localized labels by reader language, 3-stop demo story
- [x] `/editions/[slug]` issue page
- [x] `/about/constitution` rendered from DB, with 10-principle
      v0.1 (P1, P2, P7 also in 简体中文)
- [x] Cookie-persisted reader language + access tier preferences
- [x] Cultural-annotation rendering (literal/transposed/explained
      mechanism, per-language span positions)
- [x] Editorial-decision audit log with cited-principle snapshots
