// platform/lifecycle/onboarding-orchestrator.test.ts
//
// Unit tests for the Slice 1 onboarding orchestrator.
//
// Uses synthetic events ONLY — no reads from the event store. The core fold
// function `derivePhaseFromEvents()` is tested directly with hand-built Event
// objects; `buildOnboardingBoardView()` is tested against a minimal store stub
// whose `replay()` returns a fixed event sequence.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import type { MakeOpts } from "@domains/customer/onboarding";
import * as ctor from "@domains/customer/onboarding";
import { counterpartyId } from "@domains/customer/types";
import type { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import { buildOnboardingBoardView, derivePhaseFromEvents } from "./onboarding-orchestrator";

// ---------------------------------------------------------------------------
// Slice 2 imports
// ---------------------------------------------------------------------------

import {
  accountsSetupCompleted,
  beneficialOwnerResolved,
  counterpartyFaisClassified,
  creditAssessmentCompleted,
  fatcaCrsClassified,
  popiaConsentRecorded,
  sanctionsClearancePassed,
} from "@domains/customer/onboarding";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const ACTOR: MakeOpts["actor"] = { type: "service", id: "agent:atlas:onboarding-test" };
const CITATIONS: readonly string[] = ["AML-CFT-POLICY-V1", "D-PARTY-REGISTER"];

function opts(asOf?: string): MakeOpts {
  return { actor: ACTOR, citations: CITATIONS, ...(asOf ? { asOf } : {}) };
}

const CP1 = counterpartyId("CP-TEST-001");
const CP2 = counterpartyId("CP-TEST-002");
const CP3 = counterpartyId("CP-TEST-003");

// Reviewer/person Party URNs for typed payloads.
const REVIEWER_ID = "urn:party:natural-person:prs-reviewer-001" as Parameters<
  typeof ctor.kycCompleted
>[0]["reviewerId"];
const PERSON_ID = "urn:party:natural-person:prs-signatory-001" as Parameters<
  typeof ctor.authorisedSignatoryAdded
>[0]["personId"];

/**
 * Build a minimal store stub that replays a fixed event sequence. Satisfies
 * `Pick<EventStore, "replay">` so the orchestrator's typed boundary is
 * honoured without importing the real EventStore (which would pull in
 * SQLite and the composition root).
 */
function storeStub(events: readonly Event[]): Pick<EventStore, "replay"> {
  return {
    replay(): Generator<Event> {
      return (function* () {
        for (const ev of events) yield ev;
      })();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("derivePhaseFromEvents()", () => {
  it("TC-1: only SoundingOpened → phase is 'sounding'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-11T08:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("sounding");
    expect(state.isTerminal).toBe(false);
    expect(state.eventCount).toBe(1);
    expect(state.history).toHaveLength(1);
    const firstEntry = state.history[0];
    if (firstEntry === undefined) throw new Error("Expected history entry");
    expect(firstEntry.phase).toBe("sounding");
  });

  it("TC-2: SoundingOpened → ProspectRegistered → phase is 'prospect-registered'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-11T08:00:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP1,
          legalName: "Acme Capital (Pty) Ltd",
          jurisdiction: "ZA",
          sector: "Asset Management",
        },
        opts("2026-05-11T08:01:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("prospect-registered");
    expect(state.eventCount).toBe(2);
  });

  it("TC-3: full happy path → phase is 'activated', isTerminal is true", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-11T08:00:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP1,
          legalName: "Acme Capital (Pty) Ltd",
          jurisdiction: "ZA",
          sector: "Asset Management",
        },
        opts("2026-05-11T08:01:00Z"),
      ),
      ctor.kycCompleted(
        {
          counterpartyId: CP1,
          tier: "Tier-1",
          pep: false,
          sanctionsClear: true,
          jurisdictionalRiskScore: "low",
          reviewerId: REVIEWER_ID,
        },
        opts("2026-05-11T09:00:00Z"),
      ),
      ctor.documentationDrafted(
        { counterpartyId: CP1, agreementType: "ISDA", version: "2002-MA" },
        opts("2026-05-11T10:00:00Z"),
      ),
      ctor.documentationReadyToExecute(
        { counterpartyId: CP1, agreementType: "ISDA", version: "2002-MA" },
        opts("2026-05-11T10:30:00Z"),
      ),
      ctor.authorisedSignatoryAdded(
        {
          counterpartyId: CP1,
          personId: PERSON_ID,
          scope: "signatory",
          evidenceRef: "BOARD-RESOLUTION-2026-001",
        },
        opts("2026-05-11T11:00:00Z"),
      ),
      ctor.mandateAssigned(
        {
          counterpartyId: CP1,
          products: ["IRS", "CCS"],
          limits: { notional: 500_000_000 },
          rasReference: "RAS-2026-CP1",
        },
        opts("2026-05-11T11:30:00Z"),
      ),
      ctor.counterpartyActivated(
        { counterpartyId: CP1, configSwitchEventId: "EVT-CONFIG-001" },
        opts("2026-05-11T12:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("activated");
    expect(state.isTerminal).toBe(true);
    expect(state.eventCount).toBe(8);
    // History must contain all phase advances (sounding, prospect-registered,
    // cdd-initiated, documentation-drafted, documentation-ready,
    // signatories-registered, mandate-assigned, activated).
    expect(state.history.length).toBeGreaterThanOrEqual(8);
    expect(state.history.at(-1)?.phase).toBe("activated");
  });

  it("TC-4: CounterpartyOffboarded → phase is 'offboarded', isTerminal true", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP2, channel: "outbound" },
        opts("2026-05-11T08:00:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP2,
          legalName: "Risk Corp Ltd",
          jurisdiction: "ZA",
          sector: "Insurance",
        },
        opts("2026-05-11T08:30:00Z"),
      ),
      ctor.counterpartyOffboarded(
        { counterpartyId: CP2, reason: "Sanctions match confirmed." },
        opts("2026-05-11T09:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP2);
    if (state === undefined) throw new Error("Expected state for CP2");
    expect(state.phase).toBe("offboarded");
    expect(state.isTerminal).toBe(true);
  });

  it("TC-5: MandateRevoked after MandateAssigned regresses phase to 'mandate-scoped'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-11T08:00:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP1,
          legalName: "Acme Capital (Pty) Ltd",
          jurisdiction: "ZA",
          sector: "Asset Management",
        },
        opts("2026-05-11T08:01:00Z"),
      ),
      ctor.kycCompleted(
        {
          counterpartyId: CP1,
          tier: "Tier-1",
          pep: false,
          sanctionsClear: true,
          jurisdictionalRiskScore: "low",
          reviewerId: REVIEWER_ID,
        },
        opts("2026-05-11T09:00:00Z"),
      ),
      ctor.mandateAssigned(
        {
          counterpartyId: CP1,
          products: ["IRS"],
          limits: { notional: 100_000_000 },
          rasReference: "RAS-2026-CP1",
        },
        opts("2026-05-11T09:30:00Z"),
      ),
      ctor.mandateRevoked(
        {
          counterpartyId: CP1,
          reason: "Limit breach — mandate revoked pending review.",
        },
        opts("2026-05-11T10:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("mandate-scoped");
    expect(state.isTerminal).toBe(false);
    // History should include both mandate-assigned and the regression.
    const phaseNames = state.history.map((h) => h.phase);
    expect(phaseNames).toContain("mandate-assigned");
    expect(phaseNames.at(-1)).toBe("mandate-scoped");
  });

  it("TC-6: multiple counterparties fold independently", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-11T08:00:00Z"),
      ),
      ctor.soundingOpened(
        { counterpartyId: CP2, channel: "outbound" },
        opts("2026-05-11T08:01:00Z"),
      ),
      ctor.soundingOpened(
        { counterpartyId: CP3, channel: "introduction", introSource: "JSE" },
        opts("2026-05-11T08:02:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP1,
          legalName: "Acme Capital (Pty) Ltd",
          jurisdiction: "ZA",
          sector: "Asset Management",
        },
        opts("2026-05-11T08:05:00Z"),
      ),
      ctor.kycCompleted(
        {
          counterpartyId: CP2,
          tier: "Tier-2",
          pep: false,
          sanctionsClear: true,
          jurisdictionalRiskScore: "medium",
          reviewerId: REVIEWER_ID,
        },
        opts("2026-05-11T08:10:00Z"),
      ),
      ctor.counterpartyOffboarded(
        { counterpartyId: CP3, reason: "Client withdrew interest." },
        opts("2026-05-11T08:15:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);

    const s1 = result.get(CP1);
    const s2 = result.get(CP2);
    const s3 = result.get(CP3);
    if (s1 === undefined || s2 === undefined || s3 === undefined) {
      throw new Error("Expected states for all counterparties");
    }

    expect(s1.phase).toBe("prospect-registered");
    expect(s2.phase).toBe("cdd-initiated");
    expect(s3.phase).toBe("offboarded");

    // Each counterparty is independent.
    expect(s1.counterpartyId).toBe(CP1);
    expect(s2.counterpartyId).toBe(CP2);
    expect(s3.counterpartyId).toBe(CP3);
  });
});

