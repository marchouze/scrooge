---
title: Reporting capability Slice 2 — period-close event family + orchestration (D-REPORTING-CAPABILITY-SLICE-2)
author: Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; close orchestration owner) · Atlas (Core banking platform architect, engineering — substrate consult)
date: 2026-05-10
summary: Three new event types — `AccountingPeriodOpened`, `AccountingPeriodClosed`, `TrialBalanceSnapshotted` — registered with typed Zod payload schemas + RETENTION_ACCOUNTING_7Y. New `@platform/accounting/period-close` orchestration helper composes them into a per-entity close transaction (TB compute → optional doc-store write → snapshotted-event append → EvSS Slice 2 snapshot under per-entity stream-key → AccountingPeriodClosed). Per pack §6 Slice 2 the close primitive is the unit of all subsequent prudential / IFRS reports. Authored under standing approval `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10).
decision-required: false
decision-id: D-REPORTING-CAPABILITY-SLICE-2
decision-category: near-term
decision-owner: Bea (Accounting & financial reporting engineer)
---

# Reporting capability Slice 2 — period-close event family + orchestration

**Authors.** Bea (Accounting & financial reporting engineer, engineering — reports to Camille, Chief Financial Officer; close orchestration owner) · Atlas (Core banking platform architect, engineering — substrate consult; snapshot integration + stream-key convention).
**Standing authority:** `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10) — pack at [`Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md`](2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md) §6 Slice 2.
**Substrate decision:** `D-REPORTING-CAPABILITY-SLICE-2` (this record).
**Predecessor slice:** Slice 1 — semantic-layer registry skeleton (`D-REPORTING-CAPABILITY-SLICE-1`, 2026-05-10) — the registry that downstream BA-form generators read from; this slice's `TrialBalanceSnapshotted.rows` resolve through it.

---

## 1. What landed

The Slice 2 substrate that **every downstream BA-form / IFRS-statement generator (Slices 3-8) reads from**. Per pack §3.1 the period-close events sit between the projection runtime and the report generators in the engine pipeline:

```
EVENT LOG → PROJECTION RUNTIME → SEMANTIC LAYER → REPORT GENERATORS → RENDER + STORE
            ^^^^^^^^^^^^^^^^^^   (Slice 1)
            close orchestration
            (this slice)
```

Per pack §6 Slice 2 exit criterion:

- A simulated month-end close runs end-to-end: open period → ingest M1 trades for the period → close period → trial-balance hash written to RMS doc store → close-event-trail in event log.
- Recon: trial-balance debits = credits per entity per currency (asserted at construction).
- Substrate is shaped so Slice 3 (BA 325 LCR generator harness) can build against it without further platform work.

## 2. API surface

### 2.1 Event types (`prototype/platform/event-store/event-types.ts`)

| Event type | Payload (canonical fields) | Replay rule | Retention |
|---|---|---|---|
| `AccountingPeriodOpened` | `{ periodId, periodKind, periodStart, periodEnd, openedAt, functionalCurrency, reopenOf?, reopenReason? }` | `idempotent-terminal` on `(entity, periodId)` while period open | accounting 7y |
| `AccountingPeriodClosed` | `{ periodId, closedAt, trialBalanceSnapshotEventId, trialBalanceDocumentHash?, uptoSequence }` | `idempotent-terminal` on `(entity, periodId)` | accounting 7y |
| `TrialBalanceSnapshotted` | `{ periodId, snapshotKind, snapshotAsOf, uptoSequence, rows[], perCurrencyTotals[], documentHash? }` | `append-only-audit` | accounting 7y |

**Period-kind taxonomy** (`accountingPeriodKindSchema`): `month` / `quarter` / `half-year` / `year`. Quarterly + annual are regulatory-significant (BA-return cadence + AFS); monthly is internal close per `Owner Inbox/2026-05-06_core-policies-finance.md` §3.

**Snapshot kind** (`trialBalanceSnapshotKindSchema`): `close` (auto-emitted by close orchestration; durable; referenced from `AccountingPeriodClosed`) or `interim` (ad-hoc operational checkpoints; no close-event coupling).

**Reopen reason** (enum on `AccountingPeriodOpened.reopenReason`): `post-close-adjustment` / `audit-finding` / `regulator-direction` / `restatement-prior-period-error` / `operational-correction`.

Each constructor (`makeAccountingPeriodOpened` / `makeAccountingPeriodClosed` / `makeTrialBalanceSnapshotted`) takes an optional `provenance` field. Callers supply the typed tag:

```typescript
import { simulatedTag, productionTag } from "@platform/event-store/provenance";

// Production close (live reporting)
const provenance = productionTag({ sourceLineage: "agent:bea:period-close" });

// Simulated close (dry-run scenario)
const provenance = simulatedTag({
  scenario: "first-dry-run-2026-Q1",
  sourceLineage: "agent:bea:period-close",
});
```

