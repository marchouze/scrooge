// v2-core/client-onboarding/projection.test.ts
//
// Unit tests for the born-V2 client-onboarding register projection — the
// structural truth the recon gate asserts.
//
//   - happy path: full clean lifecycle → activated, no violations.
//   - monotonic advance: out-of-order / re-delivered phases never regress.
//   - offboarded override: a terminal off-ramp wins even after activation.
//   - gating invariant: activation missing a gating phase → violation.
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
  CLIENT_OFFBOARDED,
  CLIENT_POPIA_RECORDED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_SOUNDING_OPENED,
} from "./events";
import { REQUIRED_GATING_PHASES, foldClientOnboardingRegister } from "./projection";

interface Raw {
  kind: string;
  payload: Record<string, unknown>;
  asOf: string;
}

function e(kind: string, cp: string, seq: number, extra: Record<string, unknown> = {}): Raw {
  return {
    kind,
    payload: { counterpartyId: cp, ...extra },
    asOf: `2026-06-22T00:${String(seq).padStart(2, "0")}:00.000Z`,
  };
}

function fullLifecycle(cp: string): Raw[] {
  return [
    e(CLIENT_SOUNDING_OPENED, cp, 0),
    e(CLIENT_PROSPECT_REGISTERED, cp, 1, {
      legalName: "Test Bank",
      jurisdiction: "ZA",
      sector: "banking",
    }),
    e(CLIENT_KYC_PASSED, cp, 2, { tier: "Tier-1" }),
    e(CLIENT_SANCTIONS_CLEARED, cp, 3),
    e(CLIENT_FAIS_CLASSIFIED, cp, 4, { faisCategory: "market-counterparty" }),
    e(CLIENT_BO_RESOLVED, cp, 5),
    e(CLIENT_FATCA_CRS_CLASSIFIED, cp, 6),
    e(CLIENT_POPIA_RECORDED, cp, 7),
    e(CLIENT_CREDIT_ASSESSED, cp, 8),
    e(CLIENT_ACCOUNTS_SETUP, cp, 9),
    e(CLIENT_ACTIVATED, cp, 10),
  ];
}

describe("foldClientOnboardingRegister", () => {
  it("happy path: full lifecycle → activated, no violations, descriptive fields captured", () => {
    const reg = foldClientOnboardingRegister(fullLifecycle("cp:happy"));
    const rec = reg.getClient("cp:happy");
    expect(rec).not.toBeNull();
    expect(rec?.phase).toBe("activated");
    expect(rec?.isTerminal).toBe(true);
    expect(rec?.legalName).toBe("Test Bank");
    expect(rec?.jurisdiction).toBe("ZA");
    expect(rec?.sector).toBe("banking");
    expect(rec?.kycTier).toBe("Tier-1");
    expect(rec?.faisCategory).toBe("market-counterparty");
    expect(reg.violations.length).toBe(0);
    expect(reg.listActiveClients().map((c) => c.counterpartyId)).toContain("cp:happy");
  });

  it("monotonic advance: a re-delivered earlier phase never regresses the state", () => {
    const events = [
      ...fullLifecycle("cp:mono"),
      // Re-deliver KYC AFTER activation — must NOT pull the phase back to kyc.
      e(CLIENT_KYC_PASSED, "cp:mono", 11, { tier: "Tier-1" }),
    ];
    const reg = foldClientOnboardingRegister(events);
    expect(reg.getClient("cp:mono")?.phase).toBe("activated");
    // The redundant gating event does not create a violation (all gates present).
    expect(reg.violations.length).toBe(0);
  });

  it("offboarded override: a terminal off-ramp wins even after activation", () => {
    const events = [
      ...fullLifecycle("cp:off"),
      e(CLIENT_OFFBOARDED, "cp:off", 11, { reason: "relationship-ended" }),
    ];
    const reg = foldClientOnboardingRegister(events);
    const rec = reg.getClient("cp:off");
    expect(rec?.phase).toBe("offboarded");
    expect(rec?.isTerminal).toBe(true);
    // Offboarded is terminal — it is no longer an active client.
    expect(reg.listActiveClients().map((c) => c.counterpartyId)).not.toContain("cp:off");
  });

  it("gating invariant: activation missing a gating phase → activation-without-gate violation", () => {
    // Drop accounts-setup but still activate.
    const events = fullLifecycle("cp:gap").filter((x) => x.kind !== CLIENT_ACCOUNTS_SETUP);
    const reg = foldClientOnboardingRegister(events);
    expect(
      reg.violations.some(
        (v) => v.kind === "activation-without-gate" && v.message.includes("accounts-setup"),
      ),
    ).toBe(true);
  });

  it("REQUIRED_GATING_PHASES is the 8 CDD/FAIS/POPIA/credit/accounts gates", () => {
    const got: string[] = REQUIRED_GATING_PHASES.map((p) => p as string).sort();
    const want: string[] = [
      "accounts-setup",
      "bo-resolved",
      "credit-assessed",
      "fais-classified",
      "fatca-crs-classified",
      "kyc-passed",
      "popia-recorded",
      "sanctions-cleared",
    ];
    expect(got).toEqual(want);
  });

  it("tolerant fold: unknown kinds and missing counterpartyId are skipped, not thrown", () => {
    const reg = foldClientOnboardingRegister([
      { kind: "SomethingElse", payload: { counterpartyId: "cp:x" }, asOf: "" },
      { kind: CLIENT_SOUNDING_OPENED, payload: {}, asOf: "" }, // no counterpartyId
    ]);
    expect(reg.eventCount).toBe(0);
    expect(reg.listClients().length).toBe(0);
  });
});
