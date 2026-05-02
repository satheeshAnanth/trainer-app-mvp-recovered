# Client Showcase Portal Implementation Plan

> For Hermes: use subagent-driven-development to implement this plan task-by-task.

**Goal:** Build a polished client-facing experience that shows the product clearly to a client: a strong home dashboard, structured workout capture for trainer review, goal progress and charting, payment requests, and schedule requests.

**Architecture:** Keep the implementation inside the existing recovered Next.js 14 App Router app. Reuse the current client portal shell, schedule model, session review flow, and payment/request endpoints where possible. Add a few focused shared helpers for client dashboard aggregation so the pages stay thin and the UI stays consistent. Prefer simple in-app charts/SVG and mirrored trainer/client state over introducing new services or heavy dependencies.

**Tech Stack:** Next.js 14 App Router, React client components, existing `app/_components/*` shells, existing session/schedule/payment APIs, local helper modules in `app/lib/`, CSS utilities already in the app, browser notifications for reminders.

---

## Product shape

This is the client-facing story we want to show a real client:

1. Home dashboard that answers:
   - What do I need to do today?
   - What is waiting on my trainer?
   - How am I progressing toward my goal?
   - Do I owe anything?
   - What is my next scheduled session?
2. Structured workout capture for self-logged sessions:
   - exercise-by-exercise capture
   - set-level or structured metric capture
   - pain/discomfort notes
   - submit for trainer review
3. Goal progress view:
   - current goal summary
   - recent trend cards
   - lightweight charting for progress over time
4. Payments view:
   - outstanding payment requests
   - paid / pending status
   - simple request history
5. Schedule view:
   - create / confirm / reschedule / cancel requests
   - mirrored state with trainer portal
   - optional reminders

The client should feel that the app is a real coaching product, not just a set of forms.

---

## Current codebase starting point

Already present and reusable:

- `app/my-portal/page.js` — basic client home with weekly summary and goal-plan list
- `app/my-portal/self-log/page.js` — client workout submission form
- `app/my-portal/schedule/page.js` — mirrored schedule UI
- `app/my-portal/tips/page.js` — client feedback/tips view
- `app/my-portal/profile/page.js` — client profile
- `app/api/client/sessions/route.js` — client session list/create
- `app/api/client-auth/session/route.js` — client identity session
- `app/api/sessions/[id]/payment/route.js` — session payment request endpoint
- `app/api/schedule/events/*` — schedule request/confirmation flow
- `app/lib/mockData.js` — recovery fallback data
- `app/lib/schedule.js` — shared schedule helper module

This means the work is mostly product shaping, aggregation, and UI polish rather than a ground-up rewrite.

---

## Implementation phases

### Phase 1: Make the client home page a true showcase dashboard

**Objective:** Turn `/my-portal` into a polished “client home” that summarizes the whole coaching relationship.

**Files:**
- Modify: `app/my-portal/page.js`
- Add if needed: `app/lib/clientDashboard.js`
- Reuse: `app/api/client/sessions/route.js`, `app/api/schedule/events/route.js`, `app/api/client-auth/session/route.js`

**What it should show:**
- welcome header with client name
- next session card
- pending trainer feedback card
- goal progress card
- payment due card
- schedule request status card
- recent activity feed

**Implementation notes:**
- Derive dashboard data from existing APIs first.
- If the API payloads are too raw, create small helper functions in `app/lib/clientDashboard.js` to normalize them.
- Keep the page readable: dashboard cards, not a dense wall of tables.
- Use empty states deliberately so the product still looks good with sparse data.

**Success criteria:**
- A client can open `/my-portal` and immediately understand what is happening in their coaching journey.

---

### Phase 2: Upgrade self workout capture into structured review-ready logging

**Objective:** Make `/my-portal/self-log` feel like a real workout submission flow, not just a text form.

**Files:**
- Modify: `app/my-portal/self-log/page.js`
- Potentially modify: `app/api/client/sessions/route.js`
- Potentially modify: `app/lib/payloadMerge.js`, `app/lib/sessionValidation.js`

**What it should show:**
- workout title and date
- guided exercise blocks or structured sections
- per-exercise notes and set details
- pain/discomfort field
- short “what went well / what felt hard” summary
- submit for trainer review

**Implementation notes:**
- Reuse the existing session payload format instead of inventing a new one.
- If current self-log is too minimal, expand it into a guided capture form with visible sections and clearer language.
- Keep the data model aligned with trainer review so the trainer can approve or comment on the same structure.

