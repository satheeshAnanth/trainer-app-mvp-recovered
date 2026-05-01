# Trainer App Recovery Context

## Product Scope
- Trainer-first app for session capture, client management, scheduling, and client sharing.
- Client-side portal supports profile, tips, and session visibility.
- Authentication flow is phone + OTP.

## Recovered Business Requirements
- Session notes have mandatory sections that must be completed before save/submit.
- Exercise logging is metric-driven:
  - each exercise has required metric keys (example: treadmill warm-up needs duration/incline/distance),
  - trainer can add custom metrics per exercise.
- Goal template has mandatory per-session progress updates.
- Clients can submit off-trainer sessions; trainer validates and approves/rejects.

## Confirmed Neon Schema (live)
- Core: `clients`, `sessions`, `calendar_events`, `calendar_event_notes`, `session_shares`, `invitations`
- Auth/user: `trainer_phones`, `client_users`, `otp_codes`
- Billing/audit: `billing_records`, `audit_events`
- Exercise system: `master_exercises`, `master_exercise_metrics`, `exercise_match_feedback`, `master_workbook_rows`

## Recovery Strategy
1. UI parity with legacy deployment (`trainer-app-mvp.vercel.app`) route-by-route.
2. Replace placeholder APIs with DB-backed handlers.
3. Enforce required templates/metrics through API validation and UI constraints.
4. Preserve mock fallbacks only where DB structures are still unclear.

## Validation rules (trainer sessions)
- **`draft` / `client_submitted` / `pending_notes` / most in-progress statuses:** no full payload validation on `POST /api/sessions` or `PATCH /api/sessions/[id]`.
- **`completed` / `signed_off` / `trainer_review`:** API requires `payload.sections` (`warmup`, `mainWork`, `cooldown`, `goalUpdate`), a non-empty `payload.exercises` array, and each exercise must expose all required metrics. Required keys come from `master_exercise_metrics` rows with `metric_value = Primary` plus `important_input_fields_json` on `master_exercises`, merged with any `metricRequired` array sent by the client (used when `DATABASE_URL` is unset). Keys are matched with canonical synonyms (duration, incline, distance, sets, reps, load, etc.).
- **`PATCH /api/sessions/[id]`:** loads existing row when using the DB; merges `payload` into stored JSON; runs the full checks only when the effective status is one of the completed-style statuses above.

## Auth and route protection
- **Trainer:** `trainer_session` cookie set by `POST /api/auth/otp/verify` (value = normalized phone). `middleware.js` protects `/portal`, `/clients`, `/schedule`, `/profile`, `/sessions`. Unauthenticated users go to `/login?next=…`.
- **Client:** `client_session` cookie set by `POST /api/client-auth/otp/verify` (JSON with `clientId` + phone). Middleware protects `/my-portal`. Unauthenticated users go to `/client-login?next=…&reason=registration_required`.
- **Client eligibility rule:** client mobile must already exist in the `clients` table (trainer-added record). `POST /api/client-auth/check-phone` and `POST /api/client-auth/otp/send|verify` return a user-facing “talk to your trainer” message if not found.
- **Recovery / no `DATABASE_URL`:** client auth still uses mobile + OTP, but checks against `mockData.clients`. Trainer/client OTP mock code remains `123456`.

## Autonomous Build Constraints
- Allowed actions: code edits, commits, pushes, deploy attempts.
- Never rewrite git history or force push.
- Never commit secrets (`.env.local` stays ignored).
- Record milestone status in `docs/WORKLOG.md`.

## Milestones
1. Sessions pages parity (`/sessions/new`, `/sessions/[id]`, `/sessions/pending-notes`).
2. Clients detail parity (`/clients/[id]`, goal template, tips).
3. Profile + my-portal parity.
4. API POST/PATCH flows for sessions/comments/schedule with DB persistence.
