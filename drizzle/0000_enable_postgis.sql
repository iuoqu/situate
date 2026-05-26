-- Custom migration: enable the PostGIS extension before any schema migrations
-- that reference `geometry` columns or GiST indexes are applied.
--
-- Supabase exposes the `extensions` schema for installable extensions; we
-- install PostGIS there to keep `public` clean. Both forms are accepted, but
-- this matches Supabase's documented convention.
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
--> statement-breakpoint
-- Make sure the extension's functions/types are resolvable from `public` and
-- whatever search_path Drizzle uses at migration time.
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
