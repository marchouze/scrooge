---
title: Data-provenance substrate Slice 3 — output watermarking + recon
author: Anya (Data / analytics engineer, engineering — projection runtime + watermark layer)
date: 2026-05-10
summary: Provenance badge component (CSS + auto-mounting JS) wired into all 14 dashboard HTML pages with explicit [data-provenance-badge] markers; new GET /api/provenance/mode endpoint surfaces the env-derived ProvenanceFilter from Slice 2; recon:provenance-badge-coverage fails CI on any dashboard page missing the badge wiring; 29 new tests covering badge component, recon detection, and server-endpoint env-flip behaviour. Substrate gaps remaining (deferred per spec): combined-mode aggregation primitives (Slice 4), cross-reference enforcement (Slice 5), user toggle UX (Slice 7), PDF/reporting watermarks (substrate gap §11 — pending Bea+Atlas M2/M3 templates).
decision-required: false
decision-id: D-DATA-PROVENANCE-SUBSTRATE-SLICE-3
decision-category: medium-term
decision-owner: Anya (Data / analytics engineer, engineering)
---

# Data-provenance substrate Slice 3 — output watermarking + recon

**Author:** Anya (Data / analytics engineer, engineering — projection runtime + watermark layer)
**Reports to:** Devon (COO, governance — operational resilience)
**Date:** 2026-05-10
**For:** record (no CEO decision required — standing authority `D-DATA-PROVENANCE-SUBSTRATE`).
**Authority:**
- `D-DATA-PROVENANCE-SUBSTRATE` (CEO-approved 2026-05-10) — slice sub-authorisation under standing approval per CLAUDE.md "Dispatch discipline" → "No-pause rule".
- `Owner Inbox/actioned/2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md` §6 (output watermarking) + §7 row 3 (Slice 3 exit criterion: badge renders on every dashboard tile, recon green).
- CLAUDE.md Principle 1 — events are the only source of truth; the badge is a derived presentation of the env-derived `ProvenanceFilter`, not a stored attribute.
- CLAUDE.md Principle 6 — single-graph discipline; the badge is a downward render from the provenance dimension carried at the event envelope.
- `D-DATA-PROVENANCE-SUBSTRATE` Slice 2 (PR #167, merged 2026-05-10) — substrate this slice consumes (`defaultProvenanceFilter()` + `ProvenanceFilter` types).

---

## 1. What landed

### 1.1 Badge component — `prototype/dashboard/public/provenance-badge.{css,js}`

A self-contained component pair (no module bundler involved — the dashboard serves static assets directly).

**`provenance-badge.css`** styles three modes per pack §6.2:

| Mode             | Visual                                  |
|------------------|-----------------------------------------|
| `production-only`| 🟢 PRODUCTION DATA — green dot, solid border, green text on light-green background |
| `simulated-only` | 🟡 SIMULATED DATA — amber dot, dashed border, amber text on cream background       |
| `combined`       | 🔵 COMBINED (P+S) — blue dot, double border, blue text on light-blue background    |
| `unknown`        | grey dotted (loading state — never silent)                                          |
| `error`          | red solid (`/api/provenance/mode` failed — fallback so the user sees the failure)   |

The `@media print` block preserves the badge on printed snapshots (per pack §6.1 — every rendered artefact carries a watermark).

**`provenance-badge.js`** is an IIFE installing `window.provenanceBadge`:

- `render(filter, opts?)` — pure: builds an `HTMLSpanElement` for the given filter; opts include `{placement: "page-top" | "tile"}`.
- `describe(filter)` — pure: reduces the filter to a presentation tuple `{mode, label, suffix, aria}`.
- `mount(target, opts?)` — convenience wrapper that renders into a target element, replacing children.
- `fetch()` — fetches `/api/provenance/mode` and caches the resolved filter for subsequent renders.
- `autoMount()` — mounts on every `[data-provenance-badge]` marker, falling back to chrome injection if no marker exists (defence-in-depth so the watermark never silently disappears).
- `renderError(message)` — explicit error badge (red); used when the endpoint fetch fails.

The module auto-fetches and auto-mounts on `DOMContentLoaded`. Filter narrowing axes (scenario / variant / sourceLineage) append a suffix to the badge label per pack §6.2.

### 1.2 Server endpoint — `GET /api/provenance/mode`

New thin pass-through over `defaultProvenanceFilter()` from Slice 2:

```json
{
  "asOf": "2026-05-10T...Z",
  "bankPhase": "build",
  "filter": { "mode": "simulated-only" },
  "sliceAuthority": "D-DATA-PROVENANCE-SUBSTRATE-SLICE-3"
}
```

The `filter` field is the resolved `ProvenanceFilter` Slice 2 contracted to. No new substrate-level state is introduced — the endpoint is a derivation. Slice 7 (user-level toggle) extends this to honour a per-session override; today the response is the env-derived default only.

### 1.3 Per-page integration — 14 dashboard HTML pages

Every page under `prototype/dashboard/public/**/*.html` carries:

1. `<link rel="stylesheet" href="/provenance-badge.css">` in `<head>`.
2. `<span data-provenance-badge="page-top">` in the page header (legacy `.meta` strip, new shell `.shell-meta`, or top-right pinned for `architecture.html` which has no shell).
3. `<script src="/provenance-badge.js"></script>` near the end of `<body>`.

Pages wired:

| Page              | Type          | Marker placement                     |
|-------------------|---------------|--------------------------------------|
| `index.html`      | Legacy topbar | `.meta` strip (top-right)            |
| `home.html`       | Shell         | `.shell-meta` (top-right)            |
| `rms.html`        | Shell         | `.shell-meta` (top-right)            |
| `agents.html`     | Legacy topbar | `.meta` strip                        |
| `policies.html`   | Legacy topbar | `.meta` strip                        |
| `obligations.html`| Legacy topbar | `.meta` strip                        |
| `procedures.html` | Legacy topbar | `.meta` strip                        |
| `escalations.html`| Legacy topbar | `.meta` strip                        |
| `fleet.html`      | Legacy topbar | `.meta` strip                        |
| `health.html`     | Legacy topbar | `.meta` strip                        |
| `activity.html`   | Legacy topbar | `.meta` strip                        |
| `decision.html`   | Legacy topbar | `.meta` strip                        |
| `architecture.html`| Minimal      | Pinned top-right via fixed position  |
| `markets/fx/desk.html`| Shell     | `.shell-meta` (top-right)            |

Per pack §6.1 the badge is *not* in a tooltip — it's visible chrome.

### 1.4 Recon — `recon:provenance-badge-coverage`

`prototype/platform/recon/provenance-badge-coverage.ts` walks `prototype/dashboard/public/**/*.html` and asserts each page carries:

- the CSS link (`/provenance-badge.css`),
- the JS script (`/provenance-badge.js`),
- at least one explicit `[data-provenance-badge]` marker.

Severity: `fail` for any missing piece on a dashboard page. The pipeline is wired into `prototype/package.json` `ci` (post `recon:provenance-lineage-registered`); a future page that forgets the badge red-lines CI.

PDF / reporting templates: out of scope today — `prototype/reporting/` does not yet exist (substrate gap §11). The recon emits an `info`-severity note and the gap is named in §3 below; Bea+Atlas M2/M3 reporting capability lands the templates this recon must extend to cover.

### 1.5 Tests — 29 new

| File | Tests | Coverage |
|---|---|---|
| `tests/recon-provenance-badge-coverage.test.ts` | 5 | live-tree green; synthetic fixture detection per requirement |
| `tests/provenance-badge-component.test.ts` | 22 | source-shape assertions + pure-function evaluation of `describe`, `render`, `mount`, `renderError` in a fake DOM (no browser dependency) |
| `tests/dashboard-provenance-mode-endpoint.test.ts` | 2 | spawns the server twice (BANK_PHASE=build vs licence-day); confirms the env-derived filter flips correctly |

All green; no existing test regressed.

---

## 2. Backwards compatibility

- The badge is purely additive — no existing dashboard endpoint changed.
- The `/api/provenance/mode` endpoint is new; existing consumers ignore it.
- Pages without the marker still render under chrome auto-injection (defence-in-depth), but the recon insists on an explicit marker so authors don't drift into implicit reliance.
- Existing test count goes 700 → 729 (+29 net new); 0 failures.

---

## 3. Substrate gaps surfaced

Five gaps this slice does not close — each is a follow-on task. None block Slice 3's exit criterion.

1. **Slice 4 — Combined-mode aggregation primitives.** `ProvenanceAggregate<>` builder API at `prototype/platform/projections/aggregate.ts`; `recon:provenance-aggregation-breakdown`. The badge can render the `combined` mode label today, but the runtime still folds events into a flat aggregate without preserving the structural per-provenance breakdown the spec contracts to. Atlas+Anya joint, ~1 session.
2. **Slice 5 — Cross-reference enforcement at the graph level.** `recon:provenance-cross-reference-integrity` walks the EventId graph; today only Slice-1 surface-level checks are enforced.
3. **Slice 7 — User-level mode toggle UX.** Single user-level toggle in dashboard chrome; persists in user preferences (RMS `Feedback` event); applies as session default; CLI flag `--provenance-mode=<mode>` for scripted consumers. The `/api/provenance/mode` endpoint is the seam Slice 7 extends — it already returns a structured filter so the toggle can override and the badge picks up the change without further plumbing.
4. **PDF / reporting watermarks (per pack §6.1 + §11).** `prototype/reporting/` does not exist yet; pack §10 contracts that financial statements (M2) and regulator-submission generators (M3) will be hard-coded `production-only` and refuse to render in any other mode. When Bea+Atlas land the templates, `recon:provenance-badge-coverage` extends to assert a cover-page banner + per-page footer watermark.
5. **RMS `Correspondence` record-body badge.** Pack §6.3 names this scope; today the dashboard render of the seven RMS registers (Slice 4 of D-RMS-PHASE-1, PR #169) carries the page-level badge, but per-record bodies (e.g. an outbound regulator letter) do not yet have a structured slot for the badge. Lands as part of the Phase-2 maturation of dual-render in the RMS roadmap.

---

## 4. Coordination with parallel work

Per dispatch brief there are three other parallel dispatches today; intersection check:

- **RMS Slice 5 (Anya in another worktree).** E2e round-trip test. Touches `prototype/tests/` only — distinct test files used here (`recon-provenance-badge-coverage.test.ts`, `provenance-badge-component.test.ts`, `dashboard-provenance-mode-endpoint.test.ts`). No collision.
- **Reporting Slice 3 (Bea+Eitan+Anya — BA 325 LCR).** Different code area (`prototype/reporting/` if it lands; the present slice asserts that path is absent today). No collision.
- **Phase B scenario script (Bea+Tomas).** No collision.

---

## 5. Identity discipline check

Authors named with positions in §1 frontmatter and §1 body. References to other personas (Devon, Atlas, Bea) carry name + position on first mention.

---

## 6. PR

`substrate(D-DATA-PROVENANCE-SUBSTRATE Slice 3): output watermarking + provenance-badge-coverage recon` against `main`.

— Anya (Data / analytics engineer, engineering — projection runtime + watermark layer)
