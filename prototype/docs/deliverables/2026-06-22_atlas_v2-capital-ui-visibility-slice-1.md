---
title: "V2 Capital Position UI — visibility-remediation slice 1 (deliverable)"
author: "Atlas (Core banking platform architect, engineering)"
date: "2026-06-22"
authority: "D-V2-UI-VISIBILITY-REMEDIATION (CEO 2026-06-22); D-V2-UI-OVERSIGHT-STANDARD (CEO 2026-06-17)"
workstream: "WS-V2-UI-VISIBILITY-REMEDIATION"
citations:
  - "D-RMS-PHASE-3"
  - "D-V2-UI-VISIBILITY-REMEDIATION"
  - "D-V2-UI-OVERSIGHT-STANDARD"
  - "D-CAPITAL-ASSET-CLASS-V1"
---

# V2 Capital Position UI — visibility-remediation slice 1

## What this slice delivers

The bank's capital position is now visible in the V2 UI, to the human-oversight
standard. Slice 1 of the visibility-remediation sweep — and the reference
implementation for the financial-metrics slices that follow (LCR, NSFR, ALM,
market-risk VaR, credit SA-CCR).

Before this slice, `dashboard/public/v2/finance/capital.html` was prose
(`data-provenance-content="none"`, zero fetch calls). The Capital FIL + BA-700
capital-composition fold (merged #1491, `D-CAPITAL-ASSET-CLASS-V1`) computes
**CET1 = Tier 1 = own funds = R300m** under the simulated R300m injection, but
nothing surfaced it.

## Surface

- **API** — `GET /api/v2/finance/capital` (`dashboard/server.ts`) backed by a
  new `dashboard/v2-finance-view.ts`. Reads canonical sources directly:
  - `computeCapitalComposition` (`platform/projections/ba700-capital-composition.ts`)
    — the own-funds composition fold (CET1 / AT1 / Tier 2 / Tier 1 / total own
    funds) over the `capital` asset-class FIL lifecycle events.
  - `computeCapitalMetrics` (`platform/projections/capital-metrics.ts`) — the
    RWA denominator + RAS §B3 appetite status + headroom.
  - Returns `{ ...view, asOf, pageProvenance }`; honours
    `?provenance=prod|prod+sim` via `provenanceFilterFromMode`. Name-free by
    construction (the composition is a numeric fold; no name-bearing field).
- **Pages** —
  - `finance/capital.html` rebuilt to the standard: metric tiles (Total own
    funds, CET1, Tier 1, CET1 ratio, Total capital ratio), each drilling
    (click, no modal) to a detail page; the own-funds composition table with an
    honest empty state; the CET1-ratio formula block (numerator / denominator →
    result); Reg 38 / Banks Act §70 / BCBS hyperlinks to the regulation reader.
  - `finance/capital-metric.html` (new) — the per-metric detail page carrying
    the formula + the constituent composition lines. Reachable, not a dead-end.
  - `<body data-provenance-source="/api/v2/finance/capital">` +
    `<span data-provenance-badge="page-top">`; `v2WireLoader` + `v2Fetch` so the
    Prod / +Sim toggle re-runs the loader and repaints the badge.

## Provenance correctness (root-cause fix)

`computeCapitalComposition` previously took only an `includeSimulated` boolean
and gated on the operating-book default filter. The operating-book filter admits
`simulated` events during the build phase — so `includeSimulated:false` did NOT
exclude the simulated R300m injection, and the **Prod** lens would have painted
R300m too (the inverse of a silent zero — a silent *non*-zero). Root-cause fix:
`computeCapitalComposition` now accepts an explicit `filter: ProvenanceFilter`.
The view passes the page filter directly:

- **Prod** (`{ mode: "production-only" }`) — rejects `simulated` in both
  lifecycle phases → composition empty → the honest empty/zero-with-reason state
  ("No real capital in the build phase… switch to + Sim…").
- **+Sim** (`{ mode: "combined" }`) — admits the injection → CET1 = Tier 1 =
  total own funds = R300,000,000; CET1 ratio = 406.78%.

The legacy `ba700-v2.ts` caller path is unchanged (it supplies neither flag, so
the operating-book default still applies).

## Verification (in-browser, headless Chrome via CDP)

- **Prod** — badge "PRODUCTION DATA"; all tiles R0 / 0%; honest empty banner;
  composition table honest empty message. (Screenshot: `capital-prod.png`.)
- **+Sim** — badge "COMBINED (P+S)"; Total own funds / CET1 / Tier 1 =
  R300,000,000; CET1 ratio + total capital ratio = 406.78%; composition row
  "CET1 · Paid-up ordinary shares · R300,000,000". (Screenshot: `capital-sim.png`.)
- **Drill-through** — tile → `capital-metric.html?metric=cet1-ratio` renders the
  formula (R300,000,000 / R73,750,000 = 406.78%, Ref Reg 38(1)(a)) + the
  constituent list. (Screenshot: `capital-metric-detail.png`.)

`bun run ci` passes in full (full `tsc`, lint, tests, citation-gate 0, all recon
including `recon:provenance-badge-coverage`).

## Substrate gaps (tracked, not hidden — Charter cmd 5)

1. **RAS status under Prod is from the non-provenance-filtered metrics
   projection.** Under the Prod lens the composition is empty (R0), but the
   `status`/`headroom`/`totalRwa` context still derives from
   `computeCapitalMetrics`, which falls back to its own ICAAP build-phase
   baseline (R300m available, build-phase RWA) and is NOT provenance-filtered.
   The page states this honestly ("Source posture: Build-phase baseline (no live
   capital events)"). A future refinement should make the ratio context
   provenance-consistent with the composition numerator (i.e. an empty Prod
   composition should drive an explicitly "n/a — no capital under this lens"
   status rather than a green from the baseline). Tracked for the
   capital-metrics provenance-awareness slice.
2. **RWA denominator is the build-phase constant pre-licence.** The CET1-ratio
   denominator (R73,750,000) is the ICAAP v1 franchise-design constant until live
   booked positions exist (licence-day). This is inherited from
   `computeCapitalMetrics` (D-RWA-LIVE-POSITIONS-PROJECTION-V1) and is not a
   regression of this slice.
3. **No multi-currency own funds.** The composition reports functional-currency
   (ZAR) own funds only; cross-currency own-funds translation is a licence-day
   refinement (inherited from `ba700-capital-composition`).
4. **Reference hyperlinks assume reader slugs.** The Reg 38 / Banks Act / BCBS
   links target `/v2/compliance/reader.html?slug=…`; if a slug is not yet in the
   regulation library the link lands on the reader's "not found" state rather
   than a dead 404. Tracked for a reference-resolution pass once the regulatory
   library slugs are stable.
