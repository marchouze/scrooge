// v2-core/control-plane/anchor-store.ts
//
// Shared V2 anchor-store DDL + append helper (WS-EVENT-SUBSTRATE-SCALING).
//
// WHY THIS MODULE EXISTS
// ----------------------
// The V2 anchor store (the `v2_events` table behind `BANK_V2_ANCHOR_DB`) had its
// DDL DUPLICATED inline across three scripts (`seed-v2-anchor-bank-standing-data`,
// `seed-v2-fil-instances-ir-fx`, `v2-anchor-migration-rehearsal`) plus its
// reader column-lists scattered across four recon/risk files. That triplication
// is the root cause that let the schema drift silently. This module is the
// SINGLE canonical definition of the V2 anchor-store shape; every seed, rehearsal,
// and reader references it so the DDL can only change in one place.
//
// WHAT THIS SLICE ADDS (D-EVENT-ENVELOPE-TENANT-COLUMN; D-EVENT-ENVELOPE-SCHEMA-VERSION)
// -------------------------------------------------------------------------------------
//   A. `tenant_id TEXT NOT NULL` first-class column (default = the anchor tenant
//      for any unset/legacy row) + a covering index `(tenant_id, sequence)`.
//      tenantId is no longer buried in the JSON payload — it is a real, indexed
//      column persisted from the V2 envelope's `tenantId`. This is STORAGE-SHAPE
//      ONLY: it does NOT enable S10 routing/isolation enforcement.
//   B. `schema_version INTEGER NOT NULL` first-class column stamped from the V2
//      envelope's explicit `schemaVersion` at append. Go-forward V2 events carry
//      an EXPLICIT version (no payload-shape sniffing); the column makes the
//      version queryable and the upcaster dispatch version-explicit.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory (`platform/`, `runtime/`, `domains/`, `scripts/`, …).
// Only bare npm packages and `node:*` / `bun:*` builtins are permitted.
// See `recon:v2-no-v1-import`.
//
// Authority: D-EVENT-ENVELOPE-TENANT-COLUMN; D-EVENT-ENVELOPE-SCHEMA-VERSION
//   (CEO-approved, session-delegation 2026-06-15); D-V2-TENANCY-ARCHITECTURE;
//   D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:v2-event-envelope-hardening-indexed-tenant-colum:2026-06-15
// Author: Atlas (Substrate Architect, engineering).

import type { Database } from "bun:sqlite";

import { V2_ENVELOPE_SCHEMA_VERSION } from "./schema-version";
import { ANCHOR_TENANT_ID, type TenantId } from "./tenant";

export { LEGACY_IMPLIED_SCHEMA_VERSION, V2_ENVELOPE_SCHEMA_VERSION } from "./schema-version";

// ---------------------------------------------------------------------------
// Canonical V2 anchor-store DDL
// ---------------------------------------------------------------------------

/**
 * The single canonical DDL for the V2 anchor store (`v2_events`). Structurally
 * a superset of the v1 EventStore `events` table — same envelope columns — plus
 * the two first-class columns this slice adds:
 *
 *   - `tenant_id`      TEXT NOT NULL DEFAULT <anchor>  (+ covering index)
 *   - `schema_version` INTEGER NOT NULL DEFAULT 1
 *
 * `CREATE TABLE IF NOT EXISTS` is idempotent; `ensureAnchorStoreSchema` adds the
 * new columns to a pre-existing table via `ALTER TABLE` (SQLite cannot add a
 * column inside `CREATE TABLE IF NOT EXISTS` once the table exists).
 */
export const V2_ANCHOR_DDL = `
CREATE TABLE IF NOT EXISTS v2_events (
  sequence       INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id       TEXT    UNIQUE NOT NULL,
  type           TEXT    NOT NULL,
  as_of          TEXT    NOT NULL,
  entity         TEXT    NOT NULL,
  actor_type     TEXT    NOT NULL,
  actor_id       TEXT    NOT NULL,
  citations      TEXT    NOT NULL,
  payload        TEXT    NOT NULL,
  tenant_id      TEXT    NOT NULL DEFAULT '${ANCHOR_TENANT_ID}',
  schema_version INTEGER NOT NULL DEFAULT ${V2_ENVELOPE_SCHEMA_VERSION},
  recorded_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_v2_type            ON v2_events(type);
CREATE INDEX IF NOT EXISTS idx_v2_entity          ON v2_events(entity);
CREATE INDEX IF NOT EXISTS idx_v2_as_of           ON v2_events(as_of);
CREATE INDEX IF NOT EXISTS idx_v2_tenant_sequence ON v2_events(tenant_id, sequence);
`;

