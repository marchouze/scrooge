// platform/projections/kyc/kyc-candidate-projection.test.ts
//
// Unit tests for the KYC candidate projection.
//
// Test philosophy:
//   - Every test folds events through the pure `reduce` function directly
//     (no event store dependency; projection is stateless).
//   - Idempotency tests re-fold the same event sequence twice and assert
//     identical output.
//   - Terminal-state tests assert that further events cannot corrupt
//     accepted/rejected candidates.
//
// Authority: D-LIFECYCLE-SLICE-2; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
// Author: Anya (Data / analytics engineer, engineering)

import { describe, expect, test } from "bun:test";
import type { Event } from "@platform/event-store/types";
import { kycCandidateProjection } from "./kyc-candidate-projection";
import type { KycCandidateProjectionState } from "./types";

// ---------------------------------------------------------------------------
// Helpers — lightweight event builders. These produce the minimum valid
// Event shape accepted by the projection; they do NOT call the real event
// store so there is no I/O in this file.
// ---------------------------------------------------------------------------

let seq = 0;
function makeEvent(type: string, payload: Record<string, unknown>): Event {
  return {
    event_id: `evt-test-${++seq}`,
    type,
    as_of: new Date(1_700_000_000_000 + seq * 1_000).toISOString(),
    entity: "BANK-ZA-001",
    actor: { type: "agent", id: "anya:test" },
    citations: ["AML-CFT-POLICY-V1"],
    payload,
  };
}

function fold(events: Event[]): KycCandidateProjectionState {
  return events.reduce<KycCandidateProjectionState>(
    (s, e) => (kycCandidateProjection.accepts(e) ? kycCandidateProjection.reduce(s, e) : s),
    kycCandidateProjection.initial,
  );
}

// ---------------------------------------------------------------------------
// Core lifecycle tests
// ---------------------------------------------------------------------------

