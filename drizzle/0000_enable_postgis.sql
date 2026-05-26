-- Enable PostGIS so geometry columns and GiST indexes in subsequent
-- migrations can be created.
--
-- Portable across hosts: on Supabase this can also be enabled from
-- Database → Extensions in the dashboard (their convention is to install
-- extensions into the `extensions` schema). Installing into the default
-- schema works fine because we reference functions unqualified
-- (ST_MakeEnvelope, ST_Intersects, …) and Supabase's default search_path
-- includes both `public` and `extensions`.
CREATE EXTENSION IF NOT EXISTS postgis;
