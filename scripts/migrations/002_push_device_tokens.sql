-- Push notification device tokens (FCM). Run after 001_exercise_media.sql.

CREATE TABLE IF NOT EXISTS push_device_tokens (
  id              TEXT PRIMARY KEY,
  user_role       TEXT NOT NULL CHECK (user_role IN ('trainer', 'client')),
  user_key        TEXT NOT NULL,
  token           TEXT NOT NULL UNIQUE,
  platform        TEXT NOT NULL DEFAULT 'android',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_device_tokens_user_idx
  ON push_device_tokens (user_role, user_key);

CREATE TABLE IF NOT EXISTS push_notification_log (
  id              TEXT PRIMARY KEY,
  user_role       TEXT,
  user_key        TEXT,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  data_json       JSONB,
  token_count     INTEGER NOT NULL DEFAULT 0,
  success_count   INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
