// v2-core/control-plane/onboarding.test.ts
//
// Unit tests for the V2 S15 tenant onboarding mechanics + onboarding-readiness.
//
// Proves:
//   1. THE FLOW PROVISIONS — runOnboarding wires every step (register → seats →
//      surface → fleet) and emits the expected typed events.
//   2. FAIL-CLOSED — an invalid plan (bad tenantId, empty roster, dirty
//      derivation, missing timestamp) ABORTS before any event is emitted; no
//      half-provisioned tenant is left in the store.
//   3. READINESS IS NON-VACUOUS — a COMPLETE tenant is ready; a synthetic
//      HALF-PROVISIONED tenant (missing each step in turn) is REFUSED with the
//      specific violation. A C-tier tenant with an unsatisfied precondition is
//      REFUSED even when fully provisioned (selling gated).
//   4. ANCHOR = READY — a fully-provisioned anchor (K) passes readiness.
//   5. NO WALL CLOCK — every timestamp is caller-supplied (no Date.now in the
//      module under test; enforced by the wall-clock ratchet, asserted here by
//      requiring onboardedAt).
//
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  type OnboardingTierPrecondition,
  type RosterPersona,
  type TenantOnboardingState,
  type TenantTier,
  ANCHOR_TENANT_ID,
  OnboardingAbortedError,
  assertOnboardingReadiness,
  checkTenantReadiness,
  foldTenantOnboardingState,
  openControlPlaneStore,
  preflightOnboarding,
  runOnboarding,
} from "./index";

const ONBOARDED_AT = "2026-06-13T00:00:00.000Z";

const ROSTER: readonly RosterPersona[] = [
  { name: "Rhea", role: "Chief Risk Officer", type: "governance", reportsTo: "CEO" },
  { name: "Quinn", role: "Company Secretary", type: "governance", reportsTo: "CEO" },
  { name: "Devi", role: "Risk Engineer", type: "engineering", reportsTo: "Rhea" },
];

const R_PLAN = {
  tenantId: "tenant:test-r",
  tier: "R" as const,
  displayName: "Test Regulated Bank",
  legalEntityRef: "LE-TEST-R",
  onboardedAt: ONBOARDED_AT,
  rosterPersonas: ROSTER,
};

const NO_PRECONDITIONS: ReadonlyMap<TenantTier, readonly OnboardingTierPrecondition[]> = new Map([
  ["K", []],
  ["R", []],
  ["C", []],
]);

const C_GATED: ReadonlyMap<TenantTier, readonly OnboardingTierPrecondition[]> = new Map<
  TenantTier,
  readonly OnboardingTierPrecondition[]
>([
  ["K", []],
  ["R", []],
  ["C", [{ key: "second-provider-fallback", satisfied: false }]],
]);

describe("S15 onboarding flow — provisioning", () => {
  it("provisions every step and emits the expected typed events", () => {
    const store = openControlPlaneStore(":memory:");
    const result = runOnboarding(store, R_PLAN);

    expect(result.completed).toBe(true);
    expect(result.steps.map((s) => s.step)).toEqual([
      "register-tenant",
      "derive-and-grant-seats",
      "grant-released-surface",
      "set-fleet-state",
    ]);
    // 1 register + 3 seats + 1 surface + 1 upgrade = 6 events.
    expect(result.eventsEmitted).toBe(6);
    expect(result.seatMap.seats.length).toBe(3);

    // The folded state reflects every step.
    const state = foldTenantOnboardingState(store, R_PLAN.tenantId);
    expect(state).not.toBeNull();
    expect(state?.registered).toBe(true);
    expect(state?.seatCount).toBe(3);
    expect(state?.surfaceVersion).toBe("v1.0");
    expect(state?.platformVersion).toBe("v1.0");
    store.close();
  });

  it("calls the per-tenant store binding hook (S10) and aborts fail-closed if it throws", () => {
    const store = openControlPlaneStore(":memory:");
    let bound: string | null = null;
    runOnboarding(store, R_PLAN, (tid) => {
      bound = tid;
    });
    expect(bound).toBe(R_PLAN.tenantId);
    store.close();

    // A throwing binding aborts the flow.
    const store2 = openControlPlaneStore(":memory:");
    expect(() =>
      runOnboarding(store2, R_PLAN, () => {
        throw new Error("store path unresolvable");
      }),
    ).toThrow(OnboardingAbortedError);
    store2.close();
  });
});

