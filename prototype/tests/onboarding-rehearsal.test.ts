// tests/onboarding-rehearsal.test.ts
//
// Rehearsal scenario tests — runs the onboarding orchestrator over the
// synthetic event stream for the three counterparties defined in
// `scripts/rehearsal-onboarding-2026-05-12.ts`.
//
// Assertions:
//   TC-R1: Meridian Capital is `activated` (or further — monitoring)
//   TC-R2: Apex Trading is `cdd-initiated` (stalled)
//   TC-R3: Southern Cross is `kyc-refresh-due`
//
// These tests use in-memory event sequences (no real store). The Slice 2
// event types are exercised here to confirm the orchestrator folds them
// correctly; the forward-ported mappings in `onboarding-orchestrator.ts`
// (SLICE2_EVENT_TYPES + eventToPhaseCandidate additions) make this pass
// before Atlas's Slice 2 domain types land.
//
// Risk codes: RT-FC.ML, RT-FC.SA, RT-CR.CP, RT-OP.PR
// Authority: AML-CFT-POLICY-V1, TRADING-MANDATE-V1, D-PARTY-REGISTER,
//            FIC-ACT-38-2001, FAIS-ACT-37-2002
//
// Author: Niko (Client Lifecycle, sales)

import { describe, expect, it } from "bun:test";

import * as ctor from "@domains/customer/onboarding";
import type { MakeOpts } from "@domains/customer/onboarding";
import { DEFAULT_ENTITY, counterpartyId } from "@domains/customer/types";
import type { PartyId } from "@domains/party";
import { newEventId } from "@platform/core/types";
import type { Event } from "@platform/event-store/types";
import { derivePhaseFromEvents } from "@platform/lifecycle/onboarding-orchestrator";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ACTOR: MakeOpts["actor"] = { type: "service", id: "agent:niko:rehearsal-test" };
const CITATIONS: readonly string[] = [
  "AML-CFT-POLICY-V1",
  "TRADING-MANDATE-V1",
  "D-PARTY-REGISTER",
  "FIC-ACT-38-2001",
];

function opts(asOf: string): MakeOpts {
  return { actor: ACTOR, citations: CITATIONS, asOf };
}

const REVIEWER: PartyId = "urn:party:agent:niko-client-lifecycle";
const SIGNATORY_1: PartyId = "urn:party:natural-person:synthetic-signatory-001";
const SIGNATORY_2: PartyId = "urn:party:natural-person:synthetic-signatory-002";

const CP_MERIDIAN = counterpartyId("cp:synthetic:meridian-capital");
const CP_APEX = counterpartyId("cp:synthetic:apex-trading");
const CP_SOUTHERN = counterpartyId("cp:synthetic:southern-cross-am");

/** Build a raw Slice 2 event (not yet in CUSTOMER_EVENT_TYPES). */
function slice2Event(type: string, payload: Record<string, unknown>, asOf: string): Event {
  return {
    event_id: newEventId(),
    type,
    as_of: asOf,
    entity: DEFAULT_ENTITY,
    actor: ACTOR,
    citations: [...CITATIONS],
    payload,
  };
}

// ---------------------------------------------------------------------------
// Scenario A event stream — Meridian Capital, full 21-phase activation
// ---------------------------------------------------------------------------

