// platform/recon/recon-golden-source-decisions.ts
//
// Golden-source integrity gate for open-decisions derivation.
// D-DATA-QUALITY-GOLDEN-SOURCE-V1 (CEO-approved 2026-05-26).
//
// Asserts that BOTH derivation paths for "open decisions" use the shared
// `buildOpenDecisionsFromEscalations` function from projections/decisions.ts:
//
//   1. dashboard/derive.ts  (cachedState.decisionsOpenAll path)
//   2. dashboard/server.ts  (/api/decisions-register endpoint path)
//
// If either file stops importing `buildOpenDecisionsFromEscalations`, the two
// paths will diverge and produce different open-decision counts — the exact bug
// this slice was built to prevent.
//
// This is a static structural check: it does not require a running server or
// event store. It reads the source files and asserts the import is present.
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "golden-source-decisions";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const IMPORT_TOKEN = "buildOpenDecisionsFromEscalations";

const REQUIRED_FILES: Array<{ rel: string; description: string }> = [
  {
    rel: "prototype/dashboard/derive.ts",
    description: "cachedState derivation path (decisionsOpenAll)",
  },
  {
    rel: "prototype/dashboard/server.ts",
    description: "/api/decisions-register endpoint",
  },
];

function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const root = findRepoRoot(import.meta.dir);

  for (const { rel, description } of REQUIRED_FILES) {
    result.asserted++;
    const filePath = resolve(root, rel);
    if (!existsSync(filePath)) {
      const v: ReconViolation = {
        subject: rel,
        message: `File not found: ${rel}`,
        severity: "fail",
      };
      result.violations.push(v);
      result.ok = false;
      continue;
    }

    const src = readFileSync(filePath, "utf8");
    if (!src.includes(IMPORT_TOKEN)) {
      const v: ReconViolation = {
        subject: rel,
        message: `${rel} does not import '${IMPORT_TOKEN}' — the ${description} will diverge from the canonical open-decisions derivation. Both paths must call the shared function from projections/decisions.ts.`,
        severity: "fail",
      };
      result.violations.push(v);
      result.ok = false;
    }
  }

  return result;
}

const result = run();

const failCount = result.violations.filter((v) => v.severity === "fail").length;
const summary = `${PIPELINE}: ${result.asserted} file(s) checked; ${failCount} violation(s)`;

if (result.violations.length > 0) {
  for (const v of result.violations) {
    console.error(`[${PIPELINE}] ${v.severity.toUpperCase()}: ${v.subject} — ${v.message}`);
  }
}

if (result.ok) {
  console.log(summary);
} else {
  console.error(summary);
  process.exit(1);
}
