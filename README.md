# Trainer App MVP

Recovered Next.js 14 App Router project for trainer/client coaching workflows.

If you want the fast path, read this file first, then `docs/AGENT_HANDOFF.md` and `docs/BUILD_CONTEXT.md`.

## Quick start

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm run build
npm run start
npm run lint
```

Environment:

```bash
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

When `DATABASE_URL` is missing, the app falls back to empty-query / mock behavior in `app/lib/db.js` and `app/lib/mockData.js`.

## Tight architecture review

This app is a single Next.js App Router codebase with two user surfaces:

- trainer portal: `/portal`, `/clients`, `/sessions`, `/schedule`, `/profile` (includes insights)
- client portal: `/my-portal/**`
- support/internal surface: `/audit` (kept out of trainer primary navigation)

Core architectural choices:

- Auth and access control are centralized in `middleware.js`.
  - trainer routes require `trainer_session`
  - client routes require `client_session`
  - unauthenticated users are redirected to `/login?next=...`
- The home route just redirects to `/login`.
- The app is route-first: page UI and API handlers live close to each other under `app/` and `app/api/`.
- Data access is intentionally tolerant of missing DB config.
  - `app/lib/db.js` returns `[]` instead of throwing when `DATABASE_URL` is absent.
  - several flows can render from mock data so the app still boots locally.
- The UI is split into two shells:
  - `app/_components/TrainerShell.js`
  - `app/_components/ClientShell.js`
  Both own the top header, desktop nav, and mobile tab bar.
- Session and client workflows are the highest-risk areas because they mix UI state, auth state, and DB-backed persistence.

What to be careful with:

- Do not break the login contract or cookie names; a lot of routes depend on them.
- Update the matching page and API route together when changing a workflow.
- Treat draft/final session behavior as a product contract, not just UI.
- Assume some routes must work in both live-DB and mock/offline mode.

## Repo map

Important files:

- `app/` — route tree, page UI, and API handlers
- `app/lib/db.js` — Postgres helper and DB fallback behavior
- `middleware.js` — route guards
- `docs/DEVELOPER_GUIDE.md` — longer developer guide
- `docs/AGENT_HANDOFF.md` — continuity rules and product contracts
- `docs/BUILD_CONTEXT.md` — recovery context and schema notes
- `docs/WORKLOG.md` — session-by-session progress log

## Recommended development flow

1. Read the page and its matching API route.
2. Check whether the path is trainer-facing, client-facing, or shared.
3. Verify DB vs mock behavior before changing logic.
4. Make the smallest possible change.
5. Run a smoke test or `npm run build` for broader changes.

## Notes for the next developer

- The detailed operating guide lives in `docs/DEVELOPER_GUIDE.md`.
- The continuity contract lives in `docs/AGENT_HANDOFF.md`.
- If you change an important workflow, add a short note to `docs/WORKLOG.md`.
