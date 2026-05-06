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
//
// Author: Atlas

import { Database } from "bun:sqlite";
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
`;

export interface ReplayOpts {
  fromSequence?: number;
  entity?: string;
  type?: string;
  asOf?: string; // upper bound (inclusive) on event.as_of
}

export class EventStore {
  private readonly db: Database;

  constructor(path = ":memory:") {
    this.db = new Database(path);
    this.db.exec(DDL);
  }

  /** Append a single event. P2 enforced via the schema (citations ≥ 1). */
  append(raw: Event): void {
    const e = eventSchema.parse(raw);
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

  close(): void {
    this.db.close();
  }
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
