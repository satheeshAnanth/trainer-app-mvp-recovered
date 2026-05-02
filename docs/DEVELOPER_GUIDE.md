# Trainer App Developer Guide

This guide is the starting point for continuing development on the recovered `trainer-app-mvp` repo.

## What this app is

`trainer-app-mvp` is a Next.js 14 App Router application for trainer/client coaching workflows:

- trainer onboarding and login
- client management
- session capture and review
- schedule management
- trainer profile settings
- client portal surfaces for sessions, tips, schedule, and self-log

The app is designed to work with Neon Postgres when `DATABASE_URL` is present, but many flows include mock fallbacks so the app can still run locally without a database.

## Tech stack

- Next.js `14.2.35`
- React `18.2.0`
- React DOM `18.2.0`
- `pg` for Postgres access
- App Router structure under `app/`

## Project layout

Common top-level files and folders:

- `app/` — application routes, API routes, shared libs, and UI components
- `middleware.js` — route protection for trainer and client areas
- `docs/` — recovery and continuity docs
- `package.json` — scripts and dependencies
- `next.config.js` — Next.js config

Important docs already in the repo:

- `docs/AGENT_HANDOFF.md`
- `docs/BUILD_CONTEXT.md`
- `docs/WORKLOG.md`
- `docs/DESIGN_REVIEW.md`

## How to run it

From the repo root:

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

## Environment setup

The repo currently expects a Neon-style Postgres connection string when DB-backed features are enabled.

Required for live DB behavior:

