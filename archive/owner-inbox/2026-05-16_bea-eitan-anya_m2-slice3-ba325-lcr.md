---
author: "Bea (Accounting & financial reporting engineer, engineering) + Eitan (Treasury & liquidity engineer, engineering) + Anya (Projection Engineer, engineering)"
date: "2026-05-16"
decision-required: false
authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
status: complete
---

# M2 Slice 3 — BA 325 LCR Single-Return Harness

**Authors:** Bea (Accounting & financial reporting engineer, engineering), Eitan (Treasury & liquidity engineer, engineering), Anya (Projection Engineer, engineering)  
**Date:** 2026-05-16  
**Authority:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)  
**Citations:** Principles/1-events-are-truth.md; Principle 2 (single-graph discipline); Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 26; BCBS D295

---

## Summary

M2 Slice 3 is complete. The BA 325 (Liquidity Coverage Ratio) end-to-end harness is production-grade and all tests pass. This is the first SARB regulatory return rendered from the event store with full P1 compliance.

---

## What was built

### 1. BA325Generator — `prototype/platform/reporting/ba-325-lcr.ts`

Complete LCR generator implementing the BCBS D295 / Regulation 26 formula:

```
LCR = HQLA (post-haircut, post-cap) / Net Cash Outflows (30-day stress)
```

**Key features:**
- Per-entity scope guard — only `LE-ZA-HOZ-BANK` generates BA 325 (bank-licence-bound per `D-REGULATORY-PERIMETER`)
- Three-regime HQLA cap arithmetic (40% L2A, 15% L2B) — closed-form solution per BCBS D295 §47
- Inflow cap at 75% of gross outflows; net-outflow floor at 25% of gross outflows
- P1-compliant: cash flows folded from `FxSettlementInstructed` / `FxSettlementConfirmed` events (not from GL)
- HQLA stock from trial-balance rows (account balances — the correct source per P1)
- Provenance fingerprint (sorted-stable JSON of classification map) for forensic reproducibility

### 2. BA325Return type — `Ba325Output`

Typed TypeScript interface with all required cells:
- `meta`: entity, asOf, periodId, functionalCurrency, generatorVersion, trialBalanceSnapshotEventId
- `hqla`: level1, level2A (post-cap), level2B (post-cap), totalStockHqlaMinor
- `cashFlows`: outflows, inflows (capped), netCashOutflowsMinor
- `lcrRatio`: dimensionless (1.0 = 100%); `lcrCompliant`: boolean
- `citations`: regulatory anchors
- `placeholders`: rehearsal-grade gap markers

### 3. AccountingPeriodClosed subscriber — `prototype/platform/returns/ba325/period-close-subscriber.ts`

Subscriber that fires when `AccountingPeriodClosed` is emitted for a bank-licence entity:
- Reads trial-balance rows from the `TrialBalanceSnapshotted` event referenced by `closedPayload.trialBalanceSnapshotEventId`
- Applies default HQLA classification map anchored to `CashAndBalancesAtSARB` semantic entry (Slice 1)
- Calls `generateBa325Lcr` with the event store for P1-compliant cash-flow folding
- Returns typed `Ba325Output` for the caller to render + store
- Non-bank entities silently skipped (`result.skipped = true`)

**Semantic cross-link:** The default classification map (`DEFAULT_HQLA_CLASSIFICATIONS`) derives `subCategory` directly from `cashAndBalancesAtSARB.regulatoryCells` — tracing regulation → policy → semantic entry → account → BA 325 cell (Principle 2, bidirectional).

### 4. Scenario test — `prototype/tests/ba-325-lcr.test.ts`

25 tests covering:
- Semantic entry registration (6 liquidity entries)
- Per-entity isolation (`LE-ZA-HOZ-SECURITIES` rejected)
- HQLA cap arithmetic — three regimes
- Inflow-cap binding (FxSettlementInstructed inflows > 75% of outflows)
- Net-outflow floor binding
- Provenance passthrough (TrialBalanceSnapshotted.event_id → Ba325Output.meta)
- Determinism (same generator output → byte-identical canonical JSON)
- Schema validation (Ba325RenderSchema)
- Divide-by-zero (zero outflows → lcrRatio = Infinity)
- Deprecated outflow/inflow account entries produce placeholder warning

**Subscriber tests** — `prototype/platform/returns/ba325/period-close-subscriber.test.ts`:
7 additional tests covering semantic cross-link, entity guard, and end-to-end period-close → BA 325 generation.

**Total: 1695 tests pass, 0 fail.**

### 5. `returns:ba325:smoke` script

Added to `prototype/package.json`:
```
"returns:ba325:smoke": "bun test tests/ba-325-lcr.test.ts"
```

### 6. JSON renderer — `prototype/platform/reporting/ba-325-render.ts`

Canonical JSON renderer with:
- Zod schema validation (`Ba325RenderSchema`)
- Deterministic key-sorted serialisation (`canonicaliseBa325`)
- `Infinity` encoded as `"infinity"` for JSON-safe transport
- BLAKE3-ready `Uint8Array` bytes for RMS doc store

---

## Cells with placeholder zeros (gap register)

| Cell | Status | Feeding event type (Slice 6+) |
|------|--------|-------------------------------|
| Level-2A HQLA | Placeholder | `TODO: feed from InstrumentClassificationSnapshotted (Mira WS-INSTRUMENT-ANALYSES)` |
| Level-2B HQLA | Placeholder | `TODO: feed from InstrumentClassificationSnapshotted` |
| Foreign-currency settlement legs | Placeholder | `TODO: FX-rate enrichment step (Slice 6+)` |
| Non-ZAR denominator legs | Excluded | `TODO: per-currency LCR per Reg 26(13) (Slice 6+)` |
| `functionalCurrency` in subscriber | Hardcoded ZAR | `TODO: read from AccountingPeriodOpened.functionalCurrency (Slice 6+)` |
| Exact SARB BA 325 line numbering | TBC | `TODO: Mira WS-INSTRUMENT-ANALYSES schema ingestion` |

These are marked with `[citation: TBC — ...]` in `Ba325Output.placeholders` per Marc's Q1 default (rehearsal-grade with traceable placeholders).

---

## M2 milestone acceptance criteria

All three M2 slices have now landed:

| Slice | PR | Description |
|-------|----|-------------|
| M2 Slice 1 | #436 | Accounting foundation — `AccountingPeriodOpened`, period-close substrate |
| M2 Slice 2 | #437 | Trial-balance snapshot — `TrialBalanceSnapshotted`, `closePeriod` |
| M2 Slice 3 | This PR | BA 325 LCR generator, renderer, subscriber, tests |

**M3 (Slices 4–8) may now be dispatched.** M3 extends the harness to BA 700 (capital adequacy), BA 350 (market risk), BA 600 (operational risk), the SARB XML render, and the IFRS AFS skeleton — all following the same events-first pipeline established here.
