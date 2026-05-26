# Situate Editions

Geospatial storytelling platform — MVP database foundation.

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- Supabase (Postgres + PostGIS)
- Drizzle ORM (`postgres` driver)

## Layout

| Path                                  | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `drizzle.config.ts`                   | Drizzle Kit configuration                            |
| `src/db/index.ts`                     | `postgres` client + Drizzle `db` instance            |
| `src/db/schema.ts`                    | Tables, enums, PostGIS geometry, multilingual translations |
| `drizzle/0000_enable_postgis.sql`     | Custom migration that enables the PostGIS extension  |
| `drizzle/0003_submit_form_and_ai_editor.sql` | Adds submit-form columns + `principle_judgments` table |
| `src/lib/ai-editor/`                  | AI editor pipeline (engine + per-principle checkers) |
| `src/app/submit/`                     | Public submission form (multi-scene, AI pre-screen)  |
| `src/app/actions.ts`                  | Server actions: insertion, translation upsert, bbox queries, submit + AI review |

## Data model

- `submissions` — one flash-fiction piece, with `source_language` and an
  editorial pipeline (`draft → ai_review → human_review → published`).
- `narrative_blocks` — spacetime anchors for the piece. Each block has a
  PostGIS `geometry(point, 4326)` location and an event date. **No text**
  lives on this table; content is always stored as a translation row so the
  original and every translation are first-class peers.
- `block_translations` — `(block_id, language, method)` is unique. `method`
  is one of `original | ai | ai_post_edited | human`. `is_premium` gates
  paid human-polished translations. `annotations` (JSONB) carries culturally
  loaded spans (idioms, proverbs, wordplay) with multiple renderings
  (`literal | transposed | explained`) so readers can switch at runtime.

### Supported languages (Phase 1)

`en` (primary), `zh_CN`, `zh_TW`, `ja`, `ko`. Extending the
`supported_language` enum requires a Drizzle migration (`ALTER TYPE ... ADD
VALUE` for additions; rename/remove is destructive).

### Translation access tiers

| Tier      | Used by         | Reader sees        |
| --------- | --------------- | ------------------ |
| `free`    | `original`, `ai`| Always             |
| `metered` | `ai_post_edited`| Free with quota — app enforces rate-limit |
| `premium` | `human`         | Paywalled          |

### Default cultural rendering

`DEFAULT_CULTURAL_RENDERING = "literal"`. Unauthenticated readers see the
faithful, slightly foreign rendering by default (e.g. Chinese idioms render
literally rather than being transposed into English proverbs). Authenticated
readers can switch to `transposed` (localized) or `explained` (annotated)
at read time via `renderTranslation()`.

### Reading priority (viewport query)

For a given `readerLanguage` and `accessLevel`, the bbox query returns one
row per block, picking the best available **published** translation in this
order:

1. `human` in `readerLanguage` (premium)
2. `ai_post_edited` in `readerLanguage` (metered)
3. `ai` in `readerLanguage` (free)
4. `original` (falls back to source language, free)

Rows whose `access_tier` exceeds the reader's `accessLevel` are excluded
from the result set.

### Moderation pipeline

Submissions move through `draft → ai_review → human_review → published`.
Every decision (AI scan, human editor, legal/ops) is logged to
`moderation_decisions` with `layer`, `decision`, `rationale`,
`flagged_entities`, and `cited_principles` (code+version snapshot pointing
at `editorial_principles` rows). Reader-submitted `reports` carry a BCP-47
`locale` so ops can route by jurisdiction (24h SLA for `de-*` under
NetzDG, `droit de réponse` for `fr-*`).

### Editions (the magazine layer)

Each issue is a row in `editions` (numbered, slugged, with editor's letter
+ cover image + publish date). A submission is either:

- **Issue-bound** — `edition_id` set; visibility gated by the parent
  edition reaching `status='published'`. Submissions are ordered within an
  issue by `position_in_edition` (partial unique index on
  `(edition_id, position_in_edition)`).
- **Evergreen** — `edition_id IS NULL`; visibility gated only by the
  submission's own `status='published'`.

A CHECK constraint on `editions` blocks advancing past `planning` until
`editors_letter`, `cover_image_url`, and `publish_at` are all set —
"half-built issue can't ship" enforced at the database.

### Public submission form + AI editor

`/submit` is the public submission surface. Authors fill the 7-field spec
(coordinates + relocation test, affinity, fiction-or-reality, real-people
consent, AI usage, risks, attestation) — multi-coordinate is supported
(1–6 scenes per piece). On submit, the server:

1. Persists the submission + one `narrative_blocks` row per scene + the
   `method='original'` translation in a single transaction.
2. Sets `submissions.status = 'ai_review'`.
3. Runs the AI editor synchronously: each enabled principle in
   `src/lib/ai-editor/principles/` is its own `claude-sonnet-4-6` call
   with `tool_use`-forced structured output. Calls run in parallel.
4. Records one `principle_judgments` row per checker (verdict +
   confidence + key_quote + token usage) and one aggregate
   `moderation_decisions` row with `layer='ai'`.
5. Updates `submissions.status` based on the routing decision:
   - `AUTO_REJECT` (any FAIL ≥ 0.85 confidence) → `'draft'` (returned
     to the author with the cited principles).
   - `HUMAN_REVIEW` (any UNCERTAIN or `human_review_needed`, or any
     checker failed unreachable) → `'human_review'`.
   - `PASS_TO_EDITOR` (all PASS) → `'human_review'` fast-lane — never
     auto-publish (P9 / P10).

`ANTHROPIC_API_KEY` must be set in the environment. If unset, the AI
editor degrades gracefully: all checkers fail-soft and submissions land
in `'human_review'` with a "AI editor unreachable" rationale.

### Deploy steps (new database)

1. Run `drizzle/bootstrap.sql`
2. Run `drizzle/seed_constitution_v01.sql`
3. Run `drizzle/seed_demo_3block.sql` (optional demo)
4. Run `drizzle/0003_submit_form_and_ai_editor.sql`

Existing deploys just need step 4.

### Editorial constitution

`editorial_principles` is the versioned public ruleset that governs every
moderation decision. Each row is one `(code, version)` pair (e.g.
`P2:v0.1`), with i18n title + body + accepted/declined examples. Old
versions are kept; a new version sets the predecessor's
`superseded_by`/`superseded_at`. Audit-log rows in `moderation_decisions`
snapshot the principle codes they cited so the log remains coherent across
later edits to the constitution.

## Database setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your Supabase
   Postgres connection string. Use the **direct** connection (port 5432) for
   migrations.
2. Install deps: `npm install`.
3. Apply migrations: `npm run db:migrate`.
   - The pre-baked `0000_enable_postgis.sql` migration runs first and issues
     `CREATE EXTENSION IF NOT EXISTS postgis;` so subsequent generated
     migrations (which reference `geometry(point, 4326)` columns and GiST
     indexes) succeed.
4. After editing `schema.ts`, run `npm run db:generate` to produce a follow-up
   SQL migration, then `npm run db:migrate` to apply it.

> Tip: you can also enable PostGIS from the Supabase dashboard
> (Database → Extensions → `postgis`) before running migrations. The custom
> SQL file above is idempotent and safe to apply either way.
