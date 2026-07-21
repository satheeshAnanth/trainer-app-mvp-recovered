# Exercise Reference Media (Image / Video) — Feature Spec (2026-07-20)

## Problem statement

Trainers and clients pick exercises from a catalog of **434 rows in `master_exercises`**
(verified by direct query against the live database at time of writing: 434 total, 434
`is_active`), but nothing in the product currently shows what any exercise actually looks
like. A first-time client (or a newer trainer) has no way to confirm "Cable Lateral Raise"
or "Bulgarian Split Squat" is being performed as intended without leaving the app. This
spec defines how to add a reference image and/or YouTube video per exercise, reachable
from Profile via search, and inline wherever an exercise is picked.

This is a documentation/spec artifact — **no code was changed**. It's written so an
execution agent (e.g. Cursor) can implement it directly against this schema.

## What already exists (verified, not assumed)

- `master_exercises` columns (from `information_schema`):
  `id, name, category, variation, equipment, aliases_json, tracking_json,
  important_input_fields_json, is_active, updated_at, environment, primary_muscles,
  secondary_muscles, measurement_profile, form_quality, source_sheet, source_row_num,
  source_payload_json`.
- **Zero rows currently contain any media reference.** Checked directly:
  `tracking_json`/`source_payload_json` contain no `http` URLs anywhere in the table. The
  original sheet import (`master_workbook_rows`) also has no image/video columns. This is
  a clean extension, not a migration of existing dirty data.
- `app/api/exercises/master/search/route.js` **already contains dead code** anticipating
  this feature: `extractImageUrl()` (lines 105-137) looks for an `imageUrl` /
  `thumbnailUrl` key inside `tracking_json` and returns it as `imageUrl` on every search
  result — but no UI anywhere consumes that field today (`grep` for `imageUrl` in
  `app/sessions/new/page.js` returns nothing). This tells us the intent was already there;
  it was never finished.
- `aliases_json` per exercise (e.g. `["lateral raise (cable)","lateral raise cable",
  "cable","lateral raise"]`) — useful later for fuzzy-matching free-text client entries to
  a catalog exercise, see §7.
- The exercise catalog is **only surfaced today** via `/api/exercises/master/search`,
  consumed from the trainer's exercise-picker modal in `app/sessions/new/page.js`
  (search results rendered ~line 1044-1054). **Client-facing self-log
  (`app/my-portal/self-log/page.js`) does not use the catalog at all** — it's free-text
  exercise names. There is no standalone "browse the exercise library" screen anywhere in
  the app today.
- An unrelated upload pipeline exists (`app/api/upload/route.js`, Vercel Blob, accepts
  `image/*` and `video/mp4`) — this is for session-evidence uploads (a trainer/client
  attaching a photo/clip to a specific session), a different concern from a curated,
  shared exercise-reference library. Don't conflate the two; media described in this spec
  is catalog-level (one canonical example per exercise, shared across all trainers/clients),
  not per-session uploads.

## Design decisions (with rationale)

### 1. Embed via YouTube's official mechanisms only — never rehost video files
YouTube's Terms of Service prohibit downloading/rehosting video content outside their
player; the only compliant way to show a YouTube video inside the app is:
- The **IFrame Player API** (`https://www.youtube.com/iframe_api`) or a plain `<iframe>`
  embed, ideally on the `youtube-nocookie.com` privacy-enhanced domain, or
- The **oEmbed endpoint** (`https://www.youtube.com/oembed?url=...`) to fetch title/
  thumbnail/embed HTML server-side for validation and caching metadata.

This also means: don't scrape search results or download video files — always store a
**video ID**, not a file, and always render through the official embed player.

### 2. Store structured references, not raw HTML
Add a dedicated table (see §3) rather than stuffing another key into the already-overloaded
`tracking_json` blob the dead `extractImageUrl()` code reads from. Reasons:
- `tracking_json`/`source_payload_json` are sheet-import artifacts (free-form JSON with
  inconsistent keys per row) — not a place to build a moderation/versioning workflow on
  top of.
- A separate table lets one exercise later have multiple candidate videos (e.g. one for
  "Barbell" variation, one for "Dumbbell"), a moderation/approval status, and an
  attribution/license field, without touching the sheet-import data at all.
- It keeps this feature's data lifecycle (curated, versioned, admin-reviewed) clearly
  separate from the sheet-import lifecycle (bulk re-imported periodically).

### 3. Curate top-down by category coverage, not by usage — because there is no usage data yet
The `sessions` table currently has **0 rows** (verified) — this is a pre-launch/early-stage
state, so there is no real "most-logged exercise" signal to prioritize by yet. Don't invent
a popularity ranking that doesn't exist. Instead, prioritize the initial curation pass by:
1. **Category coverage first** — ensure every one of the 11 categories has at least its
   most common/compound movements covered, using the real category breakdown:
   `Legs (58), Back (44), Core (44), Chest (42), Functional (40), Outdoor (40), Arms (38),
   Mobility/Warm-up (36), Shoulders (36), Cardio (32), Bodyweight/Calisthenics (24)`.
