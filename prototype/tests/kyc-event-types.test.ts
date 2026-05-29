// tests/kyc-event-types.test.ts
//
// Registry registration and schema round-trip tests for the 18 KYC
// onboarding lifecycle event types.
//
// Asserts:
//   (1) Every KYC event type has a registry row with a payloadSchema.
//   (2) make* factory functions produce valid Event envelopes.
//   (3) validatePayload() passes for all KYC event types.
//   (4) KYCRatingRevised schema rejects upgrades without mlro_sign_off_event_id.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  KYC_TYPED_EVENT_TYPES,
  kycRatingRevisedPayloadSchema,
  makeClientAccepted,
  makeClientRejected,
  makeCounterpartyCategorised,
  makeCounterpartyDeclined,
  makeKYCDecisionMade,
  makeKYCEDDCompleted,
  makeKYCEDDInitiated,
  makeKYCIdentityCollected,
  makeKYCIdentityVerificationFailed,
  makeKYCIdentityVerified,
  makeKYCRatingRevised,
  makeKYCRefreshCompleted,
  makeKYCRefreshScheduled,
  makeKYCRiskRated,
  makeKYCSanctionsPEPScreened,
  makeKYCUBOResolved,
  makeLawfulProcessingRegistered,
  makeOdpCounterpartyCategorised,
} from "../platform/event-store/event-types/kyc";
import { lookupEventType, validatePayload } from "../platform/event-store/registry";

const ACTOR = { type: "service" as const, id: "kyc-test" };
const NOW = new Date("2026-05-18T10:00:00.000Z").toISOString();
const CITATIONS = ["D-KYC-ONBOARDING-BUILD", "AML-CFT-POLICY-V1"];

// ---------------------------------------------------------------------------
// Registry coverage
// ---------------------------------------------------------------------------

describe("KYC event types — registry coverage", () => {
  it("every KYC event type has a registry row with a payloadSchema", () => {
    for (const type of KYC_TYPED_EVENT_TYPES) {
      const row = lookupEventType(type);
      expect({ type, hasRow: !!row }).toEqual({ type, hasRow: true });
      expect({ type, hasSchema: !!row?.payloadSchema }).toEqual({ type, hasSchema: true });
    }
  });

  it("KYC_TYPED_EVENT_TYPES covers all 18 expected types", () => {
    const expected = [
      "KYCIdentityCollected",
      "KYCIdentityVerified",
      "KYCIdentityVerificationFailed",
      "KYCSanctionsPEPScreened",
      "KYCUBOResolved",
      "KYCRiskRated",
      "KYCEDDInitiated",
      "KYCEDDCompleted",
      "KYCDecisionMade",
      "ClientAccepted",
      "ClientRejected",
      "LawfulProcessingRegistered",
      "KYCRefreshScheduled",
      "KYCRefreshCompleted",
      "KYCRatingRevised",
      "CounterpartyCategorised",
      "CounterpartyDeclined",
      // CS 2/2018 §4 + ORG-ODP-COND-002 — ODP binary client/counterparty category.
      "OdpCounterpartyCategorised",
    ];
    for (const t of expected) {
      expect(KYC_TYPED_EVENT_TYPES as readonly string[]).toContain(t);
    }
    expect((KYC_TYPED_EVENT_TYPES as readonly string[]).length).toBe(expected.length);
  });
});

// ---------------------------------------------------------------------------
// Factory round-trips
// ---------------------------------------------------------------------------

