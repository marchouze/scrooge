---
agent: Ravi
trigger: alm-run
asOf: 2026-06-02T05:50:44.991Z
decision-required: false
---

# Ravi — Daily ALM Run, 2026-06-02

**Run ID:** ALM-RUN-2026-06-02
**Authority:** D-TREASURY-GAPS-WAVE1 | BCBS d365 (IRRBB) | Banks Act Reg 26/27

## Repricing gap schedule (BCBS 319 buckets)

**Status:** `zero-positions`

| Bucket | RSA (ZAR) | RSL (ZAR) | Gap (ZAR) | Cumulative Gap (ZAR) |
|---|---|---|---|---|
| ON | 0 | 0 | 0 | 0 |
| 1M | 0 | 0 | 0 | 0 |
| 3M | 0 | 0 | 0 | 0 |
| 6M | 0 | 0 | 0 | 0 |
| 1Y | 0 | 0 | 0 | 0 |
| 2Y | 0 | 0 | 0 | 0 |
| 3Y | 0 | 0 | 0 | 0 |
| 5Y | 0 | 0 | 0 | 0 |
| 7Y | 0 | 0 | 0 | 0 |
| 10Y+ | 0 | 0 | 0 | 0 |

## ΔEVE sensitivities (BCBS d365 §4)

**Status:** `zero-positions` | Worst-case ΔEVE: ZAR 0

| Scenario | ΔEVE (ZAR) | % Tier 1 | Status |
|---|---|---|---|
| parallel-up | 0 | 0.00% | within |
| parallel-down | 0 | 0.00% | within |
| steepener | 0 | 0.00% | within |
| flattener | 0 | 0.00% | within |
| short-up | 0 | 0.00% | within |
| short-down | 0 | 0.00% | within |

## ΔNII sensitivities (12-month horizon)

**Status:** `zero-positions` | Worst-case ΔNII: ZAR 0

| Scenario | ΔNII (ZAR) | Status |
|---|---|---|
| parallel+200 | 0 | within |
| parallel+100 | 0 | within |
| parallel-100 | 0 | within |
| parallel-200 | 0 | within |

## Build-phase notes

- No real positions exist until commencement-of-trading (CLAUDE.md 'build phase vs licence-day').
- All sensitivity metrics are zero — this is correct and auditable (Principle 1: events are the only source of truth).
- Engine is structurally complete and will produce non-zero outputs when TradeBooked events land.
- Tier 1 capital ratio benchmarking deferred until Helena's CET1 measurement lands.
