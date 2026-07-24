# Cadence — Remaining Work

_Last updated: 2026-07-24. See `docs/AGENT_HANDOFF.md` for full current state._

Much of P0–P4 Capacitor migration and Cadence 1.3.x Play closed testing is done. What’s left:

---

## Play / release

- [ ] **Phone screenshots** (≥2, ideally 4–6) for store listing — see `docs/play-store/SCREENSHOTS.md`
- [ ] Promote **1.3.1 (7)** toward production when screenshots + Data safety + rating done
- [ ] Optional: upload R8 mapping / native debug symbols (Play warning; non-blocking for closed testing)
- [x] Cadence branding, icon, splash (1.3.1)
- [x] Listing title/feature graphic/icon sync for Cadence

## Push (FCM)

- [ ] **On-device verification** that FCM delivers for:
  - schedule status / new request
  - session publish
  - client self-log
- Server wiring and `google-services.json` were added earlier — treat as “prove on hardware.”

## Media

- [ ] Human QA YouTube approved embeds
- [ ] WorkoutX **production** license decision (`docs/WORKOUTX_GIF_STORAGE.md`)
- [x] WorkoutX testing approve + Blob cache + curated shortlist seed

## Product deferred

- [ ] Gym seat **billing** / invoices
- [ ] Multi-gym membership
- [ ] Cadence Option B (full lime/orange theme)
- [ ] iOS

## Owner ops

- Keep Vercel env vars current (`DATABASE_URL`, MSG91, session/admin secrets, WorkoutX, Blob, Firebase SA).
- MSG91 templates should say **Cadence** (see `ACTION_ITEMS.md`).
- After any launcher/splash change: uninstall + reinstall Android build.
