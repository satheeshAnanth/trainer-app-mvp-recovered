# Play Console Data Safety — TrainerApp

Use these answers in **Play Console → App content → Data safety**.

Privacy policy URL (required):

```
https://trainer-app-mvp-recovered.vercel.app/privacy
```

Terms URL (optional but recommended):

```
https://trainer-app-mvp-recovered.vercel.app/terms
```

---

## Overview questions

| Question | Answer |
|----------|--------|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (email request to getsatxray@gmail.com; documented in Privacy Policy) |
| Do you provide a privacy policy? | **Yes** |

---

## Data collected

Mark **Collected = Yes**, **Shared = No** unless noted. Purpose tags below are the Play Console labels.

### Personal info

| Data type | Collected | Shared | Purpose | Ephemeral? | Required / Optional |
|-----------|-----------|--------|---------|------------|---------------------|
| Name | Yes | No (only within trainer–client relationship inside app) | App functionality | No | Optional / as provided |
| Phone number | Yes | No (OTP provider processes delivery) | App functionality, Account management | No | Required |
| User IDs | Yes (internal account / trainer / client ids) | No | App functionality, Account management | No | Required |

> If Play forces a binary Shared answer for OTP SMS: treat phone number as **shared with service providers** for account management / app functionality, and disclose SMS / auth provider as a processor. Prefer: collected for login; not sold; not used for advertising.

### Health and fitness

| Data type | Collected | Shared | Purpose | Notes |
|-----------|-----------|--------|---------|-------|
| Fitness info | Yes | No (trainer↔client only inside product) | App functionality | Session logs, goals, effort, progress |
| Health info | Yes (if entered in profile / notes) | No | App functionality | Only what users type; not medical device data |

### Financial info

| Data type | Collected | Shared | Purpose | Notes |
|-----------|-----------|--------|---------|-------|
| Other financial info / purchase history | Yes (optional payment tracking notes) | No | App functionality | Record-keeping only; **no Play Billing / no card processing** |
| Credit card / bank account | No | — | — | |

### Messages

| Data type | Collected | Shared | Purpose | Notes |
|-----------|-----------|--------|---------|-------|
| Other in-app messages | Yes | No | App functionality | Session notes / feedback between trainer and client |

### App activity / device

| Data type | Collected | Shared | Purpose | Notes |
|-----------|-----------|--------|---------|-------|
| App interactions | Approximate / diagnostics only if logged server-side | No | Analytics (optional) / App functionality | Keep minimal |
| Device or other IDs | Yes (push token if enabled) | Shared with push provider only if notifications enabled | App functionality | Optional |

### Photos / files / location / contacts / web browsing

| Data type | Answer |
|-----------|--------|
| Photos and videos | No (unless a future media upload feature ships — update this form then) |
| Precise / approximate location | No |
| Contacts | No |
| Web browsing | No |

---

## Data handling declarations

| Declaration | Answer |
|-------------|--------|
| Data is encrypted in transit | Yes |
| Users can request deletion | Yes |
| Data used for ads / remarketing | **No** |
| Data used for fraud prevention / security | Yes (auth, abuse prevention) |
| Data used for personalization / advertising ID | **No** |
| Independent security review | No (unless you commission one later) |

---

## Sensitive permissions note

Current Android permissions should stay minimal. If Play asks about SMS, Phone, or Contacts: TrainerApp does **not** need those for OTP if OTP is entered manually after SMS delivery by your provider.

Update this file whenever you add camera upload, GPS check-in, or payment processing.
