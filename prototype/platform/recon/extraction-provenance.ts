// platform/recon/extraction-provenance.ts
//
// Vera recon: extraction-provenance — Plane-A ingestion-contract gate
// (D-REGULATORY-ARCHITECTURE-TWO-PLANE). Asserts that every committed
// regulatory extraction artefact under Regulations/BCBS/obligation-graphs/
// conforms to the single ingestion contract and declares its provenance, so
// the reference graph only ever ingests attributable, ontology-valid analysis.
//
// Assertions (all blocking):
//   1. Each *-obligation-graph.json parses and is contract-valid
//      (validateExtractionArtefact: instrumentId + extractionMethod + ontology
//      + ontology-conformant nodes/edges).
//   2. extractionMethod is one of the recognised producer classes.
//
// Per-node provenance is propagated at load time by seed-projection's importer
// from the file-level provenance; regenerated artefacts also carry per-node
// provenance (build_obligation_graph.py). This gate is the build-time guard.
//
// Mode: blocking (non-zero exit on any violation). Wired into ci:recon:domain.
//
// Authority: D-REGULATORY-ARCHITECTURE-TWO-PLANE (CEO session-delegation 2026-06-04).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { validateExtractionArtefact } from "../regulatory/extraction-contract";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "extraction-provenance";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  repoRoot?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = opts.repoRoot ?? findRepoRoot(import.meta.dir);
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const dir = resolve(repoRoot, "Regulations/BCBS/obligation-graphs");
  if (!existsSync(dir)) {
    // No artefacts committed — nothing to assert (not a violation).
    result.ok = true;
    return result;
  }

  const files = readdirSync(dir, { encoding: "utf-8" })
    .filter((f) => f.endsWith("-obligation-graph.json"))
    .sort();
  result.asserted = files.length;

  for (const file of files) {
    let artefact: unknown;
    try {
      artefact = JSON.parse(readFileSync(resolve(dir, file), "utf-8"));
    } catch (e) {
      violations.push({
        subject: file,
        message: `not valid JSON: ${(e as Error).message}`,
        severity: "fail",
      });
      continue;
    }
    const check = validateExtractionArtefact(artefact);
    if (!check.valid) {
      for (const err of check.errors.slice(0, 5)) {
        violations.push({
          subject: file,
          message: `contract violation: ${err}`,
          severity: "fail",
        });
      }
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
      `recon:${PIPELINE} OK — ${result.asserted} extraction artefact(s), all contract-valid with declared provenance`,
    );
  } else {
    console.error(`\nrecon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
