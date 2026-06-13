// platform/recon/no-legacy-le-identity.ts
//
// gate: recon:no-legacy-le-identity
//
// Asserts zero events carrying legacy entity-ids:
//   - LE-BANK-SA  (deprecated; backfilled to LE-ZA-HOZ-BANK in PR #1205)
//   - BANK-ZA-001 (deprecated alias; maps to HOZ_BANK_ENTITY in core/types.ts)
//
// SQL:
//   SELECT count(*) FROM events
//   WHERE payload LIKE '%LE-BANK-SA%' OR payload LIKE '%BANK-ZA-001%'
//
// On a fresh config-only store post-purge/re-seed: trivially green.
// On the pre-purge store: may find references in old event payloads.
//
// Severity: FAIL — any occurrence means the fresh store has not been cleanly
// re-seeded under the canonical identity "LE-ZA-HOZ-BANK" / "Hoz Bank Limited"
// (D-LEGAL-ENTITY-NAME-HOZ-BANK).
//
// Note on scope: this gate checks the payload text for legacy strings. The
// entity ENVELOPE column is checked separately by the existing
// recon:entity-identity-coherence gate. Both are needed: this gate catches
// legacy strings embedded in JSON payload bodies that are not the primary
// entity field.
//
// Authority: D-MONEY-DECIMAL-REDENOMINATION; D-LEGAL-ENTITY-NAME-HOZ-BANK;
//            D-MONEY-DECIMAL-BUILD-PROCEED
// Brief: brief:atlas:money-slices-3-5-backup-config-only-purge-re-see:2026-06-13
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";

import { Database } from "bun:sqlite";

import { resolveEventDbPath } from "../event-store/resolve-event-db";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "no-legacy-le-identity";

const LEGACY_PATTERNS = ["LE-BANK-SA", "BANK-ZA-001"] as const;

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

    const totalEvents = (db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
    asserted = totalEvents;

    for (const pattern of LEGACY_PATTERNS) {
      const row = db
        .prepare(
          `SELECT count(*) AS n FROM events WHERE payload LIKE ?`,
        )
        .get(`%${pattern}%`) as { n: number };
      const n = Number(row.n);
      if (n > 0) {
        violations.push({
          subject: `events:legacy-le-identity:${pattern}`,
          severity: "fail",
          message: `${n} event(s) in the store have payload text containing the legacy entity identifier "${pattern}". On a fresh config-only store this means the re-seed produced events with legacy identity references — violates D-LEGAL-ENTITY-NAME-HOZ-BANK. Canonical identity is "LE-ZA-HOZ-BANK" / "Hoz Bank Limited". Authority: D-MONEY-DECIMAL-REDENOMINATION; D-LEGAL-ENTITY-NAME-HOZ-BANK.`,
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
    asserted,
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
          ? "no-legacy-le-identity: ok — zero legacy entity-id references"
          : "no-legacy-le-identity: FAILED — legacy entity-id references found in event payloads",
      details: r.violations.map((v) => `[${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`),
    }),
  );
  if (!r.ok) process.exit(1);
}
