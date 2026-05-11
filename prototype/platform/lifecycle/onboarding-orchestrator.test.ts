// platform/lifecycle/onboarding-orchestrator.test.ts
//
// Unit tests for the Slice 1 onboarding orchestrator.
//
// Uses synthetic events ONLY — no reads from the event store. The core fold
// function `derivePhaseFromEvents()` is tested directly with hand-built Event
// objects; `buildOnboardingBoardView()` is tested against an in-memory
// EventStore whose `replay()` is stubbed with the synthetic events.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { counterpartyId } from "@domains/customer/types";
import * as ctor from "@domains/customer/onboarding";
import type { MakeOpts } from "@domains/customer/onboarding";
import type { Event } from "@platform/event-store/types";
import {
  buildOnboardingBoardView,
  derivePhaseFromEvents,
} from "./onboarding-orchestrator";

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

// Reviewer/person Party URNs for typed payloads
const REVIEWER_ID = "party:natural-person:PRS-REVIEWER-001" as Parameters<typeof ctor.kycCompleted>[0]["reviewerId"];
const PERSON_ID = "party:natural-person:PRS-SIGNATORY-001" as Parameters<typeof ctor.authorisedSignatoryAdded>[0]["personId"];

/**
 * Build a minimal in-memory store stub that replays a fixed event sequence.
 * The orchestrator only needs `Pick<EventStore, "replay">`.
 */
