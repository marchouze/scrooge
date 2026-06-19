// v2-core/regulatory-returns/market-family-contracts.test.ts
//
// Unit tests for the market-family return contracts (BA 320, BA 325, BA 330,
// BA 340, BA 350) and their product-attribute binding (D-BA-RETURN-DATA-CONTRACT
// Phase C batch 4). Pure — no event store (contracts are reference data, P1
// Plane A).
//
// The market family is the FIRST batch to mix LIVE substrate with future-product
// gating: BA 320 (Market Risk) has the live ba-320-market-risk.ts standardised-
// position-risk fold + the FX adapter + the VaR engine, so its FX-risk-class
// aggregate cells are `sourced`, while every BA 325 (trading & treasury selected
// risk) / BA 330 (IRRBB) / BA 340 (equity risk in the banking book) / BA 350
// (derivatives instruments) cell is `licence-day-data` (the folds exist but no
// real trading-book / treasury / banking-book / derivative positions exist pre-
// licence-day). The product-static attributes (trading-book designation, risk
// class, rate type, equity holding class, derivative type) attach to FUTURE,
// unapproved market product ids, so the live FX product is never wrongly blocked.
//
// ★ BA 325 IDENTITY GUARD: BA 325 is built on its canonical "Selected Risk
//   Exposure Arising from Trading and Treasury Activities" identity — NOT FRTB.
//   Market risk proper is BA 320; the FRTB-SA charge feeds BA 320; the standalone
//   FRTB workbook is the separate schemas/FRTB.zip. These tests pin that identity.
//
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import type { ReturnForm } from "./cell-contract";
import { returnDataObligationsForProduct } from "./inverse-index";
import { allReturnContracts, loadReturnContract } from "./return-contracts";

// The three future market products the family binds (none approved pre-licence-
// day; the live FX product `prd:bank:fx:otc-vanilla` feeds none of them).
const TRADING_PRODUCT_ID = "prd:bank:trading:market-risk-position";
const IRRBB_PRODUCT_ID = "prd:bank:banking-book:irrbb-position";
const EQUITY_BB_PRODUCT_ID = "prd:bank:banking-book:equity-holding";
const MARKET_PRODUCT_IDS = [TRADING_PRODUCT_ID, IRRBB_PRODUCT_ID, EQUITY_BB_PRODUCT_ID];
const MARKET_FORMS: readonly ReturnForm[] = ["BA320", "BA325", "BA330", "BA340", "BA350"];

interface ExpectedMarketForm {
  form: ReturnForm;
  name: string;
  obligation: string;
  cells: number;
  /** distinct product-attributes this form marks required:true. */
  requiredAttrs: string[];
  /** whether the form carries ≥1 `sourced` cell (live substrate). */
  hasSourcedCells: boolean;
}

