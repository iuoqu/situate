-- Fix SRID on narrative_blocks.location.
--
-- drizzle-kit 0.31 (and drizzle-orm 0.36) accept `srid: 4326` in the
-- TypeScript schema but don't emit the SRID typmod in generated DDL — the
-- 0001 migration produces `geometry(point)` instead of
-- `geometry(point, 4326)`. As a result `geometry_columns.srid` is 0 and
-- `ST_MakeEnvelope(..., 4326)` raises "Operation on mixed SRID geometries"
-- when used against this column. This patch enforces the SRID at the type
-- level so the constraint is part of the schema, not just convention.
--
-- ST_SetSRID() rewrites every existing row's SRID metadata to 4326 (it does
-- not reproject coordinates — values must already be in WGS84, which is how
-- the application writes them).
ALTER TABLE "narrative_blocks"
  ALTER COLUMN "location"
  TYPE geometry(Point, 4326)
  USING ST_SetSRID("location", 4326);
