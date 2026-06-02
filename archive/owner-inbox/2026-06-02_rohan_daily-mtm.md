---
agent: Rohan
trigger: daily-mtm
asOf: 2026-06-02T18:00:42.665Z
decision-required: false
---

# Rohan — daily MTM run, 2026-06-02

Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.

**Headline:** 8 live · 0 stale-mark · 1 unvalued · net unrealised P&L delta ZAR -192 345,44 · runId `7408d0b0-26f2-4fee-893a-e8ac3668f753`.

## Position detail

| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |
|---|---|---|---:|---:|---:|---|
| `MAN-1780339400928-5FF25D29` | GBP/USD | revalued | 1.3395 | 1.3464 | -65 244,19 | twelve-data |
| `MAN-1780339406659-1DD1E84A` | CHF/ZAR | revalued | 20.8890 | 20.6441 | 914 154,83 | twelve-data |
| `MAN-1780339414533-8557A772` | JPY/ZAR | revalued | 0.1021 | 0.1016 | 3 047,83 | twelve-data |
| `MAN-1780339421634-E505655B` | CHF/ZAR | revalued | 20.7948 | 20.6441 | -402 777,03 | twelve-data |
| `MAN-1780383855491-AD0AC00F` | CHF/ZAR | revalued | 20.7602 | 20.6441 | -508 554,50 | twelve-data |
| `MAN-1780383859388-48E058D4` | GBP/USD | revalued | 1.3485 | 1.3464 | -115 905,17 | twelve-data |
| `MAN-1780392888750-1FEF29C2` | USD/ZAR | revalued | 16.2849 | 16.2567 | -32 080,42 | twelve-data |
| `MAN-1780392892539-EB2F38EE` | GBP/ZAR | revalued | 21.8932 | 21.8886 | 15 013,21 | twelve-data |

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
