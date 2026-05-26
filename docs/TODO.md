# TODO

Snapshot at the end of the build-out session. Lives in the repo so it
survives between sessions and can be checked in PR diffs.

---

## In flight (parallel work)

- [ ] **Editorial Constitution v0.2** — being refined in a separate
      conversation, starting from a stress-test of P2 (the Han Feizi
      hypothetical: separating *event* from *categorical framing*). When
      v0.2 lands, drop it into `drizzle/seed_constitution_v02.sql`,
      mark v0.1 as superseded, run on Supabase.

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

## GTM (parked, not engineering work)

- [ ] Pitch Lit Hub a reading list: *"10 Flash Stories That Could Only
      Have Happened in Their City"* — 5 of ours, 5 public-domain
      classics with our annotations. Use the
      [Lit Hub pitch page](https://lithub.com/how-to-pitch-lit-hub/).
- [ ] Apply to LTI Korea Q3 translation-grant cycle. Pays into
      eligible projects; subsidises supply-side cost for KR-en
      translation pairs.
- [ ] Compile 6 translator-curator candidates (1 each for
      ko / es / fr / de / pt / ja) with public work samples and contact
      surfaces. Retainer model: $500/mo + revenue share.
- [ ] Pre-sell 1 cultural-institution partnership (Goethe-Institut,
      Japan Foundation, Korea Literature Translation Institute) for
      Year-1 PR + supply support.
- [ ] Decide pricing: research-agent suggested $10/mo or $99/yr
      standard, $4/mo LatAm/SEA, $15/mo "patron" with printed
      postcard. Confirm before /subscribe page.

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
