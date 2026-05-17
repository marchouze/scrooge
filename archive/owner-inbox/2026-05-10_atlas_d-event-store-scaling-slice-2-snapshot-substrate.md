---
title: D-EVENT-STORE-SCALING Slice 2 — local snapshot substrate (snapshot + replayFromSnapshot APIs)
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Implements the local snapshot substrate authorised under D-EVENT-STORE-SCALING Slice 2 (CEO-approved 2026-05-10) — `eventStore.snapshot()` / `loadSnapshot()` / `listSnapshots()` / `replayFromSnapshot()` / `shouldSnapshot()` APIs behind the existing EventStore class, additive `snapshots` SQLite table, per-event-type cadence registry (Q1 hybrid 1000-events / 1-hour default, optional per-type override). M8 cloud lift swaps the implementation for Cosmos DB Core hot-tier without changing the API surface.
decision-required: false
---

# D-EVENT-STORE-SCALING Slice 2 — local snapshot substrate

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-05-10
**Reports through:** Devon (COO, governance)
**Standing authority:** `D-EVENT-STORE-SCALING` (CEO-approved 2026-05-10) Slice 2. Downstream dispatch by Scrooge (Chief of Staff / Orchestrator); no new policy decision per the no-pause rule (CLAUDE.md "Dispatch discipline").
**Source design:** [`Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md`](2026-05-10_atlas_event-store-scaling-design.md) §4.2, §6 Slice 2, §7 Q1.
**Decision-record (parent):** [`Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-event-store-scaling.md`](2026-05-10_scrooge_ceo-decision-record_d-event-store-scaling.md).

---

## 1. Why now

D-EVENT-STORE-SCALING (CEO-approved 2026-05-10) authorised Slices 1–3 pre-M2 under the Targeted budget. Slice 1 (retention metadata in `registry.ts`) landed on `main` at commit `aa6d424`. Slice 3a (split runtime cache from committed seed; env-overridable event-store path) landed today as PR #138. Slice 2 — the load-bearing snapshot API surface — had not yet landed; downstream Slice 3 consumers (Rohan (Risk engineer)'s backtest harness, Vera (Internal audit engineer)'s recon pipelines, Anya (Data / analytics engineer)'s projection runtime) cannot migrate off naive `replay()` until this exists.

This slice closes that gap.

## 2. What changed

### 2.1 New API surface on `EventStore`

Five public methods, all behind the existing `EventStore` class so the M8 cloud lift swaps the implementation (Event Hubs ingest + Cosmos DB Core hot-tier) without changing consumer code (Principle 3 — local-build-first, single-coherent-phase migration).

| Method | Purpose |
|---|---|
| `snapshot(opts: SnapshotOpts): SnapshotRow` | Persist a snapshot for `(streamKey, asOf, uptoSequence)`. Idempotent on the triple — re-snapshotting returns the existing row. The store does not compute the projection state; the consumer supplies it as a JSON-serialised payload. |
| `loadSnapshot(streamKey, asOf): SnapshotRow \| undefined` | Look up the most recent snapshot ≤ `asOf` for the stream. |
| `listSnapshots(streamKey): readonly SnapshotRow[]` | List all snapshots for a stream in ascending `(asOf, sequence)` order. Operational/debug aid. |
| `replayFromSnapshot(opts: ReplayFromSnapshotOpts): Generator<Event>` | Yield events from `loadSnapshot.uptoSequence + 1` up to `asOf`. Degrades gracefully to naive `replay({ asOf, ...filter })` from sequence 1 when no snapshot exists. |
| `shouldSnapshot(args): SnapshotCadenceCheck` | Cadence predicate per Q1 resolution (hybrid K-events / T-time, per-event-type tunable from registry). Returns the decision and the inputs (debug aid). Does NOT auto-snapshot — Slice 3 consumers own projection state. |

Public types added: `SnapshotRow`, `SnapshotOpts`, `ReplayFromSnapshotOpts`, `SnapshotCadenceCheck`.

### 2.2 New SQLite table

Additive — pre-Slice-2 stores upgrade in place via `CREATE TABLE IF NOT EXISTS` on next instantiation:

```sql
CREATE TABLE IF NOT EXISTS snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_key      TEXT    NOT NULL,
  as_of           TEXT    NOT NULL,         -- ISO 8601 UTC business-time bound
  upto_sequence   INTEGER NOT NULL,         -- last event sequence covered
  payload         TEXT    NOT NULL,         -- JSON-serialised projection state
  recorded_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stream_key, as_of, upto_sequence)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_stream_asof ON snapshots(stream_key, as_of);
CREATE INDEX IF NOT EXISTS idx_snapshots_stream_seq  ON snapshots(stream_key, upto_sequence);
```

The existing `events` table shape is unchanged. The `gateEventStore` permission-gate wrapper (`prototype/platform/event-store/permission-gate.ts`) uses `Object.create(store)` and only intercepts `append` / `appendAll` — the new methods pass through naturally without any wrapper change.

