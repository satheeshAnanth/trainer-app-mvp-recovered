-- Admin console support: reversible client archive + audit actor notes.
-- Safe to re-run.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clients_trainer_archived_idx
  ON clients (created_by_trainer, archived_at);

CREATE INDEX IF NOT EXISTS trainer_phones_billing_trial_idx
  ON trainer_phones (billing_status, trial_ends_at);