// ---------------------------------------------------------------------------
// Slice 2 — 7 new phase transition tests
// ---------------------------------------------------------------------------

describe("Slice 2 — new phase event types", () => {
  it("TC-S2-1: CounterpartyFaisClassified → phase is 'fais-categorised'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-12T08:00:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP1,
          legalName: "Acme Capital (Pty) Ltd",
          jurisdiction: "ZA",
          sector: "Asset Management",
        },
        opts("2026-05-12T08:01:00Z"),
      ),
      counterpartyFaisClassified(
        {
          counterpartyId: CP1,
          faisCategory: "professional-client",
          classifiedAt: "2026-05-12T08:05:00Z",
          classifiedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T08:05:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("fais-categorised");
    expect(state.eventCount).toBe(3);
    expect(state.history.at(-1)?.phase).toBe("fais-categorised");
  });

  it("TC-S2-2: BeneficialOwnerResolved → phase is 'bo-resolved'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-12T08:00:00Z"),
      ),
      ctor.kycCompleted(
        {
          counterpartyId: CP1,
          tier: "Tier-1",
          pep: false,
          sanctionsClear: true,
          jurisdictionalRiskScore: "low",
          reviewerId: REVIEWER_ID,
        },
        opts("2026-05-12T09:00:00Z"),
      ),
      beneficialOwnerResolved(
        {
          counterpartyId: CP1,
          beneficialOwners: [
            {
              partyId: "urn:party:natural-person:prs-001",
              ownershipPct: 51,
              controlBasis: "equity",
            },
          ],
          resolvedAt: "2026-05-12T09:30:00Z",
          resolvedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T09:30:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("bo-resolved");
  });

  it("TC-S2-3: SanctionsClearancePassed → phase is 'sanctions-cleared'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-12T08:00:00Z"),
      ),
      beneficialOwnerResolved(
        {
          counterpartyId: CP1,
          beneficialOwners: [
            {
              partyId: "urn:party:natural-person:prs-001",
              ownershipPct: 100,
              controlBasis: "equity",
            },
          ],
          resolvedAt: "2026-05-12T08:30:00Z",
          resolvedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T08:30:00Z"),
      ),
      sanctionsClearancePassed(
        {
          counterpartyId: CP1,
          screeningProvider: "WorldCheck",
          screeningRef: "WC-2026-001",
          clearedAt: "2026-05-12T09:00:00Z",
          screenedBy: "agent:zara:mlro-supervision",
        },
        opts("2026-05-12T09:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("sanctions-cleared");
  });

  it("TC-S2-4: FatcaCrsClassified → phase is 'fatca-crs-classified'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-12T08:00:00Z"),
      ),
      sanctionsClearancePassed(
        {
          counterpartyId: CP1,
          screeningProvider: "WorldCheck",
          screeningRef: "WC-2026-002",
          clearedAt: "2026-05-12T08:30:00Z",
          screenedBy: "agent:zara:mlro-supervision",
        },
        opts("2026-05-12T08:30:00Z"),
      ),
      fatcaCrsClassified(
        {
          counterpartyId: CP1,
          fatcaStatus: "non-us-person",
          crsResidency: "ZA",
          classifiedAt: "2026-05-12T09:00:00Z",
          classifiedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T09:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("fatca-crs-classified");
  });

  it("TC-S2-5: PopiaConsentRecorded → phase is 'popia-recorded'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-12T08:00:00Z"),
      ),
      fatcaCrsClassified(
        {
          counterpartyId: CP1,
          fatcaStatus: "non-us-person",
          crsResidency: "ZA",
          classifiedAt: "2026-05-12T08:30:00Z",
          classifiedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T08:30:00Z"),
      ),
      popiaConsentRecorded(
        {
          counterpartyId: CP1,
          consentScope: ["credit-assessment", "market-data-sharing"],
          recordedAt: "2026-05-12T09:00:00Z",
          recordedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T09:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("popia-recorded");
  });

  it("TC-S2-6: CreditAssessmentCompleted → phase is 'credit-assessed'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-12T08:00:00Z"),
      ),
      popiaConsentRecorded(
        {
          counterpartyId: CP1,
          consentScope: ["credit-assessment"],
          recordedAt: "2026-05-12T08:30:00Z",
          recordedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T08:30:00Z"),
      ),
      creditAssessmentCompleted(
        {
          counterpartyId: CP1,
          creditGrade: "A",
          exposureLimitZar: 500_000_000_00, // R500m in cents
          assessedAt: "2026-05-12T09:00:00Z",
          assessedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T09:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("credit-assessed");
  });

  it("TC-S2-7: AccountsSetupCompleted → phase is 'accounts-setup'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-12T08:00:00Z"),
      ),
      ctor.mandateAssigned(
        {
          counterpartyId: CP1,
          products: ["IRS"],
          limits: { notional: 100_000_000 },
          rasReference: "RAS-2026-CP1",
        },
        opts("2026-05-12T08:30:00Z"),
      ),
      accountsSetupCompleted(
        {
          counterpartyId: CP1,
          accounts: [
            { accountId: "ACC-CP1-ZAR-001", currency: "ZAR", accountType: "settlement" },
            { accountId: "ACC-CP1-USD-001", currency: "USD", accountType: "nostro" },
          ],
          setupAt: "2026-05-12T09:00:00Z",
          setupBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T09:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("accounts-setup");
  });

  it("TC-S2-8: full 21-phase happy path including all Slice 2 events → phase is 'activated'", () => {
    const events: Event[] = [
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-12T08:00:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP1,
          legalName: "Acme Capital (Pty) Ltd",
          jurisdiction: "ZA",
          sector: "Asset Management",
        },
        opts("2026-05-12T08:01:00Z"),
      ),
      counterpartyFaisClassified(
        {
          counterpartyId: CP1,
          faisCategory: "professional-client",
          classifiedAt: "2026-05-12T08:05:00Z",
          classifiedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T08:05:00Z"),
      ),
      ctor.kycCompleted(
        {
          counterpartyId: CP1,
          tier: "Tier-1",
          pep: false,
          sanctionsClear: true,
          jurisdictionalRiskScore: "low",
          reviewerId: REVIEWER_ID,
        },
        opts("2026-05-12T09:00:00Z"),
      ),
      beneficialOwnerResolved(
        {
          counterpartyId: CP1,
          beneficialOwners: [
            {
              partyId: "urn:party:natural-person:prs-001",
              ownershipPct: 100,
              controlBasis: "equity",
            },
          ],
          resolvedAt: "2026-05-12T09:15:00Z",
          resolvedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T09:15:00Z"),
      ),
      sanctionsClearancePassed(
        {
          counterpartyId: CP1,
          screeningProvider: "WorldCheck",
          screeningRef: "WC-2026-003",
          clearedAt: "2026-05-12T09:30:00Z",
          screenedBy: "agent:zara:mlro-supervision",
        },
        opts("2026-05-12T09:30:00Z"),
      ),
      fatcaCrsClassified(
        {
          counterpartyId: CP1,
          fatcaStatus: "non-us-person",
          crsResidency: "ZA",
          classifiedAt: "2026-05-12T09:45:00Z",
          classifiedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T09:45:00Z"),
      ),
      popiaConsentRecorded(
        {
          counterpartyId: CP1,
          consentScope: ["credit-assessment", "market-data-sharing", "regulatory-reporting"],
          recordedAt: "2026-05-12T10:00:00Z",
          recordedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T10:00:00Z"),
      ),
      creditAssessmentCompleted(
        {
          counterpartyId: CP1,
          creditGrade: "A",
          exposureLimitZar: 500_000_000_00,
          assessedAt: "2026-05-12T10:30:00Z",
          assessedBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T10:30:00Z"),
      ),
      ctor.documentationDrafted(
        { counterpartyId: CP1, agreementType: "ISDA", version: "2002-MA" },
        opts("2026-05-12T11:00:00Z"),
      ),
      ctor.documentationReadyToExecute(
        { counterpartyId: CP1, agreementType: "ISDA", version: "2002-MA" },
        opts("2026-05-12T11:30:00Z"),
      ),
      ctor.authorisedSignatoryAdded(
        {
          counterpartyId: CP1,
          personId: PERSON_ID,
          scope: "signatory",
          evidenceRef: "BOARD-RESOLUTION-2026-001",
        },
        opts("2026-05-12T12:00:00Z"),
      ),
      ctor.mandateAssigned(
        {
          counterpartyId: CP1,
          products: ["IRS", "CCS"],
          limits: { notional: 500_000_000 },
          rasReference: "RAS-2026-CP1",
        },
        opts("2026-05-12T12:30:00Z"),
      ),
      accountsSetupCompleted(
        {
          counterpartyId: CP1,
          accounts: [{ accountId: "ACC-CP1-ZAR-001", currency: "ZAR", accountType: "settlement" }],
          setupAt: "2026-05-12T13:00:00Z",
          setupBy: "agent:niko:client-lifecycle",
        },
        opts("2026-05-12T13:00:00Z"),
      ),
      ctor.counterpartyActivated(
        { counterpartyId: CP1, configSwitchEventId: "EVT-CONFIG-002" },
        opts("2026-05-12T14:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    if (state === undefined) throw new Error("Expected state for CP1");
    expect(state.phase).toBe("activated");
    expect(state.isTerminal).toBe(true);
    // Full path includes all Slice 1 + Slice 2 phases: sounding, prospect-registered,
    // fais-categorised, cdd-initiated, bo-resolved, sanctions-cleared,
    // fatca-crs-classified, popia-recorded, credit-assessed, documentation-drafted,
    // documentation-ready, signatories-registered, mandate-assigned, accounts-setup,
    // activated — 15 phase advances.
    expect(state.history.length).toBeGreaterThanOrEqual(15);
    expect(state.history.at(-1)?.phase).toBe("activated");
  });
});

describe("buildOnboardingBoardView()", () => {
  it("TC-7: phaseCounts correctly counts counterparties by phase", () => {
    const events: Event[] = [
      // CP1 → sounding
      ctor.soundingOpened(
        { counterpartyId: CP1, channel: "inbound" },
        opts("2026-05-11T08:00:00Z"),
      ),
      // CP2 → prospect-registered
      ctor.soundingOpened(
        { counterpartyId: CP2, channel: "outbound" },
        opts("2026-05-11T08:01:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP2,
          legalName: "Beta Inst (Pty) Ltd",
          jurisdiction: "ZA",
          sector: "Banking",
        },
        opts("2026-05-11T08:05:00Z"),
      ),
      // CP3 → prospect-registered (same phase as CP2)
      ctor.soundingOpened(
        { counterpartyId: CP3, channel: "introduction" },
        opts("2026-05-11T08:06:00Z"),
      ),
      ctor.prospectRegistered(
        {
          counterpartyId: CP3,
          legalName: "Gamma Fund Ltd",
          jurisdiction: "ZA",
          sector: "Asset Management",
        },
        opts("2026-05-11T08:07:00Z"),
      ),
    ];

    const store = storeStub(events);
    const view = buildOnboardingBoardView(store, "2026-05-11T09:00:00Z");

    expect(view.totalCounterparties).toBe(3);
    expect(view.phaseCounts.sounding).toBe(1);
    // "prospect-registered" contains a hyphen so dot notation is not valid;
    // use bracket notation (biome's `useLiteralKeys` only fires when dot
    // notation would be valid — this is not that case).
    expect(view.phaseCounts["prospect-registered"]).toBe(2);
    expect(view.activeCounterparties).toBe(0);
    // inProgress = not terminal and not "sounding": prospect-registered × 2.
    expect(view.inProgressCounterparties).toBe(2);
    expect(view.asOf).toBe("2026-05-11T09:00:00Z");
  });

  it("TC-8: empty store → empty arrays and zero counts", () => {
    const store = storeStub([]);
    const view = buildOnboardingBoardView(store, "2026-05-11T09:00:00Z");

    expect(view.counterparties).toHaveLength(0);
    expect(view.totalCounterparties).toBe(0);
    expect(view.activeCounterparties).toBe(0);
    expect(view.inProgressCounterparties).toBe(0);
    expect(Object.keys(view.phaseCounts)).toHaveLength(0);
  });
});
