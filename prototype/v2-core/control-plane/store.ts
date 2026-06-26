// v2-core/control-plane/store.ts
//
// Control-plane store bootstrap — V2 S1.
//
// Opens (or creates) a SQLite database whose schema is structurally identical
// to the v1 EventStore so the same tooling (PartitionedEventStore, recon
// pipelines, archive partitioning) works unchanged. The control-plane is a
// cross-tenant store for the fleet metadata events defined in `./events.ts`.
//
// PATH RESOLUTION ORDER (from `openControlPlaneStore` with no explicit path):
//   1. `BANK_V2_CONTROL_PLANE_DB` environment variable
//   2. `$HOME/.local/share/bank/v2-control-plane.db` (default)
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from
// any v1 code-line directory (`platform/`, `runtime/`, `domains/`, etc.).
// The only external dependencies permitted are bare npm packages (e.g. `zod`)
// and Node builtins (`node:*`, `bun:*`). See `recon:v2-no-v1-import`.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C — per-tenant stores +
// control-plane store); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
// Author: Atlas (Substrate Architect, engineering).

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import { lookupV2EventType, validateV2Payload } from "../registry";

// ---------------------------------------------------------------------------
// Schema DDL — structurally identical to the v1 EventStore DDL.
// Keeping parity means the same `PartitionedEventStore`, archive tooling,
// and recon pipelines can target this store without modification.
// ---------------------------------------------------------------------------

