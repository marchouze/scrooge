---
agent: Rohan
trigger: daily-mtm
asOf: 2026-05-29T04:48:52.708Z
decision-required: false
---

# Rohan — daily MTM run, 2026-05-29

Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.

**Headline:** 0 live · 2 stale-mark · 0 unvalued · net unrealised P&L delta ZAR 0,00 · runId `a809c766-e30c-4698-87cd-e8f6df538987`.

## Position detail

| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |
|---|---|---|---:|---:|---:|---|
| `SIM-1779951540517-BE5D1D15` | USD/ZAR | overnight-close | 16.4586 | 16.2429 | -57 218,71 | overnight-close:2026-05-28:twelve-data |
| `REG-PRIN-5a36856c-e92e-4201-8630-028fa9c1363a` | USD/ZAR | overnight-close | 18.5000 | 16.2429 | -2 257 140,00 | overnight-close:2026-05-28:twelve-data |

## Skip reasons

- overnight-close proxy for USD/ZAR (rateSource: overnight-close:2026-05-28:twelve-data)
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
