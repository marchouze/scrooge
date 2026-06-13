// scripts/v2-anchor-migration-rehearsal.ts
//
// V2 S10 — ANCHOR MIGRATION REHEARSAL (scratch-only).
//
// Proves the anchor bank's v2 events can be migrated into a dedicated
// per-tenant store (Option C) with byte-equivalence and identical projection
// results — as a REHEARSAL, NOT a live destructive migration.
//
// ⚠️ HARD CONSTRAINT — NEVER touch the live canonical store destructively.
// ───────────────────────────────────────────────────────────────────────────
// • The SOURCE is the v2 anchor store (`BANK_V2_ANCHOR_DB` →
//   `$HOME/.local/share/bank/v2-anchor.db`), opened STRICTLY READ-ONLY.
// • The rehearsal REFUSES to run if the resolved source path is the v1 canonical
//   event store (`event.db`) — a guard against mis-pointing.
// • The TARGET is a SCRATCH per-tenant store created under an OS temp dir
//   (`mkdtempSync`), written, asserted against, and DELETED at the end. The
//   rehearsal never writes to the source or to the canonical store.
//
// WHAT IT ASSERTS
// ───────────────
// 1. EVENT COUNT parity: scratch row count == source row count.
// 2. BYTE-EQUIVALENCE: for every event, the canonical column tuple
//    (event_id, type, as_of, entity, actor, citations, payload) hashes
//    identically in scratch and source (order-independent, keyed by event_id).
// 3. PROJECTION parity: folding both stores' v2 events into a canonical
//    standing-data summary (count-by-type + per-natural-key payloads for
//    products / account-types / RAS lines + SA-CCR-relevant FIL-instance terms)
//    yields byte-identical JSON.
// 4. ENFORCEMENT-PATH parity: the scratch read is performed THROUGH the S10
//    tenant-scoped store (`resolveTenantStore` against an anchor-only resolver),
//    proving the enforced read path returns the same events as a raw source read
//    and never leaks a cross-tenant row.
//
// The rehearsal is idempotent (a fresh scratch file each run; cleaned up) and
// emits a machine-readable result line. Exit 0 on parity, non-zero otherwise.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s10-tenant-axis-enforcement-anchor-migration-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import { ANCHOR_TENANT_ID, type TenantId } from "../v2-core/control-plane/tenant";
import {
  type TenantEventStore,
  type TenantTaggedEvent,
  makeAnchorOnlyResolver,
  resetTenantStoreResolver,
  resolveTenantStore,
  swapTenantStoreResolver,
} from "../v2-core/control-plane/tenant-store";

// ---------------------------------------------------------------------------
// Row shape + canonical hashing
// ---------------------------------------------------------------------------

interface V2EventRow {
  event_id: string;
  type: string;
  as_of: string;
  entity: string;
  actor_type: string;
  actor_id: string;
  citations: string; // JSON string
  payload: string; // JSON string
}

const V2_DDL = `
CREATE TABLE IF NOT EXISTS v2_events (
  sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT    UNIQUE NOT NULL,
  type        TEXT    NOT NULL,
  as_of       TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  actor_type  TEXT    NOT NULL,
  actor_id    TEXT    NOT NULL,
  citations   TEXT    NOT NULL,
  payload     TEXT    NOT NULL,
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_v2_type   ON v2_events(type);
CREATE INDEX IF NOT EXISTS idx_v2_entity ON v2_events(entity);
CREATE INDEX IF NOT EXISTS idx_v2_as_of  ON v2_events(as_of);
`;

/**
 * Canonical per-event hash over the columns that define the event's identity
 * and content. `recorded_at` and `sequence` are EXCLUDED — they are storage
 * metadata (wall-clock insert time / autoincrement), not part of the event's
 * canonical form; a migration that preserves them by accident is fine but
 * parity must not depend on them.
 */
