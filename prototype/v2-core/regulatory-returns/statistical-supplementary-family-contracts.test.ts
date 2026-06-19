// v2-core/regulatory-returns/statistical-supplementary-family-contracts.test.ts
//
// Unit tests for the STATISTICAL (BA 920 / BA 930 / BA 94x) + SUPPLEMENTARY
// (CVA / FRTB) return contracts — Phase C batch 8 (D-BA-RETURN-DATA-CONTRACT).
// Pure — no event store (contracts are reference data, P1 Plane A).
//
// BA 920 (Analysis of instalment-sale credit, leasing finance and selected
// assets) DISAGGREGATES the bank's instalment-sale / leasing book by finance type
// and financed asset class — so it DOES carry genuine product-attribute
// requirements (financeType / financedAssetClass) on a FUTURE instalment-sale /
// leasing product. BA 930 (Weighted-average interest rates on loans and deposits)
// and the BA 94x Locational Banking Statistics series (BA 941–944) are AGGREGATE /
// entity-level statistical returns — a portfolio weighted-average rate and total
// claims / liabilities by instrument / currency / country — so they carry ZERO
// product-attribute requirements (no bulk-marking, no fabrication).
//
// CVA (Credit Valuation Adjustment) + FRTB (Fundamental Review of the Trading
// Book) are the SUPPLEMENTARY market-risk returns. Their XSD leaf cells carry the
// `MR########` element code (the generator + recon accept both BA / MR prefixes).
// FRTB is the STANDALONE Fundamental Review of the Trading Book return on its OWN
// identity — NOT BA 320 (Market Risk) and NOT BA 325 (Selected Risk Exposure). Both
// carry product-attribute requirements on FUTURE, UNAPPROVED product ids
// (prd:bank:derivative:otc / prd:bank:trading:frtb-instrument) so the live FX
// product (prd:bank:fx:otc-vanilla) is NEVER wrongly bound.
//
// HONEST STATUS: the whole batch is WHOLLY licence-day-data — there is no real
// instalment-sale / leasing book, no real loan / deposit rates, no real cross-
// border claims, no real derivative counterparty book and no real trading book
// pre-licence-day. No cell is `sourced`; marking any would be a fabrication.
//
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import type { ReturnForm } from "./cell-contract";
import { returnDataObligationsForProduct } from "./inverse-index";
import { allReturnContracts, loadReturnContract } from "./return-contracts";

const STATSUPP_FORMS: readonly ReturnForm[] = ["BA920", "BA930", "BA94x", "CVA", "FRTB"];

// The FUTURE product ids the batch binds (unapproved — never the live FX product).
const BA920_PRODUCT = "prd:bank:credit:instalment-sale-lease";
const CVA_PRODUCT = "prd:bank:derivative:otc";
const FRTB_PRODUCT = "prd:bank:trading:frtb-instrument";

interface ExpectedForm {
  form: ReturnForm;
  name: string;
  obligation: string;
  cells: number;
  /** The future product id this form binds, or null if it binds none. */
  productId: string | null;
}

const EXPECTED: ExpectedForm[] = [
  {
    form: "BA920",
    name: "Analysis of instalment-sale credit, leasing finance and selected assets",
    obligation: "ORG-PR-RETURNS-025",
    cells: 493,
    productId: BA920_PRODUCT,
  },
  {
    form: "BA930",
    name: "Weighted-average interest rates on loans and deposits",
    obligation: "ORG-PR-RETURNS-026",
    cells: 795,
    productId: null, // aggregate weighted-average rate — no product-static attribute
  },
  {
    form: "BA94x",
    name: "Locational Banking Statistics (BA 941–944 series)",
    obligation: "ORG-PR-RETURNS-027",
    cells: 1133, // DISTINCT XSD leaf cells (deduplicated across BA 941–944 sub-forms)
    productId: null, // aggregate locational statistics — no product-static attribute
  },
  {
    form: "CVA",
    name: "Credit Valuation Adjustment",
    obligation: "ORG-PR-RETURNS-030",
    cells: 53,
    productId: CVA_PRODUCT,
  },
  {
    form: "FRTB",
    name: "Fundamental Review of the Trading Book",
    obligation: "ORG-PR-RETURNS-031",
    cells: 5015,
    productId: FRTB_PRODUCT,
  },
];

