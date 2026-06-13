// platform/recon/v2-onboarding-readiness.test.ts
//
// Regression tests for the onboarding-readiness gate (V2 S15).
//
// The catch must be non-vacuous:
//   1. A fully-provisioned fleet → gate PASSES (0 violations).
//   2. A SYNTHETIC HALF-PROVISIONED tenant (no surface grant) → gate FAILS.
//   3. A C-tier tenant with an unsatisfied precondition → gate FAILS.
//   4. The live read against the control-plane store does not throw and the
//      anchor (if registered) is ready (build-phase: anchor-only fleet).
//
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";

import type {
  OnboardingTierPrecondition,
  TenantOnboardingState,
  TenantTier,
} from "../../v2-core/control-plane";
import {
  type OnboardingReadinessInput,
  assertFleetOnboardingReadiness,
  buildTierPreconditionMap,
  run,
} from "./v2-onboarding-readiness";

const COMPLETE: TenantOnboardingState = {
  tenantId: "tenant:complete",
  tier: "R",
  registered: true,
  seatCount: 5,
  surfaceVersion: "v1.0",
  platformVersion: "v1.0",
};

const NO_PRECONDITIONS: ReadonlyMap<TenantTier, readonly OnboardingTierPrecondition[]> = new Map([
  ["K", []],
  ["R", []],
  ["C", []],
]);

describe("recon:v2-onboarding-readiness — non-vacuous", () => {
  it("passes a fully-provisioned fleet", () => {
    const input: OnboardingReadinessInput = {
      states: [COMPLETE],
      tierPreconditions: NO_PRECONDITIONS,
    };
    const { violations, asserted } = assertFleetOnboardingReadiness(input);
    expect(violations.length).toBe(0);
    expect(asserted).toBe(1);
  });

  it("FAILS a synthetic half-provisioned tenant (no surface grant)", () => {
    const half: TenantOnboardingState = { ...COMPLETE, tenantId: "tenant:half", surfaceVersion: null };
    const { violations } = assertFleetOnboardingReadiness({
      states: [COMPLETE, half],
      tierPreconditions: NO_PRECONDITIONS,
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.subject === "tenant:half")).toBe(true);
    expect(violations.every((v) => v.severity === "fail")).toBe(true);
  });

  it("FAILS a C-tier tenant while its go-live preconditions are unsatisfied (selling gated)", () => {
    const cTenant: TenantOnboardingState = {
      tenantId: "tenant:c-fintech",
      tier: "C",
      registered: true,
      seatCount: 5,
      surfaceVersion: "v1.0",
      platformVersion: "v1.0",
    };
    // The real S16 precondition map: C's preconditions are unsatisfied in build phase.
    const { violations } = assertFleetOnboardingReadiness({
      states: [cTenant],
      tierPreconditions: buildTierPreconditionMap(),
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.subject === "tenant:c-fintech")).toBe(true);
  });

  it("real S16 precondition map gates C but not K/R", () => {
    const map = buildTierPreconditionMap();
    expect(map.get("K")?.length).toBe(0);
    expect(map.get("R")?.length).toBe(0);
    expect((map.get("C")?.length ?? 0)).toBeGreaterThan(0);
    expect(map.get("C")?.every((p) => p.satisfied === false)).toBe(true);
  });

  it("live read does not throw and is clean or advisory", () => {
    const r = run();
    expect(r.pipeline).toBe("v2-onboarding-readiness");
    // Either clean (anchor ready / no store) or any violation is a real one;
    // in the build phase the fleet is anchor-only (K, no preconditions) so it
    // must not produce a fail. (A genuinely half-provisioned anchor would fail —
    // that is the gate working.)
    expect(r.ok).toBe(true);
  });
});
