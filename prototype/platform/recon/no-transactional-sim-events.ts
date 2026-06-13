// platform/recon/no-transactional-sim-events.ts
//
// gate: recon:no-transactional-sim-events
//
// Asserts zero events with provenance.kind = "simulated" for transactional
// event types (trading, accounting, settlement, market-data categories per
// provenance-category.ts).
//
// On a fresh config-only store: trivially green (no transactional events exist).
// After the decimal-money re-seed: remains green until the first simulated
// trade or posting is emitted via the new decimal-encoded producers.
//
// This is NOT a blocking gate — a build-phase store legitimately contains
// simulated transactional events (the FX simulator, bond revaluation etc.
// all emit simulated provenance). The gate's value is on a freshly-purged
// store: it confirms the config-only re-seed produced zero transactional
// events (which would indicate a seed script accidentally emitting trades).
//
// Mode: on a fresh store this gate is trivially green and non-blocking.
// On a populated build-phase store it becomes an audit lens (advisory)
// rather than a blocker.
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED; D-MONEY-DECIMAL-REDENOMINATION
// Brief: brief:atlas:money-slices-3-5-backup-config-only-purge-re-see:2026-06-13
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";

import { Database } from "bun:sqlite";

import { categoryForEventType } from "../event-store/provenance-category";
import { resolveEventDbPath } from "../event-store/resolve-event-db";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "no-transactional-sim-events";

// Transactional provenance categories (default-simulated in build phase).
const TRANSACTIONAL_CATEGORIES = new Set<string>([
  "trading",
  "accounting",
  "settlement",
  "market-data",
]);

export interface RunOpts {
  /** Path to event-store DB. Defaults to the resolved ambient path. */
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const dbPath = opts.dbPath ?? resolveEventDbPath().path;
  const base = emptyResult(PIPELINE);

  if (!existsSync(dbPath)) {
    // DB not present — fresh CI runner, trivially green.
    return base;
  }

  const db = new Database(dbPath, { readonly: true });
  const violations: ReconViolation[] = [];
  let asserted = 0;

  try {
    // Check whether events table exists
    const tableRow = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
      .get();
    if (!tableRow) {
      db.close();
      return base;
    }

    // Get all distinct transactional event types present in the store
    const types = (
      db.prepare("SELECT DISTINCT type FROM events ORDER BY type ASC").all() as Array<{
        type: string;
      }>
    ).map((r) => r.type);

    const transactionalTypes = types.filter((t) => {
      const cat = categoryForEventType(t);
      return cat !== undefined && TRANSACTIONAL_CATEGORIES.has(cat);
    });

    if (transactionalTypes.length === 0) {
      db.close();
      return { ...base, asserted: 1, ok: true };
    }

    // Count simulated events per transactional type
    for (const t of transactionalTypes) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS n FROM events
           WHERE type = ?
             AND json_extract(provenance, '$.kind') = 'simulated'`,
        )
        .get(t) as { n: number };
      asserted++;
      const n = Number(row.n);
      if (n > 0) {
        violations.push({
          subject: `events:type:${t}`,
          severity: "info",
          message: `Transactional event type "${t}" has ${n} simulated events in the store. On a fresh config-only store this indicates a seed script emitting transactional events — investigate. On a populated build-phase store this is expected (the FX simulator and accounting engines run simulated). Authority: D-MONEY-DECIMAL-REDENOMINATION.`,
        });
      }
    }
  } finally {
    try {
      db.close();
    } catch {
      // best-effort
    }
  }

  return {
    ...base,
    asserted: asserted || 1,
    violations,
    ok: violations.every((v) => v.severity !== "fail"),
  };
}

export default run;

// CLI entrypoint
if (import.meta.main) {
  const r = run();
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  console.log(
    JSON.stringify({
      level: failCount === 0 ? "info" : "error",
      pipeline: r.pipeline,
      ok: r.ok,
      asserted: r.asserted,
      violations: r.violations.length,
      msg:
        failCount === 0
          ? "no-transactional-sim-events: ok"
          : "no-transactional-sim-events: violations found",
      details: r.violations.map((v) => `[${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`),
    }),
  );
  if (!r.ok) process.exit(1);
}
