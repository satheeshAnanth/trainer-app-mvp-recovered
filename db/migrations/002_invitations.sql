-- Migration 002: Client invitation flow
-- Run once against your Neon database.
-- Safe to run even if the table already exists (uses IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS invitations (
  id            TEXT        PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token         TEXT        UNIQUE NOT NULL,
  trainer_phone TEXT        NOT NULL,
  client_name   TEXT,
  client_phone  TEXT        NOT NULL,
  client_goal   TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at   TIMESTAMPTZ,
  client_id     TEXT,       -- populated when the client accepts
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations (token);
CREATE INDEX IF NOT EXISTS invitations_trainer_idx ON invitations (trainer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS invitations_phone_idx  ON invitations (client_phone);
