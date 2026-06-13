// platform/recon/v2-fleet-integrity.ts
//
// recon:v2-fleet-integrity — V2 S14.
//
// Reads the control-plane SQLite store, folds the S14 FleetProjection, and
// asserts the invariants that must hold for the operational fleet to be sound:
//
//   1. Every registered tenant has a tier (always true by schema) AND a
//      surface grant (surfaceVersion not null). A tenant with no surface grant
//      is operationally dark.
//   2. Metering windows are well-formed: windowStart <= windowEnd, and
//      quantities are non-negative.
//   3. The upgrade ledger is consistent per tenant:
//        (a) no version REGRESSION — each entry's toVersion is >= its
//            fromVersion, and the chain of toVersion across a tenant's history
//            is monotonic non-decreasing;
//        (b) chain continuity — each entry's fromVersion equals the previous
//            entry's toVersion (the ledger is a connected chain, not islands).
//
// Severity: ADVISORY → ENFORCING. The pure assertion logic
// (`assertFleetIntegrity`) is exercised sabotage-proof in the regression test
// (a synthetic version regression / malformed window IS caught). The recon
// `run()` reads the live control-plane store; it returns warn-severity
// violations (advisory) while the fleet is anchor-only and the seed is not yet
// in the CI migrate chain — flip the `ENFORCING` flag once the seed lands in
// `ci:migrate` and the store is reliably populated on clean CI.
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra checks v2
// behaviour; the reverse is forbidden). It imports the v2 fleet projection via
// the permitted v1→v2 direction.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-TIER-STRUCTURE
// (K/R/C tiers); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:sade:v2-s14-fleet-register-metering-upgrade-ledger-op:2026-06-13
// Author: Sade (AgentOps, operations) with Atlas (Substrate Architect, engineering).

import {
  type UpgradeEntry,
  buildFleetProjection,
  comparePlatformVersions,
  defaultControlPlanePath,
  openControlPlaneStore,
} from "../../v2-core/control-plane";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Advisory while the fleet is anchor-only + the seed is not in the CI migrate
// chain. Flip to true to make integrity violations blocking (fail-severity).
const ENFORCING = false;

// ---------------------------------------------------------------------------
// Pure assertion input + logic (exercised sabotage-proof in the test).
// ---------------------------------------------------------------------------

export interface FleetIntegrityInput {
  /** Every registered tenant with its surface grant + tier presence. */
  readonly tenants: ReadonlyArray<{
    readonly tenantId: string;
    readonly tier: string | null | undefined;
    readonly surfaceVersion: string | null;
  }>;
  /** Folded metering rows (one per tenant/metric/window). */
  readonly meterEntries: ReadonlyArray<{
    readonly tenantId: string;
    readonly metricKey: string;
    readonly quantity: number;
    readonly windowStart: string;
    readonly windowEnd: string;
  }>;
  /** Upgrade history per tenant, oldest first. */
  readonly upgradeHistory: ReadonlyMap<string, readonly UpgradeEntry[]>;
}

/**
 * Pure integrity assertion over the folded fleet state. Returns the list of
 * violations (empty == clean). Severity is assigned by the caller (`run`)
 * based on the ENFORCING posture.
 */
