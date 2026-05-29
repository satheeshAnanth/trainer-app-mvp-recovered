# Android / Capacitor Migration Plan

Strategy: Capacitor server-mode — `server.url` points at the Vercel deployment.  
No static export. Cookies, API routes, and MSG91 auth all unchanged.

---

## P0 — Must fix before wrapping (target: ~2 days)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 0.1 | OTP input: `inputMode="numeric"`, `autoComplete="one-time-code"`, `autoFocus` | `app/login/page.js`, `app/invite/[token]/page.js` | ✅ Done |
| 0.2 | Add Client modal: `dvh` height + Keyboard plugin so Save stays visible | `app/clients/page.js`, `app/globals.css` | ✅ Done |
| 0.3 | Exercise editor: remove backdrop dismiss; add explicit Back button | `app/sessions/new/page.js` | ✅ Done |
| 0.4 | Exercise search: add Search button (don't rely on Android Enter key) | `app/sessions/new/page.js` | ✅ Done |

---

## P1 — Week 1 high-friction fixes (target: ~3 days)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | Bottom nav active state: `pathname.startsWith` for Clients + Sessions tabs | `app/_components/TrainerShell.js`, `app/_components/ClientShell.js` | ✅ Done |
| 1.2 | Add Payments to client bottom nav | `app/_components/ClientShell.js` | ✅ Done |
| 1.3 | Surface exercise editor error inside modal (not below it) | `app/sessions/new/page.js` | ✅ Done |
| 1.4 | Move Sign Out to Profile page (trainer + client) | `app/_components/TrainerShell.js`, `app/_components/ClientShell.js`, `app/profile/page.js`, `app/my-portal/profile/page.js` | ✅ Done |
| 1.5 | Wizard tabs CSS: `repeat(4,1fr)` → `repeat(auto-fit, minmax(100px,1fr))` | `app/globals.css` | ✅ Done |
| 1.6 | Safe area insets on login + portal screens | `app/globals.css` | ✅ Done |

---

## P2 — Capacitor setup (target: ~2 days)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2.1 | Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` | `package.json` | ✅ Done |
| 2.2 | `capacitor.config.ts`: server mode → Vercel URL | `capacitor.config.ts` | ✅ Done |
| 2.3 | StatusBar + SplashScreen plugins | `capacitor.config.ts`, app init | ✅ Done |
| 2.4 | Keyboard plugin → `--keyboard-height` CSS var | `app/layout.js`, `app/globals.css` | ✅ Done |
| 2.5 | Deep link Intent Filter for `/invite/[token]` | `android/app/src/main/AndroidManifest.xml` | ⏳ Pending |
| 2.6 | App icons + splash assets (manifest refs missing PNGs) | `public/` | ⏳ Pending |

---

## P3 — Quality pass (target: ~3-4 days)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | Replace week calendar with horizontal day-strip | `app/schedule/page.js` | ⏳ Pending |
| 3.2 | Schedule action buttons → single "Actions" bottom sheet | `app/schedule/page.js`, `app/my-portal/schedule/page.js` | ⏳ Pending |
| 3.3 | `clamp()` on `.dashboard-hero-title` and `.kpi-value` | `app/globals.css` | ⏳ Pending |
| 3.4 | Swap `navigator.clipboard` → `@capacitor/clipboard` | `app/profile/page.js` | ⏳ Pending |
| 3.5 | Wire Tips page to `/api/client/tips` | `app/my-portal/tips/page.js` | ⏳ Pending |
| 3.6 | Wire Client Profile to real API (remove hardcoded defaults) | `app/my-portal/profile/page.js` | ⏳ Pending |
| 3.7 | Add `/my-portal/sessions/[id]` client session detail view | new route | ⏳ Pending |

---

## P4 — Post first APK

| # | Task | Status |
|---|------|--------|
| 4.1 | Push notifications (FCM + `@capacitor/push-notifications`) | ⏳ Pending |
| 4.2 | Android back button guard in onboarding (step back not page exit) | ⏳ Pending |
| 4.3 | Swipe-to-action on schedule cards | ⏳ Pending |
| 4.4 | Offline fallback / error states for network loss | ⏳ Pending |
| 4.5 | Play Store listing preparation | ⏳ Pending |

---

## Notes

- 2.5 (deep links) and 2.6 (icons) require owner action: a production domain and a 1024×1024 source icon
- All P0+P1 fixes improve the browser experience too — no downside to shipping them
- `ADMIN_SECRET` and `MSG91_*` env vars must be set in Vercel for production OTP to work
