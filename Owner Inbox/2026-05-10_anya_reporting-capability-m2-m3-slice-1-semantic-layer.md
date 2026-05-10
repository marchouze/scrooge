---
title: Reporting capability Slice 1 — semantic-layer registry skeleton (@platform/semantic)
author: Anya (Data / analytics engineer, engineering)
date: 2026-05-10
summary: Lands the typed semantic-layer registry that Slice 2 (period-close events) and Slice 3 (BA 325 LCR generator harness) consume. Three worked entries — Balance, Exposure, CashAndBalancesAtSARB — exercise the registry's dimensional patterns; CashAndBalancesAtSARB is the fully-cited worked example pinned to chart-of-accounts ACC-1100-001.
decision-required: false
decision-id: D-REPORTING-CAPABILITY-SLICE-1
---

# Reporting capability Slice 1 — semantic-layer registry skeleton

**Author:** Anya (Data / analytics engineer, engineering — reports to Devon, Chief Operating Officer; semantic-layer + projection-runtime curator)
**Reviewer:** Bea (Accounting & financial reporting engineer, engineering — reports to Camille, Chief Financial Officer)
**Standing authority:** D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10) — pack at [`Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md`](2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md) §6 Slice 1.
**Substrate decision:** D-REPORTING-CAPABILITY-SLICE-1 (this record).

---

## 1. What landed

The `@platform/semantic` package — pre-M2 substrate that **every downstream slice (2-8) reads from**. Per pack §3.1 the semantic layer is the third tier of the engine pipeline:

```
EVENT LOG → PROJECTION RUNTIME → SEMANTIC LAYER → REPORT GENERATORS → RENDER + STORE
                                  ^^^^^^^^^^^^^^
                                  this slice
```

Per pack §6 Slice 1 exit criterion:

- Three worked entries (`Balance`, `Exposure`, `CashAndBalancesAtSARB`) **register, resolve, and pass citation coverage** against the existing M1 substrate.
- The substrate is shaped so Slice 2 (period-close event family) and Slice 3 (BA 325 LCR generator harness) can build against it without further platform work.

## 2. API surface

### 2.1 Types (`prototype/platform/semantic/types.ts`)

```ts
type SemanticUnit = "money-minor" | "ratio" | "count" | "percent" | "scalar";

type SemanticDimension =
  | "currency" | "account" | "counterparty" | "exposureKind"
  | "rwaApproach" | "capitalTier" | "eclStage"
  | "ifrsClassification" | "portfolio" | "hqlaLevel";

type SemanticCitation =
  | { type: "regulation"; regulationId: string; note?: string }
  | { type: "policy"; policyRef: string; section?: string; note?: string }
  | { type: "ifrs"; ifrsRef: string; note?: string }
  | { type: "statute"; statuteRef: string; note?: string }
  | { type: "tbc"; note: string };

type SemanticSigner =
  | "Anya" | "Bea" | "Camille" | "Helena" | "Eitan" | "Mira";

interface SemanticEntry {
  id: SemanticEntryId;        // PascalCase, stable
  version: string;            // /^v[0-9]+\.[0-9]+$/
  description: string;
  units: SemanticUnit;
  dimensions: SemanticDimension[];
  projection: string;         // names a projection in @platform/projections
  formula: string;            // human-readable; executable form lives in generators
  regulatoryCells?: RegulatoryCellMapping[];   // BA-form cell mappings
  ifrsLines?: IfrsLineMapping[];               // AFS / IFRS line mappings
  citations: SemanticCitation[];               // ≥1 (P2)
  signers: SemanticSigner[];                   // ≥1
  entityScope: string[];                       // ≥1; urn:legal-entity:hoz:*:vN
  ifrsClassifications?: IfrsClassification[];
  status: "draft" | "in-force" | "superseded" | "deprecated";
  supersededBy?: { id; version };
  firstAuthored: string;      // ISO-8601
  notes?: string;
}
```

### 2.2 Registry (`prototype/platform/semantic/registry.ts`)

Append-only-versioned in-memory registry. Constructor or `SemanticRegistry.from(entries)`.

