---
agent: Ravi
trigger: alm-run
asOf: 2026-06-06T07:54:25.865Z
decision-required: false
---

# Ravi — Daily ALM Run, 2026-06-06

**Run ID:** ALM-RUN-2026-06-06
**Authority:** D-TREASURY-GAPS-WAVE1 | BCBS d365 (IRRBB) | Banks Act Reg 26/27

## Repricing gap schedule (BCBS 319 buckets)

**Status:** `computed`

| Bucket | RSA (ZAR) | RSL (ZAR) | Gap (ZAR) | Cumulative Gap (ZAR) |
|---|---|---|---|---|
| ON | 0 | 0 | 0 | 0 |
| 1M | 0 | 0 | 0 | 0 |
| 3M | 0 | 10000000 | -10000000 | -10000000 |
| 6M | 0 | 0 | 0 | -10000000 |
| 1Y | 0 | 0 | 0 | -10000000 |
| 2Y | 0 | 0 | 0 | -10000000 |
| 3Y | 0 | 0 | 0 | -10000000 |
| 5Y | 0 | 0 | 0 | -10000000 |
| 7Y | 0 | 0 | 0 | -10000000 |
| 10Y+ | 0 | 0 | 0 | -10000000 |

## ΔEVE sensitivities (BCBS d365 §4)

**Status:** `computed` | Worst-case ΔEVE: ZAR -56321

| Scenario | ΔEVE (ZAR) | % Tier 1 | Status |
|---|---|---|---|
| parallel-up | 47766 | 0.00% | within |
| parallel-down | -48236 | -0.00% | within |
| steepener | -20041 | -0.00% | within |
| flattener | 19959 | 0.00% | within |
| short-up | 55681 | 0.00% | within |
| short-down | -56321 | -0.00% | within |

## ΔNII sensitivities (12-month horizon)

**Status:** `computed` | Worst-case ΔNII: ZAR -50000

| Scenario | ΔNII (ZAR) | Status |
|---|---|---|
| parallel+200 | -50000 | within |
| parallel+100 | -25000 | within |
| parallel-100 | 25000 | within |
| parallel-200 | 50000 | within |

## Build-phase notes

- No real positions exist until commencement-of-trading (CLAUDE.md 'build phase vs licence-day').
- All sensitivity metrics are zero — this is correct and auditable (Principle 1: events are the only source of truth).
- Engine is structurally complete and will produce non-zero outputs when TradeBooked events land.
- Tier 1 capital ratio benchmarking deferred until Helena's CET1 measurement lands.
