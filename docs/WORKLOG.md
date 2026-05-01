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

## 2026-05-01 (session 5)

### Completed
- Added role selector landing page (`/`) with Trainer vs Client entry points and trainer onboarding CTA.
- Added trainer first-time onboarding flow (`/onboard/trainer`): profile capture, pricing tier, and 3-page walkthrough (including mandatory goal-template guidance), wired to `POST /api/admin/register-trainer`.
- Extended `POST /api/admin/register-trainer` to persist `trainer_phones` metadata and seed trial billing row (best effort), then set trainer session cookie.
- Hardened phone matching in trainer/client auth checks with digit-normalized comparisons (`regexp_replace`) to reduce format mismatch login failures.
- Added `/client-onboard` page and client-login redirect to that page when number is not trainer-added.

## 2026-05-01 (session 6)

### Completed
- Rebuilt `/portal` landing UI toward screenshot parity: hero welcome + CTA, KPI cards, pending/ready/most-active insights, schedule request empty-state, and recent sessions with status chips.
- Wired dashboard values to live APIs (`/api/auth/session`, `/api/clients`, `/api/sessions`) instead of hardcoded stats.
- Updated trainer shell nav labels and mobile tab structure to `Home / Clients / Log / Schedule / Profile`.

## 2026-05-01 (session 7)

### Completed
- Rebuilt `/login` into the requested 4-step path flow: phone -> role -> trainer profile/pricing (for new trainers) or client access-check -> OTP verify.
- Added role-specific OTP handling from `/login`: trainer uses `/api/auth/otp/*`; client uses `/api/client-auth/otp/*`.
- Added resend OTP timer, change-number path, and client access-required instructions matching the provided mock.
- Added UI primitives for role cards, specialization chips, and pricing plan cards in `globals.css`.

## 2026-05-01 (session 8)

### Completed
- Clients list parity update: `+ Add Client` action opens modal with required fields (name, goal, mobile, demographics), empty-state card, and populated list card layout.
- Added `POST /api/clients` to persist trainer-created clients (`clients` table) and keep mock fallback.
- Client detail parity update (`/clients/[id]`): profile summary, goal-progress card with template warning/state, trainer tips summary/history link, sessions empty-state.
- Goal-template builder parity (`/clients/[id]/goal-template`): dynamic goal exercises + metric rows, add/remove controls, save validation and persistence via `audit_events` (`client_goal_template`).
- Trainer tips parity (`/clients/[id]/tips`): send tip form, status/category filters, filtered history list, persistence via `audit_events` (`client_tip`).

## 2026-05-01 (session 9)

### Completed
- Rebuilt `/sessions/new` as a 4-step wizard flow matching log screens: `Details -> Notes -> Review -> Pre-final` with tabbed header and cancel action.
- Added notes parser flow (free-text workout notes -> parsed review entries) with quick templates (Strength/Mobility/Conditioning), skip/parse controls, and entry-by-entry review editor.
- Added pre-final preview grouped by category, save-draft action, shared session notes composer, payment request block, and final submit guard requiring client-visible publish note + at least one trainer shared note.
- Added inline Add Client modal inside Details step to support quick client creation during logging.
- Added `POST /api/sessions/[id]/payment` and `POST /api/sessions/[id]/share` handlers used by pre-final flow.

## 2026-05-01 (session 10)

### Completed
- Rebuilt `/schedule` to screenshot parity:
  - top stat chips (Total / Pending / Accepted),
  - status filter pills,
  - create appointment form (date/time/client/note),
  - grouped event cards by date with `Edit` and `Cancel`.
- Added schedule write APIs:
  - `POST /api/schedule/events` (create appointment),
  - `PATCH /api/schedule/events/[id]` (edit appointment details),
  - existing `PATCH /api/schedule/events/[id]/status` used for cancel action.
- Rebuilt `/profile` to parity layout with account block, skills/specializations multi-select chips, settings block, session/logout block, and app version footer.
- Added `PATCH /api/profile/trainer` to persist trainer `name` + `specialization` by session phone.

## 2026-05-01 (session 11)

### Completed
- Visual parity foundation pass: upgraded global theme (gradient background, elevated cards, glass surfaces) and wired `next/font` Inter for consistent typography.
- Rebuilt trainer + client mobile tab bars to match shared screenshots: **5-icon bottom navigation** with active mint highlight (instead of text-only tabs).
- `ClientShell` now shows five bottom tabs (was previously capped at four on mobile).
- Polished `/schedule` UI to match reference density: labeled form fields, pill filter row with horizontal scroll, and appointment rows using the shared list-item pattern.

