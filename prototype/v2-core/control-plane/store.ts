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

import { V2_ENVELOPE_SCHEMA_VERSION } from "./schema-version";
import { ANCHOR_TENANT_ID, type TenantId } from "./tenant";

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
  -- First-class tenant + schema-version columns (D-EVENT-ENVELOPE-TENANT-COLUMN,
  -- D-EVENT-ENVELOPE-SCHEMA-VERSION). Storage-shape only — NOT S10 routing.
  tenant_id      TEXT    NOT NULL DEFAULT '${ANCHOR_TENANT_ID}',
  schema_version INTEGER NOT NULL DEFAULT ${V2_ENVELOPE_SCHEMA_VERSION},
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now')),
  provenance      TEXT,
  aggregate_id    TEXT,
  aggregate_label TEXT
);
CREATE INDEX IF NOT EXISTS idx_cp_events_type    ON events(type);
CREATE INDEX IF NOT EXISTS idx_cp_events_entity  ON events(entity);
CREATE INDEX IF NOT EXISTS idx_cp_events_as_of   ON events(as_of);
CREATE INDEX IF NOT EXISTS idx_cp_events_type_seq ON events(type, sequence);
-- Covering index for the tenant axis (D-EVENT-ENVELOPE-TENANT-COLUMN).
CREATE INDEX IF NOT EXISTS idx_cp_events_tenant_seq ON events(tenant_id, sequence);

-- Incremental recon cursors (mirrors v1 EventStore schema).
CREATE TABLE IF NOT EXISTS recon_cursors (
  pipeline_id   TEXT    PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;

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
  tenant_id: string;
  schema_version: number;
  recorded_at: string;
  provenance: string | null;
  aggregate_id: string | null;
  aggregate_label: string | null;
}

interface PragmaColumnRow {
  name: string;
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
   * Owning tenant — a first-class column (D-EVENT-ENVELOPE-TENANT-COLUMN).
   * Optional on input; defaults to the anchor tenant on append. Always present
   * on replay output. Storage-shape only — NOT S10 routing enforcement.
   */
  readonly tenantId?: TenantId;
  /**
   * Explicit payload schema version — a first-class column
   * (D-EVENT-ENVELOPE-SCHEMA-VERSION). Optional on input; defaults to
   * `V2_ENVELOPE_SCHEMA_VERSION` on append. Always present on replay output.
   */
  readonly schemaVersion?: number;
}

export interface CpReplayOpts {
  readonly fromSequence?: number;
  readonly type?: string;
  readonly entity?: string;
}

/**
 * The typed control-plane store. Structurally compatible with the v1
 * `EventStore` surface: `append` + `replay`. The subset is intentional —
 * control-plane events are simpler than the full event store (no provenance
 * substrate, no snapshot substrate, no archive partitioning in S1). Those
 * extensions land when the control-plane store is ready for the M8 cloud lift.
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
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous  = NORMAL;
        PRAGMA busy_timeout = 5000;
      `);
    }
    this.db.exec(CP_DDL);
    this.migrateSchema();
  }

  /**
   * Add the first-class `tenant_id` + `schema_version` columns and the
   * `(tenant_id, sequence)` covering index to a control-plane store created
   * before D-EVENT-ENVELOPE-TENANT-COLUMN / -SCHEMA-VERSION. Idempotent: on a
   * fresh store the `CREATE TABLE` already produced the columns and these
   * ALTERs are skipped. Legacy rows take the anchor-tenant / version-1 default
   * (fail-closed: a known tenant, never NULL).
   */
  private migrateSchema(): void {
    const cols = this.db
      .query<PragmaColumnRow, []>("PRAGMA table_info(events)")
      .all()
      .map((r) => r.name);
    if (!cols.includes("tenant_id")) {
      this.db.exec(
        `ALTER TABLE events ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '${ANCHOR_TENANT_ID}'`,
      );
    }
    if (!cols.includes("schema_version")) {
      this.db.exec(
        `ALTER TABLE events ADD COLUMN schema_version INTEGER NOT NULL DEFAULT ${V2_ENVELOPE_SCHEMA_VERSION}`,
      );
    }
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_cp_events_tenant_seq ON events(tenant_id, sequence)",
    );
  }

  append(event: CpEvent): void {
    const tenantId = event.tenantId ?? (ANCHOR_TENANT_ID as TenantId);
    const schemaVersion = event.schemaVersion ?? V2_ENVELOPE_SCHEMA_VERSION;
    this.db
      .prepare(
        `INSERT OR IGNORE INTO events
           (event_id, type, as_of, entity, actor_type, actor_id, citations, payload, tenant_id, schema_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        tenantId,
        schemaVersion,
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
        tenantId: row.tenant_id as TenantId,
        schemaVersion: row.schema_version,
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
