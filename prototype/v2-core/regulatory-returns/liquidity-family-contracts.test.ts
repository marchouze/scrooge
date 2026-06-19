// v2-core/regulatory-returns/liquidity-family-contracts.test.ts
//
// Unit tests for the liquidity-family return contracts (BA 300, BA 310) and
// their product-attribute binding (D-BA-RETURN-DATA-CONTRACT Phase C batch 3).
// Pure — no event store (contracts are reference data, P1 Plane A).
//
// The liquidity family is the FIRST batch to carry product-attribute
// requirements on TWO product axes — the DEPOSIT / funding axis (LCR run-off +
// NSFR available-stable-funding) and the HQLA-ELIGIBLE-ASSET axis (LCR numerator
// + BA 310 liquid-asset stock) — AND the first with LIVE numerator substrate
// (the HQLA classifier + SecurityMaster + the BA-300 LCR fold), so HQLA /
// LCR-numerator cells are `sourced` while the deposit-funding / NSFR / reserve
// cells are `licence-day-data`. These tests pin the cell counts, the honest
// per-cell status split, the two future products referenced, and the precise
// `required:true` attribute set the inverse index exposes.
//
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import type { ReturnForm } from "./cell-contract";
import { returnDataObligationsForProduct } from "./inverse-index";
import { allReturnContracts, loadReturnContract } from "./return-contracts";

// The two future products the liquidity family binds (neither approved pre-
// licence-day; the live FX product feeds neither).
const DEPOSIT_PRODUCT_ID = "prd:bank:deposit:transactional";
const HQLA_PRODUCT_ID = "prd:bank:treasury:hqla-eligible-asset";
const LIQUIDITY_PRODUCT_IDS = [DEPOSIT_PRODUCT_ID, HQLA_PRODUCT_ID];

interface ExpectedLiquidityForm {
  form: ReturnForm;
  name: string;
  obligation: string;
  cells: number;
  /** distinct product-attributes this form marks required:true. */
  requiredAttrs: string[];
  /** there is at least one `sourced` HQLA / LCR-numerator cell. */
  hasSourcedCells: boolean;
}

