// platform/recon/operating-book-selector-coverage.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR5 — regression guard for the
// canonical operating-book inclusion selector.
//
// The root defect this architecture closed was bespoke, divergent provenance
// filtering: inline `provenance?.kind === "build-phase-fixture"` checks and
// per-module `isFixture()` helpers scattered across projections, each with a
// slightly different inclusion rule, so no two engines agreed on "the book"
// (the LCR two-engine split, the RWA blow-up, the fixture-pollution guards).
//
// PR1–PR3 converged every fold onto `eventInOperatingBook` /
// `eventMatchesProvenanceFilter`. This gate keeps it that way: any NEW inline
// `kind === "build-phase-fixture"` check or local `isFixture` helper in
// projection / accounting / dashboard / ALM / liquidity code is a finding —
// the author must route through the canonical selector instead.
//
// Allowlist: the modules that LEGITIMATELY reference the kind directly —
// the selector definitions themselves, the provenance substrate, the FX
// sub-ledger reconciliation (which intentionally PARTITIONS by exact kind to
// defeat cross-provenance tradeId collisions), provenance classifiers/display,
// and the recon pipelines (which assert over provenance, never fold it).
//
// Authority: D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE. Author: Vera (internal
// audit engineer) / Scrooge.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { type ReconResult, emptyResult } from "./types";

const PIPELINE = "recon:operating-book-selector-coverage";

const REPO_ROOT = join(import.meta.dir, "../..");

/** Directories scanned for bespoke provenance-filter regressions. */
const SCAN_DIRS = ["platform/projections", "platform/accounting", "platform/alm", "dashboard"];

/**
 * Files that may reference `build-phase-fixture` / a local fixture predicate
 * directly. Paths are relative to the prototype root.
 */
const ALLOWLIST = new Set<string>([
  // The selector definition + provenance substrate.
  "platform/projections/filter.ts",
  // FX sub-ledger reconciliation intentionally partitions by exact provenance
  // kind to defeat cross-provenance tradeId collisions (a kind-aware design,
  // not an inclusion filter). Authority: feedback_cross_provenance_tradeid_collision.
  "platform/accounting/fx-subledger-trade-reconciliation.ts",
  // Provenance display classifier (maps kind → badge), not a fold.
  "dashboard/risk-register.ts",
]);

/** Forbidden code patterns (inline kind check + local fixture helper). */
const FORBIDDEN: ReadonlyArray<{ re: RegExp; message: string }> = [
  {
    re: /===\s*["']build-phase-fixture["']/,
    message:
      'inline `=== "build-phase-fixture"` check — route inclusion through `eventInOperatingBook` (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE)',
  },
  {
    re: /\bconst\s+isFixture\b|\bisFixture\s*=\s*\(/,
    message:
      "local `isFixture` helper — use the canonical `eventInOperatingBook` selector instead of a bespoke fixture predicate",
  },
];

/** True iff a code line contains a bespoke provenance-filter pattern. */
export function lineHasBespokeFilter(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
  return FORBIDDEN.some(({ re }) => re.test(line));
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(join(REPO_ROOT, d), files);

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    if (ALLOWLIST.has(rel)) continue;
    result.asserted += 1;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // Skip comment lines — only code matters.
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      for (const { re, message } of FORBIDDEN) {
        if (re.test(line)) {
          result.violations.push({
            subject: `${rel}:${i + 1}`,
            message,
            severity: "fail",
          });
        }
      }
    });
  }

  result.ok = result.violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    process.stdout.write(
      `${PIPELINE}: ok — scanned ${r.asserted} file(s); no bespoke provenance-filter regressions\n`,
    );
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL — ${r.violations.length} bespoke provenance filter(s)\n`);
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
