// tests/kyc-projections.test.ts
//
// Tests for the KYC projections: clients and kyc-checks.
//
// Test philosophy:
//   - All folds are pure (no event store dependency).
//   - Invariant tests: `clients` projection — no row without ClientAccepted.
//   - Terminal state idempotency: duplicate ClientAccepted is dropped.
//   - KYC checks projection: per-candidate check status tracking.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import type { Event } from "@platform/event-store/types";
import { clientsProjection } from "../platform/projections/kyc/clients-projection";
import type { ClientsProjectionState } from "../platform/projections/kyc/clients-projection";
import { kycChecksProjection } from "../platform/projections/kyc/kyc-checks-projection";
import type { KYCChecksProjectionState } from "../platform/projections/kyc/kyc-checks-projection";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let seq = 0;

function makeEvent(type: string, payload: Record<string, unknown>): Event {
  return {
    event_id: `evt-kyc-test-${++seq}`,
    type,
    as_of: new Date(1_748_000_000_000 + seq * 1000).toISOString(),
    entity: "BANK-ZA-001",
    actor: { type: "service" as const, id: "kyc-gateway:test" },
    citations: ["D-KYC-ONBOARDING-BUILD", "AML-CFT-POLICY-V1"],
    payload,
  };
}

function foldClients(events: Event[]): ClientsProjectionState {
  return events.reduce<ClientsProjectionState>(
    (s, e) => (clientsProjection.accepts(e) ? clientsProjection.reduce(s, e) : s),
    clientsProjection.initial,
  );
}

function foldChecks(events: Event[]): KYCChecksProjectionState {
  return events.reduce<KYCChecksProjectionState>(
    (s, e) => (kycChecksProjection.accepts(e) ? kycChecksProjection.reduce(s, e) : s),
    kycChecksProjection.initial,
  );
}

// ---------------------------------------------------------------------------
// `clients` projection — invariant tests
// ---------------------------------------------------------------------------