The `provenance-substrate-active` flag is currently `false` (per PR #161 — flips when downstream emitter migration lands), so untagged appends are tolerated; the constructors are forward-compatible for the flag flip.

### 2.2 Zod boundary invariants

**`AccountingPeriodOpened`:**
- `periodEnd > periodStart` (no inverted / zero-length periods).
- `reopenOf` and `reopenReason` are paired — both or neither (every reopen carries a typed reason; reasons without a referent are rejected).
- `functionalCurrency` is exactly 3 letters (ISO 4217; Principle 5).

**`AccountingPeriodClosed`:**
- `uptoSequence ≥ 0`.
- `trialBalanceSnapshotEventId` non-empty (every close cites a snapshot).

**`TrialBalanceSnapshotted`:**
- `perCurrencyTotals[i].debitMinor === creditMinor` per currency (the trial-balance invariant, asserted at construction; unbalanced totals are a substrate-integrity violation that fails before the event hits the store).
- `rows[]` sum to `perCurrencyTotals[]` per currency (forensic consistency — no totals-vs-rows drift).
- `leafAccountId` matches `^ACC-[A-Za-z0-9-]+$` (relaxed regex accepts both chart-of-accounts strict form `ACC-NNNN-NNN` and M1 stub form `ACC-equity-position-stub`; chart strict form is enforced upstream at `chartOfAccountsRefSchema` in the bank-account event family).

### 2.3 Orchestration helper (`prototype/platform/accounting/period-close.ts`)

```ts
function periodCloseStreamKey(entity: string): string;   // "<entity>|accounting-period"

function openPeriod(args: OpenPeriodArgs): OpenPeriodResult;
function computeTrialBalance(args: ComputeTrialBalanceArgs): TrialBalance;
function closePeriod(args: ClosePeriodArgs): ClosePeriodResult;
function periodAuditChain(args: { eventStore; entity; periodId }): readonly Event[];
```

**`openPeriod`** is idempotent on identical (entity, periodId) payload (no-op return); refuses to open an already-open period with a different payload; refuses to re-open a closed period without explicit `reopenOf` chain (audit-sensitive).

**`computeTrialBalance`** is a pure fold of M1 `SubLedgerPostingEmitted` events scoped to (entity, [periodStart, periodEnd]). Sign convention: positive `amountMinor` = debit balance; negative = credit balance. Zero-net rows are dropped (closed accounts that netted to zero); per-currency totals derive from surviving rows.

**`closePeriod`** runs the five-step transaction:

1. **Compute** the trial balance for the period.
2. **Optionally write** the trial-balance JSON to the RMS document store (BLAKE3 content-addressed; only when `documentStore` argument supplied).
3. **Append** `TrialBalanceSnapshotted` (kind: `close`) with rows + per-currency totals + optional document hash.
4. **Snapshot** the trial balance via `eventStore.snapshot({ streamKey: '<entity>|accounting-period', asOf: closedAt, uptoSequence, payload })` — caches the trial balance for `replayFromSnapshot` consumers per D-EVENT-STORE-SCALING Slice 2 (PR #143).
5. **Append** `AccountingPeriodClosed` referencing the snapshot's `event_id` + optional document hash.

All five steps share the same `closedAt`. The orchestrator returns the typed result for the caller's audit trail.

## 3. Per-entity isolation

Per pack §6 Q2 (per-entity sub-ledgers): each Hoz legal entity (LE-ZA-HOZ-BANK, LE-ZA-HOZ-SECURITIES, LE-ZA-HOZ-GROUP consolidated rollup) closes independently. The orchestrator scopes every replay/append to `args.entity`; the snapshot stream-key partitions per-entity (`<entity>|accounting-period`) so `loadSnapshot(streamKey, asOf)` resolves the latest period-end snapshot ≤ asOf without cross-entity bleed.

Worked test: two entities open + close their own period in the same `EventStore`; postings on entity A do not flow into entity B's TB; per-entity snapshot streams are distinct (`prototype/tests/period-close.test.ts` — `D-REPORTING-CAPABILITY-SLICE-2 — per-entity isolation`).

## 4. Reopen audit chain

Pack §6 Slice 2 specifies an audit-sensitive reopen flow. Per Principle 1 (events are truth, append-only-audit) the substrate models reopen by:

1. Appending a NEW `AccountingPeriodOpened` event with `reopenOf` = `event_id` of the prior `AccountingPeriodClosed`, and `reopenReason` = typed enum.
2. Appending a NEW `TrialBalanceSnapshotted` (when reclosing).
3. Appending a NEW `AccountingPeriodClosed` event referencing the new snapshot.

The forensic chain for a (entity, periodId) is readable via `periodAuditChain()`; it returns every open + close + snapshot event in append order (`AccountingPeriodOpened → TrialBalanceSnapshotted → AccountingPeriodClosed → AccountingPeriodOpened (reopen) → TrialBalanceSnapshotted → AccountingPeriodClosed`).

The prior close event is **never overwritten** (matches the IFRS / IAS 1 / Companies Act 71/2008 s.28-30 audit-trail expectation for restatements).

**Manual journal entries during close** are NOT modelled as a new event type — they reuse the existing M1 `SubLedgerPostingEmitted` with a `closeAdjustment: true` flag carried in the existing payload's `postingMemo` field plus a citation linking to the open period. This avoids duplicating the sub-ledger event family and keeps the GL-projection's fold a single function over `SubLedgerPostingEmitted`.

## 5. Snapshot integration (D-EVENT-STORE-SCALING Slice 2)

Stream-key convention per pack §6 Q2 + D-EVENT-STORE-SCALING Slice 2 Q4: `<entity>|accounting-period`. Every close-snapshot for an entity flows through one logical stream so `loadSnapshot(streamKey, asOf)` resolves the latest period-end snapshot ≤ asOf.

Snapshot payload shape (JSON-stringified, opaque to the event store):

```json
{
  "periodId": "period:hoz-bank:month:2026-05",
  "asOf": "2026-06-01T00:00:00.000Z",
  "uptoSequence": 42,
  "rows": [...],
  "perCurrencyTotals": [...],
  "trialBalanceSnapshotEventId": "evt-...",
  "documentHash": "blake3:..."
}
```

The snapshot is a denormalised cache; the canonical truth is the event log. Downstream consumers (Slice 3 BA 325 generator; Slice 6 capital-stack projection; Slice 8 AFS skeleton) call `replayFromSnapshot({ streamKey, asOf, filter: { type: "SubLedgerPostingEmitted" } })` to bootstrap from the latest period-end snapshot and replay only the delta — sub-second response on multi-million-event streams (per D-EVENT-STORE-SCALING Slice 2 design brief §4.2).

## 6. Substrate gaps surfaced (forward-link)

Four explicit gaps surfaced when authorising this slice. Slice 2 closes the period-close primitive; the others are downstream-slice scope or follow-on recon.

| Gap | Slice / dispatch that closes | Owner |
|---|---|---|
| **Period-close event family + orchestration** | Slice 2 (this) | Bea + Atlas |
| **BA 325 (LCR) generator harness** — `@domains/reporting/ba` package + first worked generator on top of the snapshot APIs | Slice 3 (pre-M2) | Bea + Eitan + Anya |
| **Capital-stack / liquidity / RWA projections** — three new projections that drive BA 100/110/120/200/210/300/325/326/330/350/410/900-series cell outputs | Slice 6-7 (M3) | Helena + Bea + Eitan + Anya |
| **IFRS statement renderer** — AFS skeleton emitting Statement of Financial Position, P&L+OCI, SOCIE, Statement of Cash Flows; `recon:afs-trial-balance-tie` consumes `TrialBalanceSnapshotted.rows` | Slice 8 (M3) | Bea + Camille (signer) |

Two follow-on substrate items deferred from Slice 2 to avoid concurrency clashes / scope creep:

- **Multi-writer guard for close orchestration.** Today's orchestrator assumes single-writer per (entity, periodId) — two simultaneous `closePeriod` calls for the same key would race. Substrate fix is a Vera continuous-controls recon (`recon:period-close-single-writer`) that asserts exactly one `AccountingPeriodClosed` per (entity, periodId) per snapshot-asOf.
- **Chart-of-accounts coverage.** M1 stub leaf account IDs (`ACC-equity-position-stub`, `ACC-pending-settlement-stub`) flow through the trial balance unchanged. Chart population lands at M2 per Bea M1 substrate-gap §3 (`prototype/platform/accounting/_chart-of-accounts.md`). The trial-balance row regex was relaxed to `^ACC-[A-Za-z0-9-]+$` for forward-compat; the strict `ACC-NNNN-NNN` form is enforced upstream at `chartOfAccountsRefSchema` (bank-account event family).

A **`recon:trial-balance-rec` recon pipeline** (per pack §8) is a Vera follow-on that consumes the `TrialBalanceSnapshotted` event stream and asserts:

- Per-(entity, periodId, snapshotAsOf) — debits = credits per currency at the totals level (already enforced at construction; recon catches future regression if the Zod validator is bypassed).
- Per-(entity, periodId) — at most one `close`-kind snapshot per AccountingPeriodOpened cycle.
- For every `AccountingPeriodClosed` event, a matching `TrialBalanceSnapshotted` event exists with `event_id === trialBalanceSnapshotEventId`.

The pipeline touches `@platform/recon` shared infrastructure and is deferred to a follow-on Vera dispatch to avoid the runtime-handler-sync surface (per `feedback_handlers_metadata_three_way_clash`).

## 7. M8 Azure mapping

When the cloud lift lands (Atlas D-EVENT-STORE-SCALING Slice 7-8, RMS Phase 2-4), the substrate maps to:

- **Snapshot substrate**: Cosmos DB Core SQL collection partitioned on `streamKey` — already lift-compatible; consumers see no API change. Per-entity stream-key partition matches Cosmos's per-partition-key throughput model.
- **Document store**: Azure Blob Storage + Managed-HSM key envelope per RMS spec §4.1. The `DocumentStore` interface is already call-site-compatible (`put` / `get` / `exists` / `metadata` map to `UploadBlob` / `DownloadBlob` / `Exists` / `GetProperties`).
- **Orchestration helper**: pure-function shape; runs unchanged on Azure Functions / Container Apps / dedicated AKS workload. No state outside the event store + document store.

Mirrors the architectural seam pattern established for `@platform/event-store` (which lifts to Cosmos DB Core + Event Hubs change-feed without consumer changes — Principle 3).

## 8. What was NOT changed (respect parallel work)

- `prototype/platform/event-store/store.ts` — read-only (snapshot APIs consumed as-is from D-EVENT-STORE-SCALING Slice 2).
- `prototype/platform/event-store/permission-gate.ts` — untouched (T-01 critical fix is parallel; no collision).
- `prototype/platform/event-store/handlers-metadata.ts` + `handler-callables.ts` + `package.json` — untouched (no new handler this slice; the orchestration is a pure-function library, not a runtime handler — sidesteps the three-way clash pattern per `feedback_handlers_metadata_three_way_clash`).
- `prototype/platform/projections/runtime.ts` — read-only (consumer-side; downstream slices wire projections that consume close events).
- `prototype/platform/semantic/*` — read-only (Slice 1 `@platform/semantic` substrate respected).
- `prototype/platform/document-store/*` — read-only (RMS Slice 1 substrate consumed via `DocumentStore` interface).
- `dashboard/derive.ts` — untouched (RMS Slice 4 dashboard render is parallel work).

## 9. Tests + recon

`prototype/tests/period-close.test.ts` — 29 unit tests covering:

- **Registry coverage** — all three event types registered in `EVENT_TYPE_REGISTRY` with typed Zod payload schemas + RETENTION_ACCOUNTING_7Y (Companies Act 71/2008 s.24).
- **Zod payload validation** — canonical payloads accepted; boundary violations rejected (period-date inversion; reopen-without-reason; reason-without-reopenOf; per-currency unbalanced totals; rows-vs-totals mismatch; non-3-letter currency; non-ACC-prefixed leaf account ID; negative `uptoSequence`).
- **`make…()` constructors** — produce parseable Events with provenance threading.
- **`openPeriod` orchestration** — appends on first open + idempotent on identical re-open (only one event in log); refuses re-open of closed period without `reopenOf`; refuses identical-id open with different payload.
- **`closePeriod` end-to-end** — computes balanced trial balance from M1 SubLedgerPostingEmitted (5m + 2m debits → balanced ZAR TB); writes to optional doc-store with content-addressed hash; emits `TrialBalanceSnapshotted` referencing hash; triggers EvSS Slice 2 snapshot under per-entity stream-key; appends `AccountingPeriodClosed` referencing snapshot event_id + document hash; refuses double-close + close-without-open.
- **Per-entity isolation** — two entities each open + close their own period; postings on entity A do not flow into entity B's TB; per-entity snapshot streams distinct.
- **Reopen audit trail** — open → close → reopen (with `reopenOf` + `reopenReason: "audit-finding"`) → reclose chain readable via `periodAuditChain()`; six events in canonical order; reopen payload carries reopenOf chain to first close; reclose references the second TB snapshot.
- **`computeTrialBalance` round-trip** — postings outside [periodStart, periodEnd] excluded; zero-net cancelling pairs dropped from rows + per-currency totals.

All 29 pass. Full suite: 811 / 811 tests pass after this slice. Full `bun run ci` invoked pre-PR (typecheck + lint + test + citation-gate + 13 recons).

## 10. Authority

Standing CEO authority: `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10) authorises Slice 2 dispatch without further pause per `feedback_no_pause_rule`. This slice is the substrate-level expression of that authority; the `CeoDecision` event with `decisionId: D-REPORTING-CAPABILITY-SLICE-2` is emitted via `prototype/scripts/record-d-reporting-capability-slice-2.ts` for the dashboard's resolved-decisions derivation.

No new CEO decision required.

## 11. Change log

| Date | Author | Change |
|---|---|---|
| 2026-05-10 | Bea + Atlas | Initial publication of `D-REPORTING-CAPABILITY-SLICE-2` substrate — three event types + orchestration helper + 29 tests + this record + emitter script. |
