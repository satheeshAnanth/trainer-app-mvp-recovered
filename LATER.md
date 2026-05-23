# Deferred Items

Items intentionally pushed out of scope. Revisit when the core product is stable with real users.

---

## Item 42 — Google Calendar / Apple Calendar sync

**What:** Trainers and clients sync scheduled appointments to Google Calendar / Apple Calendar.

**Why deferred:** Requires Google OAuth consent flow, Calendar API credentials, and `.ics` generation for Apple Calendar. High auth-integration complexity before the scheduling data model is proven stable.

**When to revisit:** After scheduling is used in production by 5+ trainers with recurring appointments.

**Rough approach when ready:**
- Google Calendar: OAuth 2.0 with `calendar.events` scope → insert/update events via Calendar API
- Apple Calendar: generate `.ics` files per event → expose as a downloadable URL or webcal:// feed
- Consider a third-party bridge (Cronofy, Nylas) to avoid managing both OAuth flows directly
