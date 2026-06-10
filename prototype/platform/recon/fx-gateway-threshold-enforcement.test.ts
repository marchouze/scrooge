// platform/recon/fx-gateway-threshold-enforcement.test.ts
//
// Pins recon:fx-gateway-threshold-enforcement:
//   - GREEN on the live tree (both gateway paths enforce the ratified
//     thresholds; schedule coherent; evaluators reject breaches).
//   - FAILS on a reconstructed approve-always regression (the pre-
//     D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS sync gateway, which ran the
//     capital-impact + funding check kinds but never evaluated them).
//   - FAILS when a production path re-introduces the retired
//     capital-funding-stub.json.
//
// Authority: D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS (CRO-approved 2026-06-10).
// Author: Helena (Chief Risk Officer, governance).

import { describe, expect, it } from "bun:test";

import { run } from "./fx-gateway-threshold-enforcement";

describe("recon:fx-gateway-threshold-enforcement", () => {
  it("is GREEN on the live tree", () => {
    const r = run();
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThanOrEqual(15);
  });

  it("FAILS on a reconstructed approve-always sync gateway (pre-decision state)", () => {
    // The pre-enforcement gateway ran the check kinds but evaluated nothing —
    // exactly the regression the gate exists to catch.
    const approveAlwaysGateway = `
      const CHECK_KINDS = ["credit-limit", "capital-impact", "funding"];
      for (const checkKind of CHECK_KINDS) {
        let outcome = "approve";
        if (checkKind === "credit-limit") { /* enforced */ }
        // capital-impact and funding: approve-always
      }
    `;
    const r = run({
      sources: {
        syncGateway: approveAlwaysGateway,
        asyncHandler: "evaluateCapitalImpact(x); evaluateFundingImpact(y);",
      },
    });
    expect(r.ok).toBe(false);
    const subjects = r.violations.map((v) => v.subject);
    expect(subjects.some((s) => s.includes("evaluateCapitalImpact"))).toBe(true);
    expect(subjects.some((s) => s.includes("evaluateFundingImpact"))).toBe(true);
  });

  it("FAILS when the async handler regresses to the retired stub", () => {
    const r = run({
      sources: {
        syncGateway:
          'evaluateCapitalImpact(a); evaluateFundingImpact(b); "capital-impact"; "funding";',
        asyncHandler:
          'evaluateCapitalImpact(a); evaluateFundingImpact(b); loadStub("capital-funding-stub.json");',
      },
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject.includes("capital-funding-stub.json"))).toBe(true);
  });
});
