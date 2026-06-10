// platform/regulatory/basel-family-seat.test.ts
//
// Asserts the shared Basel-family → seat mapping that the BCBS-obligation emit
// path (dashboard /api/obligations/adopt) and the remediation script
// (scripts/assign-bcbs-obligation-owners.ts) both consume, so the `owner`
// stamped at emit time matches the family it is derived from and the two paths
// can never drift. D-OBLIGATIONS-REGISTER-CLEANUP · WS-OBLIGATIONS-CLEANUP.

import { describe, expect, it } from "bun:test";
import { BASEL_FAMILY_TO_SEAT, baselFamilyOf, seatForBcbsObligationId } from "./basel-family-seat";

describe("baselFamilyOf", () => {
  it("extracts the family token from a BCBS obligation id", () => {
    expect(baselFamilyOf("BCBS-CRE20")).toBe("CRE");
    expect(baselFamilyOf("BCBS-MAR10")).toBe("MAR");
    expect(baselFamilyOf("BCBS-LCR10")).toBe("LCR");
    expect(baselFamilyOf("BCBS-NSF99.1")).toBe("NSF");
  });

  it("returns empty for non-BCBS ids", () => {
    expect(baselFamilyOf("ORG-PR-0001")).toBe("");
    expect(baselFamilyOf("")).toBe("");
    // The prefix match is case-sensitive on `BCBS-` (obligation ids are
    // uppercase), matching the script's original familyOf behaviour.
    expect(baselFamilyOf("bcbs-cre20")).toBe("");
  });
});

describe("seatForBcbsObligationId", () => {
  // Family → expected seat per the PR #1139 seat vocabulary
  // (cco | cfo | cro | company-secretary | operational | head-of-global-markets).
  const cases: Array<{ id: string; seat: string; why: string }> = [
    { id: "BCBS-CRE20", seat: "cro", why: "credit RWA" },
    { id: "BCBS-LEV10", seat: "cro", why: "leverage" },
    { id: "BCBS-LEX30", seat: "cro", why: "large exposures" },
    { id: "BCBS-MAR21", seat: "cro", why: "market risk" },
    { id: "BCBS-RBC20", seat: "cro", why: "risk-based capital" },
    { id: "BCBS-CAP10", seat: "cro", why: "capital definition" },
    { id: "BCBS-LCR10", seat: "cfo", why: "liquidity coverage" },
    { id: "BCBS-NSF10", seat: "cfo", why: "net stable funding" },
    { id: "BCBS-DIS10", seat: "cfo", why: "Pillar 3 disclosure" },
    { id: "BCBS-OPE25", seat: "operational", why: "operational risk" },
    { id: "BCBS-BCP01", seat: "company-secretary", why: "core principles" },
    { id: "BCBS-SCO60", seat: "company-secretary", why: "scope/governance" },
  ];

  for (const { id, seat, why } of cases) {
    it(`maps ${id} (${why}) → ${seat}`, () => {
      expect(seatForBcbsObligationId(id)).toBe(seat);
    });
  }

  it("leaves owner empty (no guess) for an unmapped BCBS family", () => {
    expect(seatForBcbsObligationId("BCBS-XYZ10")).toBe("");
  });

  it("returns empty for non-BCBS ids", () => {
    expect(seatForBcbsObligationId("ORG-PR-0001")).toBe("");
  });

  it("every seat produced is in the PR #1139 seat vocabulary", () => {
    const allowed = new Set([
      "cco",
      "cfo",
      "cro",
      "company-secretary",
      "operational",
      "head-of-global-markets",
    ]);
    for (const seat of Object.values(BASEL_FAMILY_TO_SEAT)) {
      expect(allowed.has(seat)).toBe(true);
    }
  });
});
