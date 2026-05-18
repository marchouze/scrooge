// tests/kyc-orchestrator.test.ts
//
// Integration tests for the KYC Onboarding Orchestrator.
//
// Test philosophy:
//   - All tests run against simulate mode adapters (KYC_ADAPTER_MODE=simulate).
//   - The event store is the EventStore singleton from composition.ts, reset
//     between test suites by using per-scenario candidateIds (UUIDs).
//   - Tests verify both the CandidateState returned and the events emitted.
//   - Projection invariants are asserted (clients projection / kyc-checks).
//
// Scenarios tested:
//   1. clean → runFull → status=accepted; ClientAccepted event emitted
//   2. sanctions-exact → runFull → status=rejected; ClientRejected event emitted
//   3. pep-linked → runFull → status=referred (human gate); KYCEDDInitiated emitted;
//      then recordHumanDecision(accept) → status=accepted
//   4. clients projection contains accepted candidate; rejected NOT in clients
//   5. kyc-checks projection has all expected check entries for completed candidate
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { eventStore, projector } from "../platform/composition";
import type { Event } from "../platform/event-store/types";
import { KYCOrchestrator, type NewCandidateInput } from "../platform/kyc/orchestrator";
import { clientsProjection } from "../platform/projections/kyc/clients-projection";
import { kycChecksProjection } from "../platform/projections/kyc/kyc-checks-projection";

// ---------------------------------------------------------------------------
// Environment helpers — ensure simulate mode for all tests
// ---------------------------------------------------------------------------

let originalMode: string | undefined;

beforeEach(() => {
  originalMode = process.env.KYC_ADAPTER_MODE;
  process.env.KYC_ADAPTER_MODE = "simulate";
});

