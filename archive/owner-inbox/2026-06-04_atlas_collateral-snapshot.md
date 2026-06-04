---
agent: Atlas
trigger: collateral-snapshot
asOf: 2026-06-04T06:30:03.662Z
decision-required: false
---

# Atlas — Collateral inventory snapshot, 2026-06-04

Daily HQLA collateral inventory snapshot — BA 325 Annex 1 classification, 2026-06-04.

## HQLA buffer summary

| Bucket | Haircut-adjusted ZAR | % of total HQLA |
|---|---|---|
| L1 (0% haircut) | 0 | — |
| L2a (15% haircut) | 0 | — |
| L2b (25–50% haircut) | 0 | — |
| **Total HQLA buffer** | **0** | 100% |

## BA 325 cap checks

- **L2 cap (max 40% of HQLA):** OK
- **L2b cap (max 15% of HQLA):** OK

**Build phase:** zero security positions in the event store (expected). Buffer will populate once trade-booking events flow at licence-day.

## Substrate gaps

- Live trade-booking events not yet flowing (build phase). HQLA buffer will populate at licence-day once TradeBooked/TradeSettled events start arriving.
- Market-value revaluation (daily repricing) deferred to Ravi's market-data connector (vendor-selection phase).

**Events emitted:** 1
