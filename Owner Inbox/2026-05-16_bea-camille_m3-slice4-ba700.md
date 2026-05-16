---
title: "M3 Slice 4 — BA 700 Period-Close Return"
date: "2026-05-16"
authors:
  - "Bea (Accounting & financial reporting engineer, engineering)"
  - "Camille (Chief Financial Officer, governance)"
authority: "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"
decision-required: false
status: "delivered"
asOf: "2026-05-16T00:00:00.000Z"
---

# M3 Slice 4 — BA 700 Period-Close Return

**Delivered by:** Bea (Accounting & financial reporting engineer, engineering) + Camille (Chief Financial Officer, governance)
**Authority:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10), pack §6 Slice 4

## Summary

Slice 4 builds the BA 700 Capital Adequacy Return generator at `prototype/platform/returns/ba700/`, following the same architectural pattern as the BA 325 LCR generator (Slice 3). All CI gates pass (1708 tests, zero lint errors, zero citation-gate violations, zero typecheck errors).

## What was built

### 1. `prototype/platform/returns/ba700/generator.ts`

The generator package entry point. Provides:

- **`BA700Return`** — mission-spec typed shape with four key sections:
  - `capitalAdequacy: { tier1Capital, tier2Capital, rwa, carRatio }`
  - `balanceSheet: { totalAssets, totalLiabilities, equity }`
  - `incomeStatement: { netInterestIncome, nonInterestIncome, operatingExpenses, netProfit }`
  - `offBalanceSheet: { guarantees, commitments, derivatives }`
  - `status: "compliant" | "breach" | "insufficient-data"`
- **`generateBA700Return()`** — queries `TrialBalanceSnapshotted` and `AccountingPeriodClosed` from the event store, then delegates to `generateBa700CapitalFromEvents` (P1-compliant events-first entry point).
- Re-exports from the canonical `platform/reporting/ba-700-capital.ts` generator.

**Semantic cross-links (Principle 2):**
- `capitalAdequacy` ↔ SemanticEntry `CommonEquityTier1Capital`, `AdditionalTier1Capital`, `Tier2Capital`, `RiskWeightedAssets`, `TotalCapitalRatio` (SLICE_4_CAPITAL_ENTRIES)
- `balanceSheet` ↔ SemanticEntry `Balance` (SLICE_1_ENTRIES)
- `offBalanceSheet` ↔ SemanticEntry `Exposure` (SLICE_1_ENTRIES)

### 2. `prototype/platform/returns/ba700/period-close-subscriber.ts`

`AccountingPeriodClosed` subscriber. Provides:

- **`onAccountingPeriodClosed()`** — fires on period close for bank entities, calls `generateBA700Return`, returns `PeriodCloseSubscriberResult`.
- **`replayAndGenerate()`** — catch-up helper: replays all `AccountingPeriodClosed` events for an entity and re-generates BA 700 for each.
- Non-bank entities (e.g. `LE-ZA-HOZ-SECURITIES`) are no-oped at the subscriber boundary.
- Surfaces substrate gap: event-bus trigger wiring (`AccountingPeriodClosed` → subscriber) is an M8 gap, not yet built.

### 3. `prototype/platform/returns/ba700/ba700.test.ts`

Scenario test (9 tests, 41 expect() calls). Asserts:

1. `generateBA700Return` produces a `BA700Return` with all sections present and non-NaN.
2. `capitalAdequacy.carRatio >= 0` for all scenarios including zero-RWA (infinity).
3. `status` is one of the three typed values.
4. `placeholders` is populated (rehearsal-grade per Q1 default).
5. Subscriber processes `LE-ZA-HOZ-BANK` and returns `processed: true`.
6. Subscriber no-ops for `LE-ZA-HOZ-SECURITIES` (`processed: false`).
7. `replayAndGenerate` returns one result per closed period.

### 4. `returns:ba700:smoke` script in `package.json`

`bun test platform/returns/ba700/ba700.test.ts --isolate` — runnable standalone smoke test.

## Rehearsal-grade placeholder cells

Per Q1 default (rehearsal-grade with placeholder zeros for cells without feeding event types):

| Section | Cell | TODO feed from |
|---|---|---|
| `capitalAdequacy` | `tier1Capital`, `tier2Capital` | `SubLedgerPostingEmitted` capital-classified accounts (already wired via events-adapter) |
| `capitalAdequacy` | `rwa` | `RwaComputed` event (W2 Slice 3 engine) |
| `balanceSheet` | `totalAssets`, `totalLiabilities`, `equity` | `TrialBalanceSnapshotted` rows via chart-of-accounts IFRS-class mapping |
| `incomeStatement` | All rows | `TrialBalanceSnapshotted` P&L account rows |
| `offBalanceSheet` | `guarantees`, `commitments`, `derivatives` | OBS event types (not yet landed) — `Exposure` semantic entry |

## Substrate gaps surfaced

1. **Balance-sheet / income-statement mapping** — chart-of-accounts lacks `ifrsClassification` / account-type fields to partition rows into asset / liability / equity / income / expense. Wires when Mira's WS-INSTRUMENT-ANALYSES lands.
2. **Off-balance-sheet event types** — no guarantee / commitment / derivative-notional events yet. `Exposure` semantic entry (SLICE_1_ENTRIES) defines the contract.
3. **Event-bus trigger** — `AccountingPeriodClosed` → `onAccountingPeriodClosed` wiring is manual / in-session. Autonomous trigger is an M8 substrate gap.
4. **RWA input** — fixture-grade at v0. W2 Slice 3 RWA engine produces the same `RwaDecomposition` shape — no API change at the generator boundary.

## CI gate results

```
bun run ci:
  typecheck: 0 errors
  lint:      0 errors (716 files checked)
  test:      1708 pass, 0 fail (113 files)
  citation-gate: 84 citations checked, 0 violations
  all recon pipelines: pass
```

## Citations

- Banks Act 94 of 1990 §70 (capital-adequacy reporting)
- Regulations Relating to Banks Reg 38 (BA 700 form + submission)
- BCBS Basel III §50–§90 (capital stack composition)
- D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (standing authority)
- Principles/1-events-are-truth.md (events-first generator entry point)
- Principle 2 — single-graph discipline (semantic cross-links)
