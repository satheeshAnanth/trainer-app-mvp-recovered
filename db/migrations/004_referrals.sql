-- 004_referrals.sql
-- Adds referral_code (unique per trainer, used as public profile handle)
-- and referred_by (who invited this trainer to sign up).
-- Run once against your Neon database.

ALTER TABLE trainer_phones
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   TEXT;

CREATE INDEX IF NOT EXISTS trainer_phones_referral_code_idx
  ON trainer_phones (referral_code)
  WHERE referral_code IS NOT NULL;

-- Back-fill existing trainers with a random code so nobody is left without one.
UPDATE trainer_phones
SET referral_code = UPPER(
  SUBSTRING(
    REPLACE(REPLACE(REPLACE(REPLACE(md5(random()::text), '0', 'A'), '1', 'B'), 'i', 'C'), 'l', 'D'),
    1, 6
  )
)
WHERE referral_code IS NULL;
