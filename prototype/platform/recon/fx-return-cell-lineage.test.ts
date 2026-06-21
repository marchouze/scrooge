// platform/recon/fx-return-cell-lineage.test.ts
//
// Tests for the fx-return-cell-lineage recon gate. The gate must:
//   - PASS on the real, in-tree FX inverse index (run() is green);
//   - FAIL a curated cell whose row/column/label drifts from the contract;
//   - FAIL a curated cell that does not resolve to any contract cell;
//   - FAIL a deferred edge that is not a GAP-prefixed tracked gap.
//
// The negative cases drive the assertion helpers directly with a synthetic
// contract index, so the gate's drift-catch is proven (not just the happy path).
//
// Authority: D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING (CEO-approved 2026-06-21).
// Author: Mira (Compliance / RegTech engineer, engineering — reports to Zanele
//   (Chief Compliance Officer)).

import { expect, test } from "bun:test";

import type { ReturnCellContract } from "../../v2-core/regulatory-returns/cell-contract";
import { FX_CURATED_FED_CELLS } from "../../v2-core/regulatory-returns/fx-product-return-cells";
import { assertCuratedCellsResolve, run } from "./fx-return-cell-lineage";
import type { ReconViolation } from "./types";

/** A minimal contract cell carrying just the coordinate fields the gate reads. */
function cell(xsdElement: string, row: string, column: string, label: string): ReturnCellContract {
  return {
    returnForm: "BA320",
    cellRef: { xsdElement, row, column },
    label,
    regulatoryDefinition: "test",
    citations: [{ obligationId: "ORG-PR-RETURNS-012", clause: "test" }],
    valueType: "money",
    currencyDimension: "functional",
    unit: "ZAR-thousands",
    derivation: { kind: "direct", expression: "" },
    dataRequirements: [],
    applicability: { entityScope: "bank", jurisdiction: "ZA", productScope: "universal" },
    status: "sourced",
  } as ReturnCellContract;
}

test("fx-return-cell-lineage PASSES on the real in-tree FX inverse index", () => {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  expect(fails).toEqual([]);
  expect(result.ok).toBe(true);
  expect(result.asserted).toBeGreaterThan(0);
});

test("assertCuratedCellsResolve FAILS a label drift", () => {
  const decl = FX_CURATED_FED_CELLS[0];
  if (decl === undefined) throw new Error("no curated FX cells");
  const idx = new Map<string, ReturnCellContract>();
  // Same coordinate, WRONG label.
  idx.set(
    `${decl.returnForm}::${decl.xsdElement}`,
    cell(decl.xsdElement, decl.row, decl.column, "WRONG LABEL"),
  );
  const violations: ReconViolation[] = [];
  assertCuratedCellsResolve(idx, violations);
  expect(violations.some((v) => v.message.includes("verbatim drift"))).toBe(true);
});

test("assertCuratedCellsResolve FAILS a cell that resolves to nothing", () => {
  const violations: ReconViolation[] = [];
  // Empty index → every curated cell is unresolved.
  assertCuratedCellsResolve(new Map(), violations);
  expect(violations.some((v) => v.message.includes("does NOT resolve"))).toBe(true);
});

test("assertCuratedCellsResolve FAILS a row coordinate drift", () => {
  const decl = FX_CURATED_FED_CELLS[0];
  if (decl === undefined) throw new Error("no curated FX cells");
  const idx = new Map<string, ReturnCellContract>();
  idx.set(
    `${decl.returnForm}::${decl.xsdElement}`,
    cell(decl.xsdElement, "R9999", decl.column, decl.sarbLabel),
  );
  const violations: ReconViolation[] = [];
  assertCuratedCellsResolve(idx, violations);
  expect(violations.some((v) => v.message.includes("row"))).toBe(true);
});
