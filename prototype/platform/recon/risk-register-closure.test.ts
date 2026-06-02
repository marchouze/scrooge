// platform/recon/risk-register-closure.test.ts
//
// Tests for the risk-register-closure recon pipeline (WS-RISK-REGISTER-CLOSURE).
// Author: Vera (Internal audit engineer)

import { describe, expect, it } from "bun:test";

import { run } from "./risk-register-closure";

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
  provenance?: { kind?: string } | null;
}

function raised(args: {
  id: string;
  riskId: string;
  kind?: "production" | "simulated" | "build-phase-fixture";
}): E {
  return {
    event_id: args.id,
    type: "RiskRaised",
    as_of: "2026-06-02T00:00:00.000Z",
    payload: { riskId: args.riskId, raisedBy: "Rohan", severity: "high" },
    provenance: { kind: args.kind ?? "production" },
  };
}

function resolved(riskId: string): E {
  return {
    event_id: `res-${riskId}`,
    type: "RiskResolved",
    as_of: "2026-06-02T01:00:00.000Z",
    payload: { riskId, resolvedBy: "Rohan", resolutionType: "fixed", resolution: "done" },
  };
}

describe("risk-register-closure recon", () => {
  it("empty store → pass", () => {
    const r = run({ raisedEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("only synthetic RiskRaised → pass (provenance guard)", () => {
    const r = run({
      raisedEvents: [
        raised({ id: "1", riskId: "risk:fix:1", kind: "build-phase-fixture" }),
        raised({ id: "2", riskId: "risk:sim:1", kind: "simulated" }),
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("production RiskRaised paired with RiskResolved → pass, no warn", () => {
    const r = run({
      raisedEvents: [raised({ id: "1", riskId: "risk:prod:1" })],
      closureEvents: { RiskResolved: [resolved("risk:prod:1")] },
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("unclosed production RiskRaised → warn (open finding)", () => {
    const r = run({ raisedEvents: [raised({ id: "1", riskId: "risk:prod:open" })] });
    expect(r.ok).toBe(true); // warn does not fail the pipeline
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.subject).toContain("risk:prod:open");
  });

  it("reports a repeated riskId only once", () => {
    const r = run({
      raisedEvents: [
        raised({ id: "1", riskId: "risk:repeat" }),
        raised({ id: "2", riskId: "risk:repeat" }),
        raised({ id: "3", riskId: "risk:repeat" }),
      ],
    });
    expect(r.violations.filter((v) => v.severity === "warn")).toHaveLength(1);
  });

  it("production RiskRaised with empty riskId → fail (uncloseable)", () => {
    const r = run({ raisedEvents: [raised({ id: "1", riskId: "" })] });
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.severity).toBe("fail");
  });

  it("RiskAccepted and RiskMitigated also close findings", () => {
    const r = run({
      raisedEvents: [raised({ id: "1", riskId: "risk:a" }), raised({ id: "2", riskId: "risk:m" })],
      closureEvents: {
        RiskAccepted: [
          {
            event_id: "acc",
            type: "RiskAccepted",
            as_of: "2026-06-02T01:00:00.000Z",
            payload: { riskId: "risk:a", acceptedBy: "Helena", rationale: "x", authority: "CRO" },
          },
        ],
        RiskMitigated: [
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
        ],
      },
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
});