describe("clientsProjection — INVARIANT: ClientAccepted is the only insert gate", () => {
  test("no client rows exist before any events", () => {
    expect(clientsProjection.initial.size).toBe(0);
  });

  test("KYCRefreshCompleted alone does NOT insert a row", () => {
    const events = [
      makeEvent("KYCRefreshCompleted", {
        clientId: "client-001",
        refreshId: "refresh-001",
        nextDueDate: "2027-01-01",
        completedAt: new Date().toISOString(),
      }),
    ];
    const state = foldClients(events);
    expect(state.size).toBe(0);
  });

  test("KYCRatingRevised alone does NOT insert a row", () => {
    const events = [
      makeEvent("KYCRatingRevised", {
        clientId: "client-001",
        refreshId: "refresh-001",
        oldBand: "low",
        newBand: "medium",
        revisedAt: new Date().toISOString(),
      }),
    ];
    const state = foldClients(events);
    expect(state.size).toBe(0);
  });

  test("CounterpartyCategorised alone does NOT insert a row", () => {
    const events = [
      makeEvent("CounterpartyCategorised", {
        partyId: "client-001",
        category: "EC",
        basis: "FAIS GCC s.2(1)",
        validUntil: "2027-01-01",
        categorisedBy: "mira:ccO",
        categorisedAt: new Date().toISOString(),
      }),
    ];
    const state = foldClients(events);
    expect(state.size).toBe(0);
  });

  test("ClientAccepted inserts exactly one row", () => {
    const events = [
      makeEvent("ClientAccepted", {
        candidateId: "cand-001",
        clientId: "client-001",
        entityName: "ACME HOLDINGS (PTY) LTD",
        entityType: "company",
        jurisdiction: "ZA",
        riskBand: "low",
        category: "EC",
        acceptedAt: new Date().toISOString(),
      }),
    ];
    const state = foldClients(events);
    expect(state.size).toBe(1);
    const client = state.get("client-001");
    expect(client).toBeDefined();
    expect(client?.entityName).toBe("ACME HOLDINGS (PTY) LTD");
    expect(client?.riskBand).toBe("low");
    expect(client?.category).toBe("EC");
  });

  test("duplicate ClientAccepted for same clientId is dropped (first-write-wins)", () => {
    const events = [
      makeEvent("ClientAccepted", {
        candidateId: "cand-001",
        clientId: "client-001",
        entityName: "FIRST ACCEPTANCE",
        entityType: "company",
        jurisdiction: "ZA",
        riskBand: "low",
        category: "EC",
        acceptedAt: new Date().toISOString(),
      }),
      makeEvent("ClientAccepted", {
        candidateId: "cand-001",
        clientId: "client-001",
        entityName: "SECOND ACCEPTANCE (should be dropped)",
        entityType: "company",
        jurisdiction: "ZA",
        riskBand: "high",
        category: "PC",
        acceptedAt: new Date().toISOString(),
      }),
    ];
    const state = foldClients(events);
    expect(state.size).toBe(1);
    const client = state.get("client-001");
    expect(client?.entityName).toBe("FIRST ACCEPTANCE");
    expect(client?.riskBand).toBe("low"); // first write wins
  });

  test("KYCRefreshCompleted updates nextRefreshDue for existing client", () => {
    const events = [
      makeEvent("ClientAccepted", {
        candidateId: "cand-001",
        clientId: "client-001",
        entityName: "REFRESH TEST CORP",
        entityType: "company",
        jurisdiction: "ZA",
        riskBand: "low",
        category: "EC",
        acceptedAt: new Date().toISOString(),
      }),
      makeEvent("KYCRefreshCompleted", {
        clientId: "client-001",
        refreshId: "refresh-001",
        nextDueDate: "2027-05-18",
        completedAt: new Date().toISOString(),
      }),
    ];
    const state = foldClients(events);
    const client = state.get("client-001");
    expect(client?.nextRefreshDue).toBe("2027-05-18");
  });

  test("KYCRatingRevised updates riskBand for existing client", () => {
    const events = [
      makeEvent("ClientAccepted", {
        candidateId: "cand-002",
        clientId: "client-002",
        entityName: "RATING TEST CORP",
        entityType: "company",
        jurisdiction: "ZA",
        riskBand: "low",
        category: "EC",
        acceptedAt: new Date().toISOString(),
      }),
      makeEvent("KYCRatingRevised", {
        clientId: "client-002",
        refreshId: "refresh-002",
        oldBand: "low",
        newBand: "medium",
        revisedAt: new Date().toISOString(),
      }),
    ];
    const state = foldClients(events);
    const client = state.get("client-002");
    expect(client?.riskBand).toBe("medium");
  });

  test("multiple clients accepted → multiple rows", () => {
    const events = [
      makeEvent("ClientAccepted", {
        candidateId: "cand-A",
        clientId: "client-A",
        entityName: "COMPANY A",
        entityType: "company",
        jurisdiction: "ZA",
        riskBand: "low",
        category: "EC",
        acceptedAt: new Date().toISOString(),
      }),
      makeEvent("ClientAccepted", {
        candidateId: "cand-B",
        clientId: "client-B",
        entityName: "COMPANY B",
        entityType: "trust",
        jurisdiction: "ZA",
        riskBand: "high",
        category: "PC",
        acceptedAt: new Date().toISOString(),
      }),
    ];
    const state = foldClients(events);
    expect(state.size).toBe(2);
    expect(state.get("client-A")?.entityType).toBe("company");
    expect(state.get("client-B")?.entityType).toBe("trust");
  });
});

// ---------------------------------------------------------------------------
// `kyc-checks` projection tests
// ---------------------------------------------------------------------------

