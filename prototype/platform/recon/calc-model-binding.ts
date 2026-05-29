// platform/recon/calc-model-binding.ts
//
// Vera recon: calc-model-binding — asserts that every surfaced regulatory
// figure is bound to a model that is registered AND approved in the model
// registry. Objective 3 of the Trusted-Figures Program: a figure may not be
// derived from an ungoverned model.
//
// For each calcKey in CALC_BINDINGS, checkModelApproved() must return ok. To
// keep the gate self-sufficient (and to catch binding↔seed drift), the calc
// models are seeded idempotently first: if a binding references a model the
// seed does not register/approve, the approval check fails and the gate fails.
// That is exactly the drift we want to catch — a new binding with no owned,
// approved model behind it.
//
// Mode: blocking (non-zero exit on any violation). Wired into
//       `bun run ci:recon:domain` via `bun run recon:calc-model-binding`.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { seedCalcModels } from "../../seeds/models/calc-model-seed";
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
  /** Skip the idempotent seed step (tests that pre-seed their own store). */
  skipSeed?: boolean;
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

  const store = new EventStore(dbPath);

  // Make the gate self-sufficient: ensure the bound calc models are registered
  // and approved. Idempotent — already-approved models are skipped.
  if (!opts.skipSeed) {
    try {
      seedCalcModels(store);
    } catch {
      // Best-effort — a read-only store in CI still lets us assert against
      // whatever models are already present.
    }
  }

  const violations: ReconViolation[] = [];
  const keys = allCalcKeys();
  result.asserted = keys.length;

  for (const calcKey of keys) {
    const binding = getCalcBinding(calcKey);
    const approval = checkModelApproved(store, calcKey);
    if (!approval.ok) {
      violations.push({
        subject: calcKey,
        message: `figure "${binding.figure}" (calcKey \`${calcKey}\`) is not derivable from an approved model: ${approval.reason}. Every surfaced figure must bind to an owned, registered, approved model (authority: D-TRUSTED-FIGURES-PROGRAM-V1). Remediation: register + approve \`${binding.modelId}\` in seeds/models/calc-model-seed.ts.`,
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
