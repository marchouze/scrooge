// v2-core/client-onboarding/events.test.ts
//
// Unit tests for the born-V2 client-onboarding event payload schemas.
// Happy-path parse + rejection of malformed payloads (strict schemas).
//
// Authority: D-V1-REMOVAL-PHASE-1; WS-V2-CLIENT-ONBOARDING.

import { describe, expect, it } from "bun:test";

import {
  CLIENT_ACTIVATED,
  CLIENT_KYC_PASSED,
  CLIENT_ONBOARDING_EVENT_KINDS,
  CLIENT_ONBOARDING_PAYLOAD_SCHEMAS,
  clientCreditAssessedPayloadSchema,
  clientKycPassedPayloadSchema,
  clientProspectRegisteredPayloadSchema,
} from "./events";

const CITES = ["WS-V2-CLIENT-ONBOARDING"];

describe("client-onboarding event schemas", () => {
  it("exposes 12 event kinds with a payload schema each", () => {
    expect(CLIENT_ONBOARDING_EVENT_KINDS.length).toBe(12);
    for (const kind of CLIENT_ONBOARDING_EVENT_KINDS) {
      expect(CLIENT_ONBOARDING_PAYLOAD_SCHEMAS[kind]).toBeDefined();
    }
  });

  it("parses a valid prospect-registered payload", () => {
    const ok = clientProspectRegisteredPayloadSchema.parse({
      counterpartyId: "cp:1",
      legalName: "Standard Bank",
      jurisdiction: "ZA",
      sector: "banking",
      citations: CITES,
    });
    expect(ok.sector).toBe("banking");
  });

  it("rejects an unknown sector (closed vocabulary)", () => {
    expect(() =>
      clientProspectRegisteredPayloadSchema.parse({
        counterpartyId: "cp:1",
        legalName: "X",
        jurisdiction: "ZA",
        sector: "not-a-sector",
        citations: CITES,
      }),
    ).toThrow();
  });

  it("rejects an unknown field (strict schema)", () => {
    expect(() =>
      clientKycPassedPayloadSchema.parse({
        counterpartyId: "cp:1",
        tier: "Tier-1",
        pep: false,
        jurisdictionalRiskScore: "low",
        reviewerRef: "seat:mlro",
        passedAt: "2026-06-22T00:00:00.000Z",
        citations: CITES,
        rogueExtraField: true,
      }),
    ).toThrow();
  });

  it("requires at least one citation", () => {
    expect(() =>
      clientKycPassedPayloadSchema.parse({
        counterpartyId: "cp:1",
        tier: "Tier-1",
        pep: false,
        jurisdictionalRiskScore: "low",
        reviewerRef: "seat:mlro",
        passedAt: "2026-06-22T00:00:00.000Z",
        citations: [],
      }),
    ).toThrow();
  });

  it("credit-assessed exposureLimit is a decimal STRING amount (no JS number)", () => {
    const ok = clientCreditAssessedPayloadSchema.parse({
      counterpartyId: "cp:1",
      creditGrade: "A",
      exposureLimit: { currency: "ZAR", amount: "100000000" },
      assessedAt: "2026-06-22T00:00:00.000Z",
      citations: CITES,
    });
    expect(ok.exposureLimit.amount).toBe("100000000");
    // A 3-char currency is required.
    expect(() =>
      clientCreditAssessedPayloadSchema.parse({
        counterpartyId: "cp:1",
        creditGrade: "A",
        exposureLimit: { currency: "RANDS", amount: "1" },
        assessedAt: "2026-06-22T00:00:00.000Z",
        citations: CITES,
      }),
    ).toThrow();
  });

  it("kind constants are the canonical literals", () => {
    expect(CLIENT_KYC_PASSED).toBe("ClientOnboardingKycPassed");
    expect(CLIENT_ACTIVATED).toBe("ClientOnboardingActivated");
  });
});
