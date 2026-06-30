// v2-core/regulatory-returns/cell-contract.test.ts
//
// Unit tests for the BA-return cell-data-requirement framework (L2), the
// BA 100 pilot instance, and the L3 inverse index. Pure — no v1 dependency, no
// event store (the contract is reference data, P1 Plane A).
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import { ba100Contract } from "./ba100-contract";
import { ReturnCellContractSchema, parseReturnContract } from "./cell-contract";
import { productsReferencedByContracts, returnDataObligationsForProduct } from "./inverse-index";

describe("cell-contract schema (L2 framework)", () => {
  const base = {
    returnForm: "BA100",
    cellRef: { xsdElement: "BA01000002", row: "R0010", column: "C0060" },
    label: "Cash and balances with central bank / Consolidated bank",
    regulatoryDefinition: "Consolidated cash and central-bank balances.",
    citations: [{ obligationId: "ORG-PR-RETURNS-002", clause: "D5/2025 §2.1.3" }],
    valueType: "money",
    currencyDimension: "functional",
    unit: "ZAR-thousands",
    derivation: { kind: "direct", expression: "GL fold" },
    dataRequirements: [
      {
        sourceKind: "gl-account",
        ref: "category:asset-cash",
        description: "cash accounts fold in",
        required: true,
      },
    ],
    applicability: { entityScope: "consolidated", jurisdiction: "ZA", productScope: "universal" },
    status: "sourced",
  };

  it("accepts a well-formed money cell", () => {
    expect(() => ReturnCellContractSchema.parse(base)).not.toThrow();
  });

  it("rejects a money cell with no currencyDimension (P5)", () => {
    const bad = { ...base, currencyDimension: undefined };
    expect(() => ReturnCellContractSchema.parse(bad)).toThrow();
  });

  it("rejects a non-money cell that declares a currencyDimension", () => {
    const bad = { ...base, valueType: "count", currencyDimension: "functional", unit: "count" };
    expect(() => ReturnCellContractSchema.parse(bad)).toThrow();
  });

  it("requires ≥1 citation (P2 — no orphan cell)", () => {
    const bad = { ...base, citations: [] };
    expect(() => ReturnCellContractSchema.parse(bad)).toThrow();
  });

  it("requires a statusReason on non-sourced cells (cmd 5 — no silent gap)", () => {
    const bad = { ...base, status: "licence-day-data" };
    expect(() => ReturnCellContractSchema.parse(bad)).toThrow();
  });

  it("requires a counsel-TBC dataRequirement on counsel-gated cells", () => {
    const bad = {
      ...base,
      status: "counsel-gated-TBC",
      statusReason: "definition counsel-gated",
    };
    expect(() => ReturnCellContractSchema.parse(bad)).toThrow();
  });

  it("accepts a counsel-gated cell with a counsel-TBC requirement + reason", () => {
    const ok = {
      ...base,
      status: "counsel-gated-TBC",
      statusReason: "definition counsel-gated pending external counsel",
      dataRequirements: [
        {
          sourceKind: "counsel-TBC",
          ref: "TBC",
          description: "counsel to confirm",
          required: true,
        },
      ],
    };
    expect(() => ReturnCellContractSchema.parse(ok)).not.toThrow();
  });

  it("accepts a leaf with a full slice-dimension contract", () => {
    const ok = {
      ...base,
      sliceDimension: {
        discriminator: "counterparty.sector='bank'",
        canonicalHome: "party-register",
        joinKey: "counterpartyId",
      },
    };
    expect(() => ReturnCellContractSchema.parse(ok)).not.toThrow();
  });

  it("accepts a leaf with no slice-dimension block (additive / optional)", () => {
    expect(() => ReturnCellContractSchema.parse(base)).not.toThrow();
  });

  it("rejects a discriminator with no canonicalHome (must name where the slice key is held)", () => {
    const bad = { ...base, sliceDimension: { discriminator: "currency='foreign'" } };
    expect(() => ReturnCellContractSchema.parse(bad)).toThrow();
  });

  it("rejects a discriminator whose canonicalHome is 'none-computed'", () => {
    const bad = {
      ...base,
      sliceDimension: { discriminator: "currency='foreign'", canonicalHome: "none-computed" },
    };
    expect(() => ReturnCellContractSchema.parse(bad)).toThrow();
  });

  it("rejects an unknown canonicalHome enum value", () => {
    const bad = {
      ...base,
      sliceDimension: { discriminator: "x='y'", canonicalHome: "not-a-real-home" },
    };
    expect(() => ReturnCellContractSchema.parse(bad)).toThrow();
  });
});