/** All product-attribute refs across a form's cells. */
function productAttrRefs(form: ReturnForm): string[] {
  const contract = loadReturnContract(form);
  const refs: string[] = [];
  for (const cell of contract.cells) {
    for (const d of cell.dataRequirements) {
      if (d.sourceKind === "product-attribute") refs.push(d.ref);
    }
  }
  return refs;
}

describe("statistical + supplementary registry membership (29-return registry)", () => {
  it("registers BA 920 / BA 930 / BA 94x / CVA / FRTB", () => {
    const all = allReturnContracts().map((c) => c.returnForm);
    for (const f of STATSUPP_FORMS) expect(all).toContain(f);
  });

  it("the registry now spans exactly 29 authored returns", () => {
    expect(allReturnContracts().length).toBe(29);
  });
});

describe("canonical identities (FRTB on its OWN identity, NOT BA 320 / BA 325)", () => {
  it("FRTB is the standalone Fundamental Review of the Trading Book return", () => {
    const contract = loadReturnContract("FRTB");
    expect(contract.returnForm).toBe("FRTB");
    expect(contract.formName).toBe("Fundamental Review of the Trading Book");
    expect(contract.obligationId).toBe("ORG-PR-RETURNS-031");
  });

  it("FRTB is distinct from BA 320 (Market Risk) and BA 325 (Selected Risk Exposure)", () => {
    const frtb = loadReturnContract("FRTB");
    const ba320 = loadReturnContract("BA320");
    const ba325 = loadReturnContract("BA325");
    expect(frtb.returnForm).not.toBe(ba320.returnForm);
    expect(frtb.returnForm).not.toBe(ba325.returnForm);
    // FRTB's fold is the standalone FRTB market-risk fold, NOT BA 320's fold.
    const frtbFolds = new Set(
      frtb.cells.flatMap((c) => c.dataRequirements.map((d) => d.ref)),
    );
    expect(frtbFolds.has("frtb-market-risk-fold")).toBe(true);
    expect(frtbFolds.has("ba320-market-risk-fold")).toBe(false);
  });

  it("CVA is the Credit Valuation Adjustment return", () => {
    const contract = loadReturnContract("CVA");
    expect(contract.formName).toBe("Credit Valuation Adjustment");
    expect(contract.obligationId).toBe("ORG-PR-RETURNS-030");
  });
});

