-- Migration 002: Client invitation flow
-- Idempotent — safe to run even if the table already exists with a different schema.

CREATE TABLE IF NOT EXISTS invitations (
  id            TEXT        PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token         TEXT        UNIQUE NOT NULL,
  trainer_phone TEXT,
  client_name   TEXT,
  client_phone  TEXT,
  client_goal   TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending',
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at   TIMESTAMPTZ,
  client_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensively add any columns that may be missing from a pre-existing table.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS trainer_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_name   TEXT,
  ADD COLUMN IF NOT EXISTS client_phone  TEXT,
  ADD COLUMN IF NOT EXISTS client_goal   TEXT,
  ADD COLUMN IF NOT EXISTS client_id     TEXT,
  ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at   TIMESTAMPTZ;

-- Indexes (IF NOT EXISTS = no-op if already present)
CREATE INDEX IF NOT EXISTS invitations_token_idx   ON invitations (token);
CREATE INDEX IF NOT EXISTS invitations_trainer_idx ON invitations (trainer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS invitations_phone_idx   ON invitations (client_phone);
