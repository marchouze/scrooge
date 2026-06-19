// v2-core/regulatory-returns/financial-family-contracts.test.ts
//
// Unit tests for the financial-family return contracts (BA 110, BA 120,
// BA 600, BA 610) and the return-contract registry (D-BA-RETURN-DATA-CONTRACT
// Phase C batch 1). Pure — no event store (contracts are reference data, P1
// Plane A).
//
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import { type ReturnForm, parseReturnContract } from "./cell-contract";
import {
  RETURN_CONTRACT_REGISTRY,
  allReturnContracts,
  loadReturnContract,
} from "./return-contracts";

// Expected cell counts = the typed BA-code leaf-cell set of each form's XSD
// (independently verified from the schema zip; see gen-return-contract.py).
const EXPECTED: ReadonlyArray<{
  form: ReturnForm;
  name: string;
  obligation: string;
  cells: number;
  // whether the whole form is licence-day-data (no group / no foreign ops yet).
  licenceDay: boolean;
}> = [
  {
    form: "BA110",
    name: "Off-Balance-Sheet Activities",
    obligation: "ORG-PR-RETURNS-003",
    cells: 130,
    licenceDay: false,
  },
  {
    form: "BA120",
    name: "Income Statement",
    obligation: "ORG-PR-RETURNS-004",
    cells: 778,
    licenceDay: false,
  },
  {
    form: "BA600",
    name: "Consolidated Return",
    obligation: "ORG-PR-RETURNS-020",
    cells: 491,
    licenceDay: true,
  },
  {
    form: "BA610",
    name: "Foreign Operations of South African Banks",
    obligation: "ORG-PR-RETURNS-021",
    cells: 2738,
    licenceDay: true,
  },
];

describe("return-contract registry", () => {
  it("registers BA 100 plus the four financial-family forms", () => {
    const forms = RETURN_CONTRACT_REGISTRY.map((e) => e.form);
    expect(forms).toEqual(["BA100", "BA110", "BA120", "BA600", "BA610"]);
  });

  it("allReturnContracts() loads + validates every registered form", () => {
    const all = allReturnContracts();
    expect(all.length).toBe(RETURN_CONTRACT_REGISTRY.length);
    for (const c of all) expect(() => parseReturnContract(c)).not.toThrow();
  });

  it("each registry entry's JSON declares the matching returnForm (provenance)", () => {
    for (const entry of RETURN_CONTRACT_REGISTRY) {
      expect(loadReturnContract(entry.form).returnForm).toBe(entry.form);
    }
  });
});

describe.each(EXPECTED)("$form — $name", (exp) => {
  const contract = loadReturnContract(exp.form);

  it(`loads all ${exp.cells} XSD leaf cells`, () => {
    expect(contract.returnForm).toBe(exp.form);
    expect(contract.formName).toBe(exp.name);
    expect(contract.obligationId).toBe(exp.obligation);
    expect(contract.cells.length).toBe(exp.cells);
  });

  it("has no duplicate cell coordinates", () => {
    const codes = new Set(contract.cells.map((c) => c.cellRef.xsdElement));
    expect(codes.size).toBe(contract.cells.length);
  });

  it("every cell cites the form's corrected obligation row (P2)", () => {
    for (const c of contract.cells) {
      expect(c.citations.length).toBeGreaterThan(0);
      expect(c.citations.some((cit) => cit.obligationId === exp.obligation)).toBe(true);
    }
  });

  it("every money cell declares a currency dimension; none hard-codes ZAR (P5)", () => {
    for (const c of contract.cells) {
      if (c.valueType === "money") {
        expect(c.currencyDimension).toBeDefined();
      } else {
        expect(c.currencyDimension).toBeUndefined();
      }
      expect(c.unit).not.toBe("ZAR"); // unit is a scale (ZAR-thousands), not a hard currency
    }
  });

  it("every non-sourced cell carries an honest statusReason (no silent gap)", () => {
    for (const c of contract.cells) {
      if (c.status !== "sourced") {
        expect((c.statusReason ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("honours the form's honesty posture (licence-day vs sourced)", () => {
    const statuses = new Set(contract.cells.map((c) => c.status));
    if (exp.licenceDay) {
      // BA 600 / BA 610: no group / no foreign ops pre-licence — every cell is
      // licence-day-data, never fabricated.
      expect(statuses).toEqual(new Set(["licence-day-data"]));
    } else {
      // BA 110 / BA 120: sourced from real substrate (memo register / GL folds).
      expect(statuses).toEqual(new Set(["sourced"]));
    }
  });

  it("does not manufacture product-attribute requirements (financial family is GL-derived)", () => {
    // The brief: do NOT manufacture product-attribute dataRequirements to make
    // the NPA gate bite. The financial family is GL-/projection-/reference-data-
    // derived, so it carries no product-attribute requirement at all.
    const productAttr = contract.cells.flatMap((c) =>
      c.dataRequirements.filter((d) => d.sourceKind === "product-attribute"),
    );
    expect(productAttr.length).toBe(0);
  });
});

describe("BA 610 multi-currency (P5)", () => {
  it("carries by-currency and reporting dimensions (foreign operations)", () => {
    const dims = new Set(
      loadReturnContract("BA610")
        .cells.filter((c) => c.valueType === "money")
        .map((c) => c.currencyDimension),
    );
    // Foreign-operation columns translate to the group reporting currency; the
    // currency-analysis columns are reported per-currency.
    expect(dims.has("reporting")).toBe(true);
    expect(dims.has("by-currency")).toBe(true);
  });
});
