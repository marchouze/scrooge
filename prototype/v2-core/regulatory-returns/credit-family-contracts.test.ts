// v2-core/regulatory-returns/credit-family-contracts.test.ts
//
// Unit tests for the credit-family return contracts (BA 200, BA 210, BA 220)
// and their product-attribute binding (D-BA-RETURN-DATA-CONTRACT Phase C batch
// 2). Pure — no event store (contracts are reference data, P1 Plane A).
//
// The credit family is the FIRST batch to carry real product-attribute
// requirements a credit product must capture; these tests pin the cell counts,
// the honest licence-day status, and the precise `required:true` attribute set
// the inverse index exposes for the future credit product.
//
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import type { ReturnForm } from "./cell-contract";
import { returnDataObligationsForProduct } from "./inverse-index";
import { allReturnContracts, loadReturnContract } from "./return-contracts";

const CREDIT_PRODUCT_ID = "prd:bank:credit:loan";

interface ExpectedCreditForm {
  form: ReturnForm;
  name: string;
  obligation: string;
  cells: number;
  /** distinct product-attributes this form marks required:true. */
  requiredAttrs: string[];
}

const EXPECTED: ExpectedCreditForm[] = [
  {
    form: "BA200",
    name: "Credit Risk (IRB + Standardised approaches; includes counterparty credit risk sub-forms)",
    obligation: "ORG-PR-RETURNS-007",
    cells: 4570,
    requiredAttrs: ["exposureClass", "lgdEstimate", "pdEstimate", "regulatoryApproach"],
  },
  {
    form: "BA210",
    name: "Credit Concentration Risk / Large Exposures (LEX); incl. watch-list",
    obligation: "ORG-PR-RETURNS-008",
    cells: 7527,
    requiredAttrs: [
      "connectedCounterpartyGroup",
      "connectionType",
      "counterpartyIdentity",
      "exposureClass",
      "exposureType",
      "industry",
      "lgdEstimate",
      "pdBucket",
      "pdEstimate",
      "regulatoryApproach",
    ],
  },
  {
    form: "BA220",
    name: "Credit Risk: Assets bought-in",
    obligation: "ORG-PR-RETURNS-009",
    cells: 30,
    requiredAttrs: ["assetBoughtInFlag", "boughtInDate"],
  },
];

/** Distinct product-attributes a single form marks required:true. */
function requiredAttrsOf(form: ReturnForm): string[] {
  const contract = loadReturnContract(form);
  const attrs = new Set<string>();
  for (const cell of contract.cells) {
    for (const d of cell.dataRequirements) {
      if (d.sourceKind === "product-attribute" && d.required && d.ref.includes("#")) {
        attrs.add(d.ref.split("#")[1] ?? "");
      }
    }
  }
  return [...attrs].sort();
}

describe("credit-family registry membership", () => {
  it("registers BA 200 / BA 210 / BA 220", () => {
    const all = allReturnContracts().map((c) => c.returnForm);
    for (const f of ["BA200", "BA210", "BA220"] as const) expect(all).toContain(f);
  });
});

describe.each(EXPECTED)("$form — credit-family contract", (exp) => {
  const contract = loadReturnContract(exp.form);

  it(`loads all ${exp.cells} XSD leaf cells with the right identity`, () => {
    expect(contract.returnForm).toBe(exp.form);
    expect(contract.formName).toBe(exp.name);
    expect(contract.obligationId).toBe(exp.obligation);
    expect(contract.cells.length).toBe(exp.cells);
  });

  it("every cell is licence-day-data with an honest statusReason (no live exposures pre-licence)", () => {
    for (const cell of contract.cells) {
      expect(cell.status).toBe("licence-day-data");
      expect(cell.statusReason?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it("every cell carries ≥1 citation to the form's credit obligation", () => {
    for (const cell of contract.cells) {
      expect(cell.citations.length).toBeGreaterThan(0);
      expect(cell.citations.some((c) => c.obligationId === exp.obligation)).toBe(true);
    }
  });

  it("every monetary cell declares a currencyDimension and no literal currency (P5)", () => {
    for (const cell of contract.cells) {
      if (cell.valueType === "money") {
        expect(cell.currencyDimension).toBeDefined();
        // unit is a scale/measure, never a currency literal other than the
        // functional-currency scale tag.
        expect(["ZAR-thousands", "ZAR-units"]).toContain(cell.unit);
      } else {
        expect(cell.currencyDimension).toBeUndefined();
      }
    }
  });

  it("marks exactly the expected distinct required product-attributes", () => {
    expect(requiredAttrsOf(exp.form)).toEqual([...exp.requiredAttrs].sort());
  });

  it("only references the future credit product (never the live FX product)", () => {
    for (const cell of contract.cells) {
      for (const d of cell.dataRequirements) {
        if (d.sourceKind === "product-attribute" && d.ref.startsWith("prd:")) {
          expect(d.ref.startsWith(`${CREDIT_PRODUCT_ID}#`)).toBe(true);
          expect(d.ref).not.toContain("prd:bank:fx:otc-vanilla");
        }
      }
    }
  });
});

describe("inverse index for the future credit product", () => {
  it("aggregates the union of the three forms' required attributes (the NPA checklist)", () => {
    const o = returnDataObligationsForProduct(CREDIT_PRODUCT_ID, allReturnContracts());
    expect([...o.forms].sort()).toEqual(["BA200", "BA210", "BA220"]);
    const required = o.requiredData
      .filter((d) => d.sourceKind === "product-attribute" && d.required && d.ref.includes("#"))
      .map((d) => d.ref.split("#")[1] ?? "")
      .sort();
    const expectedUnion = [
      ...new Set(EXPECTED.flatMap((e) => e.requiredAttrs)),
    ].sort();
    expect(required).toEqual(expectedUnion);
  });

  it("does not put the live FX product into any credit return-data obligation", () => {
    const fx = returnDataObligationsForProduct("prd:bank:fx:otc-vanilla", allReturnContracts());
    // The FX product feeds no credit product-attribute cell across the credit family.
    const creditForms = fx.forms.filter((f) => ["BA200", "BA210", "BA220"].includes(f));
    expect(creditForms.length).toBe(0);
  });
});
