# WS-V2-AUTHORITATIVE Slice S1 — FIL-instance + market-data backfill keystone

**Authority:** D-V2-AUTHORITATIVE-FLIP-PREREQS (CEO-approved 2026-06-16).
**Engineering Charter:** `Engineering-Charter.md` (D-ENGINEERING-INTEGRITY-CHARTER) binds this slice.
**Brief:** brief:atlas:ws-v2-authoritative-s1-fil-instance-market-data-:2026-06-16
**Author:** Atlas (Core banking platform architect, engineering).

> NOTE: this markdown is a *design note* (engineering scaffold), not an RMS
> deliverable record. The canonical deliverable is the code + the wired
> `backfill:fil-instances` script. No `RecordFiled` event is implied.

## The keystone gap (assessment — verified on a clean CI store)

A clean `bun run ci:migrate` store (`BANK_EVENT_DB=.local/event.db`) was built and
inspected. Result: **2010 events, ALL governance** — zero `FxTradeExecuted`,
zero `FilInstrumentCreated`, zero `DailyPnLReportGenerated`, zero
`MarketRiskMeasureComputed`, zero `MarketRiskVarComputed`.

The V1-removal waves purged the entire FX trading book from the canonical store
(the home store likewise has zero FX/Trade/Settlement events). So:

- **There is no V1 FX trade source to backfill FIL instances from.** The brief's
  "for each existing V1 FX trade, emit the V2 FilInstrumentCreated" presupposes a
  trade book that no longer exists in the canonical store.
- Every V2 data gate (`daily-pnl-v2-parity`, `var-v2-parity`, `ba320-fx-v2-parity`)
  is therefore **vacuous** — there is nothing on either side to compare.

Before-baseline (clean CI store):

| gate | before (vacuous) |
|---|---|
| `daily-pnl-v2-parity` | "no V1 data — parity check skipped" (0 / 0) |
| `var-v2-parity` | "no V2 event; V1 present: false" (0 / 0) |
| `ba320-fx-v2-parity` | "V1: 0 ccys, 0 open trades. V2: 0 ccys, 0 open FIL instances (no-data)" |
| `fx-v2-parity` | registry-tag sentinel (not data-driven) |

### Two distinct V2 reader stores (the second structural finding)

- `daily-pnl-v2.ts` and `ba320-fx-v2.ts` read `FilInstrumentCreated/Terminated`
  from the **main `composition.eventStore`** (`BANK_EVENT_DB`).
- `fil-instance-positions.ts` (SA-CCR) and `fx-settlement-continuity.ts` read
  the **separate `v2-anchor.db`** (`BANK_V2_ANCHOR_DB`).
- The pre-existing `seed:v2-fil-instances-ir-fx` wrote ONLY to `v2-anchor.db` —
  so even when run it never populated the store the Phase-2/3 gates read.

## What S1 builds

A single idempotent, replay-safe `scripts/backfill-fil-instances.ts`, wired into
`ci:migrate`, run against `BANK_EVENT_DB` via `composition.eventStore`:

1. **Source resolution (fail-open to bootstrap).** Read `FxTradeExecuted` from the
   main store. If trades exist → derive FIL instances from them (a true backfill).
   If ZERO (the current CI reality) → seed a small **deterministic anchor FX book**
   (`build-phase-fixture` provenance, correctly labelled — no concealment) first,
   then derive. Both paths are idempotent.
2. **FIL materialisation into the main store.** Emit `FilInstrumentCreated` (and
   `FilInstrumentTerminated` for settled/matured) via `makeFilInstrumentCreated`,
   economic terms decimal-native (`{currency, amount}` MAJOR-unit string), tenant
   from anchor, reporting currency via `anchorFunctionalCurrency()` (never
   hardcoded). Idempotency key = instance URN derived from source trade id.
3. **Market-data seed (gap-only).** Production `fx-quote` ticks (with `mid`) for
   every referenced pair + an FX return history long enough for the VaR engines
   (`MIN_RETURN_OBSERVATIONS`). Never overwrite an existing tick.
4. **Run the engines** so the parity gates have both sides: V1 daily-P&L reval +
   report, V1 VaR (`MarketRiskMeasureComputed`), V2 VaR (`MarketRiskVarComputed`).
5. **Wire into `ci:migrate`** so the gates are non-vacuous in CI too.

S1 performs **NO flips** — no `v2Status` promotion. Byte-clean OR genuine
divergence are both valid S1 outcomes; the job is non-vacuity.

## Charter Definition of Done

- Idempotent + replay-safe (re-run = 0 new events).
- `bun run ci` green on a clean store; no `any`/`!`/`@ts-ignore`; no green by concealment.
- citation-gate 0; v1-removal-ratchet holds; no-hardcoded-reporting-currency green.
- New source-trade fixtures labelled `build-phase-fixture` provenance (truthful).
