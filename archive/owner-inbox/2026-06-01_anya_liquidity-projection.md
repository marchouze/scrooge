---
agent: Anya
trigger: liquidity-projection
asOf: 2026-06-01T05:03:16.566Z
decision-required: false
---

# Anya — Liquidity projection, 2026-06-01

Daily LCR / NSFR projection — BA 325 / BA 326 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 10,000,000 | 27,000,000 | 37.0% | below-minimum |
| T+30 | 10,000,000 | 27,000,000 | 37.0% | below-minimum |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 300,000,000 | 3,300,000 | 9090.9% | above-minimum |
| T+30 | 300,000,000 | 3,300,000 | 9090.9% | above-minimum |

## ALM position substrate

Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (`platform/projections/alm-positions.ts`). Build-phase posture:

- **T+0:** 1 HQLA, 4 funding, 2 ASF, 3 RSF; 1 substrate gap(s).
- **T+30:** 1 HQLA, 4 funding, 2 ASF, 3 RSF; 1 substrate gap(s).

**Substrate gaps named by the projection:**

- SettlementInstructionIssued: 0 settlement instructions within 0-day horizon (event class defined; no instructions issued yet).

**Events emitted:** 5
**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 325; BA 326
