-- Migration 001: Two-way trainer-client messaging thread
-- Run once against your Neon database.

CREATE TABLE IF NOT EXISTS client_messages (
  id            TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  trainer_phone TEXT        NOT NULL,
  client_id     TEXT        NOT NULL,
  sender_role   TEXT        NOT NULL CHECK (sender_role IN ('trainer', 'client')),
  body          TEXT        NOT NULL CHECK (char_length(body) > 0),
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_messages_thread_idx
  ON client_messages (trainer_phone, client_id, created_at DESC);
