---
agent: Rohan
trigger: daily-mtm
asOf: 2026-06-08T18:12:08.031Z
decision-required: false
---

# Rohan — daily MTM run, 2026-06-08

Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.

**Headline:** 137 live · 0 stale-mark · 42 unvalued · net unrealised P&L delta ZAR 957 521,11 · runId `58f0e246-d0bd-4f36-915b-fe39465e6e18`.

## Position detail

| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |
|---|---|---|---:|---:|---:|---|
| `MAN-1780812418544-4086647F` | GBP/USD | revalued | 1.3226 | 1.3353 | 79 562,32 | twelve-data |
| `MAN-1780818357378-939873CE` | EUR/ZAR | revalued | 19.2766 | 19.0393 | 578 274,69 | twelve-data |
| `MAN-1780818364400-62582BF3` | JPY/ZAR | revalued | 0.1029 | 0.1031 | -819,49 | twelve-data |
| `MAN-1780906753642-B64042CF` | EUR/ZAR | revalued | 19.1721 | 19.0393 | 383 688,47 | twelve-data |
| `MAN-1780906760129-39952F85` | EUR/ZAR | revalued | 19.1628 | 19.0393 | -348 136,91 | twelve-data |
| `MAN-1780906767273-AD353A98` | GBP/USD | revalued | 1.3452 | 1.3353 | 264 952,03 | twelve-data |

## Skip reasons

- equity MTM: no JSE equity feed connected — skipped

## Substrate gaps

- **Production FX feed** — Reuters WM-Fix or Bloomberg BFIX ingest not yet wired. While absent, every open position falls back to stale-mark carry-forward and the daily SubstrateAlert (`alert:integrity:mtm-stale-mark-<date>`) fires. Recommended brief: `WS-MTM-PROD-FX-FEED`.
- **JSE bond price feed** — bond MTM is blocked on the JSE EOD bond-price ingest. Recommended brief: `WS-MTM-JSE-BOND-FEED`.
- **JIBAR / swap curve ingest** — IRD MTM is blocked on JIBAR + ZAR-OIS curve ingest. Recommended brief: `WS-MTM-JIBAR-CURVE-INGEST`.
- **JSE equity feed** — equity MTM is blocked on the JSE EOD equity-price ingest. Recommended brief: `WS-MTM-JSE-EQUITY-FEED`.

## Provenance

Open FX positions resolved by replaying `FxTradeExecuted` minus `FxTradeCancelled` minus `SettlementConfirmed`/`TradeMatured` from the composition-root event store. Marks elected via `MarketDataStore.query({provenance:"production"})` (latest tick per pair); stale-mark fallback reads the most-recent prior `FxPositionRevalued` for the position. `OfficialMarkAdopted` emitted via `adoptFxMark` per D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1. Recon gate: `recon:mtm-reversal-paired-with-reval` asserts per-position-day reversal/revaluation pairing.