**Success criteria:**
- A client can record a workout in a structured way that the trainer can meaningfully review.

---

### Phase 3: Add progress toward goal with simple charting

**Objective:** Show progress clearly without overbuilding analytics.

**Files:**
- Modify: `app/my-portal/page.js`
- Modify or add: `app/my-portal/progress/page.js` if a dedicated page is warranted
- Add if needed: `app/lib/progress.js`
- Reuse: `app/api/client/sessions/route.js`, `app/api/clients/[id]/goal-template/route.js`

**What it should show:**
- current goal name and status
- goal exercise checklist
- recent completion trend
- line chart or bar chart for a few core measures
- streak / adherence summary

**Implementation notes:**
- Start with a very small chart component built in React/SVG; no chart library unless absolutely necessary.
- Charts can be based on normalized values already present in session payloads.
- Keep the chart simple: 7-day trend, session count trend, or goal completion ratio.
- If richer metrics are needed later, introduce one small aggregation helper rather than scattering calculations across pages.

**Success criteria:**
- The client can visually see improvement over time without reading raw logs.

---

### Phase 4: Expose payment requests in a client-friendly way

**Objective:** Make outstanding payments visible and actionable.

**Files:**
- Modify: `app/my-portal/page.js`
- Add if needed: `app/my-portal/payments/page.js`
- Add if needed: `app/api/client/payments/route.js`
- Reuse: `app/api/sessions/[id]/payment/route.js`

**What it should show:**
- pending payment requests
- paid / awaiting payment state
- amount, note, and context
- link back to the related session where applicable

**Implementation notes:**
- If no dedicated client payment feed exists, derive it from session payment records first.
- Keep the UI simple: one list, clear statuses, no finance complexity.
- If a dedicated route is needed, make it read-only first.

**Success criteria:**
- The client can see what they owe and why, without asking the trainer.

---

### Phase 5: Make schedule requests feel like a calendar, not a chat

**Objective:** Keep the already-reworked schedule flow polished and obvious.

**Files:**
- Modify: `app/my-portal/schedule/page.js`
- Modify: `app/schedule/page.js`
- Modify: `app/lib/schedule.js`
- Reuse: `app/api/schedule/events/*`

**What it should show:**
- pending confirmation banners
- reschedule action
- reminder windows (24h and 1h)
- next reminder summary text
- mirrored trainer/client state

**Implementation notes:**
- No long messages or threaded conversation.
- Keep the note field single-use and context-only.
- Use browser notifications as optional reminders, with local dedupe.

**Success criteria:**
- Schedule state is easy to understand from either side.

---

### Phase 6: Client-facing polish and presentation layer

**Objective:** Make the whole thing client-demo friendly.

**Files:**
- Modify: `app/_components/ClientShell` if needed
- Modify: `app/my-portal/page.js`, `app/my-portal/self-log/page.js`, `app/my-portal/schedule/page.js`
- Potentially modify: `app/globals.css`

**What it should improve:**
- consistent card spacing
- clearer headings and helper copy
- stronger empty states
- better mobile layout
- subtle status chips and highlight colors

**Success criteria:**
- A client demo feels cohesive, intentional, and premium.

---

## Suggested build order

1. Home dashboard
2. Structured self-log
3. Goal progress and charting
4. Payments view
5. Schedule polish
6. Visual cleanup

This order is intentional: it shows value early, then deepens the product.

---

## Definition of done

The client showcase is ready when:

- `/my-portal` feels like a complete dashboard
- self workout logging is structured and reviewable
- goal progress is visible at a glance with at least one chart
- payment requests are visible and understandable
- schedule requests are mirrored and feel calendar-like
- the app still builds cleanly in production
- no new external service is required for the core demo

---

## Recommended execution approach

Use a fresh subagent per phase with:
- one implementer
- one spec reviewer
- one quality reviewer

Keep each phase small enough that it can be validated independently.

---

## Open questions before implementation

1. Should the client showcase be the existing `/my-portal` route, or should we create a separate demo landing page first?
2. Do we want to prioritize a real chart over a polished summary card on the first pass?
3. Should payments be read-only in the client portal initially, or do we want a request/acknowledge action too?
4. Do we want the self-log to stay compact, or become a more guided multi-step flow?

If you want the fastest path, the best first step is: upgrade `/my-portal` into a true dashboard and let it link into the other flows.
