// platform/recon/model-risk-gap-inventory.ts
//
// Vera recon: model-risk-gap-inventory — surfaces Slice 7 model-risk substrate
// gaps as info findings. Non-blocking: gaps are expected until Nadia's
// methodology library and the model registry land.
//
// For each product in MODEL_RISK_SUBSTRATE_GAPS:
//   - If no implementation-attested model-risk event exists → info finding
//     listing the blockers and target M-phase.
//   - If implementation-attested event exists → ok, no finding.
//
// Mode: non-blocking (always exits 0). Wired into ci:recon:domain as an
// informational inventory gate.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 7
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { MODEL_RISK_SUBSTRATE_GAPS } from "../markets/products/model-risk-substrate-gaps";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "model-risk-gap-inventory";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found)");
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
    return result;
  }

  const store = new EventStore(dbPath);
  const allEvents = Array.from(store.replay());

  const violations: ReconViolation[] = [];

  for (const gap of MODEL_RISK_SUBSTRATE_GAPS) {
    result.asserted++;

    const upgraded = allEvents.find(
      (ev) =>
        ev.type === "ProductDimensionAttested" &&
        (ev.payload as Record<string, unknown>).productId === gap.productId &&
        (ev.payload as Record<string, unknown>).dimension === "model-risk" &&
        (ev.payload as Record<string, unknown>).result === "implementation-attested",
    );

    if (upgraded) {
      violations.push({
        subject: gap.productId,
        message: `model-risk implementation-attested ✓ (${gap.productId})`,
        severity: "info",
      });
    } else {
      const blockerList = gap.blockers.map((b) => `\n    - ${b}`).join("");
      violations.push({
        subject: gap.productId,
        message:
          `model-risk PENDING for \`${gap.productId}\` ` +
          `(tier: ${gap.modelTier}, target: ${gap.targetMPhase}). ` +
          `Owner: ${gap.engineeringOwner}. ` +
          `Blockers:${blockerList}`,
        severity: "info",
      });
    }
  }

  result.ok = true; // always non-blocking
  result.violations = violations;
  return result;
}

if (import.meta.main) {
  const result = run();
  for (const v of result.violations) {
    const prefix = v.message.includes("PENDING") ? "  gap " : "   ok ";
    console.log(`${prefix} [${v.subject}] ${v.message}`);
  }
  console.log(
    `\nrecon:model-risk-gap-inventory — ${result.asserted} checked, ` +
      `${result.violations.filter((v) => v.message.includes("PENDING")).length} pending`,
  );
}