describe("kycChecksProjection — per-candidate check tracking", () => {
  test("initial state is empty", () => {
    expect(kycChecksProjection.initial.size).toBe(0);
  });

  test("KYCIdentityVerified → identity-verification check passed", () => {
    const events = [
      makeEvent("KYCIdentityVerified", {
        candidateId: "cand-check-001",
        adapter: "dha",
        result: "matched",
        verifiedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    const candidate = state.get("cand-check-001");
    expect(candidate).toBeDefined();
    expect(candidate?.checks["identity-verification"]?.status).toBe("passed");
  });

  test("KYCIdentityVerificationFailed → identity-verification check failed", () => {
    const events = [
      makeEvent("KYCIdentityVerificationFailed", {
        candidateId: "cand-check-002",
        adapter: "dha",
        reason: "not-found",
        failedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    const candidate = state.get("cand-check-002");
    expect(candidate?.checks["identity-verification"]?.status).toBe("failed");
  });

  test("KYCSanctionsPEPScreened clean → sanctions-pep-screening passed", () => {
    const events = [
      makeEvent("KYCSanctionsPEPScreened", {
        candidateId: "cand-check-003",
        lists_checked: ["un", "ofac"],
        result: "clean",
        hits: [],
        pep_flag: false,
        pep_linked: false,
        screenedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    expect(state.get("cand-check-003")?.checks["sanctions-pep-screening"]?.status).toBe("passed");
  });

  test("KYCSanctionsPEPScreened hit → sanctions-pep-screening flagged", () => {
    const events = [
      makeEvent("KYCSanctionsPEPScreened", {
        candidateId: "cand-check-004",
        lists_checked: ["un", "ofac"],
        result: "hit",
        hits: [{ list: "un", name: "SANCTION ENTITY", score: 100 }],
        pep_flag: false,
        pep_linked: false,
        screenedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    expect(state.get("cand-check-004")?.checks["sanctions-pep-screening"]?.status).toBe("flagged");
  });

  test("KYCRiskRated high → risk-rating flagged", () => {
    const events = [
      makeEvent("KYCRiskRated", {
        candidateId: "cand-check-005",
        score: 80,
        band: "high",
        factors: [{ factor_name: "country_risk", weight: 0.4, value: 90 }],
        ratedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    expect(state.get("cand-check-005")?.checks["risk-rating"]?.status).toBe("flagged");
  });

  test("KYCRiskRated low → risk-rating passed", () => {
    const events = [
      makeEvent("KYCRiskRated", {
        candidateId: "cand-check-006",
        score: 20,
        band: "low",
        factors: [{ factor_name: "country_risk", weight: 0.4, value: 10 }],
        ratedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    expect(state.get("cand-check-006")?.checks["risk-rating"]?.status).toBe("passed");
  });

  test("KYCEDDInitiated → edd check pending", () => {
    const events = [
      makeEvent("KYCEDDInitiated", {
        candidateId: "cand-check-007",
        reason: "pep",
        initiatedBy: "zara:mlro",
        initiatedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    expect(state.get("cand-check-007")?.checks.edd?.status).toBe("pending");
  });

  test("KYCEDDCompleted proceed → edd check passed", () => {
    const events = [
      makeEvent("KYCEDDInitiated", {
        candidateId: "cand-check-008",
        reason: "pep",
        initiatedBy: "zara:mlro",
        initiatedAt: new Date().toISOString(),
      }),
      makeEvent("KYCEDDCompleted", {
        candidateId: "cand-check-008",
        mlro_sign_off_event_id: "evt-mlro-signoff-001",
        outcome: "proceed",
        completedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    expect(state.get("cand-check-008")?.checks.edd?.status).toBe("passed");
  });

  test("KYCEDDCompleted reject → edd check failed", () => {
    const events = [
      makeEvent("KYCEDDInitiated", {
        candidateId: "cand-check-009",
        reason: "complex-structure",
        initiatedBy: "zara:mlro",
        initiatedAt: new Date().toISOString(),
      }),
      makeEvent("KYCEDDCompleted", {
        candidateId: "cand-check-009",
        mlro_sign_off_event_id: "evt-mlro-signoff-002",
        outcome: "reject",
        completedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    expect(state.get("cand-check-009")?.checks.edd?.status).toBe("failed");
  });

  test("multiple check types accumulate on same candidate", () => {
    const candidateId = "cand-check-010";
    const events = [
      makeEvent("KYCIdentityVerified", {
        candidateId,
        adapter: "dha",
        result: "matched",
        verifiedAt: new Date().toISOString(),
      }),
      makeEvent("KYCSanctionsPEPScreened", {
        candidateId,
        lists_checked: ["un"],
        result: "clean",
        hits: [],
        pep_flag: false,
        pep_linked: false,
        screenedAt: new Date().toISOString(),
      }),
      makeEvent("KYCRiskRated", {
        candidateId,
        score: 25,
        band: "low",
        factors: [],
        ratedAt: new Date().toISOString(),
      }),
    ];
    const state = foldChecks(events);
    const candidate = state.get(candidateId);
    expect(candidate?.checks["identity-verification"]?.status).toBe("passed");
    expect(candidate?.checks["sanctions-pep-screening"]?.status).toBe("passed");
    expect(candidate?.checks["risk-rating"]?.status).toBe("passed");
  });
});
