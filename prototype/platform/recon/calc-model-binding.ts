// platform/recon/calc-model-binding.ts
//
// Vera recon: calc-model-binding — asserts that every surfaced regulatory
// figure is bound to a model that is registered AND approved in the model
// registry. Objective 3 of the Trusted-Figures Program: a figure may not be
// derived from an ungoverned model.
//
// For each calcKey in CALC_BINDINGS, checkModelApproved() must return ok against
// the calc models that the bank has seeded into the authoritative event store
// (the `seed:calc-models` step in the `ci:migrate` chain — `run-calc-model-seed.ts`).
// If a binding references a model the migrate seed does not register/approve, the
// approval check fails and the gate fails. That is exactly the drift we want to
// catch — a new binding with no owned, approved model behind it.
//
// READ-ONLY (Principle 1: events are truth — recon observes, it never emits).
// This gate previously called `seedCalcModels(store)` to make itself
// self-sufficient. That made the recon a *writer* of the authoritative V1 store:
// running the gate emitted 20 calc models' `ModelSubmitted → ModelTierClassified
// → ModelValidationApproved` triples via a raw (un-teed) `EventStore`, so those
// events landed in V1 but were never mirrored to the v2 control-plane store. In
// the suite that produced a non-deterministic `recon:money-free-batch-3-v2-parity`
// failure (V1 199 vs v2 142): whenever this gate ran before that parity gate, the
// parity gate observed the 57 un-mirrored model events as a V1↔v2 divergence. A
// gate that seeds the very models it then asserts is also circular ("green by
// concealment", Engineering Charter cmd 3). The seed now lives in `ci:migrate`
// (before the final `backfill:v2-store-tee`, so the calc-model events mirror to
// v2 and parity holds), and this gate reads the resulting store.
//
// Mode: blocking (non-zero exit on any violation). Wired into
//       `bun run ci:recon:domain` via `bun run recon:calc-model-binding`.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29);
//   D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16, parity-gate lineage).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER (root-cause; recon is
//   read-only; no green by concealment).
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import {
  allCalcKeys,
  checkModelApproved,
  getCalcBinding,
} from "../model-registry/calculation-binding";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "calc-model-binding";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");

  const result: ReconResult = emptyResult(PIPELINE);

  if (!existsSync(dbPath)) {
    // No event store — nothing to assert. Return ok.
    return result;
  }

  // READ-ONLY: open the store to assert against the calc models the bank seeded
  // in `ci:migrate` (seed:calc-models). This recon never emits — a missing or
  // un-approved model is a finding to surface, not a state for the gate to fix
  // (Principle 1; Engineering Charter cmd 3, no green by concealment).
  const store = new EventStore(dbPath);

  const violations: ReconViolation[] = [];
  const keys = allCalcKeys();
  result.asserted = keys.length;

  for (const calcKey of keys) {
    const binding = getCalcBinding(calcKey);
    const approval = checkModelApproved(store, calcKey);
    if (!approval.ok) {
      violations.push({
        subject: calcKey,
        message: `figure "${binding.figure}" (calcKey \`${calcKey}\`) is not derivable from an approved model: ${approval.reason}. Every surfaced figure must bind to an owned, registered, approved model (authority: D-TRUSTED-FIGURES-PROGRAM-V1). Remediation: register + approve \`${binding.modelId}\` via scripts/run-calc-model-seed.ts.`,
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
      `recon:${PIPELINE} OK — ${result.asserted} bound figure(s) checked, all trace to approved models`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} bound figure(s) checked, ${fails.length} ungoverned`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
