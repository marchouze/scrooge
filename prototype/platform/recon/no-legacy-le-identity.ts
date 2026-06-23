// platform/recon/no-legacy-le-identity.ts
//
// gate: recon:no-legacy-le-identity
//
// Asserts zero legacy entity-ids in TWO places:
//
//   (1) EVENT-STORE payloads — no stored event carries a legacy entity-id:
//         - LE-BANK-SA  (deprecated; backfilled to LE-ZA-HOZ-BANK in PR #1205)
//         - BANK-ZA-001 (deprecated alias; maps to HOZ_BANK_ENTITY)
//       SQL: SELECT count(*) FROM events
//            WHERE payload LIKE '%LE-BANK-SA%' OR payload LIKE '%BANK-ZA-001%'
//       On a fresh config-only store post-purge/re-seed: trivially green.
//
//   (2) SOURCE TREES (added under D-NPA-PAGE-DE-INVENTION, 2026-06-23) — no
//       source file under `platform/markets/products/**` or `dashboard/**`
//       contains a legacy id literal. Product fixtures + the dashboard read the
//       canonical CANONICAL_LEGAL_ENTITY_ID constant
//       (v2-core/reference-data/legal-entity.ts) — a literal that shadows the
//       sourced value is a divergence waiting to happen (Engineering-Charter
//       cmd 4). The store-level backfill can never undo a legacy literal that a
//       fixture re-introduces on every read, so this catches re-invention at
//       the source. A NARROW exception covers this gate's own legacy-pattern
//       constants and the backfill/migration script that must name the legacy
//       ids to retire them.
//
// Severity: FAIL — any occurrence (store OR source) means the canonical
// identity "LE-ZA-HOZ-BANK" / "Hoz Bank Limited" (D-LEGAL-ENTITY-NAME-HOZ-BANK)
// is not the sole entity identity.
//
// Note on scope: the store check inspects the payload text. The entity ENVELOPE
// column is checked separately by recon:entity-identity-coherence. Both are
// needed: this gate catches legacy strings embedded in JSON payload bodies that
// are not the primary entity field, AND legacy literals in source.
//
// Authority: D-MONEY-DECIMAL-REDENOMINATION; D-LEGAL-ENTITY-NAME-HOZ-BANK;
//            D-MONEY-DECIMAL-BUILD-PROCEED; D-NPA-PAGE-DE-INVENTION
// Brief: brief:atlas:money-slices-3-5-backup-config-only-purge-re-see:2026-06-13;
//        brief:atlas:npa-page-remove-invented-static-lists-source-fro:2026-06-23
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { Database } from "bun:sqlite";

import { resolveEventDbPath } from "../event-store/resolve-event-db";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "no-legacy-le-identity";

const LEGACY_PATTERNS = ["LE-BANK-SA", "BANK-ZA-001"] as const;

// ---------------------------------------------------------------------------
// Source-tree scan (D-NPA-PAGE-DE-INVENTION).
// ---------------------------------------------------------------------------

/** `prototype/` root — `platform/recon/` is two levels below it. */
const PROTOTYPE_ROOT = resolve(import.meta.dir, "..", "..");

/** Source trees scanned for legacy entity-id literals (relative to prototype/). */
const SCANNED_SOURCE_TREES = ["platform/markets/products", "dashboard"] as const;

/** File extensions scanned (source code only — not built assets / data). */
const SCANNED_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"] as const;

/**
 * Narrow exception list (relative to prototype/). The only files permitted to
 * name a legacy id are:
 *   - this gate itself (its LEGACY_PATTERNS constants);
 *   - the backfill/migration script that must reference the legacy ids it
 *     retires.
 * Anything else naming a legacy id is a re-invention FAIL.
 */
const SOURCE_EXCEPTIONS = new Set<string>([
  "platform/recon/no-legacy-le-identity.ts",
  "scripts/backfill-entity-id-le-bank-sa.ts",
]);

function collectSourceFiles(dir: string, root: string, acc: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, root, acc);
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      acc.push(full.slice(root.length + 1));
    }
  }
}

/**
 * Scan the configured source trees for legacy entity-id literals. Returns one
 * violation per (file, pattern) hit. Exposed for the gate's own test; the
 * `rootOverride` lets tests point at a fixture tree.
 */
export function scanSourceTrees(rootOverride?: string): ReconViolation[] {
  const root = rootOverride ?? PROTOTYPE_ROOT;
  const files: string[] = [];
  for (const tree of SCANNED_SOURCE_TREES) {
    collectSourceFiles(resolve(root, tree), root, files);
  }
  const violations: ReconViolation[] = [];
  for (const rel of files) {
    if (SOURCE_EXCEPTIONS.has(rel)) continue;
    let content: string;
    try {
      content = readFileSync(resolve(root, rel), "utf8");
    } catch {
      continue;
    }
    for (const pattern of LEGACY_PATTERNS) {
      if (content.includes(pattern)) {
        violations.push({
          subject: `source:legacy-le-identity:${rel}:${pattern}`,
          severity: "fail",
          message: `Source file "${rel}" contains the legacy entity-id literal "${pattern}". Read the canonical CANONICAL_LEGAL_ENTITY_ID constant (v2-core/reference-data/legal-entity.ts) instead — a legacy literal in a fixture or DTO re-introduces the deprecated identity on every read, which the store-level backfill cannot undo. Authority: D-NPA-PAGE-DE-INVENTION; D-LEGAL-ENTITY-NAME-HOZ-BANK; Engineering-Charter cmd 4.`,
        });
      }
    }
  }
  return violations;
}

export interface RunOpts {
  /** Path to event-store DB. Defaults to the resolved ambient path. */
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const dbPath = opts.dbPath ?? resolveEventDbPath().path;
  const base = emptyResult(PIPELINE);

  // (2) Source-tree scan — ALWAYS runs, independent of any event store. A
  // legacy literal in a fixture re-introduces the deprecated identity on every
  // read, which the store-level backfill cannot undo, so this must be load-
  // bearing even on a fresh CI runner with no DB.
  const violations: ReconViolation[] = [...scanSourceTrees()];
  let asserted = 0;

  // (1) Event-store scan — only when the DB is present (fresh CI runner: skip).
  if (existsSync(dbPath)) {
    const db = new Database(dbPath, { readonly: true });
    try {
      const tableRow = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
        .get();
      if (tableRow) {
        const totalEvents = (db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number })
          .n;
        asserted = totalEvents;

        for (const pattern of LEGACY_PATTERNS) {
          const row = db
            .prepare("SELECT count(*) AS n FROM events WHERE payload LIKE ?")
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
      }
    } finally {
      try {
        db.close();
      } catch {
        // best-effort
      }
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
          ? "no-legacy-le-identity: ok — zero legacy entity-id references (store + source)"
          : "no-legacy-le-identity: FAILED — legacy entity-id references found (event payloads and/or source trees)",
      details: r.violations.map((v) => `[${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`),
    }),
  );
  if (!r.ok) process.exit(1);
}
