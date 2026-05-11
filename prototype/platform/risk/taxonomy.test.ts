// platform/risk/taxonomy.test.ts
//
// Tests for the canonical Risk Taxonomy v1 typed mirror. The mirror at
// `prototype/platform/risk/taxonomy.ts` derives from the register at
// `Regulations/_risk-taxonomy.md`; these tests assert the structural
// invariants that the register's mapping rules (§6) + naming
// convention (§2) rely on.
//
// Author: Helena (Chief Risk Officer, governance — reports to CEO) +
//         Rohan (Risk engineer, engineering — reports to Helena).

import { describe, expect, it } from "bun:test";

import {
  RISK_TAXONOMY,
  RISK_TAXONOMY_CODES,
  type RiskTaxonomyCode,
  type RiskTaxonomyNode,
  getRiskTaxonomyNode,
  isTerminal,
} from "./taxonomy";

const CODE_PATTERN = /^RT-[A-Z]+(\.[A-Z0-9]+){0,2}$/;

describe("RiskTaxonomy v1 — structural invariants", () => {
  it("every code matches the stable-code pattern RT-<L1>(.<L2>(.<L3>)?)?", () => {
    for (const node of RISK_TAXONOMY) {
      expect(node.code).toMatch(CODE_PATTERN);
    }
  });

  it("every non-root node has a parent that exists in the taxonomy", () => {
    const codeSet = new Set<RiskTaxonomyCode>(RISK_TAXONOMY_CODES);
    for (const node of RISK_TAXONOMY) {
      if (node.level === 1) {
        expect(node.parent).toBeNull();
      } else {
        expect(node.parent).not.toBeNull();
        // narrow: parent is non-null when level > 1
        expect(codeSet.has(node.parent as RiskTaxonomyCode)).toBe(true);
      }
    }
  });

  it("parent level is exactly one less than child level", () => {
    const byCode = new Map<RiskTaxonomyCode, RiskTaxonomyNode>(
      RISK_TAXONOMY.map((n) => [n.code, n]),
    );
    for (const node of RISK_TAXONOMY) {
      if (node.parent === null) continue;
      const parent = byCode.get(node.parent);
      expect(parent).toBeDefined();
      // parent is defined per assertion above
      expect((parent as RiskTaxonomyNode).level).toBe((node.level - 1) as 1 | 2);
    }
  });

  it("code prefix matches parent code (hierarchy is encoded in the code)", () => {
    for (const node of RISK_TAXONOMY) {
      if (node.parent === null) continue;
      expect(node.code.startsWith(`${node.parent}.`)).toBe(true);
    }
  });

  it("every level-1 owner is non-empty", () => {
    const level1 = RISK_TAXONOMY.filter((n) => n.level === 1);
    expect(level1.length).toBe(11);
    for (const node of level1) {
      expect(node.owner.length).toBeGreaterThan(0);
    }
  });

  it("every code is unique", () => {
    const codes = RISK_TAXONOMY.map((n) => n.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every node carries a non-empty name + definition", () => {
    for (const node of RISK_TAXONOMY) {
      expect(node.name.length).toBeGreaterThan(0);
      expect(node.definition.length).toBeGreaterThan(0);
    }
  });
});

describe("RiskTaxonomy v1 — isTerminal", () => {
  it("returns true for at least one node per level-1 branch", () => {
    const level1Codes = RISK_TAXONOMY.filter((n) => n.level === 1).map((n) => n.code);
    for (const root of level1Codes) {
      const branchTerminals = RISK_TAXONOMY.filter(
        (n) => n.code === root || n.code.startsWith(`${root}.`),
      ).filter((n) => isTerminal(n.code));
      expect(branchTerminals.length).toBeGreaterThan(0);
    }
  });

  it("returns false for any node that has children", () => {
    // Inverse — for every parent referenced by another node, isTerminal === false.
    const parents = new Set<RiskTaxonomyCode>();
    for (const node of RISK_TAXONOMY) {
      if (node.parent !== null) parents.add(node.parent);
    }
    for (const parentCode of parents) {
      expect(isTerminal(parentCode)).toBe(false);
    }
  });

  it("throws on an unknown code", () => {
    expect(() => isTerminal("RT-NOPE" as RiskTaxonomyCode)).toThrow();
  });

  // Smoke checks on specific terminal nodes named by the register §6
  // worked examples.
  it("RT-MK.IR (trading-book interest-rate risk) is terminal", () => {
    expect(isTerminal("RT-MK.IR")).toBe(true);
  });

  it("RT-OP.TP.MS (third-party market-services) is terminal", () => {
    expect(isTerminal("RT-OP.TP.MS")).toBe(true);
  });

  it("RT-OP.MD.T2 (Tier-2 model) is terminal", () => {
    expect(isTerminal("RT-OP.MD.T2")).toBe(true);
  });

  it("RT-FC.SA.ZA (domestic sanctions) is terminal", () => {
    expect(isTerminal("RT-FC.SA.ZA")).toBe(true);
  });

  it("RT-OP.CY (parent of CY.CF/IN/AV/RS) is not terminal", () => {
    expect(isTerminal("RT-OP.CY")).toBe(false);
  });

  it("RT-CR (root with children) is not terminal", () => {
    expect(isTerminal("RT-CR")).toBe(false);
  });
});

describe("RiskTaxonomy v1 — lookups", () => {
  it("getRiskTaxonomyNode returns the node for a known code", () => {
    const node = getRiskTaxonomyNode("RT-OP");
    expect(node?.name).toBe("Operational risk");
    expect(node?.level).toBe(1);
    expect(node?.parent).toBeNull();
  });

  it("getRiskTaxonomyNode returns undefined for an unknown code", () => {
    expect(getRiskTaxonomyNode("RT-DOES-NOT-EXIST" as RiskTaxonomyCode)).toBeUndefined();
  });

  it("RISK_TAXONOMY has exactly 11 level-1 nodes", () => {
    expect(RISK_TAXONOMY.filter((n) => n.level === 1).length).toBe(11);
  });
});