function scenarioAEvents(): Event[] {
  const cp = CP_MERIDIAN;
  return [
    // Phase 1 — sounding
    ctor.soundingOpened(
      { counterpartyId: cp, channel: "introduction", introSource: "JSE" },
      opts("2026-03-01T09:00:00Z"),
    ),
    // Phase 2 — prospect-registered
    ctor.prospectRegistered(
      {
        counterpartyId: cp,
        legalName: "Meridian Capital (Pty) Ltd",
        jurisdiction: "ZA",
        sector: "Asset Management",
      },
      opts("2026-03-03T10:00:00Z"),
    ),
    // Phase 3 — fais-categorised [Slice 2]
    slice2Event(
      "CounterpartyFaisClassified",
      { counterpartyId: cp, faisCategory: "Professional Client" },
      "2026-03-05T11:00:00Z",
    ),
    // Phase 4 — cdd-initiated
    ctor.kycCompleted(
      {
        counterpartyId: cp,
        tier: "Tier-1",
        pep: false,
        sanctionsClear: true,
        jurisdictionalRiskScore: "low",
        reviewerId: REVIEWER,
      },
      opts("2026-03-08T14:00:00Z"),
    ),
    // Phase 5 — bo-resolved [Slice 2]
    slice2Event(
      "BeneficialOwnerResolved",
      { counterpartyId: cp, beneficialOwners: [{ ownershipPct: 60 }, { ownershipPct: 40 }] },
      "2026-03-10T10:00:00Z",
    ),
    // Phase 6 — sanctions-cleared [Slice 2]
    slice2Event(
      "SanctionsClearancePassed",
      { counterpartyId: cp, result: "clear" },
      "2026-03-11T09:00:00Z",
    ),
    // Phase 7 — fatca-crs-classified [Slice 2]
    slice2Event(
      "FatcaCrsClassified",
      { counterpartyId: cp, fatcaStatus: "non-us-person", crsResidency: "ZA" },
      "2026-03-12T11:00:00Z",
    ),
    // Phase 8 — popia-recorded [Slice 2]
    slice2Event(
      "PopiaConsentRecorded",
      { counterpartyId: cp, consentRef: "POPIA-MC-001" },
      "2026-03-13T09:00:00Z",
    ),
    // Phase 9 — eligibility-screened
    slice2Event(
      "CounterpartyEligibilityScreened",
      {
        counterpartyId: cp,
        screeningId: "CIE-MC-2026-001",
        criteria: ["FAIS-s45-institutional-investor"],
        outcome: "institutional-eligible",
        evidenceRefs: ["BOARD-CERT-MC-2026-001"],
        asOf: "2026-03-15T10:00:00Z",
      },
      "2026-03-15T10:00:00Z",
    ),
    // Phase 10 — credit-assessed [Slice 2]
    slice2Event(
      "CreditAssessmentCompleted",
      { counterpartyId: cp, creditGrade: "A", exposureLimitZar: 500_000_000 },
      "2026-03-20T14:00:00Z",
    ),
    // Phase 12 — documentation-drafted
    ctor.documentationDrafted(
      { counterpartyId: cp, agreementType: "ISDA", version: "2002-MA" },
      opts("2026-03-28T10:00:00Z"),
    ),
    // Phase 13 — documentation-ready
    ctor.documentationReadyToExecute(
      { counterpartyId: cp, agreementType: "ISDA", version: "2002-MA" },
      opts("2026-04-02T14:00:00Z"),
    ),
    // Phase 14 — signatories-registered
    ctor.authorisedSignatoryAdded(
      { counterpartyId: cp, personId: SIGNATORY_1, scope: "both", evidenceRef: "BOARD-RES-MC-001" },
      opts("2026-04-04T11:00:00Z"),
    ),
    ctor.authorisedSignatoryAdded(
      {
        counterpartyId: cp,
        personId: SIGNATORY_2,
        scope: "signatory",
        evidenceRef: "BOARD-RES-MC-002",
      },
      opts("2026-04-04T11:30:00Z"),
    ),
    // Phase 15 — mandate-assigned
    ctor.mandateAssigned(
      {
        counterpartyId: cp,
        products: ["IRS", "CCS"],
        limits: { notional: 500_000_000 },
        rasReference: "RAS-2026-MERIDIAN-001",
      },
      opts("2026-04-08T10:00:00Z"),
    ),
    // Phase 16 — accounts-setup [Slice 2]
    slice2Event(
      "AccountsSetupCompleted",
      { counterpartyId: cp, accountsCreated: [{ accountId: "ACC-MC-ZAR-001" }] },
      "2026-04-10T14:00:00Z",
    ),
    // Phase 17 — activated
    ctor.counterpartyActivated(
      { counterpartyId: cp, configSwitchEventId: "EVT-CONFIG-MC-001" },
      opts("2026-04-15T09:00:00Z"),
    ),
    // Phase 18 — monitoring [Slice 2]
    slice2Event(
      "CounterpartyMonitoringStarted",
      { counterpartyId: cp, monitoringProfile: "standard-institutional" },
      "2026-04-15T09:30:00Z",
    ),
  ];
}

// ---------------------------------------------------------------------------
// Scenario B event stream — Apex Trading, stalls at CDD
// ---------------------------------------------------------------------------

function scenarioBEvents(): Event[] {
  const cp = CP_APEX;
  return [
    // Phase 1 — sounding
    ctor.soundingOpened({ counterpartyId: cp, channel: "inbound" }, opts("2026-04-01T09:00:00Z")),
    // Phase 2 — prospect-registered
    ctor.prospectRegistered(
      {
        counterpartyId: cp,
        legalName: "Apex Trading Partners",
        jurisdiction: "ZA",
        sector: "Proprietary Trading",
      },
      opts("2026-04-02T10:00:00Z"),
    ),
    // Phase 4 — cdd-initiated (KYC completed — flags sanctions issue, stalls)
    ctor.kycCompleted(
      {
        counterpartyId: cp,
        tier: "Tier-2",
        pep: false,
        sanctionsClear: false, // ← stalls here
        jurisdictionalRiskScore: "high",
        reviewerId: REVIEWER,
      },
      opts("2026-04-03T14:00:00Z"),
    ),
    // No further events — stalled at cdd-initiated
  ];
}

