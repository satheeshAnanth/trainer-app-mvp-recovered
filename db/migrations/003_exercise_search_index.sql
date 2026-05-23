-- Enable pg_trgm extension (required for GIN trigram index)
-- This allows fast ILIKE / partial-string searches on text columns.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on master_exercises.name
-- Turns ILIKE '%squat%' from a full-table scan into an index lookup.
CREATE INDEX IF NOT EXISTS master_exercises_name_trgm_idx
  ON master_exercises USING GIN (name gin_trgm_ops);

-- B-tree index on category for filtered listing queries
CREATE INDEX IF NOT EXISTS master_exercises_category_idx
  ON master_exercises (category)
  WHERE COALESCE(is_active, 1) = 1;