```ts
class SemanticRegistry {
  static from(entries: readonly SemanticEntry[]): SemanticRegistry;

  register(entry: SemanticEntry): void;          // throws on invariant violation
  resolve(ref: SemanticEntryRef): SemanticEntry | undefined;
  listInForce(): SemanticEntry[];
  listAll(): SemanticEntry[];
  listAllVersionsOf(id: SemanticEntryId): SemanticEntry[];
  citationCoverage(): CitationCoverageRow[];     // recon-pipeline-friendly
  size(): number;
}
```

### 2.3 Boundary invariants (enforced at `register()`)

- `(id, version)` uniqueness — duplicate registration throws.
- ≥1 citation per entry (P2).
- ≥1 signer per entry.
- ≥1 entity-scope URN, each matching `urn:legal-entity:<group>:<entity>:vN` (P5; matches canonical form per `Regulations/_legal-entity-tree.md`).
- Single in-force version per id at any time (older versions must be marked `superseded` first).
- `superseded` status requires `supersededBy` to point at a registered entry.

## 3. Worked entries

| Entry | Units | Entity scope | Citations | Notes |
|---|---|---|---|---|
| `Balance` | money-minor | All three (Hoz Group + Bank + Securities) | 5 resolved (IAS 1, IFRS 9, ORG-AC-01, ORG-AC-08, policy stub) | The most general money-units entry; every other balance-derived quantity composes it |
| `Exposure` | money-minor | Hoz Bank + Hoz Group | 1 resolved (ORG-PR-09) + 1 TBC | Multi-counterparty / multi-kind; one TBC placeholder per pack §9 Q1 default (rehearsal-grade with placeholders) |
| `CashAndBalancesAtSARB` | money-minor | Hoz Bank only | 6 resolved, 0 placeholders | Pinned to chart-of-accounts ACC-1100-001; full upward chain to ORG-PR-06 (BCBS D295 LCR HQLA L1) + ORG-AC-01 (IFRS 9) + IAS 1 §54(i); feeds BA 300 + BA 325 + BA 100 (memo) |

## 4. Per-entity / per-IFRS / per-regulatory-cell shape

Per pack §9 Q2 (default — per-entity sub-ledgers): every entry's `entityScope` lists the legal entities it is defined for. Returns are produced **per-entity** then rolled up to consolidated through a typed consolidation projection (Slice 6/7 substrate).

- **Per-entity slicing.** `entityScope` uses the canonical URN form (`urn:legal-entity:hoz:hoz-{group|bank|securities}:v1`) per `Regulations/_legal-entity-tree.md`. URN-format check enforced at `register()` boundary.
- **Per-IFRS-classification slicing.** `ifrsClassifications` declares which IFRS-9 classification slices the entry supports. `Balance` declares all six (`amortised-cost` through `equity`); `CashAndBalancesAtSARB` declares only `amortised-cost` (held-to-collect, SPPI).
- **Per-regulatory-cell mapping.** `regulatoryCells` carries `{ form, line, side, note }` mappings. Mirror of the `baReturnLines` shape on `chart-of-accounts.schema.json` so the discipline binds across both registers.
- **Per-IFRS-line mapping.** `ifrsLines` carries `{ statement, line, side, note }` for AFS-line mappings (Slice 8 consumer).

## 5. Snapshot integration

The registry **does not currently emit `SemanticEntryRegistered` events.** Per pack §3.3 + Atlas's D-EVENT-STORE-SCALING Slice 2 (PR #143), the snapshot API is for *projection state*, not for registry content. Two architectural options for downstream:

