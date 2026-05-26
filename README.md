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
| `src/db/schema.ts`                    | Tables, enums, and PostGIS geometry columns          |
| `drizzle/0000_enable_postgis.sql`     | Custom migration that enables the PostGIS extension  |
| `src/app/actions.ts`                  | Server actions for insertion and bbox queries        |

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