function storeStub(events: readonly Event[]): { replay: () => Generator<Event> } {
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
    expect(state).toBeDefined();
    expect(state!.phase).toBe("sounding");
    expect(state!.isTerminal).toBe(false);
    expect(state!.eventCount).toBe(1);
    expect(state!.history).toHaveLength(1);
    expect(state!.history[0]!.phase).toBe("sounding");
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
    expect(state).toBeDefined();
    expect(state!.phase).toBe("prospect-registered");
    expect(state!.eventCount).toBe(2);
  });

  it("TC-3: full happy path → phase is 'activated', isTerminal is true", () => {
    const events: Event[] = [
      ctor.soundingOpened({ counterpartyId: CP1, channel: "inbound" }, opts("2026-05-11T08:00:00Z")),
      ctor.prospectRegistered(
        { counterpartyId: CP1, legalName: "Acme Capital (Pty) Ltd", jurisdiction: "ZA", sector: "Asset Management" },
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
          limits: { notional: 5_000_000_00 },
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
    expect(state).toBeDefined();
    expect(state!.phase).toBe("activated");
    expect(state!.isTerminal).toBe(true);
    expect(state!.eventCount).toBe(8);
    // Verify history contains all phase advances (sounding, prospect-registered,
    // cdd-initiated, documentation-drafted, documentation-ready,
    // signatories-registered, mandate-assigned, activated).
    expect(state!.history.length).toBeGreaterThanOrEqual(8);
    expect(state!.history.at(-1)!.phase).toBe("activated");
  });

  it("TC-4: CounterpartyOffboarded → phase is 'offboarded', isTerminal true", () => {
    const events: Event[] = [
      ctor.soundingOpened({ counterpartyId: CP2, channel: "outbound" }, opts("2026-05-11T08:00:00Z")),
      ctor.prospectRegistered(
        { counterpartyId: CP2, legalName: "Risk Corp Ltd", jurisdiction: "ZA", sector: "Insurance" },
        opts("2026-05-11T08:30:00Z"),
      ),
      ctor.counterpartyOffboarded(
        { counterpartyId: CP2, reason: "Sanctions match confirmed." },
        opts("2026-05-11T09:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP2);
    expect(state).toBeDefined();
    expect(state!.phase).toBe("offboarded");
    expect(state!.isTerminal).toBe(true);
  });

  it("TC-5: MandateRevoked after MandateAssigned regresses phase to 'mandate-scoped'", () => {
    const events: Event[] = [
      ctor.soundingOpened({ counterpartyId: CP1, channel: "inbound" }, opts("2026-05-11T08:00:00Z")),
      ctor.prospectRegistered(
        { counterpartyId: CP1, legalName: "Acme Capital (Pty) Ltd", jurisdiction: "ZA", sector: "Asset Management" },
        opts("2026-05-11T08:01:00Z"),
      ),
      ctor.kycCompleted(
        { counterpartyId: CP1, tier: "Tier-1", pep: false, sanctionsClear: true, jurisdictionalRiskScore: "low", reviewerId: REVIEWER_ID },
        opts("2026-05-11T09:00:00Z"),
      ),
      ctor.mandateAssigned(
        { counterpartyId: CP1, products: ["IRS"], limits: { notional: 1_000_000_00 }, rasReference: "RAS-2026-CP1" },
        opts("2026-05-11T09:30:00Z"),
      ),
      ctor.mandateRevoked(
        { counterpartyId: CP1, reason: "Limit breach — mandate revoked pending review." },
        opts("2026-05-11T10:00:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);
    const state = result.get(CP1);
    expect(state).toBeDefined();
    expect(state!.phase).toBe("mandate-scoped");
    expect(state!.isTerminal).toBe(false);
    // History should include the regression.
    const phaseNames = state!.history.map((h) => h.phase);
    expect(phaseNames).toContain("mandate-assigned");
    expect(phaseNames.at(-1)).toBe("mandate-scoped");
  });

  it("TC-6: multiple counterparties fold independently", () => {
    const events: Event[] = [
      ctor.soundingOpened({ counterpartyId: CP1, channel: "inbound" }, opts("2026-05-11T08:00:00Z")),
      ctor.soundingOpened({ counterpartyId: CP2, channel: "outbound" }, opts("2026-05-11T08:01:00Z")),
      ctor.soundingOpened({ counterpartyId: CP3, channel: "introduction", introSource: "JSE" }, opts("2026-05-11T08:02:00Z")),
      ctor.prospectRegistered(
        { counterpartyId: CP1, legalName: "Acme Capital (Pty) Ltd", jurisdiction: "ZA", sector: "Asset Management" },
        opts("2026-05-11T08:05:00Z"),
      ),
      ctor.kycCompleted(
        { counterpartyId: CP2, tier: "Tier-2", pep: false, sanctionsClear: true, jurisdictionalRiskScore: "medium", reviewerId: REVIEWER_ID },
        opts("2026-05-11T08:10:00Z"),
      ),
      ctor.counterpartyOffboarded(
        { counterpartyId: CP3, reason: "Client withdrew interest." },
        opts("2026-05-11T08:15:00Z"),
      ),
    ];
    const result = derivePhaseFromEvents(events);

    expect(result.get(CP1)!.phase).toBe("prospect-registered");
    expect(result.get(CP2)!.phase).toBe("cdd-initiated");
    expect(result.get(CP3)!.phase).toBe("offboarded");

    // Each counterparty is independent.
    expect(result.get(CP1)!.counterpartyId).toBe(CP1);
    expect(result.get(CP2)!.counterpartyId).toBe(CP2);
    expect(result.get(CP3)!.counterpartyId).toBe(CP3);
  });
});

describe("buildOnboardingBoardView()", () => {
  it("TC-7: phaseCounts correctly counts counterparties by phase", () => {
    const events: Event[] = [
      // CP1 → sounding
      ctor.soundingOpened({ counterpartyId: CP1, channel: "inbound" }, opts("2026-05-11T08:00:00Z")),
      // CP2 → prospect-registered
      ctor.soundingOpened({ counterpartyId: CP2, channel: "outbound" }, opts("2026-05-11T08:01:00Z")),
      ctor.prospectRegistered(
        { counterpartyId: CP2, legalName: "Beta Inst (Pty) Ltd", jurisdiction: "ZA", sector: "Banking" },
        opts("2026-05-11T08:05:00Z"),
      ),
      // CP3 → prospect-registered (same phase as CP2)
      ctor.soundingOpened({ counterpartyId: CP3, channel: "introduction" }, opts("2026-05-11T08:06:00Z")),
      ctor.prospectRegistered(
        { counterpartyId: CP3, legalName: "Gamma Fund Ltd", jurisdiction: "ZA", sector: "Asset Management" },
        opts("2026-05-11T08:07:00Z"),
      ),
    ];

    const store = storeStub(events);
    const view = buildOnboardingBoardView(store as Parameters<typeof buildOnboardingBoardView>[0], "2026-05-11T09:00:00Z");

    expect(view.totalCounterparties).toBe(3);
    expect(view.phaseCounts["sounding"]).toBe(1);
    expect(view.phaseCounts["prospect-registered"]).toBe(2);
    expect(view.activeCounterparties).toBe(0);
    expect(view.inProgressCounterparties).toBe(2); // prospect-registered × 2; "sounding" excluded
    expect(view.asOf).toBe("2026-05-11T09:00:00Z");
  });

  it("TC-8: empty store → empty arrays and zero counts", () => {
    const store = storeStub([]);
    const view = buildOnboardingBoardView(store as Parameters<typeof buildOnboardingBoardView>[0], "2026-05-11T09:00:00Z");

    expect(view.counterparties).toHaveLength(0);
    expect(view.totalCounterparties).toBe(0);
    expect(view.activeCounterparties).toBe(0);
    expect(view.inProgressCounterparties).toBe(0);
    expect(Object.keys(view.phaseCounts)).toHaveLength(0);
  });
});
