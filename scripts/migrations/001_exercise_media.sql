-- Run manually against Neon when enabling exercise media.
-- Safe to re-run: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS exercise_media (
  id               TEXT PRIMARY KEY,
  exercise_id      TEXT NOT NULL REFERENCES master_exercises(id),
  media_type       TEXT NOT NULL CHECK (media_type IN ('image', 'youtube_video')),
  youtube_video_id TEXT,
  title            TEXT,
  channel_name     TEXT,
  duration_seconds INTEGER,
  image_url        TEXT,
  image_attribution TEXT,
  status           TEXT NOT NULL DEFAULT 'pending_review'
                   CHECK (status IN ('pending_review', 'approved', 'rejected')),
  submitted_by     TEXT,
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  is_primary       BOOLEAN NOT NULL DEFAULT false,
  last_checked_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_media_exercise_idx
  ON exercise_media (exercise_id)
  WHERE status = 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS exercise_media_one_primary_idx
  ON exercise_media (exercise_id)
  WHERE is_primary AND status = 'approved';
