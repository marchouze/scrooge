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
//
// Author: Atlas

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";
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
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_type   ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity);
CREATE INDEX IF NOT EXISTS idx_events_as_of  ON events(as_of);

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
`;

export interface ReplayOpts {
  fromSequence?: number;
  entity?: string;
  type?: string;
  asOf?: string; // upper bound (inclusive) on event.as_of
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
  readonly reason:
    | "first-snapshot"
    | "events-threshold"
    | "time-threshold"
    | "below-thresholds";
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
  }

  /** Append a single event. P2 enforced via the schema (citations ≥ 1).
   * Per-type payload validation dispatched through the A1 event-type
   * registry — types with a registered Zod schema fail-closed; types
   * without one (or unregistered types) flow through envelope-only. */
  append(raw: Event): void {
    const e = eventSchema.parse(raw);
    validatePayload(e.type, e.payload);
    this.db
      .prepare(
        `INSERT INTO events
           (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
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
      };
    }
  }

  count(): number {
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM events").get() as {
      n: number;
    };
    return r.n;
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
      .get(
        opts.streamKey,
        opts.asOf,
        opts.uptoSequence,
        opts.payload,
      ) as SnapshotRowShape;
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
      "uptoSequence" in last
        ? (last as SnapshotRow)
        : rowToSnapshot(last as SnapshotRowShape);

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
}
