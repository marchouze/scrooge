// platform/event-store/store.ts
//
// SQLite-backed append-only event store. Local development implementation;
// the production target swaps the implementation behind the same API
// (cloud-native event store on Azure — Postgres logical decoding or Event
// Hubs + Cosmos DB; selection in `prototype/infra/azure/`).
//
// Properties:
//   - Append-only. No update / delete on `events`.
//   - Monotonically increasing `sequence` is the canonical ordering.
//   - P1 — all state is queries over this table; no parallel ledgers.
//   - P2 — append rejects events without citations (zod-enforced).
//   - As-of replay is a first-class capability.
//   - Snapshot substrate (D-EVENT-STORE-SCALING Slice 2) — per-stream
//     typed projection caches keyed on `(streamKey, asOf)`. M8 cloud
//     lift swaps this implementation for Cosmos DB Core hot-tier
//     (per `Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md`
//     §4.2) without changing the API surface.
//   - Cold archive partitioning (D-EVENT-STORE-SCALING-PHASE-5) —
//     `archiveEventsOlderThan()` moves cold events to a separate SQLite
//     file, records the partition in `archive_partitions`, and deletes
//     the hot rows. `PartitionedEventStore` spans both.
//
// Author: Atlas

import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";
import {
  type ProvenanceTag,
  defaultProvenanceFor,
  isProvenanceSubstrateActive,
  provenanceTagSchema,
} from "./provenance";
import {
  DEFAULT_SNAPSHOT_CADENCE,
  type SnapshotCadence,
  lookupEventType,
  validatePayload,
} from "./registry";
import { type Event, eventSchema } from "./types";

