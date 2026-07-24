# Agent Handoff — Cadence

**Last updated:** 2026-07-24  
**Product name:** Cadence (formerly TrainerApp)  
**Package / applicationId:** `in.trainer.fitness` (unchanged)  
**Repo:** https://github.com/satheeshAnanth/trainer-app-mvp-recovered (`main`)  
**Web prod:** https://trainer-app-mvp-recovered.vercel.app  

This is the continuity document for any agent picking up this repo. Prefer this over older handoffs (`docs/BUILD_CONTEXT.md` is historical recovery context). Also see `docs/OPEN_QUESTIONS.md` and `docs/play-store/*`.

---

## Quick facts

| Item | Value |
|------|--------|
| Stack | Next.js 14 App Router, Neon Postgres, Capacitor Android |
| Brand | Cadence mark (lime→orange on `#0E1319`); **UI accent stays mint** `#2dd4bf` (Option A) |
| Android release | **1.3.1 / versionCode 7** (alpha / closed testing) |
| Play Console | `getsatxray@gmail.com` |
| MacBook (Tailscale) | `satheeshananthasubramanian@100.85.195.22` |
| Play artifacts | `~/Documents/Raak Consulting/TrainerApp/Playstore/release/` |
| Build scratch | `~/Documents/Raak Consulting/TrainerApp/build-src/` (rsync/tar from this repo) |

---

## What the product is

Cadence is an India-first **session-truth** coaching app: trainers log what happened with clients; clients see sessions, goals, schedule, payments. Not a remote programming SaaS.

**Roles (unified `/login`):**

1. **Trainer** — clients, sessions, schedule, profile, exercise library  
2. **Client** — `/my-portal` (home, schedule, self-log, payments, profile; Progress via Profile/Home)  
3. **Gym admin** — `/gym` (seats, invite trainers); optional `gym_id` on trainers  
4. **Platform admin** — `/admin` (ops, trainers, gyms, exercise media)  

Role is detected from DB records for the phone, not from the URL. Multi-role → chooser. Legacy `/gym/login` → `/login`.

---

## Non-negotiable UX contracts

- Single login: `/login` (no separate client-login path).
- Phone-first OTP; unknown client → contact trainer.
- Trainer onboarding phone locked from login query.
- Goal exercise names locked in session capture; edit only on goal-template screen.
- Session tabs: **Draft** = capture; **Final** = publish + payment + discussion + lock.
- Explicit Save Draft in Draft tab.
- Lock requires payment received + final trainer comment (existing flow).

---

## Major work completed (through 2026-07-24)

### Branding — Cadence (2026-07-24)

- Renamed user-facing **TrainerApp → Cadence** (web metadata, shells, legal, listing, Capacitor `appName`, Android `app_name`).
- Cadence icon set from SociAI `CADENCE_logo` → `assets/brand/cadence/`, `public/*`, Android mipmaps.
- **Option A:** Cadence icons/mark everywhere; **keep mint UI theme** (do not swap accents to lime/orange without a theme pass).
- Login + trainer/client headers show Cadence mark; admin titles use `CADENCE — …`.
- Scripts: `scripts/install-cadence-icons.py`.
- **Splash** updated to Cadence in 1.3.1 (was still old teal “T” in 1.3.0 — caused confusion vs home icon).
- Android 12+ splash styles: `windowSplashScreenBackground` + `windowSplashScreenAnimatedIcon`.
- **Launcher cache:** after icon updates, testers must **uninstall then reinstall** (OEM launchers cache old icons on update).

### Android / Play

| Version | versionCode | Notes |
|---------|-------------|--------|
| 1.2.1 | 4 | Internal |
| 1.2.2 | 5 | Mobile P2; was on alpha |
| 1.3.0 | 6 | Cadence rename + icons |
| **1.3.1** | **7** | Cadence splash + icon/splash alignment; **current alpha** |

- Artifacts: `Cadence-1.3.1-versionCode7.{aab,apk}` on MacBook `Playstore/release/`.
- Listing synced: title Cadence, feature graphic, 512 icon.
- **Still missing for production:** ≥2 phone screenshots; optional R8 mapping / native debug symbols (non-blocking for closed testing).
- Build: no local Java on some agents — build on MacBook (`JAVA_HOME` + `ANDROID_HOME`). Sync via `tar` over SSH (rsync struggled with spaces in path). Keystore: `/Users/satheeshananthasubramanian/trainerapp-release.keystore` + `android/keystore.properties` (`storeFile` absolute on remote).

### Gym org (optional B2B)

- Migration `db/migrations/005_gyms.sql` — `gyms`, `gym_admins`, `gym_memberships`, `gym_invitations`, `trainer_phones.gym_id`.
- Libs: `app/lib/gyms.js`, `gymAuth.js`, `gymInviteAccept.js`.
- Surfaces: `/admin/gyms`, `/gym`, `/gym/trainers`, `/gym-invite/[token]`.
- Spec: `docs/plans/gym-org.md`.
- Solo trainers unchanged (`gym_id` null). Gym billing / multi-gym deferred.

### Auth

