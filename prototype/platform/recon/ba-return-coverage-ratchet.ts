// platform/recon/ba-return-coverage-ratchet.ts
//
// recon:ba-return-coverage-ratchet — enforcing, HARDEN-ONLY gate (inverse of
// v1-removal-ratchet: capability INCREASES, never decreases without a CEO
// Decision — the capability-coverage ratchet).
//
// Counts `status:"sourced"` cells per form in the RETURN_CONTRACT_REGISTRY and
// compares against the committed baseline in ba-return-coverage-ratchet.json.
// FAILS if the current sourced count for any form is BELOW the baseline — that
// would mean a cell was de-sourced without a recorded Decision, regressing the
// bank's return-data capability. Passes if all forms hold or improve.
//
// HARDEN-ONLY CONTRACT: the baseline sourced count per form may only INCREASE
// over time (or stay at zero for forms with no sourced cells yet). Do NOT
// decrease a form's baseline count without a CEO-approved Decision (category
// "engineering") recorded via `recordDecision`. Each PR that sources a new cell
// MUST update ba-return-coverage-ratchet.json upward for that form.
//
// Modelled on v1-removal-ratchet.ts (the inversion is: counts INCREASE, not
// decrease). Authority: D-BA-RETURN-CAPABILITY-FIRST (CEO-approved 2026-06-22);
// D-BA-RETURN-PER-PRODUCT-RICHNESS; D-ENGINEERING-INTEGRITY-CHARTER (cmd 3
// no-green-by-concealment; cmd 5 no-silent-deferral; cmd 7 whole-tree integrity).
//
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ReturnForm } from "../../v2-core/regulatory-returns/cell-contract";
import {
  RETURN_CONTRACT_REGISTRY,
  loadReturnContract,
} from "../../v2-core/regulatory-returns/return-contracts";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba-return-coverage-ratchet";

function findReconDir(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, "platform/recon/ba-return-coverage-ratchet.json");
    if (existsSync(candidate)) return resolve(dir, "platform/recon");
    dir = resolve(dir, "..");
  }
  throw new Error(`Cannot locate platform/recon/ from ${start}`);
}

interface CoverageBaseline {
  readonly asOf: string;
  readonly authority: string;
  readonly perForm: Readonly<Record<string, number>>;
}

export interface FormCoverage {
  readonly form: ReturnForm;
  readonly sourced: number;
  readonly total: number;
  readonly baseline: number;
}

/**
 * Count sourced cells per form across the entire RETURN_CONTRACT_REGISTRY.
 * Pure — reads contracts only, no events, no I/O.
 */
export function coverageByForm(): FormCoverage[] {
  const out: FormCoverage[] = [];
  for (const entry of RETURN_CONTRACT_REGISTRY) {
    try {
      const contract = loadReturnContract(entry.form);
      let sourced = 0;
      for (const cell of contract.cells) {
        if (cell.status === "sourced") sourced++;
      }
      out.push({ form: entry.form, sourced, total: contract.cells.length, baseline: 0 });
    } catch {
      // Contract load failure is surfaced as 0/0 — the cell-contract recon gate
      // catches schema failures; we don't duplicate that here.
      out.push({ form: entry.form, sourced: 0, total: 0, baseline: 0 });
    }
  }
  return out;
}

export interface RunOpts {
  readonly ratchetJsonPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Load baseline.
  let baseline: CoverageBaseline;
  try {
    const jsonPath =
      opts.ratchetJsonPath ??
      resolve(findReconDir(import.meta.dir), "ba-return-coverage-ratchet.json");
    const raw = readFileSync(jsonPath, "utf8");
    baseline = JSON.parse(raw) as CoverageBaseline;
  } catch (e) {
    violations.push({
      subject: "ratchet-baseline-missing",
      message: `Could not load ba-return-coverage-ratchet.json: ${(e as Error).message}. The baseline must be committed alongside the Phase 1 landing. Authority: D-BA-RETURN-CAPABILITY-FIRST.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    result.asserted = 1;
    return result;
  }

  // Get current coverage counts.
  const current = coverageByForm();

  // Check each form: current sourced >= baseline (harden-only, inverse of v1-ratchet).
  result.asserted = current.length + 1; // (1) baseline loads; (n) per-form checks.

  const lines: string[] = [];
  for (const fc of current) {
    const baselineCount = baseline.perForm[fc.form] ?? 0;
    const status =
      fc.sourced < baselineCount ? "REGRESSION" : fc.sourced > baselineCount ? "IMPROVED" : "HELD";
    lines.push(
      `${fc.form}: sourced=${fc.sourced}/${fc.total} | baseline=${baselineCount} | ${status}`,
    );

    if (fc.sourced < baselineCount) {
      violations.push({
        subject: `coverage-regression:${fc.form}`,
        message: `${fc.form} sourced count REGRESSED: current=${fc.sourced} < baseline=${baselineCount} (set ${baseline.asOf}, authority ${baseline.authority}). A cell was de-sourced without a CEO-approved Decision — this narrows the bank's return-data capability. Either restore the sourced status, or record a Decision to authorise the regression. Harden-only: the baseline may only increase.`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `${PIPELINE}: ${lines.join("; ")}. Baseline ${baseline.asOf} (${baseline.authority}).`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      service: "bank-prototype",
      pipeline: PIPELINE,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? `${PIPELINE} OK — all forms at or above baseline`
        : `${PIPELINE} FAILED — sourced-cell count regressed vs baseline (see violations)`,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
