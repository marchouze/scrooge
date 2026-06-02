// platform/event-store/event-types/risk.test.ts
//
// Tests for the risk-register closure family: RiskResolved / RiskAccepted /
// RiskMitigated factories + payload schemas.
//
// Authority: WS-RISK-REGISTER-CLOSURE
//   (brief:atlas:risk-register-closure-substrate-substrate-status:2026-06-02).
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  RISK_CLOSURE_EVENT_TYPES,
  RISK_TYPED_EVENT_TYPES,
  makeRiskAccepted,
  makeRiskMitigated,
  makeRiskResolved,
  riskAcceptedPayloadSchema,
  riskMitigatedPayloadSchema,
  riskResolvedPayloadSchema,
} from "./risk";

const BASE = {
  asOf: "2026-06-02T00:00:00.000Z",
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "service" as const, id: "agent:rohan:risk-run" },
  citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
};

describe("risk closure family — type registers", () => {
  it("RISK_CLOSURE_EVENT_TYPES holds the three closure types", () => {
    expect([...RISK_CLOSURE_EVENT_TYPES]).toEqual([
      "RiskResolved",
      "RiskAccepted",
      "RiskMitigated",
    ]);
  });

  it("RISK_TYPED_EVENT_TYPES includes RiskRaised + closures + RasLineCalibrated", () => {
    expect([...RISK_TYPED_EVENT_TYPES]).toEqual([
      "RiskRaised",
      "RiskResolved",
      "RiskAccepted",
      "RiskMitigated",
      "RasLineCalibrated",
    ]);
  });
});

describe("makeRiskResolved", () => {
  it("builds a valid RiskResolved event", () => {
    const e = makeRiskResolved({
      ...BASE,
      payload: {
        riskId: "risk:prod:1",
        resolvedBy: "agent:rohan:risk-run",
        resolutionType: "fixed",
        resolution: "remediated by hedge",
      },
    });
    expect(e.type).toBe("RiskResolved");
    expect((e.payload as { riskId: string }).riskId).toBe("risk:prod:1");
  });

  it("forwards provenance when supplied", () => {
    const e = makeRiskResolved({
      ...BASE,
      payload: {
        riskId: "risk:fixture:1",
        resolvedBy: "agent:atlas",
        resolutionType: "reclassified",
        resolution: "moved to substrate status surface",
      },
      provenance: { kind: "build-phase-fixture", sourceLineage: "migration" },
    });
    expect((e.provenance as { kind: string }).kind).toBe("build-phase-fixture");
  });

  it("rejects an invalid resolutionType", () => {
    expect(() =>
      riskResolvedPayloadSchema.parse({
        riskId: "r1",
        resolvedBy: "x",
        resolutionType: "nope",
        resolution: "y",
      }),
    ).toThrow();
  });

  it("rejects an empty riskId", () => {
    expect(() =>
      riskResolvedPayloadSchema.parse({
        riskId: "",
        resolvedBy: "x",
        resolutionType: "fixed",
        resolution: "y",
      }),
    ).toThrow();
  });
});

describe("makeRiskAccepted", () => {
  it("builds a valid RiskAccepted event with authority", () => {
    const e = makeRiskAccepted({
      ...BASE,
      payload: {
        riskId: "risk:prod:2",
        acceptedBy: "Helena",
        rationale: "within appetite at current book size",
        authority: "CRO",
        reviewBy: "2026-12-31",
      },
    });
    expect(e.type).toBe("RiskAccepted");
    expect((e.payload as { authority: string }).authority).toBe("CRO");
  });

  it("requires a non-empty authority", () => {
    expect(() =>
      riskAcceptedPayloadSchema.parse({
        riskId: "r1",
        acceptedBy: "x",
        rationale: "y",
        authority: "",
      }),
    ).toThrow();
  });
});

describe("makeRiskMitigated", () => {
  it("builds a valid RiskMitigated event with residual severity", () => {
    const e = makeRiskMitigated({
      ...BASE,
      payload: {
        riskId: "risk:prod:3",
        mitigatedBy: "agent:rohan:risk-run",
        mitigatingControl: "delta hedge",
        residualSeverity: "low",
      },
    });
    expect(e.type).toBe("RiskMitigated");
    expect((e.payload as { residualSeverity: string }).residualSeverity).toBe("low");
  });

  it("rejects an invalid residualSeverity", () => {
    expect(() =>
      riskMitigatedPayloadSchema.parse({
        riskId: "r1",
        mitigatedBy: "x",
        mitigatingControl: "y",
        residualSeverity: "extreme",
      }),
    ).toThrow();
  });
});
