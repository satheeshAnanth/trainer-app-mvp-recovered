# Agent Handoff (2026-05-01)

This file is the continuity handoff for any new agent picking up work in this repo.
Use this together with `docs/BUILD_CONTEXT.md` and `docs/WORKLOG.md`.

## Current Product State
- App is a recovered trainer-client coaching platform (Next.js App Router) with Neon Postgres backing.
- Primary trainer workflows are active: login/onboarding, clients, goal templates, session draft/final flow, tips, schedule, profile.
- Client workflows are active: login (through common `/login`), portal visibility, session/tip surfaces.

## Non-Negotiable UX Contracts
- Single common login path: `/login` (no separate `/client-login` flow).
- Phone-first entry: detect role from phone; unknown client must be told to contact trainer.
- Trainer onboarding:
  - receives phone from login query param,
  - phone field is locked during onboarding.
- Goal exercise naming:
  - locked during session capture,
  - editable only from client goal-template screen.
- Session tabs:
  - `Draft` = capture/edit stage,
  - `Final` = summary + publish + payment + discussion + lock stage.
- Session draft safety:
  - explicit Save Draft button exists in Draft tab.
- Finalization sequence:
  - trainer can publish details to client before lock,
  - discussion remains active while payment request/confirmation occurs,
  - lock requires payment received confirmation + final trainer comment.

## Session Flow Implementation Notes
- `app/sessions/new/page.js` is the main orchestration surface.
- Session Rail has been removed.
- Goal + additional exercise summaries remain in Final tab.
- Workout Assessment is included in Final tab with re-run action.
  - assessment data is persisted into session payload.
- Added endpoint: `POST /api/sessions/assessment`
  - deterministic rule-based output always available,
  - optional LLM path (if `OPENAI_API_KEY` is present),
  - fallback to rule-based output on any LLM failure.

## Metrics and Data Capture Rules
- No default set row is auto-created when entering an exercise.
- Trainer explicitly adds first set.
- Duplicate set concept removed:
  - structural `Set 1/Set 2...` remains,
  - `Sets` metric key input is hidden in per-set editor.
- Metric helper descriptions are shown in session capture/edit screens.
- Dropdown-first metric capture is enabled for most metrics, including bounded numeric lists.
- One-time DB enrichment done:
  - `master_exercise_metrics.source_payload_json.description` updated for all known metric keys.

## Search and Mapping Behavior
- Master exercise search expanded for higher limits.
- API normalizes names (trim/prefix cleanup) and deduplicates results.
- Search modal is full-screen and reliable on repeat open.

## Reliability Fixes Already Applied
- Tips send flow fixed for live `audit_events` schema (actor metadata moved to payload JSON).
- Client add flow normalized to live `clients_activity_level_check` values.
- Add-client modal now surfaces 409/validation errors inline for retry clarity.
- Goal template save flow hardened:
  - ignores untouched empty rows,
  - shows full-screen success confirmation.

## Known Operational Notes
- Local Next dev may occasionally show stale chunk errors (`Cannot find module './xxxx.js'`) after rapid edits.
  - Recovery: stop dev server, remove `.next`, restart `next dev`.
- Build currently passes at latest state.

## Repo/Branch Snapshot
- Branch: `main`
- Latest push before this handoff: `609240b`
- Untracked local folder intentionally excluded from git: `tmp-whisper/`

## UI/UX Agent Stack to Use Next

If the next workstream is about developer productivity rather than product features, use this order:

1. `Figma-Context-MCP`
   - first choice for design-to-code sync and layout fidelity
2. `browser-use`
   - first choice for end-to-end flow automation in the live app
3. `Midscene`
   - best for screenshot-based visual QA and layout regression checks
4. `superdesign`
   - best for fast UI exploration and scaffolding before implementation
5. `page-eyes-agent`
   - best for quick visual inspection during local dev

Optional later additions:

- `UI-TARS-desktop` for deeper multimodal desktop/UI automation
- `nanobrowser` for ad hoc browser-side research workflows

Recommended adoption rule:

- Use these as developer workflow tools, not as runtime app dependencies.
- Start with docs + workflow guidance, then add scripts/config only when a tool becomes part of the regular process.
- Keep verification grounded in the running app and clear tool output, not model prose.

## Immediate Next-Session Checklist
1. Pull latest `main`.
2. Run `npm install` (if needed) and `npm run build`.
3. Smoke test:
   - login role routing,
   - onboarding locked phone behavior,
   - add client,
   - goal-template save + load into new session,
   - draft save,
   - publish to client,
   - request payment,
   - discussion reply visibility,
   - lock notes with payment confirmation + final comment.
4. If releasing, run production deploy and verify critical routes post-deploy.
