// platform/recon/no-residual-minor-encoding.ts
//
// gate: recon:no-residual-minor-encoding
//
// Asserts zero events whose payload has a key ending in "Minor" with a
// JSON numeric value. Catches any legacy bigint / integer minor-unit
// encoding that survived the purge or re-seed.
//
// The legacy encoding used field names like:
//   amountMinor, valueMinor, notionalMinor, nominalMinor, premiumMinor,
//   marketValueMinor, proceedsMinor, etc. (438 *Minor fields across 33 types)
//
// The new decimal encoding uses MoneyWire: { __money: "v1", amount: "1234.56", currency: "ZAR" }
// No "*Minor" keys should appear in any event payload on a fresh config-only store.
//
// Strategy: walk each event's payload JSON looking for any key that ends
// with "Minor" whose associated value is a number (not a string). A string
// field ending in "Minor" is not a legacy encoding (could be a coincidence
// of naming in non-money fields).
//
// On a fresh config-only store: trivially green (no money-bearing events).
// After config-only re-seed: trivially green (config seeds don't emit money).
// Becomes load-bearing once the decimal-encoded transactional seeds run.
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED; D-MONEY-DECIMAL-REDENOMINATION;
//            Principle 1 (events as truth — immutable once encoded)
// Brief: brief:atlas:money-slices-3-5-backup-config-only-purge-re-see:2026-06-13
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";

import { Database } from "bun:sqlite";

import { resolveEventDbPath } from "../event-store/resolve-event-db";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "no-residual-minor-encoding";

/**
 * Recursively walk an arbitrary payload object and return the dotted paths
 * of any key that ends in "Minor" whose value is a JSON number (not a string).
 */
export function findMinorEncodingViolations(obj: unknown, path = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  if (Array.isArray(obj)) {
    const out: string[] = [];
    for (let i = 0; i < obj.length; i++) {
      out.push(...findMinorEncodingViolations(obj[i], `${path}[${i}]`));
    }
    return out;
  }
  const record = obj as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(record)) {
    const childPath = path ? `${path}.${key}` : key;
    const value = record[key];
    if (key.endsWith("Minor") && typeof value === "number") {
      out.push(childPath);
    } else {
      out.push(...findMinorEncodingViolations(value, childPath));
    }
  }
  return out;
}

export interface RunOpts {
  /** Path to event-store DB. Defaults to the resolved ambient path. */
  dbPath?: string;
  /** Sample: only check first N events per type. Default: all. */
  sample?: boolean;
  sampleSize?: number;
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
    const tableRow = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
      .get();
    if (!tableRow) {
      db.close();
      return base;
    }

    const sample = opts.sample ?? false;
    const sampleSize = opts.sampleSize ?? 100;

    let rows: Array<{ event_id: string; type: string; payload: string }>;

    if (sample) {
      // Sample: first N per type — get distinct types first then limit
      const types = (
        db.prepare("SELECT DISTINCT type FROM events").all() as Array<{ type: string }>
      ).map((r) => r.type);
      rows = [];
      for (const t of types) {
        const batch = db
          .prepare("SELECT event_id, type, payload FROM events WHERE type = ? LIMIT ?")
          .all(t, sampleSize) as Array<{ event_id: string; type: string; payload: string }>;
        rows.push(...batch);
      }
    } else {
      rows = db.prepare("SELECT event_id, type, payload FROM events").all() as Array<{
        event_id: string;
        type: string;
        payload: string;
      }>;
    }

    asserted = rows.length;

    for (const row of rows) {
      let payload: unknown;
      try {
        payload = JSON.parse(row.payload);
      } catch {
        continue; // malformed JSON is a different gate's concern
      }
      const paths = findMinorEncodingViolations(payload);
      for (const p of paths) {
        violations.push({
          subject: row.event_id,
          severity: "fail",
          message: `Event ${row.event_id} (type=${row.type}) has a legacy integer "*Minor" field at payload.${p}. The decimal-money encoding uses MoneyWire { __money, amount, currency } — no "*Minor" numeric fields. This event survived the purge or was re-emitted in legacy encoding. Authority: D-MONEY-DECIMAL-REDENOMINATION; Principle 1.`,
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
          ? "no-residual-minor-encoding: ok — zero legacy *Minor numeric fields"
          : "no-residual-minor-encoding: FAILED — legacy *Minor numeric fields found in event payloads",
      details: r.violations
        .slice(0, 10)
        .map((v) => `[${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`),
    }),
  );
  if (!r.ok) process.exit(1);
}
