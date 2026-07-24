-- 006_exercise_media_cache.sql
-- Optional durable URL for testing caches (Vercel Blob / mirrored GIF).
-- Proxy path in image_url stays as the app-facing path when using /api/workoutx/gif/*.

ALTER TABLE exercise_media
  ADD COLUMN IF NOT EXISTS cached_image_url TEXT;

CREATE INDEX IF NOT EXISTS exercise_media_cached_image_url_idx
  ON exercise_media (cached_image_url)
  WHERE cached_image_url IS NOT NULL;
