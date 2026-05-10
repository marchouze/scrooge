---
title: D-EVENT-STORE-SCALING Slice 3 — consumer adoption (backtest harness + projection runtime)
author: Rohan (Risk engineer, engineering — reports to Helena CRO) · Anya (Data / analytics engineer, engineering — reports to Devon COO)
date: 2026-05-10
summary: Two consumers wired onto the Slice-2 snapshot APIs — Rohan's backtest harness (per-prediction-point as-of replay collapsed to a single per-entity projection with snapshot persistence) and Anya's projection runtime (projectFromSnapshot + maybeSnapshot APIs added behind the existing Projector interface). Equivalence between snapshot-replay and naive-replay is asserted on every fixture; feature flag BANK_BACKTEST_USE_SNAPSHOTS gates the backtest path for regression runs. Slice 3a (runtime cache split) already shipped under PR #138; Vera recon + dashboard projection migration remain as follow-on slices.
decision-required: false
---

# D-EVENT-STORE-SCALING Slice 3 — consumer adoption

**Authors:** Rohan (Risk engineer, engineering — reports to Helena CRO) · Anya (Data / analytics engineer, engineering — reports to Devon COO)
**Date:** 2026-05-10
**Standing authority:** `D-EVENT-STORE-SCALING` (CEO-approved 2026-05-10) Slice 3 — consumer adoption. Downstream dispatch by Scrooge (Chief of Staff); no new policy decision.
**Decision-required:** false

---

## 1. What changed

