# Open Questions & Revisit Points

Last updated: 2026-07-20

Track decisions deferred, assumptions made, and items that need product/ops input before treating as done.

---

## Exercise media curation

| # | Question | Context | Status |
|---|----------|---------|--------|
| 0 | **Should we permanently store WorkoutX GIF binaries?** | Proxy + CDN cache today. | **Deferred** — see `docs/WORKOUTX_GIF_STORAGE.md`; needs written redistribution rights |
| 1 | **Are the seeded YouTube IDs actually correct form demos for each exercise/equipment variant?** | First 13 rows were auto-approved via `scripts/approve-exercise-media-subset.mjs` using conservative name/equipment matching — videos were not manually watched in this session. | **Needs human QA** — spot-check in `/admin/exercise-media` |
| 2 | **Should we approve equipment variants separately (e.g. dumbbell vs barbell bench) with the same generic video?** | Subset skipped dumbbell bench, incline push-up, seated press, etc. | Defer until channel-specific videos are sourced |
| 3 | **How to handle duplicate catalog rows (`EX#### - …` vs clean names)?** | Seed matched both; approvals only on clean `exercise_id` slugs. | Decide dedupe strategy for catalog or seed script |
| 4 | **Who owns ongoing curation — admin-only or trainer submissions (spec §4C)?** | Admin UI exists; trainers can submit YouTube links from Exercise Library (pending_review). | **Trainer submit shipped** — admin still approves |
| 5 | **Link-rot checks** — weekly oEmbed cron? | Spec §6; `npm run media:check-links` (+ `--mark-broken`). | **Script done** — schedule owner ops |
| 6 | **YouTube embed behavior in Capacitor WebView** | Fullscreen/autoplay/consent quirks unknown on real devices. | Test on Android hardware |

### Approved subset (13 primary, pending human QA)

- Goblet Squat (Dumbbell/Kettlebell)
- Romanian Deadlift (Barbell)
- Bench Press (Flat barbell)
- Pull-up (Overhand)
- Lat Pulldown (Wide grip)
- Overhead Press (Standing barbell)
- Lateral Raise (Dumbbell)
- Plank (Front)
- Dead Bug (Standard)
- Mountain Climber (Standard)
- Burpee (Standard)
- Hip Thrust (Barbell)
- Farmer Carry (Dumbbells)

**Still pending review:** none — queue cleared (21 rejected total, 13 approved primary).

**Rejected (21 rows):** equipment/variant mismatches, EX#### duplicates, pendlay/upright rows, assisted pull-up, lunges, etc. via `npm run media:reject-bad`.

---

## Mobile / platform

| # | Question | Context | Status |
|---|----------|---------|--------|
| 7 | **Is iOS in scope for this phase?** | Android Capacitor only today. | Document deferral in AGENT_HANDOFF or build `ios/` |
| 7a | **Which Play Console account owns the Android app?** | Package `in.trainer.fitness` / TrainerApp. | **Resolved:** personal account `getsatxray@gmail.com` (see `PLAYSTORE_LISTING.md`) |
| 8 | **Push notifications — FCM project + server send path?** | HTTP v1 via `FIREBASE_SERVICE_ACCOUNT_JSON` (legacy key removed). Still needs `google-services.json` + service account on Vercel. | **Partially done** — owner infra |
| 9 | **Dark-only theme intentional?** | MOBILE_UX_REVIEW §6.1 | Product decision |
| 10 | **Pull-to-refresh on list screens?** | Deferred; scroll container behavior unclear in WebView. | UX spike |

---

## Client self-log ↔ catalog

| # | Question | Context | Status |
|---|----------|---------|--------|
| 11 | **Should client self-log require catalog mapping or stay optional?** | Wiring adds optional `masterExerciseId`; catalog search + Example preview added to self-log. | **Implemented optional** — monitor adoption |
| 12 | **Can clients call `/api/exercises/master/search` without rate limits?** | Currently unauthenticated read. | Consider auth or caching if abused |
| 13 | **Match client free-text logs to catalog post-hoc via `aliases_json`?** | Spec §7 side-effect. | Future analytics feature |

---

## Auth / admin

| # | Question | Context | Status |
|---|----------|---------|--------|
| 14 | **`ADMIN_SECRET` in production — who has it, rotation policy?** | Admin media + ops console depend on it. | Ops |
| 15 | **Should `/admin/*` pages be middleware-protected beyond secret header?** | Cookie gate in middleware + `/admin/login`. APIs still require admin session or `X-Admin-Secret`. | **Done** |
| 16 | **`FIREBASE_SERVICE_ACCOUNT_JSON` + `google-services.json`** | Local + Vercel Production/Preview set. | **Done** — verify delivery on device |
| 17 | **Session publish push?** | Triggers on `POST /api/sessions/[id]/share` (publish to client). | **Done** — needs FCM to deliver |
| 18 | **Client self-log push to trainer?** | Triggers on `POST /api/client/sessions`. | **Done** — needs FCM to deliver |
| 19 | **New schedule request push?** | Triggers on `POST /api/schedule/events` when status is pending. | **Done** — needs FCM to deliver |
| 20 | **Migrate off browser `Notification` reminders?** | Native uses LocalNotifications; remote events use FCM. Browser path remains web-only fallback. | **Done for Android path** |

---

## Assumptions made in this implementation pass

- Exercise search API is safe to expose to authenticated clients (trainer or client cookie for `/exercises` only; search API is open).
- One `is_primary` approved video per exercise is enough for v1.
- Toast + back-button stack cover the highest-traffic modals; not every modal in the app is registered yet.
- Seed YouTube IDs are placeholders until a coach verifies form quality.

---

## Suggested next actions (ordered)

1. Human QA: watch 13 approved embeds in `/exercises` and `/admin/exercise-media`
2. ~~Reject clearly wrong pending rows~~ — **done** (21 rejected; 0 pending; 13 approved)
3. Configure Firebase HTTP v1: `google-services.json` in `android/app/` + `FIREBASE_SERVICE_ACCOUNT_JSON` on Vercel; test pushes:
   - schedule status change
   - new appointment request
   - session publish (`POST .../share`)
   - client self-log submit
4. Source mobility videos (Cat-Cow, World's Greatest Stretch) — no seed matches in DB
5. Wire remaining modals to `useModalDismiss` (audit/schedule TBD)
6. Replace browser Notification reminders once FCM works on device
