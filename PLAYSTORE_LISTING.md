# Play Store Listing — Cadence

_Paste these into Google Play Console → Store Presence → Main Store Listing_

**Next-stage pack (created in-repo):**

| Item | Location |
|------|----------|
| Production checklist | `docs/play-store/PRODUCTION_CHECKLIST.md` |
| Data safety answers | `docs/play-store/DATA_SAFETY.md` |
| Screenshot guide | `docs/play-store/SCREENSHOTS.md` |
| What's new / release notes | `docs/play-store/WHATS_NEW.md` |
| Feature graphic (1024×500) | `store-assets/feature-graphic.png` |
| Privacy policy (live page) | https://trainer-app-mvp-recovered.vercel.app/privacy |
| Terms of use (live page) | https://trainer-app-mvp-recovered.vercel.app/terms |

---

**Automation (AAB + listing sync):** `docs/play-store/AUTOMATION.md`  
After dropping a Play service account JSON at `.secrets/play-store-service-account.json`:

```bash
npm run play:check
npm run play:ship -- --build
```

---

## Developer account (source of truth)

| Field | Value |
|-------|--------|
| **Play Console login** | `getsatxray@gmail.com` (personal Google account) |
| **Package / applicationId** | `in.trainer.fitness` |
| **App name** | Cadence |
| **Keystore org (cert DN)** | Raak Advisory (IN) |
| **Support email** | `getsatxray@gmail.com` |
| **Privacy policy** | `https://trainer-app-mvp-recovered.vercel.app/privacy` |

Use this account for Play Console uploads, Internal testing, and listing edits. Do not assume a separate Raak Advisory Play org unless one is created later.

---

## App Details

**App name** (max 30 chars)
```
Cadence
```

**Short description** (max 80 chars)
```
Session logging and client management for fitness trainers in India.
```

**Full description** (max 4000 chars)
```
Cadence helps personal trainers run a more professional and organised practice — from logging sessions to managing clients and scheduling appointments.

Built for trainers in India, Cadence gives you everything you need to track progress, communicate with clients, and grow your business.

KEY FEATURES FOR TRAINERS
• Log every session in detail — exercises, sets, reps, load, RPE, and notes
• Manage your full client roster with health profiles and training goals
• Create personalised goal exercise templates for each client
• Schedule appointments with clients and track confirmation status
• Two-way messaging on each session — share notes with clients directly
• Payment tracking per session with UPI support
• AI-assisted workout assessment and coaching safety checks
• Dashboard with at-a-glance KPIs — active clients, sessions, revenue

KEY FEATURES FOR CLIENTS
• View your session history and exercise progress
• See your trainer's notes and feedback after every session
• Request session appointments from your phone
• Track your goal progress and body metrics over time
• Receive your trainer's invitation and onboard in minutes

HOW IT WORKS
Trainers sign up and add their clients. Clients receive a secure SMS invitation and log in with a one-time OTP — no passwords to remember. Every session logged by the trainer is visible to the client in their personal portal.

SECURE & PRIVATE
• OTP-based login — no passwords stored
• Each client's data is accessible only to their trainer
• Sessions and notes are private between trainer and client

Cadence is built for the Indian fitness market. Sign up as a trainer today and give your clients the professional experience they deserve.
```

---

## Categorisation

**Category:** Health & Fitness  
**Tags / keywords:** personal trainer, fitness tracker, workout log, client management, session log, gym trainer, OTP login, India fitness

---

## Content Rating Questionnaire Answers

When Play Console asks the IARC content rating questionnaire, answer as follows:

| Question | Answer |
|----------|--------|
| Violence | No |
| Sexual content | No |
| Language | No |
| Controlled substances | No |
| User-generated content | Yes (trainer/client notes and messages) |
| Personal / sensitive info collected | Yes (phone number for OTP login) |
| Financial transactions | No (payment tracking is record-keeping only, no in-app purchases) |

Expected rating: **Everyone** or **Everyone 3+**  
Recommended target audience setting: **18+** (adult coaching relationship), even if IARC rating is Everyone.

---

## App Access (for reviewers)

Play Console will ask how reviewers can access the app. Select **"All functionality is available without special access"** — reviewers can sign up as a trainer directly from the app.

Paste reviewer notes from `docs/play-store/PRODUCTION_CHECKLIST.md` section D.

---

## Pricing & Distribution

- **Price:** Free
- **Countries:** India (start with India only; expand later)
- **Contains ads:** No
- **In-app purchases:** No

---

## Graphics

| Asset | Spec | File |
|-------|------|------|
| Feature graphic | 1024×500 PNG | `store-assets/feature-graphic.png` |
| Phone screenshots | ≥2 required, 4–6 recommended | Capture into `store-assets/screenshots/` using `docs/play-store/SCREENSHOTS.md` |
| Hi-res icon | 512×512 PNG | Export from branded icon set; Console may reject WebP |

---

## Keystore Details (keep safe — do not lose this)

| Field | Value |
|-------|-------|
| Keystore file | `/Users/satananth/trainerapp-release.keystore` |
| Key alias | `trainerapp` |
| Validity | 10,000 days (~27 years) |
| Organisation | Raak Advisory |
| Country | IN |

**Back up the keystore file to a secure location (cloud storage, password manager).  
If you lose it, you cannot update the app on Play Store — ever.**

Do **not** commit keystore passwords or `android/keystore.properties`.

---

## Build & Upload Steps

1. Ensure web production is current (`npx vercel --prod`) so `/privacy` and `/terms` resolve
2. Signed AAB already builds via `cd android && ./gradlew bundleRelease`
3. Upload: `android/app/build/outputs/bundle/release/app-release.aab`
4. Current closed-testing build: **versionCode 7 / versionName 1.3.1** (`Cadence-1.3.1-versionCode7.aab`)
5. Play Console → Testing (Internal/Closed) or Production → Create release → Upload AAB
6. Complete Data safety + Content rating before production rollout

Release notes: `docs/play-store/WHATS_NEW.md`  
End-to-end checklist: `docs/play-store/PRODUCTION_CHECKLIST.md`
