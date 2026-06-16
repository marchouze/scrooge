// platform/recon/v2-type-registry-coverage.ts
//
// recon:v2-type-registry-coverage — Wave 0 (D-BANK-WIDE-V2-MIGRATION).
//
// Asserts that every event type APPENDED to the v2 control-plane store is
// REGISTERED in the v2 type registry (`v2-core/registry`). An appended-but-
// unregistered type is a coverage gap: the store accepts it (build-phase
// forward compat) but `validateV2Payload` is a no-op for it, so its payload
// is unvalidated. The registry must catch up.
//
// Severity: ADVISORY in W0 — all violations are `warn`-severity, never block
// CI. This is the v2 analogue of the v1 `recon:event-type-registry-coverage`
// gate; it flips ENFORCING in a later wave once every v2-hosted type is
// guaranteed to have a registry row at emit time.
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra checks v2
// behaviour; the reverse direction is forbidden by `recon:v2-no-v1-import`).
// It imports the v2 registry + store via the permitted v1→v2 direction.
//
// CLEAN-STORE BEHAVIOUR: on a fresh CI store the control-plane DB is empty (or
// absent), so the gate asserts zero types → ok:true (vacuously). It becomes
// load-bearing on a populated store. The store-absent case is a warn, not a
// fail (advisory).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16).
// Brief: brief:atlas:wave-0-v2-general-host-foundation-schemaversion-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import { defaultControlPlanePath, openControlPlaneStore } from "../../v2-core/control-plane/store";
import { isV2EventTypeRegistered } from "../../v2-core/registry";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/**
 * Open the control-plane store, enumerate the DISTINCT appended types, and
 * assert each one is registered in the v2 type registry.
 */
export function run(overridePath?: string): ReconResult {
  const result = emptyResult("v2-type-registry-coverage");
  const violations: ReconViolation[] = [];

  const dbPath = overridePath ?? defaultControlPlanePath();

  let store: ReturnType<typeof openControlPlaneStore> | undefined;
  try {
    store = openControlPlaneStore(dbPath);
  } catch (err) {
    violations.push({
      subject: dbPath,
      severity: "warn",
      message: `Could not open control-plane store at "${dbPath}": ${String(err)}`,
    });
    result.asserted += 1;
    result.violations = violations;
    return { ...result, ok: true }; // advisory
  }

  try {
    // Distinct appended types — replay once and collect the type set.
    const appendedTypes = new Set<string>();
    for (const event of store.replay()) {
      appendedTypes.add(event.type);
    }

    for (const type of [...appendedTypes].sort()) {
      result.asserted += 1;
      if (!isV2EventTypeRegistered(type)) {
        violations.push({
          subject: type,
          severity: "warn",
          message: `Event type "${type}" is appended to the v2 control-plane store but is NOT registered in v2-core/registry. Add a V2_EVENT_TYPE_REGISTRY row (with a Zod payloadSchema) so its payload is validated fail-closed.`,
        });
      }
    }
  } finally {
    store.close();
  }

  result.violations = violations;
  // Advisory: warn-severity violations are surfaced but non-blocking.
  return { ...result, ok: true };
}

// ---------------------------------------------------------------------------
// CLI entry point — invoked by `bun run recon:v2-type-registry-coverage`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const overridePath = process.env.BANK_V2_CONTROL_PLANE_DB;
  const result = run(overridePath);
  const label = result.violations.length === 0 ? "OK" : "ADVISORY";
  console.log(`recon:v2-type-registry-coverage [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
