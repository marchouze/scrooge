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

## What S1 builds (as delivered)

A single idempotent, replay-safe `scripts/backfill-fil-instances.ts`, wired into
`ci:migrate`, run against `BANK_EVENT_DB` via `composition.eventStore`:

1. **Source resolution.** Read `FxTradeExecuted` from the main store. If trades
   exist → derive FIL instances from them (true backfill). If ZERO (the current
   CI reality) → derive from a small **deterministic anchor FX book descriptor
   set** (constants, re-run identical) WITHOUT persisting any legacy trade events.
2. **FIL materialisation into the main store.** Emit `FilInstrumentCreated` (and
   `FilInstrumentTerminated` for settled instruments) via the registered `make*`
   builders, economic terms decimal-native (`{currency, amount}` MAJOR-unit
   string — no `*Minor`), tenant from anchor, reporting currency via
   `anchorFunctionalCurrency()` (never hardcoded). Idempotency = instance URN.
3. **Market-data seed (gap-only).** Production `fx-quote` ticks (`mid`) for every
   referenced pair + an FX return history (≥ `MIN_RETURN_OBSERVATIONS`+1 levels).
   Deterministic id + INSERT OR IGNORE → never overwrites.
4. **Wire into `ci:migrate`** so the V2 FIL data is present in CI too.

S1 performs **NO flips** — no `v2Status` promotion.

### Result (clean CI store, after backfill)

- 4 `FilInstrumentCreated` + 1 `FilInstrumentTerminated` (3 open + 1 settled),
  78 production fx-quote ticks across 3 pairs (USD/ZAR, EUR/ZAR, GBP/ZAR).
- `computeDailyPnLV2` over the FIL projection now returns **real** numbers:
  3 active positions, totalUnrealised = 789 500 000 ZAR minor, 0 marks
  unavailable — the V2 valuation path is exercised end-to-end (was vacuous).
- `ba320-fx-v2-parity` V2 side: **3 open FIL instances** (was 0).
- `recon:no-residual-minor-encoding`: **0 violations** (FIL emission is clean).

### The legacy-encoding finding (S1→S2/S3 hand-off, not a silent gap)

The V1 FX trade/settlement/reval/daily-P&L event family is still LEGACY
minor-encoded (`*Minor` fields). `recon:no-residual-minor-encoding` forbids any
`*Minor` numeric field in any payload (no allowlist), so those V1 types are
**un-emittable on current main**. The V1 COMPARISON BASELINES of all three gates
(`var-v2-parity`, `ba320-fx-v2-parity`, `daily-pnl-v2-parity`) are therefore
frozen; FULL byte-comparison needs the V1 FX trade CDM
(`markets/cdm/primitives.ts moneySchema` + the NOP fold + the V1 emitters)
redenominated to decimal MoneyWire. That CDM-redenomination is the binding
prerequisite for S2 (VaR flip) / S3 (daily-P&L flip) — beyond S1's data-population
scope, logged here as the explicit hand-off.

## Charter Definition of Done

- Idempotent + replay-safe (re-run = 0 new events).
- `bun run ci` green on a clean store; no `any`/`!`/`@ts-ignore`; no green by concealment.
- citation-gate 0; v1-removal-ratchet holds; no-hardcoded-reporting-currency green;
  no-residual-minor-encoding green (FIL emission is decimal-native).
- Fixture descriptors are constants; no legacy `*Minor` events persisted.