const EXPECTED: ExpectedMarketForm[] = [
  {
    form: "BA320",
    name: "Market Risk",
    obligation: "ORG-PR-RETURNS-012",
    cells: 304,
    requiredAttrs: ["riskClass"],
    hasSourcedCells: true, // FX-risk-class aggregate cells have live FX substrate
  },
  {
    form: "BA325",
    name: "Selected Risk Exposure Arising from Trading and Treasury Activities",
    obligation: "ORG-PR-RETURNS-013",
    cells: 409,
    requiredAttrs: ["riskClass"],
    hasSourcedCells: false, // no live trading/treasury selected-risk book pre-licence-day
  },
  {
    form: "BA330",
    name: "Interest Rate Risk: Banking Book (IRRBB)",
    obligation: "ORG-PR-RETURNS-014",
    cells: 1722,
    requiredAttrs: ["rateType"],
    hasSourcedCells: false,
  },
  {
    form: "BA340",
    name: "Equity Risk in the Banking Book",
    obligation: "ORG-PR-RETURNS-015",
    cells: 183,
    requiredAttrs: ["equityHoldingClass", "equityRiskWeightMethod"],
    hasSourcedCells: false,
  },
  {
    form: "BA350",
    name: "Derivatives Instruments",
    obligation: "ORG-PR-RETURNS-016",
    cells: 1410,
    requiredAttrs: ["derivativeType"],
    hasSourcedCells: false,
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

describe("market-family registry membership", () => {
  it("registers BA 320 / BA 325 / BA 330 / BA 340 / BA 350", () => {
    const all = allReturnContracts().map((c) => c.returnForm);
    for (const f of MARKET_FORMS) expect(all).toContain(f);
  });
});

describe("BA 325 canonical identity (NOT FRTB)", () => {
  it("is named the Selected-Risk-Exposure return, not FRTB / not market-risk / not LCR", () => {
    const contract = loadReturnContract("BA325");
    expect(contract.formName).toBe(
      "Selected Risk Exposure Arising from Trading and Treasury Activities",
    );
    expect(contract.formName.toUpperCase()).not.toContain("FRTB");
    expect(contract.obligationId).toBe("ORG-PR-RETURNS-013");
  });

  it("market risk proper is BA 320 (Market Risk), distinct from BA 325", () => {
    expect(loadReturnContract("BA320").formName).toBe("Market Risk");
  });
});

describe.each(EXPECTED)("$form — market-family contract", (exp) => {
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

  it("sourced-cell presence matches the live-substrate expectation (honest)", () => {
    const sourced = contract.cells.filter((c) => c.status === "sourced");
    expect(sourced.length > 0).toBe(exp.hasSourcedCells);
  });

  it("no sourced cell carries a required unapproved-product attribute (gate coherence)", () => {
    // A `sourced` cell whose required product-attribute names an unapproved future
    // product would be rejected by recon:ba-return-cell-contract; the generator
    // forces such a cell to licence-day-data. Assert that invariant.
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

  it("every cell carries ≥1 citation to the form's market obligation", () => {
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
        // Market risk is functional by default, by-currency where the row/column
        // names a currency / risk-class currency axis — never literal ZAR.
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

  it("only references the future market products (never the live FX product)", () => {
    for (const cell of contract.cells) {
      for (const d of cell.dataRequirements) {
        if (d.sourceKind === "product-attribute" && d.ref.startsWith("prd:")) {
          const pid = d.ref.split("#")[0] ?? d.ref;
          expect(MARKET_PRODUCT_IDS).toContain(pid);
          expect(d.ref).not.toContain("prd:bank:fx:otc-vanilla");
        }
      }
    }
  });
});

describe("inverse index for the future market products", () => {
  it("binds the trading product to its risk-class / derivative-type attributes", () => {
    const o = returnDataObligationsForProduct(TRADING_PRODUCT_ID, allReturnContracts());
    const required = o.requiredData
      .filter((d) => d.sourceKind === "product-attribute" && d.required && d.ref.includes("#"))
      .map((d) => d.ref.split("#")[1] ?? "")
      .sort();
    // The trading product's required NPA checklist across the market family.
    expect(required).toEqual(["derivativeType", "riskClass"]);
    for (const f of ["BA320", "BA325", "BA350"] as const) expect(o.forms).toContain(f);
  });

  it("binds the IRRBB product to its rate-type attribute", () => {
    const o = returnDataObligationsForProduct(IRRBB_PRODUCT_ID, allReturnContracts());
    const required = o.requiredData
      .filter((d) => d.sourceKind === "product-attribute" && d.required && d.ref.includes("#"))
      .map((d) => d.ref.split("#")[1] ?? "")
      .sort();
    expect(required).toEqual(["rateType"]);
    expect(o.forms).toContain("BA330");
  });

  it("binds the banking-book equity product to its holding-class / method attributes", () => {
    const o = returnDataObligationsForProduct(EQUITY_BB_PRODUCT_ID, allReturnContracts());
    const required = o.requiredData
      .filter((d) => d.sourceKind === "product-attribute" && d.required && d.ref.includes("#"))
      .map((d) => d.ref.split("#")[1] ?? "")
      .sort();
    expect(required).toEqual(["equityHoldingClass", "equityRiskWeightMethod"]);
    expect(o.forms).toContain("BA340");
  });

  it("does not put the live FX product into any market return-data obligation", () => {
    const fx = returnDataObligationsForProduct("prd:bank:fx:otc-vanilla", allReturnContracts());
    const marketForms = fx.forms.filter((f) => MARKET_FORMS.includes(f));
    expect(marketForms.length).toBe(0);
  });
});