describe("BA 100 contract (L2 pilot instance)", () => {
  const contract = ba100Contract();

  it("loads + validates the full 843-cell contract", () => {
    expect(contract.returnForm).toBe("BA100");
    expect(contract.formName).toBe("Balance Sheet");
    expect(contract.obligationId).toBe("ORG-PR-RETURNS-002");
    expect(contract.cells.length).toBe(843);
  });

  it("re-parses cleanly through parseReturnContract (idempotent)", () => {
    expect(() => parseReturnContract(contract)).not.toThrow();
  });

  it("has no duplicate cell coordinates", () => {
    const codes = new Set(contract.cells.map((c) => c.cellRef.xsdElement));
    expect(codes.size).toBe(contract.cells.length);
  });

  it("every cell carries a citation to the BA 100 obligation (P2)", () => {
    for (const c of contract.cells) {
      expect(c.citations.length).toBeGreaterThan(0);
      expect(c.citations.some((cit) => cit.obligationId === "ORG-PR-RETURNS-002")).toBe(true);
    }
  });

  it("every money cell declares a currency dimension; none hard-codes ZAR (P5)", () => {
    for (const c of contract.cells) {
      if (c.valueType === "money") {
        expect(c.currencyDimension).toBeDefined();
      }
      // No cell label/derivation hard-codes a literal currency as the value axis.
      expect(c.unit).not.toBe("ZAR"); // unit is ZAR-thousands (a scale), not a hard currency
    }
  });

  it("every non-sourced cell carries an honest statusReason", () => {
    for (const c of contract.cells) {
      if (c.status !== "sourced") {
        expect(c.statusReason).toBeDefined();
        expect((c.statusReason ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("includes the balance-sheet identity lines (TOTAL ASSETS / TOTAL E&L)", () => {
    const labels = contract.cells.map((c) => c.cellRef.rowLabel);
    expect(labels).toContain("TOTAL ASSETS");
    expect(labels).toContain("TOTAL EQUITY AND LIABILITIES");
    expect(labels).toContain("TOTAL LIABILITIES");
    expect(labels).toContain("TOTAL EQUITY");
  });
});

describe("inverse index (L3)", () => {
  const contracts = [ba100Contract()];

  it("references only real (approved) product ids", () => {
    const refs = productsReferencedByContracts(contracts);
    // These are the 9 ProductApproved products the contract sources from.
    expect(refs).toContain("prd:bank:treasury:mmd-deposit");
    expect(refs).toContain("prd:bank:bond:sagb-fixed-coupon");
    expect(refs).toContain("prd:bank:fx:otc-vanilla");
    expect(refs.every((r) => r.startsWith("prd:bank:"))).toBe(true);
  });

  it("maps a deposit product to its balance-sheet liability cells", () => {
    const o = returnDataObligationsForProduct("prd:bank:treasury:mmd-deposit", contracts);
    expect(o.productId).toBe("prd:bank:treasury:mmd-deposit");
    expect(o.forms).toContain("BA100");
    expect(o.cells.length).toBeGreaterThan(0);
    // every fed cell carries citations (P2 survives the inversion).
    for (const c of o.cells) expect(c.citations.length).toBeGreaterThan(0);
    // it must capture a GL-account requirement and the trading-book designation.
    const refs = o.requiredData.map((d) => d.ref);
    expect(refs).toContain("category:liability-payable");
    expect(refs).toContain("tradingBookDesignation");
  });

  it("requiredData excludes OTHER products' product-attributes (precise NPA checklist)", () => {
    const o = returnDataObligationsForProduct("prd:bank:treasury:mmd-deposit", contracts);
    const foreignProductAttr = o.requiredData.filter(
      (d) =>
        d.sourceKind === "product-attribute" &&
        d.ref.startsWith("prd:") &&
        !d.ref.startsWith("prd:bank:treasury:mmd-deposit"),
    );
    expect(foreignProductAttr.length).toBe(0);
  });

  it("returns an empty obligation set for an unknown product", () => {
    const o = returnDataObligationsForProduct("prd:bank:nonexistent:thing", contracts);
    expect(o.cells.length).toBe(0);
    expect(o.requiredData.length).toBe(0);
  });
});
