---
agent: Anya
trigger: liquidity-projection
asOf: 2026-06-11T02:28:58.327Z
decision-required: false
---

# Anya — Liquidity projection, 2026-06-11

Daily LCR / NSFR projection — BA 110 / BA 120 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 2,247,559,845.178 | 10,000,000 | 22475.6% | above-minimum |
| T+30 | 2,247,559,845.178 | 10,000,000 | 22475.6% | above-minimum |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 300,000,000 | 115,177,992.259 | 260.5% | above-minimum |
| T+30 | 300,000,000 | 115,177,992.259 | 260.5% | above-minimum |

## ALM position substrate

Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (`platform/projections/alm-positions.ts`). Build-phase posture:

- **T+0:** 81 HQLA, 1 funding, 3 ASF, 83 RSF; 1 substrate gap(s).
- **T+30:** 81 HQLA, 1 funding, 3 ASF, 83 RSF; 1 substrate gap(s).

**Substrate gaps named by the projection:**

- SettlementInstructionIssued: 0 settlement instructions within 0-day horizon (event class defined; no instructions issued yet).

**Events emitted:** 4
**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 110; BA 120