```bash
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

The example file is:

- `.env.example`

If `DATABASE_URL` is missing:

- `app/lib/db.js` returns empty query results instead of throwing
- some flows fall back to mock data in `app/lib/mockData.js`

## Authentication and route protection

Route protection is handled in `middleware.js`.

Trainer-protected paths:

- `/portal`
- `/clients`
- `/schedule`
- `/profile`
- `/sessions`

Client-protected paths:

- `/my-portal`

Cookie names used by middleware:

- `trainer_session`
- `client_session`

If a user is unauthenticated, middleware redirects them to `/login` with a `next=` return path.

## Entry routes

Main entrypoint:

- `/` → redirects to `/login`

Auth and onboarding:

- `/login`
- `/onboard/trainer`
- `/client-onboard`

Trainer surfaces:

- `/portal`
- `/clients`
- `/clients/[id]`
- `/clients/[id]/goal-template`
- `/clients/[id]/tips`
- `/sessions/new`
- `/sessions/[id]`
- `/sessions/pending-notes`
- `/schedule`
- `/profile`

Client surfaces:

- `/my-portal`
- `/my-portal/profile`
- `/my-portal/schedule`
- `/my-portal/self-log`
- `/my-portal/tips`

## API surface

The app has a fairly large API surface under `app/api/`. The most important groups are:

Auth:

- `/api/auth/*` for trainer auth and session state
- `/api/client-auth/*` for client OTP/session flows

Core domain:

- `/api/clients/*`
- `/api/sessions/*`
- `/api/schedule/*`
- `/api/client/*`

Utility / admin / health:

- `/api/admin/*`
- `/api/runtime`
- `/api/bootstrap`
- `/api/audit`

Exercise / session helpers:

- `/api/exercises/master/search`
- `/api/exercises/feedback`
- `/api/exercises/learned`
- `/api/sessions/assessment`

If you are changing behavior in one of these areas, check the corresponding page and route handler together.

## Data access notes

The DB helper is in:

- `app/lib/db.js`

Key behavior:

- `hasDatabaseUrl()` checks for `DATABASE_URL`
- `query()` returns `[]` when no database is configured
- table helpers sanitize identifiers before using them in SQL

Practical implication:

- UI and API handlers often need to support both live DB and mock/offline modes
- do not assume a DB query will always return rows

## Recovery conventions already in place

A few repo conventions matter when continuing development:

- keep `/login` as the single common login path
- trainer onboarding receives the phone number from login and locks the phone field
- goal exercise names are locked during session capture and editable from the goal-template screen
- session workflow is split into Draft and Final stages
- draft save should be explicit and safe
- finalization requires payment confirmation and final trainer comments before locking

These contracts are documented more fully in `docs/AGENT_HANDOFF.md` and `docs/BUILD_CONTEXT.md`.

## Recommended workflow for new changes

1. Read the matching route/page/API handler pair.
2. Check whether the code path must support both DB and mock modes.
3. Make the smallest change that preserves the existing recovery contracts.
4. Run the relevant local smoke test.
5. Run a full build before handing off larger changes.

## Development operating model

This repo should be developed with a split between orchestration and implementation:

- Hermes handles architecture, sequencing, design decisions, and repo-level coordination.
- Cursor Agent handles implementation/coding work when a task is mainly file edits, route changes, refactors, or other mechanical changes.
- Hermes should keep the repo documentation current so Cursor has enough context to complete changes safely.
- Before handing work to Cursor, make sure the relevant docs explain the current contracts, file paths, and any special constraints.
- After Cursor completes implementation, verify the result locally before treating the work as done.

## Recommended tool / skill stack

For this repo, the most useful pieces are:

- `dogfood` — best fit for browser-based UI/UX audit, exploratory QA, screenshots, console checks, and reproduction evidence.
- `claude-design` — best when you need to explore or shape a UI before coding it.
- `popular-web-designs` — best when you want to borrow a proven design language such as Linear, Stripe, Vercel, Notion, etc.
- `sketch` — best for 2-3 disposable UI variants before committing to one direction.
- `recovered-project-handoff` — best for maintaining the repo's continuation docs and developer guide.
- `subagent-driven-development` — best for breaking implementation work into delegated tasks with review loops.
- `requesting-code-review` — best for pre-commit verification and quality gating.
- `systematic-debugging` — best when a bug or regression needs root-cause analysis before fixing.
- `Cursor Agent` — best for the actual implementation work once the design/plan is settled.

For UI/UX agent tooling specifically, the recommended external stack is documented in `docs/UIUX_AGENT_STACK.md`.

For Hermes model routing, the recommended profile map is documented in `docs/HERMES_MODEL_ROUTING.md`.

Current recommended order for this repo:

- `Figma-Context-MCP` — design-to-code sync
- `browser-use` — live app flow automation
- `Midscene` — visual/screenshot-based QA
- `superdesign` — UI exploration and scaffolding
- `page-eyes-agent` — fast visual inspection during development

Practical routing rule:

- Use Hermes for analysis, sequencing, and decision-making.
- Use `dogfood` for UI/UX audits of the live app.
- Use `claude-design` / `popular-web-designs` / `sketch` for design exploration and recommendations.
- Use the UI/UX agent stack in `docs/UIUX_AGENT_STACK.md` for design handoff, browser automation, and visual QA.
- Use Cursor Agent for the actual code changes.
- Use `requesting-code-review` before commit/push.
- Use `recovered-project-handoff` whenever the docs need to be refreshed for the next developer.

Suggested verification steps:

```bash
npm run build
```

If you are touching authentication or middleware, also verify:

- trainer login and redirect behavior
- client login and redirect behavior
- protected route access without cookies

If you are touching session capture, also verify:

- draft save
- final save / complete
- assessment and note flows
- client publish / share behavior

## Troubleshooting

If the dev server gets into a weird stale state after rapid edits, a known recovery is:

```bash
rm -rf .next
npm run dev
```

If auth or DB behavior seems inconsistent, confirm:

- `DATABASE_URL` is set correctly
- the session cookie is being written
- the route is actually covered by middleware

## Where to continue next

The best starting points for future work are:

- `docs/AGENT_HANDOFF.md`
- `docs/BUILD_CONTEXT.md`
- `docs/WORKLOG.md`
- `app/sessions/new/page.js`
- `app/sessions/[id]/page.js`
- `app/clients/[id]/goal-template/page.js`
- `app/login/page.js`
- `middleware.js`

This document is intentionally concise so it can serve as the first read for a developer continuing the recovery work.
