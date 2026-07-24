-- 005_gyms.sql
-- Gym org layer: seats + light ops. Solo trainers remain unchanged (gym_id NULL).
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS gyms (
  id              TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  city            TEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended')),
  seat_limit      INTEGER NOT NULL DEFAULT 5 CHECK (seat_limit >= 1),
  billing_status  TEXT NOT NULL DEFAULT 'active'
                    CHECK (billing_status IN ('trial', 'active', 'expired', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gym_admins (
  id         TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  gym_id     TEXT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  name       TEXT,
  role       TEXT NOT NULL DEFAULT 'owner'
               CHECK (role IN ('owner', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gym_id, phone)
);

CREATE INDEX IF NOT EXISTS gym_admins_phone_idx ON gym_admins (phone);

CREATE TABLE IF NOT EXISTS gym_memberships (
  id            TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  gym_id        TEXT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_phone TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'invited'
                  CHECK (status IN ('invited', 'active', 'removed')),
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at     TIMESTAMPTZ,
  removed_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS gym_memberships_active_trainer_idx
  ON gym_memberships (trainer_phone)
  WHERE status IN ('invited', 'active');

CREATE INDEX IF NOT EXISTS gym_memberships_gym_status_idx
  ON gym_memberships (gym_id, status);

CREATE TABLE IF NOT EXISTS gym_invitations (
  id            TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  token         TEXT UNIQUE NOT NULL,
  gym_id        TEXT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_phone TEXT NOT NULL,
  trainer_name  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gym_invitations_gym_idx ON gym_invitations (gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gym_invitations_phone_idx ON gym_invitations (trainer_phone);

ALTER TABLE trainer_phones
  ADD COLUMN IF NOT EXISTS gym_id TEXT;

CREATE INDEX IF NOT EXISTS trainer_phones_gym_id_idx
  ON trainer_phones (gym_id)
  WHERE gym_id IS NOT NULL;
