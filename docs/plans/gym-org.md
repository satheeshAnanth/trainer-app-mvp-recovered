# Gym org layer (v1)

**Status:** Implemented as an optional B2B layer on top of solo trainer tenancy.

## Product rules

- **Solo trainers unchanged** — signup, OTP login, client invites, sessions, schedule, payments work with `trainer_phones.gym_id = NULL`.
- **Gym = seats + light ops** — roster, invites, seat usage, aggregate counts only.
- **Trainer owns clients** — `clients.created_by_trainer` remains the ownership key. Removing a trainer from a gym does **not** move or delete their clients.

## Surfaces

| Who | How they sign in |
|-----|------------------|
| Platform admin | `/admin/login` (email/password) |
| Gym admin / trainer / client | **`/login`** — phone looked up in `gym_admins` / `trainer_phones` / `clients`; routes to the matching home |
| Trainer gym invite accept | `/gym-invite/[token]` (onboarding into membership) |

Homes after auth: gym → `/gym`, trainer → `/portal`, client → `/my-portal`.  
Legacy `/gym/login` redirects to `/login`.

## Schema

Migration: `db/migrations/005_gyms.sql`

- `gyms`, `gym_admins`, `gym_memberships`, `gym_invitations`
- `trainer_phones.gym_id` (nullable)

## Tenancy / privacy

Gym APIs under `/api/gym/*` return **counts and roster fields only**. They must never select session `payload`, notes, or client PII beyond what’s needed for seat ops (trainer phone/name on memberships).

## Billing

Active gym membership with gym `billing_status` in `active`/`trial` marks the trainer as access-`active` via `billingGuard` (`gymCovered`). Trial expiry reconcile skips trainers with `gym_id` set.
