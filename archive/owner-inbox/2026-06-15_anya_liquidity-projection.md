---
agent: Anya
trigger: liquidity-projection
asOf: 2026-06-15T05:02:43.427Z
decision-required: false
---

# Anya — Liquidity projection, 2026-06-15

Daily LCR / NSFR projection — BA 110 / BA 120 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 0 | 0 | ∞ | no-positions |
| T+30 | 0 | 0 | ∞ | no-positions |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 300,000,000 | 0 | ∞ | above-minimum |
| T+30 | 300,000,000 | 0 | ∞ | above-minimum |

## ALM position substrate

Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (`platform/projections/alm-positions.ts`). Build-phase posture:

- **T+0:** 0 HQLA, 0 funding, 1 ASF, 0 RSF; 3 substrate gap(s).
- **T+30:** 0 HQLA, 0 funding, 1 ASF, 0 RSF; 3 substrate gap(s).

**Substrate gaps named by the projection:**

- DepositTaken: not yet emitted (Ravi + Atlas substrate). Retail / wholesale deposit classification per BA 110 §19 not yet queryable.
- SettlementInstructionIssued: 0 settlement instructions within 0-day horizon (event class defined; no instructions issued yet).
- FundingLineDrawn: not yet emitted (Ravi + Atlas substrate). Drawn funding-line balances not yet queryable.

**Events emitted:** 4
**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 110; BA 120
