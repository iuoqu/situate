# TODO

Working notes for Situate Editions. Lives in the repo so it survives
between sessions and can be checked in PR diffs.

Last refresh: end-of-session after Milestone A+ (template-write path,
per-section locations, author dashboard).

---

## Active priorities — pick from here next

Ordered by what most unlocks product value. Each item links to the
section below with the detailed scope.

1. **Milestone B — Story Bible + Coaching + Pearls** ([details](#1-milestone-b))
   The next major direction: a structured "brain" captured during
   writing that drives translation, diagnostics, and growth. Includes
   the Pearls (遗珠) carveout for non-place-anchored fiction.
2. **DisclosureChat** — folded INTO Milestone B (the Story Bible
   replaces the chat as the disclosure-capture mechanism). Kept here
   as a name for reference.
3. **Editor queue (`/editor/queue`)** — internal triage surface;
   prerequisite for the Pearls workflow (editors move P3-failing
   submissions to Pearls consideration). ([details](#2-editor-queue))
4. **Paragraph co-edit** — editor edits, author accept/reject. ([details](#3-paragraph-co-edit))
5. **Voice path** — `/write?mode=voice`. Premium tier promise. ([details](#4-voice-path))
6. **Tier publishing (L1/L2/L3) finalize flow** — enum exists; UI
   doesn't. ([details](#5-tier-publishing))

---

## Detailed scope per priority

### 1. Milestone B

The next major direction. Frames Situate not just as a publication but
as a writing platform whose structured data drives three things:
**writing (coaching), translation (multilingual rendering), teaching
(growth path)** — all sharing one brain.

**Key positioning decisions** (locked):

- **Stay flash-only for now.** AI editorial doesn't scale to long form.
  Schema kept flash-shaped (no `works → scenes → blocks` reshape).
- **Stay literary-only for now.** Tradition profiles ship as flash
  variants only (`flash_situate_anchored`, `flash_situate_pearls`,
  `literary_minimalism`, etc.) — no genre fiction profiles
  (升级流 / 言情 / 推理 / 惊悚).
- **Single brand (Situate).** Writing tool and magazine are one
  product. Preserves a future pivot to long-form or genre if real
  demand appears (e.g. a wave of 玄幻 submissions).
- **Pearls (遗珠) carveout for non-place-anchored fiction.**
  Hemingway "Hills Like White Elephants" type work. P3 bypassed in
  this section; every other principle applies.

**Pearls (遗珠) operational rules** (locked):

- 5% rate cap is a **soft metric** — quarterly review, not enforced.
- Pearls **without** a coordinate display on the map at `(0, 0)` —
  in the Gulf of Guinea. Distinct visual from real pins (different
  shape / colour). Multiple clusters at exact 0,0 expand on click.
- Pearls **may** still tag a coordinate (the railway station in
  "Hills" has a station, just not a generative one). Authors tag
  freely; readers see what the author chose to surface.
- Pearls use the **same Situate Spine template**, but **sections are
  deletable** (1-5 sections allowed, not always 5). The template is
  a scaffold, not a contract.
- Pearls are surfaced **only by editorial discretion** — authors do
  not self-route. P3-failing submissions get routed by editors at
  triage time.
- Constitution v0.3 (adds P14 — Pearls) ships **later**, after 2-3
  real cases through the carveout. Until then, P14 lives only in
  this TODO. See "Constitution v0.3 candidate" below.

**Slicing plan** (recommended order; each is shippable on its own):

- **B.1 — Pearls minimum viable**
  - Migration: `submissions.publication_section enum('main', 'pearls')`,
    default `'main'`. `submissions.publication_tier numeric(1)`
    nullable (L1/L2/L3 — fills in B.6).
  - Migration: `story_drafts.tradition_profile_id text`,
    default `'flash_situate_anchored'`.
  - File-based traditions registry: `src/lib/traditions/registry.ts`
    + `flash-situate-anchored.ts` + `flash-situate-pearls.ts`.
  - `/write` adds a tradition selector (or quiet default for v1;
    accessible via "Advanced ▾" toggle).
  - TemplateEditor: section delete button (X) when tradition allows.
    Pearls allows; anchored doesn't.
  - Review page: tradition-aware gating. Pearls skips "Section 1
    must have a coord" check.
  - `/explore`: Pearls markers — pin at exact 0,0 if no coord, at
    the tagged coord otherwise; different marker style.
  - `/editions/[slug]`: subsection for Pearls in the issue TOC.
  - `/editor/queue` (later) gets the "Route to Pearls" action.
- **B.2 — Story Bible data layer**
  - Tables: `entities`, `entity_name_renderings`, `relationships`,
    `postures`, `elisions`, `story_units`.
  - All FK to `story_drafts.id`; bible travels with draft.
  - Submit handoff: serialise the bible into
    `submissions.submission_form` jsonb snapshot (audit trail).
- **B.3 — Inline capture UI**
  - On every autosave, run an entity + relationship extraction pass
    (async, Claude tool-call). Surface results as 2-suggestion-max
    chips in the editor margin.
  - Author confirms / edits / rejects each. Updates bible tables.
  - Story Bible sidebar shows live bible state.
- **B.4 — Story unit gate per section**
  - Per-section card showing S0 / D / T / S1 / K slots + 3
    predicate indicators (transformed / causal / stakes).
  - AI fills slots as a *suggestion* once a section has 200+ words.
  - Author confirms / edits. Failure type (descriptive / essayistic
    / expository) surfaces as a single Socratic coach question, never
    red-pen.
- **B.5 — Coaching engine v1**
  - File-based diagnoser registry:
    `src/lib/coach/diagnosers/*.ts`.
  - Each diagnoser: signature `(draft, bible, tradition) => Finding[]`.
  - One coaching event surfaces at a time (highest leverage).
  - `coaching_events` table logs everything (surfaced or not).
  - Tradition profile's `diagnostic_set` field picks which diagnosers
    run for that profile (e.g. Pearls disables place-related ones).
- **B.6 — Multilingual rendering driven by bible**
  - Translation generation reads `entity_name_renderings` and
    `relationships.register_overrides` instead of free-text translating.
  - Reader UI surfaces register choices ("polite / casual") where
    bible has multiple. Click-through to bible entry for any name.
  - L1/L2/L3 tier publication can finally finalize: tier decides
    how much translation polish each piece gets (L1 = raw AI, L2 =
    AI + light human pass, L3 = full human polish).

Each slice is ~4-8h. Total ~30-40h. Run alongside the other
priorities (B doesn't block editor queue or paragraph co-edit).

---

### 1.a. DisclosureChat (legacy spec — now folded into Milestone B)

A chat-shaped interview between AI and author that runs after the
draft is written but before submit. Purpose: surface unstated
disclosures that P5–P7 of the constitution require.

Implementation:

- New stage in `draft_stage`: `disclosure` (already in the enum from
  0009 — unused right now).
- New route between "Continue to review" and the AssemblyView:
  `/write/template/[id]/disclosure`.
- Server reads `draft.sections[]`, builds a focused prompt
  ("Are there real people in this story? Real events? Recent
  disasters?") with Claude tool calls.
- Author answers in chat. Each answer updates
  `story_drafts.disclosure_chat` (jsonb append-only) and
  `story_drafts.disclosures` (jsonb dict of resolved values).
- When the AI is satisfied (all required questions answered), it sets
  `draft.stage = 'ready'` and surfaces "Continue to review →".
- AssemblyView then prefills the submission's `content_flags`,
  `sensitivity_warnings`, `risks_explanation`, `consent_status`,
  `consent_explanation` from `draft.disclosures`. The "Why this place?"
  field stays manual.

UX gotcha: skippable when the AI judges no disclosure flags apply
(pure fiction, no real places, no sensitive content). The chat should
feel like editorial care, not a customs interview.

Effort: ~6h (the schema already exists; this is a new route + Claude
streaming + small chat UI).

### 2. Editor queue

`/editor/queue` (auth-gated, editor role only):

- Table view of `submissions WHERE status IN ('ai_review',
  'human_review', 'revisions_requested')`.
- Sort by `editorial_priority_score` (already computed by the AI
  triage pass).
- Each row: title, author, age, AI verdict summary, status.
- Click → `/editor/submissions/[id]`:
  - Read prose + blocks on a small map (reuse `<MapboxMap>` from
    `/explore`).
  - AI report (per-principle judgments) right side.
  - Action panel: Request changes / Accept / Reject (citing principle
    codes), set publish tier (L1/L2/L3) at acceptance time.
  - Editorial comments thread (new table needed:
    `submission_comments`).

Roles & auth: needs an `editor` claim on the Supabase auth user
(custom claim or a `user_roles` table). Decide approach before this.

Effort: ~10h (auth role plumbing + queue UI + detail page).

### 3. Paragraph co-edit

Once an editor has read a submission, they may want to edit specific
paragraphs and let the author accept/reject. This is the surface that
makes "human_review" a real editing pass, not just an approve/reject
gate.

Implementation:

- New status: `revisions_proposed` (sibling to `revisions_requested`).
  Editor's edits are *suggestions* until author commits them.
- New table: `block_revisions` with `(block_id, proposed_by_user_id,
  proposed_at, original_content, proposed_content, status:
  pending/accepted/rejected, accepted_at)`.
- Editor view: render each block as a paragraph, click to enter edit
  mode, write the suggestion, "Suggest change". Multiple suggestions
  per block allowed.
- Author view (`/my/submissions/[id]`): suggestions appear inline as
  diff-render. Author clicks Accept (rewrites the
  `block_translations.content` for `method='original'`) or Reject.
- When all suggestions are resolved, editor moves to final accept /
  request more changes.

Out of scope here: full version history of every paragraph edit. We
keep the last accepted text and the rejected proposals only.

Effort: ~12h. Most of it is UI — the data shape is small.

### 4. Voice path

`/write?mode=voice` (currently the "Speak it" coming-soon card):

- Re-use `/demo/voice` infra (it already has the recording UI and
  Whisper transcribe wiring).
- Replace the demo's destination with `POST /api/structure-draft`:
  - Input: transcript text + author's pinned coordinate(s).
  - Output: a `story_drafts` row pre-populated with `sections[]`
    that map the transcript onto Situate Spine sections.
  - Sets `template_id = 'situate-spine'`, `voice_transcript = ...`,
    `stage = 'structured'`.
- Redirect into the existing `/write/template/[id]` editor — the
  template flow takes over from there.
- Behind a Premium gate: requires `auth.users.app_metadata.tier =
  'premium'`. Stripe integration is a separate workstream; for the
  closed beta we can set the flag manually on invited testers.

Cost: ~$0.10 per voice draft (Whisper transcript + Claude structure).
Bundle 100 drafts in the $10/mo plan, throttle past that.

Effort: ~8h (the structure prompt is the hardest part).

### 5. Tier publishing

The enum is in place (`published_l1`, `published_l2`, `published_l3`)
but nothing reads from it yet. The editor's "Accept" action needs to
choose a tier; the `/stories/[id]` and `/explore` and `/editions/[slug]`
pages need to filter by it.

Concrete work:

- Add `submissions.publication_tier` numeric column (1/2/3) — easier
  to query than parsing the enum suffix. Backfill from status at
  migration time.
- Update the read-side queries to use the new column for filtering.
- Add a UI affordance in the editor accept flow to choose the tier.
- L1 vs L2 vs L3 routing rules:
  - L1: open feed, anthology-eligible.
  - L2: anthology pick (queued for the next print issue).
  - L3: print + anthology + Prize-eligible.

Effort: ~4h.

---

## Active workstream: AI editor checkers (v0.2)

8 new principle checkers for the v0.2 constitution. P3 is live at
v0.2.1; remaining sequence (from v0 judgment project's order):

1. **P8 (Map Truth)** — system check. Geocode validation +
   private-address classification. Not an LLM call; uses Mapbox
   geocoding API + a privacy lookup. Add as
   `src/lib/ai-editor/checks/p8-map-truth.ts`.
2. **P11 (Reality, Disclosed)** — flag, never reject. When author
   claims FICTION but story contains documented-event details,
   flag for human review.
3. **P5 (Fiction Is Not a License)** — disclosure-consistency check.
   FICTION + no real people claim, but story contains identifiable
   real-person signals.
4. **P2 (Specificity over Category)** — literary judgment. "People
   of X are/have/always..." pattern detection.
5. **P10 (AI Disclosure)** — flag only. Statistical AI-text detector
   surfaces; verdict never delegated.
6. **P1 (Place as Inhabited Space)** — flag, never reject. Does the
   prose know it is not alone there.
7. **P6 (Mass Suffering)** — keywords + tone match → human review.
8. **P7 (The Gaze)** — density flag only.

### Editor-side triage (now live)

- [x] `editorial_priority_score` — 0–100 sort signal computed
      alongside principle checkers. Backend-only; never shown to
      authors. See `docs/ai-editor-triage-rationale.md`.
- [ ] **Monthly bias audit cadence**. Run the SQL audit in the
      rationale doc on the 1st of every month. If non-English source
      languages cluster in the bottom quartile, revise the triage
      prompt.

---

## Read-side polish (before public launch)

- [ ] **`/stories/[id]` OG / Twitter card metadata.** `next/metadata`
      `generateMetadata` returning title + abstract + author + a static
      Mapbox image of the route.
- [ ] **Real cover image for Issue #1.** Currently a 404 placeholder.
      Commissioned photo, illustration, or generative-image
      experiment we can stand behind editorially.
- [ ] **Landing page upgrade — Pass 2.** Recent landing-polish commit
      added the hero meta strip + SVG world map + newsletter signup;
      still want: latest-issue hero, editor's letter excerpt, 3-piece
      "from the issue" preview.
- [ ] **RSS feed `/feed.xml`** of Issue #1's pieces.
- [ ] **`sitemap.xml` + `robots.txt`.**
- [ ] **`/by/[author_id]` author pages.** Bio + linked affiliations +
      every piece by that author.
- [ ] **i18n of UI chrome.** Labels still hardcoded English in
      multiple places. Externalize strings for en/zh_CN/zh_TW/ja/ko.
- [ ] **Cultural-rendering switch in the reader UI.** Schema supports
      literal/transposed/explained; no UI to switch yet.

---

## Map polish (deferred — "效果能用就行")

- [ ] **Tune flyover pacing.** Currently `SECONDS_PER_PIN = 4`,
      `speed: 0.7`, `curve: 1.5`.
- [ ] **`rootMargin` of the scroll-driven IntersectionObserver.**
      Currently `-30% 0px -50% 0px`. May want to bias toward the
      upper third.
- [ ] **Per-edition `lightPreset` and `mapStyle`.** Hardcoded to
      `dusk` for Issue #1. Move to `editions.map_config jsonb`.
- [ ] **Mini-map on `/editions/[slug]`** showing every piece's first
      block as a pin.
- [ ] **Mobile sticky behaviour audit.** Sticky map eats > half the
      viewport on small phones.
- [ ] **A11y / reduced motion.** Honour `prefers-reduced-motion` —
      skip the auto flyover.
- [ ] **Custom Mapbox Studio style** with the editorial palette
      (black / ivory / sienna). Pin the style URL into `story-map.tsx`
      and `explore-client.tsx`.

---

## Infrastructure / ops

- [x] **Supabase Auth.** Magic-link + password sign-in both live;
      `/auth/set-password` for setting a password. Closed beta gated
      via invite codes + `Allow new users to sign up = OFF`.
- [ ] **Editor role / claim.** Needed before `/editor/queue` ships.
      Decide: custom JWT claim via Supabase function, or a
      `user_roles (user_id, role)` table.
- [ ] **`drizzle-orm` and `drizzle-kit` upgrade.** Currently on 0.36
      / 0.31. Newer versions may emit `geometry(point, 4326)`
      directly, letting us delete `drizzle/0002_fix_geometry_srid.sql`.
- [ ] **Mapbox URL restrictions.** Tighten the public token to
      `localhost`, `*.vercel.app`, the custom domain.
- [ ] **Vercel function region.** Default `iad1` (Virginia); Supabase
      is `ap-northeast-1` (Tokyo). Switch to `hnd1` to halve
      round-trip latency.
- [ ] **Bootstrap.sql ↔ seed split.** Bootstrap does schema + demo
      seed in one file. Cleaner: bootstrap = schema only.
- [ ] **Drop `drizzle/fix_annotation_spans.sql`.** Superseded by
      `seed_demo_3block.sql`.
- [ ] **CI**: at minimum `npm run build` and `npm run db:generate`
      diff check on PRs.
- [ ] **Trash cron.** Hard-delete `story_drafts` rows that have been
      `stage='trashed'` for more than 30 days. Supabase cron extension
      or a Vercel cron route.
- [ ] **Migration ordering doc.** `0009` and `0010` are referenced in
      runtime code but applied manually via SQL Editor. Add a
      `docs/migration-runbook.md` that lists current schema HEAD so a
      new env knows which to run.

---

## Constitution v0.3 candidate (defer publish; capture intent here)

Two pending amendments to the v0.2 constitution. We do **not** ship
these to `docs/constitution-v0.3.md` yet — Milestone B is exercising
the Pearls carveout in practice first, so we can revise the text
with real cases in hand.

### P14 — Pearls (new principle)

Stories that do not satisfy P3 (place-generativity) may, in
exceptional cases, be accepted into the Pearls section. Pearls
bypass P3 only. Every other principle (P1, P2, P5, P6, P7, P10,
P11) applies with full force.

**Decision authority.** Pearls are surfaced only by editorial
discretion. Authors do not self-submit for Pearls; an editor reading
a P3-failing submission may, in the rare case of overwhelming craft,
redirect it.

**Rate.** Pearls are expected at roughly 5% of total publication
volume over any rolling 12-month window. Soft metric — published
annually but not enforced. Climbing rate indicates P3 is too lax;
near-zero rate may indicate editors are too conservative.

**Display.** Pearls are clearly labelled and grouped separately in
the publication TOC. Their map markers are visually distinct from
anchored stories.

### P10 v0.3 — AI-coach carveout

Refine the AI-composition vs AI-assistance line. Insert before the
existing P10 text:

> *Distinguished from the categories below: an **AI coach** that
> surfaces diagnostics, asks Socratic questions, or proposes
> structural annotations on the author's own prose does not
> constitute AI composition. Authors using a coach disclose so
> under "AI editing"; they are not labelled "AI-assisted" unless
> they also accepted AI-generated text into the prose.*

This codifies what Milestone B's coaching engine actually does:
it does not write sentences, it surfaces observations and asks
questions. Currently P10's three categories (translation / editing /
creation) don't distinguish coaching cleanly; an author using the
coach today would arguably need to mark "AI editing" even though
the AI never edited anything — only diagnosed.

---

## Decisions pending (need a human to pick)

- [ ] **`ai_post_edited` quota policy.** Schema says "metered"; how
      many per month per free reader? 10? 30? Unlimited but throttled?
- [ ] **Real-person policy for the dead.** P4 talks about *living*
      persons. Where does the line sit for deceased public figures,
      especially recent ones?
- [ ] **Cover image: photograph, illustration, or generated?**
- [ ] **Custom domain.** Buy / point DNS when ready.
- [ ] **Stripe integration for the Premium tier.** Decide:
      Stripe Checkout (fastest) vs Customer Portal (cleaner long-term)
      vs Lemonsqueezy (handles EU VAT for us).
- [ ] **Account email change.** Supabase supports it natively; do we
      surface it in `/auth/set-password` page or in a separate
      `/account` settings page?

---

## GTM (parked, not engineering work)

- [ ] Pitch Lit Hub a reading list: *"10 Flash Stories That Could
      Only Have Happened in Their City"* — 5 of ours, 5 public-domain
      classics with our annotations.
- [ ] Apply to LTI Korea Q3 translation-grant cycle.
- [ ] Compile 6 translator-curator candidates (ko/es/fr/de/pt/ja).
- [ ] Pre-sell 1 cultural-institution partnership (Goethe-Institut,
      Japan Foundation, KLTI).
- [ ] Confirm pricing: $10/mo or $99/yr standard, $4/mo LatAm/SEA,
      $15/mo patron with printed postcard.

---

## Recently shipped

### Milestone A+ — template-write path, locations, author dashboard

- [x] `story_drafts` table + `draft_stage` enum + RLS policies
      (`drizzle/0009_story_drafts.sql`).
- [x] `story_drafts.draft_id` ↔ `submissions.draft_id` back-link,
      `submissions.author_user_id` FK, status enum extended with
      tiered + lifecycle states (`drizzle/0010_lifecycle.sql`).
- [x] Situate Spine v0.1 — 5-section template, file-defined registry
      at `src/lib/templates/`.
- [x] `/write` EntryChoice (3 paths: Write it / Speak it
      coming-soon / Quick form).
- [x] `/write/template/[id]` TemplateEditor with 600ms debounced
      autosave, localStorage mirror, `sendBeacon` on pagehide.
- [x] `SectionLocationPicker` — per-section inline Mapbox pin +
      reverse-geocoded place name + forward inheritance.
- [x] `Section1Hooks` — AI hook generator wired into Arrival, reuses
      `<HookSelector>` + `/api/prompt-suggestions`.
- [x] `/write/template/[id]/review` AssemblyView — multi-pin map
      with numbered markers, per-section location chips.
- [x] `/api/drafts/[id]/submit` handoff — `submitFromDraft` action
      validates word count + relocation test + section coords,
      inserts `submissions` + `narrative_blocks` +
      `block_translations` in one transaction, fires AI editor.
- [x] `/my` author dashboard — 4 tabs (In progress / Submitted /
      Published / Trash) with live counts.
- [x] `/my/submissions/[id]` — status banner per state, assembled
      prose, AI editor report, withdraw button.
- [x] Trash workflow — soft delete (`POST /trash`) +
      restore (`POST /restore`) + hard delete (`POST /delete-permanent`,
      only from trash).
- [x] Withdraw re-opens linked draft (`stage` flips back to
      `editing`) so the author can revise + resubmit without losing
      their sections.
- [x] `/write` "Continue your draft" panel — surfaces the most
      recent in-progress draft so authors don't spawn ghosts.

### Auth & dev experience

- [x] Supabase magic-link login (closed-beta gated by invite codes).
- [x] Password sign-in alongside magic link — tabs at the top of
      `/auth/login`.
- [x] `/auth/set-password` — set or change password from any
      signed-in session.
- [x] Removed temporary dev-login backdoor (`DEV_LOGIN_SECRET` env
      var no longer referenced anywhere).

### Earlier (pre-this-session — for audit)

- [x] Drizzle ORM + Supabase Postgres + PostGIS schema.
- [x] Server actions: `createNarrativeBlock`, `addTranslation`,
      `getNarrativeBlocksInBoundingBox`, `recordModerationDecision`,
      `fileReport`, edition lifecycle, `publishPrinciple`.
- [x] Bootstrap SQL (one-paste Supabase setup).
- [x] Vercel deploy with `main` as production branch.
- [x] `/explore` map (Mapbox Light, viewport-driven server action).
- [x] `/stories/[id]` permalink page with sticky 3D Mapbox Standard
      map, cinematic flyTo intro tour, scroll-driven flyTo.
- [x] `/editions/[slug]` issue page.
- [x] `/about/constitution` rendered from DB.
- [x] Cookie-persisted reader language + access tier preferences.
- [x] Cultural-annotation rendering (literal/transposed/explained).
- [x] Editorial-decision audit log with cited-principle snapshots.
- [x] `/submit` form (the Quick-form path — multi-block map +
      relocation test + disclosures + legal attestation).
- [x] AI-editor v0 (per-principle checkers + report rendering).
- [x] Constitution v0.2 (13 principles) + P3 v0.2.1 amendment.
- [x] Landing-page polish (hero meta strip, SVG world map,
      newsletter signup, Edited from Singapore).
