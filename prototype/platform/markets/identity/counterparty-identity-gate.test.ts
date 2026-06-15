// platform/markets/identity/counterparty-identity-gate.test.ts
//
// Enforcement tests for `checkCounterpartyIdentityOfRecord`.
//
// Verifies the CISO ratification condition 1: the gateway `identity` check
// genuinely enforces fail-closed (it is NOT an approve-always stub). Two
// invariants must hold simultaneously:
//
//   A) A counterparty with NO on-record events → REJECTED (fail-closed).
//   B) A counterparty with BOTH a party-of-record AND a KYC-acceptance → APPROVED
//      (not trivially fail-closed in a way that blocks everything).
//
// These two invariants are the exact conditions the infosec attestation script
// (npa-fx-infosec-attestation.ts, Rashida ratification condition 1) requires
// before the gateway `identity` check dimension can be considered live.
//
// Additional partial-record cases (party-of-record only / KYC-only) confirm the
// both-required posture.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   FIC Act 38/2001 s.21B/s.28A (CDD/sanctions); npa-fx-infosec-attestation.ts
//   ratification condition 1.
// Author: Rashida (Chief Information Security Officer, governance).

import { describe, expect, it } from "bun:test";

import { checkCounterpartyIdentityOfRecord } from "./counterparty-identity-gate";

// ---------------------------------------------------------------------------
// Minimal in-memory store stub — only needs `replay`.
// ---------------------------------------------------------------------------

type EventRow = {
  type: string;
  payload: Record<string, unknown>;
};

function makeStore(
  events: EventRow[],
): Pick<import("../../event-store/store").EventStore, "replay"> {
  return {
    replay(filter?: { type?: string }) {
      const rows = filter?.type ? events.filter((e) => e.type === filter.type) : events;
      return rows as unknown as ReturnType<import("../../event-store/store").EventStore["replay"]>;
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CTPY = "LEI-CTPY-TEST-001";

const PARTY_OF_RECORD: EventRow = {
  type: "CounterpartyEligibilityScreened",
  payload: { counterpartyId: CTPY },
};

const KYC_SANCTIONS: EventRow = {
  type: "SanctionsClearancePassed",
  payload: { counterpartyId: CTPY },
};

const KYC_CLIENT_ACCEPTED: EventRow = {
  type: "ClientAccepted",
  payload: { candidateId: CTPY },
};

// ---------------------------------------------------------------------------
// Invariant A — unknown counterparty is REJECTED (fail-closed, not approve-always)
// ---------------------------------------------------------------------------

describe("checkCounterpartyIdentityOfRecord — Invariant A (fail-closed for unknown)", () => {
  it("rejects a counterparty with no on-record events", () => {
    const store = makeStore([]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(false);
    expect(result.rejectionReason).toBeTruthy();
    expect(result.rejectionReason).toContain("not a KYC-accepted party of record");
  });

  it("rejects a counterparty whose only event is for a different counterparty", () => {
    const store = makeStore([
      { type: "CounterpartyEligibilityScreened", payload: { counterpartyId: "LEI-DIFFERENT" } },
      { type: "SanctionsClearancePassed", payload: { counterpartyId: "LEI-DIFFERENT" } },
    ]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(false);
    expect(result.rejectionReason).toContain("not a KYC-accepted party of record");
  });
});

// ---------------------------------------------------------------------------
// Invariant B — fully-onboarded counterparty is APPROVED (gate is not a
// trivial reject-all that blocks even valid counterparties)
// ---------------------------------------------------------------------------

describe("checkCounterpartyIdentityOfRecord — Invariant B (valid counterparty passes)", () => {
  it("approves a counterparty with CounterpartyEligibilityScreened + SanctionsClearancePassed", () => {
    const store = makeStore([PARTY_OF_RECORD, KYC_SANCTIONS]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(true);
    expect(result.partyOfRecordVia).toBe("CounterpartyEligibilityScreened");
    expect(result.kycAcceptedVia).toBe("SanctionsClearancePassed");
  });

  it("approves a counterparty with CounterpartyEligibilityScreened + ClientAccepted (candidateId)", () => {
    const store = makeStore([PARTY_OF_RECORD, KYC_CLIENT_ACCEPTED]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(true);
    expect(result.partyOfRecordVia).toBe("CounterpartyEligibilityScreened");
    expect(result.kycAcceptedVia).toBe("ClientAccepted");
  });

  it("approves when ClientAccepted matches on clientId field", () => {
    const store = makeStore([
      PARTY_OF_RECORD,
      { type: "ClientAccepted", payload: { clientId: CTPY } },
    ]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(true);
    expect(result.kycAcceptedVia).toBe("ClientAccepted");
  });

  it("approves when ClientAccepted matches on counterpartyId field", () => {
    const store = makeStore([
      PARTY_OF_RECORD,
      { type: "ClientAccepted", payload: { counterpartyId: CTPY } },
    ]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(true);
    expect(result.kycAcceptedVia).toBe("ClientAccepted");
  });
});

// ---------------------------------------------------------------------------
// Partial record cases — both conditions required
// ---------------------------------------------------------------------------

describe("checkCounterpartyIdentityOfRecord — partial record (both conditions required)", () => {
  it("rejects party-of-record with no KYC acceptance", () => {
    const store = makeStore([PARTY_OF_RECORD]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(false);
    expect(result.rejectionReason).toContain("party of record but has NO KYC acceptance");
  });

  it("rejects KYC acceptance with no party-of-record anchor", () => {
    const store = makeStore([KYC_SANCTIONS]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(false);
    expect(result.rejectionReason).toContain("KYC acceptance but is NOT a party of");
  });

  it("SanctionsClearancePassed for different counterparty does not count as KYC", () => {
    const store = makeStore([
      PARTY_OF_RECORD,
      { type: "SanctionsClearancePassed", payload: { counterpartyId: "LEI-OTHER" } },
    ]);
    const result = checkCounterpartyIdentityOfRecord(store, CTPY);
    expect(result.ok).toBe(false);
    expect(result.rejectionReason).toContain("NO KYC acceptance");
  });
});
