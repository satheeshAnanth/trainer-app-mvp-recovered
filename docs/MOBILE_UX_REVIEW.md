# Mobile Experience Review — Full Audit (2026-07-20)

## Purpose and how to use this document

This is a systematic review of the mobile experience, written to be executed by a coding
agent (e.g. Cursor) without further design debate. It **supersedes and absorbs** the
lighter-weight running notes in `docs/DESIGN_REVIEW.md` and `MOBILE_PLAN.md` — those files
still track ad-hoc progress and can stay, but this document is the source of truth for
*why* each item matters and what "done" looks like.

Every finding below is tied to:
- **Evidence** — an actual file/line in this repo (verified while writing this review, not inferred).
- **Guideline** — a named, citable standard, not personal taste.
- **Recommendation** — what to change, stated at a level an implementation agent can act on directly.
- **Priority** — P0 (breaks the native feel / accessibility violation), P1 (materially cheapens the experience), P2 (polish).

No code was changed to produce this review.

### Guidelines used (canonical, non-negotiable sources — not opinions)
- **Apple Human Interface Guidelines** — developer.apple.com/design/human-interface-guidelines (touch targets, navigation, feedback)
- **Material Design 3** — m3.material.io (Android interaction patterns: back behavior, snackbars, bottom sheets, pull-to-refresh)
- **WCAG 2.2 (Level AA)** — w3.org/WAI/WCAG22 (zoom, contrast, target size — SC 1.4.4, 1.4.10, 2.5.8)
- **Nielsen Norman Group heuristics** — nngroup.com (recognition over recall, visibility of system status, progressive disclosure)
- **web.dev PWA guidance** — web.dev (manifest correctness, offline, installability)

---

## 0. Architecture decision — Capacitor hybrid, not a native rewrite

**Decision: keep the current Next.js + Capacitor architecture. Do not rewrite this as a
native (Swift/Kotlin) or React Native app.** This is stated explicitly here so it isn't
left implicit for whoever executes this roadmap next.

This wasn't an open question the review was evaluating — the choice to wrap the app via
Capacitor was already made and substantially executed before this review: `MOBILE_PLAN.md`
exists, the Android platform is already built, and real native-plugin integration is
already wired up correctly (`StatusBar`, `SplashScreen`, and a `Keyboard`-aware
`--keyboard-height` CSS variable — see `app/_components/CapacitorInit.js`). The review
below operates *inside* that decision (making the existing wrapper feel more native), not
as a referendum on whether Capacitor was the right call.

Making the call explicit now that it's been asked directly:

- **One codebase already serves three surfaces** — the Vercel-hosted web app, the
  installable PWA (`public/manifest.json`), and the Android wrapper (`capacitor.config.ts`,
  server-mode pointing at the live Vercel deployment) — from the same Next.js App Router
  code. A native or React Native rewrite would discard that and require re-implementing
  every screen (session capture, schedule, client management, onboarding) a second time in
  a different framework, for a product that's still pre-launch (`sessions` table has 0
  rows at time of writing) and doesn't yet have the usage data to justify that cost.
- **The plugin work already done proves the hybrid approach can hit genuinely native
  behavior here** — correct safe-area handling, keyboard-aware modal sizing, numeric OTP
  autofill. These aren't superficial; they're the parts that are hardest to get right in a
  hybrid app and they're already done correctly.
- **Every gap this review found (§2, §3) is closeable inside Capacitor** — hardware
  back-button handling, push notifications, pull-to-refresh, haptics, and an iOS platform
  target are all standard Capacitor plugins/patterns, not architectural blockers. None of
  them require leaving the current stack.
- **Revisit this decision, don't re-litigate it, if**: performance profiling ever shows the
  WebView is a genuine bottleneck for a specific high-frequency interaction (unlikely for
  this app's usage pattern — mostly forms, lists, and scheduling, not real-time or
  graphics-heavy work), or if a feature requires native APIs Capacitor has no plugin for.
  Neither condition exists today.

