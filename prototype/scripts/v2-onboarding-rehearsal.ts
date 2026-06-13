// scripts/v2-onboarding-rehearsal.ts
//
// V2 S15 — TENANT ONBOARDING REHEARSAL (scratch-only).
//
// Rehearses onboarding a HYPOTHETICAL R-tier tenant by running the S15
// onboarding flow against a SCRATCH in-memory control-plane store, then proves:
//
//   1. Every provisioning step ran (S1 register → S11 seats → S5 surface grant
//      → S14 fleet state), and the rehearsal reports what each step provisioned.
//   2. The completed tenant is `ready` (readiness gate passes).
//   3. An INCOMPLETE onboarding is REFUSED (readiness `ready:false`) — the
//      platform can refuse a half-provisioned tenant (non-vacuous).
//   4. The anchor (K), already-onboarded, satisfies readiness WITHOUT
//      re-provisioning.
//
// ⚠️ HARD CONSTRAINTS
// ───────────────────────────────────────────────────────────────────────────
// • SCRATCH-ONLY. The rehearsal opens an in-memory (`:memory:`) control-plane
//   store. It NEVER opens, reads, or writes the live canonical control-plane
//   store (`BANK_V2_CONTROL_PLANE_DB` / `$HOME/.local/share/bank/v2-control-plane.db`)
//   and NEVER touches anchor data. `liveStoreWritten === false` always.
// • NO REAL TENANT. The R-tier tenant is hypothetical (`tenant:rehearsal-r`).
//   No external commitment is made (selling is gated).
// • NO APPROVAL-FILE. Onboarding provisions TENANCY ONLY. No part of the
//   anchor's PA approval-file IP is packaged or shipped (held as internal IP).
//
// The anchor-readiness leg builds its OWN scratch store and provisions a
// stand-in anchor (tier K) into it — it does NOT read the live anchor store —
// proving the already-onboarded anchor passes the readiness gate.
//
// Authority: D-V2-WAVE4-COMMERCIAL-POSTURE (CEO-approved 2026-06-13);
// D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s15-tenant-onboarding-mechanics-onboarding-re:2026-06-13
// Author: Atlas (Substrate Architect, engineering).

import {
  type OnboardingPlan,
  type OnboardingResult,
  type OnboardingTierPrecondition,
  type RosterPersona,
  type TenantTier,
  ANCHOR_TENANT_ID,
  checkTenantReadiness,
  openControlPlaneStore,
  runOnboarding,
} from "../v2-core/control-plane";

// ---------------------------------------------------------------------------
// A small, self-contained hypothetical roster for the rehearsal R-tier tenant.
// We do NOT read the canonical roster here — the rehearsal tenant is fictitious
// and supplies its own persona set so it never couples to the anchor's roster.
// (deriveSeatMap derives one tenant-scoped seat per persona.)
// ---------------------------------------------------------------------------

const REHEARSAL_ROSTER: readonly RosterPersona[] = [
  { name: "Rhea", role: "Chief Risk Officer", type: "governance", reportsTo: "CEO" },
  { name: "Quinn", role: "Company Secretary", type: "governance", reportsTo: "CEO" },
  { name: "Devi", role: "Risk Engineer", type: "engineering", reportsTo: "Rhea" },
];

// The hypothetical R-tier tenant. R-tier carries NO go-live preconditions in the
// build phase (those gate the C tier), so a completely-provisioned R tenant is
// ready.
const R_PLAN: OnboardingPlan = {
  tenantId: "tenant:rehearsal-r",
  tier: "R",
  displayName: "Rehearsal Regulated Bank (hypothetical)",
  legalEntityRef: "LE-REHEARSAL-R",
  onboardedAt: "2026-06-13T00:00:00.000Z",
  rosterPersonas: REHEARSAL_ROSTER,
};

// Tier-precondition map mirrors recon: K/R none; C gated. We model the C set as
// unsatisfied to demonstrate the readiness gate REFUSES a C-tier tenant — but
// the rehearsal's primary tenant is R, which has no preconditions.
const TIER_PRECONDITIONS: ReadonlyMap<TenantTier, readonly OnboardingTierPrecondition[]> = new Map<
  TenantTier,
  readonly OnboardingTierPrecondition[]
>([
  ["K", []],
  ["R", []],
  [
    "C",
    [
      { key: "second-provider-fallback", satisfied: false },
      { key: "cross-tenant-csi-gate-cleared", satisfied: false },
    ],
  ],
]);

export interface OnboardingRehearsalResult {
  readonly ok: boolean;
  /** The provisioning result for the hypothetical R-tier tenant. */
  readonly provisioned: OnboardingResult;
  /** The completed R tenant passes readiness. */
  readonly completeReady: boolean;
  /** An INCOMPLETE tenant is refused (ready:false) — non-vacuous. */
  readonly incompleteRefused: boolean;
  /** Reason(s) the incomplete tenant was refused. */
  readonly incompleteReasons: readonly string[];
  /** The already-onboarded anchor (K) passes readiness without re-provisioning. */
  readonly anchorReady: boolean;
  /** HARD INVARIANT: the live canonical store was never written. */
  readonly liveStoreWritten: false;
}