1. **Event-sourced registry (likely)** — Slice 2 introduces a `SemanticEntryRegistered` typed event in the same A0 schema-freeze cycle as the period-close events. The registry then becomes a projection over that event stream, snapshottable per the Slice-3 consumer-adoption pattern. **Deferred to Slice 2** to batch the schema-freeze cycle with period-close (avoids two A0 cycles in close succession).
2. **Build-time registry (alternative)** — keep the registry as a typed in-memory module (today's shape), with PRs the change-control surface. Less event-sourced; lower platform cost.

The Slice-1 substrate is shape-compatible with either path. Decision deferred to Slice 2.

## 6. M8 Azure mapping

When the cloud lift lands (Atlas D-EVENT-STORE-SCALING Slice 7-8), the in-memory registry maps to **Azure Cosmos DB Core** with:

- Partition key: `{entryId}` — high-cardinality enough to scale; supports cross-region replication.
- Point-in-time-restore enabled — supports as-of registry queries (the `(id, version)` ref pattern already shapes this).
- Cross-region replication: SA primary (proximate to SARB / FSCA / SARS), one DR region.

Consumers (Slice 2-8 generators) see no API change — `SemanticRegistry` becomes a thin Cosmos client; `SemanticEntry` shape is unchanged. Mirrors the architectural seam pattern Atlas established for `@platform/event-store` (which lifts to Cosmos DB Core + Event Hubs change-feed without consumer changes — Principle 3).

## 7. Substrate gaps remaining

Per pack §7, three explicit gaps surfaced when authorising this slice. Slice 1 closes the first; the other two are downstream-slice scope.

| Gap | Slice that closes | Owner |
|---|---|---|
| `@platform/semantic` package missing | Slice 1 (this) | Anya |
| Period-close event family + handler (`AccountingPeriodOpened`, `AccountingPeriodClosed`, `TrialBalanceSnapshotted`) | Slice 2 | Bea + Atlas |
| BA-return generator harness (`@domains/reporting/ba` + first worked BA 325 LCR) | Slice 3 | Bea + Eitan + Anya |

Two follow-on substrate items deferred from Slice 1 to avoid concurrency clashes:

- **`SemanticEntryRegistered` typed event family** — deferred to Slice 2 to batch with period-close A0 schema-freeze (avoids two A0 freeze cycles in close succession).
- **`recon:semantic-layer-citation-coverage` recon pipeline** — deferred to a follow-on Vera / Anya dispatch. The `citationCoverage()` method on the registry already produces the data shape; the pipeline that consumes it touches `@platform/recon` shared infrastructure and should not collide with the in-flight runtime-handler-sync surface (per `feedback_handlers_metadata_three_way_clash`).

## 8. What was NOT changed (respect parallel work)

- `prototype/platform/event-store/event-types.ts` — read-only.
- `prototype/platform/event-store/registry.ts` — read-only.
- `prototype/platform/projections/runtime.ts` — respect Rohan + Anya's PR #148 (Atlas D-EVENT-STORE-SCALING Slice 3 consumer adoption).
- `dashboard/derive.ts` — respect parallel Anya + Atlas Owner-Inbox presentation work.
- `prototype/platform/recon/*` — no new pipeline this slice (deferred per §7).
- `prototype/platform/event-store/handlers-metadata.ts` + `handler-callables.ts` + `package.json` — untouched (no new handler this slice; avoids the three-way clash pattern).

## 9. Tests + recon

`prototype/tests/semantic-registry.test.ts` — 27 unit tests covering:

- Construction from `SLICE_1_ENTRIES` (pack §6 Slice 1 exit).
- `resolve()` by bare id (in-force lookup), by `(id, version)`, undefined for unknown id / version.
- `listInForce()` returns all three Slice 1 entries.
- Citation coverage — `CashAndBalancesAtSARB` zero-placeholder; `Exposure` one-placeholder per pack §9 Q1 default; `Balance` zero-placeholder; one row per entry.
- Structural invariants — duplicate `(id, version)` rejection; empty-citations rejection (P2); empty-signers rejection; empty-entityScope rejection (P5); URN-format rejection; version-format rejection; double-in-force rejection; supersession integrity (missing `supersededBy`; non-existent replacement).
- Versioning — append-only versioning supports v0.1 → v0.2 in-force handoff via supersession.
- Pack §6 Slice 1 acceptance — `Balance` dimensions; `Exposure` dimensions; `CashAndBalancesAtSARB` pinned to Hoz Bank + ACC-1100-001 in formula + feeds BA 325 HQLA Level-1; every entry ≥1 citation; ≥1 signer; canonical URN form.

All 27 pass. Full `bun run ci` invoked pre-PR.

## 10. Authority

Standing authority: CEO-approved 2026-05-10 — `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (Bea + Atlas pack adopted with all five Q-defaults). The pack named Slice 1 dispatch-ready on approval; this record is the substrate-decision sub-authorisation that lands the deliverable.

— Anya
