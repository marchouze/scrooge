# Dashboard read-route → V2 coverage inventory (V1-removal Phase 4)

Authority: D-V1-REMOVAL-PHASE-4 (CEO-approved 2026-06-16).
Author: Atlas (Core banking platform architect, engineering).

Phase 4 wires the dashboard read path to V2 **behind the `useV2Store` feature
flag** (default OFF; V1 authoritative). This note inventories the dashboard read
routes that have a V1↔V2 projection pairing, and records for each whether a V2
read path is wired under the flag, or — if not — the honest reason it is left
V1-only this slice (Charter command 5: no silent gaps).

The `recon:dashboard-v2-coverage` gate (advisory) is the machine-checkable
counterpart of this table: it enumerates the same routes and counts wired/total.
It becomes enforcing once every route here is wired.

## Inventory

| # | Route | V1 projection | V2 projection | Wired under flag? | Reason if V1-only |
|---|-------|---------------|---------------|-------------------|-------------------|
| 1 | `GET /api/gl/trial-balance` | `buildGlView().trialBalance` (gl-projection.ts) | `computeTrialBalanceV2` (gl-projection-v2.ts) | **YES** | — |
| 2 | `GET /api/gl/entries` | `buildGlView().ledgerEntries` | none — V2 GL fold emits trial-balance rows only, no per-entry ledger view yet | NO | No V2 ledger-entry projection exists. V2 (`computeTrialBalanceV2`) folds `GlPostingEmitted` into balances, not individually-addressable ledger entries. Wiring deferred until a V2 entry-level projection lands. |
| 3 | `GET /api/gl/accounts` | `buildGlView().accountBalances` | none — same gap as #2 (V2 fold is balance-level, account-name metadata is V1-sourced) | NO | V2 fold carries `(accountCode, currency)` balances but not the account-name/category metadata the V1 accounts view surfaces. Deferred to a V2 account-master projection. |
| 4 | capital metrics (`computeCapitalMetrics`, home/treasury tiles) | `capital-metrics.ts` | none on `origin/main` — brief cited `ba700-v2.ts`, which does not exist in-tree | NO | No V2 capital-metrics projection is present on `origin/main`. The brief's `projections/ba700-v2.ts` path is aspirational. Left V1-only until a real V2 capital projection lands. |
| 5 | ALM positions / LCR / NSFR (`getALMPositionSnapshot`, treasury tiles) | `alm-positions.ts` | Phase 3b money-market FIL fold lands the V2 events, but no drop-in `getALMPositionSnapshot`-shaped V2 projection exists | NO | Phase 3b (#1383) added the V2 money-market GL/BA-300 path, but not a V2 projection matching the LCR/NSFR snapshot shape the treasury route consumes. Adapting at the route boundary needs a V2 snapshot projection first. |
| 6 | `GET /api/risk/market-risk-measure` | `getMarketRiskMeasure` over `MarketRiskMeasureComputed` | brief claimed #1379 made this dual-read V1+V2; **not true on `origin/main`** — the projection folds a single event type with no V2 branch | NO | The cited dual-read does not exist in-tree. The route already reads the canonical measure event; there is no separate V1/V2 split to gate. Recorded as V1-only-by-design pending a genuine V2 market-risk projection. |
| 7 | regulatory returns BA-700 / BA-320 | (V1 generators) | brief cited "#1378 V2 projections"; not located on `origin/main` as drop-in route-level projections | NO | No route-level V2 BA-700/BA-320 projection found on `origin/main` to swap in at the boundary. Deferred. |

## Summary

- Wired under `useV2Store`: **1** route (GL trial-balance).
- Total inventoried read routes with a V1↔V2 pairing: **7**.
- Coverage this slice: **1 / 7**.

The first wired route is the one with a genuinely drop-in, parity-gated V2
projection (`computeTrialBalanceV2`, shape-identical to V1, asserted by
`recon:gl-v2-parity`). The remaining six are blocked on V2 projections that do
not yet exist on `origin/main` in a route-consumable form — several brief-cited
projection paths (`ba700-v2.ts`, market-risk dual-read, BA-700/320 V2) were
found to be aspirational rather than present. Those are tracked here and in the
advisory recon as honest gaps, to be wired in subsequent Phase-4 slices as the
V2 projections land. This keeps the cutover reversible: V1 stays authoritative
and the flag is OFF by default.
