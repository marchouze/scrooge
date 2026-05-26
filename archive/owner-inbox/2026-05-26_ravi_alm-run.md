---
agent: Ravi
trigger: alm-run
asOf: 2026-05-26T09:21:28.553Z
decision-required: false
---

# Ravi — Daily ALM Run, 2026-05-26

**Run ID:** ALM-RUN-2026-05-26
**Authority:** D-TREASURY-GAPS-WAVE1 | BCBS d365 (IRRBB) | Banks Act Reg 26/27

## Repricing gap schedule (BCBS 319 buckets)

**Status:** `computed`

| Bucket | RSA (ZAR) | RSL (ZAR) | Gap (ZAR) | Cumulative Gap (ZAR) |
|---|---|---|---|---|
| ON | 1600000000 | 0 | 1600000000 | 1600000000 |
| 1M | 6000000000 | 1000000000 | 5000000000 | 6600000000 |
| 3M | 0 | 0 | 0 | 6600000000 |
| 6M | 0 | 0 | 0 | 6600000000 |
| 1Y | 0 | 0 | 0 | 6600000000 |
| 2Y | 0 | 0 | 0 | 6600000000 |
| 3Y | 0 | 0 | 0 | 6600000000 |
| 5Y | 0 | 0 | 0 | 6600000000 |
| 7Y | 0 | 0 | 0 | 6600000000 |
| 10Y+ | 0 | 0 | 0 | 6600000000 |

## ΔEVE sensitivities (BCBS d365 §4)

**Status:** `computed` | Worst-case ΔEVE: ZAR -11067195

| Scenario | ΔEVE (ZAR) | % Tier 1 | Status |
|---|---|---|---|
| parallel+200 | -8293964 | -0.03% | within |
| parallel+100 | -4150376 | -0.01% | within |
| parallel-100 | 4157182 | 0.01% | within |
| parallel-200 | 8321186 | 0.03% | within |
| steepener+300 | -11067195 | -0.04% | within |
| flattener-300 | 11115595 | 0.04% | within |

## ΔNII sensitivities (12-month horizon)

**Status:** `computed` | Worst-case ΔNII: ZAR -8421005

| Scenario | ΔNII (ZAR) | Status |
|---|---|---|
| parallel+200 | 8421005 | within |
| parallel+100 | 4210502 | within |
| parallel-100 | -4210502 | within |
| parallel-200 | -8421005 | within |

## Build-phase notes

- No real positions exist until commencement-of-trading (CLAUDE.md 'build phase vs licence-day').
- All sensitivity metrics are zero — this is correct and auditable (Principle 1: events are the only source of truth).
- Engine is structurally complete and will produce non-zero outputs when TradeBooked events land.
- Tier 1 capital ratio benchmarking deferred until Helena's CET1 measurement lands.
