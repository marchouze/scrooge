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
| 4 | `GET /api/gl/entries` | `buildGlView().ledgerEntries` | `computeGlEntriesV2` (gl-projection-v2.ts, WS-V2-AUTHORITATIVE S5) — individually-addressable `GlLedgerEntry`-shaped entries | **YES** | — |
| 5 | `GET /api/gl/accounts` | `buildGlView().accountBalances` | `computeGlAccountsV2` (gl-projection-v2.ts, WS-V2-AUTHORITATIVE S5) — account-master `{ accountId, name, category, balances }` with COA metadata | **YES** | — |
| 6 | capital metrics (`computeCapitalMetrics`, home/treasury tiles) | `capital-metrics.ts` | `computeBA700V2` (ba700-v2.ts, #1378) exists but is structurally no-data at Phase 3e | NO | The V2 BA-700 projection exists, but at Phase 3e its capital numerator is structurally no-data (no capital-GL posting rules emit `GlPostingEmitted` yet — GAP-3E-001) and its `BA700ReturnV2` shape differs from the `CapitalMetrics` tile shape. Promoting it would replace real V1 capital figures with zero — a regression, not an equivalent dual-read. Stays V1-only until capital-GL posting rules + a `CapitalMetrics`-shaped V2 adapter land. |
| 7 | ALM positions / LCR / NSFR (`getALMPositionSnapshot`, treasury tiles) | `alm-positions.ts` | `getALMPositionSnapshotV2` (alm-positions-v2.ts, WS-V2-AUTHORITATIVE S6) — folds the V2-parallel money-market lifecycle events into the IDENTICAL `ALMPositionSnapshot` shape; backed by `recon:alm-snapshot-v2-parity` | **YES** | — |
| 8 | `GET /api/regulatory-returns/:return` (BA-700 / BA-320) | V1 BA-return generators (`generateBA700Return`; `fxPositionCalculator` + `fxPositionsToBa310Input`) | `computeBA700V2` + `computeBA320V2` (ba700-v2.ts / ba320-fx-v2.ts, #1378) — WS-V2-AUTHORITATIVE S9 `selectRegulatoryReturn` dual-read | **YES** | — |

## Summary

- Wired under `useV2Store`: **7** routes (GL trial-balance, GL entries, GL
  accounts, market-risk measure, daily P&L, ALM / LCR / NSFR snapshot, BA-700 /
  BA-320 regulatory returns).
- Total inventoried read routes with a V1↔V2 pairing: **8**.
- Coverage this slice: **7 / 8** (WS-V2-AUTHORITATIVE S9 closed route #8).

The seven wired routes are the ones with genuinely drop-in, shape-compatible V2
read paths:

- `computeTrialBalanceV2` — shape-identical to V1, asserted by `recon:gl-v2-parity`.
- `computeGlEntriesV2` (WS-V2-AUTHORITATIVE S5) — one entry per `GlPostingEmitted`
  leg in the `GlLedgerEntry` shape; same provenance filter + posting-date window
  + COA metadata source as V1, so it is a true equivalent, not a re-implementation.
- `computeGlAccountsV2` (WS-V2-AUTHORITATIVE S5) — per-(account, currency) balances
  with COA name/category/natural-side, matching the V1 `/api/gl/accounts` shape.
- `getMarketRiskMeasure` — already folds the V2 `MarketRiskVarComputed` event as
  `v2Measure`; the route promotes it to the headline figures via
  `promoteMarketRiskV2` when the flag is ON, re-deriving utilisation/RAG against
  the same appetite (no projection mutation; no silent zero when V2 is absent).
- `computeDailyPnLV2` — returns the identical `DailyPnLResult` shape as V1 (FIL FX
  instrument valuation), selected at the route boundary under the flag.
- `getALMPositionSnapshotV2` (WS-V2-AUTHORITATIVE S6) — folds the V2-parallel
  money-market lifecycle events into the IDENTICAL `ALMPositionSnapshot` shape
  (HQLA / funding / ASF / RSF arrays) the treasury LCR / NSFR tiles read,
  selected at the route boundary under the flag via `selectALMPositionSnapshot`.
  Currency-agnostic (reporting currency sourced from the entity tree, no
  hardcoded ZAR). Backed by `recon:alm-snapshot-v2-parity` (snapshot-shape
  compare, where `recon:ba300-v2-parity` compares only the LCR ratio denominator).
- `selectRegulatoryReturn` (WS-V2-AUTHORITATIVE S9) — the route-boundary dual-read
  behind the new `GET /api/regulatory-returns/:return` route. Under `useV2Store`
  it folds the V2 projections (`computeBA700V2` for BA-700 capital adequacy;
  `computeBA320V2` for BA-320 FX market risk) into a faithful presentation view;
  when OFF (default) the V1 BA-return generators stay authoritative. Functional
  currency is sourced from the entity tree (no hardcoded ZAR) and passed
  explicitly into every generator; the BA-320 FX rate resolves from the same
  `MarketDataStore` production fx-quote source the V2 projection and parity gate
  read, fail-closed (charge stays `null`, never fabricated) on a missing rate.
  Backed by `recon:ba700-v2-parity` / `recon:ba320-fx-v2-parity`. This is the
  route boundary only — `useV2Store` stays OFF by default; flipping it ON is the
  SEPARATE authoritative cutover.

The remaining one route is an honest gap:

- **#6 (capital metrics):** the V2 BA-700 projection exists but is structurally
  no-data at Phase 3e (no capital-GL posting rules) and shape-incompatible with
  the capital tile.

This is tracked here and in the advisory recon as an honest gap, to be wired in a
subsequent slice as the missing capital-GL posting rules / `CapitalMetrics`-shaped
V2 adapter land.
The gate stays **advisory** until all eight routes are wired, keeping the cutover
reversible: V1 stays authoritative and the flag is OFF by default.

## Deferred posting-rule coverage (WS-V2-AUTHORITATIVE S5)

S5 also asked for V2 GL posting-rule expansion for any instrument family with a
V2 lifecycle event source but no V2 GL handler. Audit result: **none remain
buildable.** The families with V2-parallel lifecycle events all already have V2
GL handlers — FX (`gl-posting-engine-v2.ts`), money-market deposit/funding/repo/
IBL (`gl-posting-engine-v2-mm.ts`), and bond (`gl-posting-engine-v2-bond.ts`).
The two V1 posting-rule families still lacking V2 coverage are blocked on a
**missing V2 event source**, not a missing handler:

- **Equity (`PR-EQ-001/002/004/CA/INSTRUCT`):** the equity lifecycle events
  (`EquityTradeExecuted`, `EquityDividendAccrued`, `EquitySold`) have **no
  `…V2` parallel** in `event-store/event-types/` and are not in the V2 registry.
  A V2 equity GL handler would have nothing to read. **Deferred** until an equity
  V2 lifecycle event family lands (Charter cmd 5 — surfaced, not fabricated).
- **IRS / interest-rate-derivative (`PR-IRS-001/002/003/INSTRUCT/SCHED/TERM`):**
  the `IrdSwap*` events (`IrdSwapTradeExecuted`, `IrdSwapCouponSettled`,
  `IrdSwapPositionRevalued`, `IrdSwapTerminated`) likewise have **no `…V2`
  parallel**. **Deferred** for the same reason.

Fabricating a V2 handler with no V2 event source would be a silent gap dressed as
coverage; the honest move is to record the dependency here and in the
`recon:gl-v2-parity` advisory (V1-only accounts for equity/IRS will keep showing
as expected warns until those V2 event families exist).
