---
title: "Phase 2 Gap A2 — Daily P&L V2 Engine Design"
authority: "D-V1-REMOVAL-PHASE2-GAP-A2 (CEO-approved 2026-06-16)"
charter: "D-ENGINEERING-INTEGRITY-CHARTER"
author: "Atlas (Substrate Architect, engineering)"
date: "2026-06-16"
status: "implemented"
---

# Phase 2 Gap A2: Snapshot-Anchored FIL Projection in Daily P&L

## 1. Problem Statement

The V1 daily P&L engine (`platform/product-control/daily-pnl.ts`) reads
`FxPositionRevalued` events — per-trade, per-day unrealised P&L deltas emitted
by the EOD close engine. This event type is tagged `v1-only` in the V1-removal
registry. The flip to V2-authoritative has been blocked because the V2 A2 path
(`FxBookValuationSnapshotted` aggregate book snapshot) is **incommensurable**
with the V1 per-trade delta stream.

Gap A2 resolves this by building a **snapshot-anchored FIL instance projection**
that reads V2 FIL instruments directly (`FilInstrumentCreated` /
`FilInstrumentTerminated`) and calls `Valuable.value()` with a single shared
`MarketDataSlice`. This is the V2-native read path that makes a byte-equivalence
proof achievable.

## 2. CEO Design Principle

> Events record things that actually happen, not derived reports. A
> `DailyPnLReportGenerated` event memorialises the market-data snapshot used —
> from which per-instrument marks are always fully reproducible:
> `(report event + FIL instance log + MarketDataStore.getLatest(pair, marketDataAsOf))`.
> No per-instrument mark events are needed.

One shared `MarketDataSlice` is built at run start and passed to every FIL
instrument's `Valuable.value()`. All instruments see identical rates at the same
point in time, O(n) single pass.

## 3. Architecture

### 3.1 marketDataAsOf field

`DailyPnLReportGeneratedPayload` gains an optional `marketDataAsOf: string` field.
This is the snapshot memorialisation: the ISO-8601 instant at which the
`MarketDataStore` was queried. Together with the FIL instance log, it is
sufficient to fully reproduce any per-instrument mark.

The field is **backwards-compatible** (`z.string().optional()`): existing V1
events without this field parse as `undefined`/`null`.

### 3.2 V2 engine: `computeDailyPnLV2`

File: `platform/product-control/daily-pnl-v2.ts`

```
EventStore ──► FilInstrumentCreated events (assetClass = "fx")
           └─► FilInstrumentTerminated events

MarketDataStore
  .getLatest(pair, marketDataAsOf)   ─► MarketDataSlice (one per run)

FIL FX models
  .fxSpotValuable(pos).value(slice)  ─► Money (ZAR major)

Aggregate ──► DailyPnLResult (same shape as V1 engine)
```

Key invariants:
- **One shared `MarketDataSlice`** — built once, passed to every instrument.
- **Fail-closed on missing mark** — `markStatus: "unavailable"`, never silent 0.
- **No-instruments path** — returns empty OK result; parity gate treats as advisory.
- **Drop-in parallel** — `DailyPnLResult` interface is identical to V1.

### 3.3 Pair extraction from FIL instruments

FIL instruments for FX have `hedgingSetTag` = `"<BASE>/<QUOTE>"` (e.g. `"EUR/ZAR"`).
The engine reads `economicTerms.currency` (the non-ZAR leg) and assumes the
reporting currency is ZAR, deriving the pair as `<currency>/ZAR`. For
cross-currency pairs, `hedgingSetTag` provides the full pair.

### 3.4 ValuableBuilder from FIL instance

The engine reads `economicTerms.assetClass === "fx"` instances and constructs
`fcyCashValuable` (since FIL FX instruments in the anchor store are materialised
from settled and active trades). The `signedNotional` is derived from
`economicTerms.notional.amount` (decimal string, signed by `direction`).

### 3.5 Parity gate: `recon:daily-pnl-v2-parity`

File: `platform/recon/daily-pnl-v2-parity.ts`

- Advisory gate (ok: true even with warn violations).
- V1 side: latest `DailyPnLReportGenerated` event → `{ totalUnrealisedZarMinor, totalRealisedZarMinor }`.
- V2 side: `computeDailyPnLV2(...)` → same shape.
- Tolerance: ≤1 ZAR minor difference (rounding artefact).
- No-instruments case: advisory warn, `ok: true`.
- No-V1-report case: skip, `ok: true`.

## 4. Ratchet

`FxPositionRevalued` remains `v1-only`. Ratchet baseline stays at 585.
No new `v1-only` types are added.

## 5. Files changed

| File | Change |
|------|--------|
| `platform/event-store/event-types/product-control.ts` | Add `marketDataAsOf: z.string().optional()` to payload schema |
| `platform/product-control/daily-pnl-v2.ts` | New V2 engine |
| `platform/recon/daily-pnl-v2-parity.ts` | New parity gate |
| `platform/recon/fx-v2-parity.ts` | Update Gap A2 message to note V2 path wired |
| `scripts/run-recon-suite.ts` | Register `recon:daily-pnl-v2-parity` |
| `package.json` | Add `recon:daily-pnl-v2-parity` script |

## 6. Definition of Done

- [ ] `bun run ci` passes on clean store
- [ ] `bun run citation-gate` zero violations
- [ ] `recon:daily-pnl-v2-parity` registered and exits 0
- [ ] `recon:fx-v2-parity` still passes (ok: true)
- [ ] `recon:v1-removal-ratchet` baseline unchanged (585)
- [ ] PR merged to main
