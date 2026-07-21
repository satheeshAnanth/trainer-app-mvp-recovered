# Production readiness checklist — Play Console

Use this to move TrainerApp from testing toward production.

**Automation:** once a Play service account JSON is in `.secrets/play-store-service-account.json`, run:

```bash
npm install
npm run play:check
npm run play:ship -- --build
```

Details: `docs/play-store/AUTOMATION.md`

Package: `in.trainer.fitness`  
Current AAB: versionCode **3** / versionName **1.2**  
Path: `android/app/build/outputs/bundle/release/app-release.aab`

## A. Store listing (must complete)

- [ ] App name: `TrainerApp`
- [ ] Short description (from `PLAYSTORE_LISTING.md`)
- [ ] Full description (from `PLAYSTORE_LISTING.md`)
- [ ] App icon 512×512 (`public/icons/icon-512.webp` — convert to PNG if Console rejects WebP)
- [ ] Feature graphic 1024×500 (`store-assets/feature-graphic.png`)
- [ ] At least 2 phone screenshots (`store-assets/screenshots/`)
- [ ] Category: Health & Fitness
- [ ] Contact email: `getsatxray@gmail.com`
- [ ] Privacy policy URL: `https://trainer-app-mvp-recovered.vercel.app/privacy`
- [ ] Optional terms URL: `https://trainer-app-mvp-recovered.vercel.app/terms`

## B. App content declarations

- [ ] Privacy policy linked
- [ ] Data safety form (`docs/play-store/DATA_SAFETY.md`)
- [ ] Content ratings / IARC (`PLAYSTORE_LISTING.md`)
- [ ] Target audience: 18+ recommended (fitness coaching adults)
- [ ] News apps: No
- [ ] COVID-19: No
- [ ] Data safety ads declaration: No ads
- [ ] Government apps: No
- [ ] Financial features: payment tracking only / no brokerage
- [ ] Health apps: declare fitness tracking; not a medical device
- [ ] App access: all functionality available without special access (trainer self-signup)

## C. Release track

- [ ] Upload signed AAB (versionCode must increase each upload)
- [ ] Countries: start with **India**
- [ ] Free app, no ads, no IAP
- [ ] Internal testing → Closed testing (add ≥12 testers if aiming for production faster) → Production
- [ ] Release notes / What's new (`docs/play-store/WHATS_NEW.md`)

## D. Reviewer notes (paste into Console)

```
TrainerApp is an OTP-login fitness practice tool for trainers and clients in India.

Reviewer path:
1. Open app → Sign up / Login as trainer with any Indian mobile number.
2. Complete OTP verification.
3. Add a sample client from Clients, then open Log / Sessions to create a session.
4. Client portal is invite-based; trainer flow alone covers core functionality.

Privacy policy: https://trainer-app-mvp-recovered.vercel.app/privacy
Support: getsatxray@gmail.com
Package: in.trainer.fitness
```

## E. Still blocked until you capture

Screenshots cannot be auto-generated from real product state here without a demo session on device. Follow `docs/play-store/SCREENSHOTS.md`.
