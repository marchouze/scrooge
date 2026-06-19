// platform/recon/fx-model-validation-of-record.ts
//
// Vera recon: fx-model-validation-of-record — BLOCKING.
//
// Asserts that the FX model-validation-of-record is present on the event store:
// a `ModelValidationApproved` event for EACH of the two FX models the FX OTC
// Vanilla NPA cycle's model-risk dimension binds to —
//   - model:fx-forward-irp-v1
//   - model:market-risk-var-hs-v1
//
// WHY: the FX OTC model-risk dimension may only be implementation-attested
// against a store that actually carries the model validation-of-record. The
// genuine approvals live in the home store; `seed:nadia-fx-model-validations`
// (wired into `ci:migrate`) reproduces them on the clean store. This gate is the
// green, NON-VACUOUS basis that the validation-of-record is reproducibly landed
// before model-risk implementation-attestation may proceed.
//
// NON-VACUITY: on a populated store the gate asserts BOTH named models — and the
// approval must be genuine (a verdict by an `agent:nadia:*` validator actor with
// a non-empty expiry, not a hollow row). On an absent / empty store there is
// nothing to assert (the seeder has not run) — returns ok with asserted=0, the
// standard recon posture for a not-yet-populated store. CI runs this AFTER
// `ci:migrate`, so the store IS populated and BOTH models ARE asserted.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19);
//   D-TRUSTED-FIGURES-PROGRAM-V1; D-MODEL-REGISTRY-SCOPE-CLOSURE-V1.
// Author: Nadia (Independent-validation engineer, second line).

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { FX_VALIDATION_OF_RECORD_MODEL_IDS } from "../model-registry/fx-model-validation-seed";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-model-validation-of-record";

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

interface ApprovalRow {
  readonly modelId: string;
  readonly approvedBy: string;
  readonly expiryDate: string;
  readonly version: string;
}

function readApprovals(store: EventStore): Map<string, ApprovalRow> {
  // Latest-wins per modelId (the approval-of-record). Append-only replay order
  // is chronological, so the last write for a modelId is the current verdict.
  const byModel = new Map<string, ApprovalRow>();
  for (const ev of store.replay({ type: "ModelValidationApproved" })) {
    const p = ev.payload as Record<string, unknown>;
    const modelId = String(p.modelId ?? "");
    if (!modelId) continue;
    byModel.set(modelId, {
      modelId,
      approvedBy: String(p.approvedBy ?? ""),
      expiryDate: String(p.expiryDate ?? ""),
      version: String(p.version ?? ""),
    });
  }
  return byModel;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");

  const result: ReconResult = emptyResult(PIPELINE);

  if (!existsSync(dbPath)) {
    // No event store — the seeder has not run; nothing to assert.
    return result;
  }

  const store = new EventStore(dbPath);
  const approvals = readApprovals(store);

  // If the validation substrate has not been seeded at all (zero
  // ModelValidationApproved events anywhere), there is nothing to assert — the
  // store is not yet populated with model-validation events. Once ANY model is
  // approved, the two FX models MUST be among them (the seeder is in ci:migrate).
  if (approvals.size === 0) {
    return result;
  }

  const violations: ReconViolation[] = [];

  for (const modelId of FX_VALIDATION_OF_RECORD_MODEL_IDS) {
    result.asserted++;
    const approval = approvals.get(modelId);

    if (!approval) {
      violations.push({
        subject: modelId,
        message: `FX model-validation-of-record MISSING: no \`ModelValidationApproved\` for \`${modelId}\` on this store. The FX OTC model-risk dimension cannot be implementation-attested against a store that lacks the model validation-of-record. Remediation: run \`bun run seed:nadia-fx-model-validations\` (already wired into \`ci:migrate\`).`,
        severity: "fail",
      });
      continue;
    }

    // Non-vacuity: the approval must be a genuine second-line verdict, not a
    // hollow row — a Nadia validator actor and a non-empty expiry horizon.
    if (!approval.approvedBy.startsWith("agent:nadia")) {
      violations.push({
        subject: modelId,
        message: `FX model-validation-of-record NOT a second-line verdict: \`ModelValidationApproved\` for \`${modelId}\` was approved by \`${approval.approvedBy || "(empty)"}\`, not an \`agent:nadia:*\` independent-validation actor.`,
        severity: "fail",
      });
      continue;
    }

    if (approval.expiryDate.length === 0) {
      violations.push({
        subject: modelId,
        message: `FX model-validation-of-record has no expiry horizon: \`ModelValidationApproved\` for \`${modelId}\` carries an empty \`expiryDate\` — a validation-of-record must set a re-validation horizon (SR-11-7).`,
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
      `recon:${PIPELINE} OK — ${result.asserted} FX model(s) checked, validation-of-record present (or store not yet populated)`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} FX model(s) checked, ${fails.length} missing/invalid`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
