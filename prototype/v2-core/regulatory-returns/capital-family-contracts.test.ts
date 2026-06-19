// v2-core/regulatory-returns/capital-family-contracts.test.ts
//
// Unit tests for the capital-family return contracts (BA 700, BA 701) and the
// KEY property that distinguishes them from every prior batch: capital is
// GL-/RWA-derived, so the family carries ZERO product-attribute requirements
// (D-BA-RETURN-DATA-CONTRACT Phase C batch 5). Pure — no event store (contracts
// are reference data, P1 Plane A).
//
// BA 700 (Capital Adequacy and Leverage and TLAC) is the apex prudential return:
// the CET1 / Tier 1 / Total capital ratios, the leverage ratio and TLAC. Its
// NUMERATOR is the bank's own capital-classified GL; its DENOMINATOR (total RWA)
// aggregates the OTHER returns' RWA (credit BA 200 + market BA 320 + operational
// BA 400 + CCR + CVA + equity). Neither side keys off a product-static menu
// attribute — so no capital cell gates a product, and the live FX product is
// never bound. The regulatory MINIMUM-REQUIRED ratios + buffer add-ons + the
// specified minimum leverage ratio are computed from BCBS / Reg-38 CONSTANTS
// (platform/reporting/ba-700-capital.ts computeRequiredMinimums +
// BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS; ba-700-leverage-ratio.ts
// BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM) → those cells are `sourced`; every
// achieved-capital / RWA / ratio / excess-shortfall / TLAC cell needs REAL
// capital the bank does not hold pre-licence-day (the R300m is a licence-day
// target) → `licence-day-data`.
//
// BA 701 (Regulatory vs Economic Capital) reconciles the Pillar-1 regulatory
// charge per risk type to the internal economic-capital demand — wholly
// licence-day (the ICAAP economic-capital model output does not exist pre-
// licence-day).
//
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import type { ReturnForm } from "./cell-contract";
import { returnDataObligationsForProduct } from "./inverse-index";
import { allReturnContracts, loadReturnContract } from "./return-contracts";

const CAPITAL_FORMS: readonly ReturnForm[] = ["BA700", "BA701"];

interface ExpectedCapitalForm {
  form: ReturnForm;
  name: string;
  obligation: string;
  cells: number;
  /** whether the form carries ≥1 `sourced` cell (regulatory-constant substrate). */
  hasSourcedCells: boolean;
}

const EXPECTED: ExpectedCapitalForm[] = [
  {
    form: "BA700",
    name: "Capital Adequacy and Leverage and TLAC",
    obligation: "ORG-PR-RETURNS-022",
    cells: 474,
    // The regulatory minimum-required ratios + buffer add-ons + specified minimum
    // leverage ratio compute from BCBS / Reg-38 constants (no real capital needed).
    hasSourcedCells: true,
  },
  {
    form: "BA701",
    name: "Regulatory vs Economic Capital",
    obligation: "ORG-PA-033",
    cells: 418,
    // Wholly licence-day — the ICAAP economic-capital model output + real positions
    // do not exist pre-licence-day.
    hasSourcedCells: false,
  },
];

/** Count of product-attribute dataRequirements across a form (must be 0 for capital). */
function productAttrCount(form: ReturnForm): number {
  const contract = loadReturnContract(form);
  let n = 0;
  for (const cell of contract.cells) {
    for (const d of cell.dataRequirements) {
      if (d.sourceKind === "product-attribute") n += 1;
    }
  }
  return n;
}

describe("capital-family registry membership", () => {
  it("registers BA 700 / BA 701", () => {
    const all = allReturnContracts().map((c) => c.returnForm);
    for (const f of CAPITAL_FORMS) expect(all).toContain(f);
  });
});

describe("capital canonical identity (NOT the fabricated BA 100 scheme)", () => {
  it("BA 700 is the Capital Adequacy and Leverage and TLAC return (apex prudential)", () => {
    const contract = loadReturnContract("BA700");
    expect(contract.formName).toBe("Capital Adequacy and Leverage and TLAC");
    expect(contract.obligationId).toBe("ORG-PR-RETURNS-022");
  });

  it("BA 701 is the Regulatory vs Economic Capital reconciliation return", () => {
    const contract = loadReturnContract("BA701");
    expect(contract.formName).toBe("Regulatory vs Economic Capital");
    expect(contract.obligationId).toBe("ORG-PA-033");
  });

  it("BA 100 is the Balance Sheet (capital adequacy is NOT BA 100)", () => {
    // The contract for BA 100 must declare the balance-sheet identity — capital
    // adequacy lives on BA 700, not BA 100 (the corrected canonical scheme).
    expect(loadReturnContract("BA100").formName).toBe("Balance Sheet");
  });
});