// ---------------------------------------------------------------------------
// Scenario C event stream — Southern Cross, activated → kyc-refresh-due
// ---------------------------------------------------------------------------

function scenarioCEvents(): Event[] {
  const cp = CP_SOUTHERN;
  return [
    // Phase 1 — sounding
    ctor.soundingOpened({ counterpartyId: cp, channel: "outbound" }, opts("2026-03-05T09:00:00Z")),
    // Phase 2 — prospect-registered
    ctor.prospectRegistered(
      {
        counterpartyId: cp,
        legalName: "Southern Cross Asset Management",
        jurisdiction: "ZA",
        sector: "Asset Management",
      },
      opts("2026-03-07T10:00:00Z"),
    ),
    // Phase 3 — fais-categorised [Slice 2]
    slice2Event(
      "CounterpartyFaisClassified",
      { counterpartyId: cp, faisCategory: "Professional Client" },
      "2026-03-10T11:00:00Z",
    ),
    // Phase 4 — cdd-initiated
    ctor.kycCompleted(
      {
        counterpartyId: cp,
        tier: "Tier-1",
        pep: false,
        sanctionsClear: true,
        jurisdictionalRiskScore: "low",
        reviewerId: REVIEWER,
      },
      opts("2026-03-12T14:00:00Z"),
    ),
    // Phase 5 — bo-resolved [Slice 2]
    slice2Event(
      "BeneficialOwnerResolved",
      { counterpartyId: cp, beneficialOwners: [{ ownershipPct: 100 }] },
      "2026-03-14T10:00:00Z",
    ),
    // Phase 6 — sanctions-cleared [Slice 2]
    slice2Event(
      "SanctionsClearancePassed",
      { counterpartyId: cp, result: "clear" },
      "2026-03-15T09:00:00Z",
    ),
    // Phase 7 — fatca-crs-classified [Slice 2]
    slice2Event(
      "FatcaCrsClassified",
      { counterpartyId: cp, fatcaStatus: "non-us-person", crsResidency: "ZA" },
      "2026-03-16T11:00:00Z",
    ),
    // Phase 8 — popia-recorded [Slice 2]
    slice2Event(
      "PopiaConsentRecorded",
      { counterpartyId: cp, consentRef: "POPIA-SC-001" },
      "2026-03-17T09:00:00Z",
    ),
    // Phase 9 — eligibility-screened
    slice2Event(
      "CounterpartyEligibilityScreened",
      {
        counterpartyId: cp,
        screeningId: "CIE-SC-2026-001",
        criteria: ["FAIS-s45-institutional-investor"],
        outcome: "institutional-eligible",
        evidenceRefs: ["BOARD-CERT-SC-2026-001"],
        asOf: "2026-03-19T10:00:00Z",
      },
      "2026-03-19T10:00:00Z",
    ),
    // Phase 10 — credit-assessed [Slice 2]
    slice2Event(
      "CreditAssessmentCompleted",
      { counterpartyId: cp, creditGrade: "BBB", exposureLimitZar: 150_000_000 },
      "2026-03-22T14:00:00Z",
    ),
    // Phase 12 — documentation-drafted
    ctor.documentationDrafted(
      { counterpartyId: cp, agreementType: "GMRA", version: "2011-MA" },
      opts("2026-03-26T10:00:00Z"),
    ),
    // Phase 13 — documentation-ready
    ctor.documentationReadyToExecute(
      { counterpartyId: cp, agreementType: "GMRA", version: "2011-MA" },
      opts("2026-03-30T14:00:00Z"),
    ),
    // Phase 14 — signatories-registered
    ctor.authorisedSignatoryAdded(
      { counterpartyId: cp, personId: SIGNATORY_1, scope: "both", evidenceRef: "BOARD-RES-SC-001" },
      opts("2026-04-01T11:00:00Z"),
    ),
    // Phase 15 — mandate-assigned
    ctor.mandateAssigned(
      {
        counterpartyId: cp,
        products: ["GMRA-Repo", "ZAR-Bonds"],
        limits: { notional: 150_000_000 },
        rasReference: "RAS-2026-SOUTHERN-001",
      },
      opts("2026-04-05T10:00:00Z"),
    ),
    // Phase 16 — accounts-setup [Slice 2]
    slice2Event(
      "AccountsSetupCompleted",
      { counterpartyId: cp, accountsCreated: [{ accountId: "ACC-SC-ZAR-001" }] },
      "2026-04-08T14:00:00Z",
    ),
    // Phase 17 — activated
    ctor.counterpartyActivated(
      { counterpartyId: cp, configSwitchEventId: "EVT-CONFIG-SC-001" },
      opts("2026-04-10T09:00:00Z"),
    ),
    // Phase 18 — monitoring [Slice 2]
    slice2Event(
      "CounterpartyMonitoringStarted",
      { counterpartyId: cp, monitoringProfile: "standard-institutional" },
      "2026-04-10T09:30:00Z",
    ),
    // Phase 19 — kyc-refresh-due [Slice 2]
    slice2Event(
      "KycRefreshDue",
      { counterpartyId: cp, dueBy: "2026-06-10", triggerReason: "annual-cycle" },
      "2026-05-12T08:00:00Z",
    ),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Onboarding rehearsal scenarios", () => {
  it("TC-R1: Meridian Capital — full clean onboarding reaches activated or monitoring", () => {
    const allEvents = scenarioAEvents();
    const states = derivePhaseFromEvents(allEvents);

    const state = states.get(CP_MERIDIAN);
    if (state === undefined) throw new Error("Expected state for Meridian Capital");

    // Meridian should be at 'monitoring' (Phase 18, after activated)
    // Accept 'activated' or 'monitoring' — the rehearsal emits Phase 18.
    expect(["activated", "monitoring"]).toContain(state.phase);
    // 'activated' is terminal; 'monitoring' is post-activation forward-extension
    // and is NOT terminal per orchestrator design (renewal cycle can follow).
    if (state.phase === "activated") {
      expect(state.isTerminal).toBe(true);
    } else {
      // monitoring — history must contain activated as a prior milestone
      expect(state.history.map((h) => h.phase)).toContain("activated");
    }

    // Verify some key milestones are in the history
    const phases = state.history.map((h) => h.phase);
    expect(phases).toContain("sounding");
    expect(phases).toContain("prospect-registered");
    expect(phases).toContain("fais-categorised");
    expect(phases).toContain("cdd-initiated");
    expect(phases).toContain("bo-resolved");
    expect(phases).toContain("sanctions-cleared");
    expect(phases).toContain("fatca-crs-classified");
    expect(phases).toContain("popia-recorded");
    expect(phases).toContain("eligibility-screened");
    expect(phases).toContain("credit-assessed");
    expect(phases).toContain("documentation-drafted");
    expect(phases).toContain("documentation-ready");
    expect(phases).toContain("signatories-registered");
    expect(phases).toContain("mandate-assigned");
    expect(phases).toContain("accounts-setup");
    expect(phases).toContain("activated");
  });

  it("TC-R2: Apex Trading Partners — stalls at cdd-initiated", () => {
    const allEvents = scenarioBEvents();
    const states = derivePhaseFromEvents(allEvents);

    const state = states.get(CP_APEX);
    if (state === undefined) throw new Error("Expected state for Apex Trading");

    expect(state.phase).toBe("cdd-initiated");
    expect(state.isTerminal).toBe(false);

    // Verify the path to the stall
    const phases = state.history.map((h) => h.phase);
    expect(phases).toContain("sounding");
    expect(phases).toContain("prospect-registered");
    expect(phases).toContain("cdd-initiated");

    // Should NOT have advanced beyond cdd-initiated
    expect(phases).not.toContain("bo-resolved");
    expect(phases).not.toContain("activated");
  });

  it("TC-R3: Southern Cross Asset Management — activated then kyc-refresh-due", () => {
    const allEvents = scenarioCEvents();
    const states = derivePhaseFromEvents(allEvents);

    const state = states.get(CP_SOUTHERN);
    if (state === undefined) throw new Error("Expected state for Southern Cross");

    expect(state.phase).toBe("kyc-refresh-due");
    // kyc-refresh-due is not terminal — the renewal cycle continues
    expect(state.isTerminal).toBe(false);

    // Verify the path includes activation before the refresh
    const phases = state.history.map((h) => h.phase);
    expect(phases).toContain("activated");
    expect(phases).toContain("monitoring");
    expect(phases).toContain("kyc-refresh-due");

    // kyc-refresh-due must come after monitoring
    const monitoringIdx = phases.indexOf("monitoring");
    const refreshIdx = phases.lastIndexOf("kyc-refresh-due");
    expect(monitoringIdx).toBeGreaterThanOrEqual(0);
    expect(refreshIdx).toBeGreaterThan(monitoringIdx);
  });

  it("TC-R4: three independent counterparties fold without interference", () => {
    // All three scenarios in a single mixed event stream
    const allEvents = [...scenarioAEvents(), ...scenarioBEvents(), ...scenarioCEvents()];

    const states = derivePhaseFromEvents(allEvents);

    expect(states.size).toBe(3);

    const meridian = states.get(CP_MERIDIAN);
    const apex = states.get(CP_APEX);
    const southern = states.get(CP_SOUTHERN);

    if (!meridian || !apex || !southern) throw new Error("Expected all 3 counterparty states");

    // Each is independent
    expect(["activated", "monitoring"]).toContain(meridian.phase);
    expect(apex.phase).toBe("cdd-initiated");
    expect(southern.phase).toBe("kyc-refresh-due");
  });
});