describe.each(EXPECTED)("$form — statistical/supplementary contract", (exp) => {
  const contract = loadReturnContract(exp.form);

  it(`loads all ${exp.cells} distinct leaf cells with the right identity`, () => {
    expect(contract.returnForm).toBe(exp.form);
    expect(contract.formName).toBe(exp.name);
    expect(contract.obligationId).toBe(exp.obligation);
    expect(contract.cells.length).toBe(exp.cells);
  });

  it("has no duplicate cell entries (one entry per distinct XSD leaf code)", () => {
    const codes = contract.cells.map((c) => c.cellRef.xsdElement);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("is WHOLLY licence-day-data with an honest statusReason (no fabricated sourced cell)", () => {
    for (const cell of contract.cells) {
      expect(cell.status).toBe("licence-day-data");
      expect(cell.statusReason?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it("every cell carries ≥1 citation to the form's obligation", () => {
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
        expect(dim === "functional" || dim === "by-currency" || dim === "reporting").toBe(true);
      } else {
        expect(cell.currencyDimension).toBeUndefined();
      }
    }
  });

  it("only binds its OWN future product id (never the live FX product)", () => {
    const refs = productAttrRefs(exp.form);
    for (const ref of refs) {
      if (ref.startsWith("prd:")) {
        const pid = ref.split("#")[0];
        expect(pid).not.toBe("prd:bank:fx:otc-vanilla");
        if (exp.productId !== null) expect(pid).toBe(exp.productId);
      }
    }
  });
});

describe("aggregate statistical returns carry ZERO product-attribute requirements", () => {
  it("BA 930 (weighted-average rates) binds no product attribute", () => {
    expect(productAttrRefs("BA930").length).toBe(0);
  });

  it("BA 94x (locational statistics) binds no product attribute", () => {
    expect(productAttrRefs("BA94x").length).toBe(0);
  });
});

describe("BA 920 carries real instalment-sale / leasing product attributes", () => {
  it("references the future instalment-sale / leasing product on the finance-type / asset-class axes", () => {
    const refs = new Set(productAttrRefs("BA920"));
    expect([...refs].some((r) => r.startsWith(`${BA920_PRODUCT}#`))).toBe(true);
    expect(refs.has(`${BA920_PRODUCT}#financeType`)).toBe(true);
    expect(refs.has(`${BA920_PRODUCT}#financedAssetClass`)).toBe(true);
  });
});

describe("CVA / FRTB carry real market-risk product attributes (MR-prefix forms)", () => {
  it("CVA references the future OTC-derivative product (cvaApproach / derivativeType)", () => {
    const refs = new Set(productAttrRefs("CVA"));
    expect(refs.has(`${CVA_PRODUCT}#cvaApproach`)).toBe(true);
    expect(refs.has(`${CVA_PRODUCT}#derivativeType`)).toBe(true);
  });

  it("FRTB references the future trading-book product (frtbRiskClass / tradingBookDesignation / marketRiskApproach)", () => {
    const refs = new Set(productAttrRefs("FRTB"));
    expect(refs.has(`${FRTB_PRODUCT}#frtbRiskClass`)).toBe(true);
    expect(refs.has(`${FRTB_PRODUCT}#tradingBookDesignation`)).toBe(true);
    expect(refs.has(`${FRTB_PRODUCT}#marketRiskApproach`)).toBe(true);
  });

  it("CVA / FRTB cells carry the MR-prefix XSD element code", () => {
    for (const form of ["CVA", "FRTB"] as const) {
      const contract = loadReturnContract(form);
      // every leaf cell code is an MR######## market-risk element code.
      expect(contract.cells.every((c) => /^MR\d{8}$/.test(c.cellRef.xsdElement))).toBe(true);
    }
  });
});

describe("BA 94x multi-sub-form handling (BA 941–944, shared XSD leaves deduplicated)", () => {
  it("preserves the BA 941–944 sub-form context in cell labels", () => {
    const contract = loadReturnContract("BA94x");
    // At least one cell names a BA 941–944 sub-form in its label (the sub-form
    // identity is folded in since the framework cellRef has no sub-form axis).
    const namesSubForm = contract.cells.some((c) => /BA94[1-4]/.test(c.label));
    expect(namesSubForm).toBe(true);
  });

  it("the shared cross-series leaf is carried once and named as series-wide", () => {
    const contract = loadReturnContract("BA94x");
    const shared = contract.cells.filter((c) =>
      c.label.includes("shared across the BA 941–944 series"),
    );
    // exactly the single reused country-code dimension is marked shared, once.
    expect(shared.length).toBe(1);
  });
});

describe("the batch binds NO live product to a wrong return (gate coherence — FX not blocked)", () => {
  it("the live FX product is bound to none of the batch-8 returns", () => {
    const fx = returnDataObligationsForProduct("prd:bank:fx:otc-vanilla", allReturnContracts());
    const batchForms = fx.forms.filter((f) => STATSUPP_FORMS.includes(f));
    expect(batchForms.length).toBe(0);
  });
});
