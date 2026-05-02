# UI/UX Agent Stack for the Trainer App

This repo is mature enough that the next leverage comes from better design-to-code and UI verification workflows, not from adding more product surface area.

The goal of this stack is simple:

- keep design intent visible to the implementation agent
- speed up UI exploration before code is written
- verify real user flows in the running app
- catch visual regressions before they ship

## Recommended stack

1. Figma-Context-MCP
   - Best for: design-to-code sync
   - Use it when: a Figma file or layout spec exists and the implementation needs to match it closely
   - Repo value: reduces drift between design and the Next.js UI

2. browser-use
   - Best for: flow automation in the live app
   - Use it when: you want to test login, onboarding, schedule flows, payments, or other multi-step journeys
   - Repo value: good fit for smoke tests and realistic end-to-end validation

3. Midscene
   - Best for: screenshot/vision-based UI checks
   - Use it when: selectors are brittle or you want a visual comparison against expected layouts
   - Repo value: useful for quick visual QA of portal pages and session flows

4. superdesign
   - Best for: rapid UI exploration and scaffolding
   - Use it when: you want multiple layout ideas or component variants before implementation
   - Repo value: good for polishing new portal pages without slowing the core build

5. page-eyes-agent
   - Best for: quick visual inspection during local development
   - Use it when: you need lightweight feedback on spacing, hierarchy, or obvious UI issues
   - Repo value: a fast debugging companion for the running app

## Optional later additions

- UI-TARS-desktop
  - Add if we want deeper multimodal desktop/UI automation beyond browser-only flows.

- nanobrowser
  - Add if we want a browser extension workflow for ad hoc agent-driven research and multi-agent browsing.

## Rollout order

Phase 1: design handoff
- Introduce Figma-Context-MCP first.
- Make sure agent instructions point to the relevant design source and component conventions.

Phase 2: live UI validation
- Add browser-use next for repeatable app flow checks.
- Focus first on login, onboarding, client portal, schedule, and payments.

Phase 3: visual QA
- Add Midscene and page-eyes-agent for screenshot-level inspection.
- Use them when a bug is visual, not just logical.

Phase 4: UI acceleration
- Add superdesign for design exploration and fast component scaffolding.
- Use it to generate ideas, not to replace repo conventions.

## Practical guidance

- Treat these as developer tools, not app dependencies.
- Keep the integration lightweight until there is a real need for automation hooks.
- Prefer docs and workflow guidance first; add code/config only when a tool is actually being used regularly.
- For this repo, the highest ROI is: Figma-Context-MCP + browser-use + Midscene.

## Files to keep in sync

- `docs/DEVELOPER_GUIDE.md`
- `docs/AGENT_HANDOFF.md`
- `docs/WORKLOG.md`
- this file

If we later wire these into CI or local scripts, add the tool-specific config in the smallest possible place and keep the usage notes here up to date.
