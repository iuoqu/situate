-- 0014_path_b.sql
-- Path B (guided write) data fields on story_drafts.
--
-- drive_type      : §4 drive type ('purposive_art' | 'purposive_commercial' |
--                   'haunting' | 'unknown'). NULL = Path A (template, no map).
-- truth_declaration: §18 project-level fiction/reality status + flags, declared
--                   once before writing starts. See MapData shape in schema.ts.
-- map_data        : situate.map state — material, questions, answers,
--                   synthesis result, center name, center card. Append-only
--                   by convention (AI must not overwrite writer declarations).
-- act_data        : situate.act state — time shape, place shape, coordinates.
--                   Character arcs live in entities.attributes (Story Bible).

ALTER TABLE story_drafts
  ADD COLUMN IF NOT EXISTS drive_type text,
  ADD COLUMN IF NOT EXISTS truth_declaration jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS map_data          jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS act_data          jsonb NOT NULL DEFAULT '{}';
