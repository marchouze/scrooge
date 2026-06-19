// v2-core/regulatory-returns/ba-900-economic-statistics-contract.test.ts
//
// Unit tests for the BA 900 (Economic statistics — DI statistical balance sheet)
// return contract — Phase C batch 9, the FINAL return (D-BA-RETURN-DATA-CONTRACT),
// completing the full SARB BA-return suite (30 returns). Pure — no event store
// (contracts are reference data, P1 Plane A).
//
// BA 900 is the SARB statistical "Balance Sheet of Deposit-Taking Institutions per
// institutional and maturity breakdown, based on statistical principles" — the
// LARGEST workbook in the suite (XSD 6.2 MB, xlsx 2.9 MB; 10,752 typed leaf cells)
// and a MULTI-SUB-FORM return (BA900_1 .. BA900_7, plus trailing _8 / _9 control
// sub-forms in the Elements list). The reported value is a SECTORED / MATURITY-
// BANDED balance-sheet AGGREGATE (Total economy / domestic sectors / DTIs / other
// financial corporations / general government / non-financial corporations /
// households / non-resident), NOT a product-static menu attribute — so BA 900
// carries ZERO product-attribute requirements (like BA 930 / BA 94x; no bulk-
// marking, no fabrication). Every XSD leaf code is DISTINCT (no reuse across sub-
// forms), so the generator's multi-sub-form dedup is a no-op and the recon's XSD
// oracle yields the same 10,752-leaf universe the xlsx Elements sheet does.
//
// HONEST STATUS: wholly licence-day-data — the bank-in-formation holds no real
// statistical balance sheet pre-licence-day (no real deposits, loans, securities or
// sectored counterparties). No cell is `sourced`; marking any would be a fabrication.
//
// Obligation: ORG-PR-RETURNS-024 — the post-#1451-corrected BA 900 = Economic
// statistics row (§2.1.25 / Annexure 24A/24B), already adopted (no new obligation).
//
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { describe, expect, it } from "bun:test";

import { returnDataObligationsForProduct } from "./inverse-index";
import { allReturnContracts, loadReturnContract } from "./return-contracts";

const BA900_OBLIGATION = "ORG-PR-RETURNS-024";
const BA900_CELL_COUNT = 10752;

/** All product-attribute refs across BA 900's cells. */
function ba900ProductAttrRefs(): string[] {
  const contract = loadReturnContract("BA900");
  const refs: string[] = [];
  for (const cell of contract.cells) {
    for (const d of cell.dataRequirements) {
      if (d.sourceKind === "product-attribute") refs.push(d.ref);
    }
  }
  return refs;
}

describe("BA 900 registry membership (the FINAL return — full SARB BA-return suite)", () => {
  it("registers BA 900 in the contract registry", () => {
    const all = allReturnContracts().map((c) => c.returnForm);
    expect(all).toContain("BA900");
  });

  it("BA 900 is the 30th authored return (the suite is complete)", () => {
    expect(allReturnContracts().length).toBe(30);
  });
});

describe("BA 900 contract identity + completeness", () => {
  const contract = loadReturnContract("BA900");

  it(`loads all ${BA900_CELL_COUNT} distinct leaf cells with the right identity`, () => {
    expect(contract.returnForm).toBe("BA900");
    expect(contract.formName).toBe("Economic statistics — DI returns");
    expect(contract.obligationId).toBe(BA900_OBLIGATION);
    expect(contract.cells.length).toBe(BA900_CELL_COUNT);
  });

  it("has no duplicate cell entries (one entry per distinct XSD leaf code)", () => {
    const codes = contract.cells.map((c) => c.cellRef.xsdElement);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every leaf cell carries a BA-prefix XSD element code", () => {
    expect(contract.cells.every((c) => /^BA\d{8}$/.test(c.cellRef.xsdElement))).toBe(true);
  });
});

describe("BA 900 honest status — wholly licence-day-data (no statistical balance sheet pre-licence-day)", () => {
  const contract = loadReturnContract("BA900");

  it("every cell is licence-day-data with an honest statusReason (no fabricated sourced cell)", () => {
    for (const cell of contract.cells) {
      expect(cell.status).toBe("licence-day-data");
      expect(cell.statusReason?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it("every cell carries ≥1 citation to the BA 900 obligation (P2 — no orphan cell)", () => {
    for (const cell of contract.cells) {
      expect(cell.citations.length).toBeGreaterThan(0);
      expect(cell.citations.some((c) => c.obligationId === BA900_OBLIGATION)).toBe(true);
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
});

describe("BA 900 is an AGGREGATE sectoral balance-sheet statistic — ZERO product-attribute requirements", () => {
  it("binds no product attribute (no manufacture; like BA 930 / BA 94x)", () => {
    expect(ba900ProductAttrRefs().length).toBe(0);
  });

  it("the live FX product is bound to NO BA 900 cell (gate coherence — FX not blocked)", () => {
    const fx = returnDataObligationsForProduct("prd:bank:fx:otc-vanilla", allReturnContracts());
    expect(fx.forms.includes("BA900")).toBe(false);
  });
});

describe("BA 900 multi-sub-form handling (BA900_1..7 — sub-form folded into label/regdef)", () => {
  const contract = loadReturnContract("BA900");

  it("preserves the BA900_n sub-form context in cell labels (framework cellRef has no sub-form axis)", () => {
    // At least one cell from each of the seven primary sub-forms names that sub-
    // form in its label (the sub-form identity is folded in since the framework
    // cellRef has no sub-form axis — the canonical BA 900 _1.._7 pattern).
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      const namesSubForm = contract.cells.some((c) => c.label.startsWith(`BA900_${n} `));
      expect(namesSubForm).toBe(true);
    }
  });

  it("suppresses the repeated form-name boilerplate from cell labels (only the sub-form key is folded in)", () => {
    // The giant identical formDescription ("BALANCE SHEET OF DEPOSIT TAKING
    // INSTITUTIONS …") is the form name, not a per-cell discriminator — it must
    // NOT be folded into every cell label.
    const bloated = contract.cells.filter((c) =>
      c.label.includes("BALANCE SHEET OF DEPOSIT TAKING INSTITUTIONS"),
    );
    expect(bloated.length).toBe(0);
  });
});
