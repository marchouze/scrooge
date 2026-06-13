// platform/recon/v2-anchor-migration-rehearsal.ts
//
// recon:v2-anchor-migration-rehearsal — ADVISORY gate for V2 S10.
//
// Runs the anchor migration rehearsal (scripts/v2-anchor-migration-rehearsal.ts)
// against a SCRATCH per-tenant store and asserts the parity result holds:
//   - count parity (scratch == source),
//   - byte-equivalence (every event hashes identically),
//   - projection parity (canonical standing-data fold is byte-identical),
//   - zero cross-tenant bleed,
//   - the live canonical store was never written (`liveStoreWritten === false`).
//
// SEVERITY: ADVISORY. The rehearsal proves the migration WORKS; the actual
// cutover is a separate gated decision. On a fresh checkout the v2 anchor store
// may be absent — the rehearsal reports source-absent and the gate stays green
// (advisory). Any genuine parity failure surfaces as a `warn` so Vera + the
// dashboard track it without blocking merges (the live cutover gate, not this
// rehearsal, will be enforcing).
//
// SCRATCH-ONLY: the underlying rehearsal opens the source READ-ONLY, writes to a
// temp dir it deletes, and refuses to read the v1 canonical store. This gate
// adds no store access of its own.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s10-tenant-axis-enforcement-anchor-migration-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

import { runRehearsal } from "../../scripts/v2-anchor-migration-rehearsal";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-anchor-migration-rehearsal";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  let r: ReturnType<typeof runRehearsal>;
  try {
    r = runRehearsal();
  } catch (e) {
    // The canonical-store guard or an unexpected error: surface, stay advisory.
    violations.push({
      subject: "rehearsal",
      severity: "warn",
      message: `rehearsal could not run: ${(e as Error).message}`,
    });
    result.asserted += 1;
    result.violations = violations;
    result.ok = true; // advisory
    result.asOf = "rehearsal-errored";
    return result;
  }

  result.asserted += 5;

  if (!r.countParity) {
    violations.push({
      subject: "count-parity",
      severity: "warn",
      message: `event count parity failed: source=${r.sourceCount} scratch=${r.scratchCount}.`,
    });
  }
  if (!r.byteEquivalence) {
    violations.push({
      subject: "byte-equivalence",
      severity: "warn",
      message: `byte-equivalence failed: ${r.mismatches.filter((m) => m.includes("byte") || m.includes("extra")).join("; ")}`,
    });
  }
  if (!r.projectionParity) {
    violations.push({
      subject: "projection-parity",
      severity: "warn",
      message: "projection fold parity failed: migrated standing-data summary ≠ source.",
    });
  }
  if (r.bleedDropped !== 0) {
    violations.push({
      subject: "cross-tenant-bleed",
      severity: "warn",
      message: `${r.bleedDropped} cross-tenant row(s) dropped during the scoped migration read — the anchor store is not single-tenant.`,
    });
  }
  // Hard safety invariant — the rehearsal must never report a live write.
  if (r.liveStoreWritten !== false) {
    violations.push({
      subject: "live-store-safety",
      severity: "fail",
      message: "REHEARSAL WROTE THE LIVE STORE — this must never happen (scratch-only constraint violated).",
    });
  }

  result.violations = violations;
  // Advisory: warn-severity never blocks; only the live-store-safety `fail`
  // (which the design makes impossible) would block.
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `migrated ${r.scratchCount}/${r.sourceCount} events; count=${r.countParity} bytes=${r.byteEquivalence} projection=${r.projectionParity} bleed=${r.bleedDropped} liveWritten=${r.liveStoreWritten}`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok && r.violations.length === 0 ? "OK" : r.ok ? "OK (advisory)" : "FAIL";
  console.log(`recon:${PIPELINE} ${label} — ${r.asOf}; ${r.violations.length} note(s)`);
  process.exit(r.ok ? 0 : 1);
}