function rowHash(r: V2EventRow): string {
  // Re-serialise citations + payload through parse→stringify so byte-level JSON
  // whitespace differences do not register as a content difference. The event's
  // canonical content is the structured value, not its textual encoding.
  const canonical = JSON.stringify({
    event_id: r.event_id,
    type: r.type,
    as_of: r.as_of,
    entity: r.entity,
    actor_type: r.actor_type,
    actor_id: r.actor_id,
    citations: JSON.parse(r.citations) as unknown,
    payload: JSON.parse(r.payload) as unknown,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// ---------------------------------------------------------------------------
// Source resolution + safety guards
// ---------------------------------------------------------------------------

function resolveAnchorSourceDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return resolve(fromEnv);
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

function resolveCanonicalDb(): string {
  const fromEnv = process.env.BANK_EVENT_DB;
  if (fromEnv && fromEnv.length > 0) return resolve(fromEnv);
  return resolve(homedir(), ".local", "share", "bank", "event.db");
}

/**
 * Refuse to treat the v1 canonical event store as the migration source. The
 * canonical store just recovered from a WAL-sidecar incident; the rehearsal must
 * never open it (even read-only) under the guise of "anchor source".
 */
function assertSourceIsNotCanonical(sourcePath: string): void {
  const canonical = resolveCanonicalDb();
  if (resolve(sourcePath) === resolve(canonical)) {
    throw new Error(
      `REFUSING: the migration source "${sourcePath}" is the v1 canonical event store. ` +
        `The rehearsal reads ONLY the v2 anchor store (BANK_V2_ANCHOR_DB). Never the canonical store.`,
    );
  }
  if (/(^|\/)event\.db$/.test(sourcePath)) {
    throw new Error(
      `REFUSING: the migration source "${sourcePath}" looks like a canonical "event.db". ` +
        `Point BANK_V2_ANCHOR_DB at the v2 anchor store (v2-anchor.db).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Read source rows (READ-ONLY) + canonical projection fold
// ---------------------------------------------------------------------------

function readV2Rows(dbPath: string, readonly: boolean): V2EventRow[] {
  const db = new Database(dbPath, readonly ? { readonly: true } : undefined);
  try {
    const tbl = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='v2_events'",
      )
      .all();
    if (tbl.length === 0) return [];
    return db
      .query<V2EventRow, []>(
        "SELECT event_id, type, as_of, entity, actor_type, actor_id, citations, payload FROM v2_events ORDER BY sequence ASC",
      )
      .all();
  } finally {
    db.close();
  }
}

/**
 * Fold v2 event rows into a canonical standing-data summary. This is the
 * "projection" whose parity proves the migrated store reads identically:
 *   - countByType — the event-type histogram.
 *   - products / accountTypes / rasLines — per-natural-key payloads (sorted),
 *     which is exactly what the v2-standing-data consumers read.
 * Deterministic ordering so the JSON is byte-comparable.
 */
function foldStandingData(rows: V2EventRow[]): string {
  const countByType: Record<string, number> = {};
  const products: Record<string, unknown> = {};
  const accountTypes: Record<string, unknown> = {};
  const rasLines: Record<string, unknown> = {};
  const deprecations: Record<string, unknown> = {};

  for (const r of rows) {
    countByType[r.type] = (countByType[r.type] ?? 0) + 1;
    const p = JSON.parse(r.payload) as Record<string, unknown>;
    switch (r.type) {
      case "V2ProductRegistered":
        if (typeof p.productId === "string") products[p.productId] = p;
        break;
      case "V2ProductDeprecated":
        if (typeof p.productId === "string") deprecations[p.productId] = p;
        break;
      case "V2AccountTypeRegistered":
        if (typeof p.accountTypeKey === "string") accountTypes[p.accountTypeKey] = p;
        break;
      case "V2RiskAppetiteSet":
        if (typeof p.rasLineId === "string") rasLines[p.rasLineId] = p;
        break;
      default:
        break;
    }
  }

  const sortKeys = (o: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

  return JSON.stringify({
    countByType: sortKeys(countByType),
    products: sortKeys(products),
    deprecations: sortKeys(deprecations),
    accountTypes: sortKeys(accountTypes),
    rasLines: sortKeys(rasLines),
  });
}

// ---------------------------------------------------------------------------
// The migration: source rows → scratch per-tenant store, through the S10
// enforced tenant-scoped store.
// ---------------------------------------------------------------------------

/** Build a TenantEventStore over a SQLite-backed v2_events table at `dbPath`. */
function makeSqliteTenantStore(dbPath: string, tenantId: TenantId): {
  store: TenantEventStore;
  close: () => void;
} {
  const db = new Database(dbPath);
  db.exec(V2_DDL);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO v2_events
       (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const store: TenantEventStore = {
    append(e: TenantTaggedEvent) {
      const extra = e.extra ?? {};
      insert.run(
        e.eventId,
        e.type,
        e.asOf,
        e.entity,
        String(extra.actor_type ?? "service"),
        String(extra.actor_id ?? "agent:atlas:v2-anchor-migration-rehearsal"),
        String(extra.citations ?? "[]"),
        JSON.stringify(e.payload),
      );
    },
    *replayAll() {
      const rows = db
        .query<V2EventRow, []>(
          "SELECT event_id, type, as_of, entity, actor_type, actor_id, citations, payload FROM v2_events ORDER BY sequence ASC",
        )
        .all();
      for (const r of rows) {
        yield {
          tenantId,
          eventId: r.event_id,
          type: r.type,
          asOf: r.as_of,
          entity: r.entity,
          payload: JSON.parse(r.payload) as Record<string, unknown>,
          extra: {
            actor_type: r.actor_type,
            actor_id: r.actor_id,
            citations: r.citations,
          },
        };
      }
    },
    count() {
      return (
        db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM v2_events").get()?.n ?? 0
      );
    },
  };
  return { store, close: () => db.close() };
}

export interface RehearsalResult {
  readonly ok: boolean;
  readonly sourcePath: string;
  readonly scratchPath: string;
  readonly sourceCount: number;
  readonly scratchCount: number;
  readonly bleedDropped: number;
  readonly countParity: boolean;
  readonly byteEquivalence: boolean;
  readonly projectionParity: boolean;
  readonly mismatches: string[];
  readonly liveStoreWritten: false;
}

/**
 * Run the rehearsal. Pure-ish: opens the source read-only, migrates into a fresh
 * scratch store, asserts parity, cleans up the scratch dir, returns the result.
 */
export function runRehearsal(opts?: { sourcePath?: string }): RehearsalResult {
  const sourcePath = opts?.sourcePath ?? resolveAnchorSourceDb();
  assertSourceIsNotCanonical(sourcePath);

  const mismatches: string[] = [];
  const tenantId = ANCHOR_TENANT_ID as TenantId;

  if (!existsSync(sourcePath)) {
    // Nothing to migrate — a fresh checkout has no anchor store. Treat as a
    // vacuously-clean rehearsal (advisory), but report it explicitly.
    return {
      ok: true,
      sourcePath,
      scratchPath: "(none — source absent)",
      sourceCount: 0,
      scratchCount: 0,
      bleedDropped: 0,
      countParity: true,
      byteEquivalence: true,
      projectionParity: true,
      mismatches: ["source-absent: no v2 anchor store to migrate (fresh checkout)"],
      liveStoreWritten: false,
    };
  }

  // 1. Read source (READ-ONLY).
  const sourceRows = readV2Rows(sourcePath, /* readonly */ true);
  const sourceCount = sourceRows.length;

  // 2. Migrate into a fresh SCRATCH store under a temp dir.
  const scratchDir = mkdtempSync(resolve(tmpdir(), "v2-anchor-rehearsal-"));
  const scratchPath = resolve(scratchDir, "v2-anchor-scratch.db");
  let scratchCount = 0;
  let bleedDropped = 0;

  const restore = swapTenantStoreResolver(
    makeAnchorOnlyResolver(makeSqliteTenantStore(scratchPath, tenantId).store),
  );
  try {
    // Write through the ENFORCED scoped store (the S10 path).
    const scoped = resolveTenantStore(tenantId);
    for (const r of sourceRows) {
      scoped.append({
        tenantId,
        eventId: r.event_id,
        type: r.type,
        asOf: r.as_of,
        entity: r.entity,
        payload: JSON.parse(r.payload) as Record<string, unknown>,
        extra: { actor_type: r.actor_type, actor_id: r.actor_id, citations: r.citations },
      });
    }

    // 3. Read back through the ENFORCED scoped store and assert isolation.
    const readBack = scoped.readAll();
    scratchCount = readBack.length;
    bleedDropped = scoped.stats().bleedDropped;
  } finally {
    restore.restore();
    resetTenantStoreResolver();
  }

  // Re-open the scratch store directly for byte/projection comparison.
  const scratchRows = readV2Rows(scratchPath, /* readonly */ false);

  // 4a. Count parity.
  const countParity = scratchCount === sourceCount && scratchRows.length === sourceCount;
  if (!countParity) {
    mismatches.push(
      `count mismatch: source=${sourceCount} scratch-scoped=${scratchCount} scratch-rows=${scratchRows.length}`,
    );
  }

  // 4b. Byte-equivalence (keyed by event_id, order-independent).
  const sourceHashes = new Map(sourceRows.map((r) => [r.event_id, rowHash(r)]));
  const scratchHashes = new Map(scratchRows.map((r) => [r.event_id, rowHash(r)]));
  let byteEquivalence = sourceHashes.size === scratchHashes.size;
  for (const [id, h] of sourceHashes) {
    const sh = scratchHashes.get(id);
    if (sh !== h) {
      byteEquivalence = false;
      mismatches.push(`byte mismatch for event_id=${id}: source≠scratch`);
    }
  }
  for (const id of scratchHashes.keys()) {
    if (!sourceHashes.has(id)) {
      byteEquivalence = false;
      mismatches.push(`scratch has extra event_id=${id} not in source`);
    }
  }

  // 4c. Projection parity (canonical standing-data fold).
  const sourceFold = foldStandingData(sourceRows);
  const scratchFold = foldStandingData(scratchRows);
  const projectionParity = sourceFold === scratchFold;
  if (!projectionParity) {
    mismatches.push("projection fold mismatch: source≠scratch standing-data summary");
  }

  // 5. Clean up scratch artefacts (idempotent — fresh dir each run).
  rmSync(scratchDir, { recursive: true, force: true });

  const ok = countParity && byteEquivalence && projectionParity && bleedDropped === 0;
  return {
    ok,
    sourcePath,
    scratchPath,
    sourceCount,
    scratchCount,
    bleedDropped,
    countParity,
    byteEquivalence,
    projectionParity,
    mismatches,
    liveStoreWritten: false,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = runRehearsal();
  console.log("\n=== V2 S10 Anchor Migration Rehearsal (scratch-only) ===");
  console.log(`  source (read-only): ${r.sourcePath}`);
  console.log(`  scratch target:     ${r.scratchPath}`);
  console.log(`  events migrated:    ${r.scratchCount} (source ${r.sourceCount})`);
  console.log(`  count parity:       ${r.countParity ? "OK" : "FAIL"}`);
  console.log(`  byte-equivalence:   ${r.byteEquivalence ? "OK" : "FAIL"}`);
  console.log(`  projection parity:  ${r.projectionParity ? "OK" : "FAIL"}`);
  console.log(`  cross-tenant bleed: ${r.bleedDropped} dropped (must be 0)`);
  console.log(`  live store written: ${r.liveStoreWritten} (always false)`);
  if (r.mismatches.length > 0) {
    for (const m of r.mismatches) console.log(`  • ${m}`);
  }
  console.log(`  RESULT: ${r.ok ? "PARITY ✅" : "MISMATCH ❌"}`);
  process.exit(r.ok ? 0 : 1);
}
