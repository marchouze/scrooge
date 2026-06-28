// dashboard/v2-finance-returns-cell-values.test.ts
//
// The SARB-form detail grid fills only the SOUND, form-level AGGREGATE cells
// (HEADLINE_CELLS) with the validated, provenance-aware figures — never a guessed
// granular per-line number (the chart-of-accounts is coarser than the form lines;
// GL postings carry no book dimension). These tests pin that behaviour:
//   1. each section total lands on its correct SARB coordinate, value-equal to the
//      figure;
//   2. the rowLabel drift-guard refuses to place a value on a moved/renamed cell
//      (fail-safe — blank, never mis-placed);
//   3. absent figures ⇒ no values.
//
// Authority: D-BA-RETURN-DATA-CONTRACT; Engineering Charter cmd 2 (fail-closed) /
//   cmd 4 (source, don't fabricate).

import { describe, expect, test } from "bun:test";
import type { ReturnContract } from "../v2-core/regulatory-returns/cell-contract";
import { loadReturnContract } from "../v2-core/regulatory-returns/return-contracts";
import { type FinanceReturnFigures, headlineValuesByXsd } from "./v2-finance-returns-view";

const ba100Figures: FinanceReturnFigures = {
  kind: "ba100",
  assets: { amount: "300000000", currency: "ZAR" },
  liabilities: { amount: "0", currency: "ZAR" },
  equity: { amount: "300000000", currency: "ZAR" },
  balanced: true,
  lines: [],
  classificationGapCount: 0,
  coverageStatus: "v2-trial-balance",
};

const ba700Figures: FinanceReturnFigures = {
  kind: "ba700",
  tier1Capital: { amount: "300000000", currency: "ZAR" },
  tier2Capital: { amount: "0", currency: "ZAR" },
  totalRwa: { amount: "201841758.13", currency: "ZAR" },
  carRatio: 1.4863,
  coverageStatus: "partial",
  gaps: [],
};

function xsdAt(contract: ReturnContract, row: string, column: string): string {
  const cell = contract.cells.find((c) => c.cellRef.row === row && c.cellRef.column === column);
  if (cell === undefined) throw new Error(`no cell at ${row}/${column}`);
  return cell.cellRef.xsdElement;
}

describe("headlineValuesByXsd — sound aggregate cell values", () => {
  test("BA100 section totals land on the correct SARB cells, value-equal to the figures", () => {
    const contract = loadReturnContract("BA100");
    const m = headlineValuesByXsd("BA100", contract, ba100Figures);

    expect(m.get(xsdAt(contract, "R0540", "C0040"))).toEqual({
      amount: "300000000",
      valueType: "money",
      currency: "ZAR",
      source: "headline",
    });
    expect(m.get(xsdAt(contract, "R0790", "C0040"))).toEqual({
      amount: "0",
      valueType: "money",
      currency: "ZAR",
      source: "headline",
    });
    expect(m.get(xsdAt(contract, "R0870", "C0040"))).toEqual({
      amount: "300000000",
      valueType: "money",
      currency: "ZAR",
      source: "headline",
    });
  });

  test("the target cells are genuinely the section-total lines (guards mis-mapping)", () => {
    const contract = loadReturnContract("BA100");
    const labelAt = (row: string, column: string): string => {
      const cell = contract.cells.find((c) => c.cellRef.row === row && c.cellRef.column === column);
      return (cell?.cellRef.rowLabel ?? "").toLowerCase();
    };
    expect(labelAt("R0540", "C0040")).toContain("total assets");
    expect(labelAt("R0790", "C0040")).toContain("total liabilities");
    expect(labelAt("R0870", "C0040")).toContain("total equity");
  });

  test("BA700 aggregate RWA lands on the Total-column risk-weighted-exposure cell", () => {
    const contract = loadReturnContract("BA700");
    const m = headlineValuesByXsd("BA700", contract, ba700Figures);
    expect(m.get(xsdAt(contract, "R0030", "C0080"))).toEqual({
      amount: "201841758.13",
      valueType: "money",
      currency: "ZAR",
      source: "headline",
    });
  });

  test("drift guard: a moved/renamed coordinate is NOT filled (fail-safe, never mis-placed)", () => {
    // Synthetic contract whose R0540/C0040 carries a DIFFERENT line — the value
    // must be dropped, not placed on the wrong cell.
    const synthetic = {
      returnForm: "BA100",
      formName: "Balance Sheet",
      obligationId: "ORG-PR-RETURNS-TEST",
      schemaSource: "test",
      cells: [
        {
          returnForm: "BA100",
          cellRef: {
            xsdElement: "BA-TEST-0001",
            row: "R0540",
            rowLabel: "Some other line entirely",
            column: "C0040",
            columnLabel: "Total bank",
          },
          label: "Some other line entirely / Total bank",
          regulatoryDefinition: "n/a",
          citations: [{ obligationId: "ORG-PR-RETURNS-TEST", clause: "n/a" }],
          valueType: "money",
          currencyDimension: "functional",
          unit: "ZAR",
          derivation: { kind: "sum", expression: "" },
          dataRequirements: [],
          applicability: { entityScope: "bank", jurisdiction: "ZA", productScope: "universal" },
          status: "sourced",
        },
      ],
    } as unknown as ReturnContract;

    const m = headlineValuesByXsd("BA100", synthetic, ba100Figures);
    expect(m.has("BA-TEST-0001")).toBe(false);
    expect(m.size).toBe(0);
  });

  test("absent figures ⇒ no values", () => {
    const contract = loadReturnContract("BA100");
    expect(headlineValuesByXsd("BA100", contract, undefined).size).toBe(0);
  });
});
