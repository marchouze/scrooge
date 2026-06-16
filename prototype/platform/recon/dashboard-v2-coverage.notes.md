# Dashboard read-route → V2 coverage inventory (V1-removal Phase 4)

Authority: D-V1-REMOVAL-PHASE-4 (CEO-approved 2026-06-16).
Author: Atlas (Core banking platform architect, engineering).

Phase 4 wires the dashboard read path to V2 **behind the `useV2Store` feature
flag** (default OFF; V1 authoritative). This note inventories the dashboard read
routes that have a V1↔V2 projection pairing, and records for each whether a V2
read path is wired under the flag, or — if not — the honest reason it is left
V1-only (Charter command 5: no silent gaps).

The `recon:dashboard-v2-coverage` gate (advisory) is the machine-checkable
counterpart of this table: it enumerates the same routes and counts wired/total.
It becomes enforcing once every route here is wired.

## Inventory

| # | Route | V1 projection | V2 projection | Wired under flag? | Reason if V1-only |
|---|-------|---------------|---------------|-------------------|-------------------|
| 1 | `GET /api/gl/trial-balance` | `buildGlView().trialBalance` (gl-projection.ts) | `computeTrialBalanceV2` (gl-projection-v2.ts) | **YES** | — |
| 2 | `GET /api/risk/market-risk-measure` | `getMarketRiskMeasure` over `MarketRiskMeasureComputed` | `getMarketRiskMeasure` folds `MarketRiskVarComputed` (V2, #1379) in parallel → `v2Measure` | **YES** | — |
| 3 | `GET /api/product-control/daily-pnl` | `computeDailyPnL` (daily-pnl.ts) | `computeDailyPnLV2` (daily-pnl-v2.ts, #1380) — identical `DailyPnLResult` shape | **YES** | — |
| 4 | `GET /api/gl/entries` | `buildGlView().ledgerEntries` | none — V2 GL fold emits trial-balance rows only, no per-entry ledger view yet | NO | No V2 ledger-entry projection exists. V2 (`computeTrialBalanceV2`) folds `GlPostingEmitted` into balances, not individually-addressable ledger entries. Deferred until a V2 entry-level projection lands. |
| 5 | `GET /api/gl/accounts` | `buildGlView().accountBalances` | none — same gap as #4 (V2 fold is balance-level, account-name metadata is V1-sourced) | NO | V2 fold carries `(accountCode, currency)` balances but not the account-name/category metadata the V1 accounts view surfaces. Deferred to a V2 account-master projection. |
| 6 | capital metrics (`computeCapitalMetrics`, home/treasury tiles) | `capital-metrics.ts` | `computeBA700V2` (ba700-v2.ts, #1378) exists but is structurally no-data at Phase 3e | NO | The V2 BA-700 projection exists, but at Phase 3e its capital numerator is structurally no-data (no capital-GL posting rules emit `GlPostingEmitted` yet — GAP-3E-001) and its `BA700ReturnV2` shape differs from the `CapitalMetrics` tile shape. Promoting it would replace real V1 capital figures with zero — a regression, not an equivalent dual-read. Stays V1-only until capital-GL posting rules + a `CapitalMetrics`-shaped V2 adapter land. |
| 7 | ALM positions / LCR / NSFR (`getALMPositionSnapshot`, treasury tiles) | `alm-positions.ts` | Phase 3b money-market FIL fold lands the V2 events; `recon:ba300-v2-parity` folds them into LCR numerator/denominator, but no `getALMPositionSnapshot`-shaped V2 projection exists | NO | Phase 3b (#1383) added the V2 money-market lifecycle path, but not a V2 projection producing the HQLA/funding/ASF/RSF position-array shape the treasury route consumes. A route-boundary dual-read needs a snapshot-shaped V2 ALM projection first. |
| 8 | regulatory returns BA-700 / BA-320 | (V1 BA-return generators) | `computeBA700V2` + `computeBA320V2` (ba700-v2.ts / ba320-fx-v2.ts, #1378) exist and back the V2 parity gates | NO | The V2 projections exist and back `recon:ba700-v2-parity` / `recon:ba320-fx-v2-parity`, but no dashboard HTTP route surfaces a BA-700/BA-320 return today (the returns come from the BA-return generators, not a `/api` route). There is no route boundary to dual-read; this entry tracks projection availability so the gap stays explicit. BA-700 capital is additionally structurally no-data at Phase 3e (GAP-3E-001). |

## Summary

- Wired under `useV2Store`: **3** routes (GL trial-balance, market-risk measure, daily P&L).
- Total inventoried read routes with a V1↔V2 pairing: **8**.
- Coverage this slice: **3 / 8**.

The three wired routes are the ones with genuinely drop-in, shape-compatible V2
read paths:

- `computeTrialBalanceV2` — shape-identical to V1, asserted by `recon:gl-v2-parity`.
- `getMarketRiskMeasure` — already folds the V2 `MarketRiskVarComputed` event as
  `v2Measure`; the route promotes it to the headline figures via
  `promoteMarketRiskV2` when the flag is ON, re-deriving utilisation/RAG against
  the same appetite (no projection mutation; no silent zero when V2 is absent).
- `computeDailyPnLV2` — returns the identical `DailyPnLResult` shape as V1 (FIL FX
  instrument valuation), selected at the route boundary under the flag.

The remaining five routes are honest gaps:

- **#4/#5 (GL entries/accounts):** no entry-level / account-master V2 projection
  exists — the V2 GL fold is balance-level only.
- **#6 (capital metrics):** the V2 BA-700 projection exists but is structurally
  no-data at Phase 3e (no capital-GL posting rules) and shape-incompatible with
  the capital tile.
- **#7 (ALM/LCR/NSFR):** no snapshot-shaped V2 ALM projection — the V2
  money-market events are folded into LCR ratios for parity, not into the
  snapshot the route consumes.
- **#8 (BA-700/BA-320 returns):** the V2 projections exist but no dashboard route
  surfaces these returns, so there is no boundary to dual-read.

These are tracked here and in the advisory recon as honest gaps, to be wired in
subsequent Phase-4 slices as the missing V2 projections / route boundaries land.
The gate stays **advisory** until all eight routes are wired, keeping the cutover
reversible: V1 stays authoritative and the flag is OFF by default.
