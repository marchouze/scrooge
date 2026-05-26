---
agent: Anya
trigger: liquidity-projection
asOf: 2026-05-26T11:03:04.546Z
decision-required: false
---

# Anya — Liquidity projection, 2026-05-26

Daily LCR / NSFR projection — BA 325 / BA 326 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 10,000,000 | 1,250,000 | 800.0% | above-minimum |
| T+30 | 10,000,000 | 1,250,000 | 800.0% | above-minimum |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 300,000,000 | 3,300,000 | 9090.9% | above-minimum |
| T+30 | 300,000,000 | 3,300,000 | 9090.9% | above-minimum |

## ALM position substrate

Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (`platform/projections/alm-positions.ts`). Build-phase posture:

- **T+0:** 1 HQLA, 3 funding, 2 ASF, 3 RSF; 4 substrate gap(s).
- **T+30:** 1 HQLA, 3 funding, 2 ASF, 3 RSF; 4 substrate gap(s).

**Substrate gaps named by the projection:**

- CollateralInventorySnapshotted: not yet emitted (Tomas + Atlas substrate). HQLA derived from TradeBooked/TradeSettled events via collateral inventory projection; 1 position(s) found.
- SettlementInstructionIssued: not yet emitted (Ravi + Atlas substrate). Contractual settlement outflows over the 0-day horizon not yet queryable.
- FundingLineDrawn: not yet emitted (Ravi + Atlas substrate). Drawn funding-line balances not yet queryable.
- BalanceSheetProjected: partially wired via CapitalEvent + DepositTaken + InterbankLoanPlaced; BalanceSheetProjected event pending for complete BA 326 scope (Bea + Ravi substrate).

**Events emitted:** 4
**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 325; BA 326