## 2026-05-01 (session 12)

### Completed
- Matched the **role landing** screen (`/`) to the shared reference: side-by-side role pills with explicit selected state + Continue routing to trainer vs client login.
- Tuned **auth card styling** to the shared palette (darker page background + slightly lifted card) and aligned `/login` Step 1 “Sign In” visuals (green accent progress + CTA, phone field focus ring, `+91` divider treatment).

## 2026-05-01 (session 13)

### Completed
- End-to-end auth/onboarding UI cleanup pass for consistency:
  - added dedicated auth form primitives in `globals.css` (`auth-input`, `auth-select`, `auth-alert`, `auth-link`, `auth-button-row`, `auth-section-card`),
  - replaced borderless onboarding/profile inputs that were using `phone-input` incorrectly.
- Updated `/login` to use the new primitives (error surfaces, verify action row, profile/pricing inputs), improving visual consistency across all steps.
- Updated `/client-login`, `/client-onboard`, and `/onboard/trainer` to the same visual system so the entire entry flow feels like one coherent product.

## 2026-05-01 (session 14)

### Completed
- Milestone 1 (Goal Template Program Layer) started and implemented:
  - `GET/POST /api/clients/[id]/goal-template` now supports `goalName`, active status, and normalized template exercises (`masterExerciseId`, `exercise`, `variation`, `target`, `frequency`, `priority`).
  - Trainer goal-template UI now captures program intent explicitly (goal name + mapped exercises from master search + frequency + priority) instead of free-form metric rows.
  - Latest saved template is treated as the active template for the client.
- Unified auth entry to a single `/login` flow; removed active `/client-login` usage and redirected legacy `/client-login` to `/login`.
- Updated middleware/client-shell/client-onboard routes to return to `/login` for all unauthenticated or signed-out client paths.
- Implemented explicit billing model architecture:
  - `Free trial up to X clients`
  - `Per-client pricing after threshold`
  using shared model constants in `app/lib/pricingModel.js`.
- Updated pricing APIs/UI:
  - `GET /api/auth/pricing` now returns billing model metadata (`trial.clientLimit`, `perClient.perClientCostInr`),
  - `/onboard/trainer` and `/login` (new trainer pricing step) now expose billing-model selection with the required wording.
- Added server-side enforcement in `POST /api/clients`:
  - requires trainer session,
  - checks trainer billing status + max client limit before add,
  - returns clear 402 response when trial limit is reached.
- Added cross-role conflict guard in trainer registration:
  - `POST /api/admin/register-trainer` now blocks numbers already registered as clients.
- Post-login trainer flow polish for billing clarity:
  - `/portal`, `/clients`, and `/profile` now surface counters/limits and active billing mode so limits are visible before actions fail.

## 2026-05-01 (session 15)

### Completed
- Session flow UX pass (`/sessions/new`) aligned to mobile-first coaching capture:
  - moved to compact row-first main screen with sticky session rail and quick launcher,
  - exercise editing moved to full-screen modal editor per exercise.
- Search-driven canonical exercise mapping hardened in capture:
  - each exercise has explicit `Search` action,
  - trainer selects a master exercise result before finish,
  - mapped result determines mandatory metric keys shown in set logging.
- Reduced flow friction:
  - removed separate “next exercise” modal launcher dependency,
  - set logging remains in the exercise editor until `Done with this Exercise`,
  - return to timeline happens after done with success toast/message.
- Optional timing fields switched to progressive disclosure:
  - `+ Add timing` reveals start/end/duration only when needed,
  - no static time real-estate consumed by default.
- Copy updates for coaching context:
  - `Ad-hoc` -> `Other Exercise`,
  - `Finish Exercise` -> `Done with this Exercise`,
  - launcher language updated to “Log”/“Resume” style.

## 2026-05-01 (session 16)

### Completed
- Milestone 4 implementation pass:
  - added finalized-record guard in `PATCH /api/sessions/[id]`:
    - completed/signed-off sessions reject structured payload edits unless explicitly reopened/drafted first.
  - upgraded `GET /api/client/sessions` to DB-backed client session feed from `client_session` cookie identity, including parsed payload and goal-row summaries.
  - added goal-facing client summary rendering on `/my-portal`:
    - target vs done for goal exercises,
    - skip reason visibility,
    - simple progress direction marker (up/down/same) based on recent comparable session load.
- Preserved existing share/final submit path while adding lock behavior to prevent silent mutation of finalized structured data.
