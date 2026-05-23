-- Migration 003: Fast exercise search via GIN trigram index
-- Idempotent — safe if master_exercises does not yet exist (indexes skipped).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'master_exercises'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS master_exercises_name_trgm_idx
             ON master_exercises USING GIN (name gin_trgm_ops)';

    EXECUTE 'CREATE INDEX IF NOT EXISTS master_exercises_category_idx
             ON master_exercises (category)
             WHERE COALESCE(is_active, 1) = 1';
  ELSE
    RAISE NOTICE 'master_exercises table not found — skipping search indexes';
  END IF;
END $$;
