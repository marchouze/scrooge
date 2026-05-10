# `@platform/semantic` — semantic-layer registry

**Standing authority:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10) — Slice 1 (semantic-layer registry skeleton).

**Source pack:** [`Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md`](../../../Owner%20Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md) §3.1 (engine pipeline) + §6 Slice 1 (semantic-layer registry skeleton).

**Owner:** Anya (Data / analytics engineer, engineering — reports to Devon COO; semantic-layer + projection-runtime curator).
**Reviewer:** Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO).
**Slice 1 status:** in-force (3 worked entries: `Balance`, `Exposure`, `CashAndBalancesAtSARB`).

## What this module is

The semantic layer is the bank's **typed business-vocabulary above the event log**. Every named quantity the bank reports — `Balance`, `Exposure`, `RWA`, `CET1`, `LCR`, `NSFR`, `ECL` stage — has exactly one definition, exactly one citation chain, and one projection-derived computation. The same number reaches the BA return, the AFS note, the BRC pack, and the regulator submission.

The pack's architectural sketch (§3.1):

```
EVENT LOG               (P1 — sole truth)
   → PROJECTION RUNTIME (pure folds; replayable)
   → SEMANTIC LAYER     (THIS MODULE — typed quantity registry)
   → REPORT GENERATORS  (pure functions over semantic queries)
   → RENDER + STORE     (RMS document store)
```

This module sits at the third tier. It does not own events (`@platform/event-store`), does not own projections (`@platform/projections`), does not own report generators (`@domains/reporting/*` — Slice 3+ substrate, not yet in this codebase). It is **the typed contract** the report generators read from.

## What Slice 1 ships

Three worked entries that exercise the registry's dimensional patterns:

| Entry | Purpose | Demonstrates |
|---|---|---|
| `Balance` | Money-units balance of a GL account, sliced by entity / currency / IFRS classification | The most general money-units entry — every other balance-derived quantity composes it |
| `Exposure` | Counterparty-level exposure sliced by counterparty / kind / currency | Multi-counterparty / multi-kind dimensions; rehearsal-grade with one TBC placeholder per pack §9 Q1 |
| `CashAndBalancesAtSARB` | Pinned to chart-of-accounts row `ACC-1100-001` (Hoz Bank only) | Full upward chain: account → IFRS 9 amortised-cost → IAS 1 SoFP → BA 325 HQLA Level-1 → ORG-PR-06 + ORG-AC-01 anchors. **No placeholders.** |

## API surface

```ts
import {
  SemanticRegistry,
  SLICE_1_ENTRIES,
  type SemanticEntry,
  type SemanticEntryRef,
} from "@platform/semantic";

// Construct
const registry = SemanticRegistry.from(SLICE_1_ENTRIES);

// Resolve in-force version
const balanceEntry = registry.resolve({ id: "Balance" });

// Resolve specific version (for as-of replay)
const v01 = registry.resolve({ id: "Balance", version: "v0.1" });

// Enumerate
const inForce = registry.listInForce();
const allBalanceVersions = registry.listAllVersionsOf("Balance");

// Recon-pipeline-friendly snapshot
const coverage = registry.citationCoverage();
//   → CitationCoverageRow[] with placeholder vs resolved counts per entry
```

## What Slice 1 does NOT ship

These are downstream slice scope (see pack §6 Slice 2-8):

- **`MetricRegistered` / `SemanticEntryRegistered` typed events** — Slice 2/3 follow-on. Today's registry is the typed in-memory form; the event family lands when the period-close events do (avoids two A0 schema-freeze cycles in close succession).
- **`recon:semantic-layer-citation-coverage` recon pipeline.** Per pack §8.5 Vera Wave-N follow-on. The registry's `citationCoverage()` method is the data source; the pipeline that consumes it is a separate dispatch (avoids touching `@platform/recon` shared infrastructure in this slice — see `feedback_handlers_metadata_three_way_clash`).
- **Projection wiring.** Each entry names the projection it depends on (`gl-projection`, `exposure-projection`); building those projections is Slice 4-6 (M2-M3) substrate. Slice 1 stores the *definition*, not the executable form.
- **Formula execution.** Each entry's `formula` field is human-readable documentation. The executable form lives in the report generators (Slice 3+) which import the entry, read its `projection` field, and run the named projection through `@platform/projections`.
- **BA-return generators / AFS skeleton.** Slice 3-8.

## Substrate consumed (cite, don't rebuild)

- `prototype/platform/event-store/registry.ts:965-1029` — existing M1 `IfrsClassificationApplied` + `SubLedgerPostingEmitted` event types that downstream projections fold over (read-only from this slice).
- `prototype/platform/event-store/store.ts:51-79` — `replayFromSnapshot` API (Atlas D-EVENT-STORE-SCALING Slice 2, PR #143). Future projections backing semantic entries will adopt this for as-of efficiency (already wired in `prototype/platform/projections/runtime.ts` per PR #148).
- `prototype/platform/projections/runtime.ts` — pure-fold `Projector` interface; the registry stores projection *names*, the runtime executes them.
- `prototype/platform/accounting/_chart-of-accounts.md` + `chart-of-accounts.schema.json` — account taxonomy. `CashAndBalancesAtSARB` is pinned to `ACC-1100-001`.
- `Regulations/_legal-entity-tree.md` — canonical `urn:legal-entity:hoz:*:v1` form for `entityScope`.
- `Regulations/_obligations-register.md` — every `regulation`-form citation resolves against this register.

## Principles bound

- **P1 (events are truth):** every entry's `projection` field names a projection; values are always recomputed by replay.
- **P2 (citation discipline):** `register()` rejects entries with empty `citations`; the recon pipeline (deferred to follow-on slice) audits resolvability.
- **P5 (multi-currency, multi-entity):** `currency` and `entityScope` are first-class dimensions; URN-format check enforced at boundary.
- **P6 (single-graph):** every entry IS a node — `citations` carry upward anchors; `projection` + `formula` carry downward derivation.
- **P7 (autonomous-by-default):** Anya curates on continuous cadence; new entries land via PRs that pass the citation-coverage recon (deferred).

## M8 Azure mapping

When the cloud lift lands (Atlas D-EVENT-STORE-SCALING Slice 7-8), the in-memory registry is replaced by **Azure Cosmos DB Core** with cross-region replication, partition key `{entryId}`, point-in-time-restore for as-of registry queries. The `SemanticRegistry` class becomes a thin client over Cosmos; the `SemanticEntry` shape is unchanged. Consumers (Slice 2-8 generators) see no API change — Principle 3 architectural seam, mirrors how `@platform/event-store` will swap to Cosmos + Event Hubs.

## What lands next (Slice 2-3)

Per pack §6:

- **Slice 2 (pre-M2, ~1.5 sessions):** period-close event family + `bea-period-close` handler (Bea + Atlas). Emits `AccountingPeriodOpened`, `AccountingPeriodClosed`, `TrialBalanceSnapshotted`. Trial-balance hash stored in RMS doc store.
- **Slice 3 (pre-M2, ~2 sessions):** BA 325 LCR generator harness (Bea + Eitan + Anya). First worked end-to-end return; consumes `CashAndBalancesAtSARB` from this registry.