describe.each(EXPECTED)("$form — capital-family contract", (exp) => {
  const contract = loadReturnContract(exp.form);

  it(`loads all ${exp.cells} XSD leaf cells with the right identity`, () => {
    expect(contract.returnForm).toBe(exp.form);
    expect(contract.formName).toBe(exp.name);
    expect(contract.obligationId).toBe(exp.obligation);
    expect(contract.cells.length).toBe(exp.cells);
  });

  it("carries ZERO product-attribute requirements (capital is GL-/RWA-derived)", () => {
    // THE defining capital-family property: capital cells are not product-gated.
    // The numerator is the bank's own capital-classified GL; the denominator
    // aggregates the other returns' RWA. No product-static attribute is owed —
    // and none is manufactured (no bulk-marking; Engineering Charter — no
    // fabrication).
    expect(productAttrCount(exp.form)).toBe(0);
  });

  it("every cell is sourced OR licence-day-data with an honest statusReason", () => {
    for (const cell of contract.cells) {
      expect(["sourced", "licence-day-data"]).toContain(cell.status);
      if (cell.status !== "sourced") {
        expect(cell.statusReason?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("sourced-cell presence matches the regulatory-constant-substrate expectation (honest)", () => {
    const sourced = contract.cells.filter((c) => c.status === "sourced");
    expect(sourced.length > 0).toBe(exp.hasSourcedCells);
  });

  it("every cell carries ≥1 citation to the form's capital obligation", () => {
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
        // Capital is functional by default, by-currency only for the genuine
        // multi-currency CET1 reserve cells (FX-translation / net-investment
        // hedge) — never a literal currency.
        expect(dim === "functional" || dim === "by-currency").toBe(true);
        expect(cell.unit).toBe("ZAR-thousands");
      } else {
        expect(cell.currencyDimension).toBeUndefined();
      }
    }
  });
});

describe("BA 700 status split (licence-day-heavy, regulatory-constant cells sourced)", () => {
  it("the sourced cells are the regulatory minimum / buffer / specified-minimum cells", () => {
    const contract = loadReturnContract("BA700");
    const sourced = contract.cells.filter((c) => c.status === "sourced");
    expect(sourced.length).toBe(56);
    // Each sourced cell's row/column must name a regulatory MINIMUM / buffer /
    // specified-minimum / base-minimum (computed from a constant, not from real
    // capital). No achieved-capital cell may be sourced.
    const minimumKeywords = [
      "minimum required",
      "base minimum",
      "base minima",
      "add-on",
      "specified minimum leverage ratio",
      "specified buffer requirement",
    ];
    for (const cell of sourced) {
      const text = `${cell.cellRef.rowLabel ?? ""} ${cell.cellRef.columnLabel ?? ""}`.toLowerCase();
      expect(minimumKeywords.some((k) => text.includes(k))).toBe(true);
    }
  });

  it("every sourced cell has no statusReason (it genuinely computes today)", () => {
    const contract = loadReturnContract("BA700");
    for (const cell of contract.cells) {
      if (cell.status === "sourced") {
        expect(cell.statusReason).toBeUndefined();
      }
    }
  });
});

describe("BA 701 is wholly licence-day-data", () => {
  it("has no sourced cells (the ICAAP economic-capital model output does not exist yet)", () => {
    const contract = loadReturnContract("BA701");
    const sourced = contract.cells.filter((c) => c.status === "sourced");
    expect(sourced.length).toBe(0);
  });
});

describe("capital family binds NO product (gate coherence)", () => {
  it("the live FX product is bound to no capital return", () => {
    const fx = returnDataObligationsForProduct("prd:bank:fx:otc-vanilla", allReturnContracts());
    const capitalForms = fx.forms.filter((f) => CAPITAL_FORMS.includes(f));
    expect(capitalForms.length).toBe(0);
  });

  it("no capital cell references any prd: product attribute at all", () => {
    for (const form of CAPITAL_FORMS) {
      const contract = loadReturnContract(form);
      for (const cell of contract.cells) {
        for (const d of cell.dataRequirements) {
          expect(d.ref.startsWith("prd:")).toBe(false);
        }
      }
    }
  });
});
