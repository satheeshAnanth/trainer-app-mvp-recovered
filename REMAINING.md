# Remaining Work — Android / Capacitor Migration

_P0, P1, P2, P3, and most of P4 are complete._

---

## P4 — Post First APK

- [ ] **4.1 Push notifications (FCM)**
  - Install `@capacitor/push-notifications`
  - Set up a Firebase project and add `google-services.json` to `android/app/`
  - Add FCM token registration on app launch; store token against the trainer/client record in the DB
  - Server-side: call FCM API to push notifications for schedule confirmations and session publishes
  - Replace the existing `window.Notification` / localStorage deduplication code

- [x] **4.3 Swipe-to-action on schedule event cards** ✅
  - `SwipeableCard` component using native touch events (no library)
  - Swipe left > 55px triggers the Actions bottom sheet on both trainer and client schedule

- [ ] **4.5 Play Store listing — screenshots**
  - All listing copy is written in `PLAYSTORE_LISTING.md`
  - Still needed: 4–6 phone screenshots (login, dashboard, session log, client portal, schedule, week view)
  - Feature graphic: 1024×500 PNG banner

---

## Owner Action Items

- **Play Console account**: Personal Google account `getsatxray@gmail.com` (package `in.trainer.fitness`) — see `PLAYSTORE_LISTING.md`
- **Production Vercel env vars**: Ensure `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `SESSION_SECRET`, `ADMIN_SECRET`, and `NEXT_PUBLIC_APP_URL=https://trainer-app-mvp-recovered.vercel.app` are set in the Vercel dashboard
- **Firebase project**: Required for push — add Android app `in.trainer.fitness`, put `google-services.json` in `android/app/`, and set `FIREBASE_SERVICE_ACCOUNT_JSON` on Vercel (HTTP v1; no legacy server key)
- **Play Store screenshots**: Required for 4.5 — take on a real Android device after APK testing
- **Final brand icon**: Replace `assets/icon-only.png` (1024×1024 PNG) and re-run `npx @capacitor/assets generate`
