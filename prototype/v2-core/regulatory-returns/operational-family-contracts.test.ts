// v2-core/regulatory-returns/operational-family-contracts.test.ts
//
// Unit tests for the operational-family return contracts (BA 400, BA 410,
// BA 420) and the KEY property they share with the capital family: operational
// risk is gross-income- and loss-event-derived (ENTITY-LEVEL), so the family
// carries ZERO product-attribute requirements (D-BA-RETURN-DATA-CONTRACT Phase C
// batch 6). Pure — no event store (contracts are reference data, P1 Plane A).
//
// BA 400 (Operational Risk) is the op-risk capital return: BIA / TSA capital on
// annual gross income; op-RWA = 12.5 × op-capital, feeding the BA 700 total-RWA
// denominator. BA 410 (Operational Risk: Quarterly Losses) and BA 420 (12-Months
// Rolling Losses) capture individual operational-loss events by Basel business
// line + risk-event type. None keys off a product-static menu attribute — so no
// operational cell gates a product, and the live FX product is never bound.
//
// HONEST STATUS: the family is WHOLLY licence-day-data. The BIA α / business-line
// β / 12.5× RWA constants are real Basel II bcbs128 / Reg 33 factors, but they live as
// code constants INSIDE the ba-400-op-risk.ts fold, not as reported form cells;
// every reported cell needs real audited gross income (3 years in steady state)
// and/or operational-loss history that does not exist pre-licence-day (the known
// GAP-BA700-OPERATIONAL-RWA). So no cell is `sourced` — marking any would be a
// fabrication (claiming the form populates from a constant when the reported
// value needs real data).
//
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import type { ReturnForm } from "./cell-contract";
import { returnDataObligationsForProduct } from "./inverse-index";
import { allReturnContracts, loadReturnContract } from "./return-contracts";

const OPERATIONAL_FORMS: readonly ReturnForm[] = ["BA400", "BA410", "BA420"];

interface ExpectedOperationalForm {
  form: ReturnForm;
  name: string;
  obligation: string;
  cells: number;
}

const EXPECTED: ExpectedOperationalForm[] = [
  {
    form: "BA400",
    name: "Operational Risk",
    obligation: "ORG-PR-RETURNS-017",
    cells: 147,
  },
  {
    form: "BA410",
    name: "Operational Risk: Quarterly Losses",
    obligation: "ORG-PR-RETURNS-018",
    cells: 566,
  },
  {
    form: "BA420",
    name: "12-Months Rolling Losses",
    // BA 420 had no dedicated obligation row pre-batch-6 (ORG-PR-RETURNS-019 is
    // BA 500); ORG-PR-RETURNS-018B is authored this batch as the BA 420 sibling.
    obligation: "ORG-PR-RETURNS-018B",
    cells: 540,
  },
];

/** Count of product-attribute dataRequirements across a form (must be 0). */
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

describe("operational-family registry membership", () => {
  it("registers BA 400 / BA 410 / BA 420", () => {
    const all = allReturnContracts().map((c) => c.returnForm);
    for (const f of OPERATIONAL_FORMS) expect(all).toContain(f);
  });
});

describe("operational canonical identity (NOT the fabricated leverage / Pillar-3 scheme)", () => {
  it("BA 400 is the Operational Risk return (op-risk capital → BA 700 RWA)", () => {
    const contract = loadReturnContract("BA400");
    expect(contract.formName).toBe("Operational Risk");
    expect(contract.obligationId).toBe("ORG-PR-RETURNS-017");
  });

  it("BA 410 is the Operational Risk: Quarterly Losses return", () => {
    const contract = loadReturnContract("BA410");
    expect(contract.formName).toBe("Operational Risk: Quarterly Losses");
    expect(contract.obligationId).toBe("ORG-PR-RETURNS-018");
  });

  it("BA 420 is the 12-Months Rolling Losses return", () => {
    const contract = loadReturnContract("BA420");
    expect(contract.formName).toBe("12-Months Rolling Losses");
    expect(contract.obligationId).toBe("ORG-PR-RETURNS-018B");
  });
});

describe.each(EXPECTED)("$form — operational-family contract", (exp) => {
  const contract = loadReturnContract(exp.form);

  it(`loads all ${exp.cells} XSD leaf cells with the right identity`, () => {
    expect(contract.returnForm).toBe(exp.form);
    expect(contract.formName).toBe(exp.name);
    expect(contract.obligationId).toBe(exp.obligation);
    expect(contract.cells.length).toBe(exp.cells);
  });

  it("carries ZERO product-attribute requirements (operational risk is entity-level)", () => {
    // THE defining operational-family property: operational cells are not
    // product-gated. The capital charge derives from annual gross income (an
    // income-statement aggregate); the loss returns capture per-event losses
    // attributed to a business line at capture time. No product-static attribute
    // is owed — and none is manufactured (no bulk-marking; Engineering Charter —
    // no fabrication).
    expect(productAttrCount(exp.form)).toBe(0);
  });

  it("is WHOLLY licence-day-data (every reported cell needs real gross income / loss history)", () => {
    // Honest finding: no cell is `sourced` — the α / β / 12.5× constants live in
    // the fold, not as reported cells; every reported cell needs real audited
    // gross income / loss history the bank does not have pre-licence-day
    // (GAP-BA700-OPERATIONAL-RWA).
    const sourced = contract.cells.filter((c) => c.status === "sourced");
    expect(sourced.length).toBe(0);
  });

  it("every cell is licence-day-data with an honest statusReason", () => {
    for (const cell of contract.cells) {
      expect(cell.status).toBe("licence-day-data");
      expect(cell.statusReason?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it("every cell carries ≥1 citation to the form's operational obligation", () => {
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
        // Operational amounts are functional by default, by-currency only where a
        // cell's row/column explicitly names a currency axis — never a literal.
        expect(dim === "functional" || dim === "by-currency").toBe(true);
        expect(cell.unit).toBe("ZAR-thousands");
      } else {
        expect(cell.currencyDimension).toBeUndefined();
      }
    }
  });
});

describe("operational family binds NO product (gate coherence — FX not blocked)", () => {
  it("the live FX product is bound to no operational return", () => {
    const fx = returnDataObligationsForProduct("prd:bank:fx:otc-vanilla", allReturnContracts());
    const operationalForms = fx.forms.filter((f) => OPERATIONAL_FORMS.includes(f));
    expect(operationalForms.length).toBe(0);
  });

  it("no operational cell references any prd: product attribute at all", () => {
    for (const form of OPERATIONAL_FORMS) {
      const contract = loadReturnContract(form);
      for (const cell of contract.cells) {
        for (const d of cell.dataRequirements) {
          expect(d.ref.startsWith("prd:")).toBe(false);
        }
      }
    }
  });
});

describe("BA 400 op-risk-specific structure (the capital return)", () => {
  it("carries the ILM-usage enum flag + loss-event count cells + the gross-income money cells", () => {
    const contract = loadReturnContract("BA400");
    const byType = (t: string): number => contract.cells.filter((c) => c.valueType === t).length;
    expect(byType("money")).toBeGreaterThan(0); // gross income / op-capital / op-RWA
    expect(byType("count")).toBeGreaterThan(0); // loss-event counts
    expect(byType("enum")).toBeGreaterThan(0); // the ILM-usage Yes/No flag
  });
});
