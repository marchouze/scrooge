// platform/recon/fx-v2-parity.ts
//
// recon:fx-v2-parity — ADVISORY gate (exits 0 in Phase 1; will become
// enforcing when the FX domain flip is approved in Phase 2).
//
// STATUS: PHASE 1 — ADVISORY (ok: true always).
//
// The FX valuation book is currently `v2-parallel`: the V2 FIL model
// (D-FIL-BOOK-COMPOSITE-VALUATION, A2) produces FxBookValuationSnapshotted
// events that run alongside the V1 book. The V1 path remains authoritative.
// A byte-equivalence proof between the V1 and V2 FX valuation paths is
// required BEFORE the domain flip can be approved (Phase 2).
//
// What this gate does in Phase 1:
//   - Verifies that the generic parity harness (v1-v2-parity-harness.ts)
//     compiles and is importable (structural check).
//   - Notes that no V2 FX authoritative path exists yet (FX is read-only
//     parallel, not yet flipped); the gate passes vacuously.
//   - Prints an advisory note explaining when the gate becomes enforcing.
//
// When Phase 2 lands and the FX domain is flipped:
//   - This gate will be promoted to enforcing by wiring `readV1` and
//     `readV2` to the actual V1/V2 FX valuation outputs and calling
//     `runParityCheck` over the full book.
//   - The gate will fail if any byte-diff is detected between the two paths.
//
// Authority: D-V1-REMOVAL-PHASE-1 (CEO-approved 2026-06-15);
//            D-FIL-BOOK-COMPOSITE-VALUATION (A2 FX Valuable FIL-Model).
// Author: Atlas (Substrate Architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { type ReconResult, emptyResult } from "./types";
// Import the harness to prove it's importable (structural check).
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "fx-v2-parity";

// The FX event types that will be covered once the gate is enforcing.
const FX_V2_PARALLEL_TYPES = ["FxBookValuationSnapshotted"] as const;

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);

  // Verify the harness is importable and structurally sound.
  // Run a trivial vacuous parity check (empty objects match) to exercise
  // the runParityCheck code path without needing real store data.
  const vacuousViolations = runParityCheck({
    label: "fx-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  // The vacuous check must pass (empty == empty).
  if (vacuousViolations.length > 0) {
    result.violations.push({
      subject: "parity-harness-structural-check",
      message:
        "The parity harness structural check failed: the vacuous (empty == empty) " +
        "self-test did not pass. This is a harness bug, not a domain divergence. " +
        "Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // Check that the FX v2-parallel types are correctly tagged in the registry.
  for (const typeName of FX_V2_PARALLEL_TYPES) {
    const entry = EVENT_TYPE_REGISTRY.find((e) => e.type === typeName);
    result.asserted += 1;
    if (!entry) {
      result.violations.push({
        subject: `fx-v2-parity:registry-missing:${typeName}`,
        message: `Event type "${typeName}" is not in the registry — expected a v2-parallel entry. The FX v2-parity gate tracks these types as v2-parallel candidates for Phase 2.`,
        severity: "warn",
      });
    } else if (entry.v2Status !== "v2-parallel") {
      result.violations.push({
        subject: `fx-v2-parity:not-parallel:${typeName}`,
        message: `Event type "${typeName}" is tagged "${entry.v2Status}" but should be "v2-parallel". The FX book valuation runs in parallel on V2 (D-FIL-BOOK-COMPOSITE-VALUATION A2). Update the registry entry to v2Status: "v2-parallel".`,
        severity: "warn",
      });
    }
  }

  // PHASE 1 ADVISORY NOTE: the byte-equivalence proof is deferred to Phase 2.
  // The actual V1 vs V2 comparison will be wired here when the FX domain flip
  // is approved. Until then, the gate is always `ok: true`.
  result.asserted += 1;

  result.ok = result.violations.every((v) => v.severity !== "fail");
  result.asOf = `fx-v2-parity [ADVISORY — Phase 1]: FX domain is v2-parallel (not yet flipped). Byte-equivalence proof deferred to Phase 2 (domain flip requires CEO Decision + enforcing gate promotion). Structural harness check: ${vacuousViolations.length === 0 ? "OK" : "FAILED"}. v2-parallel types tracked: ${FX_V2_PARALLEL_TYPES.join(", ")}.`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK (advisory)" : "FAIL";
  process.stdout.write(`\nrecon:${PIPELINE} ${label} — ${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: "info", // always info in Phase 1 (advisory)
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
