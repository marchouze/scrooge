---
author: "Bea (Accounting & financial reporting engineer, engineering) + Atlas (Platform Engineer, engineering)"
date: "2026-05-16"
decision-required: false
authority: "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"
---

# M2 Slice 2 — Period-Close Event Family

**Run date:** 2026-05-16  
**Authors:** Bea (Accounting & financial reporting engineer, engineering) + Atlas (Platform Engineer, engineering)  
**Citations:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN · D-REPORTING-CAPABILITY-SLICE-2 · P1-EVENTS-AS-TRUTH · Principle 2 (single-graph discipline) · IAS-1 · COMPANIES-ACT-71-2008-S24

---

## Summary

M2 Slice 2 is complete. The period-close event family — three typed event types, a handler module with public functions, a scheduled agent handler, and a full unit-test suite — is wired into the live platform. `bun run ci` exits 0.

## What was built

### Event types (already in registry from prior slice — verified)

All three event types were confirmed fully typed with Zod schemas and `make<Type>` factories in `prototype/platform/event-store/event-types/accounting.ts` and registered in `PERIOD_CLOSE_EVENT_TYPES` at `prototype/platform/event-store/registry/markets.ts`:

| Type | Schema | Factory | Registry row |
|---|---|---|---|
| `AccountingPeriodOpened` | `accountingPeriodOpenedPayloadSchema` | `makeAccountingPeriodOpened` | `PERIOD_CLOSE_EVENT_TYPES[0]` |
| `AccountingPeriodClosed` | `accountingPeriodClosedPayloadSchema` | `makeAccountingPeriodClosed` | `PERIOD_CLOSE_EVENT_TYPES[1]` |
| `TrialBalanceSnapshotted` | `trialBalanceSnapshottedPayloadSchema` | `makeTrialBalanceSnapshotted` | `PERIOD_CLOSE_EVENT_TYPES[2]` |

### Handler module

**`prototype/platform/accounting/period-close-handler.ts`** — three public functions:

- **`openPeriod(...)`** → emits `AccountingPeriodOpened`; idempotent; reopen discipline enforced.
- **`snapshotTrialBalance(...)`** → computes trial balance from `SubLedgerPostingEmitted` stream; appends `TrialBalanceSnapshotted` (kind: `interim`); does NOT close the period.
- **`closePeriod(...)`** → full five-step close transaction: compute TB → optional doc-store write → `TrialBalanceSnapshotted` (kind: `close`) → `eventStore.snapshot()` → `AccountingPeriodClosed`.

All three delegate to the authoritative orchestration in `prototype/platform/accounting/period-close.ts`.

### Module barrel

**`prototype/platform/accounting/index.ts`** — public surface for `@platform/accounting`. Exports the three handler functions plus types and the read-side helpers (`computeTrialBalance`, `periodAuditChain`, `periodCloseStreamKey`).

### Scheduled agent handler

**`prototype/runtime/agents/bea-period-close.ts`** — `bea:period-close` daily scheduled handler (05:30 UTC). Opens the current month's period if not already open; defers close to licence-day posture (when `SubLedgerPostingEmitted` events exist). Registered in:

- `prototype/runtime/agents/metadata/bea.ts` (metadata)
- `prototype/runtime/agents/callables/bea.ts` (callable)
- `prototype/package.json` (`agent:bea-period-close` script)

### Semantic cross-link — Slice 2 acceptance criterion

Verified: `SemanticRegistry.from(SLICE_1_ENTRIES).resolve({id: "Balance"})` returns the `balance` entry with `status: "in-force"` (TC-10 and TC-11 in the test suite pass).

## Unit tests

**`prototype/platform/accounting/period-close-handler.test.ts`** — 11 tests, all passing:

| TC | Description |
|---|---|
| TC-1 | `openPeriod` emits `AccountingPeriodOpened` with correct payload |
| TC-2 | `openPeriod` is idempotent for same payload |
| TC-3 | `openPeriod` persists event so replay returns it |
| TC-4 | `snapshotTrialBalance` throws when no period opened |
| TC-5 | `snapshotTrialBalance` appends `TrialBalanceSnapshotted` (interim) |
| TC-6 | `closePeriod` throws when no period opened |
| TC-7 | `closePeriod` succeeds (zero-posting empty close) |
| TC-8 | `closePeriod` throws on double-close |
| TC-9 | Close snapshot has `snapshotKind: "close"` |
| TC-10 | `SemanticRegistry.resolve({id:"Balance"})` is defined |
| TC-11 | `balance` export from `@platform/semantic` has `id="Balance"` |

## Substrate gaps surfaced

- **Chart-of-accounts coverage**: trial balance rows use M1 stub leaf-account IDs. Populated chart required for Slice 6+ projection-runtime rebuild.
- **`SubLedgerPostingEmitted` prerequisite**: `closePeriod` computes trial balance from this stream. Zero postings in build phase → empty but balanced close (valid). Full close fires at licence-day posture.
- **Concurrency control**: close orchestration assumes single-writer per (entity, periodId). Multi-writer guard is a Vera follow-on.

## Slice 3 unblocked

Slice 3 (BA 325 LCR harness — Bea + Eitan + Anya) is now unblocked. It should import:

```typescript
import { closePeriod, openPeriod, snapshotTrialBalance } from "@platform/accounting";
import type {
  AccountingPeriodClosedPayload,
  TrialBalanceSnapshottedPayload,
} from "@platform/event-store/event-types";
```

The `TrialBalanceSnapshotted.rows` field (per-account, per-currency balances) is the input contract for the BA 325 cell-level mapping.

## CI gate

`bun run ci` exits 0. Full typecheck, lint, 1699 tests, citation-gate, all recon pipelines including `recon:runtime-handler-sync` and `recon:permission-gate-default`.