const CP_DDL = `
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
  schema_version INTEGER NOT NULL DEFAULT 1, -- W0: V2Envelope.schemaVersion
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now')),
  provenance      TEXT,           -- W0: JSON ProvenanceTag (kind / sourceLineage / …)
  retention_class TEXT,           -- W0: archival-tier policy from the v2 registry row
  aggregate_id    TEXT,
  aggregate_label TEXT
);
CREATE INDEX IF NOT EXISTS idx_cp_events_type    ON events(type);
CREATE INDEX IF NOT EXISTS idx_cp_events_entity  ON events(entity);
CREATE INDEX IF NOT EXISTS idx_cp_events_as_of   ON events(as_of);
CREATE INDEX IF NOT EXISTS idx_cp_events_type_seq ON events(type, sequence);
-- W0: archive / cold-partition tooling targets the v2 store by retention_class.
CREATE INDEX IF NOT EXISTS idx_cp_events_retention ON events(retention_class);

-- Incremental recon cursors (mirrors v1 EventStore schema).
CREATE TABLE IF NOT EXISTS recon_cursors (
  pipeline_id   TEXT    PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;

// W0: additive column migrations for stores created before Wave 0. SQLite
// `ALTER TABLE ... ADD COLUMN` is a no-op-equivalent on a fresh store (the
// CREATE above already has the columns) and a backwards-compatible upgrade on
// an existing store. Mirrors the v1 EventStore's in-place column migration.
const CP_COLUMN_MIGRATIONS: ReadonlyArray<{ readonly column: string; readonly ddl: string }> = [
  {
    column: "schema_version",
    ddl: "ALTER TABLE events ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1",
  },
  { column: "provenance", ddl: "ALTER TABLE events ADD COLUMN provenance TEXT" },
  { column: "retention_class", ddl: "ALTER TABLE events ADD COLUMN retention_class TEXT" },
];

// ---------------------------------------------------------------------------
// Raw row shape as returned by bun:sqlite
// ---------------------------------------------------------------------------

interface CpEventRow {
  sequence: number;
  event_id: string;
  type: string;
  as_of: string;
  entity: string;
  actor_type: string;
  actor_id: string;
  citations: string;
  payload: string;
  schema_version: number;
  recorded_at: string;
  provenance: string | null;
  retention_class: string | null;
  aggregate_id: string | null;
  aggregate_label: string | null;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CpActor {
  readonly type: "system" | "human" | "service";
  readonly id: string;
}

/**
 * A control-plane event as stored and replayed. The shape is a strict subset
 * of the v1 `Event` type — the same envelope columns, the same payload-as-
 * Record, the same citation array. Keeping parity means existing tooling
 * (projection helpers, recon plumbing) transfers directly.
 */
export interface CpEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string; // ISO-8601 UTC
  readonly entity: string; // control-plane entity — "control-plane" for fleet-wide events
  readonly actor: CpActor;
  readonly citations: readonly string[];
  readonly payload: Record<string, unknown>;
  /**
   * W0: the V2Envelope schema version for this event. Optional on the input
   * type — `append()` defaults an omitted value to 1 (the foothold default).
   * Always present on replayed events. Aligns with `V2Envelope.schemaVersion`.
   */
  readonly schemaVersion?: number;
  /**
   * W0: typed multi-axis provenance tag (kind / sourceLineage / …),
   * JSON-serialised onto the `provenance` column so the same archive / recon
   * tooling that targets the v1 store can target the v2 store. Optional —
   * NULL on the row when omitted (build-phase; the soft-tagger backfills).
   */
  readonly provenance?: Record<string, unknown>;
  /**
   * W0: archival-tier policy for cold storage, persisted to the
   * `retention_class` column. When omitted, `append()` derives it from the
   * v2 registry row's retention (`retention.archivalTier`) for a REGISTERED
   * type, leaving it NULL for an unregistered type.
   */
  readonly retentionClass?: string;
}

export interface CpReplayOpts {
  readonly fromSequence?: number;
  readonly type?: string;
  readonly entity?: string;
}

/**
 * The typed control-plane store. Structurally compatible with the v1
 * `EventStore` surface: `append` + `replay`.
 *
 * W0 (D-BANK-WIDE-V2-MIGRATION) turned this into the general-purpose v2 event
 * host: `append()` now (a) validates the payload against the v2 type registry
 * (fail-closed on a registered type, accept-on-unregistered), and (b) stamps
 * `schema_version`, `provenance`, and `retention_class` so the same archive /
 * cold-partition + recon tooling can target the v2 store (Wave 5 deletion,
 * Phase-5 retire-to-cold). The snapshot substrate is still the v1 store's;
 * it lands here when the v2 host needs snapshot-from-replay.
 */
export interface ControlPlaneStore {
  /** Append a single control-plane event. Idempotent on `event_id`. */
  append(event: CpEvent): void;
  /** Streaming replay in sequence order. */
  replay(opts?: CpReplayOpts): Generator<CpEvent>;
  /** Total event count. */
  count(): number;
  close(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

class ControlPlaneStoreImpl implements ControlPlaneStore {
  private readonly db: Database;

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(resolve(path)), { recursive: true });
    }
    this.db = new Database(path);
    if (path !== ":memory:") {
      // `busy_timeout` MUST precede `journal_mode = WAL`: the WAL switch
      // takes a momentary lock and, with busy_timeout still at the default
      // 0, fails immediately with `SQLITE_BUSY: database is locked` when a
      // concurrent connection (store-tee writer vs *-v2-parity recon reader)
      // holds the file. Mirrors the same fix in
      // platform/event-store/store.ts. Authority: Engineering Charter cmd 1.
      this.db.exec(`
        PRAGMA busy_timeout = 5000;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous  = NORMAL;
      `);
    }
    this.db.exec(CP_DDL);
    this.runColumnMigrations();
  }

  /**
   * W0: additive in-place column migrations for stores created before Wave 0.
   * Each ALTER is wrapped in a guard that inspects `PRAGMA table_info` so a
   * fresh store (where CP_DDL already declared the columns) skips them.
   * Failure to add a column is fatal (fail-closed) — a half-migrated store
   * would silently drop schema_version / provenance / retention on append.
   */
  private runColumnMigrations(): void {
    const cols = new Set(
      (this.db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>).map(
        (r) => r.name,
      ),
    );
    for (const m of CP_COLUMN_MIGRATIONS) {
      if (!cols.has(m.column)) {
        this.db.exec(m.ddl);
      }
    }
  }

  append(event: CpEvent): void {
    // W0: fail-closed payload validation against the v2 type registry. A
    // REGISTERED type with a bad payload throws (propagated as an append
    // failure); an UNREGISTERED type is accepted (build-phase forward compat —
    // footholds and pre-registration Wave-2 types keep appending).
    validateV2Payload(event.type, event.payload);

    const schemaVersion = event.schemaVersion ?? 1;
    const provenanceJson = event.provenance ? JSON.stringify(event.provenance) : null;
    // Derive retention_class from the registry row when the caller omits it.
    const retentionClass =
      event.retentionClass ?? lookupV2EventType(event.type)?.retention.archivalTier ?? null;

    this.db
      .prepare(
        `INSERT OR IGNORE INTO events
           (event_id, type, as_of, entity, actor_type, actor_id, citations, payload,
            schema_version, provenance, retention_class)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.event_id,
        event.type,
        event.as_of,
        event.entity,
        event.actor.type,
        event.actor.id,
        JSON.stringify(event.citations),
        JSON.stringify(event.payload),
        schemaVersion,
        provenanceJson,
        retentionClass,
      );
  }

  *replay(opts: CpReplayOpts = {}): Generator<CpEvent> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (opts.fromSequence !== undefined) {
      where.push("sequence >= ?");
      params.push(opts.fromSequence);
    }
    if (opts.type !== undefined) {
      where.push("type = ?");
      params.push(opts.type);
    }
    if (opts.entity !== undefined) {
      where.push("entity = ?");
      params.push(opts.entity);
    }

    const sql = `SELECT * FROM events ${
      where.length ? `WHERE ${where.join(" AND ")}` : ""
    } ORDER BY sequence ASC`;

    const rows = this.db.prepare(sql).all(...(params as never[])) as CpEventRow[];
    for (const row of rows) {
      yield {
        event_id: row.event_id,
        type: row.type,
        as_of: row.as_of,
        entity: row.entity,
        actor: { type: row.actor_type as CpActor["type"], id: row.actor_id },
        citations: JSON.parse(row.citations) as string[],
        payload: JSON.parse(row.payload) as Record<string, unknown>,
        schemaVersion: row.schema_version,
        ...(row.provenance
          ? { provenance: JSON.parse(row.provenance) as Record<string, unknown> }
          : {}),
        ...(row.retention_class ? { retentionClass: row.retention_class } : {}),
      };
    }
  }

  count(): number {
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
    return r.n;
  }

  close(): void {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Default control-plane DB path. Resolves in order:
 *   1. `BANK_V2_CONTROL_PLANE_DB` environment variable
 *   2. `$HOME/.local/share/bank/v2-control-plane.db`
 */
export function defaultControlPlanePath(): string {
  const env = process.env.BANK_V2_CONTROL_PLANE_DB?.trim();
  if (env) return env;
  return resolve(homedir(), ".local", "share", "bank", "v2-control-plane.db");
}

/**
 * Open (or create) the control-plane SQLite store at `path`.
 *
 * If `path` is omitted the factory resolves via `defaultControlPlanePath()`.
 * Pass `":memory:"` for an in-process ephemeral store (tests).
 *
 * The store is structurally compatible with the v1 EventStore (identical DDL
 * for the `events` table) so the same recon tooling, PartitionedEventStore,
 * and archive-partitioning scripts work without modification.
 */
export function openControlPlaneStore(path?: string): ControlPlaneStore {
  const resolved = path ?? defaultControlPlanePath();
  return new ControlPlaneStoreImpl(resolved);
}

/**
 * Generate a new control-plane event_id (UUID v4).
 * Convenience helper so callers don't need to import `node:crypto` separately.
 */
export function newCpEventId(): string {
  return randomUUID();
}
