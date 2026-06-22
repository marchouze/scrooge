---
title: V2 UI visibility-remediation slice 3 — Treasury liquidity surfaces + capital-metrics provenance (gap #1)
author: Atlas (Core banking platform architect, engineering)
date: 2026-06-22
register: documents
classification: agent-internal
decision: D-V2-UI-VISIBILITY-REMEDIATION
authority: D-V2-UI-OVERSIGHT-STANDARD
---

# V2 UI visibility-remediation — slice 3

**Authority:** `D-V2-UI-VISIBILITY-REMEDIATION` (CEO 2026-06-22) under the standing
`D-V2-UI-OVERSIGHT-STANDARD`. Sibling of slice 1 (capital, PR #1496) and slice 2
(FX, PR #1498).

## What shipped

Two related things in the build-phase financial-metric provenance family.

### A. Treasury liquidity V2 surfaces (LCR / NSFR / ALM)

Three prose pages (`treasury/lcr.html`, `treasury/nsfr.html`, `treasury/alm.html`)
that were `data-provenance-content="none"` with zero fetch are now full
data-bearing oversight surfaces, built to the V2 UI human-oversight standard:

- New `dashboard/v2-treasury-view.ts` (sibling of `v2-finance-view.ts`) reads the
  canonical sources directly — `computeLCR` / `computeNSFR` (`platform/liquidity/`)
  and `getALMPositionSnapshotV2` (`platform/projections/alm-positions-v2.ts`),
  scoped to the bank-licence entity `LE-ZA-HOZ-BANK` (Reg 26 / 26A are
  bank-licence-bound).
- New routes `GET /api/v2/treasury/{lcr,nsfr,alm}` in `dashboard/server.ts`, each
  returning `{ ...view, asOf, pageProvenance }` and honouring `?provenance=` via
  `provenanceFilterFromMode`.
- LCR page: tile (LCR %) drills to the formula **HQLA / net 30-day outflows** plus
  HQLA and outflow constituent tables. NSFR page: tile (NSFR %) → **ASF / RSF**
  formula plus ASF & RSF constituent tables. ALM page: position-class tiles +
  positions-by-type table + per-class position tables + a named substrate-gaps
  section. Shared `treasury/liquidity-metric.html` drill-through (formula +
  constituents) reused across LCR and NSFR.
- Honest empty states throughout: in the build phase there are no V2 money-market
  events, so every position is an explicit `no-positions` / "no … booked in the
  build phase" state — never a blank that reads as zero.

### B. Capital-metrics provenance fix (gap #1 from slice 1) — root-cause

`computeCapitalMetrics` (`platform/projections/capital-metrics.ts`) is now
provenance-aware, mirroring slice 1's `computeCapitalComposition` change exactly:

- New optional `filter?: ProvenanceFilter` param (default = operating-book, so
  every existing caller is unchanged — verified across all call sites: `eve.ts`,
  `leverage-ratio-metrics.ts`, `alm-positions.ts`, `alm-positions-v2.ts`,
  `limit-utilisation-deps.ts`, `calculation-provenance.ts`,
  `helena-risk-appetite-watch.ts`, `server.ts`).
- The filter threads into `readLiveCapitalPosition` (the simulated R300m
  `CapitalEvent` is now excluded under `production-only`) and into
  `computeRwaFromPositions`. Under the strict-production lens the ICAAP build-phase
  baseline is **suppressed** — an empty production book has neither R300m capital
  nor a baseline RWA — so the ratios / headroom / RAS status reflect the honest
  empty production state, consistent with the empty BA-700 composition the capital
  page shows under Prod. A zero numerator now yields an honest 0% ratio, never ∞.
- The filter digest rides in the output-snapshot cache stream key so a Prod read
  never serves a +Sim-cached value and vice-versa.
- `dashboard/v2-finance-view.ts` threads the page `filter` into
  `computeCapitalMetrics`, and a new honest `sourcePosture` field replaces the
  page's `buildPhase ? … : …` inference (which mislabelled the empty production
  state as "live capital events").
- `getALMPositionSnapshotV2` gained an optional `capitalFilter` (default
  operating-book) so the treasury surfaces' Tier-1-capital ASF honours the same
  Prod/+Sim lens — under Prod the simulated capital injection is no longer shown
  as production ASF.

## Verification

- `bun run ci` passes IN FULL on a pristine seeded store (typecheck + lint +
  7,828 tests + citation-gate 0; infra recons 85/85; domain recons 151/151;
  v1-removal-ratchet HELD at 286 — no new V1 dependency;
  `recon:provenance-badge-coverage` clean for the new pages).
- In-browser (headless Chrome, seeded store with the simulated R300m injection):
  the three treasury pages render tiles + formula + constituent tables with honest
  empty states; the capital page under Prod shows RAS status **red / critical —
  below TICR**, headroom −R36,675,000, CET1 ratio **n/a**, RWA R0 — consistent
  with the empty composition (gap #1 closed); under +Sim the R300m injection
  shows (headroom +R263,325,000, RWA R73,750,000, green).

## New tests

- `tests/capital-metrics.test.ts` — gap #1 block: production-only excludes the
  simulated injection + suppresses the ICAAP baseline → honest empty (R0); combined
  admits it; empty store under production-only → empty; default filter unchanged.
- `tests/v2-treasury-view.test.ts` — honest empty states for LCR/NSFR/ALM;
  provenance lens (simulated capital ASF shows under +Sim, not Prod); name-free.

## Tracked substrate gaps

1. **`recon:no-float-money-arithmetic` line-anchored allowlist.** The allowlist is
   keyed `file:line`; any edit that shifts a pre-existing allowlisted line
   re-flags it as "new". This run re-anchored 9 shifted pre-existing entries via
   `--generate-allowlist` (count held at 223; no net new debt). Gap: the allowlist
   should key on a content hash or symbol, not a raw line number, so unrelated
   edits don't churn it. (Pre-existing platform gap, not introduced here.)
2. **Capital tile not yet V2-authoritative.** `dashboard-v2-coverage` still lists
   the capital metrics tile as V1-only (needs a CapitalMetrics-shaped V2 adapter +
   real capital at licence-day). The new `/api/v2/finance/capital` surface is the
   oversight read; the V1 tile cutover is a separate licence-day slice.
3. **ALM money-market positions empty in build phase.** All HQLA / funding / ASF /
   RSF arrays are empty until V2 money-market events (DepositTakenV2, etc.) are
   booked. The surfaces render honest empty states and a named substrate-gaps
   section; re-validate with real positions at licence-day.
