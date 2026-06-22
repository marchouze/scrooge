// platform/recon/v2-client-onboarding-integrity.test.ts
//
// Sabotage-proof tests for recon:v2-client-onboarding-integrity. The gate's
// reason for existing is the GATING INVARIANT: a counterparty cannot reach
// `activated` without every required gating phase + a prospect registration.
//
//   1. A CLEAN full lifecycle (all gating phases → activated) → zero violations.
//   2. A CONCEALED activation (jumps to ClientOnboardingActivated missing the
//      sanctions-cleared gate) → at least one `fail` violation. This is the
//      negative test the brief requires: the gate MUST catch a concealed
//      activation, otherwise it is theatre.
//   3. An activation with NO prospect registration → an
//      `activation-without-prospect` violation.
//   4. Empty register → zero violations, zero asserted (empty-state correct).
//
// Authority: D-V1-REMOVAL-PHASE-1; WS-V2-CLIENT-ONBOARDING.

import { describe, expect, it } from "bun:test";

import {
  CLIENT_ACCOUNTS_SETUP,
  CLIENT_ACTIVATED,
  CLIENT_BO_RESOLVED,
  CLIENT_CREDIT_ASSESSED,
  CLIENT_FAIS_CLASSIFIED,
  CLIENT_FATCA_CRS_CLASSIFIED,
  CLIENT_KYC_PASSED,
  CLIENT_POPIA_RECORDED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_SOUNDING_OPENED,
  foldClientOnboardingRegister,
} from "../../v2-core/client-onboarding";
import { assertClientOnboardingIntegrity } from "./v2-client-onboarding-integrity";

interface Raw {
  kind: string;
  payload: Record<string, unknown>;
  asOf: string;
}

function ev(kind: string, counterpartyId: string, seq: number): Raw {
  return { kind, payload: { counterpartyId }, asOf: `2026-06-22T00:0${seq}:00.000Z` };
}

/** The full clean lifecycle for one counterparty, in causal order. */
function cleanLifecycle(counterpartyId: string): Raw[] {
  const phases = [
    CLIENT_SOUNDING_OPENED,
    CLIENT_PROSPECT_REGISTERED,
    CLIENT_KYC_PASSED,
    CLIENT_SANCTIONS_CLEARED,
    CLIENT_FAIS_CLASSIFIED,
    CLIENT_BO_RESOLVED,
    CLIENT_FATCA_CRS_CLASSIFIED,
    CLIENT_POPIA_RECORDED,
    CLIENT_CREDIT_ASSESSED,
    CLIENT_ACCOUNTS_SETUP,
    CLIENT_ACTIVATED,
  ];
  return phases.map((kind, i) => ev(kind, counterpartyId, i));
}

describe("assertClientOnboardingIntegrity", () => {
  it("clean full lifecycle → zero violations, one asserted subject", () => {
    const register = foldClientOnboardingRegister(cleanLifecycle("cp:clean"));
    const r = assertClientOnboardingIntegrity(register, "fail");
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(1);
  });

  it("CONCEALED activation (missing sanctions-cleared gate) → fail violation", () => {
    // Drop the sanctions-cleared event but still emit Activated — the exact
    // concealment the gate exists to catch.
    const events = cleanLifecycle("cp:concealed").filter(
      (e) => e.kind !== CLIENT_SANCTIONS_CLEARED,
    );
    const register = foldClientOnboardingRegister(events);
    const r = assertClientOnboardingIntegrity(register, "fail");
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.message.includes("sanctions-cleared"))).toBe(true);
  });

  it("activation with no prospect registration → activation-without-prospect", () => {
    const events = cleanLifecycle("cp:no-prospect").filter(
      (e) => e.kind !== CLIENT_PROSPECT_REGISTERED,
    );
    const register = foldClientOnboardingRegister(events);
    const r = assertClientOnboardingIntegrity(register, "fail");
    expect(r.violations.some((v) => v.message.includes("without a"))).toBe(true);
  });

  it("empty register → zero violations, zero asserted", () => {
    const register = foldClientOnboardingRegister([]);
    const r = assertClientOnboardingIntegrity(register, "fail");
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(0);
  });

  it("mixed clean + concealed → only the concealed counterparty is flagged", () => {
    const events = [
      ...cleanLifecycle("cp:ok"),
      ...cleanLifecycle("cp:bad").filter((e) => e.kind !== CLIENT_CREDIT_ASSESSED),
    ];
    const register = foldClientOnboardingRegister(events);
    const r = assertClientOnboardingIntegrity(register, "fail");
    expect(r.asserted).toBe(2);
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations.every((v) => v.subject.includes("cp:bad"))).toBe(true);
  });
});
