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
