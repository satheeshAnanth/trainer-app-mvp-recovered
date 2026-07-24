# Play Console — paste pack (manual fields API cannot fully set)

Use with the files in this folder / MacBook `TrainerApp/Playstore`.

## 1. Privacy policy & terms (Store settings / App content)

| Field | Value |
|-------|--------|
| Privacy policy URL | `https://trainer-app-mvp-recovered.vercel.app/privacy` |
| Terms (optional) | `https://trainer-app-mvp-recovered.vercel.app/terms` |
| Support email | `getsatxray@gmail.com` |

## 2. Data safety — summary answers

Full detail: `docs/DATA_SAFETY.md` (also in Playstore/docs on Mac).

- Collects user data: **Yes**
- Encrypted in transit: **Yes**
- Users can request deletion: **Yes** (email getsatxray@gmail.com)
- Sold / ads / remarketing: **No**
- Collect: name (optional), phone (required for OTP), fitness/session logs, optional payment *notes*, in-app session notes, optional push token
- Not collecting: precise location, contacts, photos (unless you add later), credit cards

## 3. Content rating (IARC)

| Question | Answer |
|----------|--------|
| Violence | No |
| Sexual content | No |
| Language | No |
| Controlled substances | No |
| User-generated content | Yes (trainer/client notes) |
| Personal / sensitive info | Yes (phone for OTP) |
| Financial transactions / IAP | No (tracking only) |

Expected: Everyone / Everyone 3+. Target audience tip: 18+.

## 4. Graphics checklist

| Asset | File | Status |
|-------|------|--------|
| Feature graphic 1024×500 | `feature-graphic.png` | Ready |
| Hi-res icon 512×512 | `icon-512.png` | Ready (export from brand icon) |
| Phone screenshots ≥2 | `screenshots/` | **You capture on device** |

## 5. Release

- Latest build: **Cadence 1.3.0 (versionCode 6)** — AAB in `Playstore/release/`
- Prior: 1.2.2 (5), 1.2.1 (4) on internal/closed tracks
- Promote when listing + Data safety + rating + screenshots complete

## 6. App access for reviewers

All functionality available without special access — reviewer can sign up as trainer via OTP.
