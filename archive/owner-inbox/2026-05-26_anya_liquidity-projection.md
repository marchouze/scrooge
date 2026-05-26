---
agent: Anya
trigger: liquidity-projection
asOf: 2026-05-26T08:23:22.687Z
decision-required: false
---

# Anya — Liquidity projection, 2026-05-26

Daily LCR / NSFR projection — BA 325 / BA 326 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 20,000,000 | 2,500,000 | 800.0% | above-minimum |
| T+30 | 20,000,000 | 2,500,000 | 800.0% | above-minimum |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 300,000,000 | 6,600,000 | 4545.5% | above-minimum |
| T+30 | 300,000,000 | 6,600,000 | 4545.5% | above-minimum |

## ALM position substrate

Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (`platform/projections/alm-positions.ts`). Build-phase posture:

- **T+0:** 2 HQLA, 6 funding, 3 ASF, 6 RSF; 4 substrate gap(s).
- **T+30:** 2 HQLA, 6 funding, 3 ASF, 6 RSF; 4 substrate gap(s).

**Substrate gaps named by the projection:**

- CollateralInventorySnapshotted: not yet emitted (Tomas + Atlas substrate). HQLA derived from TradeBooked/TradeSettled events via collateral inventory projection; 2 position(s) found.
- SettlementInstructionIssued: not yet emitted (Ravi + Atlas substrate). Contractual settlement outflows over the 0-day horizon not yet queryable.
- FundingLineDrawn: not yet emitted (Ravi + Atlas substrate). Drawn funding-line balances not yet queryable.
- BalanceSheetProjected: partially wired via CapitalEvent + DepositTaken + InterbankLoanPlaced; BalanceSheetProjected event pending for complete BA 326 scope (Bea + Ravi substrate).

**Events emitted:** 4
**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 325; BA 326