**Net: execute the P0-P2 roadmap in §7 against the current architecture. The cost of
closing those gaps is far lower than the cost of a rewrite, and nothing found in this
review is evidence the wrapper approach itself is wrong.**

---

## 1. Current state — what's already right

Credit where it's due, so the roadmap below reads as gaps, not a rewrite:

- Bottom tab bar for both trainer and client shells (`app/_components/TrainerShell.js`,
  `app/_components/ClientShell.js`) with `env(safe-area-inset-bottom)` padding
  (`app/globals.css:508`) — correct pattern for notch/gesture-bar devices.
- Desktop nav is properly `display: none` below 768px (`app/globals.css:361`, re-shown at
  `:1047`) — no duplicate navigation on phones.
- OTP input already uses `inputMode="numeric"` and `autoComplete="one-time-code"` (per
  `MOBILE_PLAN.md` P0.1) — this is the correct native-feel pattern for SMS auto-fill.
- Keyboard-aware modal sizing via the Capacitor Keyboard plugin writing a
  `--keyboard-height` CSS variable (`app/_components/CapacitorInit.js:26-36`,
  `app/globals.css:766`) — a commonly-skipped detail that's actually handled here.
- Viewport meta and safe-area insets are applied consistently across auth, portal, and
  trainer screens, not just the home page.
- An `OfflineBanner` component exists and is mounted globally in `app/layout.js` — offline
  state is at least surfaced, not silent.

## 2. Platform-completeness gaps (P0)

### 2.1 No Android hardware back-button handling
**Evidence:** `app/_components/CapacitorInit.js` wires `StatusBar`, `SplashScreen`,
`Keyboard` — there is no `App.addListener('backButton', …)` anywhere in the codebase, and
none of the modals (exercise search modal, add-client modal, exercise editor in
`app/sessions/new/page.js`) are wired to intercept it.
**Why it matters:** On Android, the hardware/gesture back action is the primary dismiss
mechanism users reach for. Modals here are pure React state (`useState`), not history
entries, so back-button presses fall through to the WebView's default behavior — which on
a top-level screen can exit the app while a modal is still open, and on others triggers a
confusing browser-style navigation instead of closing the sheet in front of the user. This
is one of the most common causes of a hybrid app "feeling like a website" rather than an
app.
**Recommendation:** Add a single global handler (via `@capacitor/app`'s `backButton`
listener) that: (1) closes the topmost open modal/sheet if one is open, (2) otherwise
navigates back via `next/navigation`'s router, (3) only exits the app from the root tab
screens after a confirmation or double-back-to-exit pattern. Centralize this once in
`CapacitorInit.js` or a new `BackButtonGuard` component, driven by a lightweight "modal
stack" the open modals register themselves into.
**Priority:** P0 — this is Android table-stakes, not a nice-to-have.

### 2.2 No iOS target exists
**Evidence:** `capacitor.config.ts` and the repo have an `android/` platform folder only;
no `ios/` directory. `layout.js` does set `appleWebApp: { capable: true, statusBarStyle:
"black-translucent" }`, indicating the app was at least designed with Safari/iOS PWA
installation in mind, but there's no native iOS wrapper.
**Why it matters:** In the Indian fitness-trainer/client market this app targets, iPhone
share is meaningful and trainers/clients skew toward users who expect "the app," not "add
to home screen." Every native-feel investment made for Android (StatusBar, SplashScreen,
Keyboard resize) currently has no iOS equivalent.
**Recommendation:** Decide explicitly whether iOS is in scope for this phase. If yes, run
`npx cap add ios`, wire the same three Capacitor plugins for iOS, and add the standard
`apple-touch-icon` link tags plus iOS splash-screen image set (Apple requires static
launch images or a storyboard, not just `manifest.json`). If iOS is deliberately out of
scope for now, say so in `docs/AGENT_HANDOFF.md` so it isn't silently forgotten.
**Priority:** P0 if iOS users are expected at all in the near term; otherwise document the
deferral explicitly.

