---
agent: Rohan
trigger: daily-mtm
asOf: 2026-06-11T18:00:47.445Z
decision-required: false
---

# Rohan — daily MTM run, 2026-06-11

Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.

**Headline:** 135 live · 0 stale-mark · 42 unvalued · net unrealised P&L delta ZAR 1 039 458,18 · runId `dd728679-c4f4-4a4d-bb94-545e5b48f79f`.

## Position detail

| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |
|---|---|---|---:|---:|---:|---|
| `MAN-1781087049881-FCD4BD29` | EUR/ZAR | revalued | 19.0090 | 18.8844 | 568 980,06 | twelve-data |
| `MAN-1781087058673-B4E39655` | EUR/ZAR | revalued | 19.0568 | 18.8844 | -538 827,56 | twelve-data |
| `MAN-1781087064164-FCE4DB61` | EUR/USD | revalued | 1.1442 | 1.1564 | 821 912,10 | twelve-data |
| `MAN-1781087067876-E153BD24` | CHF/ZAR | revalued | 20.5740 | 20.5127 | 187 393,58 | twelve-data |

## Skip reasons

- equity MTM: no JSE equity feed connected — skipped

## Substrate gaps

- **Production FX feed** — Reuters WM-Fix or Bloomberg BFIX ingest not yet wired. While absent, every open position falls back to stale-mark carry-forward and the daily SubstrateAlert (`alert:integrity:mtm-stale-mark-<date>`) fires. Recommended brief: `WS-MTM-PROD-FX-FEED`.
- **JSE bond price feed** — bond MTM is blocked on the JSE EOD bond-price ingest. Recommended brief: `WS-MTM-JSE-BOND-FEED`.
- **JIBAR / swap curve ingest** — IRD MTM is blocked on JIBAR + ZAR-OIS curve ingest. Recommended brief: `WS-MTM-JIBAR-CURVE-INGEST`.
- **JSE equity feed** — equity MTM is blocked on the JSE EOD equity-price ingest. Recommended brief: `WS-MTM-JSE-EQUITY-FEED`.

## Provenance

Open FX positions resolved by replaying `FxTradeExecuted` minus `FxTradeCancelled` minus `SettlementConfirmed`/`TradeMatured` from the composition-root event store. Marks elected via `MarketDataStore.query({provenance:"production"})` (latest tick per pair); stale-mark fallback reads the most-recent prior `FxPositionRevalued` for the position. `OfficialMarkAdopted` emitted via `adoptFxMark` per D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1. Recon gate: `recon:mtm-reversal-paired-with-reval` asserts per-position-day reversal/revaluation pairing.
