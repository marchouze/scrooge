// platform/recon/v2-no-untagged-tenant-append.ts
//
// ENFORCING GATE (HARDEN-ONLY) — no untagged-tenant append to a V2 store
// (D-EVENT-ENVELOPE-TENANT-COLUMN).
//
// WHAT IT ASSERTS
// ---------------
// Every SQL `INSERT … INTO v2_events (…)` in the (non-test) source tree MUST
// list the `tenant_id` column. The tenant axis is now a first-class indexed
// column; an INSERT that omits it would write a row that relies on the DDL
// default silently — fine for the anchor today, but it bypasses the explicit
// tenant-tagging the column exists to guarantee, and re-opens the "tenantId is
// buried / implicit" failure mode this slice closes.
//
// The single sanctioned write path is the shared helper
// `appendAnchorEvent` (`v2-core/control-plane/anchor-store.ts`), whose INSERT
// lists `tenant_id` (and `schema_version`). Any raw INSERT that names the
// columns must include `tenant_id`. The control-plane store's append
// (`v2-core/control-plane/store.ts`) likewise lists it.
//
// SCOPE: non-test `.ts` files. Test files (`*.test.ts`) are EXEMPT — they
// legitimately construct LEGACY pre-migration store shapes as fixtures (e.g. the
// migration-rehearsal test seeds an un-tagged source store on purpose to prove
// the migration reads it). The companion regression test
// (`v2-no-untagged-tenant-append.test.ts`) feeds the classifier a violating
// INSERT string and asserts it is flagged — so the gate is load-bearing.
//
// HARDEN-ONLY CONTRACT: this ratchet only ever requires MORE tenant-tagging,
// never less. There is no allowlist to grow: the correct count of violations is
// permanently zero. Do not weaken it without a CEO-approved Decision. Authority:
// D-EVENT-ENVELOPE-TENANT-COLUMN; D-ENGINEERING-INTEGRITY-CHARTER (#2 fail-closed;
// #3 no green by concealment).
//
// WHY THIS GATE IS V1 INFRA: recon infrastructure (`./types`, `node:fs`) is v1
// code; v2-core must not import it, so a gate that scans v2-core (and scripts)
// lives on the v1 side. The v1→v2 dependency direction is the permitted one.
//
// Author: Atlas (Substrate Architect, engineering).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { V2_ANCHOR_INSERT_COLUMNS } from "../../v2-core/control-plane/anchor-store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/** Prototype root (parent of platform/). */
const PROTOTYPE_DIR = resolve(import.meta.dir, "..", "..");

/** Directories scanned for V2-store INSERTs. */
const SCAN_DIRS = ["v2-core", "scripts", "platform", "runtime", "dashboard"] as const;

/**
 * Match a REAL SQL `INSERT … INTO v2_events …` statement and capture the column
 * list when present. Tolerant of `OR IGNORE` / `OR REPLACE`, whitespace, and
 * newlines inside the column list. The trailing `(?=\(|values)` lookahead
 * anchors the match to an actual statement — either an explicit `(columns…)`
 * list or the `VALUES`/`SELECT` keyword — so prose mentioning "INSERT INTO
 * v2_events" in a comment never matches. A column-less
 * `INSERT INTO v2_events VALUES (…)` is flagged (the `noColumns` branch).
 */
const INSERT_RE =
  /insert\s+(?:or\s+\w+\s+)?into\s+v2_events\s*(?:(\(([^)]*)\))|(?=values\b|select\b))/gi;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (full.endsWith(".ts") && !full.endsWith(".d.ts") && !full.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Classify a single file's content. Returns a violation message per offending
 * INSERT, else an empty array. Exported for the regression test.
 */
export function classifyContent(content: string): string[] {
  const problems: string[] = [];
  INSERT_RE.lastIndex = 0;
  let m: RegExpExecArray | null = INSERT_RE.exec(content);
  while (m !== null) {
    const columnList = m[2];
    if (columnList === undefined) {
      problems.push(
        "INSERT INTO v2_events without an explicit column list — list columns and include tenant_id (D-EVENT-ENVELOPE-TENANT-COLUMN).",
      );
    } else {
      const cols = columnList.split(",").map((c) => c.trim().toLowerCase());
      if (!cols.includes("tenant_id")) {
        problems.push(
          "INSERT INTO v2_events omits the tenant_id column — route through appendAnchorEvent or include tenant_id (D-EVENT-ENVELOPE-TENANT-COLUMN).",
        );
      }
    }
    m = INSERT_RE.exec(content);
  }
  return problems;
}

export function run(): ReconResult {
  const result = emptyResult("v2-no-untagged-tenant-append");
  const violations: ReconViolation[] = [];

  // The sanctioned canonical write path. Its INSERT builds the column list from
  // `V2_ANCHOR_INSERT_COLUMNS` (a dynamic `.join(", ")`), so the literal SQL
  // carries no inline `tenant_id` token to match — instead we assert HERE that
  // the exported column constant DOES include tenant_id. This keeps the helper
  // exempt without weakening the invariant (a regression that dropped the column
  // from the constant fails this assertion).
  const HELPER = resolve(PROTOTYPE_DIR, "v2-core", "control-plane", "anchor-store.ts");
  result.asserted += 1;
  if (!(V2_ANCHOR_INSERT_COLUMNS as readonly string[]).includes("tenant_id")) {
    violations.push({
      subject: "v2-core/control-plane/anchor-store.ts",
      message:
        "V2_ANCHOR_INSERT_COLUMNS (the canonical anchor-store INSERT column list) no longer includes tenant_id — the first-class tenant column would be dropped (D-EVENT-ENVELOPE-TENANT-COLUMN).",
      severity: "fail",
    });
  }

  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    files.push(...listTsFiles(resolve(PROTOTYPE_DIR, dir)));
  }
  const self = resolve(import.meta.dir, "v2-no-untagged-tenant-append.ts");

  for (const file of files) {
    // Exempt self (prose mentions the column) and the sanctioned helper
    // (asserted above via its exported column constant).
    if (file === self || file === HELPER) continue;
    const content = readFileSync(file, "utf8");
    const problems = classifyContent(content);
    result.asserted += 1;
    for (const message of problems) {
      violations.push({
        subject: file.slice(PROTOTYPE_DIR.length + 1),
        message,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  return { ...result, ok: violations.length === 0 };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(
    `recon:v2-no-untagged-tenant-append — scanned ${r.asserted} file(s); ${r.violations.length} violation(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
