// v2-core/regulatory-returns/fx-product-return-cells.test.ts
//
// Unit tests for the FX product→return-cell inverse index (L3 FX specialisation)
// under D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING. Pure — no event store
// (the L2 contracts are reference data, P1 Plane A).
//
// Author: Mira (Compliance / RegTech engineer, engineering — reports to Zanele
//   (Chief Compliance Officer)).

import { describe, expect, it } from "bun:test";

import {
  FX_CURATED_FED_CELLS,
  FX_DEFERRED_EDGES,
  FX_NON_APPLICABLE,
  FX_OTC_VANILLA_PRODUCT_ID,
  fxReturnLineage,
} from "./fx-product-return-cells";
import { allReturnContracts, loadReturnContract } from "./return-contracts";

describe("FX product → return-cell inverse index", () => {
  const contracts = allReturnContracts();

  it("resolves the FX product's per-product BA 100 derivative edges (generic walk)", () => {
    const lineage = fxReturnLineage(contracts);
    expect(lineage.productId).toBe(FX_OTC_VANILLA_PRODUCT_ID);
    // BA 100 carries the real per-product `balanceSheetClassification` edges.
    const ba100 = lineage.fedCells.filter((c) => c.returnForm === "BA100");
    expect(ba100.length).toBeGreaterThan(0);
    for (const c of ba100) {
      expect(c.source).toBe("product-attribute");
    }
  });

  it("every curated FX cell resolves VERBATIM (form+row+column+label) in its L2 contract", () => {
    for (const decl of FX_CURATED_FED_CELLS) {
      const contract = loadReturnContract(decl.returnForm);
      const cell = contract.cells.find((c) => c.cellRef.xsdElement === decl.xsdElement);
      expect(cell, `${decl.returnForm}.${decl.xsdElement} must exist`).toBeDefined();
      if (cell === undefined) continue;
      expect(cell.cellRef.row).toBe(decl.row);
      expect(cell.cellRef.column).toBe(decl.column);
      expect(cell.label).toBe(decl.sarbLabel);
    }
  });

  it("surfaces the curated prudential / P&L forms (BA 320, BA 120, BA 200, BA 700)", () => {
    const lineage = fxReturnLineage(contracts);
    for (const form of ["BA320", "BA120", "BA200", "BA700"] as const) {
      expect(lineage.forms).toContain(form);
    }
  });

  it("tracks the deferred BA 300 cashflow edge with a GAP id (no silent deferral)", () => {
    const ba300 = FX_DEFERRED_EDGES.find((e) => e.returnForm === "BA300");
    expect(ba300).toBeDefined();
    expect(ba300?.gapId).toMatch(/^GAP-/);
    expect((ba300?.reason ?? "").length).toBeGreaterThan(0);
  });

  it("records BA 110 as FX-non-applicable (no FX line in the schema)", () => {
    const ba110 = FX_NON_APPLICABLE.find((f) => f.returnForm === "BA110");
    expect(ba110).toBeDefined();
    expect((ba110?.findingId ?? "").length).toBeGreaterThan(0);
    // A non-applicable form must NOT also appear as a curated fed cell.
    expect(FX_CURATED_FED_CELLS.some((c) => c.returnForm === "BA110")).toBe(false);
  });

  it("the BA 320 headline FX charge cell is the foreign-exchange-risk total", () => {
    const decl = FX_CURATED_FED_CELLS.find(
      (c) => c.returnForm === "BA320" && c.xsdElement === "BA01019454",
    );
    expect(decl).toBeDefined();
    expect(decl?.sarbLabel).toBe("Foreign exchange risk / Total");
    expect(decl?.row).toBe("R0140");
  });
});
