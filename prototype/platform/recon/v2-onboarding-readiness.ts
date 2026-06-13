// platform/recon/v2-onboarding-readiness.ts
//
// recon:v2-onboarding-readiness — V2 S15 (ENFORCING).
//
// The onboarding-readiness gate. A tenant in the control-plane fleet is `ready`
// ONLY when EVERY provisioning step landed AND its tier preconditions are met:
//
//   1. registered            — TenantRegistered landed (S1).
//   2. seats granted         — at least one tenant-scoped functional seat (S11).
//   3. released surface       — a surface version is granted (S5).
//   4. fleet state set        — a platform version is on the upgrade ledger (S14).
//   5. tier preconditions met — for a tier with go-live preconditions (the S16
//      C-tier set: tested second-provider fallback, cross-tenant CSI gate), EVERY
//      precondition is satisfied. A C-tier tenant CANNOT be ready while those are
//      unsatisfied — selling is gated.
//
// The platform can therefore REFUSE an incomplete onboarding. The pure assertion
// (`assertOnboardingReadiness`, in v2-core) is exercised sabotage-proof in the
// v2-core regression test (a synthetic half-provisioned tenant — and a C-tier
// tenant with an unsatisfied precondition — yield `ready:false`, non-vacuous).
//
// THE ANCHOR (K) is already-onboarded: it satisfies the readiness gate without
// re-provisioning. The gate asserts every REGISTERED tenant is ready; in the
// build phase that is the anchor only.
//
// SEVERITY: ENFORCING. Every registered tenant must be ready. A genuinely
// half-provisioned tenant in the live store is a fail. (If the control-plane
// store is absent on a fresh checkout, the gate is vacuously clean — there is no
// tenant to be un-ready — and stays green.)
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra checks v2
// behaviour; the reverse is forbidden). It imports the v2 onboarding model +
// tier-entitlement preconditions via the permitted v1→v2 direction.
//
// Authority: D-V2-WAVE4-COMMERCIAL-POSTURE (CEO-approved 2026-06-13);
// D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s15-tenant-onboarding-mechanics-onboarding-re:2026-06-13
// Author: Atlas (Substrate Architect, engineering).

import {
  type OnboardingReadinessVerdict,
  type OnboardingTierPrecondition,
  type TenantOnboardingState,
  type TenantTier,
  assertOnboardingReadiness,
  buildControlPlaneProjection,
  defaultControlPlanePath,
  foldTenantOnboardingState,
  openControlPlaneStore,
} from "../../v2-core/control-plane";
import { C_TIER_GO_LIVE_PRECONDITIONS } from "../../v2-core/tier-entitlement";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-onboarding-readiness";

// ---------------------------------------------------------------------------
// Tier-precondition map — wired from the S16 entitlement model.
//
// K and R tiers carry no go-live preconditions in the build phase. The C tier
// carries the S16 go-live set (tested second-provider fallback + cross-tenant
// CSI gate) — both `satisfied:false` until their workstreams land, so a C-tier
// tenant cannot be marked ready (selling is gated).
// ---------------------------------------------------------------------------

export function buildTierPreconditionMap(): ReadonlyMap<
  TenantTier,
  readonly OnboardingTierPrecondition[]
> {
  const map = new Map<TenantTier, readonly OnboardingTierPrecondition[]>();
  map.set("K", []);
  map.set("R", []);
  map.set(
    "C",
    C_TIER_GO_LIVE_PRECONDITIONS.map((p) => ({ key: p.key, satisfied: p.satisfied })),
  );
  return map;
}

// ---------------------------------------------------------------------------
// Pure assertion over a set of folded tenant states (test-drivable).
// ---------------------------------------------------------------------------

export interface OnboardingReadinessInput {
  readonly states: readonly TenantOnboardingState[];
  readonly tierPreconditions: ReadonlyMap<TenantTier, readonly OnboardingTierPrecondition[]>;
}

/**
 * Assert readiness across every folded tenant state. Returns the per-tenant
 * verdicts, the fail-severity violations (one per readiness violation), and the
 * count of tenants asserted.
 */
export function assertFleetOnboardingReadiness(
  input: OnboardingReadinessInput,
  severity: ReconViolation["severity"] = "fail",
): { verdicts: OnboardingReadinessVerdict[]; violations: ReconViolation[]; asserted: number } {
  const verdicts: OnboardingReadinessVerdict[] = [];
  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const state of input.states) {
    asserted += 1;
    const verdict = assertOnboardingReadiness(state, input.tierPreconditions);
    verdicts.push(verdict);
    for (const v of verdict.violations) {
      violations.push({
        subject: v.tenantId,
        severity,
        message: v.reason,
      });
    }
  }

  return { verdicts, violations, asserted };
}

// ---------------------------------------------------------------------------
// recon run() — reads the live control-plane store.
// ---------------------------------------------------------------------------

export function run(overridePath?: string): ReconResult {
  const result = emptyResult(PIPELINE);
  const dbPath = overridePath ?? defaultControlPlanePath();

  let store: ReturnType<typeof openControlPlaneStore> | undefined;
  try {
    store = openControlPlaneStore(dbPath);
  } catch (err) {
    // Cannot open the store (fresh checkout) — vacuously clean, advisory note.
    result.asserted += 1;
    result.violations = [
      {
        subject: dbPath,
        severity: "warn",
        message: `Could not open control-plane store at "${dbPath}": ${String(err)}`,
      },
    ];
    return { ...result, ok: true };
  }

  try {
    const projection = buildControlPlaneProjection(store);
    const tenants = projection.listTenants();
    const tierPreconditions = buildTierPreconditionMap();

    const states: TenantOnboardingState[] = [];
    for (const t of tenants) {
      const state = foldTenantOnboardingState(store, t.tenantId);
      if (state !== null) states.push(state);
    }

    const { violations, asserted } = assertFleetOnboardingReadiness(
      { states, tierPreconditions },
      "fail",
    );
    result.asserted += asserted;
    result.violations = violations;
    result.asOf = `${states.length} registered tenant(s); ${violations.length} not-ready violation(s)`;
  } finally {
    store.close();
  }

  const hasFail = result.violations.some((v) => v.severity === "fail");
  return { ...result, ok: !hasFail };
}

// ---------------------------------------------------------------------------
// CLI entry point — `bun run recon:v2-onboarding-readiness`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const overridePath = process.env.BANK_V2_CONTROL_PLANE_DB;
  const r = run(overridePath);
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok && r.violations.length === 0 ? "OK" : r.ok ? "OK (advisory)" : "FAIL";
  console.log(`recon:${PIPELINE} [${label}] — ${r.asOf}; ${r.violations.length} violation(s)`);
  process.exit(r.ok ? 0 : 1);
}