- Unified record-based login (trainer / client / gym_admin / platform_admin).
- Platform admin OTP allowlist phone **`+919340150000`** (UI: `9340150000`); fixed OTP **`123456`** via `app/lib/fixedOtp.js`.
- Also email/password `/admin/login` from env (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
- Test gyms (OTP `123456`): Raak Fitness Indiranagar `9900000101`; Iron Temple Koramangala `9900000102`.

### WorkoutX GIFs (testing mode)

- Catalog ~1327 exercises (`scripts/data/workoutx-catalog.json`, often gitignored).
- Auto-match seed: `scripts/seed-workoutx-media.mjs` (min score ~78) — exhausted.
- Curated shortlist seed: `scripts/seed-workoutx-curated.mjs` → `npm run media:workoutx:curated`.
- Approve + Blob cache: `npm run media:workoutx:approve-cache`.
- Docs: `docs/WORKOUTX_GIF_STORAGE.md`.
- ~**137** approved WorkoutX image rows; most Blob-cached. Known watermark 503s: Face Pull `5203`; Front Plank `5202` swapped to Weighted Front Plank `2135`.
- **Production WorkoutX license/subscription still deferred.**

### Client / mobile UX

- Client P1 density: CollapsibleSection; Progress via Profile/Home (no 6th tab).
- Mobile P2: segmented List/Week (no overlay), haptics, native clipboard, panel-value clamp, deep links `/invite`, `/gym-invite`, `/join`, swipe enhance.
- Capacitor vs native notes: `docs/NATIVE_VS_CAPACITOR_UX.md` (Expo ~4–6 mo / Flutter ~5–8 mo estimates discussed; not a rewrite commitment).

### Exercise media (YouTube)

- Admin review UI + trainer submit → pending_review.
- Small approved YouTube subset still needs **human QA** (`docs/OPEN_QUESTIONS.md`).

---

## Key paths

| Area | Path |
|------|------|
| Login | `app/login/page.js` |
| Trainer shell | `app/_components/TrainerShell.js` |
| Client shell | `app/_components/ClientShell.js` |
| Admin shell | `app/_components/AdminShell.js` |
| Brand logo | `app/_components/BrandLogo.js` |
| Gym | `app/gym/*`, `app/lib/gyms.js` |
| WorkoutX client | `app/lib/workoutx.js`, `app/api/workoutx/gif/[id]/route.js` |
| Play scripts | `scripts/play/*` → `npm run play:check|build|upload|listing|status|ship` |
| Cadence icons | `assets/brand/cadence/`, `scripts/install-cadence-icons.py` |
| Curated GIF seed | `scripts/seed-workoutx-curated.mjs` |

---

## Env / secrets (do not commit)

Typical `.env.local` / Vercel: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_*`, `MSG91_*`, `WORKOUTX_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `OPENAI_API_KEY` (optional), Play SA under `.secrets/`.

Android: `android/keystore.properties` + release keystore (local + MacBook copies).

---

## How to ship Android (MacBook)

1. Sync repo → `build-src` (prefer `tar` over SSH; path has spaces).  
2. Ensure `keystore.properties` + `local.properties` (`sdk.dir=…/Android/sdk`).  
3. `cd build-src/android && ./gradlew bundleRelease assembleRelease`  
4. Copy to `Playstore/release/Cadence-<ver>-versionCode<N>.{aab,apk}`  
5. From laptop: `npm run play:upload -- --track alpha --status completed`  
6. Listing: `npm run play:listing`  

After icon/splash changes: tell testers to **uninstall then install**.

---

## How to ship web

1. Commit + `git push origin main`  
2. `npx vercel --prod --yes` (or rely on Git integration if configured)  
3. Hard-refresh browsers (favicon caches aggressively)

---

## Immediate next actions (suggested)

1. Human QA YouTube exercise embeds (`/admin/exercise-media`, `/exercises`).  
2. Capture ≥2 Play screenshots → production readiness.  
3. On-device FCM verification (tokens + schedule/session/self-log pushes).  
4. Commit any uncommitted 1.3.1 splash/styles if not yet on `main`.  
5. Decide WorkoutX production licensing before treating GIF cache as permanent.  
6. Gym billing / multi-gym — deferred unless product asks.  
7. Optional: native rewrite eval only if Capacitor UX gaps block closed testing (see `NATIVE_VS_CAPACITOR_UX.md`).

---

## Smoke test checklist

- [ ] `/login` role detect + OTP (trainer, client, gym, platform admin)  
- [ ] Cadence mark on login + shells; admin title `CADENCE — …`  
- [ ] Trainer: add client → goal template → session draft/save → publish  
- [ ] Client: portal, schedule request, self-log  
- [ ] Gym: invite trainer, seats  
- [ ] Admin: ops console, exercise media, gyms  
- [ ] Exercise GIF loads for WorkoutX-linked exercises  
- [ ] Android 1.3.1+: home icon + splash both Cadence after clean install  

---

## Docs map

| Doc | Role |
|-----|------|
| **This file** | Current agent continuity |
| `docs/OPEN_QUESTIONS.md` | Deferred decisions |
| `docs/WORKOUTX_GIF_STORAGE.md` | GIF testing vs license |
| `docs/plans/gym-org.md` | Gym seats design |
| `docs/NATIVE_VS_CAPACITOR_UX.md` | Capacitor vs native |
| `PLAYSTORE_LISTING.md` + `docs/play-store/*` | Store listing & automation |
| `docs/BUILD_CONTEXT.md` | Recovery history (stale for product state) |
| `docs/MOBILE_UX_REVIEW.md` | Mobile roadmap (many items shipped) |
| `docs/EXERCISE_MEDIA_SPEC.md` | Media system design |

---

## Agent rules of thumb

- Do not rename `applicationId` / Play package without an explicit product decision.  
- Do not replace mint UI with Cadence lime/orange unless asked (Option B theme pass).  
- Do not commit `.env`, keystores, `.secrets/`, or `.DS_Store`.  
- Prefer small, reversible changes; keep solo-trainer paths working when touching gym code.  
- After branding/icon work, always clean-install Android to verify launcher icon.