### 2.3 Cadence registry

`prototype/platform/event-store/registry.ts` gains:

```ts
export interface SnapshotCadence {
  readonly everyKEvents: number;
  readonly everyTSeconds: number;
}

export const DEFAULT_SNAPSHOT_CADENCE: SnapshotCadence = {
  everyKEvents: 1000,
  everyTSeconds: 60 * 60, // 1 hour
};

export interface EventTypeMetadata {
  // ... existing fields ...
  readonly cadence?: SnapshotCadence;  // optional — falls back to DEFAULT
}
```

Q1 resolution from the parent decision: hybrid 1000-events-OR-1-hour, tunable per event type. The field is **optional** — every existing registry row resolves to the default; future per-type values land via Mira (Compliance / RegTech engineer)'s follow-on classification of high-velocity vs low-velocity types (per design brief §4.2 — `MarkToMarketObserved` at K=10,000; `AgentRegistered` at K=100). No back-fill required for Slice 2 exit; leaving the field optional avoids a 50-row touch that would conflict with parallel Slice-2 RMS work on the registry/event-types files.

## 3. M8 Azure mapping

The local `snapshots` table maps directly onto a Cosmos DB Core SQL collection in the production substrate:

| Local (Slice 2) | Azure (Slice 8 / M8) |
|---|---|
| `snapshots` table in SQLite | Cosmos DB Core SQL container `snapshots` |
| `stream_key` column + idx_snapshots_stream_* indexes | Logical partition key = `streamKey` |
| `(stream_key, as_of)` index | Composite index `(streamKey, asOf)` |
| `(stream_key, upto_sequence)` index | Composite index `(streamKey, uptoSequence)` |
| `payload` TEXT (JSON) | Document body (native JSON; richer indexing available) |
| `loadSnapshot` SQL query | Cosmos DB SQL `SELECT TOP 1 ... ORDER BY uptoSequence DESC` inside the partition |
| `replayFromSnapshot` generator | Cosmos DB change-feed consumer scoped to `streamKey` from `snapshot.uptoSequence` |

The `EventStore` class boundary is the swap seam. Consumer code that calls `eventStore.snapshot()` / `eventStore.replayFromSnapshot()` does not change at M8 — only the implementation behind those methods does.

## 4. Snapshot row schema

```ts
export interface SnapshotRow {
  readonly id: number;
  readonly streamKey: string;       // e.g. "LE-BANK-SA|counterparty/CP-XYZ" per Q4
  readonly asOf: string;            // ISO 8601 UTC business-time bound
  readonly uptoSequence: number;    // last event sequence folded into payload
  readonly payload: string;         // JSON-serialised projection state (consumer-typed)
  readonly recordedAt: string;      // sqlite datetime('now') at write time
}
```

The store does not interpret `payload` — Slice 3 consumers serialise their typed projection state (e.g. Rohan's backtest baseline, Anya's projection cache) and the store persists the bytes. M8 Cosmos DB lift can choose to JSON-decode the payload for richer indexing, but the local substrate keeps it opaque for forward compatibility.

## 5. Cadence-rule wiring

Cadence is evaluated by `EventStore.shouldSnapshot({ streamKey, eventType?, nowUtc?, lastSnapshot? })`:

1. Resolve cadence: `lookupEventType(eventType)?.cadence ?? DEFAULT_SNAPSHOT_CADENCE`.
2. Find the latest snapshot for `streamKey` (asOf-unbounded — most-recently-written). If none → return `shouldSnapshot: true, reason: "first-snapshot"`.
3. Compute `eventsSinceSnapshot = COUNT(events WHERE sequence > lastSnapshot.uptoSequence)`. If `≥ everyKEvents` → return `events-threshold`.
4. Compute `secondsSinceSnapshot = (nowUtc - lastSnapshot.recordedAt) / 1000`. If `≥ everyTSeconds` → return `time-threshold`.
5. Otherwise → `below-thresholds`.

Consumers call `shouldSnapshot()` after their append batch and snapshot when it returns true. The store deliberately does NOT auto-snapshot inside `append()` because:
- The store has no view of consumer projection state (the payload).
- Coupling auto-snapshot to `append()` would make every emitter pay the cadence cost on every event, even if the consumer is happy with a coarser snapshot cadence.
- Slice 3 consumers can choose to call `shouldSnapshot()` per fold update, per fleet-cycle, or never (relying on naive replay) — the store stays out of the policy choice.

The `eventsSinceSnapshot` count is currently global (not stream-scoped) because the local store does not yet partition by `streamKey` (Slice 5). When Slice 5 lands, the count will scope to the stream's events; until then, consumers should pass an `eventType` whose cadence reflects the stream's velocity, OR rely on the default 1000-event / 1-hour floor.

## 6. Tests

`prototype/tests/event-store-snapshot.test.ts` — 13 tests across three describe blocks:

