---
agent: Anya
trigger: liquidity-projection
asOf: 2026-05-28T05:58:02.666Z
decision-required: false
---

# Anya — Liquidity projection, 2026-05-28

Daily LCR / NSFR projection — BA 325 / BA 326 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 0 | 27,000,000 | 0.0% | below-minimum |
| T+30 | 0 | 27,000,000 | 0.0% | below-minimum |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 300,000,000 | 2,800,000 | 10714.3% | above-minimum |
| T+30 | 300,000,000 | 2,800,000 | 10714.3% | above-minimum |

## ALM position substrate

Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (`platform/projections/alm-positions.ts`). Build-phase posture:

- **T+0:** 0 HQLA, 4 funding, 2 ASF, 2 RSF; 1 substrate gap(s).
- **T+30:** 0 HQLA, 4 funding, 2 ASF, 2 RSF; 1 substrate gap(s).

**Substrate gaps named by the projection:**

- SettlementInstructionIssued: 0 settlement instructions within 0-day horizon (event class defined; no instructions issued yet).

**Events emitted:** 5
**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 325; BA 326