This PR extends Slice 3 (started under Slice 3a — runtime cache split, PR #138) by wiring two consumers onto the snapshot APIs frozen in Slice 2 (PR #143).

### Track A — Rohan's backtest harness

**File:** `prototype/runtime/agents/rohan-backtest-harness.ts`.

Before: the inner `runEclBacktest` loop did **two** full-history `eventStore.replay({ type: "RiskRaised", entity, asOf })` calls per prediction-point. A 1-year daily backtest is ~250 prediction-points × 2 replays × O(N_events) — the O(N²) scaling Atlas's design §2.3 calls out.

After: `runEclBacktest` builds the per-entity credit-critical signal projection **once** (out to the last horizon-end), via either:
- the snapshot-aware path — `eventStore.loadSnapshot(streamKey, asOf)` + `eventStore.replayFromSnapshot(...)` — which loads the seed projection state and folds only the delta-from-snapshot events on top, or
- the naive path — a single `eventStore.replay({ type: "RiskRaised", entity, asOf })` from sequence 1.

Per-prediction-point sampling is then a pure in-memory iteration over the projection's `entries`. After the run, `eventStore.shouldSnapshot({ streamKey, eventType: "RiskRaised" })` decides whether to persist a fresh snapshot via `eventStore.snapshot({...})`.

**Stream key.** `<entity>|backtest/risk-raised-credit-critical` — entity + aggregate, per Atlas's design Q4 resolution.

**Cadence.** Falls through `EventStore.shouldSnapshot()` to the per-event-type registry rule for `RiskRaised`. RiskRaised has no explicit `cadence` field today (Mira's Wave-5 follow-on populates per-type cadence), so it resolves to `DEFAULT_SNAPSHOT_CADENCE` — 1000 events / 1 hour. First-snapshot bootstrap fires on the first run for any entity.

**Feature flag.** `BANK_BACKTEST_USE_SNAPSHOTS` (default `true`). Set to `false`, `0`, or `no` to fall back to the naive single-replay path. Used by the equivalence test to assert byte-identical results between paths; available to Marc / operators to disable snapshots for regression diagnostics.

### Track B — Anya's projection runtime

**File:** `prototype/platform/projections/runtime.ts` (and `types.ts`, `index.ts`).

Two new methods added to the `Projector` interface:

```ts
projectFromSnapshot<S, E extends Event>(
  p: Projection<S, E>,
  opts: SnapshotProjectionOpts,
): { state: S; snapshot?: SnapshotRow; deltaCount: number };

maybeSnapshot<S, E extends Event>(
  p: Projection<S, E>,
  opts: ProjectionSnapshotOpts<S>,
): SnapshotEmissionResult;
```

`projectFromSnapshot` loads the latest snapshot ≤ `asOf` for `streamKey` via `eventStore.loadSnapshot()`, decodes its payload via the projection's `decodeSnapshot`, then folds delta events from `eventStore.replayFromSnapshot()` on top. When no snapshot exists, the path degrades gracefully to a full naive fold and returns the same state. **This is the cold-start API** — restart the runtime, throw away in-memory projections, restore from snapshot, continue forward without replaying the entire log.

`maybeSnapshot` calls `eventStore.shouldSnapshot()` for the projection's stream / event type. When the cadence rule fires (events-threshold, time-threshold, or first-snapshot bootstrap), the runtime encodes the supplied state via `encodeSnapshot` and persists. Idempotent on `(streamKey, asOf, uptoSequence)` — re-calling with the same triple is a no-op.

The `Projection<S, E>` interface gains optional `encodeSnapshot` / `decodeSnapshot` codec fields. Projections without them retain the existing `build()` / `fold()` API and throw a loud, descriptive error if their consumer calls the snapshot APIs (no silent skips — the design brief §6 Slice 3 acceptance criterion is "byte-identical equivalence" and that requires both paths or neither).

### Slice 2 / 3a not touched

The `EventStore` snapshot API surface frozen by Slice 2 is unchanged. The dashboard's projection cache split (Slice 3a, PR #138) is unchanged — naive replay is fine for the dashboard's UX; future slice covers its migration.

## 2. Snapshot cadence per consumer

| Consumer | Stream key shape | Resolved cadence | Rationale |
|---|---|---|---|
| Backtest harness (Rohan) | `<entity>\|backtest/risk-raised-credit-critical` | `RiskRaised` registry default → `DEFAULT_SNAPSHOT_CADENCE` (1000 events / 1 hour) | The harness's read amplification dominates the write rate; per-entity snapshots collapse the per-prediction-point cost. Mira's Wave-5 cadence-tuning follow-on can tighten this for high-volume credit-critical entities. |
| Projection runtime (Anya) | Set by the consumer; the runtime is generic | Set by the consumer's `eventType` opts arg (defaults to `DEFAULT_SNAPSHOT_CADENCE` when absent) | The runtime cannot guess; each projection's caller knows its own cadence. Consumers that want cadence-driven snapshot emission supply `eventType` matching the dominant input event type so `shouldSnapshot()` resolves the registry-tuned cadence. |

## 3. Equivalence assertion

Both consumers ship with equivalence tests that fail loud on snapshot/naive divergence — the Slice 3 acceptance requirement.

### Backtest equivalence — `tests/runtime-rohan-backtest-snapshot.test.ts`

For every fixture in `tests/fixtures/backtest-ecl/index.ts` (within-tolerance, amber, red, staging-transition), the test:
1. Runs the harness with `BANK_BACKTEST_USE_SNAPSHOTS=false` against a fresh entity → captures the naive-path `BacktestRun` payload.
2. Runs the harness with `BANK_BACKTEST_USE_SNAPSHOTS=true` against a different fresh entity → captures the snapshot-path payload.
3. Asserts `severity`, `predictionCount`, `expectedExceptions`, `observedExceptions`, `comparisonMetric`, `methodologyHash`, `modelId`, `version` are byte-identical.

Plus two persistence-shape tests: snapshot path actually writes a snapshot row that subsequent runs re-use (idempotent on triple); flag-off does not write any snapshot row.

### Projection equivalence — `tests/projections-snapshot.test.ts`

Five equivalence assertions on a synthetic `widget-counter` projection:
1. `projectFromSnapshot` with no snapshot present equals a fresh naive `build()` (graceful-degradation path).
2. `projectFromSnapshot` with a partial snapshot present equals a fresh naive `build()` (snapshot path).
3. Cold-start equivalence — snapshot, drop in-memory state, restore, project further forward — equals fresh naive build at the final asOf.
4. Filter narrowing on the delta replay matches the naive path.
5. Missing `decodeSnapshot` → `projectFromSnapshot` throws (loud failure).

Plus three `maybeSnapshot` assertions: first-snapshot bootstrap; idempotence on triple; missing `encodeSnapshot` → throws.

## 4. M8 Azure mapping (per Atlas's design §4)

The Slice 2 / Slice 3 surface is interface-stable across the local-build and Azure target.

- **Backtest harness (Track A):** identical interface. The substitution is in the `EventStore` implementation — `loadSnapshot` reads from a Cosmos DB Core SQL collection partition-keyed on `streamKey` instead of the local sqlite `snapshots` table; `replayFromSnapshot` consumes the per-partition Cosmos change-feed instead of streaming sqlite rows. The harness sees the same `SnapshotRow` shape and the same `Generator<Event>`. No change to the per-stream key convention.
- **Projection runtime (Track B):** identical interface. The cloud `Projector` substitutes the `LocalProjector` behind the same `Projector` interface (per `Projector.md`'s `// P6 — capability code depends on this interface, not on a concrete runtime`). The Cosmos DB change-feed-driven projector consumes events via `eventStore.replayFromSnapshot(streamKey, asOf)` and persists snapshots into the snapshot collection via the same `eventStore.snapshot()` call. Reducers and projection definitions don't change.
- **Stream-key convention:** `<entity>|<aggregate>` per Q4 resolution. Becomes the Event Hubs partition key + Cosmos DB logical partition key on the cloud lift.
- **Cadence resolution:** the `DEFAULT_SNAPSHOT_CADENCE` plus per-event-type overrides in `registry.ts` are read by both the local store and the cloud Projector — cadence values lift unchanged.

The two consumer wirings in this PR therefore survive the cloud lift without re-authoring (Principle 3 — cloud-native lift behind stable interfaces).

## 5. Substrate gaps remaining

These remain open and feed into later D-EVENT-STORE-SCALING slices.

1. **Vera recon migration (Slice 3 — Vera consumer).** Vera's recon pipelines (`parallel-dispatch-divergence.ts`, `runtime-handler-sync.ts`, `decision-event-recon.ts`, etc.) still scan from sequence-1 on every run. Per Atlas's Q5 sequencing — "Rohan first, then Vera, then Anya, then dashboard" — Vera is the next consumer to migrate. Owner: Vera + Atlas. Out of scope for this PR.
2. **Dashboard migration (Slice 3 — dashboard consumer).** The dashboard's naive-replay derivation is fine for its UX (Slice 3a confirmed). The Slice 3 design defers dashboard migration to a later consumer slice once the cumulative event count crosses the dashboard latency threshold.
3. **Per-event-type cadence tuning (Mira's Wave-5 follow-on).** `RiskRaised` resolves to `DEFAULT_SNAPSHOT_CADENCE` today. Mira's per-type cadence pass — set tighter cadence on high-velocity types (`MarkToMarketObserved` at K=10,000) and looser on low-velocity ones (`AgentRegistered` at K=100) — is in flight as a Wave-5 substrate item. Track A inherits whatever Mira sets without code change.
4. **Backtest harness — multi-prediction-point parallelism.** The harness still iterates prediction points sequentially. Once Atlas's Slice 5 lands (per-stream physical partitioning), prediction-point fans-out can parallelise across `streamKey` partitions. Pre-licence-day; no change required for v0.
5. **Cosmos cost projection refresh.** Atlas's §4.3 cost estimate (~$25–40K/year at Year-3) was framed pre-Slice-3. Now that one consumer's hot-path read-amplification is concretely reduced (per the design's ~10,000× factor), Camille's cost-model slice (Slice 7) has live data to calibrate against. Out of scope for this PR.
6. **Projection runtime — encoder/decoder schema versioning.** When a projection's state shape evolves, snapshots persisted under the prior schema must either migrate or be discarded. The runtime currently has no version-stamp on the snapshot payload — the consumer's `decodeSnapshot` is responsible for handling forward-/backward-compatibility. Substrate gap; tracked for a Slice between 3 and 4.
7. **Failure-mode logging.** The harness currently swallows non-UNIQUE snapshot persistence errors silently (the run's BacktestRun is the source of truth; the snapshot is a cache). A structured log line on snapshot failure would help operators diagnose; out of scope for this PR but flagged for Atlas's substrate-observability follow-on.

## 6. Citations

- Standing authority: `D-EVENT-STORE-SCALING` (CEO-approved 2026-05-10).
- Design doc: [Owner Inbox/actioned/2026-05-10_atlas_event-store-scaling-design.md](actioned/2026-05-10_atlas_event-store-scaling-design.md) §3.1 (as-of replay), §4.2 (snapshot strategy), §6 Slice 3 (consumer adoption), Q4 (stream key shape), Q5 (consumer sequencing).
- Slice 2 substrate: [Owner Inbox/2026-05-10_atlas_d-event-store-scaling-slice-2-snapshot-substrate.md](2026-05-10_atlas_d-event-store-scaling-slice-2-snapshot-substrate.md) — the snapshot APIs this PR consumes.
- Slice 3a: [Owner Inbox/2026-05-10_atlas_d-event-store-scaling-slice-3a-runtime-cache-split.md](2026-05-10_atlas_d-event-store-scaling-slice-3a-runtime-cache-split.md) — runtime cache split (separate dispatch under Slice 3 standing authority).
- Backtest scoping: `Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md` §8.4 (the as-of-replay performance gap that motivates Track A).
- Principle 1 (events-as-truth) — snapshots are caches, not source of truth.
- Principle 3 (cloud-native) — interface-stable across local + Azure.
- Principle 6 (single-graph discipline) — both consumers cite the design doc; the design doc cites the Records Management Policy + obligations register.
- Principle 7 (autonomous by default) — both Rohan's harness and Anya's projection runtime are autonomous-agent-owned consumers.

## 7. CeoDecision event

This Slice 3 consumer-adoption authorisation is recorded as a `CeoDecision` event, idempotently emitted by `prototype/scripts/record-d-event-store-scaling-slice-3.ts`. Decision id: `D-EVENT-STORE-SCALING-SLICE-3`. Action: `approve`. Source doc: this file.

—Rohan (Risk engineer, engineering — reports to Helena CRO) · Anya (Data / analytics engineer, engineering — reports to Devon COO)
