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
| `src/app/actions.ts`                  | Server actions: insertion, translation upsert, bbox queries |

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