const DDL = `
CREATE TABLE IF NOT EXISTS events (
  sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT    UNIQUE NOT NULL,
  type        TEXT    NOT NULL,
  as_of       TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  actor_type  TEXT    NOT NULL,
  actor_id    TEXT    NOT NULL,
  citations   TEXT    NOT NULL,   -- JSON array
  payload     TEXT    NOT NULL,   -- JSON object
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now')),
  -- D-DATA-PROVENANCE-SUBSTRATE Slice 1 — typed multi-axis provenance
  -- tag (kind / scenario / variant / sourceLineage / tags). JSON-serialised
  -- ProvenanceTag. NULL until the Slice-6 backfill / soft-tagger runs;
  -- substrate-active flag (off in tests, on at composition root + after
  -- backfill) gates append-rejection of unset values.
  provenance      TEXT,
  -- Aggregate identity — groups all events for one business object.
  -- UUID v5 (deterministic from namespace + label) for backfill safety.
  aggregate_id    TEXT,
  aggregate_label TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_type         ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_entity       ON events(entity);
CREATE INDEX IF NOT EXISTS idx_events_as_of        ON events(as_of);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id);

-- D-EVENT-STORE-SCALING Slice 2 — per-stream snapshot substrate.
-- A snapshot caches a projection's state for a logical stream
-- (\`stream_key\`) at a given business-time (\`as_of\`); replay-from-snapshot
-- loads the latest snapshot ≤ asOf and replays only the delta. Schema
-- additive — pre-Slice-2 stores upgrade in place via CREATE IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_key      TEXT    NOT NULL,
  as_of           TEXT    NOT NULL,         -- ISO 8601 UTC business-time bound
  upto_sequence   INTEGER NOT NULL,         -- last event sequence covered
  payload         TEXT    NOT NULL,         -- JSON-serialised projection state
  recorded_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stream_key, as_of, upto_sequence)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_stream_asof
  ON snapshots(stream_key, as_of);
CREATE INDEX IF NOT EXISTS idx_snapshots_stream_seq
  ON snapshots(stream_key, upto_sequence);

-- D-EVENT-STORE-SCALING-PHASE-5 — cold archive partition registry.
-- Each row records one archived SQLite file that holds events older
-- than a given cutoff sequence. The hot store's events table is pruned
-- after archival; PartitionedEventStore spans both stores transparently.
CREATE TABLE IF NOT EXISTS archive_partitions (
  partition_id  TEXT    PRIMARY KEY,
  path          TEXT    NOT NULL UNIQUE,
  min_sequence  INTEGER NOT NULL,
  max_sequence  INTEGER NOT NULL,
  event_count   INTEGER NOT NULL,
  sha256_hash   TEXT    NOT NULL,
  archived_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * D-EVENT-STORE-SCALING-PHASE-5 — cold archive partition row as stored
 * in the `archive_partitions` table in the hot EventStore.
 */
export interface ArchivePartitionRow {
  partition_id: string;
  path: string;
  min_sequence: number;
  max_sequence: number;
  event_count: number;
  sha256_hash: string;
  archived_at: string;
}

/**
 * Return value of `EventStore.archiveEventsOlderThan()`.
 */
export interface ArchiveResult {
  readonly partitionId: string;
  readonly minSeq: number;
  readonly maxSeq: number;
  readonly eventCount: number;
  readonly sha256Hash: string;
}

export interface ReplayOpts {
  fromSequence?: number;
  entity?: string;
  type?: string;
  asOf?: string; // upper bound (inclusive) on event.as_of
  aggregateId?: string; // filter: only events for this aggregate UUID
}

/**
 * Persisted snapshot row. Returned by `snapshot()`; consumers serialise
 * the projection state into `payload` (JSON-stringified) and the store
 * persists it keyed on `(streamKey, asOf, uptoSequence)`.
 *
 * Authority: D-EVENT-STORE-SCALING (CEO-approved 2026-05-10) Slice 2.
 * M8 Azure mapping: `payload` becomes a Cosmos DB Core SQL document on
 * the snapshots collection, partition-keyed by `streamKey`, indexed on
 * `(streamKey, asOf)` and `(streamKey, uptoSequence)`.
 */
export interface SnapshotRow {
  readonly id: number;
  readonly streamKey: string;
  readonly asOf: string; // ISO 8601 UTC
  readonly uptoSequence: number;
  readonly payload: string; // JSON-serialised projection state
  readonly recordedAt: string;
}

/**
 * Snapshot opts. The consumer owns the projection — it computes the
 * fold from `replay({ asOf, ...filter })` and passes the serialised
 * state in. The store persists it; future `replayFromSnapshot()` calls
 * load the snapshot and yield only the delta-from-snapshot events.
 */
export interface SnapshotOpts {
  /** Logical stream identifier — opaque to the store. Convention per
   *  Q4 of D-EVENT-STORE-SCALING: `<entity>|<aggregate>` (e.g.
   *  `LE-BANK-SA|counterparty/CP-XYZ`). */
  readonly streamKey: string;
  /** Business-time upper bound the snapshot covers. */
  readonly asOf: string;
  /** Last event sequence number folded into this snapshot. */
  readonly uptoSequence: number;
  /** Projection state — the consumer's typed fold, JSON-serialised. */
  readonly payload: string;
}

/**
 * Replay-from-snapshot opts. The store loads the most-recent snapshot
 * ≤ asOf for the streamKey and yields events between `snapshot.upto +
 * 1` and `asOf`. The optional `filter` narrows the delta replay (e.g.
 * to a specific event type or entity); the consumer is responsible for
 * passing a filter that produces a result equivalent to its naive
 * replay path.
 *
 * If no snapshot exists for the stream, the store yields events from
 * `fromSequence: 1` filtered by `asOf` and `filter` — i.e. the call
 * degrades gracefully to the naive replay path.
 */
export interface ReplayFromSnapshotOpts {
  readonly streamKey: string;
  readonly asOf: string;
  /** Optional event-shape filter applied to the delta replay. */
  readonly filter?: Pick<ReplayOpts, "entity" | "type">;
}

/**
 * Result of a snapshot-cadence check. `true` when consumers should call
 * `snapshot()` after the latest append batch; `false` otherwise.
 */
export interface SnapshotCadenceCheck {
  readonly shouldSnapshot: boolean;
  readonly reason: "first-snapshot" | "events-threshold" | "time-threshold" | "below-thresholds";
  /** Cadence inputs the decision was based on (debugging aid). */
  readonly cadence: SnapshotCadence;
  /** Events appended to the stream since `lastSnapshot` (or sequence-1
   *  if no prior snapshot). */
  readonly eventsSinceSnapshot: number;
  /** Wall-clock seconds since `lastSnapshot.recordedAt` (or +Infinity
   *  if no prior snapshot). */
  readonly secondsSinceSnapshot: number;
}

export class EventStore {
  private readonly db: Database;

  constructor(path = ":memory:") {
    // Ensure parent directory exists for file-backed stores. On a fresh
    // GitHub Actions runner the `.local/` directory doesn't exist yet, and
    // `bun:sqlite` will refuse to create the database file otherwise.
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new Database(path);
    this.db.exec(DDL);
    // D-DATA-PROVENANCE-SUBSTRATE Slice 1 — additive column migration for
    // pre-Slice-1 stores opened in place. CREATE TABLE IF NOT EXISTS does
    // not add columns to an existing table; the ALTER TABLE below brings
    // legacy event-store DBs up to schema. Idempotent — bun:sqlite throws
    // "duplicate column" if the column already exists; we tolerate that.
    try {
      this.db.exec("ALTER TABLE events ADD COLUMN provenance TEXT");
    } catch {
      // column already present; pre-Slice-1 path doesn't need this.
    }
    // Aggregate identity columns — additive migration for pre-aggregate stores.
    try {
      this.db.exec("ALTER TABLE events ADD COLUMN aggregate_id TEXT");
    } catch {
      // already present
    }
    try {
      this.db.exec("ALTER TABLE events ADD COLUMN aggregate_label TEXT");
    } catch {
      // already present
    }
    try {
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id)");
    } catch {
      // already present
    }
    // D-DATA-PROVENANCE-SUBSTRATE Slice 6 — soft-tagger. If the store
    // contains untagged events (column NULL), apply the carve-out lookup
    // + build-phase default. Idempotent: zero-untagged ⇒ no-op. The
    // soft-tagger runs unconditionally (independent of the substrate-
    // active flag) so a freshly-opened legacy DB heals before the first
    // append; the hard-rejection path then sees a fully-tagged store.
    this.softTagUntaggedEvents();
  }

  /**
   * Slice 6 soft-tagger. Walks rows with `provenance IS NULL` and
   * applies `defaultProvenanceFor(event.type)` (carve-outs first, build-
   * phase simulated default otherwise). Returns the count of events
   * tagged so callers (and the backfill script) can report.
   */
  softTagUntaggedEvents(): {
    readonly tagged: number;
    readonly byKind: Readonly<Record<"production" | "simulated" | "build-phase-fixture", number>>;
  } {
    const rows = this.db
      .prepare("SELECT event_id, type FROM events WHERE provenance IS NULL")
      .all() as Array<{ event_id: string; type: string }>;
    if (rows.length === 0) {
      return {
        tagged: 0,
        byKind: { production: 0, simulated: 0, "build-phase-fixture": 0 },
      };
    }
    const byKind = { production: 0, simulated: 0, "build-phase-fixture": 0 };
    const stmt = this.db.prepare("UPDATE events SET provenance = ? WHERE event_id = ?");
    const tx = this.db.transaction((batch: typeof rows) => {
      for (const row of batch) {
        const tag = defaultProvenanceFor(row.type);
        stmt.run(JSON.stringify(tag), row.event_id);
        byKind[tag.kind] += 1;
      }
    });
    tx(rows);
    return { tagged: rows.length, byKind };
  }

  /**
   * D-PROVENANCE-BUILD-PHASE-CLASS Slice 2 — envelope-axis provenance
   * re-tagging.
   *
   * Re-tags the `provenance` envelope column of an existing event row.
   * Mirrors the soft-tagger's UPDATE pattern (`provenance` is the
   * envelope axis, not a payload field; payload + actor + citations
   * are immutable, only the typed envelope tag is healed).
   *
   * Idempotency: returns `{ reclassified: false }` when the row is
   * already at the target tag (deep equality on the persisted JSON).
   * Returns `{ reclassified: true, priorTag }` when an UPDATE was
   * applied; the prior tag is surfaced so callers can emit a typed
   * `ProvenanceReclassified` audit event with the before/after axes.
   *
   * The append-only invariant (Principle 1) is unchanged: no rows are
   * dropped; payload + as_of + actor + citations + sequence are all
   * preserved. Only the typed envelope axis moves, and every move is
   * accompanied by a typed audit event the caller emits.
   *
   * Authority: D-PROVENANCE-BUILD-PHASE-CLASS (CEO-approved 2026-05-22).
   */
  reclassifyProvenance(
    eventId: string,
    newTag: ProvenanceTag,
  ):
    | { readonly reclassified: false; readonly reason: "not-found" | "already-at-target" }
    | { readonly reclassified: true; readonly priorTag: ProvenanceTag } {
    // Validate the incoming tag defensively (cross-axis Zod rules).
    const validated = provenanceTagSchema.parse(newTag);
    const row = this.db.prepare("SELECT provenance FROM events WHERE event_id = ?").get(eventId) as
      | { provenance: string | null }
      | undefined;
    if (!row) return { reclassified: false, reason: "not-found" };
    const priorTag: ProvenanceTag = row.provenance
      ? (JSON.parse(row.provenance) as ProvenanceTag)
      : defaultProvenanceFor("__legacy_untagged__");
    if (deepProvenanceEqual(priorTag, validated)) {
      return { reclassified: false, reason: "already-at-target" };
    }
    this.db
      .prepare("UPDATE events SET provenance = ? WHERE event_id = ?")
      .run(JSON.stringify(validated), eventId);
    return { reclassified: true, priorTag };
  }

  /**
   * D-G2-ENTITY-ID-BACKFILL — envelope-axis entity re-tagging.
   *
   * Re-tags the `entity` envelope column of an existing event row.
   * Mirrors the `reclassifyProvenance` pattern (envelope-axis UPDATE;
   * payload + actor + citations + sequence + provenance are immutable,
   * only the typed envelope entity axis is corrected).
   *
   * Idempotency: returns `{ reclassified: false, reason: "already-at-target" }`
   * when the row already carries `newEntity`. Returns
   * `{ reclassified: true, priorEntity }` when an UPDATE was applied;
   * the prior entity is surfaced so callers can emit a typed
   * `EntityReclassified` audit event with the before/after axes.
   *
   * The append-only invariant (Principle 1) is unchanged: no rows are
   * dropped; payload + as_of + actor + citations + sequence + provenance
   * are all preserved. Only the typed envelope axis moves, and every move
   * is accompanied by a typed audit event the caller emits.
   *
   * Authority: D-G2-ENTITY-ID-BACKFILL (CEO-approved 2026-05-22,
   * event `a507ce6e-de32-48be-9350-a8044ee0b16f`).
   */
  reclassifyEntity(
    eventId: string,
    newEntity: string,
  ):
    | { readonly reclassified: false; readonly reason: "not-found" | "already-at-target" }
    | { readonly reclassified: true; readonly priorEntity: string } {
    if (!newEntity || newEntity.trim() === "") {
      throw new Error("EventStore.reclassifyEntity: newEntity must be a non-empty string");
    }
    const row = this.db.prepare("SELECT entity FROM events WHERE event_id = ?").get(eventId) as
      | { entity: string }
      | undefined;
    if (!row) return { reclassified: false, reason: "not-found" };
    if (row.entity === newEntity) return { reclassified: false, reason: "already-at-target" };
    const priorEntity = row.entity;
    this.db.prepare("UPDATE events SET entity = ? WHERE event_id = ?").run(newEntity, eventId);
    return { reclassified: true, priorEntity };
  }

  /**
   * Per-kind event counts. Diagnostic surface for the backfill script
   * and for operators verifying substrate-active gating. Untagged events
   * (post-soft-tagger; should always be zero in steady state) appear under
   * `untagged`.
   */
  countByProvenanceKind(): {
    readonly production: number;
    readonly simulated: number;
    readonly buildPhaseFixture: number;
    readonly untagged: number;
  } {
    const rows = this.db
      .prepare(
        `SELECT
           SUM(CASE WHEN provenance IS NULL THEN 1 ELSE 0 END) AS untagged,
           SUM(CASE WHEN json_extract(provenance, '$.kind') = 'production' THEN 1 ELSE 0 END) AS production,
           SUM(CASE WHEN json_extract(provenance, '$.kind') = 'simulated' THEN 1 ELSE 0 END) AS simulated,
           SUM(CASE WHEN json_extract(provenance, '$.kind') = 'build-phase-fixture' THEN 1 ELSE 0 END) AS buildPhaseFixture
         FROM events`,
      )
      .get() as {
      untagged: number | null;
      production: number | null;
      simulated: number | null;
      buildPhaseFixture: number | null;
    };
    return {
      production: rows.production ?? 0,
      simulated: rows.simulated ?? 0,
      buildPhaseFixture: rows.buildPhaseFixture ?? 0,
      untagged: rows.untagged ?? 0,
    };
  }

  /** Append a single event. P2 enforced via the schema (citations ≥ 1).
   * Per-type payload validation dispatched through the A1 event-type
   * registry — types with a registered Zod schema fail-closed; types
   * without one (or unregistered types) flow through envelope-only.
   *
   * D-DATA-PROVENANCE-SUBSTRATE Slice 1 — `provenance` enforcement:
   *   - Always validated by Zod (cross-axis rules in `provenanceTagSchema`)
   *     when present, regardless of the substrate-active flag.
   *   - When `isProvenanceSubstrateActive()` returns true (default), an
   *     append without `provenance` is rejected with a hard error UNLESS
   *     the event type carries a carve-out (CeoDecision, AgentBriefIssued)
   *     in which case the carve-out provenance is auto-applied.
   *   - When the flag is false (test pin / operator override), absent
   *     provenance falls through to NULL (legacy pre-Slice-1 behaviour).
   */
  append(raw: Event): void {
    const e = eventSchema.parse(raw);
    validatePayload(e.type, e.payload);
    const provenance = this.resolveProvenanceForAppend(e);
    this.db
      .prepare(
        `INSERT INTO events
           (event_id, type, as_of, entity, actor_type, actor_id, citations, payload, provenance,
            aggregate_id, aggregate_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.event_id,
        e.type,
        e.as_of,
        e.entity,
        e.actor.type,
        e.actor.id,
        JSON.stringify(e.citations),
        JSON.stringify(e.payload),
        provenance ? JSON.stringify(provenance) : null,
        e.aggregateId ?? null,
        e.aggregateLabel ?? null,
      );
  }

  /**
   * Resolve the `ProvenanceTag` to persist alongside this append.
   *
   * Rules:
   *   1. Caller-supplied `provenance` wins (already cross-axis-validated by Zod).
   *   2. If the substrate-active flag is true:
   *      a. Carve-out lookup by `event.type` (CeoDecision, AgentBriefIssued)
   *         auto-injects the production tag for those types.
   *      b. Any other type missing `provenance` is hard-rejected.
   *   3. If the substrate-active flag is false (legacy / test path), the
   *      append proceeds with NULL provenance; the soft-tagger heals
   *      such rows on the next store-open.
   */
  private resolveProvenanceForAppend(e: Event): ProvenanceTag | undefined {
    if (e.provenance !== undefined) {
      // Re-validate defensively — a caller might have hand-rolled the
      // tag without going through `provenanceTagSchema.parse`. The cost
      // is one extra Zod parse per append; the value is that the
      // cross-axis rules cannot be bypassed by skipping the helper.
      return provenanceTagSchema.parse(e.provenance);
    }
    if (!isProvenanceSubstrateActive()) {
      return undefined;
    }
    const carveOut = defaultProvenanceFor(e.type);
    // The build-phase fallback (PRE_SUBSTRATE_BACKFILL_TAG) is intentionally
    // NOT auto-applied at append time — only for the soft-tagger / backfill
    // pass over historical data. Live appends without an explicit tag must
    // either be a carve-out type or be hard-rejected.
    if (carveOut.sourceLineage === "pre-substrate-backfill") {
      throw new Error(
        `D-DATA-PROVENANCE-SUBSTRATE: append rejected — event type "${e.type}" requires an explicit provenance tag (no carve-out applies). See Owner Inbox/2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md §4.1.`,
      );
    }
    return carveOut;
  }

  /** Append a batch atomically. */
  appendAll(events: Event[]): void {
    const tx = this.db.transaction((batch: Event[]) => {
      for (const e of batch) this.append(e);
    });
    tx(events);
  }

  /** Streaming replay in sequence order. */
  *replay(opts: ReplayOpts = {}): Generator<Event> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.fromSequence !== undefined) {
      where.push("sequence >= ?");
      params.push(opts.fromSequence);
    }
    if (opts.entity) {
      where.push("entity = ?");
      params.push(opts.entity);
    }
    if (opts.type) {
      where.push("type = ?");
      params.push(opts.type);
    }
    if (opts.asOf) {
      where.push("as_of <= ?");
      params.push(opts.asOf);
    }
    if (opts.aggregateId) {
      where.push("aggregate_id = ?");
      params.push(opts.aggregateId);
    }
    const sql = `SELECT * FROM events ${
      where.length ? `WHERE ${where.join(" AND ")}` : ""
    } ORDER BY sequence ASC`;
    const rows = this.db.prepare(sql).all(...(params as never[])) as RowShape[];
    for (const row of rows) {
      yield {
        event_id: row.event_id,
        type: row.type,
        as_of: row.as_of,
        entity: row.entity,
        actor: { type: row.actor_type as Event["actor"]["type"], id: row.actor_id },
        citations: JSON.parse(row.citations) as string[],
        payload: JSON.parse(row.payload) as Record<string, unknown>,
        ...(row.provenance ? { provenance: JSON.parse(row.provenance) as ProvenanceTag } : {}),
        ...(row.aggregate_id ? { aggregateId: row.aggregate_id } : {}),
        ...(row.aggregate_label ? { aggregateLabel: row.aggregate_label } : {}),
      };
    }
  }

  count(): number {
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM events").get() as {
      n: number;
    };
    return r.n;
  }

  /**
   * Highest assigned sequence in the store, or 0 when empty. Distinct from
   * `count()`: gaps from rolled-back appends or replaced events mean
   * `count() <= highWatermark()`. Bus-tick cursors and any "what's the
   * sequence of the event I just appended" caller must use this — using
   * `count()` undercounts whenever a gap exists and causes the post-append
   * cursor to walk over stale events instead of the new one.
   */
  highWatermark(): number {
    const r = this.db.prepare("SELECT MAX(sequence) AS m FROM events").get() as {
      m: number | null;
    };
    return r.m ?? 0;
  }

  // --------------------------------------------------------------------
  // D-EVENT-STORE-SCALING Slice 2 — snapshot substrate.
  //
  // Per-stream typed projection caches keyed on `(streamKey, asOf)`.
  // The store does not know the projection's shape — it persists an
  // opaque JSON payload supplied by the consumer. Replay-from-snapshot
  // loads the latest snapshot ≤ asOf and yields only the delta events.
  //
  // M8 cloud lift: the local sqlite `snapshots` table is replaced by a
  // Cosmos DB Core SQL collection partitioned on `streamKey`; the
  // `EventStore` interface is unchanged so consumers do not re-author.
  // --------------------------------------------------------------------

  /**
   * Persist a snapshot for {streamKey} at {asOf}, covering events up to
   * {uptoSequence}. Returns the persisted row.
   *
   * Idempotent on `(streamKey, asOf, uptoSequence)` — re-snapshotting
   * the same triple is a no-op (returns the existing row). Different
   * payloads at the same triple are a programming error and rejected by
   * the UNIQUE constraint.
   */
  snapshot(opts: SnapshotOpts): SnapshotRow {
    if (!opts.streamKey) {
      throw new Error("EventStore.snapshot: streamKey required");
    }
    if (!opts.asOf) {
      throw new Error("EventStore.snapshot: asOf required");
    }
    if (opts.uptoSequence < 0) {
      throw new Error("EventStore.snapshot: uptoSequence must be ≥ 0");
    }
    // Idempotent INSERT — if the same (streamKey, asOf, uptoSequence)
    // exists return it without re-writing.
    const existing = this.db
      .prepare(
        `SELECT id, stream_key, as_of, upto_sequence, payload, recorded_at
           FROM snapshots
          WHERE stream_key = ? AND as_of = ? AND upto_sequence = ?`,
      )
      .get(opts.streamKey, opts.asOf, opts.uptoSequence) as SnapshotRowShape | null;
    if (existing) {
      return rowToSnapshot(existing);
    }
    const inserted = this.db
      .prepare(
        `INSERT INTO snapshots (stream_key, as_of, upto_sequence, payload)
         VALUES (?, ?, ?, ?)
         RETURNING id, stream_key, as_of, upto_sequence, payload, recorded_at`,
      )
      .get(opts.streamKey, opts.asOf, opts.uptoSequence, opts.payload) as SnapshotRowShape;
    return rowToSnapshot(inserted);
  }

  /**
   * Look up the most recent snapshot for {streamKey} at or before
   * {asOf}. Returns undefined when no snapshot exists in-window.
   */
  loadSnapshot(streamKey: string, asOf: string): SnapshotRow | undefined {
    const row = this.db
      .prepare(
        `SELECT id, stream_key, as_of, upto_sequence, payload, recorded_at
           FROM snapshots
          WHERE stream_key = ? AND as_of <= ?
          ORDER BY upto_sequence DESC, id DESC
          LIMIT 1`,
      )
      .get(streamKey, asOf) as SnapshotRowShape | null;
    return row ? rowToSnapshot(row) : undefined;
  }

  /**
   * List all snapshots for {streamKey} in ascending `(asOf, sequence)`
   * order. Operational/debug aid; consumers normally call
   * `loadSnapshot` for the latest-≤-asOf row.
   */
  listSnapshots(streamKey: string): readonly SnapshotRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, stream_key, as_of, upto_sequence, payload, recorded_at
           FROM snapshots
          WHERE stream_key = ?
          ORDER BY as_of ASC, upto_sequence ASC, id ASC`,
      )
      .all(streamKey) as SnapshotRowShape[];
    return rows.map(rowToSnapshot);
  }

  /**
   * Replay events for {streamKey} from the most recent snapshot
   * ≤ {asOf} forward to {asOf}. When no snapshot exists, degrades to a
   * naive `replay({ asOf, ...filter })` from `sequence: 1`.
   *
   * The store does not yield the snapshot itself — only the delta
   * events. Consumers wanting the full as-of state load the snapshot
   * (`loadSnapshot()`) and then fold the delta on top.
   */
  *replayFromSnapshot(opts: ReplayFromSnapshotOpts): Generator<Event> {
    if (!opts.streamKey) {
      throw new Error("EventStore.replayFromSnapshot: streamKey required");
    }
    if (!opts.asOf) {
      throw new Error("EventStore.replayFromSnapshot: asOf required");
    }
    const snap = this.loadSnapshot(opts.streamKey, opts.asOf);
    const fromSequence = snap ? snap.uptoSequence + 1 : 1;
    yield* this.replay({
      fromSequence,
      asOf: opts.asOf,
      ...(opts.filter ?? {}),
    });
  }

  /**
   * Decide whether a consumer should call `snapshot()` for {streamKey}
   * after its latest append batch. Cadence rules (per Q1 resolution of
   * D-EVENT-STORE-SCALING) are read from the registry per-event-type;
   * `eventType` selects the rule, defaulting to
   * `DEFAULT_SNAPSHOT_CADENCE` when the type is not registered or
   * carries no `cadence` field.
   *
   * Returns:
   *   - `shouldSnapshot: true` when either threshold (K events or T
   *     time) is met, OR no prior snapshot exists for the stream
   *     (first-snapshot bootstrap).
   *   - `shouldSnapshot: false` otherwise.
   *
   * The store does not auto-snapshot inside `append()` — that is a
   * Slice 3 consumer concern (the consumer owns the projection state
   * being snapshotted; the store has no way to compute it).
   */
  shouldSnapshot(args: {
    streamKey: string;
    eventType?: string;
    /** Wall-clock anchor (ISO-8601). Defaults to now. */
    nowUtc?: string;
    /** If known, the most recent snapshot for {streamKey}. The store
     *  loads it via `loadSnapshot` at the latest-known asOf when not
     *  supplied. Suppliable for unit-testing without persisting. */
    lastSnapshot?: SnapshotRow;
  }): SnapshotCadenceCheck {
    const cadence = resolveCadence(args.eventType);
    const now = args.nowUtc ?? new Date().toISOString();

    // Find latest snapshot for the stream (asOf-unbounded — the most
    // recent one written, regardless of its asOf).
    const last =
      args.lastSnapshot ??
      (this.db
        .prepare(
          `SELECT id, stream_key, as_of, upto_sequence, payload, recorded_at
             FROM snapshots
            WHERE stream_key = ?
            ORDER BY id DESC
            LIMIT 1`,
        )
        .get(args.streamKey) as SnapshotRowShape | null);

    if (!last) {
      return {
        shouldSnapshot: true,
        reason: "first-snapshot",
        cadence,
        eventsSinceSnapshot: this.countEventsSince(args.streamKey, 0),
        secondsSinceSnapshot: Number.POSITIVE_INFINITY,
      };
    }

    const lastRow =
      "uptoSequence" in last ? (last as SnapshotRow) : rowToSnapshot(last as SnapshotRowShape);

    const eventsSince = this.countEventsSince(args.streamKey, lastRow.uptoSequence);
    const secondsSince = secondsBetween(lastRow.recordedAt, now);

    if (eventsSince >= cadence.everyKEvents) {
      return {
        shouldSnapshot: true,
        reason: "events-threshold",
        cadence,
        eventsSinceSnapshot: eventsSince,
        secondsSinceSnapshot: secondsSince,
      };
    }
    if (secondsSince >= cadence.everyTSeconds) {
      return {
        shouldSnapshot: true,
        reason: "time-threshold",
        cadence,
        eventsSinceSnapshot: eventsSince,
        secondsSinceSnapshot: secondsSince,
      };
    }
    return {
      shouldSnapshot: false,
      reason: "below-thresholds",
      cadence,
      eventsSinceSnapshot: eventsSince,
      secondsSinceSnapshot: secondsSince,
    };
  }

  /**
   * Count events with sequence > {fromSequence}. Pure debug/cadence
   * aid; not stream-key-scoped because the store does not yet partition
   * by streamKey (Slice 5). Consumers that want stream-scoped counts
   * should pass an `eventType` to `shouldSnapshot` whose cadence
   * reflects per-stream velocity.
   */
  private countEventsSince(_streamKey: string, fromSequence: number): number {
    const r = this.db
      .prepare("SELECT COUNT(*) AS n FROM events WHERE sequence > ?")
      .get(fromSequence) as { n: number };
    return r.n;
  }

  // --------------------------------------------------------------------
  // D-EVENT-STORE-SCALING-PHASE-5 — cold archive partitioning.
  //
  // `archiveEventsOlderThan(cutoffSequence, archivePath)` is the public
  // surface for moving cold events to a separate SQLite file. The hot
  // store retains only events with sequence > cutoffSequence after a
  // successful archive; the registry row in `archive_partitions` allows
  // `PartitionedEventStore` to locate and replay the cold file.
  //
  // Atomicity contract: if any step after the archive-DB write fails, the
  // archive file is removed and the hot store is left intact.
  //
  // Authority: D-EVENT-STORE-SCALING-PHASE-5.
  // --------------------------------------------------------------------

  /**
   * Archive all events with sequence ≤ cutoffSequence to `archivePath`.
   *
   * Steps (must all succeed; partial failure removes archive file):
   *  1. Validate inputs.
   *  2. Open archive DB with identical schema.
   *  3. Copy cold events transactionally into archive DB.
   *  4. Assert archive COUNT(*) == hot COUNT WHERE sequence ≤ cutoff.
   *  5. Compute SHA-256 of archive file.
   *  6. Insert row into archive_partitions.
   *  7. DELETE cold events from hot store.
   *  8. Return partition metadata.
   *
   * Authority: D-EVENT-STORE-SCALING-PHASE-5.
   */
  archiveEventsOlderThan(cutoffSequence: number, archivePath: string): ArchiveResult {
    // Step 1 — validate.
    if (cutoffSequence <= 0) {
      throw new Error(
        "EventStore.archiveEventsOlderThan: cutoffSequence must be > 0 (D-EVENT-STORE-SCALING-PHASE-5)",
      );
    }
    if (!archivePath || archivePath.trim() === "") {
      throw new Error(
        "EventStore.archiveEventsOlderThan: archivePath must be non-empty (D-EVENT-STORE-SCALING-PHASE-5)",
      );
    }
    // Prevent overwriting an existing archive.
    const { existsSync, unlinkSync } = require("node:fs") as typeof import("node:fs");
    if (existsSync(archivePath)) {
      throw new Error(
        `EventStore.archiveEventsOlderThan: archive file already exists at "${archivePath}" — refusing to overwrite (D-EVENT-STORE-SCALING-PHASE-5)`,
      );
    }

    // Step 2 — open archive DB with the same DDL.
    mkdirSync(require("node:path").dirname(archivePath), { recursive: true });
    const archiveDb = new Database(archivePath);
    archiveDb.exec(DDL);

    let archiveResult: ArchiveResult | undefined;
    try {
      // Step 3 — copy cold events transactionally into archive DB.
      const coldRows = this.db
        .prepare("SELECT * FROM events WHERE sequence <= ? ORDER BY sequence ASC")
        .all(cutoffSequence) as RowShape[];

      if (coldRows.length === 0) {
        archiveDb.close();
        unlinkSync(archivePath);
        throw new Error(
          `EventStore.archiveEventsOlderThan: no events found with sequence ≤ ${cutoffSequence} (D-EVENT-STORE-SCALING-PHASE-5)`,
        );
      }

      const insertStmt = archiveDb.prepare(
        `INSERT INTO events
           (sequence, event_id, type, as_of, entity, actor_type, actor_id, citations, payload,
            recorded_at, provenance, aggregate_id, aggregate_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const copyTx = archiveDb.transaction((rows: RowShape[]) => {
        for (const r of rows) {
          insertStmt.run(
            r.sequence,
            r.event_id,
            r.type,
            r.as_of,
            r.entity,
            r.actor_type,
            r.actor_id,
            r.citations,
            r.payload,
            r.recorded_at,
            r.provenance ?? null,
            r.aggregate_id ?? null,
            r.aggregate_label ?? null,
          );
        }
      });
      copyTx(coldRows);

      // Step 4 — integrity gate: archive count must match hot count.
      const archiveCount = (
        archiveDb.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }
      ).n;
      const hotColdCount = (
        this.db
          .prepare("SELECT COUNT(*) AS n FROM events WHERE sequence <= ?")
          .get(cutoffSequence) as { n: number }
      ).n;
      if (archiveCount !== hotColdCount) {
        archiveDb.close();
        unlinkSync(archivePath);
        throw new Error(
          `EventStore.archiveEventsOlderThan: integrity mismatch — archive has ${archiveCount} rows but hot store has ${hotColdCount} cold rows (D-EVENT-STORE-SCALING-PHASE-5)`,
        );
      }

      // Step 5 — compute SHA-256 of archive file.
      archiveDb.close(); // flush WAL before reading bytes
      const fileBytes = readFileSync(archivePath);
      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(fileBytes);
      const sha256Hash = hasher.digest("hex");

      // Step 6 — insert archive_partitions row.
      const partitionId = randomUUID();
      const minSeq = coldRows[0]!.sequence;
      const maxSeq = coldRows[coldRows.length - 1]!.sequence;
      const eventCount = coldRows.length;

      this.db
        .prepare(
          `INSERT INTO archive_partitions
             (partition_id, path, min_sequence, max_sequence, event_count, sha256_hash)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(partitionId, archivePath, minSeq, maxSeq, eventCount, sha256Hash);

      // Step 7 — delete cold events from hot store (in a transaction).
      const deleteTx = this.db.transaction(() => {
        this.db.prepare("DELETE FROM events WHERE sequence <= ?").run(cutoffSequence);
      });
      deleteTx();

      archiveResult = { partitionId, minSeq, maxSeq, eventCount, sha256Hash };
    } catch (err) {
      // Cleanup on partial failure — remove archive file if it exists.
      try {
        if (existsSync(archivePath)) unlinkSync(archivePath);
      } catch {
        // best-effort
      }
      throw err;
    }

    // Step 8 — return metadata.
    return archiveResult;
  }

  /**
   * List all archive partition rows ordered by min_sequence ASC.
   * Used by PartitionedEventStore to discover cold stores.
   *
   * Authority: D-EVENT-STORE-SCALING-PHASE-5.
   */
  listArchivePartitions(): ArchivePartitionRow[] {
    return this.db
      .prepare("SELECT * FROM archive_partitions ORDER BY min_sequence ASC")
      .all() as ArchivePartitionRow[];
  }

  /**
   * Minimum sequence in the hot store, or 0 when empty.
   * Used by the append-only recon pipeline to verify no gap exists
   * between the last cold partition and the hot store floor.
   *
   * Authority: D-EVENT-STORE-SCALING-PHASE-5.
   */
  minSequence(): number {
    const r = this.db.prepare("SELECT MIN(sequence) AS m FROM events").get() as {
      m: number | null;
    };
    return r.m ?? 0;
  }

  close(): void {
    this.db.close();
  }
}

interface SnapshotRowShape {
  id: number;
  stream_key: string;
  as_of: string;
  upto_sequence: number;
  payload: string;
  recorded_at: string;
}

function rowToSnapshot(row: SnapshotRowShape): SnapshotRow {
  return {
    id: row.id,
    streamKey: row.stream_key,
    asOf: row.as_of,
    uptoSequence: row.upto_sequence,
    payload: row.payload,
    recordedAt: row.recorded_at,
  };
}

function resolveCadence(eventType?: string): SnapshotCadence {
  if (!eventType) return DEFAULT_SNAPSHOT_CADENCE;
  const meta = lookupEventType(eventType);
  return meta?.cadence ?? DEFAULT_SNAPSHOT_CADENCE;
}

function secondsBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, (b - a) / 1000);
}

/**
 * Structural equality over the `ProvenanceTag` shape. Used by
 * `reclassifyProvenance` for idempotency. We don't reach for a full
 * deep-equality helper because the tag shape is small + flat (kind,
 * scenario?, variant?, sourceLineage, tags?).
 */
function deepProvenanceEqual(a: ProvenanceTag, b: ProvenanceTag): boolean {
  if (a.kind !== b.kind) return false;
  if ((a.scenario ?? null) !== (b.scenario ?? null)) return false;
  if ((a.variant ?? null) !== (b.variant ?? null)) return false;
  if (a.sourceLineage !== b.sourceLineage) return false;
  const aTags = a.tags ?? [];
  const bTags = b.tags ?? [];
  if (aTags.length !== bTags.length) return false;
  for (let i = 0; i < aTags.length; i++) if (aTags[i] !== bTags[i]) return false;
  return true;
}

interface RowShape {
  sequence: number;
  event_id: string;
  type: string;
  as_of: string;
  entity: string;
  actor_type: string;
  actor_id: string;
  citations: string;
  payload: string;
  recorded_at: string;
  provenance: string | null;
  aggregate_id: string | null;
  aggregate_label: string | null;
}
