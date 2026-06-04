---
agent: Rohan
trigger: daily-mtm
asOf: 2026-06-04T18:55:50.792Z
decision-required: false
---

# Rohan — daily MTM run, 2026-06-04

Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.

**Headline:** 5 live · 0 stale-mark · 0 unvalued · net unrealised P&L delta ZAR 85 796,01 · runId `d72a3791-8b54-4d6c-b45c-117bada1d458`.

## Position detail

| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |
|---|---|---|---:|---:|---:|---|
| `MAN-1780482888449-E73C1DDC` | USD/ZAR | revalued | 16.3884 | 16.2939 | -102 582,36 | twelve-data |
| `MAN-1780482892721-AC6C1F65` | GBP/ZAR | revalued | 21.7436 | 21.8865 | -57 162,08 | twelve-data |
| `MAN-1780573873375-908ED802` | JPY/ZAR | revalued | 0.1018 | 0.1018 | 124,39 | twelve-data |
| `MAN-1780573879123-0400AC64` | GBP/USD | revalued | 1.3492 | 1.3432 | 245 416,06 | twelve-data |

## Skip reasons

- bond MTM: no JSE price feed connected — skipped
- equity MTM: no JSE equity feed connected — skipped

## Substrate gaps

- **Production FX feed** — Reuters WM-Fix or Bloomberg BFIX ingest not yet wired. While absent, every open position falls back to stale-mark carry-forward and the daily SubstrateAlert (`alert:integrity:mtm-stale-mark-<date>`) fires. Recommended brief: `WS-MTM-PROD-FX-FEED`.
- **JSE bond price feed** — bond MTM is blocked on the JSE EOD bond-price ingest. Recommended brief: `WS-MTM-JSE-BOND-FEED`.
- **JIBAR / swap curve ingest** — IRD MTM is blocked on JIBAR + ZAR-OIS curve ingest. Recommended brief: `WS-MTM-JIBAR-CURVE-INGEST`.
- **JSE equity feed** — equity MTM is blocked on the JSE EOD equity-price ingest. Recommended brief: `WS-MTM-JSE-EQUITY-FEED`.

## Provenance

Open FX positions resolved by replaying `FxTradeExecuted` minus `FxTradeCancelled` minus `SettlementConfirmed`/`TradeMatured` from the composition-root event store. Marks elected via `MarketDataStore.query({provenance:"production"})` (latest tick per pair); stale-mark fallback reads the most-recent prior `FxPositionRevalued` for the position. `OfficialMarkAdopted` emitted via `adoptFxMark` per D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1. Recon gate: `recon:mtm-reversal-paired-with-reval` asserts per-position-day reversal/revaluation pairing.
