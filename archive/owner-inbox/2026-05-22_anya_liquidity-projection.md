---
agent: Anya
trigger: liquidity-projection
asOf: 2026-05-22T04:45:49.555Z
decision-required: false
---

# Anya — Liquidity projection, 2026-05-22

Daily LCR / NSFR projection — BA 325 / BA 326 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 0 | 0 | ∞ | no-positions |
| T+30 | 0 | 0 | ∞ | no-positions |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 0 | 0 | ∞ | no-positions |
| T+30 | 0 | 0 | ∞ | no-positions |

## ALM position substrate

Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (`platform/projections/alm-positions.ts`). Build-phase posture:

- **T+0:** 0 HQLA, 0 funding, 0 ASF, 0 RSF; 5 substrate gap(s).
- **T+30:** 0 HQLA, 0 funding, 0 ASF, 0 RSF; 5 substrate gap(s).

**Substrate gaps named by the projection:**

- CollateralInventorySnapshotted: not yet emitted (Tomas + Atlas substrate). HQLA derived from TradeBooked/TradeSettled events via collateral inventory projection; 0 position(s) found.
- DepositTaken: not yet emitted (Ravi + Atlas substrate). Retail / wholesale deposit classification per BA 325 §19 not yet queryable.
- SettlementInstructionIssued: not yet emitted (Ravi + Atlas substrate). Contractual settlement outflows over the 0-day horizon not yet queryable.
- FundingLineDrawn: not yet emitted (Ravi + Atlas substrate). Drawn funding-line balances not yet queryable.
- BalanceSheetProjected: not yet emitted (Bea + Ravi substrate). ASF/RSF derivation per BA 326 / BCBS D295 requires a balance-sheet projection; not yet queryable.

**Events emitted:** 4
**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 325; BA 326