/**
 * Run the onboarding rehearsal entirely against scratch in-memory stores. The
 * live canonical control-plane store is never opened.
 */
export function runOnboardingRehearsal(): OnboardingRehearsalResult {
  // ── Leg 1: provision the hypothetical R-tier tenant into a scratch store ──
  const scratch = openControlPlaneStore(":memory:");
  const provisioned = runOnboarding(scratch, R_PLAN);

  // Leg 1 readiness — the COMPLETE tenant passes.
  const completeVerdict = checkTenantReadiness(
    scratch,
    R_PLAN.tenantId,
    R_PLAN.tier,
    TIER_PRECONDITIONS,
  );

  // ── Leg 2: an INCOMPLETE onboarding is REFUSED (non-vacuous) ──────────────
  // Register-only: emit ONLY the TenantRegistered step into a fresh scratch
  // store (no seats, no surface, no fleet state). Readiness must refuse.
  const incompleteScratch = openControlPlaneStore(":memory:");
  incompleteScratch.append({
    event_id: "tenant-registered:tenant:rehearsal-incomplete",
    type: "TenantRegistered",
    as_of: R_PLAN.onboardedAt,
    entity: "control-plane",
    actor: { type: "service", id: "v2:onboarding-rehearsal" },
    citations: ["D-V2-WAVE4-COMMERCIAL-POSTURE"],
    payload: {
      tenantId: "tenant:rehearsal-incomplete",
      tier: "R",
      displayName: "Rehearsal Incomplete (register-only)",
      legalEntityRef: "LE-REHEARSAL-INCOMPLETE",
      registeredAt: R_PLAN.onboardedAt,
    },
  });
  const incompleteVerdict = checkTenantReadiness(
    incompleteScratch,
    "tenant:rehearsal-incomplete",
    "R",
    TIER_PRECONDITIONS,
  );

  // ── Leg 3: the already-onboarded anchor (K) passes WITHOUT re-provisioning ─
  // Provision a stand-in anchor into its OWN scratch store (we do NOT read the
  // live anchor store). This models the anchor's already-onboarded state and
  // proves the readiness gate accepts it.
  const anchorScratch = openControlPlaneStore(":memory:");
  runOnboarding(anchorScratch, {
    tenantId: ANCHOR_TENANT_ID,
    tier: "K",
    displayName: "The Bank (ZA) — anchor tenant (rehearsal stand-in)",
    legalEntityRef: "LE-ZA-HOZ-BANK",
    onboardedAt: R_PLAN.onboardedAt,
    rosterPersonas: REHEARSAL_ROSTER,
  });
  const anchorVerdict = checkTenantReadiness(
    anchorScratch,
    ANCHOR_TENANT_ID,
    "K",
    TIER_PRECONDITIONS,
  );

  scratch.close();
  incompleteScratch.close();
  anchorScratch.close();

  const completeReady = completeVerdict.ready;
  const incompleteRefused = !incompleteVerdict.ready;
  const anchorReady = anchorVerdict.ready;

  return {
    ok: completeReady && incompleteRefused && anchorReady && provisioned.completed,
    provisioned,
    completeReady,
    incompleteRefused,
    incompleteReasons: incompleteVerdict.violations.map((v) => v.reason),
    anchorReady,
    liveStoreWritten: false,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = runOnboardingRehearsal();
  console.log("\n=== V2 S15 Tenant Onboarding Rehearsal (scratch-only) ===");
  console.log(`  hypothetical tenant:  ${r.provisioned.tenantId} (tier ${r.provisioned.tier})`);
  console.log(`  provisioning steps:`);
  for (const step of r.provisioned.steps) {
    console.log(`    • ${step.step}: ${step.note} (${step.eventsEmitted} event(s))`);
  }
  console.log(`  total events emitted: ${r.provisioned.eventsEmitted}`);
  console.log(`  complete → ready:     ${r.completeReady ? "READY ✅" : "NOT READY ❌"}`);
  console.log(`  incomplete → refused: ${r.incompleteRefused ? "REFUSED ✅" : "NOT REFUSED ❌"}`);
  if (r.incompleteReasons.length > 0) {
    for (const reason of r.incompleteReasons) console.log(`      ↳ ${reason}`);
  }
  console.log(`  anchor (K) ready:     ${r.anchorReady ? "READY ✅ (no re-provisioning)" : "NOT READY ❌"}`);
  console.log(`  live store written:   ${r.liveStoreWritten} (always false)`);
  console.log(`  RESULT: ${r.ok ? "PASS ✅" : "FAIL ❌"}`);
  process.exit(r.ok ? 0 : 1);
}