2. Within each category, prioritize compound/multi-joint movements and anything flagged
   `form_quality: "Primary"` (already a column on `master_exercises` — this is the sheet's
   own signal for form-sensitive exercises, exactly the ones most worth a visual reference).
3. Re-rank by real usage once `sessions` has data — instrument this from day one (see §6)
   so the "next 100" list is evidence-based instead of another guess.

## 3. Data model

New table, additive only — no existing table is altered.

```sql
CREATE TABLE exercise_media (
  id              TEXT PRIMARY KEY,              -- e.g. gen_random_uuid()::text
  exercise_id     TEXT NOT NULL REFERENCES master_exercises(id),
  media_type      TEXT NOT NULL CHECK (media_type IN ('image', 'youtube_video')),

  -- for media_type = 'youtube_video'
  youtube_video_id TEXT,                          -- the 11-char ID only, never a full URL blob
  title            TEXT,                          -- cached from oEmbed, for display + admin review
  channel_name     TEXT,                          -- cached from oEmbed, for attribution + trust signal
  duration_seconds INTEGER,                        -- optional, from a metadata lookup if available

  -- for media_type = 'image'
  image_url        TEXT,                           -- must point at a source we hold a license for (see §4)
  image_attribution TEXT,                           -- required if image_url is set

  status          TEXT NOT NULL DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review', 'approved', 'rejected')),
  submitted_by    TEXT,                            -- trainer_id/admin identifier, nullable for seed data
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  is_primary      BOOLEAN NOT NULL DEFAULT false,  -- the one shown by default when an exercise has >1 approved item
  last_checked_at TIMESTAMPTZ,                     -- last time link-liveness was verified (see §6)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX exercise_media_exercise_idx ON exercise_media (exercise_id) WHERE status = 'approved';
CREATE UNIQUE INDEX exercise_media_one_primary_idx ON exercise_media (exercise_id) WHERE is_primary AND status = 'approved';
```

Design notes:
- `status` defaults to `pending_review` so nothing goes live unmoderated, even
  admin-submitted rows — see §5 for why moderation matters here specifically.
- One exercise can have zero, one, or several approved media rows; `is_primary` picks the
  default shown one, the rest become a "more examples" list.
- This is intentionally decoupled from `master_exercises` schema changes — the existing
  434-row table is untouched, so this ships without touching the sheet-import pipeline.

## 4. Sourcing strategy — how the media actually gets populated

Manually sourcing 434 videos/images one-by-one is a real cost; be explicit about the
tradeoffs rather than picking one path silently.

| Approach | What it is | Tradeoff |
|---|---|---|
| **A. Manual curation (recommended for v1)** | An admin/trainer searches YouTube themselves, picks a reputable channel's demo video, pastes the video ID/URL into an admin form. | Highest quality control, but ~434 rows of manual work if done for everything at once — mitigated by the phased rollout in §2/§6 (start with the highest-value subset, not all 434 on day one). |
| **B. YouTube Data API-assisted search** | Server calls the YouTube Data API v3 `search.list` with the exercise name + "form"/"tutorial" as query, surfaces 3-5 candidates to an admin, who picks one (still goes through the same `pending_review` gate). | Speeds up curation meaningfully; requires a Google Cloud API key and is subject to a daily quota (default 10,000 units/day; a `search.list` call costs 100 units, so ~100 searches/day on the default free quota — budget the rollout around that, or request a quota increase). Never auto-publish API search results without human approval — search relevance for "correct exercise, correct form, reputable source" is not reliable enough to skip review. |
| **C. Trainer-submitted** | Any trainer can submit a video ID for an exercise they use often, from within the app. | Crowdsources coverage over time organically; still requires the same `pending_review` → `approved` gate before it's visible to anyone else, since trainer-submitted content quality will vary. |
| **D. Stock/licensed image sets** | For the `image` media type, use a properly licensed stock library (e.g. an existing commercial fitness photo/illustration license) rather than pulling images from a web image search. | Google Images / general web scraping for photos is a real copyright liability — don't do this. If no licensed image is available for an exercise, ship video-only for that row rather than an unlicensed image. |

**Recommended path:** start with A for the top-priority subset from §2, layer in B once
that's proven out to accelerate coverage, and open C once there's a live trainer base to
crowdsource from. Treat D as optional/nice-to-have, not required — a good instructional
video covers the "what does this look like" need on its own; a thumbnail image is a nice
fallback but shouldn't block launch.

## 5. Moderation and quality bar

Because this content is trust-sensitive (bad exercise form advice is a real safety
concern, not just a UX nitpick), every row — regardless of source — passes through the
same `pending_review` gate before being visible to end users. Suggested review checklist
for whoever approves (documented here so it can become an admin-screen checklist later):

