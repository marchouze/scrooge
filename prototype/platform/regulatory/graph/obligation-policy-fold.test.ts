// platform/regulatory/graph/obligation-policy-fold.test.ts
//
// Unit tests for the pure Obligation → Policy derivation module
// (WS-OBLIGATION-POLICY-MAPPING): fulfilment-cell splitting, pair derivation
// with provenance precedence + dedup, unresolvable-name skipping, and the
// IMPLEMENTED_BY edge shape. The seed-side ordering + idempotency is covered
// by obligation-policy-fold.integration.test.ts.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { describe, expect, test } from "bun:test";

import {
  buildImplementedByEdge,
  deriveObligationPolicyPairs,
  splitFulfilmentPolicyCell,
} from "./obligation-policy-fold";

describe("splitFulfilmentPolicyCell", () => {
  test("splits on semicolons and trims", () => {
    expect(splitFulfilmentPolicyCell("Credit Risk Policy; Capital Management Policy")).toEqual([
      "Credit Risk Policy",
      "Capital Management Policy",
    ]);
  });

  test("unwraps markdown links to their display text", () => {
    expect(
      splitFulfilmentPolicyCell("[AML/CFT Policy](../Policies/aml-cft-policy-v1.md); PEP Policy"),
    ).toEqual(["AML/CFT Policy", "PEP Policy"]);
  });

  test("skips backtick-quoted and Procedures/ path entries (procedures are not policies)", () => {
    expect(
      splitFulfilmentPolicyCell(
        "Excon Compliance Policy (planned); `Procedures/by-policy/finsurv-reporting.md` (planned)",
      ),
    ).toEqual(["Excon Compliance Policy (planned)"]);
  });

  test("skips TBD / empty cells", () => {
    expect(splitFulfilmentPolicyCell("[TBD]")).toEqual([]);
    expect(splitFulfilmentPolicyCell("")).toEqual([]);
  });
});

describe("deriveObligationPolicyPairs", () => {
  const resolver = (name: string) =>
    name.toLowerCase().includes("aml") ? "POL-aml-cft-policy" : undefined;

  test("derives from explicit obligations: frontmatter with frontmatter provenance", () => {
    const pairs = deriveObligationPolicyPairs({
      policies: [
        {
          policyNodeId: "POL-aml-cft-policy",
          obligationsImplemented: ["ORG-FC-07"],
          obligationsClosed: [],
        },
      ],
      registerRows: [],
      resolvePolicyNodeId: resolver,
    });
    expect(pairs).toEqual([
      {
        obligationId: "ORG-FC-07",
        policyNodeId: "POL-aml-cft-policy",
        source: "policy-frontmatter-obligations",
        confidenceScore: 0.95,
      },
    ]);
  });

  test("dedups the same pair across sources — explicit frontmatter wins over register", () => {
    const pairs = deriveObligationPolicyPairs({
      policies: [
        {
          policyNodeId: "POL-aml-cft-policy",
          obligationsImplemented: ["ORG-FC-07"],
          obligationsClosed: ["ORG-FC-07"],
        },
      ],
      registerRows: [{ obligationId: "ORG-FC-07", fulfilmentPolicy: "AML/CFT Policy" }],
      resolvePolicyNodeId: resolver,
    });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.source).toBe("policy-frontmatter-obligations");
  });

  test("summary-closes wins over register-fulfilment for the same pair", () => {
    const pairs = deriveObligationPolicyPairs({
      policies: [
        {
          policyNodeId: "POL-aml-cft-policy",
          obligationsImplemented: [],
          obligationsClosed: ["ORG-FC-02"],
        },
      ],
      registerRows: [{ obligationId: "ORG-FC-02", fulfilmentPolicy: "AML/CFT Policy" }],
      resolvePolicyNodeId: resolver,
    });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.source).toBe("policy-summary-closes");
    expect(pairs[0]?.confidenceScore).toBe(0.95);
  });

  test("an unresolvable fulfilment-policy name yields NO edge (gap, not a guess)", () => {
    const pairs = deriveObligationPolicyPairs({
      policies: [],
      registerRows: [
        { obligationId: "ORG-WB-02", fulfilmentPolicy: "Some Unwritten Future Policy" },
      ],
      resolvePolicyNodeId: resolver,
    });
    expect(pairs).toEqual([]);
  });

  test("register-derived pairs carry register provenance + 0.85 confidence", () => {
    const pairs = deriveObligationPolicyPairs({
      policies: [],
      registerRows: [
        {
          obligationId: "ORG-FC-13",
          fulfilmentPolicy: "RMCP; [AML/CFT Policy](../Policies/aml-cft-policy-v1.md)",
        },
      ],
      resolvePolicyNodeId: resolver,
    });
    expect(pairs).toEqual([
      {
        obligationId: "ORG-FC-13",
        policyNodeId: "POL-aml-cft-policy",
        source: "register-fulfilment-policy",
        confidenceScore: 0.85,
      },
    ]);
  });

  test("output is deterministically ordered (stable seed output)", () => {
    const pairs = deriveObligationPolicyPairs({
      policies: [
        {
          policyNodeId: "POL-aml-cft-policy",
          obligationsImplemented: ["ORG-FC-09", "ORG-FC-01"],
          obligationsClosed: [],
        },
      ],
      registerRows: [],
      resolvePolicyNodeId: resolver,
    });
    expect(pairs.map((p) => p.obligationId)).toEqual(["ORG-FC-01", "ORG-FC-09"]);
  });
});

describe("buildImplementedByEdge", () => {
  test("builds an Obligation → Policy IMPLEMENTED_BY edge with provenance metadata", () => {
    const edge = buildImplementedByEdge(
      {
        obligationId: "ORG-FC-07",
        policyNodeId: "POL-aml-cft-policy",
        source: "policy-frontmatter-obligations",
        confidenceScore: 0.95,
      },
      "IMPLEMENTED_BY-1",
      "2026-06-10T00:00:00Z",
    );
    expect(edge).toEqual({
      id: "IMPLEMENTED_BY-1",
      fromId: "OBL-ORG-FC-07",
      toId: "POL-aml-cft-policy",
      edgeType: "IMPLEMENTED_BY",
      extractionMethod: "frontmatter",
      confidenceScore: 0.95,
      extractedAt: "2026-06-10T00:00:00Z",
      metadata: { source: "policy-frontmatter-obligations" },
    });
  });

  test("register-sourced pairs use extractionMethod 'register'", () => {
    const edge = buildImplementedByEdge(
      {
        obligationId: "ORG-PR-01",
        policyNodeId: "POL-capital-management-policy",
        source: "register-fulfilment-policy",
        confidenceScore: 0.85,
      },
      "IMPLEMENTED_BY-2",
      "2026-06-10T00:00:00Z",
    );
    expect(edge.extractionMethod).toBe("register");
  });
});