- **Round-trip + idempotency (4 tests)**: persist → load; idempotent on `(streamKey, asOf, uptoSequence)`; rejects bad inputs (empty streamKey / asOf, negative uptoSequence); `loadSnapshot` returns the latest-≤-asOf row across multiple snapshots.
- **Equivalence with naive replay (3 tests)**: degraded path (no snapshot → identical to naive `replay`); delta-only after a snapshot (yields strictly fewer events than naive while remaining a subset by event_id); `asOf` as upper bound on the delta.
- **Cadence-trigger behaviour (6 tests)**: first-snapshot bootstrap; events-threshold (K=1000); time-threshold (T>1h); below-thresholds; default cadence fall-back for unknown event types; persisted-last-snapshot fall-back (no `lastSnapshot` arg).

All 13 pass. Existing `tests/event-store.test.ts` (6 tests) unchanged and passing — no regression on the `events` table or the original `replay()` API.

## 7. Substrate gaps remaining

This slice covers Slice 2 only. The following remain on the D-EVENT-STORE-SCALING roadmap (not solved here):

- **Slice 3 consumer adoption beyond 3a**: Slice 3a (PR #138) split the dashboard cache from the committed seed and documented the shared event-store env var. The substantive consumer migrations remain — Rohan's backtest harness onto `replayFromSnapshot` (highest read amplification per design §2.3); Vera's recon pipelines; Anya's projection runtime; dashboard derive(). Each is a separate dispatch with byte-identical-recon as the gate (planned Vera Wave-4 #15).
- **Slice 4 — per-event-type compaction policy** (pre-M3, Atlas). Local compactor for `latest-wins-per-key` types; archive-then-prune the pre-snapshot tail. Snapshot substrate from this slice is the prerequisite.
- **Slice 5 — stream partitioning by entity+aggregate** (pre-M3, Atlas + Imani (Legal & contracts engineer)). Adds `partitionKey` to event envelope; per-stream-scoped `eventsSinceSnapshot` count in `shouldSnapshot()`.
- **Slice 6 — performance benchmarking rig** (pre-licence-day, Atlas + Rohan + Vera). Synthetic 10M-event fixture; backtest-replay / recon / projection rebuild benchmarks; SLA recon.
- **Slice 7 — Azure substrate design doc + cost model** (M7, Atlas + Camille (CFO)).
- **Slice 8 — M8 cloud lift execution** (M8, Atlas + full fleet).

Adjacent gaps surfaced but not in scope:

- **Per-event-type cadence values**. Mira follow-on. Today every type rides `DEFAULT_SNAPSHOT_CADENCE` (1000/3600s); cadence override is opt-in via the optional `cadence` field on `EventTypeMetadata`. Vera's Wave-4 retention-citation-coverage recon pipeline will not flag the empty cadence (the field is optional by design) — a parallel cadence-coverage recon is a follow-on if/when uneven cadence becomes a measurement target.
- **Stream-key conventions library**. The store treats `streamKey` as opaque; consumers pick the convention. Q4 resolution says `<entity>|<aggregate>` (e.g. `LE-BANK-SA|counterparty/CP-XYZ`). A small helper / typed builder is a follow-on for Slice 3 consumer-adoption time, not Slice 2.
- **Snapshot pruning / GC**. Snapshots accumulate forever today. A retention policy on snapshots themselves — keep the latest N per stream, plus one per asOf-bucket — is a Slice 4-adjacent follow-on once the row count justifies it.

## 8. Test plan / acceptance

- `bun run typecheck` clean.
- `bun run lint` clean.
- `bun test --isolate` clean (499 → 512 tests; the 13 new snapshot tests are additive).
- A Slice-3 consumer (Rohan's backtest harness next) can call `eventStore.snapshot({...})` and `eventStore.replayFromSnapshot({...})` and get equivalent results to naive `replay()`.
- The committed event-store sqlite schema includes a `snapshots` table on next boot.
- `bun run citation-gate` clean — this brief carries citations to the parent decision and the source design doc.
- All recon harnesses pass — no schema regression on `events`, no API surface change for existing consumers.

## 9. Authority

- `D-EVENT-STORE-SCALING` (CEO-approved 2026-05-10; canonical record `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-event-store-scaling.md`).
- Source design — `Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md` §4.2 (Cosmos DB Core hot-tier mapping) + §6 Slice 2 (exit criteria) + §7 Q1 (cadence resolution).
- CLAUDE.md Principle 1 (events are the only source of truth — snapshots are derived caches, never overwrite the event log).
- CLAUDE.md Principle 3 (cloud-native; full local build first, then Azure migration as a single coherent phase — `EventStore` class is the swap seam).
- CLAUDE.md Principle 5 (multi-currency, multi-entity, multi-country — `streamKey` convention `<entity>|<aggregate>` per Q4).
- `Owner Inbox/2026-05-10_atlas_d-event-store-scaling-slice-3a-runtime-cache-split.md` — sibling Slice 3a deliverable (already on `main` via PR #138).

—Atlas (Core banking platform architect, engineering)
