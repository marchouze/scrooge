// platform/recon/ba-return-cell-contract.test.ts
//
// Tests for the ba-return-cell-contract recon gate. The gate must:
//   - PASS on the real, complete BA 100 contract (run() is green);
//   - FAIL on an incomplete contract (a missing XSD cell);
//   - FAIL on an orphan cell (a contract entry not in the XSD);
//   - FAIL on a dangling citation;
//   - FAIL on a sourced cell that points at a non-existent GL category.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Author: Bea (Accounting and financial reporting engineer, engineering).

import { expect, test } from "bun:test";

import { ba100Contract } from "../../v2-core/regulatory-returns/ba100-contract";
import type {
  ReturnCellContract,
  ReturnContract,
} from "../../v2-core/regulatory-returns/cell-contract";
import type { ReconViolation } from "./types";

/** The first real BA 100 cell — a fully-typed `ReturnCellContract` base. */
function firstCell(contract: ReturnContract): ReturnCellContract {
  const c = contract.cells[0];
  if (c === undefined) throw new Error("BA 100 contract is empty");
  return c;
}
import {
  assertCitationsResolve,
  assertCompleteness,
  assertSourcedCellsReal,
  run,
  xsdCellCodes,
} from "./ba-return-cell-contract";

test("xsdCellCodes extracts the 843 Monetary1000 leaf cells", () => {
  const codes = xsdCellCodes();
  expect(codes.size).toBe(843);
});

test("the real BA 100 contract is exactly the XSD cell set (completeness)", () => {
  const v: ReconViolation[] = [];
  assertCompleteness(ba100Contract(), xsdCellCodes(), v);
  expect(v).toEqual([]);
});

test("an incomplete contract (missing XSD cell) FAILS completeness", () => {
  const contract = ba100Contract();
  const trimmed: ReturnContract = { ...contract, cells: contract.cells.slice(0, -1) };
  const v: ReconViolation[] = [];
  assertCompleteness(trimmed, xsdCellCodes(), v);
  expect(v.some((x) => x.severity === "fail" && /NO contract entry/.test(x.message))).toBe(true);
});

test("an orphan contract cell (not in XSD) FAILS completeness", () => {
  const contract = ba100Contract();
  const ghost: ReturnCellContract = {
    ...firstCell(contract),
    cellRef: { xsdElement: "BA99999999" },
  };
  const padded: ReturnContract = { ...contract, cells: [...contract.cells, ghost] };
  const v: ReconViolation[] = [];
  assertCompleteness(padded, xsdCellCodes(), v);
  expect(v.some((x) => x.severity === "fail" && /NOT a Monetary1000 leaf/.test(x.message))).toBe(
    true,
  );
});

test("a dangling citation FAILS the citation assertion", () => {
  const contract = ba100Contract();
  const tampered: ReturnContract = {
    ...contract,
    cells: [
      { ...firstCell(contract), citations: [{ obligationId: "ORG-DOES-NOT-EXIST", clause: "x" }] },
      ...contract.cells.slice(1),
    ],
  };
  const v: ReconViolation[] = [];
  assertCitationsResolve(tampered, new Set(["ORG-PR-RETURNS-002"]), v);
  expect(v.some((x) => /does not resolve/.test(x.message))).toBe(true);
});

test("a sourced cell pointing at a non-existent GL category FAILS", () => {
  const contract = ba100Contract();
  const tampered: ReturnContract = {
    ...contract,
    cells: [
      {
        ...firstCell(contract),
        status: "sourced",
        dataRequirements: [
          {
            sourceKind: "gl-account",
            ref: "category:does-not-exist",
            description: "bad",
            required: true,
          },
        ],
      },
      ...contract.cells.slice(1),
    ],
  };
  const v: ReconViolation[] = [];
  assertSourcedCellsReal(tampered, new Set(["asset-cash"]), new Set(), v);
  expect(v.some((x) => /not present in the chart of accounts/.test(x.message))).toBe(true);
});

test("run() is green on the real repository state", async () => {
  const result = await run();
  expect(result.pipeline).toBe("ba-return-cell-contract");
  expect(result.ok).toBe(true);
  expect(result.violations.filter((x) => x.severity === "fail")).toEqual([]);
  expect(result.asserted).toBeGreaterThan(800);
});