- Video/image actually shows the named exercise and the correct equipment/variation
  (e.g. "Bench Press (Incline barbell)" must show an incline barbell press, not flat or
  dumbbell).
- Reasonable length for a quick reference (a 60-90 second form-focused clip is more useful
  here than a 20-minute full workout video).
- No overlaid ads, no low-quality/joke content, no channel with clearly unreliable
  coaching cues.
- For video: captions/clear audio not mandatory, but prefer channels that narrate form
  cues, since some users will have sound off.

## 6. Link-rot maintenance (specific to YouTube)

YouTube videos get taken down, made private, or age out — a curated library will silently
rot without a check.
**Recommendation:** a scheduled job (this repo already has an `/api/admin/*` surface and a
cron-friendly `schedule` skill available for the agent stack) that periodically calls the
oEmbed endpoint for each `approved` `youtube_video_id` and flags rows back to
`pending_review` if the request 404s/errors, plus updates `last_checked_at` on success.
Weekly is a reasonable cadence to start — this is metadata-only traffic, not user-facing
load, so it doesn't need to be real-time.

## 7. UI/UX placement

Grounded in the user's own framing — reachable from **Profile**, via **search** — plus the
inline entry points that make it useful in the moment, not just as a standalone reference:

1. **New: Exercise Library screen**, linked from both `app/profile/page.js` (trainer) and
   `app/my-portal/profile/page.js` (client) — a new route (e.g. `/exercises` or
   `/profile/exercises`) reusing the existing `/api/exercises/master/search` endpoint
   (already supports `q=` search and `withKeys=1`) plus a new `media` field on each result.
   Layout: searchable list grouped/filterable by `category` (data already supports this —
   11 known categories), each row shows a thumbnail if `media` exists, tapping opens a
   detail view with the embedded video/image and the exercise's existing `primary_muscles`
   / `secondary_muscles` / `equipment` metadata (all already in the table, currently
   unused in any UI).
2. **Inline in the trainer's exercise picker** — `app/sessions/new/page.js` around the
   search-result rendering block (~line 1044-1054): add a small "Watch example" icon/
   affordance next to each result that opens the same detail view (as a sheet, not a full
   navigation, to keep the trainer's flow uninterrupted).
3. **Client self-log** — lower priority integration, because `self-log` currently uses
   free-text exercise names with no link to `master_exercises` IDs at all (verified: no
   reference to `exercises/master/search` in `app/my-portal/self-log/page.js`). Two
   options, in order of effort:
   - *Cheap:* add a "Browse exercise library" link from the self-log screen that opens the
     same Exercise Library screen in a new context (not tied to the specific row being
     logged) — client looks it up, then types the name as before.
     - *Better, more work:* wire self-log's exercise field to the same catalog search
     component the trainer flow uses, so a logged entry actually references an
     `exercise_id` — this also happens to fix a pre-existing data-quality gap (client
     session logs currently can't be reliably matched back to the catalog at all), and
     would make the `aliases_json` field useful for the first time. Flagging this as a
     **separate, valuable side-effect** of doing the media feature properly, not a
     requirement for shipping media itself.
4. **Fallback state when no media exists yet:** given only a subset will be curated at
   launch (§2), the detail view needs an explicit "No example yet" state with a
   "Suggest a video" affordance (feeds option C in §4) rather than a broken/blank screen.

## 8. API surface needed (spec-level, not implemented)

- `GET /api/exercises/master/search` — extend existing response to include a `media`
  object per exercise: `{ primaryMedia: { type, youtubeVideoId | imageUrl, title } | null,
  hasMore: boolean }`. This is additive to the existing response shape.
- `GET /api/exercises/master/:id/media` — full list of approved media for one exercise
  (for the "more examples" list in the detail view).
- `POST /api/admin/exercise-media` — admin/trainer submission endpoint, always inserts as
  `pending_review`.
- `POST /api/admin/exercise-media/:id/review` — approve/reject, admin-only (reuse the
  existing `app/lib/adminAuth.js` guard already used by other `/api/admin/*` routes).

## 9. Suggested rollout order

1. Ship the schema (`exercise_media` table) and the two read endpoints — safe, additive,
   no user-visible change yet.
2. Curate category-anchor exercises first (§2) manually (Approach A) — enough to make the
   Exercise Library screen feel populated rather than empty, roughly the top 2-3
   compound/`form_quality: Primary` movements per category as a first pass.
3. Ship the Exercise Library screen + Profile entry point + inline picker affordance.
4. Add the admin review endpoint and checklist (§5) so curation can continue without a
   direct DB write for every new row.
5. Turn on the link-rot check (§6) once there's a meaningful number of approved rows to
   protect.
6. Revisit prioritization using real `sessions` data once it exists, and consider opening
   trainer submissions (Approach C) at that point.
