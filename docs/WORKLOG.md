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
- Route guards (trainer vs client), richer session detail editing for catalog-shaped payloads, optional custom metrics per exercise in UI.

### Blockers
- Vercel deployment intermittently failing with platform-side `deploy_failed` / `Unexpected error` despite clean local builds.

### Next Up
1. Session detail / pending-notes UI for dynamic exercise payloads and approval copy.
2. Clients list from `/api/clients` and goal-template backed by DB when columns exist.
3. Client auth parity and protected routes.

## 2026-05-01

### Completed
- Server-side validation for non-draft trainer sessions: mandatory `payload.sections`, at least one exercise, and required metrics per exercise (DB catalog + `metricRequired` when DB is off).
- Shared helpers: `app/lib/metricKeys.js`, `app/lib/exerciseCatalog.js`, `app/lib/sessionValidation.js`, `app/lib/payloadMerge.js`.
- Real `GET /api/exercises/master/search?q=&withKeys=1` against `master_exercises` + `master_exercise_metrics` / `important_input_fields_json`.
- `/sessions/new` wired to client picker, catalog search, dynamic metric fields, **Save draft** vs **Complete session**.
- `PATCH /api/sessions/[id]` merges existing `payload_json` before validating and only overwrites payload when the request includes `payload`.
