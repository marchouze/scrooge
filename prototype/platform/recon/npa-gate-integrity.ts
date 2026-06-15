// platform/recon/npa-gate-integrity.ts
//
// Vera recon: npa-gate — NPA dimension attestation integrity gate.
//
// Asserts:
//   1. Every product at `controlled-launch` or `live` lifecycle stage has
//      all 14 NPA dimensions attested (gate: fail per missing dimension).
//   2. Products at earlier stages carry info-level findings showing
//      attestation coverage.
//
// Mode: blocking (non-zero exit on any failure). Wired into
//       `bun run ci:recon:domain` via `bun run recon:npa-gate`.
//
// Authority:
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10) §5
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Author: Atlas (substrate authority)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { PRODUCT_TYPED_EVENT_TYPES } from "../event-store/event-types/product";
import { validateNpaGate } from "../markets/products/npa-gate";
import { buildProductRegisterView } from "../projections/products/product-register";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "npa-gate-integrity";

/** Lifecycle stages where full attestation is mandatory before advance. */
const ENFORCED_STAGES = new Set(["controlled-launch", "live"]);

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

  const store = new EventStore(dbPath);

  // Query all product-lifecycle events.
  const productEventTypeSet = new Set<string>(PRODUCT_TYPED_EVENT_TYPES);
  const productEvents = Array.from(store.replay()).filter((ev) => productEventTypeSet.has(ev.type));

  const register = buildProductRegisterView(productEvents);

  const violations: ReconViolation[] = [];

  for (const row of register.values()) {
    const { lifecycleStage, productId, attestedDimensions, pendingDimensions } = row;

    if (ENFORCED_STAGES.has(lifecycleStage)) {
      result.asserted++;
      const gateResult = validateNpaGate(row);
      if (!gateResult.ready) {
        const missingList = gateResult.missing.map((d) => `\`${d}\``).join(", ");
        violations.push({
          subject: productId,
          message: `product \`${productId}\` is at stage \`${lifecycleStage}\` but has ${gateResult.missing.length} un-attested NPA dimensions: ${missingList}. All 14 dimensions must be attested before controlled-launch (authority: D-NEW-PRODUCT-APPROVAL-POLICY §5).`,
          severity: "fail",
        });
      }
    } else if (lifecycleStage !== "retired") {
      // Info-level: show coverage for pre-launch products.
      result.asserted++;
      const pendingNote =
        pendingDimensions.length > 0
          ? `; pending: ${pendingDimensions.map((d) => `\`${d}\``).join(", ")}`
          : "; all dimensions attested";
      violations.push({
        subject: productId,
        message: `product \`${productId}\` (stage: \`${lifecycleStage}\`) — ${attestedDimensions.size}/14 dimensions attested${pendingNote}`,
        severity: "info",
      });
    }

  }

  // Determine overall ok: fail only if there are blocking failures.
  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;

  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  const warns = result.violations.filter((v) => v.severity === "warn");
  const infos = result.violations.filter((v) => v.severity === "info");

  for (const v of infos) {
    console.log(`  info  [${v.subject}] ${v.message}`);
  }
  for (const v of warns) {
    console.warn(`  warn  [${v.subject}] ${v.message}`);
  }
  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  console.log(
    `\nrecon:npa-gate-integrity — ${result.asserted} asserted, ` +
      `${fails.length} fail, ${warns.length} warn, ${infos.length} info`,
  );

  if (!result.ok) {
    console.error(`recon:npa-gate-integrity FAILED — ${fails.length} failure(s)`);
    process.exit(1);
  } else {
    console.log("recon:npa-gate-integrity OK");
  }
}
