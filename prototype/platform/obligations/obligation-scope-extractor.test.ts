// platform/obligations/obligation-scope-extractor.test.ts
//
// Unit tests for the conservative rule-based obligation scope extractor (W8 v1).
// Verifies: unambiguous IRB/IMA chapters → restricting dimension scope; generic
// / empty / ambiguous provenance → flat jurisdiction-ZA (conservative default).
//
// Author: Atlas (Core Banking Platform Architect, engineering).

import { describe, expect, it } from "bun:test";
import { deriveObligationScope, listScopeRules } from "./obligation-scope-extractor";

const ZA = { kind: "jurisdiction", jurisdiction: "ZA" } as const;

describe("deriveObligationScope — restricting (unambiguous approach-specific)", () => {
  it("BCBS IRB credit chapter (CRE32) → and(ZA, approach.credit-rwa=advanced-irb)", () => {
    const scope = deriveObligationScope({
      obligationId: "ORG-PR-1",
      derivesFrom: ["bcbs-cre32"],
      domain: "B",
    });
    expect(scope).toEqual({
      kind: "and",
      conditions: [
        ZA,
        { kind: "dimension", dimensionKey: "approach.credit-rwa", dimensionValue: "advanced-irb" },
      ],
    });
  });

  it("matches the IRB chapter via the citation field too", () => {
    const scope = deriveObligationScope({
      obligationId: "ORG-PR-2",
      derivesFrom: [],
      domain: "B",
      citation: "BCBS CRE36 supervisory formula",
    });
    expect(scope).toEqual({
      kind: "and",
      conditions: [
        ZA,
        { kind: "dimension", dimensionKey: "approach.credit-rwa", dimensionValue: "advanced-irb" },
      ],
    });
  });

  it("BCBS market-risk internal-models chapter (MAR31) → and(ZA, approach.market-risk=internal-models)", () => {
    const scope = deriveObligationScope({
      obligationId: "ORG-PR-3",
      derivesFrom: ["bcbs-mar31"],
      domain: "B",
    });
    expect(scope).toEqual({
      kind: "and",
      conditions: [
        ZA,
        {
          kind: "dimension",
          dimensionKey: "approach.market-risk",
          dimensionValue: "internal-models",
        },
      ],
    });
  });

  it("is case-insensitive on the provenance token", () => {
    const scope = deriveObligationScope({
      obligationId: "ORG-PR-4",
      derivesFrom: ["BCBS-CRE30"],
      domain: "B",
    });
    expect(scope.kind).toBe("and");
  });
});

describe("deriveObligationScope — conservative default (jurisdiction-ZA)", () => {
  it("empty derivesFrom and no citation → jurisdiction ZA", () => {
    expect(
      deriveObligationScope({ obligationId: "ORG-PR-5", derivesFrom: [], domain: "A" }),
    ).toEqual(ZA);
  });

  it("generic prudential provenance → jurisdiction ZA", () => {
    expect(
      deriveObligationScope({
        obligationId: "ORG-PR-6",
        derivesFrom: ["banks-d7-2020-s2", "bcbs-cre20"], // CRE20 = standardised credit, NOT IRB
        domain: "A",
        citation: "banks-d7-2020",
      }),
    ).toEqual(ZA);
  });

  it("ambiguous tokens that merely mention 'cre' but not an IRB chapter → jurisdiction ZA", () => {
    expect(
      deriveObligationScope({
        obligationId: "ORG-PR-7",
        derivesFrom: ["cre-policy-note"],
        domain: "A",
      }),
    ).toEqual(ZA);
  });
});

describe("listScopeRules", () => {
  it("exposes documented rule ids + rationales for audit", () => {
    const rules = listScopeRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.id.length).toBeGreaterThan(0);
      expect(r.rationale.length).toBeGreaterThan(0);
    }
  });
});
