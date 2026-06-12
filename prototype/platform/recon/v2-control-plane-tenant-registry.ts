// platform/recon/v2-control-plane-tenant-registry.ts
//
// recon:v2-control-plane-tenant-registry — V2 S1.
//
// Reads the control-plane SQLite store and asserts the invariants that must
// hold for the tenant registry to be operational:
//
//   1. At least one K-tier (Kernel / anchor-bank) tenant is registered.
//   2. The canonical anchor tenant `tenant:za-bank` exists.
//   3. Every registered tenant has at least one surface grant (surfaceVersion
//      is not null in the projection).
//
// Severity: ADVISORY in S1 — all violations are `warn`-severity. The
// released-surface enforcement gate lands in S3; the anchor-seed script is
// idempotent but not yet in the CI migrate chain.
// The gate is wired to `ci:recon:infra` so it runs on every CI invocation.
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra must check
// v2 behaviour; the reverse direction is forbidden). The gate imports the v2
// projection via the permitted v1→v2 direction.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s1-control-plane-store-tenant-registry-fleet-:2026-06-12
// Author: Atlas (Substrate Architect, engineering).

import {
  buildControlPlaneProjection,
  defaultControlPlanePath,
  openControlPlaneStore,
} from "../../v2-core/control-plane";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const ANCHOR_TENANT_ID = "tenant:za-bank";

/**
 * Open the control-plane store, fold the projection, and assert the three
 * invariants.
 */
export function run(overridePath?: string): ReconResult {
  const result = emptyResult("v2-control-plane-tenant-registry");
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
    return { ...result, ok: true }; // advisory: warn-only, not blocking
  }

  try {
    const projection = buildControlPlaneProjection(store);
    const tenants = projection.listTenants();

    // Check 1: at least one K-tier tenant.
    result.asserted += 1;
    const kTierTenants = tenants.filter((t) => t.tier === "K");
    if (kTierTenants.length === 0) {
      violations.push({
        subject: "control-plane-store",
        severity: "warn",
        message: `No K-tier (Kernel / anchor-bank) tenant registered. Run \`bun run scripts/seed-v2-anchor-tenant.ts\` against BANK_V2_CONTROL_PLANE_DB="${dbPath}".`,
      });
    }

    // Check 2: anchor tenant `tenant:za-bank` exists.
    result.asserted += 1;
    const anchorTenant = projection.getTenant(ANCHOR_TENANT_ID);
    if (!anchorTenant) {
      violations.push({
        subject: ANCHOR_TENANT_ID,
        severity: "warn",
        message: `Anchor tenant "${ANCHOR_TENANT_ID}" not found in the control-plane store. Run \`bun run scripts/seed-v2-anchor-tenant.ts\`.`,
      });
    }

    // Check 3: every registered tenant has a surface grant.
    for (const t of tenants) {
      result.asserted += 1;
      if (t.surfaceVersion === null) {
        violations.push({
          subject: t.tenantId,
          severity: "warn",
          message: `Tenant "${t.tenantId}" (tier: ${t.tier}) has no surface grant (surfaceVersion is null). Emit a TenantSurfaceGranted event.`,
        });
      }
    }
  } finally {
    store.close();
  }

  result.violations = violations;
  // Advisory: warn-severity violations are surfaced but non-blocking (ok: true).
  return { ...result, ok: true };
}

// ---------------------------------------------------------------------------
// CLI entry point — invoked by `bun run recon:v2-control-plane-tenant-registry`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const overridePath = process.env.BANK_V2_CONTROL_PLANE_DB;
  const result = run(overridePath);
  const label = result.violations.length === 0 ? "OK" : "ADVISORY";
  console.log(`recon:v2-control-plane-tenant-registry [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
