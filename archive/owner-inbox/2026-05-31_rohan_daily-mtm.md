---
agent: Rohan
trigger: daily-mtm
asOf: 2026-05-31T08:10:15.541Z
decision-required: false
---

# Rohan — daily MTM run, 2026-05-31

Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.

**Headline:** 9 live · 0 stale-mark · 0 unvalued · net unrealised P&L delta ZAR -134 312 027,28 · runId `1e502d71-db71-4a04-ba0a-eb151d81efc2`.

## Position detail

| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |
|---|---|---|---:|---:|---:|---|
| `MAN-1780125752357-9C453CFE` | EUR/USD | revalued | 1.0801 | 1.1659 | -373 153,31 | twelve-data |
| `MAN-1780126252413-834BD51A` | GBP/ZAR | revalued | 22.1309 | 21.8637 | 845 238,65 | twelve-data |
| `MAN-1780128914273-DAEFE6FA` | GBP/ZAR | revalued | 21.8465 | 21.8637 | 465 961,60 | twelve-data |
| `MAN-1780129423980-93B4BAED` | GBP/ZAR | revalued | 21.8521 | 21.8637 | -48 757,69 | twelve-data |
| `MAN-1780133153752-974CD512` | GBP/ZAR | revalued | 21.8677 | 21.8637 | 1 950,94 | twelve-data |
| `MAN-1780133782238-76EE0F3F` | USD/ZAR | revalued | 18.5000 | 16.2472 | -416 773,55 | twelve-data |
| `MAN-1780135453249-6AE44354` | USD/ZAR | revalued | 18.5000 | 16.2472 | -416 773,55 | twelve-data |
| `MAN-1780136862743-A7951042` | EUR/ZAR | revalued | 19.9988 | 18.9428 | -113 851 748,83 | twelve-data |
| `MAN-1780137034664-E5339EA6` | EUR/ZAR | revalued | 19.9993 | 18.9428 | -20 517 971,54 | twelve-data |

## Skip reasons

- bond MTM: no JSE price feed connected — skipped
- equity MTM: no JSE equity feed connected — skipped
- IRD MTM: no curve ingest connected — skipped

## Substrate gaps

- **Production FX feed** — Reuters WM-Fix or Bloomberg BFIX ingest not yet wired. While absent, every open position falls back to stale-mark carry-forward and the daily SubstrateAlert (`alert:integrity:mtm-stale-mark-<date>`) fires. Recommended brief: `WS-MTM-PROD-FX-FEED`.
- **JSE bond price feed** — bond MTM is blocked on the JSE EOD bond-price ingest. Recommended brief: `WS-MTM-JSE-BOND-FEED`.
- **JIBAR / swap curve ingest** — IRD MTM is blocked on JIBAR + ZAR-OIS curve ingest. Recommended brief: `WS-MTM-JIBAR-CURVE-INGEST`.
- **JSE equity feed** — equity MTM is blocked on the JSE EOD equity-price ingest. Recommended brief: `WS-MTM-JSE-EQUITY-FEED`.

## Provenance

Open FX positions resolved by replaying `FxTradeExecuted` minus `FxTradeCancelled` minus `SettlementConfirmed`/`TradeMatured` from the composition-root event store. Marks elected via `MarketDataStore.query({provenance:"production"})` (latest tick per pair); stale-mark fallback reads the most-recent prior `FxPositionRevalued` for the position. `OfficialMarkAdopted` emitted via `adoptFxMark` per D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1. Recon gate: `recon:mtm-reversal-paired-with-reval` asserts per-position-day reversal/revaluation pairing.
