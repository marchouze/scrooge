// dashboard/risk-register.test.ts
//
// Tests for the risk-register view (WS-RISK-REGISTER-CLOSURE).
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import type { EventStore } from "../platform/event-store/store";
import { buildRiskRegisterView } from "./risk-register";

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
  provenance?: { kind?: string } | null;
}

/** Minimal EventStore stand-in — buildRiskRegisterView only calls replay({type}). */
function fakeStore(events: E[]): EventStore {
  return {
    replay: ({ type }: { type?: string } = {}) => events.filter((e) => !type || e.type === type),
  } as unknown as EventStore;
}

function raised(args: {
  riskId: string;
  at?: string;
  kind?: string;
  severity?: string;
  category?: string;
}): E {
  return {
    event_id: `raised-${args.riskId}-${args.at ?? "0"}`,
    type: "RiskRaised",
    as_of: args.at ?? "2026-06-01T00:00:00.000Z",
    payload: {
      riskId: args.riskId,
      raisedBy: "Rohan",
      description: `desc ${args.riskId}`,
      category: args.category ?? "credit",
      severity: args.severity ?? "high",
    },
    provenance: args.kind ? { kind: args.kind } : null,
  };
}

const ASOF = "2026-06-02T12:00:00.000Z";

describe("buildRiskRegisterView", () => {
  it("empty store → empty register", () => {
    const v = buildRiskRegisterView(fakeStore([]), ASOF);
    expect(v.findings).toHaveLength(0);
    expect(v.summary.total).toBe(0);
    expect(v.summary.production.open).toBe(0);
  });

  it("production RiskRaised with no closure → open", () => {
    const v = buildRiskRegisterView(fakeStore([raised({ riskId: "risk:1" })]), ASOF);
    expect(v.findings).toHaveLength(1);
    expect(v.findings[0]?.status).toBe("open");
    expect(v.findings[0]?.provenance).toBe("production");
    expect(v.summary.production.open).toBe(1);
  });

  it("pairs RiskResolved/Accepted/Mitigated by riskId", () => {
    const events: E[] = [
      raised({ riskId: "risk:r" }),
      raised({ riskId: "risk:a" }),
      raised({ riskId: "risk:m" }),
      {
        event_id: "res",
        type: "RiskResolved",
        as_of: "2026-06-02T01:00:00.000Z",
        payload: {
          riskId: "risk:r",
          resolvedBy: "Rohan",
          resolutionType: "fixed",
          resolution: "done",
        },
      },
      {
        event_id: "acc",
        type: "RiskAccepted",
        as_of: "2026-06-02T01:00:00.000Z",
        payload: {
          riskId: "risk:a",
          acceptedBy: "Helena",
          rationale: "appetite",
          authority: "CRO",
        },
      },
      {
        event_id: "mit",
        type: "RiskMitigated",
        as_of: "2026-06-02T01:00:00.000Z",
        payload: {
          riskId: "risk:m",
          mitigatedBy: "Rohan",
          mitigatingControl: "hedge",
          residualSeverity: "low",
        },
      },
    ];
    const v = buildRiskRegisterView(fakeStore(events), ASOF);
    const byId = Object.fromEntries(v.findings.map((f) => [f.riskId, f]));
    expect(byId["risk:r"]?.status).toBe("resolved");
    expect(byId["risk:a"]?.status).toBe("accepted");
    expect(byId["risk:m"]?.status).toBe("mitigated");
    expect(byId["risk:a"]?.closure?.detail).toContain("CRO");
    expect(v.summary.production).toMatchObject({ open: 0, resolved: 1, accepted: 1, mitigated: 1 });
  });

  it("keeps the latest RiskRaised per riskId", () => {
    const v = buildRiskRegisterView(
      fakeStore([
        raised({ riskId: "risk:1", at: "2026-06-01T00:00:00.000Z", severity: "low" }),
        raised({ riskId: "risk:1", at: "2026-06-02T00:00:00.000Z", severity: "critical" }),
      ]),
      ASOF,
    );
    expect(v.findings).toHaveLength(1);
    expect(v.findings[0]?.severity).toBe("critical");
  });

  it("takes the latest closure when more than one exists", () => {
    const v = buildRiskRegisterView(
      fakeStore([
        raised({ riskId: "risk:x" }),
        {
          event_id: "c1",
          type: "RiskMitigated",
          as_of: "2026-06-02T01:00:00.000Z",
          payload: {
            riskId: "risk:x",
            mitigatedBy: "R",
            mitigatingControl: "interim",
            residualSeverity: "medium",
          },
        },
        {
          event_id: "c2",
          type: "RiskResolved",
          as_of: "2026-06-02T05:00:00.000Z",
          payload: {
            riskId: "risk:x",
            resolvedBy: "R",
            resolutionType: "fixed",
            resolution: "final",
          },
        },
      ]),
      ASOF,
    );
    expect(v.findings[0]?.status).toBe("resolved");
  });

  it("classifies + sorts provenance (production first); counts synthetic", () => {
    const v = buildRiskRegisterView(
      fakeStore([
        raised({ riskId: "risk:fix", kind: "build-phase-fixture" }),
        raised({ riskId: "risk:sim", kind: "simulated" }),
        raised({ riskId: "risk:prod" }),
      ]),
      ASOF,
    );
    expect(v.findings[0]?.provenance).toBe("production");
    expect(v.summary.byProvenance).toMatchObject({
      production: 1,
      simulated: 1,
      "build-phase-fixture": 1,
    });
    // synthetic findings never count toward the production status tallies
    expect(v.summary.production.open).toBe(1);
  });
});
