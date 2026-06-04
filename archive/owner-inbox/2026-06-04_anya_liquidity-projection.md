---
agent: Anya
trigger: liquidity-projection
asOf: 2026-06-04T03:26:21.004Z
decision-required: false
---

# Anya — Liquidity projection, 2026-06-04

Daily LCR / NSFR projection — BA 325 / BA 326 calibration, ZAR, 30-day stress horizon.

## LCR (Liquidity Coverage Ratio)

| Horizon | HQLA (ZAR) | Net Outflows (ZAR) | LCR Ratio | Status |
|---|---|---|---|---|
| T+0 | 50,043,950 | 10,000,000 | 500.4% | above-minimum |
| T+30 | 50,043,950 | 10,000,000 | 500.4% | above-minimum |

## NSFR (Net Stable Funding Ratio)

| Horizon | ASF (ZAR) | RSF (ZAR) | NSFR Ratio | Status |
|---|---|---|---|---|
| T+0 | 300,000,000 | 5,302,197.5 | 5658.0% | above-minimum |
| T+30 | 300,000,000 | 5,302,197.5 | 5658.0% | above-minimum |

## ALM position substrate

Inputs sourced via Ravi (Treasury and ALM engineer, engineering)'s ALM-positions projection (`platform/projections/alm-positions.ts`). Build-phase posture:

- **T+0:** 2 HQLA, 1 funding, 3 ASF, 4 RSF; 1 substrate gap(s).
- **T+30:** 2 HQLA, 1 funding, 3 ASF, 4 RSF; 1 substrate gap(s).

**Substrate gaps named by the projection:**

- SettlementInstructionIssued: 0 settlement instructions within 0-day horizon (event class defined; no instructions issued yet).

**Events emitted:** 4
**Authority:** D-TREASURY-GAPS-WAVE1; D-RAS; BA 325; BA 326
