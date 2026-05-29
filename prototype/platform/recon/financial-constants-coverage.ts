// platform/recon/financial-constants-coverage.ts
//
// Vera recon: financial-constants-coverage — objective 2 of the Trusted-Figures
// Program. Asserts that (a) the owned financial-constants registry is internally
// well-formed and (b) the calc engines that consume calibration numbers read
// them from the registry and hold NO inline rate-table literals.
//
// Assertions (all blocking):
//   1. Constant keys are unique.
//   2. Every constant carries complete metadata (non-empty label / description /
//      owningRole / citation) and a finite value.
//   3. Every unit and category is a recognised enum member.
//   4. Each calc file imports from ../config/financial-constants.
//   5. No calc file declares an inline `Record<string, number> = {` rate-table
//      literal — the constants must come from the registry, not a buried table.
//
// Mode: blocking (non-zero exit on any violation). Wired into
//       `bun run ci:recon:domain` via `bun run recon:financial-constants-coverage`.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  type ConstantCategory,
  type ConstantUnit,
  FINANCIAL_CONSTANTS,
} from "../config/financial-constants";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "financial-constants-coverage";

const VALID_UNITS: ReadonlySet<ConstantUnit> = new Set<ConstantUnit>([
  "ratio",
  "percentage-points",
  "zar-minor",
]);

const VALID_CATEGORIES: ReadonlySet<ConstantCategory> = new Set<ConstantCategory>([
  "lcr-runoff",
  "lcr-inflow",
  "lcr-haircut",
  "lcr-cap",
  "lcr-threshold",
  "nsfr-asf",
  "nsfr-rsf",
  "nsfr-threshold",
  "capital-baseline",
  "capital-threshold",
  "leverage-threshold",
]);

/** Calc files that must read calibration from the registry, not inline it. */
const CALC_FILES = [
  "prototype/platform/liquidity/lcr.ts",
  "prototype/platform/liquidity/nsfr.ts",
  "prototype/platform/projections/capital-metrics.ts",
  "prototype/platform/projections/leverage-ratio-metrics.ts",
];

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  /** Override the repo root (tests). */
  repoRoot?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = opts.repoRoot ?? findRepoRoot(import.meta.dir);
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  result.asserted = FINANCIAL_CONSTANTS.length;

  // 1. Unique keys.
  const seen = new Set<string>();
  for (const c of FINANCIAL_CONSTANTS) {
    if (seen.has(c.key)) {
      violations.push({
        subject: c.key,
        message: `duplicate constant key "${c.key}" in FINANCIAL_CONSTANTS`,
        severity: "fail",
      });
    }
    seen.add(c.key);
  }

  // 2 / 3. Metadata completeness + enum validity.
  for (const c of FINANCIAL_CONSTANTS) {
    if (!Number.isFinite(c.value)) {
      violations.push({
        subject: c.key,
        message: `constant "${c.key}" has a non-finite value`,
        severity: "fail",
      });
    }
    for (const [field, val] of [
      ["label", c.label],
      ["description", c.description],
      ["owningRole", c.owningRole],
      ["citation", c.citation],
    ] as const) {
      if (!val || !val.trim()) {
        violations.push({
          subject: c.key,
          message: `constant "${c.key}" is missing required metadata field "${field}"`,
          severity: "fail",
        });
      }
    }
    if (!VALID_UNITS.has(c.unit)) {
      violations.push({
        subject: c.key,
        message: `constant "${c.key}" has unrecognised unit "${c.unit}"`,
        severity: "fail",
      });
    }
    if (!VALID_CATEGORIES.has(c.category)) {
      violations.push({
        subject: c.key,
        message: `constant "${c.key}" has unrecognised category "${c.category}"`,
        severity: "fail",
      });
    }
  }

  // 4 / 5. Calc files import the registry and hold no inline rate tables.
  const importPattern = /from\s+["'][^"']*config\/financial-constants["']/;
  const inlineTablePattern = /Record<string,\s*number>\s*=\s*\{/;
  for (const rel of CALC_FILES) {
    const path = resolve(repoRoot, rel);
    if (!existsSync(path)) {
      violations.push({
        subject: rel,
        message: `calc file not found at ${path}`,
        severity: "fail",
      });
      continue;
    }
    const src = readFileSync(path, "utf8");
    if (!importPattern.test(src)) {
      violations.push({
        subject: rel,
        message: `calc file "${rel}" does not import from config/financial-constants — calibration must come from the registry`,
        severity: "fail",
      });
    }
    if (inlineTablePattern.test(src)) {
      violations.push({
        subject: rel,
        message: `calc file "${rel}" declares an inline \`Record<string, number> = { ... }\` rate-table literal — move it into FINANCIAL_CONSTANTS`,
        severity: "fail",
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");

  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${result.asserted} owned constant(s), all calc files read from the registry`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} owned constant(s) checked, ${fails.length} violation(s)`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