describe("kycCandidateProjection — lifecycle", () => {
  test("ClientCandidateRegistered → status = pending", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", {
        candidateId: "cand-001",
        entityType: "natural-person",
      }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-001");
    expect(candidate).toBeDefined();
    expect(candidate?.status).toBe("pending");
    expect(candidate?.entityType).toBe("natural-person");
    expect(candidate?.registeredAt).toBeDefined();
  });

  test("SanctionsClearancePassed after registration → status = screening", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-002" }),
      makeEvent("SanctionsClearancePassed", {
        candidateId: "cand-002",
        screeningProvider: "ComplyAdvantage",
        screeningRef: "ref-001",
        clearedAt: new Date().toISOString(),
        screenedBy: "zara:mlro",
      }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-002");
    expect(candidate?.status).toBe("screening");
    expect(candidate?.sanctionsClear).toBe(true);
  });

  test("PEPScreeningCompleted after registration → status = screening", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-003" }),
      makeEvent("PEPScreeningCompleted", {
        candidateId: "cand-003",
        isPep: true,
        pepTier: 1,
      }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-003");
    expect(candidate?.status).toBe("screening");
    expect(candidate?.pepStatus).toBe(true);
    expect(candidate?.pepTier).toBe(1);
  });

  test("BeneficialOwnerResolved after registration → status = screening", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-004" }),
      makeEvent("BeneficialOwnerResolved", {
        candidateId: "cand-004",
        beneficialOwners: [{ partyId: "party-1", ownershipPct: 100, controlBasis: "direct" }],
        resolvedAt: new Date().toISOString(),
        resolvedBy: "niko:lifecycle",
      }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-004");
    expect(candidate?.status).toBe("screening");
    expect(candidate?.uboResolved).toBe(true);
  });

  test("RiskRatingAssigned → status = risk-rating with rating fields", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-005" }),
      makeEvent("SanctionsClearancePassed", {
        candidateId: "cand-005",
        screeningProvider: "test",
        screeningRef: "r",
        clearedAt: new Date().toISOString(),
        screenedBy: "zara:mlro",
      }),
      makeEvent("RiskRatingAssigned", {
        candidateId: "cand-005",
        riskRating: "STANDARD",
        kycTier: "Tier-1",
      }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-005");
    expect(candidate?.status).toBe("risk-rating");
    expect(candidate?.riskRating).toBe("STANDARD");
    expect(candidate?.kycTier).toBe("Tier-1");
  });

  test("EddInitiated → status = edd-pending", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-006" }),
      makeEvent("PEPScreeningCompleted", { candidateId: "cand-006", isPep: true, pepTier: 2 }),
      makeEvent("RiskRatingAssigned", { candidateId: "cand-006", riskRating: "PEP" }),
      makeEvent("EddInitiated", {
        candidateId: "cand-006",
        deadlineIso: "2026-06-01T00:00:00.000Z",
      }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-006");
    expect(candidate?.status).toBe("edd-pending");
    expect(candidate?.eddDeadlineIso).toBe("2026-06-01T00:00:00.000Z");
  });

  test("EddCompleted → status back to risk-rating with eddOutcome", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-007" }),
      makeEvent("SanctionsClearancePassed", {
        candidateId: "cand-007",
        screeningProvider: "test",
        screeningRef: "r",
        clearedAt: new Date().toISOString(),
        screenedBy: "zara:mlro",
      }),
      makeEvent("RiskRatingAssigned", { candidateId: "cand-007", riskRating: "HIGH" }),
      makeEvent("EddInitiated", { candidateId: "cand-007", deadlineIso: "2026-06-01T00:00:00.000Z" }),
      makeEvent("EddCompleted", { candidateId: "cand-007", outcome: "PROCEED" }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-007");
    expect(candidate?.status).toBe("risk-rating");
    expect(candidate?.eddOutcome).toBe("PROCEED");
  });

  test("ClientAccepted → status = accepted with acceptedAt", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-008" }),
      makeEvent("SanctionsClearancePassed", {
        candidateId: "cand-008",
        screeningProvider: "test",
        screeningRef: "r",
        clearedAt: new Date().toISOString(),
        screenedBy: "zara:mlro",
      }),
      makeEvent("RiskRatingAssigned", { candidateId: "cand-008", riskRating: "STANDARD" }),
      makeEvent("ClientAccepted", { candidateId: "cand-008" }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-008");
    expect(candidate?.status).toBe("accepted");
    expect(candidate?.acceptedAt).toBeDefined();
  });

  test("ClientRejected → status = rejected with reasonCode + rejectedAt", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-009" }),
      makeEvent("SanctionsClearancePassed", {
        candidateId: "cand-009",
        screeningProvider: "test",
        screeningRef: "r",
        clearedAt: new Date().toISOString(),
        screenedBy: "zara:mlro",
      }),
      makeEvent("ClientRejected", {
        candidateId: "cand-009",
        reasonCode: "SANCTIONS_HIT",
      }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-009");
    expect(candidate?.status).toBe("rejected");
    expect(candidate?.rejectionReasonCode).toBe("SANCTIONS_HIT");
    expect(candidate?.rejectedAt).toBeDefined();
  });

  test("ClientRejected without prior screening (fast-fail path)", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-010" }),
      makeEvent("ClientRejected", { candidateId: "cand-010", reasonCode: "PROHIBITED_JURISDICTION" }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-010");
    expect(candidate?.status).toBe("rejected");
  });

  test("KycCompleted (legacy backwards-compat) → accepted with tier + sanctions fields", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-legacy" }),
      makeEvent("KycCompleted", {
        counterpartyId: "cand-legacy",
        tier: "Tier-2",
        pep: false,
        sanctionsClear: true,
        jurisdictionalRiskScore: "low",
        reviewerId: "party:reviewer-001",
      }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-legacy");
    expect(candidate?.status).toBe("accepted");
    expect(candidate?.kycTier).toBe("Tier-2");
    expect(candidate?.sanctionsClear).toBe(true);
    expect(candidate?.pepStatus).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Idempotency tests
// ---------------------------------------------------------------------------

describe("kycCandidateProjection — idempotency", () => {
  test("folding the same registration event twice yields identical state", () => {
    const registrationEvent = makeEvent("ClientCandidateRegistered", {
      candidateId: "cand-idem-001",
      entityType: "legal-entity",
    });
    // Fold once
    const state1 = fold([registrationEvent]);
    // Fold again (same event re-processed)
    const state2 = fold([registrationEvent, registrationEvent]);

    const c1 = state1.get("cand-idem-001");
    const c2 = state2.get("cand-idem-001");
    expect(c2?.status).toBe(c1?.status);
    expect(c2?.entityType).toBe(c1?.entityType);
    expect(c2?.registeredAt).toBe(c1?.registeredAt);
  });

  test("folding same full lifecycle twice produces accepted on second pass too", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-idem-002" }),
      makeEvent("SanctionsClearancePassed", {
        candidateId: "cand-idem-002",
        screeningProvider: "test",
        screeningRef: "r",
        clearedAt: new Date().toISOString(),
        screenedBy: "zara:mlro",
      }),
      makeEvent("RiskRatingAssigned", { candidateId: "cand-idem-002", riskRating: "STANDARD" }),
      makeEvent("ClientAccepted", { candidateId: "cand-idem-002" }),
    ];
    const state1 = fold(events);
    const state2 = fold([...events, ...events]); // replay the same events twice

    expect(state2.get("cand-idem-002")?.status).toBe("accepted");
    expect(state2.get("cand-idem-002")?.acceptedAt).toBe(
      state1.get("cand-idem-002")?.acceptedAt,
    );
  });

  test("events after ClientAccepted do not change terminal state", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-term-001" }),
      makeEvent("ClientAccepted", { candidateId: "cand-term-001" }),
      // Events that arrive after acceptance must be dropped.
      makeEvent("SanctionsClearancePassed", {
        candidateId: "cand-term-001",
        screeningProvider: "test",
        screeningRef: "r",
        clearedAt: new Date().toISOString(),
        screenedBy: "zara:mlro",
      }),
      makeEvent("RiskRatingAssigned", { candidateId: "cand-term-001", riskRating: "PROHIBITED" }),
      makeEvent("ClientRejected", { candidateId: "cand-term-001", reasonCode: "LATE_REJECT" }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-term-001");
    expect(candidate?.status).toBe("accepted"); // first ClientAccepted wins
    expect(candidate?.rejectionReasonCode).toBeUndefined();
  });

  test("events after ClientRejected do not change terminal state", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-term-002" }),
      makeEvent("ClientRejected", { candidateId: "cand-term-002", reasonCode: "SANCTIONS_HIT" }),
      // These must all be dropped.
      makeEvent("SanctionsClearancePassed", {
        candidateId: "cand-term-002",
        screeningProvider: "test",
        screeningRef: "r",
        clearedAt: new Date().toISOString(),
        screenedBy: "zara:mlro",
      }),
      makeEvent("ClientAccepted", { candidateId: "cand-term-002" }),
    ];
    const state = fold(events);
    const candidate = state.get("cand-term-002");
    expect(candidate?.status).toBe("rejected"); // first ClientRejected wins
    expect(candidate?.acceptedAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Multi-candidate isolation tests
// ---------------------------------------------------------------------------

describe("kycCandidateProjection — multi-candidate isolation", () => {
  test("events for different candidates do not cross-contaminate", () => {
    const events = [
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-A" }),
      makeEvent("ClientCandidateRegistered", { candidateId: "cand-B" }),
      makeEvent("ClientAccepted", { candidateId: "cand-A" }),
      makeEvent("ClientRejected", { candidateId: "cand-B", reasonCode: "PEP_TIER_1_POLICY" }),
    ];
    const state = fold(events);
    expect(state.get("cand-A")?.status).toBe("accepted");
    expect(state.get("cand-B")?.status).toBe("rejected");
    expect(state.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// accepts() predicate tests
// ---------------------------------------------------------------------------

describe("kycCandidateProjection — accepts predicate", () => {
  test("accepts all KYC event types", () => {
    const types = [
      "ClientCandidateRegistered",
      "SanctionsClearancePassed",
      "PEPScreeningCompleted",
      "BeneficialOwnerResolved",
      "PopiaConsentRecorded",
      "RiskRatingAssigned",
      "EddInitiated",
      "EddCompleted",
      "ClientAccepted",
      "ClientRejected",
      "KycCompleted",
    ];
    for (const type of types) {
      const e = makeEvent(type, { candidateId: "x" });
      expect(kycCandidateProjection.accepts(e)).toBe(true);
    }
  });

  test("rejects non-KYC event types", () => {
    const types = [
      "BankAccountOpened",
      "FxTradeExecuted",
      "CounterpartyActivated",
      "WorkstreamStarted",
      "CeoDecision",
    ];
    for (const type of types) {
      const e = makeEvent(type, {});
      expect(kycCandidateProjection.accepts(e)).toBe(false);
    }
  });
});