export function assertFleetIntegrity(
  input: FleetIntegrityInput,
  severity: ReconViolation["severity"],
): { violations: ReconViolation[]; asserted: number } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // Check 1 — every tenant has a tier + a surface grant.
  for (const t of input.tenants) {
    asserted += 1;
    if (t.tier === null || t.tier === undefined || t.tier === "") {
      violations.push({
        subject: t.tenantId,
        severity,
        message: `Tenant "${t.tenantId}" has no tier — every fleet tenant must carry a K/R/C tier.`,
      });
    }
    asserted += 1;
    if (t.surfaceVersion === null) {
      violations.push({
        subject: t.tenantId,
        severity,
        message: `Tenant "${t.tenantId}" has no surface grant (surfaceVersion is null) — operationally dark. Emit a TenantSurfaceGranted event.`,
      });
    }
  }

  // Check 2 — metering windows well-formed.
  for (const m of input.meterEntries) {
    asserted += 1;
    if (m.windowStart > m.windowEnd) {
      violations.push({
        subject: `${m.tenantId}|${m.metricKey}`,
        severity,
        message: `Metering window malformed: windowStart "${m.windowStart}" is after windowEnd "${m.windowEnd}".`,
      });
    }
    asserted += 1;
    if (!(m.quantity >= 0) || !Number.isFinite(m.quantity)) {
      violations.push({
        subject: `${m.tenantId}|${m.metricKey}`,
        severity,
        message: `Metering quantity invalid for metric "${m.metricKey}": ${m.quantity} (must be a finite non-negative number).`,
      });
    }
  }

  // Check 3 — upgrade-ledger consistency per tenant.
  for (const [tenantId, history] of input.upgradeHistory) {
    let prevTo: string | null = null;
    for (const entry of history) {
      // (a) no intra-entry regression: toVersion >= fromVersion.
      asserted += 1;
      if (comparePlatformVersions(entry.toVersion, entry.fromVersion) < 0) {
        violations.push({
          subject: tenantId,
          severity,
          message: `Upgrade-ledger regression: entry ${entry.fromVersion}→${entry.toVersion} moves the tenant BACKWARDS.`,
        });
      }
      // (b) monotonic non-decreasing chain of toVersion.
      if (prevTo !== null) {
        asserted += 1;
        if (comparePlatformVersions(entry.toVersion, prevTo) < 0) {
          violations.push({
            subject: tenantId,
            severity,
            message: `Upgrade-ledger regression: toVersion "${entry.toVersion}" is behind a prior ledger version "${prevTo}".`,
          });
        }
        // (c) chain continuity: fromVersion equals the previous toVersion.
        asserted += 1;
        if (entry.fromVersion !== prevTo) {
          violations.push({
            subject: tenantId,
            severity,
            message: `Upgrade-ledger discontinuity: entry fromVersion "${entry.fromVersion}" does not match the previous toVersion "${prevTo}".`,
          });
        }
      }
      prevTo = entry.toVersion;
    }
  }

  return { violations, asserted };
}

// ---------------------------------------------------------------------------
// recon run() — reads the live control-plane store.
// ---------------------------------------------------------------------------

export function run(overridePath?: string): ReconResult {
  const result = emptyResult("v2-fleet-integrity");
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  const dbPath = overridePath ?? defaultControlPlanePath();

  let store: ReturnType<typeof openControlPlaneStore> | undefined;
  try {
    store = openControlPlaneStore(dbPath);
  } catch (err) {
    result.asserted += 1;
    result.violations = [
      {
        subject: dbPath,
        severity: "warn",
        message: `Could not open control-plane store at "${dbPath}": ${String(err)}`,
      },
    ];
    return { ...result, ok: true }; // advisory: cannot open store, non-blocking
  }

  try {
    const projection = buildFleetProjection(store);
    const tenants = projection.listTenants();

    const upgradeHistory = new Map<string, readonly UpgradeEntry[]>();
    for (const t of tenants) {
      upgradeHistory.set(t.tenantId, projection.upgradeHistory(t.tenantId));
    }

    const { violations, asserted } = assertFleetIntegrity(
      {
        tenants: tenants.map((t) => ({
          tenantId: t.tenantId,
          tier: t.tier,
          surfaceVersion: t.surfaceVersion,
        })),
        meterEntries: projection.meterEntries(),
        upgradeHistory,
      },
      severity,
    );

    result.asserted += asserted;
    result.violations = violations;
  } finally {
    store.close();
  }

  const hasFail = result.violations.some((v) => v.severity === "fail");
  return { ...result, ok: !hasFail };
}

// ---------------------------------------------------------------------------
// CLI entry point — `bun run recon:v2-fleet-integrity`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const overridePath = process.env.BANK_V2_CONTROL_PLANE_DB;
  const result = run(overridePath);
  const label = result.violations.length === 0 ? "OK" : ENFORCING ? "FAIL" : "ADVISORY";
  console.log(`recon:v2-fleet-integrity [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
