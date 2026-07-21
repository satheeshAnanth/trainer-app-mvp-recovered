# WorkoutX GIF Storage — Licensing & Architecture Eval

Last updated: 2026-07-21

## Current behavior

- Exercise GIFs are **not permanently stored** in our blob storage.
- The app serves them through `/api/workoutx/gif/[id]`, which fetches from the WorkoutX CDN and can cache responses at the edge/CDN layer.
- Catalog mappings (exercise ↔ WorkoutX media id) live in our DB; the GIF bytes remain upstream.

## Recommendation (v1)

**Keep proxy + cache; do not permanently host GIF binaries yet.**

Reasons:

1. **Licensing risk** — Permanent rehosting usually requires explicit redistribution rights. Until WorkoutX (or an alternate library) confirms we may store and serve copies, proxying is the safer compliance posture.
2. **Cost / ops** — Hosting hundreds of animated GIFs increases blob egress and moderation burden for little UX gain once CDN caching is warm.
3. **Freshness** — Upstream can update or revoke media; permanent copies drift and create stale form demos.

## When to revisit permanent storage

Only after **written confirmation** that we may:

- download and store GIF/WebP files
- serve them to authenticated trainers/clients inside TrainerApp
- retain attribution / license metadata as required

Then prefer:

- store compressed WebP/MP4 in Vercel Blob (or R2)
- keep `license`, `source`, `retrieved_at`, `sha256` on the media row
- retain the proxy as a fallback for uncached items

## Interim UX mitigations (done / acceptable)

- Compact sticky preview in the exercise picker so trainers can still judge form when a GIF exists
- Clear “No approved GIF yet” empty state when media is missing
- Admin media review for YouTube form demos remains a separate, ToS-compliant path

## Decision

**Defer permanent WorkoutX GIF storage.** Track licensing outreach as an owner action; engineering stays on proxy + CDN cache until cleared.