describe("KYC event type factory functions", () => {
  it("makeKYCIdentityCollected produces a valid event", () => {
    const event = makeKYCIdentityCollected({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-001",
        directors: [{ name: "Jane Doe", id_number: "8501015026085", role: "director" }],
        ubos: [],
        documents: [{ type: "passport", hash: "blake3:abc123" }],
        collectedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCIdentityCollected");
    validatePayload("KYCIdentityCollected", event.payload as Record<string, unknown>);
  });

  it("makeKYCIdentityVerified produces a valid event", () => {
    const event = makeKYCIdentityVerified({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: { candidateId: "cand-001", adapter: "dha", result: "matched", verifiedAt: NOW },
    });
    expect(event.type).toBe("KYCIdentityVerified");
    validatePayload("KYCIdentityVerified", event.payload as Record<string, unknown>);
  });

  it("makeKYCIdentityVerificationFailed produces a valid event", () => {
    const event = makeKYCIdentityVerificationFailed({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-002",
        adapter: "cipc",
        reason: "name-mismatch",
        failedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCIdentityVerificationFailed");
    validatePayload("KYCIdentityVerificationFailed", event.payload as Record<string, unknown>);
  });

  it("makeKYCSanctionsPEPScreened produces a valid event", () => {
    const event = makeKYCSanctionsPEPScreened({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-001",
        lists_checked: ["un", "ofac", "eu", "uk-hmt", "sa-pocdatara"],
        result: "clean",
        hits: [],
        pep_flag: false,
        pep_linked: false,
        screenedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCSanctionsPEPScreened");
    validatePayload("KYCSanctionsPEPScreened", event.payload as Record<string, unknown>);
  });

  it("makeKYCUBOResolved produces a valid event", () => {
    const event = makeKYCUBOResolved({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-001",
        ubo_chain: [
          {
            name: "John Smith",
            id_number: "8501015026085",
            nationality: "ZA",
            residence_country: "ZA",
            ownership_pct: 60,
            basis_of_control: "direct-shareholding",
            dha_verified: true,
            pep_flag: false,
          },
        ],
        ubo_opaque_structure: false,
        resolvedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCUBOResolved");
    validatePayload("KYCUBOResolved", event.payload as Record<string, unknown>);
  });

  it("makeKYCRiskRated produces a valid event", () => {
    const event = makeKYCRiskRated({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-001",
        score: 25,
        band: "low",
        factors: [{ factor_name: "country_risk", weight: 0.4, value: 10 }],
        ratedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCRiskRated");
    validatePayload("KYCRiskRated", event.payload as Record<string, unknown>);
  });

  it("makeKYCEDDInitiated produces a valid event", () => {
    const event = makeKYCEDDInitiated({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-003",
        reason: "pep",
        initiatedBy: "zara:mlro",
        initiatedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCEDDInitiated");
    validatePayload("KYCEDDInitiated", event.payload as Record<string, unknown>);
  });

  it("makeKYCEDDCompleted with mlro_sign_off_event_id produces a valid event", () => {
    const event = makeKYCEDDCompleted({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-003",
        mlro_sign_off_event_id: "evt-mlro-signoff-001",
        outcome: "proceed",
        completedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCEDDCompleted");
    validatePayload("KYCEDDCompleted", event.payload as Record<string, unknown>);
  });

  it("makeKYCDecisionMade produces a valid event", () => {
    const event = makeKYCDecisionMade({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-001",
        decision: "accept",
        reason: "All KYC checks passed",
        decided_by: "zara:mlro",
        decidedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCDecisionMade");
    validatePayload("KYCDecisionMade", event.payload as Record<string, unknown>);
  });

  it("makeClientAccepted produces a valid event with required fields", () => {
    const event = makeClientAccepted({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        candidateId: "cand-001",
        clientId: "client-001",
        entityName: "ACME HOLDINGS (PTY) LTD",
        entityType: "company",
        jurisdiction: "ZA",
        riskBand: "low",
        category: "EC",
        acceptedAt: NOW,
      },
    });
    expect(event.type).toBe("ClientAccepted");
    validatePayload("ClientAccepted", event.payload as Record<string, unknown>);
  });

  it("makeClientRejected produces a valid event", () => {
    const event = makeClientRejected({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: { candidateId: "cand-bad", reason: "Sanctions hit confirmed", rejectedAt: NOW },
    });
    expect(event.type).toBe("ClientRejected");
    validatePayload("ClientRejected", event.payload as Record<string, unknown>);
  });

  it("makeLawfulProcessingRegistered produces a valid event", () => {
    const event = makeLawfulProcessingRegistered({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        clientId: "client-001",
        lawful_basis: "contract",
        processing_purposes: ["kyc-compliance", "account-management"],
        registeredAt: NOW,
      },
    });
    expect(event.type).toBe("LawfulProcessingRegistered");
    validatePayload("LawfulProcessingRegistered", event.payload as Record<string, unknown>);
  });

  it("makeKYCRefreshScheduled produces a valid event", () => {
    const event = makeKYCRefreshScheduled({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        clientId: "client-001",
        cadence: "annual",
        triggerReason: "calendar",
        scheduledFor: "2027-05-18",
        scheduledAt: NOW,
      },
    });
    expect(event.type).toBe("KYCRefreshScheduled");
    validatePayload("KYCRefreshScheduled", event.payload as Record<string, unknown>);
  });

  it("makeKYCRefreshCompleted produces a valid event", () => {
    const event = makeKYCRefreshCompleted({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        clientId: "client-001",
        refreshId: "refresh-001",
        nextDueDate: "2027-05-18",
        completedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCRefreshCompleted");
    validatePayload("KYCRefreshCompleted", event.payload as Record<string, unknown>);
  });

  it("makeKYCRatingRevised downgrade (no mlro required) produces a valid event", () => {
    const event = makeKYCRatingRevised({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        clientId: "client-001",
        refreshId: "refresh-001",
        oldBand: "high",
        newBand: "medium", // downgrade — no mlro required
        revisedAt: NOW,
      },
    });
    expect(event.type).toBe("KYCRatingRevised");
    validatePayload("KYCRatingRevised", event.payload as Record<string, unknown>);
  });

  it("makeCounterpartyCategorised produces a valid event", () => {
    const event = makeCounterpartyCategorised({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        partyId: "client-001",
        category: "EC",
        basis: "FAIS GCC s.2(1) — gross assets > R50m",
        validUntil: "2027-05-18",
        categorisedBy: "mira:cco",
        categorisedAt: NOW,
      },
    });
    expect(event.type).toBe("CounterpartyCategorised");
    validatePayload("CounterpartyCategorised", event.payload as Record<string, unknown>);
  });

  it("makeCounterpartyDeclined produces a valid event", () => {
    const event = makeCounterpartyDeclined({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: { partyId: "cand-retail", reason: "retail-client-declined", declinedAt: NOW },
    });
    expect(event.type).toBe("CounterpartyDeclined");
    validatePayload("CounterpartyDeclined", event.payload as Record<string, unknown>);
  });

  it("makeOdpCounterpartyCategorised produces a valid event (CS 2/2018 §4)", () => {
    const event = makeOdpCounterpartyCategorised({
      asOf: NOW,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: ["CS-2-2018-S4", "ORG-ODP-COND-002"],
      payload: {
        partyId: "cp-001",
        category: "counterparty",
        reason: 'CS 2/2018 §4(1)(a)–(c): regulated financial institution (entityType="bank")',
        electedUpCategorisation: false,
        asOf: NOW,
      },
    });
    expect(event.type).toBe("OdpCounterpartyCategorised");
    validatePayload("OdpCounterpartyCategorised", event.payload as Record<string, unknown>);
  });
});

// ---------------------------------------------------------------------------
// KYCRatingRevised schema invariant — mlro_sign_off_event_id required for upgrades
// ---------------------------------------------------------------------------

describe("KYCRatingRevised — mlro_sign_off_event_id invariant", () => {
  it("upgrade (low → high) WITHOUT mlro_sign_off_event_id → schema rejects", () => {
    expect(() =>
      kycRatingRevisedPayloadSchema.parse({
        clientId: "client-001",
        refreshId: "refresh-001",
        oldBand: "low",
        newBand: "high",
        // mlro_sign_off_event_id missing
        revisedAt: NOW,
      }),
    ).toThrow();
  });

  it("upgrade (medium → high) WITH mlro_sign_off_event_id → schema accepts", () => {
    expect(() =>
      kycRatingRevisedPayloadSchema.parse({
        clientId: "client-001",
        refreshId: "refresh-001",
        oldBand: "medium",
        newBand: "high",
        mlro_sign_off_event_id: "evt-mlro-001",
        revisedAt: NOW,
      }),
    ).not.toThrow();
  });

  it("downgrade (high → low) without mlro_sign_off_event_id → schema accepts", () => {
    expect(() =>
      kycRatingRevisedPayloadSchema.parse({
        clientId: "client-001",
        refreshId: "refresh-001",
        oldBand: "high",
        newBand: "low",
        revisedAt: NOW,
      }),
    ).not.toThrow();
  });

  it("same band (medium → medium) without mlro_sign_off_event_id → schema accepts", () => {
    expect(() =>
      kycRatingRevisedPayloadSchema.parse({
        clientId: "client-001",
        refreshId: "refresh-001",
        oldBand: "medium",
        newBand: "medium",
        revisedAt: NOW,
      }),
    ).not.toThrow();
  });
});
