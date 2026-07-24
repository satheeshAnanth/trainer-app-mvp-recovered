# WorkoutX GIF Storage — Licensing & Architecture Eval

Last updated: 24 July 2026

## Current behavior (testing mode)

- Catalog mappings (exercise ↔ WorkoutX media id) live in `exercise_media`.
- For **closed testing**, all WorkoutX-linked rows are **approved** and GIFs are **cached**:
  - Prefer Vercel Blob URL in `cached_image_url` when `BLOB_READ_WRITE_TOKEN` is set
  - Else files under `storage/workoutx-gifs/` (gitignored), served by `/api/workoutx/gif/[id]`
  - Upstream WorkoutX API remains the fallback if cache miss
- App-facing `image_url` stays `/api/workoutx/gif/{id}` so clients do not need the API key.

Approve + cache:

```bash
npm run media:workoutx:approve-only   # DB approve only
npm run media:workoutx:approve-cache  # approve + download/cache GIFs (~2s pacing)
```

## Production subscription decision (deferred)

**Do not treat local/Blob caching as a production license.** Permanent redistribution still needs written WorkoutX rights / a paid plan decision after testing.

When ready for production:

1. Confirm redistribution / commercial terms with WorkoutX (or switch library)
2. Prefer Blob/R2 with `license`, `source`, `retrieved_at`, `sha256` metadata
3. Keep proxy as fallback for uncached ids

## Earlier v1 recommendation (still valid for prod licensing)

Permanent rehosting without written rights is a compliance risk. Testing cache is an explicit, temporary exception owned by the product decision to finish Play closed testing first.
