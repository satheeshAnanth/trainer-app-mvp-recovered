# Play Store automation

Scripts that talk to the **Google Play Android Developer API** so Cursor (or CI) can upload AABs and sync listing assets without clicking through Console.

## What is automated

| Command | Does |
|---------|------|
| `npm run play:check` | Validates service account + assets; probes API auth |
| `npm run play:build` | `./gradlew bundleRelease` (signed AAB) |
| `npm run play:upload` | Upload AAB to a track (default: `internal`) |
| `npm run play:listing` | Sync title/descriptions + feature graphic / icon / screenshots |
| `npm run play:status` | Read current tracks / bundles / listings |
| `npm run play:ship` | check → optional build → upload → listing → status |

## What stays manual in Play Console

These still need Console (or one-time human setup):

- Create the app / accept Play policies
- **Privacy policy URL** field (use `https://trainer-app-mvp-recovered.vercel.app/privacy`)
- **Data safety** form (`docs/play-store/DATA_SAFETY.md`)
- **Content rating** / IARC questionnaire
- Target audience, ads declaration, countries
- Promoting Internal → Closed → Production if you prefer the UI
- First-time service account invite (below)

## One-time setup (you)

### 1. Enable API + service account

1. [Google Cloud Console](https://console.cloud.google.com) → project (e.g. `trainerapp-3b73b`)
2. Enable **Google Play Android Developer API**
3. **IAM → Service accounts → Create** `play-store-upload`
4. **Keys → Add key → JSON** → download

### 2. Invite in Play Console

1. [Users and permissions](https://play.google.com/console/u/0/developers/users-and-permissions)
2. Invite the service account email
3. App permissions for **TrainerApp** (`in.trainer.fitness`):
   - View app information
   - Manage store presence (for listing sync)
   - Manage testing tracks…
   - Release apps to testing tracks
   - (Optional) Release to production

Wait 5–15 minutes after inviting.

### 3. Drop the key locally (never commit)

```bash
mkdir -p .secrets
mv ~/Downloads/your-key.json .secrets/play-store-service-account.json
```

`.secrets/` is gitignored.

### 4. Install + verify

```bash
npm install
npm run play:check
```

## Everyday usage

```bash
# Dry run (no API writes except check's auth probe unless --dry-run on check via ship)
npm run play:ship -- --dry-run

# Build + upload to Internal testing + sync listing
npm run play:ship -- --build

# Upload existing AAB only
npm run play:upload -- --track internal

# Listing text/images only
npm run play:listing

# Production track (requires SA permission)
npm run play:upload -- --track production --status completed
```

### Env overrides

| Variable | Purpose |
|----------|---------|
| `PLAY_STORE_SERVICE_ACCOUNT_JSON` | Inline JSON (CI) |
| `PLAY_STORE_SERVICE_ACCOUNT_FILE` | Path to JSON key |
| `PLAY_PACKAGE_NAME` | Default `in.trainer.fitness` |
| `PLAY_TRACK` | `internal` / `alpha` / `beta` / `production` |
| `PLAY_RELEASE_STATUS` | `completed` / `draft` / `inProgress` |
| `PLAY_AAB_PATH` | Override AAB path |

## GitHub Actions

Example workflow (copy into place):

```bash
mkdir -p .github/workflows
cp docs/play-store/play-internal.yml.example .github/workflows/play-internal.yml
git add .github/workflows/play-internal.yml
git commit -m "ci: add Play internal upload workflow"
git push
```

If `git push` rejects the workflow file, use a Personal Access Token with the **`workflow`** scope (or push from the GitHub UI).

Required repo secrets:

| Secret | Notes |
|--------|-------|
| `PLAY_STORE_SERVICE_ACCOUNT_JSON` | Full SA JSON |
| `ANDROID_KEYSTORE_BASE64` | `base64 -i trainerapp-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `trainerapp` |
| `ANDROID_KEY_PASSWORD` | key password |

Trigger: **Actions → Play Internal Upload → Run workflow**.

## Asset inputs

| Path | Used by |
|------|---------|
| `store-assets/listing/en-US.json` | Listing text + contact |
| `store-assets/feature-graphic.png` | Feature graphic |
| `store-assets/icon-512.png` (optional) | Hi-res icon |
| `store-assets/screenshots/*.png` | Phone screenshots (≥2 for production) |
| `android/.../app-release.aab` | Upload |

## After first successful `play:ship`

1. Open Play Console → Internal testing → confirm release
2. Complete Data safety + Content rating if still incomplete
3. Add ≥2 screenshots if listing sync skipped them
4. Promote when ready
