# Cadence — Owner Action Items

Agent continuity: **`docs/AGENT_HANDOFF.md`**. Everything below is owner/ops work before full production launch.

---

## 1. Environment Variables

Add to `.env.local` for dev, and to Vercel Environment Variables for production.

### Generate locally
```bash
# SESSION_SECRET — run this and paste the output
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Full variable list

| Variable | Purpose | How to get it |
|---|---|---|
| `SESSION_SECRET` | Signs session cookies — required in production | Generate with command above |
| `ADMIN_SECRET` | Protects `/api/admin/*` endpoints | Any strong random string you choose |
| `MSG91_AUTH_KEY` | MSG91 SMS API authentication | control.msg91.com → API → Auth Keys |
| `MSG91_TEMPLATE_ID` | DLT-approved OTP SMS template ID | MSG91 dashboard → DLT (see template body below) |
| `MSG91_INVITE_TEMPLATE_ID` | DLT-approved invite SMS template ID | MSG91 dashboard → DLT (see template body below) |
| `NEXT_PUBLIC_APP_URL` | Live app URL, used in invitation SMS links | Your Vercel deployment URL e.g. `https://your-app.vercel.app` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for session photo uploads | Vercel dashboard → your project → Storage → Blob → Create store → copy token |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error reporting (browser) | sentry.io → your project → Settings → Client Keys |
| `SENTRY_DSN` | Sentry error reporting (server) | Same DSN as above |
| `SENTRY_ORG` | Sentry organisation slug | Your Sentry org slug |
| `SENTRY_PROJECT` | Sentry project name | e.g. `trainer-app` |
| `SENTRY_AUTH_TOKEN` | Source map uploads on build (optional) | sentry.io → Settings → Auth Tokens |

---

## 2. MSG91 DLT Templates

Register both templates under the Transactional category in MSG91's DLT portal.
Once approved, copy the Template ID into your env vars.

**OTP template** → `MSG91_TEMPLATE_ID`
```
Your OTP for Cadence login is ##OTP##. Valid for 10 minutes. Do not share this code.
```

**Invite template** → `MSG91_INVITE_TEMPLATE_ID`
```
Hi ##client_name##, ##trainer_name## has invited you to Cadence. Join here: ##invite_link##
```

---

## 3. Database Migrations

Run once against your Neon database. Paste file contents into the Neon SQL editor and execute.

| File | What it creates |
|---|---|
| `db/migrations/001_client_messages.sql` | `client_messages` table for two-way messaging |
| `db/migrations/002_invitations.sql` | `invitations` table for client invitation flow |
| `db/migrations/003_exercise_search_index.sql` | GIN trigram index on `master_exercises.name` for fast search |
| `db/migrations/004_referrals.sql` | `referral_code` + `referred_by` columns on `trainer_phones`; back-fills existing rows |

---

## 4. PWA Icons

The `public/manifest.json` references two icon files that must be created before the PWA install prompt works:

| File | Size | Purpose |
|---|---|---|
| `public/icon-192.png` | 192×192 px | Android home screen icon |
| `public/icon-512.png` | 512×512 px | Splash screen + maskable icon |

Use a square logo or app icon — the background should be `#0f1117` (dark) or transparent. Export as PNG and drop into the `public/` folder.

---

## 5. Sentry Setup

1. Create a project at sentry.io (platform: **Next.js**)
2. Copy the DSN into `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`
3. Optionally add `SENTRY_AUTH_TOKEN` to Vercel for source map uploads (gives readable stack traces in production)

---

## Critical Path

None of the above blocks ongoing development. Dev fallbacks are in place for everything:
- Missing `SESSION_SECRET` → uses a dev fallback string (warns in console)
- Missing `ADMIN_SECRET` → allows through in non-production environments
- Missing MSG91 keys → OTP and invite links are logged to server console instead of sent via SMS
- Migrations not run → messaging and invitation endpoints error, all other features unaffected

These become critical only before going live with real users.
