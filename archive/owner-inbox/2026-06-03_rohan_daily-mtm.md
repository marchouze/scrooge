---
agent: Rohan
trigger: daily-mtm
asOf: 2026-06-03T18:36:54.783Z
decision-required: false
---

# Rohan — daily MTM run, 2026-06-03

Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.

**Headline:** 7 live · 0 stale-mark · 0 unvalued · net unrealised P&L delta ZAR -1 093 148,81 · runId `af0583f7-789e-445a-b0de-9578ab987b09`.

## Position detail

| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |
|---|---|---|---:|---:|---:|---|
| `MAN-1780383855491-AD0AC00F` | CHF/ZAR | revalued | 20.7602 | 20.6046 | -681 368,74 | twelve-data |
| `MAN-1780383859388-48E058D4` | GBP/USD | revalued | 1.3485 | 1.3430 | -314 033,59 | twelve-data |
| `MAN-1780392888750-1FEF29C2` | USD/ZAR | revalued | 16.2849 | 16.2882 | 3 696,29 | twelve-data |
| `MAN-1780392892539-EB2F38EE` | GBP/ZAR | revalued | 21.8932 | 21.8747 | 59 843,93 | twelve-data |
| `MAN-1780482888449-E73C1DDC` | USD/ZAR | revalued | 16.3884 | 16.2882 | -108 836,60 | twelve-data |
| `MAN-1780482892721-AC6C1F65` | GBP/ZAR | revalued | 21.7436 | 21.8747 | -52 450,10 | twelve-data |

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