### 2.3 `manifest.json` icon paths are almost certainly broken
**Evidence:** `public/manifest.json` icons use `"src": "../icons/icon-48.webp"` etc. The
manifest is served from `/manifest.json` (root scope, per `"scope": "/"`), so `../icons/…`
resolves *above* the site root — not to `/icons/…`. Icon files actually live at
`public/icons/*.webp`, i.e. the correct manifest path is `/icons/icon-48.webp` (no `../`).
**Why it matters:** This breaks "Add to Home Screen" icon resolution and maskable icon
purpose on Android Chrome/PWA install prompts — one of the most visible parts of "feels
like an app," since a broken icon shows a generic placeholder instead of the brand mark.
**Recommendation:** Change every `icons[].src` entry from `../icons/...` to `/icons/...`
and verify with Chrome DevTools → Application → Manifest that all icons resolve (no red
errors) and that at least one `512x512` icon is marked `purpose: "any"` in addition to
`maskable` (a icon marked only `maskable` can fail the installability check on some
Android versions — HTML/PWA spec expects at least one non-maskable-only icon).
**Priority:** P0 — small fix, directly affects first impression on install.

### 2.4 Push notifications not implemented
**Evidence:** Already tracked as `MOBILE_PLAN.md` P4.1, still `⏳ Pending`. `package.json`
has no `@capacitor/push-notifications` dependency.
**Why it matters:** Session reminders, schedule changes, and payment confirmations are all
time-sensitive; without push, this is a "check the app and hope" experience rather than a
mobile-app experience. This is very likely the single highest-leverage native-feel gap.
**Recommendation:** No change to the existing plan — keep this as the top P4 item, but
consider pulling it earlier than "post first APK" given how central scheduling is to this
product. Needs FCM project setup + `@capacitor/push-notifications` + a server-side send
path (there's no notification-sending code anywhere in `app/api` today).
**Priority:** P0/P1 — re-sequence ahead of pure polish items.

---

## 3. Native interaction patterns missing (P1)

### 3.1 No pull-to-refresh on list-heavy screens
**Evidence:** No `pull-to-refresh` or `PullToRefresh` reference anywhere in `app/`. Screens
like `app/schedule/page.js`, `app/clients/page.js`, `app/audit/page.js` all fetch data on
mount with a manual "Refresh" text button instead (e.g. `app/audit/page.js:65`).
**Why it matters:** Pull-to-refresh is the default mental model for "get fresh data" on
both iOS and Android; a text button buried at the top of a card reads as a web dashboard,
not an app.
**Recommendation:** Add pull-to-refresh to the three or four highest-traffic list screens
(Schedule, Clients, Sessions, Audit) using a small custom touch-gesture handler or a
maintained Capacitor-compatible library. Keep the existing "Refresh" button as a fallback
for desktop/browser use — don't remove it, just stop relying on it as the only mechanism
on a touch device.
**Priority:** P1.

### 3.2 No haptic feedback
**Evidence:** No `@capacitor/haptics` dependency in `package.json`; nothing calls it.
**Why it matters:** Both Apple HIG and Material 3 treat haptic confirmation as a standard
part of primary-action feedback (completing a set, saving a draft, confirming a payment).
Its total absence is a small thing individually, but it's part of why a Capacitor-wrapped
web app can feel like a web app instead of a phone app.
**Recommendation:** Add `@capacitor/haptics` and trigger a light `impact` on: logging a
set (`sessions/new`), saving a draft, marking a session complete, and confirming payment
receipt. Keep it to 3-5 call sites — don't scatter it everywhere or it becomes noise.
**Priority:** P1.

### 3.3 Loading states are plain text, not skeletons
**Evidence:** Every data-fetching screen checked (`TrainerInsightsPanel.js:87`,
`audit/page.js:97`, `clients/[id]/week/page.js:71`, `my-portal/page.js`) shows literal
`"Loading…"` text rather than a content-shaped placeholder.
**Why it matters:** Nielsen Norman's "visibility of system status" heuristic is satisfied
either way, but skeleton screens that mirror the eventual card/list layout reduce perceived
load time and are the de-facto native-app convention (both platforms' first-party design
systems use them). Text-only loading is a recognizable "this is a website" signal.
**Recommendation:** Introduce one reusable skeleton component (a card-shaped pulse
placeholder) and swap it in for the `"Loading…"` string on the 4-5 screens above. This is
a small, contained, high-visibility improvement — good candidate for a single focused PR.
**Priority:** P1 (visible on nearly every screen, so the perception impact is outsized for
the effort).

### 3.4 Toasts/snackbars still pending
**Evidence:** Already flagged in `docs/DESIGN_REVIEW.md` ("Add reusable toast/snackbar
feedback component instead of inline status text") — confirmed still true; status/error
strings are inline text throughout (`app/profile/page.js`, `sessions/new/page.js`, etc.)
**Why it matters:** Endorsing the existing note with a citation: Material 3's Snackbar
spec (single line, auto-dismissing, non-blocking, positioned clear of both the keyboard and
bottom nav) is exactly the pattern needed here, since inline status text shifts layout and
is easy to miss below the fold on a small screen.
**Recommendation:** Build one `<Toast />`/`<Snackbar />` primitive, positioned with
`bottom: calc(<tabbar-height> + env(safe-area-inset-bottom) + 12px)` so it never collides
with the bottom tab bar, and route all the existing inline success/error strings through
it incrementally.
**Priority:** P1 — already correctly identified previously; re-confirming priority.

### 3.5 No bottom-sheet pattern for multi-action screens
**Evidence:** `docs/DESIGN_REVIEW.md` already flags "Session detail has many actions in one
screen; could benefit from segmented tabs" and `MOBILE_PLAN.md` P3.2 flags the same for
schedule action buttons ("Schedule action buttons → single 'Actions' bottom sheet",
still `⏳ Pending`).
**Why it matters:** Confirming this with the guideline it maps to: Material 3's modal
bottom sheet is the standard mobile substitute for a row of inline buttons or a desktop
dropdown menu — it keeps primary content uncluttered and puts actions within one-thumb
reach at the bottom of the screen, consistent with the repo's own stated principle in
`DESIGN_REVIEW.md`: *"every major screen should be fully usable with one thumb on 390px
width."*
**Recommendation:** No new discovery here — just confirming the existing plan item is
correctly scoped and should stay prioritized; implement as a shared `<ActionSheet />`
component so schedule and session-detail don't each build their own.
**Priority:** P1 (already tracked; keep it there).

---

## 4. Accessibility and input correctness (P0/P1)

### 4.1 Pinch-zoom is disabled site-wide
**Evidence:** `app/layout.js:18-22` — `viewport: { width: "device-width", initialScale: 1,
maximumScale: 1 }`.
**Why it matters:** WCAG 2.2 **SC 1.4.4 (Resize Text)** and **SC 1.4.10 (Reflow)** require
that users be able to zoom content up to 200% (SC 1.4.4) without loss of functionality.
`maximumScale: 1` (often combined with `user-scalable=no`, which this is equivalent to)
actively blocks that — a real accessibility conformance failure, not a style preference,
and it affects any user with low vision who relies on pinch-zoom, which is a meaningfully
large fraction of any trainer/client user base including older clients.
**Recommendation:** Remove `maximumScale: 1` (or set it to something like `5`). If the
motivation was to prevent the classic "double-tap zooms the layout" annoyance on form
inputs, that's solved correctly by keeping input font-size at 16px (already true here —
see 4.2) rather than by disabling zoom for everyone.
**Priority:** P0 — genuine accessibility conformance issue with a one-line fix.

### 4.2 iOS input auto-zoom — verified fine, no action needed
**Evidence:** `.field input`/`.field textarea` (`app/globals.css:600-609`) don't set an
explicit `font-size`, so they inherit the body's default (16px, since no root-level
font-size reset exists in this stylesheet). 16px is exactly the threshold iOS Safari uses
to decide whether to auto-zoom on focus.
**Why it matters / recommendation:** Nothing to fix — flagging this so it's not
"rediscovered" and accidentally broken later. If anyone ever adds a smaller font-size to an
input for density reasons, that will reintroduce the classic iOS zoom-on-focus jump; leave
it at 16px or above.
**Priority:** N/A (informational — protect this, don't touch it).

### 4.3 Touch targets below the 44pt/48dp minimum on several compact buttons
**Evidence:** `.ghost-button-sm` / `.mint-button-sm` / `.ghost-button-compact`
(`app/globals.css:464-482`) use `padding: 8px 10px` with `font-size: 13px` and no
`min-height`. Rendered height works out to roughly 34-36px — below both Apple HIG's 44pt
and Material 3's 48dp minimum tap target guidance. The base `.mint-button`/`.ghost-button`
(`:449-456`, `padding: 10px 12px`, `font-size: 14px`) also lands close to the line (~40px).
These compact variants are used for things like per-set "Delete" actions and inline chip
buttons — exactly the controls used repeatedly and one-handed during a live workout log.
**Why it matters:** WCAG 2.2 **SC 2.5.8 (Target Size, Minimum)** requires an effective
24×24 CSS px minimum (AA), and both platform guidelines recommend well above that (44/48).
Undersized targets in a screen used mid-workout (sweaty hands, one-handed, often outdoors)
are a real usability cost, not just a guideline checkbox.
**Recommendation:** Add `min-height: 44px` (and comfortable horizontal min-width for
icon-only buttons) to `.ghost-button-sm`, `.mint-button-sm`, and `.ghost-button-compact` —
visual size/padding can stay the same if desired; use a transparent hit-area expansion
(e.g. `min-height` plus centered content) rather than changing the visual footprint if
density is a concern.
**Priority:** P1 — not a conformance-breaking violation at their exact size (24px AA floor
is technically met), but well below best-practice comfort, on controls used constantly.

### 4.4 Body-text contrast — spot check, no issue found
**Evidence:** `--muted: #94a3b8` on `--bg: #020617`/`--card: #0f172a` — contrast ratio
computes to roughly 8.9:1 against `#020617` and 6.7:1 against `#0f172a`, both comfortably
above WCAG AA's 4.5:1 for normal text.
**Recommendation:** None needed — noting this so contrast isn't re-litigated without data;
if new muted-text colors are introduced later, check them against the same 4.5:1 bar.
**Priority:** N/A (informational).

---

## 5. Content density and information architecture (P1 — mostly already tracked)

These two items were already correctly identified in `docs/DESIGN_REVIEW.md`; this section
adds the "why," confirms they're still current, and gives them explicit acceptance
criteria so an execution agent knows what "done" looks like.

### 5.1 Long forms without step-wise progression
**Where:** `app/sessions/new/page.js` (1000+ lines, multiple tabs each with dense forms),
client self-log (`app/my-portal/self-log/page.js`).
**Guideline:** Progressive disclosure (Nielsen Norman) and Material 3's Stepper pattern —
break a long linear form into discrete steps with a single visible primary action per
step, rather than one long scroll with several calls to action competing for attention.
**Acceptance criteria for "done":** On a 390px-wide viewport, each step of the flow fits
without requiring the user to scroll past the primary action to find it; a persistent
sticky "Continue"/"Save" button stays pinned above the safe-area/keyboard at all times.

### 5.2 Session detail screen overloaded with actions
**Where:** `app/sessions/new/page.js` — draft capture, assessment, discussion, payment
request, and lock/finalize all live in adjacent sections of one scroll.
**Guideline:** Material 3 Tabs/Segmented Buttons for switching between mutually exclusive
task modes (this is already partially done via the existing `wizard-tabs` — the gap is
that some sub-sections like Payment and Discussion still render inline rather than behind
their own tab/sheet).
**Acceptance criteria:** Each of Summary / Notes / Discussion / Payment is reachable via an
explicit tab or bottom sheet, not by scrolling past unrelated content.

---

## 6. Visual/brand decisions to confirm, not "fix" blindly

### 6.1 Forced dark theme, no light mode
**Evidence:** `:root { color-scheme: dark; }` (`app/globals.css:2`) with no
`prefers-color-scheme: light` branch anywhere.
**Why flag it:** This may well be an intentional brand decision (many fitness apps go
dark-only deliberately), so this is **not** framed as a bug. The one concrete usability
note worth surfacing: gyms are frequently bright, glare-heavy environments, and a
dark-only UI is measurably harder to read in direct sunlight/bright overhead lighting than
a high-contrast light option would be. This is a product decision, not a guideline
violation — flagging it so it's a conscious choice rather than an oversight.
**Recommendation:** Confirm with the product owner whether dark-only is deliberate. If so,
no action needed. If light mode is ever requested, treat it as a separate design-token
exercise, not a quick patch.
**Priority:** Decision needed, not a defect.

---

## 7. Consolidated priority roadmap

This merges new findings with the still-pending items already tracked in `MOBILE_PLAN.md`
so there is one ordered list instead of three.

| # | Item | Source | Effort |
|---|------|--------|--------|
| P0 | Fix `manifest.json` icon paths (`../icons` → `/icons`) | §2.3, new | Trivial |
| P0 | Remove `maximumScale: 1` from viewport meta | §4.1, new | Trivial |
| P0 | Android hardware back-button handling for modals/navigation | §2.1, new | Medium |
| P0 | Decide iOS scope explicitly (build it or document the deferral) | §2.2, new | Large if building |
| P0/P1 | Push notifications (FCM + `@capacitor/push-notifications`) | MOBILE_PLAN P4.1 | Large |
| P1 | Touch target sizing on compact/sm button variants | §4.3, new | Small |
| P1 | Toast/snackbar component to replace inline status text | DESIGN_REVIEW, confirmed | Medium |
| P1 | Bottom-sheet pattern for schedule actions + session detail tabs | MOBILE_PLAN P3.2, DESIGN_REVIEW | Medium |
| P1 | Stepper pattern for long forms (`sessions/new`, self-log) | DESIGN_REVIEW, confirmed | Medium |
| P1 | Pull-to-refresh on Schedule/Clients/Sessions/Audit | §3.1, new | Medium |
| P1 | Skeleton loading states (replace "Loading…" text) | §3.3, new | Small-Medium |
| P1 | Route guard/redirect UX for unauthenticated states | DESIGN_REVIEW, confirmed | Medium |
| P2 | Haptic feedback on key confirmations | §3.2, new | Small |
| P2 | `clamp()` on hero title / KPI value type sizes | MOBILE_PLAN P3.3 | Trivial |
| P2 | Swap `navigator.clipboard` → `@capacitor/clipboard` | MOBILE_PLAN P3.4 | Small |
| P2 | Deep link intent filter for `/invite/[token]` | MOBILE_PLAN P2.5 | Small |
| P2 | Swipe-to-action on schedule cards | MOBILE_PLAN P4.3 | Medium |
| Decision | Confirm dark-only theme is intentional | §6.1, new | N/A |

Items marked "MOBILE_PLAN Pxx" or "DESIGN_REVIEW" are pre-existing entries this review
confirmed are still valid and correctly scoped — they are not being re-invented, just
folded into one ranked list with the new findings.