/**
 * The ordered column list for a full V2 anchor-store INSERT, in the order
 * `appendAnchorEvent` binds parameters. Exported so callers (and tests) can
 * assert the contract rather than re-spell it.
 */
export const V2_ANCHOR_INSERT_COLUMNS = [
  "event_id",
  "type",
  "as_of",
  "entity",
  "actor_type",
  "actor_id",
  "citations",
  "payload",
  "tenant_id",
  "schema_version",
] as const;

// ---------------------------------------------------------------------------
// Schema bootstrap — create the table, and ALTER in the new columns if the
// table pre-dates this slice.
// ---------------------------------------------------------------------------

interface PragmaColumnRow {
  readonly name: string;
}

/**
 * Ensure the V2 anchor store exists and carries the `tenant_id` +
 * `schema_version` columns and the `(tenant_id, sequence)` covering index.
 *
 * Idempotent and migration-safe:
 *   - On a fresh DB, `CREATE TABLE IF NOT EXISTS` builds the full shape.
 *   - On a DB created before this slice, `CREATE TABLE IF NOT EXISTS` is a
 *     no-op (the table exists) and the missing columns are added via
 *     `ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT …` (legacy rows take the
 *     anchor-tenant / version-1 default — fail-closed: a known tenant, never
 *     a NULL). The covering index is then (re)created.
 *
 * @param db - an open bun:sqlite Database for the V2 anchor store.
 */
export function ensureAnchorStoreSchema(db: Database): void {
  db.exec(V2_ANCHOR_DDL);

  const cols = db
    .query<PragmaColumnRow, []>("PRAGMA table_info(v2_events)")
    .all()
    .map((r) => r.name);

  if (!cols.includes("tenant_id")) {
    db.exec(
      `ALTER TABLE v2_events ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '${ANCHOR_TENANT_ID}'`,
    );
  }
  if (!cols.includes("schema_version")) {
    db.exec(
      `ALTER TABLE v2_events ADD COLUMN schema_version INTEGER NOT NULL DEFAULT ${V2_ENVELOPE_SCHEMA_VERSION}`,
    );
  }
  // (Re)create the covering index now that the column is guaranteed present.
  db.exec("CREATE INDEX IF NOT EXISTS idx_v2_tenant_sequence ON v2_events(tenant_id, sequence)");
}

// ---------------------------------------------------------------------------
// Append helper — the single write path that stamps tenant_id + schema_version
// ---------------------------------------------------------------------------

/**
 * A V2 anchor-store event as supplied by a caller (seed / rehearsal). The
 * envelope columns mirror the v1 Event surface; `tenantId` and `schemaVersion`
 * are stamped onto first-class columns.
 */
export interface AnchorEventInput {
  readonly eventId: string;
  readonly type: string;
  readonly asOf: string;
  readonly entity: string;
  readonly actorType: string;
  readonly actorId: string;
  readonly citations: readonly string[];
  readonly payload: Record<string, unknown>;
  /** Owning tenant — defaults to the anchor tenant when omitted. */
  readonly tenantId?: TenantId;
  /** Explicit schema version — defaults to the go-forward version when omitted. */
  readonly schemaVersion?: number;
}

/**
 * Append a single event into the V2 anchor store, stamping `tenant_id` and
 * `schema_version` as first-class columns (NOT buried in the JSON payload).
 *
 * Idempotent on `event_id` (`INSERT OR IGNORE`). The caller is responsible for
 * `ensureAnchorStoreSchema(db)` having run first (the seed/rehearsal entrypoints
 * call it at bootstrap).
 */
export function appendAnchorEvent(db: Database, event: AnchorEventInput): void {
  const tenantId = event.tenantId ?? (ANCHOR_TENANT_ID as TenantId);
  const schemaVersion = event.schemaVersion ?? V2_ENVELOPE_SCHEMA_VERSION;
  db.query(
    `INSERT OR IGNORE INTO v2_events
       (${V2_ANCHOR_INSERT_COLUMNS.join(", ")})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.eventId,
    event.type,
    event.asOf,
    event.entity,
    event.actorType,
    event.actorId,
    JSON.stringify(event.citations),
    JSON.stringify(event.payload),
    tenantId,
    schemaVersion,
  );
}