describe("S15 onboarding flow — fail-closed pre-flight", () => {
  it("aborts on a bad tenantId before emitting anything", () => {
    const store = openControlPlaneStore(":memory:");
    expect(() => runOnboarding(store, { ...R_PLAN, tenantId: "bad-no-prefix" })).toThrow(
      OnboardingAbortedError,
    );
    // No tenant was registered (fail-closed: nothing emitted).
    expect(foldTenantOnboardingState(store, "bad-no-prefix")).toBeNull();
    store.close();
  });

  it("aborts on an empty roster", () => {
    const store = openControlPlaneStore(":memory:");
    expect(() => runOnboarding(store, { ...R_PLAN, rosterPersonas: [] })).toThrow(
      OnboardingAbortedError,
    );
    expect(foldTenantOnboardingState(store, R_PLAN.tenantId)).toBeNull();
    store.close();
  });

  it("aborts on a dirty derivation (duplicate role slug)", () => {
    const dirty: readonly RosterPersona[] = [
      { name: "A", role: "Chief Risk Officer", type: "governance", reportsTo: "CEO" },
      { name: "B", role: "Chief Risk Officer", type: "governance", reportsTo: "CEO" },
    ];
    const store = openControlPlaneStore(":memory:");
    expect(() => runOnboarding(store, { ...R_PLAN, rosterPersonas: dirty })).toThrow(
      OnboardingAbortedError,
    );
    expect(foldTenantOnboardingState(store, R_PLAN.tenantId)).toBeNull();
    store.close();
  });

  it("aborts on a missing onboardedAt timestamp (no wall clock in v2-core)", () => {
    const store = openControlPlaneStore(":memory:");
    expect(() => runOnboarding(store, { ...R_PLAN, onboardedAt: "  " })).toThrow(
      OnboardingAbortedError,
    );
    store.close();
  });

  it("preflight returns the derived seat map without touching the store", () => {
    const { seatMap } = preflightOnboarding(R_PLAN);
    expect(seatMap.seats.length).toBe(3);
    expect(seatMap.findings.length).toBe(0);
  });
});

describe("S15 onboarding-readiness — non-vacuous refusal", () => {
  it("marks a fully-provisioned R tenant ready", () => {
    const store = openControlPlaneStore(":memory:");
    runOnboarding(store, R_PLAN);
    const verdict = checkTenantReadiness(store, R_PLAN.tenantId, "R", NO_PRECONDITIONS);
    expect(verdict.ready).toBe(true);
    expect(verdict.violations.length).toBe(0);
    store.close();
  });

  it("REFUSES an unregistered tenant", () => {
    const store = openControlPlaneStore(":memory:");
    const verdict = checkTenantReadiness(store, "tenant:ghost", "R", NO_PRECONDITIONS);
    expect(verdict.ready).toBe(false);
    expect(verdict.violations[0]?.reason).toContain("not registered");
    store.close();
  });

  it("REFUSES each half-provisioned state (missing each step in turn)", () => {
    const base: TenantOnboardingState = {
      tenantId: "tenant:half",
      tier: "R",
      registered: true,
      seatCount: 3,
      surfaceVersion: "v1.0",
      platformVersion: "v1.0",
    };
    // Complete → ready.
    expect(assertOnboardingReadiness(base, NO_PRECONDITIONS).ready).toBe(true);

    // Missing seats.
    expect(assertOnboardingReadiness({ ...base, seatCount: 0 }, NO_PRECONDITIONS).ready).toBe(
      false,
    );
    // Missing surface grant.
    expect(
      assertOnboardingReadiness({ ...base, surfaceVersion: null }, NO_PRECONDITIONS).ready,
    ).toBe(false);
    // Missing fleet state.
    expect(
      assertOnboardingReadiness({ ...base, platformVersion: null }, NO_PRECONDITIONS).ready,
    ).toBe(false);
    // Not registered.
    expect(assertOnboardingReadiness({ ...base, registered: false }, NO_PRECONDITIONS).ready).toBe(
      false,
    );
  });

  it("REFUSES a C-tier tenant with an unsatisfied precondition even when fully provisioned", () => {
    const cTenant: TenantOnboardingState = {
      tenantId: "tenant:c-fintech",
      tier: "C",
      registered: true,
      seatCount: 3,
      surfaceVersion: "v1.0",
      platformVersion: "v1.0",
    };
    const verdict = assertOnboardingReadiness(cTenant, C_GATED);
    expect(verdict.ready).toBe(false);
    expect(verdict.violations.some((v) => v.reason.includes("second-provider-fallback"))).toBe(
      true,
    );

    // The SAME fully-provisioned tenant on the R tier (no preconditions) IS ready.
    const rVerdict = assertOnboardingReadiness({ ...cTenant, tier: "R" }, C_GATED);
    expect(rVerdict.ready).toBe(true);
  });
});

describe("S15 onboarding — anchor = ready", () => {
  it("a fully-provisioned anchor (K) passes readiness", () => {
    const store = openControlPlaneStore(":memory:");
    runOnboarding(store, {
      tenantId: ANCHOR_TENANT_ID,
      tier: "K",
      displayName: "The Bank (ZA) — anchor",
      legalEntityRef: "LE-ZA-HOZ-BANK",
      onboardedAt: ONBOARDED_AT,
      rosterPersonas: ROSTER,
    });
    const verdict = checkTenantReadiness(store, ANCHOR_TENANT_ID, "K", C_GATED);
    expect(verdict.ready).toBe(true);
    store.close();
  });
});
