# Play Store Listing — TrainerApp

_Paste these into Google Play Console → Store Presence → Main Store Listing_

---

## App Details

**App name** (max 30 chars)
```
TrainerApp
```

**Short description** (max 80 chars)
```
Session logging and client management for fitness trainers in India.
```

**Full description** (max 4000 chars)
```
TrainerApp helps personal trainers run a more professional and organised practice — from logging sessions to managing clients and scheduling appointments.

Built for trainers in India, TrainerApp gives you everything you need to track progress, communicate with clients, and grow your business.

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

TrainerApp is built for the Indian fitness market. Sign up as a trainer today and give your clients the professional experience they deserve.
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

---

## App Access (for reviewers)

Play Console will ask how reviewers can access the app. Select **"All functionality is available without special access"** — reviewers can sign up as a trainer directly from the app.

---

## Pricing & Distribution

- **Price:** Free
- **Countries:** India (start with India only; expand later)
- **Contains ads:** No
- **In-app purchases:** No

---

## Screenshots Required

Minimum 2 phone screenshots (recommend 4-6). Capture these screens:

1. **Login screen** — the OTP phone entry step
2. **Trainer dashboard** — KPI cards and client overview
3. **Session log** — exercise entry with sets logged
4. **Client list** — roster with client names and goals
5. **Client portal home** — next session card and progress summary
6. **Schedule page** — appointment list with status chips

Screenshot specs: 16:9 or 9:16, min 320px on shortest side, max 3840px on longest side. PNG or JPEG.

---

## Feature Graphic

Required: 1024×500 PNG banner image.
Suggested design: dark navy (#020617) background, mint (#2dd4bf) "TrainerApp" wordmark centred, subtle grid or body silhouette in background.

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

---

## Build & Upload Steps

1. Run `npx cap sync android` to sync any config changes
2. Open Android Studio: `npx cap open android`
3. **Build → Generate Signed Bundle / APK → Android App Bundle (AAB)**
4. Select keystore: `/Users/satananth/trainerapp-release.keystore`
   - Key alias: `trainerapp`
   - Passwords: `TrainerApp@2024`
5. Select **Release** build variant → Finish
6. AAB output: `android/app/release/app-release.aab`
7. In Play Console → **Testing → Internal testing → Create new release → Upload AAB**
