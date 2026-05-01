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
- **Client:** `client_session` cookie set by `POST /api/client-auth/otp/verify` (JSON with `clientId` + phone). Middleware protects `/my-portal`. Unauthenticated users go to `/login?next=…&reason=login_required`.
- **Client eligibility rule:** client mobile must already exist in the `clients` table (trainer-added record). `POST /api/client-auth/check-phone` and `POST /api/client-auth/otp/send|verify` return a user-facing “talk to your trainer” message if not found.
- **Recovery / no `DATABASE_URL`:** client auth still uses mobile + OTP, but checks against `mockData.clients`. Trainer/client OTP mock code remains `123456`.
- **First-time role flow:** `/` redirects to `/login`. Phone entry is universal; role is inferred from records. Unknown numbers can start trainer onboarding or are routed to talk-to-trainer messaging for client access.

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

## Latest parity slice (Session wizard)
- `/sessions/new` now mirrors the 4-step capture flow:
  - **Details**: client/date/private notes with inline Add Client.
  - **Notes**: free text capture + quick templates + parse/skip.
  - **Review**: parsed entry review with prev/next/save actions and metric editing.
  - **Pre-final**: grouped preview, shared notes requirement, UPI payment request, and final publish guard.
- Added `POST /api/sessions/[id]/payment` for session payment requests (audit + billing-friendly persistence).
- Added `POST /api/sessions/[id]/share` for session publish tracking in `session_shares`.

## Session UX contract updates (mobile)
- Exercise capture is now optimized for mobile:
  - main session screen stays compact and row-based,
  - each exercise opens in a full-screen editor,
  - save returns trainer to the row timeline.
- Exercise mapping is explicit per entry:
  - each exercise row has Search initiation,
  - trainer selects canonical master exercise,
  - mandatory fields come from mapped master exercise keys.
- Optional timing metadata is progressive-disclosure:
  - start/end/duration fields are hidden by default behind `+ Add timing`,
  - fields appear only when explicitly enabled or already filled.
- Live session control model:
  - sticky session rail with current exercise + pending goal count,
  - quick launcher row (`+ Goal Exercise`, `+ Other Exercise`, `Resume Current`),
  - reduced transitions: set logging stays in exercise editor until done.

## Milestone 4 behavior (review/share/finalize)
- Finalized session protection:
  - `PATCH /api/sessions/[id]` blocks structured payload edits when current status is `completed` or `signed_off`,
  - trainer must reopen (or move back to draft) before changing structured exercise payload.
- Client-facing continuity surface:
  - `GET /api/client/sessions` returns DB-backed session feed scoped to `client_session`,
  - response now includes goal-oriented rows derived from payload (`target`, `done`, `completionStatus`, `skipReason`, simple progress direction).
- `/my-portal` now renders goal-plan continuity:
  - target vs done visibility per goal exercise,
  - skip reasons where present,
  - progress indicator vs recent comparable session data.

## Latest parity slice (Schedule + Profile)
- `/schedule` now implements calendar-style flow with status counters, filters, create appointment form, and grouped appointment cards.
- Schedule write operations are now enabled via:
  - `POST /api/schedule/events`,
  - `PATCH /api/schedule/events/[id]`,
  - `PATCH /api/schedule/events/[id]/status` (cancel/status updates).
- `/profile` now matches account/settings/session sections with skill-specialization toggles.
- `PATCH /api/profile/trainer` persists trainer profile edits (`name`, `specialization`) for the logged-in trainer session.

## Latest parity slice (Visual system + navigation)
- Global styling now targets closer screenshot fidelity: layered background, elevated cards, and glass bottom navigation container.
- Trainer + client shells share a consistent **5-tab icon bottom bar** (mobile) with mint active treatment; desktop keeps pill navigation for wide screens.
- Typography is standardized via `next/font` Inter on the root layout.

## Billing model + limits (enforced)
- Business rules now include two explicit models:
  - **Free trial up to X clients** (`trial.clientLimit`),
  - **Per-client pricing after threshold** (`perClient.perClientCostInr`).
- `GET /api/auth/pricing` now exposes these model values for all onboarding/profile/dashboard UI.
- `POST /api/clients` enforces trainer billing limits server-side and rejects additions with a clear 402 payload when the trainer is at capacity.
- `POST /api/admin/register-trainer` now accepts `billingModel` and persists `billing_status` + `max_clients`, while also preventing role-conflict numbers (client number cannot register as trainer).
