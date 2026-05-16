// platform/recon/decisions-baseline.ts
//
// Shared baseline-allowlist loader for the four `D-DECISIONS-FRAMEWORK-
// REDESIGN` recon gates promoted from WARN to ERROR in Slice B.
//
// Subjects listed in `prototype/scripts/recon/baselines/<pipeline>-baseline.txt`
// are grandfathered: their violations stay at `severity: 'warn'` and
// do not flip `ok=false`. Subjects not in the baseline produce a `fail`
// and the recon exits non-zero.
//
// Slice C empties the baselines as it backfills.
//
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ReconResult, ReconViolation } from "./types";

/**
 * Test-fixture decisionIds — events appended by `bun test` to the shared
 * `.local/event.db` should not block the promoted recons. Subjects
 * matching these patterns are filtered out at recon time so test
 * pollution doesn't masquerade as substrate drift. The patterns are
 * deliberately conservative: only the synthetic prefixes our tests use.
 */
export const TEST_FIXTURE_PATTERNS: readonly RegExp[] = [
  /^D-TEST-/,
  /^D-SLICE-B-/,
  /^D-DEBUG-/,
  /^D-RUNTIME-CACHE-TEST-/,
];

export function isTestFixtureId(id: string): boolean {
  return TEST_FIXTURE_PATTERNS.some((re) => re.test(id));
}

export function loadBaseline(repoRoot: string, pipeline: string): Set<string> {
  const path = resolve(
    repoRoot,
    "prototype",
    "scripts",
    "recon",
    "baselines",
    `${pipeline}-baseline.txt`,
  );
  if (!existsSync(path)) return new Set();
  const lines = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));
  return new Set(lines);
}

/**
 * Apply the baseline to a list of raw violations. Subjects in the
 * baseline are stamped `severity: 'warn'`; subjects outside the
 * baseline are stamped `severity: 'fail'`. `result.ok` flips to false
 * iff any fail-severity violation remains.
 */
export function applyBaselineToResult(
  result: ReconResult,
  rawViolations: ReconViolation[],
  baseline: ReadonlySet<string>,
): void {
  // Filter test-fixture pollution before grading. Tests appending to the
  // shared `.local/event.db` would otherwise flip the recon to fail.
  const stamped: ReconViolation[] = rawViolations
    .filter((v) => !isTestFixtureId(v.subject))
    .map((v) => ({
      ...v,
      severity: baseline.has(v.subject) ? "warn" : "fail",
    }));
  result.violations = stamped;
  result.ok = !stamped.some((v) => v.severity === "fail");
}
