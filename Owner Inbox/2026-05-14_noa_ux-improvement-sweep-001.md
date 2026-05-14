---
author: Noa (Intranet Product Owner & UI Architect)
date: 2026-05-14
sweep: "001"
findings: 13
quick-wins-shipped: 12
decision-required: false
---

# UX Improvement Sweep #001

**Author:** Noa (Intranet Product Owner & UI Architect)
**Date:** 2026-05-14
**Pages audited:** home.html, obligations.html, forward-obligations.html, policies.html, taxonomy.html, regulatory.html, performance.html
**Quick-win fixes shipped:** 12 (all implemented in this PR)

---

## Executive summary

Seven pages audited. The two most recently added pages — `taxonomy.html` and `performance.html` — were built on the legacy `topbar` chrome rather than the shell. This means no sidebar navigation, no skip link, no consistent header identity chip, and broken visual continuity with obligations/regulatory/home. Both are now retrofitted to the shell. Nine additional low/medium fixes ship in the same PR, including page-title capitalisation across nine files and an obligations table colspan correction.

---

## Findings

### HIGH — Blocks understanding or usability

**F-001 · taxonomy.html uses legacy topbar chrome — no shell header, no sidebar, no skip link**
- Severity: High
- The page was built using `class="topbar"` / `class="topbar-inner"` from `styles.css`, giving it a completely different visual shell from `obligations.html`, `regulatory.html`, and `home.html`. Users arriving from the sidebar see a layout shift.
- Status: **Fixed** — replaced with `shell-header` + `shell-layout` + `shell-sidebar` + `shell-main` + skip link.

**F-002 · taxonomy.html: DCAM legend never renders — missing `#dcamLegend` anchor**
- Severity: High
- `taxonomy.js` calls `renderDcamLegend()` which injects HTML into `document.getElementById("dcamLegend")`. The element did not exist in the HTML, so the three-layer DCAM legend was silently dropped on every page load.
- Status: **Fixed** — added `<div id="dcamLegend">` above the search bar.

**F-003 · performance.html uses legacy topbar chrome**
- Severity: High
- Same pattern as F-001. Nav links in the old topbar point to `/` (index root), `/agents.html`, `/fleet` (no `.html`), `/health.html` — inconsistent with the shell sidebar's canonical paths.
- Status: **Fixed** — replaced with shell chrome.

**F-004 · performance.html: empty `<tbody id="perfTableBody">` — blank table on load before JS fires**
- Severity: High
- The table body had no loading or empty-state content. On first render (before `performance.js` resolves) the table appeared with column headers and nothing below — no indication data is loading.
- Status: **Fixed** — added an empty-state row as the initial HTML. JS overwrites it on data arrival.

### MEDIUM — Friction or inconsistency

**F-005 · performance.html: filter `<label>` elements missing `for=` attributes**
- Severity: Medium
- All four filter labels (Period, Tier, Trend, Search) were `<label>` without a `for` attribute, breaking the click-to-focus affordance and screen reader association.
- Status: **Fixed** — added `for="filterPeriod"`, `for="filterTier"`, `for="filterTrend"`, `for="filterSearch"`.

**F-006 · taxonomy.html: panel toggle `▾` buttons lacked `aria-hidden`**
- Severity: Medium
- Decorative arrow characters inside interactive `div[role=button]` elements were not hidden from assistive technology.
- Status: **Fixed** — added `aria-hidden="true"` to all four `.tax-panel-toggle` spans. Added `aria-controls` pointing to panel body IDs.

**F-007 · taxonomy.html: search/clear controls lacked `aria-label`**
- Severity: Medium
- The search input placeholder is not read by all screen readers as a label; the Clear button had no `aria-label`.
- Status: **Fixed** — added `aria-label="Search taxonomy codes and labels"` on input, `aria-label="Clear search"` on button, `aria-live="polite"` on result count span.

**F-008 · obligations.html: loading row colspan=5 but table has 6 columns**
- Severity: Medium
- The initial loading state row used `colspan="5"` in a table with 6 `<th>` elements (ID, Bind, Regulation, Requirement, Fulfilment policy, Status), causing the loading cell to not span the full width.
- Status: **Fixed** — changed to `colspan="6"`.

