// tests/recon-pipelines.test.ts
//
// Unit tests for the continuous-controls pipelines.
//   - mandate-ownership integrity returns ok over the live procedure set.
//   - decision-event reconciliation handles historical and missing-event
//     cases as expected, driven by an injected `state` fixture (per
//     D-EVENT-STORE-SCALING Slice 3b: recon derives at recon time, no
//     committed seed file).
//
// Author: Vera · Atlas (Slice 3b refactor)

import { describe, expect, it } from "bun:test";

import type { DashboardState, OpenDecision, ResolvedDecision } from "../dashboard/types";
import { run as decisionRecon } from "../platform/recon/decision-event-recon";
import { run as mandateOwnership } from "../platform/recon/mandate-ownership";

describe("mandate-ownership pipeline", () => {
  it("runs over the populated procedures and reports a result", () => {
    const r = mandateOwnership();
    expect(r.pipeline).toBe("mandate-ownership-integrity");
    expect(typeof r.asserted).toBe("number");
    expect(Array.isArray(r.violations)).toBe(true);
  });

  it("recognises governance seats and personas as valid owners", () => {
    // The procedure set as of 2026-05-06 has all owners resolving to
    // either real personas or known governance seats; therefore zero
    // failing violations expected.
    const r = mandateOwnership();
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

// Minimal `state` fixture: `decisionsResolved` and `decisionsOpen`
// matter for the decision-event-recon tests (the recon accepts events
// surfacing in either projection list). Cast through `unknown` because
// the rest of the DashboardState shape is irrelevant to this pipeline.
function fixtureState(
  decisionsResolved: ResolvedDecision[],
  decisionsOpen: OpenDecision[] = [],
): DashboardState {
  return {
    asOf: "2026-05-10T00:00:00.000Z",
    decisionsResolved,
    decisionsOpen,
    inFlight: [],
    principles: [],
    directReports: [],
    openSeats: [],
    findings: [],
    agents: [],
    policies: [],
    risks: [],
    runtimeHandlers: [],
    decisionComments: {},
    bankName: "Test Bank",
    bank: {
      name: "Test Bank",
      operatingPosture: "test",
      strategicFoundation: {
        type: "",
        products: [],
        clients: [],
        geography: "",
        capital: "",
        licence: "",
      },
      cloudTarget: "",
      metrics: {
        principles: 0,
        policies: 0,
        obligations: 0,
        instruments: 0,
        instrumentsAnalysed: 0,
        proceduresPopulated: 0,
        proceduresPlanned: 0,
        ceoDecisionsActioned: decisionsResolved.length,
        directReports: 0,
        openGovernanceSeats: 0,
      },
    },
    prototype: { ciStatus: "green", tests: 0, modules: [], next: [] },
  } as unknown as DashboardState;
}

describe("decision-event-reconciliation pipeline", () => {
  it("treats historical (date-only) decisions as not requiring an event match", () => {
    const r = decisionRecon({
      state: fixtureState([
        {
          id: "HIST-1",
          title: "Historical decision",
          actionedAt: "2026-05-06",
          outcome: "ok",
          sourceDoc: "(unsourced)",
        },
      ]),
      eventDecisionIds: new Set<string>(),
    });
    // Historical decision is asserted but not failed.
    expect(r.asserted).toBe(1);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("flags a derived entry with an ISO timestamp that has no matching event", () => {
    const r = decisionRecon({
      state: fixtureState([
        {
          id: "DASH-1",
          title: "Dashboard-actioned but no event",
          actionedAt: "2026-05-06T12:00:00.000Z",
          outcome: "ok",
          sourceDoc: "(unsourced)",
        },
      ]),
      eventDecisionIds: new Set<string>(),
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.message.includes("no CeoDecision event")),
    ).toBe(true);
  });

  it("flags an event-store entry that has no derived decisionsResolved or decisionsOpen", () => {
    const r = decisionRecon({
      state: fixtureState([]),
      eventDecisionIds: new Set<string>(["ORPHAN-1"]),
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.message.includes("derived decisionsResolved"),
      ),
    ).toBe(true);
  });

  it("does not flag a request-revision event as missing from decisionsResolved", () => {
    const r = decisionRecon({
      state: fixtureState([]),
      eventDecisionIds: new Set<string>(["D-MARKETS-CAPITAL-TIME-SHAPE"]),
      reopenedDecisionIds: new Set<string>(["D-MARKETS-CAPITAL-TIME-SHAPE"]),
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.asserted).toBeGreaterThanOrEqual(1);
  });

  it("flags a non-revision event that is missing from decisionsResolved", () => {
    const r = decisionRecon({
      state: fixtureState([]),
      eventDecisionIds: new Set<string>(["D-SOME-APPROVED"]),
      reopenedDecisionIds: new Set<string>(),
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail" && v.subject === "D-SOME-APPROVED")).toBe(
      true,
    );
  });

  it("handles mixed resolved + reopened decisions correctly", () => {
    const r = decisionRecon({
      state: fixtureState([
        {
          id: "D-APPROVED",
          title: "Approved decision",
          actionedAt: "2026-05-07T14:00:00.000Z",
          outcome: "approved",
          sourceDoc: "(unsourced)",
        },
      ]),
      eventDecisionIds: new Set<string>(["D-APPROVED", "D-REOPENED", "D-ORPHAN"]),
      reopenedDecisionIds: new Set<string>(["D-REOPENED"]),
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.length).toBe(1);
    expect(fails[0]?.subject).toBe("D-ORPHAN");
  });

  it("accepts an event surfaced via decisionsOpen (reopened by request-revision)", () => {
    const r = decisionRecon({
      state: fixtureState(
        [],
        [
          {
            id: "D-MARKETS-CAPITAL-TIME-SHAPE",
            title: "Markets franchise design — proposal",
            category: "near-term",
            owner: "(reopened)",
            trigger: "CeoDecision event with action=request-revision",
            decisionForCEO: "Awaiting CEO call on §8 split.",
            sourceDocs: [],
          },
        ],
      ),
      eventDecisionIds: new Set<string>(["D-MARKETS-CAPITAL-TIME-SHAPE"]),
    });
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