const EXPECTED: ExpectedLiquidityForm[] = [
  {
    form: "BA300",
    name: "Liquidity Risk (includes the Liquidity Coverage Ratio (LCR) and the Net Stable Funding Ratio (NSFR) series)",
    obligation: "ORG-PR-RETURNS-010",
    cells: 1567,
    requiredAttrs: ["fundingStability", "hqlaEligibility", "hqlaLevel", "operationalRelationship"],
    hasSourcedCells: true,
  },
  {
    form: "BA310",
    name: "Minimum Liquid Reserve Balance and Liquid Assets (HQLA)",
    obligation: "ORG-PR-RETURNS-011",
    cells: 63,
    requiredAttrs: ["hqlaLevel"],
    hasSourcedCells: true,
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

describe("liquidity-family registry membership", () => {
  it("registers BA 300 / BA 310", () => {
    const all = allReturnContracts().map((c) => c.returnForm);
    for (const f of ["BA300", "BA310"] as const) expect(all).toContain(f);
  });
});

describe.each(EXPECTED)("$form — liquidity-family contract", (exp) => {
  const contract = loadReturnContract(exp.form);

  it(`loads all ${exp.cells} XSD leaf cells with the right identity`, () => {
    expect(contract.returnForm).toBe(exp.form);
    expect(contract.formName).toBe(exp.name);
    expect(contract.obligationId).toBe(exp.obligation);
    expect(contract.cells.length).toBe(exp.cells);
  });

  it("every cell is sourced OR licence-day-data with an honest statusReason", () => {
    for (const cell of contract.cells) {
      expect(["sourced", "licence-day-data"]).toContain(cell.status);
      if (cell.status !== "sourced") {
        expect(cell.statusReason?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("carries ≥1 sourced HQLA / LCR-numerator cell (live substrate, honest)", () => {
    const sourced = contract.cells.filter((c) => c.status === "sourced");
    expect(sourced.length > 0).toBe(exp.hasSourcedCells);
  });

  it("no sourced cell carries a required unapproved-product attribute (gate coherence)", () => {
    // A `sourced` cell whose required product-attribute names an unapproved
    // future product would be rejected by recon:ba-return-cell-contract; the
    // generator forces such a cell to licence-day-data. Assert that invariant.
    for (const cell of contract.cells) {
      if (cell.status !== "sourced") continue;
      for (const d of cell.dataRequirements) {
        if (d.sourceKind === "product-attribute" && d.required && d.ref.startsWith("prd:")) {
          throw new Error(
            `sourced cell ${cell.cellRef.xsdElement} carries required product ref ${d.ref}`,
          );
        }
      }
    }
  });

  it("every cell carries ≥1 citation to the form's liquidity obligation", () => {
    for (const cell of contract.cells) {
      expect(cell.citations.length).toBeGreaterThan(0);
      expect(cell.citations.some((c) => c.obligationId === exp.obligation)).toBe(true);
    }
  });

  it("every monetary cell declares a currencyDimension and no literal currency (P5)", () => {
    for (const cell of contract.cells) {
      if (cell.valueType === "money") {
        const dim = cell.currencyDimension;
        expect(dim).toBeDefined();
        // Liquidity is functional by default, by-currency where the row/column
        // names a significant-currency axis — never literal ZAR.
        expect(dim === "functional" || dim === "by-currency").toBe(true);
        expect(cell.unit).toBe("ZAR-thousands");
      } else {
        expect(cell.currencyDimension).toBeUndefined();
      }
    }
  });

  it("marks exactly the expected distinct required product-attributes", () => {
    expect(requiredAttrsOf(exp.form)).toEqual([...exp.requiredAttrs].sort());
  });

  it("only references the two future liquidity products (never the live FX product)", () => {
    for (const cell of contract.cells) {
      for (const d of cell.dataRequirements) {
        if (d.sourceKind === "product-attribute" && d.ref.startsWith("prd:")) {
          const pid = d.ref.split("#")[0] ?? d.ref;
          expect(LIQUIDITY_PRODUCT_IDS).toContain(pid);
          expect(d.ref).not.toContain("prd:bank:fx:otc-vanilla");
        }
      }
    }
  });
});

describe("inverse index for the future liquidity products", () => {
  it("binds the deposit product to its funding-stability / operational attributes", () => {
    const o = returnDataObligationsForProduct(DEPOSIT_PRODUCT_ID, allReturnContracts());
    const required = o.requiredData
      .filter((d) => d.sourceKind === "product-attribute" && d.required && d.ref.includes("#"))
      .map((d) => d.ref.split("#")[1] ?? "")
      .sort();
    // The deposit product's required NPA checklist across the liquidity family.
    expect(required).toEqual(["fundingStability", "operationalRelationship"]);
    expect(o.forms).toContain("BA300");
  });

  it("binds the HQLA-asset product to its level / eligibility attributes", () => {
    const o = returnDataObligationsForProduct(HQLA_PRODUCT_ID, allReturnContracts());
    const required = o.requiredData
      .filter((d) => d.sourceKind === "product-attribute" && d.required && d.ref.includes("#"))
      .map((d) => d.ref.split("#")[1] ?? "")
      .sort();
    // The HQLA-asset product's required NPA checklist across the liquidity family.
    expect(required).toEqual(["hqlaEligibility", "hqlaLevel"]);
    expect([...o.forms].sort()).toEqual(["BA300", "BA310"]);
  });

  it("does not put the live FX product into any liquidity return-data obligation", () => {
    const fx = returnDataObligationsForProduct("prd:bank:fx:otc-vanilla", allReturnContracts());
    const liqForms = fx.forms.filter((f) => ["BA300", "BA310"].includes(f));
    expect(liqForms.length).toBe(0);
  });
});
