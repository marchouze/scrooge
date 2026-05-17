---
title: Intranet fix v0 — tile-render verified + per-page back-link injection
author: Anya (Data / analytics engineer) + Linnea (Brand & design lead)
date: 2026-05-09
summary: Verified `home.js` populates all 33 tiles across 7 categories from `/api/state`; added a single-file shell-back-link injection to `_refresh-controls.js` so all 9 sibling pages get a "← Hoz home" link without per-page edits. Full per-page chrome retrofit remains v3.1 deferred per Linnea PR #72.
decision-required: false
---

## What landed

### Part 1 — `home.js` tile-render — verified working

The reported "doesn't populate" issue did not reproduce. Headless run
of `/home.html` against `/api/state` produced **33 tiles across 7
categories**, all derived from `/api/state` + `/api/obligations` +
`/api/substrate-gaps` + `/api/fleet` + `/api/escalations`:

| Category | Tiles | Source |
| --- | --: | --- |
| Dashboards (live) | 7 | obligations · policies · activity · agents · escalations · fleet · health |
| Reports (as-of-date) | 5 | Owner Inbox + 4 placeholders (BA returns / board packs / fin statements / audit reports) |
| Decisions (live) | 2 | CEO decisions + Board placeholder |
| Registers (canonical) | 5 | obligations · policies · procedures (placeholder) · agents · regulations (placeholder) |
| Substrate ops (live) | 6 | architecture · fleet · health · agents · escalations · substrate gaps |
| Markets (M-phase) | 4 | desks (M2) · portfolios · exposures · risk positions |
| Compliance | 4 | FIC · sanctions · KYC · conduct |

All tile counts read live from canonical sources (Principle 1 — no
hard-coded data). Placeholders carry a tile-kind data attribute so
reports tiles are honestly surfaced as "as-of-date / coming with
substrate v1".

No code change needed in `home.js`; the existing PR-#? CATALOGUE
already covered the 7-category schema.

### Part 2 — Per-page back-link v0

Added a single `injectShellBackLink()` function to
`prototype/dashboard/public/_refresh-controls.js` (the shared
substrate already loaded by 7 of 9 sibling pages). Behaviour:

- Skips `/home.html` and `/`
- Preferred path: nests `<a class="shell-back-link" href="/home.html">← Hoz home</a>` inside the legacy `.topbar .meta` cluster — applies to **8 of 9** sibling pages (agents · policies · decision · activity · escalations · fleet · health · obligations).
- Fallback path: pages without a `.topbar` (today: `architecture.html`) get a `.shell-back-bar` pinned at the top of `<body>`.
- Wired `_refresh-controls.js` into the two pages that did not yet load it (`obligations.html`, `architecture.html`).
- Styles added to `styles.css` matching the existing `.nav-link` conventions (white-on-primary topbar with dotted underline + bright-on-hover).

**Single-file substantive change.** The actual back-link element,
styling, audit-log hook, and skip-on-home logic live in one place.
Per-page edits are limited to `<script src=...>` tags on the two
pages that did not already load `_refresh-controls.js`.

### Part 3 — Verification

End-to-end smoke test (live preview server on port 3010):

- `/home.html` — 33 tiles populated, no back-link injected (correct).
- `/agents.html` — back-link present, parent `.meta`, `href="/home.html"`, text `← Hoz home`.
- `/obligations.html` — same pattern as agents.
- `/architecture.html` — back-link present in fallback `.shell-back-bar` at top of body.
- Click-through: `/home.html` → tile → `/agents.html` → click back-link → `/home.html`. Confirmed.

CI run: 319 pass / 3 fail. The 3 failures are pre-existing
(`tests/runtime.test.ts` Vera-overnight-recon assertions on
`result.ok`) and unrelated to this PR. Diff vs main is 4 files:
`_refresh-controls.js`, `styles.css`, `architecture.html`,
`obligations.html`.

## v3.1-deferred items (still owed; not blocking)

Per Linnea PR #72 brand-supplement, the following remain:

1. **Full per-page chrome retrofit** — replace each page's bespoke
   `.topbar` / `<nav>` with the shared `_shell.css` chrome
   (`.shell-header` / `.shell-layout` / `.shell-sidebar`). Today the
   nav-back is a single anchor pinned into the legacy chrome; v3.1
   harmonises every page on the brand-supplement v3 chrome.
2. **Reports browse view** — Reports tiles still link to `/api/state`
   (raw JSON) or are placeholders. v1 substrate is the as-of-date
   browse view (Atlas, Anya).
3. **Markets / Compliance placeholders → real pages** — 4 + 4 tiles
   resolve to `#` placeholders today. Replaced as M2 (Kai · trading
   desks), M-phase (Anya / Kai · portfolios), M-phase (Rohan ·
   exposures, risk positions), and Mira / Zara (FIC · sanctions ·
   KYC · conduct) procedures land.
4. **Procedures index UI** — `/Procedures/_index.md` rendering not
   wired to a dashboard view yet.
5. **Regulations index UI** — `/Regulations/_obligations-register.md`
   currently only surfaces via Mira's obligations-view; a regulation-
   level browse remains.

## Substrate gaps surfaced

- `architecture.html` is still on bespoke chrome — it has its own
  `<nav>` linking to `/`. The shell-back-bar appears above that nav,
  which is harmless but redundant. v3.1 retrofit collapses the two.
- Real authentication still stub-only (Senna / Iris) — back-link does
  not yet authorise; today everyone sees it.
- `UiInteraction` event-type still v1 — back-link clicks log via
  `bankShell.audit` (in-memory) when shell.js is loaded; on legacy
  pages the click is uninstrumented.
- The home.html "doesn't populate" report turned out to be a false
  positive (tile-render works against current `/api/state`). Worth
  noting as a substrate gap: there is no dashboard self-test that
  asserts `home.js` renders ≥30 tiles, which would have caught a real
  regression earlier. Adding such a test is a Vera Wave-4 candidate.

## Authority

CEO directive 2026-05-09 — "fix intranet links and pages".

## Reporting line

Anya → Devon (COO, governance); Linnea → Devon (COO, governance).