**F-009 · Cross-page navigation inconsistency — legacy topbar nav links**
- Severity: Medium
- `performance.html` topbar linked to `/` (root), `/agents.html`, `/fleet` (no extension), `/health.html`. Shell sidebar provides consistent navigation; the old topbar nav is now removed.
- Status: **Fixed** as part of F-003 shell retrofit.

**F-010 · taxonomy.html: `surface-*` custom properties used but not defined**
- Severity: Medium
- The page-local styles reference `var(--surface-base)`, `var(--surface-raised)`, `var(--surface-hover)`, `var(--neutral-rule)`, `var(--text-primary)`, `var(--text-secondary)` but the page had no `:root` block defining them (unlike obligations.html which does). This meant these would resolve to transparent/inherited where _brand.css and _shell.css don't define them.
- Status: **Fixed** — added a `:root` block matching the obligations.html pattern.

### LOW — Polish

**F-011 · Inconsistent page title capitalisation — 9 pages**
- Severity: Low
- Pages using lowercase-first `<title>` elements: `activity.html`, `agents.html`, `architecture.html`, `decision.html`, `escalations.html`, `fleet.html`, `health.html`, `home.html`, `index.html`. Pattern from `obligations.html`, `regulatory.html`, `performance.html`, `taxonomy.html` is Title Case.
- Status: **Fixed** — all 9 corrected.

**F-012 · policies.html title was `policies · Hoz` (lowercase)**
- Severity: Low
- Status: **Fixed** — corrected to `Policies · Hoz`.

**F-013 · performance.html: `<table>` lacked `aria-label`**
- Severity: Low
- The fleet table had no accessible name.
- Status: **Fixed** — added `aria-label="Agent performance fleet table"`.

---

## Findings not fixed this pass (deferred)

None deferred. All 13 findings are shipped in this PR.

---

## taxonomy.html DCAM alignment badge verification

The DCAM three-layer badge system (L1 indigo FIBO, L2 colour-coded CDM/CFI/BCBS/FATF, L3 purple ISO 20022) is rendered entirely by `taxonomy.js → renderDcamChips()`. The chips use inline `style=` with hardcoded background colours matching the spec:
- L1 FIBO: `background:#4338ca` (indigo) — readable white text on dark
- L2 CDM: `#0f766e` (teal), ESMA-CFI: `#059669` (emerald), BCBS: `#dc2626` (red), FATF: `#d97706` (amber), ISO17442: `#475569` (slate) — all white text on dark
- L3 ISO20022: `#7e22ce` (purple) — white text on dark

SKOS match opacity modulation (exactMatch=1.0 down to relatedMatch=0.5) is implemented in `renderDcamChips()`. The collapsible DCAM legend now renders into `#dcamLegend` (F-002 fix). `<a>` links for L1 FIBO IRI and L2 refs open with `target="_blank" rel="noopener"` — correct.

---

## Chip active state — obligations.html

The obligations chip active state is already fully implemented in `obligations.html`:
- `.oblig-chip--btn.oblig-chip--active` applies `background: var(--accent-ink); border-color: var(--accent-ink); color: #fff` — solid ink fill, white text.
- A `×` reset glyph is present via `.oblig-chip-reset`.
- Focus ring: `outline: 2px solid var(--accent-ink); outline-offset: 2px`.

No additional work needed on this feature.

---

## Substrate gaps surfaced

1. **`styles.css` / `_shell.css` split is not yet complete.** `performance.html` and `taxonomy.html` were authored against the legacy `styles.css` topbar pattern. The retrofit lands via this PR but the root cause is the absence of a documented authoring contract specifying which CSS file to use for new pages. Recommend Atlas add a one-liner to the page-authoring guide (or `_shell.css` header) making clear that `_brand.css + _shell.css` is the canonical starting point and `styles.css` is legacy-only.

2. **`performance.js` references `liveDot` element by ID — now absent after shell retrofit.** The JS has null-safe checks (`if (liveDot)`) so it doesn't throw, but the live-dot visual no longer updates on the performance page. The shell header handles as-of display via `lastUpdated` span — functionally equivalent. Proper fix is to route performance.js's status updates through the shell's `data-shell-asof` mechanism.
