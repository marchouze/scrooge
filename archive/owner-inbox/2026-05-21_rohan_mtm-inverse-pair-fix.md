---
title: "MTM inverse-pair lookup fix + valuation policy activation"
author: "Rohan (Market risk engineer, engineering)"
date: 2026-05-21
workstream: WS-MTM-DAILY-CADENCE
brief: brief:rohan:fix-mtm-pair-direction-lookup-activate-valuation:2026-05-21
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - D-FX-SALES-TRADING-FRONTEND
  - D-EVENT-VIEW-BOUNDARY-WIRE
  - IFRS-9-§5.7.1
  - IAS-21-§28
status: delivered
---

# MTM inverse-pair lookup + valuation policy activation — 2026-05-21

**Author:** Rohan (Market risk engineer, engineering)
**Brief:** `brief:rohan:fix-mtm-pair-direction-lookup-activate-valuation:2026-05-21`
**Workstream:** WS-MTM-DAILY-CADENCE
**Date:** 2026-05-21

## What changed

Two bugs were blocking the live daily-MTM run against the shared event + market-data stores. Both fixed in this PR.

### Bug 1 — exact-string pair lookup

`scripts/mtm-run.ts:224` queried `MarketDataStore.query({ instrument: currencyPairStr })` where `currencyPairStr` was the trade-booked direction (e.g. `"ZAR/EUR"`). Stored ticks from `open-er-api` and `twelve-data` use the upstream-feed convention (`"EUR/ZAR"`). 5 of 6 open FX positions skipped on exact-string mismatch. The IPV secondary-source lookup at `:313` had the same bug.

**Fix.** New helper `lookupQuoteWithInverse(store, pair, opts)` in `platform/market-data/store.ts`:

1. Query the requested pair string. If a usable mid rate is found, return it as `sourceDirection: "direct"`.
2. Otherwise, query the inverted pair (`QUOTE/BASE`). If a usable mid `r` is found, return `{ rate: 1/r, sourceDirection: "inverse" }`.
3. Otherwise, return `null`.

`mtm-run.ts` replaces both call sites with the helper. The IPV path passes `excludeSource: tick.source` so the cross-source variance check still finds a genuinely different provider, and now does so even when the secondary feed only stores the inverse direction.

**Why this home.** The helper is a market-data query semantic — it depends only on `MarketDataStore.query` and a pure rate-derivation rule. It does not reach into trade payloads, valuation policy, or P&L computation. Placing it in `platform/market-data/store.ts` puts the inversion rule next to the storage rule it complements; placing it in `fx-revaluation.ts` would have leaked an FX-revaluation-specific name into a primitive that the MTM runner and any future EOD/intraday valuation script can both consume.

### Bug 2 — no active valuation policy

The Slice B.1 mark-adoption engine requires a `PolicyVersionActivated{domain:"valuation"}` event before emitting `OfficialMarkAdopted`. The shared store had none, so every MTM run skipped mark adoption with a WARN. Ran `bun run backfill:policy-activations` against the shared store. Confirmed event emitted: `eventId: 76d1fbd7-e79d-4ccc-8ba1-5a5c652a98a2` (`VALUATION-POLICY-V1` v1.0 founding activation, `documentHash: blake3:2e3163f0…`).

## Before / after

### Before (MTM run, 2026-05-21, pre-fix)

```
Positions valued: 1
Positions skipped: 5
Total P&L delta : ZAR -2 444 959,69
```

Skipped reasons: `no production rate for ZAR/EUR`, `no production rate for ZAR/GBP`, `no production rate for ZAR/USD` (× 3 trades).

| Trade ID                  | Pair    | Book rate | MTM rate | P&L Δ (ZAR)           | IPV    |
|---------------------------|---------|-----------|----------|-----------------------|--------|
| SIM-…-DDDF8D28            | GBP/ZAR | 23.0004   | 22.1484  | -2 444 959,69         | BREACH |

### After (MTM run, 2026-05-21, post-fix)

```
Positions valued: 6
Positions skipped: 0 (FX; bond/IRD still skip honestly)
Total P&L delta : ZAR -2 370 594,11
OfficialMarkAdopted events emitted: 6 (was 0)
```

| Trade ID         | Pair    | Book rate | MTM rate | P&L Δ (ZAR)         | IPV                     |
|------------------|---------|-----------|----------|---------------------|-------------------------|
| SIM-…-8E122B83   | ZAR/EUR | 0.0500    | 0.0522   | +4 966,89           | OK(0.1187%)             |
| SIM-…-4AFE7E09   | ZAR/GBP | 0.0435    | 0.0452   | +3 735,34           | OK(0.2250%)             |
| SIM-…-5E278E8F   | ZAR/USD | 0.0541    | 0.0607   | +2 346,05           | BREACH(pct: 0.3075%)    |
| SIM-…-9C6E2BBE   | ZAR/USD | 0.0541    | 0.0607   | +53 820,89          | BREACH(pct: 0.3075%)    |
| SIM-…-DDDF8D28   | GBP/ZAR | 23.0004   | 22.1484  | -2 444 959,69       | BREACH(zar: 0.2255%)    |
| SIM-…-8874691C   | ZAR/USD | 0.0541    | 0.0607   | +9 496,41           | BREACH(pct: 0.3075%)    |

The previously-skipped 5 positions contributed +74 365,58 ZAR of positive marks, narrowing the day's unrealised P&L from −2 444 959,69 to −2 370 594,11.

`OfficialMarkAdopted` events: **0 → 6** (one per FX position revalued).

The ACC-2100-005 net-balance check is dependent on Bea's GL-posting engine consuming the new `FxPositionRevalued` events. That posting engine is a separate run on its own cadence and is not in this brief's scope; with the mark-adoption gate now satisfied and revaluation events emitting cleanly, the downstream GL accrual will be non-zero on Bea's next sweep.

## Tests

`platform/market-data/lookup-quote-with-inverse.test.ts` — 14 cases:

- `invertPair` — canonical pair, malformed input.
- `extractMidRate` — `mid`, `midRate`, `bid`+`ask`, missing/zero/negative.
- `lookupQuoteWithInverse` — direct hit; inverse hit (`1/r` with `sourceDirection:"inverse"`); no-hit returns null; bid/ask derivation in both directions; `excludeSource` filtering for IPV; provenance filter (`production` vs `simulated`); integration case (seed EUR/ZAR ticks, query as ZAR/EUR primary + IPV secondary inverse path).

Full test suite: 3 564 pass / 0 fail. `bun run ci` exits 0.

## Authority

- D-MARKETS-SCHEMA-FOUNDATION (CEO-approved) — MarketDataStore primitive.
- D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10) — FX MTM workstream.
- D-EVENT-VIEW-BOUNDARY-WIRE — Slice B.1 mark-adoption engine, valuation-policy activation gate.
- IFRS-9-§5.7.1 — FVTPL: changes in fair value through P&L.
- IAS-21-§28 — monetary items retranslated at closing rate; direction-neutral by construction.

## Out of scope

- Pair-direction convention in the trade-execution layer (trades may book either direction; intentional).
- A new production feed (existing feeds cover EUR/ZAR, GBP/ZAR, USD/ZAR fully).
- SARB-fixing ingest (separate brief; would supersede free feeds for regulator-grade marks but not blocking).
- Bea's GL posting cadence; downstream consumption of the new `FxPositionRevalued` events.
