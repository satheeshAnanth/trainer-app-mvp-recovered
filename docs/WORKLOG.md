# Recovery Worklog

## 2026-04-30

### Completed
- Recovered scaffold deployed to GitHub and Vercel.
- Neon schema introspected and mapped in API payload layer.
- Login parity started (dark auth screen with stepper and phone entry card).
- Trainer shell started (`/portal`, `/clients`, `/schedule`) with dark/mint dashboard style.
- Milestone 1 complete: sessions routes rebuilt (`/sessions/new`, `/sessions/[id]`, `/sessions/pending-notes`) with mandatory-note and exercise-metric UI sections.
- Milestone 2 complete: client detail routes rebuilt (`/clients/[id]`, `/clients/[id]/goal-template`, `/clients/[id]/tips`).
- Milestone 3 complete: trainer profile + client portal routes rebuilt (`/profile`, `/my-portal`, `/my-portal/profile`, `/my-portal/schedule`, `/my-portal/self-log`, `/my-portal/tips`).
- Milestone 4 complete: added DB-backed write handlers (`POST`/`PATCH`) for sessions, session status, session comments, schedule event notes, and schedule event status.

### In Progress
- Persist goal-template field values to DB.

### Blockers
- Vercel deployment intermittently failing with platform-side `deploy_failed` / `Unexpected error` despite clean local builds.

### Next Up
1. Persist per-client goal-template metrics (schema or JSON column) and wire Save on goal-template page.
2. Harden middleware + session checks (role claims in cookie vs server session store).
3. Add client-facing “talk to trainer” onboarding route from blocked login state.

## 2026-05-01

### Completed
- Server-side validation for non-draft trainer sessions: mandatory `payload.sections`, at least one exercise, and required metrics per exercise (DB catalog + `metricRequired` when DB is off).
- Shared helpers: `app/lib/metricKeys.js`, `app/lib/exerciseCatalog.js`, `app/lib/sessionValidation.js`, `app/lib/payloadMerge.js`.
- Real `GET /api/exercises/master/search?q=&withKeys=1` against `master_exercises` + `master_exercise_metrics` / `important_input_fields_json`.
- `/sessions/new` wired to client picker, catalog search, dynamic metric fields, **Save draft** vs **Complete session**.
- `PATCH /api/sessions/[id]` merges existing `payload_json` before validating and only overwrites payload when the request includes `payload`.

## 2026-05-01 (session 2)

### Completed
- Validation scope tightened: full mandatory payload checks only for `completed`, `signed_off`, and `trainer_review` (so `pending_notes` and drafts can save without blocking).
- `/sessions/[id]` shows and edits structured sections + exercise metrics; save and **Mark complete** send merged `payload`; quick **Mark pending notes** still uses the status endpoint.
- `/sessions/pending-notes` differentiates client self-log vs trainer work; **Approve** only for `client_submitted`; list shows `raw_notes_preview` from DB-backed session list.
- `/clients` loads from `/api/clients`; goal template API returns real `clients.goal` plus placeholder `sessionFields`; goal-template page reflects DB goal text.
- `app/lib/metricLabels.js` shared by new-session and session-detail flows.

## 2026-05-01 (session 3)

### Completed
- Root `middleware.js`: trainer routes require `trainer_session`; `/my-portal/**` requires `client_session`; redirects preserve `?next=` for post-login return.
- `POST /api/client-auth/login`, real `GET`/`DELETE /api/client-auth/session`; client-login page (email + optional password); trainer login respects `next`.
- Trainer and client shells: Sign out calls API `DELETE` then redirects (clears httpOnly cookies).
- `/sessions/[id]`: catalog search, add/remove exercises (parity with new session).
- Trainer OTP cookie `secure` flag in production.

## 2026-05-01 (session 4)

### Completed
- Client auth switched to mobile + OTP only (`/api/client-auth/check-phone`, `/api/client-auth/otp/send`, `/api/client-auth/otp/verify`).
- Client login now enforces trainer-added mobile gating via `clients.mobile`; unknown numbers receive “talk to your trainer” message.
- Removed legacy email/password client login routes.
- `GET /api/client-auth/session` now validates against `clients` table and returns mobile/name identity.
- Client self-log page now reads logged-in client identity from session and `/api/client/sessions` rejects cross-client submissions.
