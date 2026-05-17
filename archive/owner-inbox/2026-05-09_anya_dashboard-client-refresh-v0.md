---
title: Dashboard client refresh — periodic + manual refresh + freshness display
author: Anya (Data / analytics engineer)
date: 2026-05-09
summary: Added shared `_refresh-controls.js` module to every dashboard page — owns the per-page polling timer, pauses on tab-hidden, resumes immediately on tab-visible, and injects a manual "Refresh" button into the topbar that POSTs to `/api/refresh` then re-fetches. Server side already correct (30s poll + fsWatch + `/api/refresh`); the bug was an open browser tab whose load-once fetches never re-ran or could be cancelled by a backgrounded tab.
decision-required: false
---

# Dashboard client refresh v0

Marc (CEO) flagged that the dashboard "is not updating live". Investigation
confirmed the server-side is fine — `prototype/dashboard/server.ts` re-derives
state every 30s via `pollTimer`, plus on canonical-source file change via
`fsWatch()`, plus on demand via `POST /api/refresh`. The bug was on the client:
each page had its own `setInterval(load, 30_000)` poll, but no
visibility-pause and no manual-refresh affordance, so an operator who opened
a tab and walked away saw whatever the page rendered at first load with no
way to force a fresh read.

Per Marc's clarification of the dashboard rule (memory:
`feedback_dashboards_live_reports_as_of.md`, 2026-05-09): "live" means
periodic re-derivation + user-trigger refresh + actually re-querying canonical
sources. SSE / WebSocket push is one valid implementation but **not**
required.

## What landed

**New file: `prototype/dashboard/public/_refresh-controls.js`** — a shared
cross-page module loaded by every dashboard HTML page (alongside the existing
`_failure-banner.js`). It provides:

- `window.registerPagePoll(fn, intervalMs)` — replaces `setInterval` for
  every page's poll loop. The shared module owns the timer.
- **Tab-visibility pausing.** On `document.visibilitychange`, hidden ⇒ all
  registered timers are cleared; visible ⇒ each registered fn is called
  immediately and its timer is restarted. Saves CPU on backgrounded tabs and
  ensures the operator sees fresh data the moment they return to the tab.
- **Manual "Refresh" button** auto-injected into each page's `.topbar .meta`.
  On click: disables itself, POSTs to `/api/refresh` (forces server-side
  re-derivation even if the 30s server tick hasn't fired yet), then calls
  every registered poll fn so the page re-renders, then re-enables.

**All 8 page-JS files** updated to call
`window.registerPagePoll(load, 30_000)` instead of `setInterval(load,
30_000)` (with a fallback to `setInterval` if the shared module didn't load
for any reason). `app.js` (the dashboard home) the same — calling
`registerPagePoll(fetchState, POLL_MS)` (POLL_MS = 8s; the home polls more
aggressively than the secondary pages, which is preserved).

**All 8 HTML files** updated to load `/_refresh-controls.js` immediately
before `/_failure-banner.js` (consistent with the existing shared-module
pattern). `architecture.html` is intentionally skipped — it's a static
diagram page with no live data.

**`styles.css`** — added a `.refresh-now` rule for the auto-injected button
to match the dark topbar (semi-transparent fill, white text, hover state,
disabled state).

**Freshness display** — every page already renders `Updated <timestamp>` in
the topbar (`#lastUpdated`) from `state.asOf`. No new freshness widget
needed; the existing render path now ticks reliably because the poll loop
is uniformly managed.

## Verification

Ran a fresh dashboard server on `BANK_DASHBOARD_PORT=3015`:

- `GET /api/state` returns `asOf: 2026-05-09T05:44:00.480Z`.
- Appended a trailing space to `Regulations/_obligations-register.md`,
  saved. Within ~2.5s, `GET /api/state` returned `asOf: …05:44:19.145Z` —
  fsWatch fired and the server re-derived. Reverted the edit immediately.
- `POST /api/refresh` advanced `asOf` immediately on each call
  (00.480 → 07.519 → 19.145+ across runs). Endpoint returns
  `{ok: true, asOf: …}` synchronously after re-derivation.
- `GET /` and `GET /_refresh-controls.js` both serve cleanly; the script
  tag is in place on every page.

Browser-side wiring is direct DOM JS (registerPagePoll + visibilitychange
+ button injection) and was code-reviewed for the standard pitfalls:
unsubscribe semantics returned, no leaked intervals, button disabled on
in-flight click, fallback to plain `setInterval` if the shared module
failed to load.

## Substrate gap surfaced

If/when 30s periodic refresh stops being enough — e.g. operators want a
sub-second view of decisions arriving — the next step is server-sent events
(SSE) over a long-poll endpoint, or WebSocket push. **Not now.** Marc has
explicitly said periodic refresh is fine for the build phase. Captured here
as the v1 follow-up for the dashboard substrate roadmap.

## Per-page audit

All seven secondary pages (`agents`, `policies`, `activity`, `decision`,
`escalations`, `fleet`, `health`) had identical `setInterval(load, 30_000)`
patterns and identical `lastUpdated` rendering against `state.asOf`. No
page-unique fetch logic worth flagging — the shared module covers all of
them with one substitution. `app.js` (home) uses an 8-second poll which is
preserved.

## CI note

`bun run ci` shows three pre-existing failures on main (1bdf841): Rohan
backtest-harness amber fixture, and two Vera overnight-recon tests.
Unrelated to this change.

## Citations

- Memory: `feedback_dashboards_live_reports_as_of.md` (2026-05-09) —
  dashboards = live (periodic + user-trigger; SSE not required).
- Memory: `feedback_dashboard_always_derived.md` — dashboard state is a
  cache of canonical sources; the client's job is to ask the server to
  re-derive, not to mutate state itself.
- Principle 1 — events / canonical sources are the source of truth. The
  client poll just re-asks the server; the server re-derives.
