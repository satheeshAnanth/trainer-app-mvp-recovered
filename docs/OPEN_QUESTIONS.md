# Open Questions & Revisit Points

Last updated: 2026-07-24

Track decisions deferred, assumptions, and items that need product/ops input.  
For shipped work and how to operate the repo, see **`docs/AGENT_HANDOFF.md`**.

---

## Branding

| # | Question | Context | Status |
|---|----------|---------|--------|
| B1 | Full theme migration to Cadence lime/orange (Option B)? | Option A shipped: Cadence icons + mint UI. | Deferred — product call |
| B2 | Rename Play package / Vercel project away from `trainer-app*`? | Display name is Cadence; IDs stay `in.trainer.fitness`. | Keep unless Play migration planned |

---

## Exercise media / WorkoutX

| # | Question | Context | Status |
|---|----------|---------|--------|
| 0 | **Permanently store WorkoutX GIF binaries / buy production license?** | Testing: ~137 approved WorkoutX rows, Blob cache via `media:workoutx:approve-cache`. | **Testing OK** — production license deferred (`docs/WORKOUTX_GIF_STORAGE.md`) |
| 1 | **YouTube IDs correct form demos?** | Early auto-approved subset; not all watched. | **Needs human QA** — `/admin/exercise-media` |
| 2 | Approve equipment variants with same generic video? | Some variants skipped. | Defer until better sources |
| 3 | Dedupe `EX#### - …` vs clean catalog names? | Both exist; GIFs often shared. | Decide catalog strategy |
| 4 | Trainer submissions vs admin-only? | Trainers submit YouTube → pending_review. | **Shipped** — admin approves |
| 5 | Link-rot cron? | `npm run media:check-links`. | Script done — schedule owner ops |
| 6 | YouTube embed in Capacitor WebView? | Fullscreen/autoplay quirks. | Test on device |
| 6a | Face Pull GIF `5203` watermark 503? | Upstream unavailable. | Leave or replace manually |

---

## Mobile / Play

| # | Question | Context | Status |
|---|----------|---------|--------|
| 7 | iOS in scope? | Android Capacitor only. | Deferred |
| 7a | Play Console owner? | `getsatxray@gmail.com` / `in.trainer.fitness`. | **Resolved** |
| 7b | Production track vs closed testing? | Alpha has **1.3.1 (7)**; screenshots still needed for production. | Ops |
| 8 | FCM on-device verify? | Server paths + `google-services.json` exist; need real-device proof. | Owner / QA |
| 9 | Dark-only theme intentional? | Matches brand. | Product |
| 10 | Pull-to-refresh? | Deferred. | UX spike |
| 10a | Native rewrite (Expo/Flutter)? | Notes in `docs/NATIVE_VS_CAPACITOR_UX.md`. | Not committed |

---

## Client self-log ↔ catalog

| # | Question | Context | Status |
|---|----------|---------|--------|
| 11 | Require catalog mapping on self-log? | Optional `masterExerciseId` + search. | Monitor adoption |
| 12 | Rate-limit master exercise search? | Largely open read. | Consider if abused |
| 13 | Post-hoc alias matching for free-text logs? | Spec side-effect. | Future |

---

## Auth / admin

| # | Question | Context | Status |
|---|----------|---------|--------|
| 14 | `ADMIN_SECRET` / admin password rotation? | Ops. | Ops |
| 15 | Admin cookie + API gate? | Middleware + session. | **Done** |
| 16 | Firebase SA on Vercel? | Set previously. | Verify delivery |
| 17–19 | Push on publish / self-log / schedule? | Code paths exist. | Need FCM delivery proof |
| 20 | Drop browser Notification fallback? | Native path preferred. | After FCM solid |

---

## Gym org

| # | Question | Context | Status |
|---|----------|---------|--------|
| 21 | Gym = seats + light ops; trainer owns clients | Locked 2026-07-22. | **Implemented** |
| 22 | Gym billing / Razorpay for seats | Seats in DB only. | Future |
| 23 | Multi-gym per trainer | v1 = one primary. | Deferred |

---

## Assumptions still in force

- Exercise search may stay lightly gated until abuse appears.
- One primary approved media item per exercise is enough for v1.
- Seed / curated WorkoutX matches are good enough for testing, not a license.
- Cadence display name does not require changing `applicationId`.

---

## Suggested next actions (ordered)

1. Human QA YouTube embeds in `/exercises` and `/admin/exercise-media`.  
2. Play screenshots (≥2) → production checklist.  
3. On-device FCM tests (schedule, publish, self-log).  
4. WorkoutX production license decision.  
5. Gym billing only if sales needs it.  
6. Optional Cap vs native only if closed-test UX blocks shipping.
