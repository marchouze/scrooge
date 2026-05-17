---
title: Data-provenance substrate Slice 2 — projection-runtime mode selection + filtering
author: Anya (Data / analytics engineer, engineering — projection runtime)
date: 2026-05-10
summary: ProvenanceFilter type added; LocalProjector.projectFromSnapshot and maybeSnapshot accept a filter (env-derived default from BANK_PHASE); snapshot rows isolated by filter-digest stream key so cross-mode reads cannot cross-contaminate; Rohan backtest harness migrated to production-only default with env override; 22 new tests cover round-trip per mode, snapshot isolation, narrowing, env-default behaviour. Substrate gaps remaining: Slice 3 watermarking, Slice 4 combined aggregations.
decision-required: false
decision-id: D-DATA-PROVENANCE-SUBSTRATE-SLICE-2
decision-category: medium-term
decision-owner: Anya (Data / analytics engineer, engineering)
---

# Data-provenance substrate Slice 2 — projection-runtime mode selection + filtering

**Author:** Anya (Data / analytics engineer, engineering — projection runtime)
**Reports to:** Devon (COO, governance — operational resilience)
**Date:** 2026-05-10
**For:** record (no CEO decision required — standing authority `D-DATA-PROVENANCE-SUBSTRATE`).
**Authority:**
- `D-DATA-PROVENANCE-SUBSTRATE` (CEO-approved 2026-05-10) — slice sub-authorisation under standing approval per CLAUDE.md "Dispatch discipline" → "No-pause rule".
- `Owner Inbox/actioned/2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md` §5 (projection-runtime mode selection) + §7 row 2 (Slice 2 exit criterion).
- CLAUDE.md Principle 1 — events are the only source of truth (the filter is a query over the canonical log; no parallel store).
- CLAUDE.md Principle 5 — multi-axis envelope dimensions are first-class typed primitives (provenance is structurally similar to currency / entity).
- `D-EVENT-STORE-SCALING` Slice 3 (PR #148) — substrate this slice extends.
- `D-DATA-PROVENANCE-SUBSTRATE` Slices 6+1 (PR #161) — substrate this slice consumes.

---

## 1. What landed

### 1.1 New module — `prototype/platform/projections/filter.ts`

Carries:

- `ProvenanceFilter` type — `{ mode, scenarios?, variants?, sourceLineages? }`. The `mode` axis is the primary discriminator; the array axes are narrowing (empty array ≡ omitted).
- `ProvenanceMode` type — `"production-only" | "simulated-only" | "combined"`.
- `defaultProvenanceMode()` + `defaultProvenanceFilter()` — env-derived from `BANK_PHASE`. Returns `simulated-only` for `build` (or unset, which is the current state); returns `production-only` for `licence-day` and `live`.
- `setDefaultProvenanceModeOverride()` — process-local override hook for tests + operators.
- `eventMatchesProvenanceFilter(event, filter)` — predicate applied to every event during fold. Untagged legacy events (no `provenance` field) are treated as `simulated` per CLAUDE.md "Operating model" (build phase has only simulated data).
- `provenanceFilterDigest(filter)` — 12-hex-char SHA-256 prefix of the canonicalised filter JSON. Deterministic; collides only when filters produce the same result set (sorted axes; empty arrays absorbed).
- `effectiveStreamKey(baseKey, filter)` — composes `${baseKey}#prov=${digest}`.

### 1.2 API surface change — `Projector.projectFromSnapshot` + `Projector.maybeSnapshot`

Both methods now accept an optional `provenanceFilter` on their opts. When omitted the runtime computes `defaultProvenanceFilter()`. The runtime:

1. Computes the **effective stream key** (`baseKey#prov=<digest>`) and uses it for every call into the EventStore snapshot APIs (`loadSnapshot`, `replayFromSnapshot`, `shouldSnapshot`, `snapshot`).
2. Applies the filter predicate to every event before the projection's own `accepts` predicate during fold.
3. Returns the resolved `provenanceFilter` in the result so consumers can confirm which mode the state was computed under.

### 1.3 Snapshot-key digest strategy

Per pack §5.1, snapshot keys gain the filter digest as a third axis. We achieve this **without any EventStore schema change** by composing the digest into the stream-key string at the projection-runtime layer. The `snapshots.UNIQUE(stream_key, as_of, upto_sequence)` constraint then naturally distinguishes parallel snapshots computed under different filters.

Trade-off considered: an alternative is to add a fourth column to the `snapshots` table (`provenance_filter_digest`). The chosen approach keeps the EventStore unchanged and isolates the dimension to the runtime — which is correct architecturally because the digest is a *projection-runtime concept*, not an event-store concept. A future Slice can promote the digest to a typed column if/when query-time filtering needs it; today the runtime is the only consumer.

### 1.4 Consumer migrated — Rohan's backtest harness

`prototype/runtime/agents/rohan-backtest-harness.ts` updated:

- New helper `backtestProvenanceFilter()` — defaults to `production-only` (backtests are real risk decisions per spec §13 Helena hook); env override `BANK_BACKTEST_PROVENANCE_MODE=simulated-only|combined` lets operators toggle for rehearsal.
- `buildSignalProjection()` composes the effective stream key (`backtestStreamKey(entity)#prov=<digest>`) for every snapshot lookup / persist; applies `eventMatchesProvenanceFilter` to every replayed event before the credit-critical predicate.
- Snapshot-persist branch in `runEclBacktest()` mirrors the same effective key.

### 1.5 Tests

`prototype/tests/projections-provenance-filter.test.ts` — **22 new tests** in 4 describes:

- *Round-trip per mode* — production-only / simulated-only / combined produce the expected counts; scenario / variant / sourceLineage narrowing.
- *Snapshot-key digest isolation* — a snapshot persisted under one filter is invisible to a request under another; re-snapshotting under a different filter creates a parallel row; cold-start equivalence under each mode.
- *BANK_PHASE-derived default mode* — unset → simulated-only; build → simulated-only; licence-day → production-only; live → production-only; explicit override wins.
- *Filter digest* — determinism + canonicalisation (array-axis order, empty arrays).
- *Legacy untagged events* — treated as simulated for filter purposes.

`prototype/tests/projections-snapshot.test.ts` — two assertions updated to inspect at the effective stream key. `prototype/tests/runtime-rohan-backtest.test.ts` + `runtime-rohan-backtest-snapshot.test.ts` — `BANK_BACKTEST_PROVENANCE_MODE=combined` pinned for fixture compatibility (fixtures use untagged-legacy events).

---

## 2. Backwards compatibility

- Filter omitted from opts → runtime computes env-derived default. No call-site needs to change to keep working under the build-phase default.
- `projectFromSnapshot` return type gains `provenanceFilter`; existing destructurings (`const { state }` etc.) are unaffected.
- EventStore APIs unchanged.
- Existing test count goes 678 → 700 (+22 net new); 0 failures.

---

## 3. Default-mode behaviour at licence-day cutover

**No code change required.** When operations flip `BANK_PHASE` from `build` to `licence-day` (or `live`):

- `defaultProvenanceMode()` returns `production-only`.
- Every consumer that did not pass an explicit `provenanceFilter` switches to `production-only` reads.
- Existing snapshots persisted under the build-phase `simulated-only` default remain valid for that filter; new reads under `production-only` see no snapshot (different digest) and degrade to naive replay until cadence persists fresh `production-only` snapshots.
- The cutover sequence is owned by `WS-PROVENANCE-CUTOVER-AT-LICENCE-DAY` (per pack §14), not this slice.

---

## 4. Substrate gaps remaining

Slices 3-8 of D-DATA-PROVENANCE-SUBSTRATE per pack §7. The gaps this slice **does not** close:

1. **Slice 3 — Output watermarking + recon.** Dashboard tile `<ProvenanceBadge>`, PDF templates, `recon:provenance-badge-coverage`. Separate dispatch (Anya + dashboard layer).
2. **Slice 4 — Combined-mode aggregation primitive.** `ProvenanceAggregate<>` builder API in `prototype/platform/projections/aggregate.ts`; `recon:provenance-aggregation-breakdown`. The current `combined`-mode reads preserve per-event provenance during fold but do not surface a typed `ProvenanceAggregate<>` shape — Slice 4 builds that on top.
3. **Slice 5 — Cross-reference enforcement at the graph level.** `recon:provenance-cross-reference-integrity` walks the EventId graph; today only the trivially-decidable cases (per Slices 6+1 `checkCrossReference`) are enforced.
4. **Slice 7 — User-level mode toggle UX.** Single user-level toggle in dashboard chrome; CLI flag `--provenance-mode=<mode>` for scripted consumers.
5. **`build()` and `fold()` paths.** The non-snapshot projector entrypoints do not yet apply the provenance filter — they continue to fold every event regardless of provenance. Spec scope here was specifically `projectFromSnapshot`. Extending `build()` to accept the filter is a one-session follow-up; existing `projector.build(...)` consumers (markets projections, scenarios) operate today on untagged-legacy events and would need a coordinated migration.
6. **Snapshot-key digest as a typed EventStore column.** Today the digest rides inside the `stream_key` string. If query-time filtering by digest becomes a need (e.g. operator dashboards listing snapshots per mode), promote the digest to a typed column.

---

## 5. Identity discipline check

Authors named with positions in §1 frontmatter and §1 body. References to other personas in §2-§4 use first-mention name + position (Devon (COO, governance — operational resilience); Helena hook reference cites the spec rather than re-stating Helena's seat).

---

## 6. PR

`substrate(D-DATA-PROVENANCE-SUBSTRATE Slice 2): projection-runtime mode selection + filtering` against `main`.

— Anya (Data / analytics engineer, engineering — projection runtime)