afterEach(() => {
  if (originalMode === undefined) {
    // biome-ignore lint/performance/noDelete: test cleanup
    delete process.env.KYC_ADAPTER_MODE;
  } else {
    process.env.KYC_ADAPTER_MODE = originalMode;
  }
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCleanInput(): NewCandidateInput {
  return {
    entityName: "Meridian Capital (Pty) Ltd",
    entityType: "company",
    registrationNumber: "2020-001234",
    jurisdiction: "ZA",
    registeredAddress: "100 Main Street, Johannesburg, 2001",
    directors: [{ name: "SMITH Thomas Andrew", idNumber: "8001015009087", role: "Director" }],
    ubos: [
      {
        name: "SMITH Thomas Andrew",
        idNumber: "8001015009087",
        nationality: "ZA",
        ownershipPct: 100,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: ["sha256:abc123clean0001"],
    submittedBy: "mira@bank.test",
  };
}

function makeSanctionsExactInput(): NewCandidateInput {
  return {
    entityName: "SANCTION Holdings Ltd",
    entityType: "company",
    registrationNumber: "2020-009900",
    jurisdiction: "ZA",
    registeredAddress: "999 Unknown Road, Cape Town, 8001",
    directors: [{ name: "UNKNOWN Entity", idNumber: "6001015026081", role: "Director" }],
    ubos: [
      {
        name: "UNKNOWN Entity",
        idNumber: "6001015026081",
        nationality: "ZA",
        ownershipPct: 100,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: ["sha256:abc123sanctionexact0001"],
    submittedBy: "mira@bank.test",
  };
}

function makePepLinkedInput(): NewCandidateInput {
  return {
    entityName: "Greenfield Asset Management (Pty) Ltd",
    entityType: "company",
    registrationNumber: "2020-005678",
    jurisdiction: "ZA",
    registeredAddress: "200 Sandton Drive, Sandton, 2196",
    directors: [{ name: "JONES Peter", idNumber: "7501015028083", role: "Managing Director" }],
    ubos: [
      {
        name: "LINKED Mokoena James",
        idNumber: "7501015028083",
        nationality: "ZA",
        ownershipPct: 60,
        basisOfControl: "direct-ownership",
      },
      {
        name: "JONES Peter",
        idNumber: "7501015028082",
        nationality: "ZA",
        ownershipPct: 40,
        basisOfControl: "direct-ownership",
      },
    ],
    documentHashes: ["sha256:abc123peplinked0001"],
    submittedBy: "mira@bank.test",
  };
}

/** Collect all events from the store for a given candidateId. */
function eventsForCandidate(candidateId: string): Event[] {
  const out: Event[] = [];
  // Collect clientId from ClientAccepted so we can track LawfulProcessingRegistered.
  let clientId: string | undefined;

  for (const e of eventStore.replay()) {
    const p = e.payload as Record<string, unknown>;
    if (p.candidateId === candidateId || p.counterpartyId === candidateId) {
      out.push(e);
      // Capture clientId for LawfulProcessingRegistered lookup.
      if (e.type === "ClientAccepted" && typeof p.clientId === "string") {
        clientId = p.clientId;
      }
    }
    // LawfulProcessingRegistered uses clientId, not candidateId.
    if (e.type === "LawfulProcessingRegistered" && clientId && p.clientId === clientId) {
      out.push(e);
    }
  }
  return out;
}

/** Check whether an event of a given type was emitted for a candidate. */
function hasEventType(candidateId: string, eventType: string): boolean {
  return eventsForCandidate(candidateId).some((e) => e.type === eventType);
}

// ---------------------------------------------------------------------------
// Test 1: clean scenario → auto-accept
// ---------------------------------------------------------------------------

describe("KYCOrchestrator — clean scenario", () => {
  test("runFull → status=accepted; ClientAccepted event emitted", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makeCleanInput());

    const state = await orchestrator.runFull(candidateId);

    expect(state.status).toBe("accepted");
    expect(state.currentStep).toBe("accepted");
    expect(state.requiresHuman).toBe(false);
    expect(hasEventType(candidateId, "ClientAccepted")).toBe(true);
    expect(hasEventType(candidateId, "ClientRejected")).toBe(false);
    expect(hasEventType(candidateId, "KYCDecisionMade")).toBe(true);
    expect(hasEventType(candidateId, "LawfulProcessingRegistered")).toBe(true);
  });

  test("runFull → KYCIdentityVerified + KYCSanctionsPEPScreened + KYCUBOResolved + KYCRiskRated all emitted", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makeCleanInput());
    await orchestrator.runFull(candidateId);

    expect(hasEventType(candidateId, "KYCIdentityCollected")).toBe(true);
    expect(hasEventType(candidateId, "KYCIdentityVerified")).toBe(true);
    expect(hasEventType(candidateId, "KYCSanctionsPEPScreened")).toBe(true);
    expect(hasEventType(candidateId, "KYCUBOResolved")).toBe(true);
    expect(hasEventType(candidateId, "KYCRiskRated")).toBe(true);
    // No EDD for low-risk clean candidate.
    expect(hasEventType(candidateId, "KYCEDDInitiated")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 2: sanctions-exact → auto-reject
// ---------------------------------------------------------------------------

describe("KYCOrchestrator — sanctions-exact scenario", () => {
  test("runFull → status=rejected; ClientRejected event emitted", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makeSanctionsExactInput());

    const state = await orchestrator.runFull(candidateId);

    expect(state.status).toBe("rejected");
    expect(state.requiresHuman).toBe(false);
    expect(hasEventType(candidateId, "ClientRejected")).toBe(true);
    expect(hasEventType(candidateId, "ClientAccepted")).toBe(false);
  });

  test("sanctions-exact → KYCSanctionsPEPScreened emitted with result=hit", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makeSanctionsExactInput());
    await orchestrator.runFull(candidateId);

    const screeningEvents = eventsForCandidate(candidateId).filter(
      (e) => e.type === "KYCSanctionsPEPScreened",
    );
    expect(screeningEvents.length).toBeGreaterThan(0);
    const p = (screeningEvents[0] as { payload: Record<string, unknown> }).payload;
    expect(p.result).toBe("hit");
    expect((p.hits as unknown[]).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: pep-linked → EDD → recordHumanDecision(accept)
// ---------------------------------------------------------------------------

describe("KYCOrchestrator — pep-linked scenario with EDD and human decision", () => {
  test("runFull → status=referred; KYCEDDInitiated emitted; then accept → status=accepted", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makePepLinkedInput());

    // Run all automated steps — should pause at EDD/human gate.
    const stateAfterAuto = await orchestrator.runFull(candidateId);

    expect(stateAfterAuto.requiresHuman).toBe(true);
    // pep_linked triggers high risk → KYCEDDInitiated → human gate.
    expect(hasEventType(candidateId, "KYCEDDInitiated")).toBe(true);
    // Status should be in-progress (waiting for EDD) or referred.
    expect(["in-progress", "referred"]).toContain(stateAfterAuto.status);

    // Now record the human decision (accept).
    const stateAfterDecision = await orchestrator.recordHumanDecision(
      candidateId,
      "accept",
      "zara@bank.test",
      "mock-mlro-sign-off-event-id",
    );

    expect(stateAfterDecision.status).toBe("accepted");
    expect(hasEventType(candidateId, "ClientAccepted")).toBe(true);
    expect(hasEventType(candidateId, "KYCEDDCompleted")).toBe(true);
    expect(hasEventType(candidateId, "KYCDecisionMade")).toBe(true);
  });

  test("pep-linked → reject path", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makePepLinkedInput());
    await orchestrator.runFull(candidateId);

    const stateAfterReject = await orchestrator.recordHumanDecision(
      candidateId,
      "reject",
      "zara@bank.test",
      "mock-mlro-sign-off-event-id",
    );

    expect(stateAfterReject.status).toBe("rejected");
    expect(hasEventType(candidateId, "ClientRejected")).toBe(true);
    expect(hasEventType(candidateId, "ClientAccepted")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 4: clients projection invariant
// ---------------------------------------------------------------------------

describe("clients projection invariant", () => {
  test("accepted candidate appears in clients projection; rejected candidate does NOT", async () => {
    const orchestrator = new KYCOrchestrator();

    // Onboard a clean (auto-accept) candidate.
    const { candidateId: acceptedId } = await orchestrator.startOnboarding(makeCleanInput());
    await orchestrator.runFull(acceptedId);

    // Onboard a sanctions-hit (auto-reject) candidate.
    const { candidateId: rejectedId } = await orchestrator.startOnboarding(
      makeSanctionsExactInput(),
    );
    await orchestrator.runFull(rejectedId);

    // Derive clients projection state.
    const clientsState = projector.build(clientsProjection);

    // Accepted candidate must be in the clients register.
    let acceptedInClients = false;
    for (const [, client] of clientsState) {
      // The clientId is a new UUID; match via event cross-reference.
      // Since ClientAccepted carries both clientId and candidateId in payload,
      // we verify at least one entry exists.
      if (client.entityName === "Meridian Capital (Pty) Ltd") {
        acceptedInClients = true;
        expect(client.riskBand).toBe("low");
        expect(client.category).toBe("PC");
      }
    }
    expect(acceptedInClients).toBe(true);

    // Rejected candidate must NOT create a client row.
    let rejectedInClients = false;
    for (const [, client] of clientsState) {
      if (client.entityName === "SANCTION Holdings Ltd") {
        rejectedInClients = true;
      }
    }
    expect(rejectedInClients).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 5: kyc-checks projection completeness
// ---------------------------------------------------------------------------

describe("kyc-checks projection", () => {
  test("clean candidate has identity-verification, sanctions-pep-screening, ubo-resolution, risk-rating checks", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makeCleanInput());
    await orchestrator.runFull(candidateId);

    const checksState = projector.build(kycChecksProjection);
    const candidateChecks = checksState.get(candidateId);

    expect(candidateChecks).toBeDefined();
    expect(candidateChecks?.checks["identity-verification"]).toBeDefined();
    expect(candidateChecks?.checks["identity-verification"]?.status).toBe("passed");
    expect(candidateChecks?.checks["sanctions-pep-screening"]).toBeDefined();
    expect(candidateChecks?.checks["sanctions-pep-screening"]?.status).toBe("passed");
    expect(candidateChecks?.checks["ubo-resolution"]).toBeDefined();
    expect(candidateChecks?.checks["risk-rating"]).toBeDefined();
    // No EDD for clean candidate.
    // biome-ignore lint/complexity/useLiteralKeys: KYCCheckType uses hyphenated keys requiring bracket notation
    expect(candidateChecks?.checks["edd"]).toBeUndefined();
  });

  test("pep-linked candidate has edd check after EDD initiated", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makePepLinkedInput());
    await orchestrator.runFull(candidateId);
    // Accept to complete the flow.
    await orchestrator.recordHumanDecision(
      candidateId,
      "accept",
      "zara@bank.test",
      "mock-mlro-sign-off-2",
    );

    const checksState = projector.build(kycChecksProjection);
    const candidateChecks = checksState.get(candidateId);

    expect(candidateChecks).toBeDefined();
    // EDD should be present after KYCEDDInitiated (and KYCEDDCompleted).
    // biome-ignore lint/complexity/useLiteralKeys: KYCCheckType uses hyphenated keys requiring bracket notation
    expect(candidateChecks?.checks["edd"]).toBeDefined();
    // biome-ignore lint/complexity/useLiteralKeys: KYCCheckType uses hyphenated keys requiring bracket notation
    expect(candidateChecks?.checks["edd"]?.status).toBe("passed"); // EDD completed with proceed
  });

  test("getCandidateState returns correct state without side effects", async () => {
    const orchestrator = new KYCOrchestrator();
    const { candidateId } = await orchestrator.startOnboarding(makeCleanInput());
    await orchestrator.runFull(candidateId);

    const state1 = await orchestrator.getCandidateState(candidateId);
    const state2 = await orchestrator.getCandidateState(candidateId);

    // Idempotent reads — state must not change.
    expect(state1.status).toBe(state2.status);
    expect(state1.currentStep).toBe(state2.currentStep);
    expect(state1.events.length).toBe(state2.events.length);
  });
});
