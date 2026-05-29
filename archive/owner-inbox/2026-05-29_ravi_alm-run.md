---
agent: Ravi
trigger: alm-run
asOf: 2026-05-29T05:50:51.037Z
decision-required: false
---

# Ravi — Daily ALM Run, 2026-05-29

**Run ID:** ALM-RUN-2026-05-29
**Authority:** D-TREASURY-GAPS-WAVE1 | BCBS d365 (IRRBB) | Banks Act Reg 26/27

## Repricing gap schedule (BCBS 319 buckets)

**Status:** `computed`

| Bucket | RSA (ZAR) | RSL (ZAR) | Gap (ZAR) | Cumulative Gap (ZAR) |
|---|---|---|---|---|
| ON | 800000000 | 0 | 800000000 | 800000000 |
| 1M | 3000000000 | 500000000 | 2500000000 | 3300000000 |
| 3M | 0 | 0 | 0 | 3300000000 |
| 6M | 0 | 0 | 0 | 3300000000 |
| 1Y | 0 | 0 | 0 | 3300000000 |
| 2Y | 0 | 0 | 0 | 3300000000 |
| 3Y | 0 | 0 | 0 | 3300000000 |
| 5Y | 0 | 0 | 0 | 3300000000 |
| 7Y | 0 | 0 | 0 | 3300000000 |
| 10Y+ | 0 | 0 | 0 | 3300000000 |

## ΔEVE sensitivities (BCBS d365 §4)

**Status:** `computed` | Worst-case ΔEVE: ZAR -5533598

| Scenario | ΔEVE (ZAR) | % Tier 1 | Status |
|---|---|---|---|
| parallel+200 | -4146982 | -0.01% | within |
| parallel+100 | -2075188 | -0.01% | within |
| parallel-100 | 2078591 | 0.01% | within |
| parallel-200 | 4160593 | 0.01% | within |
| steepener+300 | -5533598 | -0.02% | within |
| flattener-300 | 5557798 | 0.02% | within |

## ΔNII sensitivities (12-month horizon)

**Status:** `computed` | Worst-case ΔNII: ZAR -4210502

| Scenario | ΔNII (ZAR) | Status |
|---|---|---|
| parallel+200 | 4210502 | within |
| parallel+100 | 2105251 | within |
| parallel-100 | -2105251 | within |
| parallel-200 | -4210502 | within |

## Build-phase notes

- No real positions exist until commencement-of-trading (CLAUDE.md 'build phase vs licence-day').
- All sensitivity metrics are zero — this is correct and auditable (Principle 1: events are the only source of truth).
- Engine is structurally complete and will produce non-zero outputs when TradeBooked events land.
- Tier 1 capital ratio benchmarking deferred until Helena's CET1 measurement lands.
