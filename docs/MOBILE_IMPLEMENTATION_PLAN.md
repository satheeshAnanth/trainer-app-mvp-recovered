# Mobile UX + Exercise Media — Implementation Plan

Source specs: `docs/MOBILE_UX_REVIEW.md`, `docs/EXERCISE_MEDIA_SPEC.md`

## Phase 1 — Native feel quick wins (P0)

| Task | Files | Done when |
|------|-------|-----------|
| Fix PWA manifest icon paths | `public/manifest.json` | Chrome DevTools Manifest shows resolved icons |
| Remove zoom lock | `app/layout.js` | `maximumScale` removed; pinch zoom works |
| Modal stack + Android back | `app/lib/modalStack.js`, `BackButtonGuard.js`, modals | Back closes top modal before navigating |
| Toast/snackbar primitive | `ToastProvider.js`, `globals.css` | Profile/clients/session saves use toast |

## Phase 2 — Perceived quality (P1)

| Task | Files | Done when |
|------|-------|-----------|
| Skeleton loaders | `Skeleton.js`, insights/audit/clients | "Loading…" replaced on key screens |
| Touch targets | `globals.css` | Compact buttons ≥44px hit area |
| Pull-to-refresh | Schedule, Clients (follow-up PR) | Deferred — needs scroll container audit |

## Phase 3 — Exercise media v1 (product)

| Task | Files | Done when |
|------|-------|-----------|
| Schema + lib | `scripts/migrations/001_exercise_media.sql`, `exerciseMedia.js` | Table documented; queries work when present |
| Read APIs | search route extension, `GET .../media` | Results include `primaryMedia` |
| Exercise Library | `/exercises`, profile links | Searchable library with detail sheet |
| Inline picker | `sessions/new/page.js` | "Watch example" on search results |

## Phase 4 — Admin curation + seed (in progress / shipping)

| Task | Files | Done when |
|------|-------|-----------|
| Admin list/submit API | `app/api/admin/exercise-media/route.js` | Secret-gated GET/POST works |
| Admin review API | `app/api/admin/exercise-media/[id]/review` | Approve/reject + primary |
| Admin review UI | `app/admin/exercise-media/page.js` | Unlock → queue → preview → approve |
| Candidate + seed scripts | `scripts/list-exercise-media-candidates.mjs`, `scripts/seed-exercise-media.mjs` | Dry-run + pending inserts |
| Goal-template back wiring | `goal-template/page.js` | Modals register in modal stack |

## Phase 5 — Push + polish (shipping)

| Task | Status |
|------|--------|
| FCM token register + Capacitor init | Done |
| Schedule status push | Done |
| Session publish push | Done |
| Client self-log → trainer push | Done |
| New schedule request push | Done |
| Firebase `google-services.json` + `FIREBASE_SERVICE_ACCOUNT_JSON` (HTTP v1) | **Owner action** |
| Replace browser Notification reminders | Deferred |
