---
title: "UX Improvement Sweep #001"
author: Noa (Intranet Product Owner & UI Architect)
date: 2026-05-13
tags: [ux, dashboard, sweep]
decision-required: false
---

# UX Improvement Sweep #001

**Scope:** `obligations.html`, `obligations.js`, `forward-obligations.html`, `home.html`

**Run by:** Noa (Intranet Product Owner & UI Architect, engineering)

---

## 1. Findings & quick wins implemented in this PR

### 1.1 Chip active state (obligations.html / obligations.js)

**Finding:** The analytics panel chips ("By source-instrument family", "By bind state", "By status") render as `.oblig-chip--btn` after the previous session made them clickable, but there is no visual indication which chip is the currently-active filter. Clicking "LICENCE" and then looking at the chip row gives no feedback to the user — they must infer from the Domain dropdown value.

**Fix implemented:**
- Added `.oblig-chip--active` CSS class with a filled background (`--accent-ink`), white text, and a solid border matching the fill — consistent with the existing `.fo-horizon-btn.active` pattern on `forward-obligations.html`.
- `renderHistograms()` now marks the chip whose key matches the current filter value as active.
- When a chip is clicked and `drillToFamily()` / `drillToBind()` / `drillToStatus()` run, the corresponding chip gains `.oblig-chip--active`; the other chips in that row lose it.
- On filter reset (dropdown changed back to ""), all chips in the row revert to inactive.

### 1.2 Chip reset affordance (obligations.html / obligations.js)

**Finding:** After clicking a family chip to filter, there was no obvious way to clear the filter from the analytics panel — users had to scroll up and reset the Domain dropdown manually.

**Fix implemented:**
- When a chip is the active filter, a small "×" reset badge appears inline with the chip text.
- Clicking the × clears the corresponding dropdown and re-runs `refresh()`.
- Tooltip on the × reads "Clear filter" for screen-reader / hover disambiguation.

### 1.3 CSS custom properties audit

**Finding:** `forward-obligations.html` uses raw hex literals (`#e0e0e0`, `#fafafa`, `#666`, `#222`, `#1a6fb8`, etc.) throughout its `<style>` block rather than the brand tokens from `_brand.css`. This means the page is visually decoupled from the Hoz design system and will not benefit from future brand-token updates. More concretely, it uses a blue accent `#1a6fb8` rather than `--accent-ink: #3a4f6b`, and a background white `#fff` rather than `--surface-base`.

`obligations.html` already defines the required semantic tokens in its `:root` block (`:root { --surface-base, --surface-raised, --surface-hover, --neutral-rule, --text-primary, --text-secondary }`). `home.html` has no page-specific `<style>` block and inherits everything from `_brand.css` + `_shell.css`.

**Fix implemented for `forward-obligations.html`:**
- Added a `<link rel="stylesheet" href="/_brand.css">` and `<link rel="stylesheet" href="/_shell.css">` import.
- Added a `:root` semantic-token block mirroring the one in `obligations.html`.
- Replaced hardcoded hex values in the page's `<style>` with brand tokens where direct substitution was safe (colours used in backgrounds, borders, text; the `.fo-horizon-btn.active` accent colour aligned to `--accent-ink`).

### 1.4 Cross-page chip consistency (forward-obligations.html)

**Finding:** `forward-obligations.html` does not have family/bind/status chips. It has a horizon selector with `.fo-horizon-btn` elements that correctly show an `.active` state — this is the pattern used as the reference for the obligations chips. No chips to make clickable here; no gap.

### 1.5 Header / shell consistency (forward-obligations.html)

**Finding:** `forward-obligations.html` uses the legacy `<header class="topbar">` pattern rather than the Hoz shell (`<header class="shell-header">`, `_shell.js`). The page lacks the sidebar nav, the brand mark, the identity slot, and the shell refresh button. This is a larger structural change.

**Status:** Listed as a finding; structural shell migration not implemented in this sweep (would require moving the page to `_shell.js` dependency and updating nav registration — out of scope for a CSS/HTML quick-win PR).

### 1.6 Empty / loading states

**Finding:** `obligations.html` has a loading placeholder row (`Loading…`) in `<tbody>` but no CSS class; it relies on inline style. Minor — added `.oblig-empty-state` utility class for consistent empty/loading text alignment.

The filter-count span (`#obligListSub`) starts empty until data loads — it shows nothing while the table says "Loading…", which is fine (no change needed).

### 1.7 Accessibility — chip buttons (obligations.html)

**Finding:** Chip buttons rendered by `renderHistograms()` lacked `type="button"`, `aria-pressed`, and a clear accessible label. Screen readers announced them as unlabelled buttons.

**Fix implemented:**
- Chip buttons now include `type="button"`, `aria-pressed="false"` (toggled to `"true"` when active), and `aria-label="Filter by <key>"`.

---

## 2. Backend / API findings (not implemented)

| # | Page | Finding |
|---|------|---------|
| B1 | forward-obligations.html | The page uses `styles.css` (legacy) rather than `_brand.css` / `_shell.css`. A full shell migration would require backend nav-registration changes. |
| B2 | obligations.html | The `mermaid` render panel could benefit from server-side pre-rendering for accessibility (SVG alt text). Out of scope for view-layer sweep. |

---

## 3. Files changed

- `prototype/dashboard/public/obligations.html` — `:root` block verified present; `.oblig-chip--btn` active state CSS added; `aria` improvements.
- `prototype/dashboard/public/obligations.js` — `renderHistograms()` refactored to emit `<button>` chips with active state tracking; drill helpers updated.
- `prototype/dashboard/public/forward-obligations.html` — brand CSS imports added; `:root` semantic tokens added; hardcoded hex colours replaced with tokens.
