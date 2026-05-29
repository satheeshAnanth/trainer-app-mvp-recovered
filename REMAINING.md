# Remaining Work — Android / Capacitor Migration

_P0, P1, and P2.1–P2.5 are complete. Items below are what's left._

---

## P2 — Capacitor Setup (1 item left)

- [ ] **2.6 App icons & splash screen**
  - Need a 1024×1024 PNG source icon
  - Run `npx @capacitor/assets generate` to produce all Android density variants
  - Replaces the Capacitor placeholder icons currently in `android/app/src/main/res/mipmap-*/`
  - After this, the APK is ready to build in Android Studio (`npx cap open android`)

---

## P3 — Quality Pass

- [ ] **3.1 Replace week calendar with horizontal day-strip**
  - `app/schedule/page.js`
  - The `calView === "week"` branch renders `repeat(7, 1fr)` grid — each cell is ~48px wide at 360px, event text truncates to nothing
  - Replace with: horizontally scrollable row of 7 day pills; tapping a day shows that day's events in a list below
  - Same fix needed in `app/my-portal/schedule/page.js` for the client schedule view

- [ ] **3.2 Schedule action buttons → bottom sheet**
  - `app/schedule/page.js`, `app/my-portal/schedule/page.js`
  - Each event card stacks 4 buttons (Confirm / Decline / Reschedule / Cancel) vertically, making cards very tall with small tap targets
  - Replace with a single "Actions" ghost button per card that opens a bottom sheet listing the options

- [ ] **3.3 Responsive clamp on dashboard hero title and KPI values**
  - `app/globals.css`
  - `.dashboard-hero-title`: add `font-size: clamp(24px, 8vw, 42px)` + `text-overflow: ellipsis`
  - `.kpi-value`: add `font-size: clamp(28px, 9vw, 44px)` + `text-overflow: ellipsis`
  - Prevents long trainer names or large numbers from wrapping badly on 360px devices

- [ ] **3.4 Swap `navigator.clipboard` for `@capacitor/clipboard`**
  - `app/profile/page.js` — referral link copy button
  - `navigator.clipboard.writeText` silently fails in Android WebView without a user-gesture context
  - Replace with `@capacitor/clipboard` (already installed); guard with `Capacitor.isNativePlatform()` so web browser fallback still works

- [ ] **3.5 Wire Client Tips page to real API**
  - `app/my-portal/tips/page.js`
  - Currently renders 3 hardcoded static tips
  - Fetch from `/api/client/tips` on mount and render dynamic tips from the trainer
  - Show empty state if no tips have been set

- [ ] **3.6 Wire Client Profile page to real API**
  - `app/my-portal/profile/page.js`
  - Weight, height, activity level, and goal fields currently use hardcoded `defaultValue` (67.2kg, 166cm, etc.)
  - Fetch real values from `/api/client/profile` on mount
  - Wire Save button to `PATCH /api/client/profile`

- [ ] **3.7 Add client session detail view**
  - New route: `app/my-portal/sessions/[id]/page.js`
  - Clients currently have no way to drill into an individual session from their dashboard
  - Should show: exercises logged, goal summary, trainer notes, publish comment, and the discussion thread
  - Read-only; no editing by the client

---

## P4 — Post First APK

- [ ] **4.1 Push notifications (FCM)**
  - Install `@capacitor/push-notifications`
  - Set up a Firebase project and add `google-services.json` to `android/app/`
  - Add FCM token registration on app launch; store token against the trainer/client record in the DB
  - Server-side: call FCM API to push notifications for schedule confirmations and session publishes
  - Replace the existing `window.Notification` / localStorage deduplication code

- [ ] **4.2 Android back button guard in trainer onboarding**
  - `app/onboard/trainer/page.js`
  - Multi-step onboarding (4 steps) uses in-page `step` state not tied to browser history
  - Android hardware back button on step 2+ exits the page entirely, wiping the form
  - Use `@capacitor/app` `backButton` listener to step back instead of navigating away
  - On step 1, `App.exitApp()` or navigate to `/login`

- [ ] **4.3 Swipe-to-action on schedule event cards**
  - `app/schedule/page.js`, `app/my-portal/schedule/page.js`
  - After 3.2 is done (bottom sheet), this is a further UX polish step
  - Swipe left on a card to reveal 1–2 primary actions (e.g. Confirm, Cancel)
  - Requires a touch gesture library (e.g. `@use-gesture/react`) or a custom `touchstart`/`touchend` handler

- [ ] **4.4 Offline fallback / error states for network loss**
  - When the Capacitor WebView loses connectivity to the Vercel server, pages show a blank screen or Next.js error
  - Add a global `offline` event listener that renders a full-screen "You're offline" banner
  - Consider a service worker with a minimal offline page for the most critical routes

- [ ] **4.5 Play Store listing preparation**
  - Generate a signed release APK / AAB with a production keystore (store the keystore securely — not in git)
  - Write Play Store listing copy: short description, full description, keywords
  - Prepare screenshots: login flow, trainer dashboard, session log, client portal (minimum 2 phone screenshots required)
  - Set up an internal test track in Google Play Console before public release

---

## Owner Action Items (Blockers not in code)

These cannot be done in code — they require action from you:

- **App icon source file**: Provide a 1024×1024 PNG to unblock P2.6
- **Production Vercel env vars**: Ensure `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `SESSION_SECRET`, `ADMIN_SECRET`, and `NEXT_PUBLIC_APP_URL=https://trainer-app-mvp-recovered.vercel.app` are set in the Vercel dashboard
- **Android Studio**: Install Android Studio locally to open the project (`npx cap open android`) and build the APK
- **Google Play Console account**: Required for P4.5; registration costs a one-time $25 USD fee
- **Firebase project**: Required for P4.1 push notifications; free tier is sufficient
