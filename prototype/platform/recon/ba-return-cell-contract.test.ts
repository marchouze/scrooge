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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "bun:test";

import { ba100Contract } from "../../v2-core/regulatory-returns/ba100-contract";
import type {
  ReturnCellContract,
  ReturnContract,
} from "../../v2-core/regulatory-returns/cell-contract";
import {
  RETURN_CONTRACT_REGISTRY,
  type ReturnContractRegistryEntry,
} from "../../v2-core/regulatory-returns/return-contracts";
import type { ReconViolation } from "./types";

/** The first real BA 100 cell — a fully-typed `ReturnCellContract` base. */
function firstCell(contract: ReturnContract): ReturnCellContract {
  const c = contract.cells[0];
  if (c === undefined) throw new Error("BA 100 contract is empty");
  return c;
}

/** The BA 100 registry entry — the cell-universe oracle for these tests. */
function ba100Entry(): ReturnContractRegistryEntry {
  const e = RETURN_CONTRACT_REGISTRY.find((x) => x.form === "BA100");
  if (e === undefined) throw new Error("BA100 not in the return-contract registry");
  return e;
}
import {
  assertCitationsResolve,
  assertCompleteness,
  assertFxLeafSliceDimensions,
  assertSourcedCellsReal,
  readZipMember,
  run,
  xlsxCellCodes,
  xsdCellCodes,
} from "./ba-return-cell-contract";

/** The BA 501 registry entry — the xlsx-only (no-XSD) form. */
function ba501Entry(): ReturnContractRegistryEntry {
  const e = RETURN_CONTRACT_REGISTRY.find((x) => x.form === "BA501");
  if (e === undefined) throw new Error("BA501 not in the return-contract registry");
  return e;
}

test("xsdCellCodes extracts the 843 BA 100 leaf cells", () => {
  const codes = xsdCellCodes(ba100Entry());
  expect(codes.size).toBe(843);
});

test("the real BA 100 contract is exactly the XSD cell set (completeness)", () => {
  const v: ReconViolation[] = [];
  assertCompleteness(ba100Contract(), xsdCellCodes(ba100Entry()), v);
  expect(v).toEqual([]);
});

test("an incomplete contract (missing XSD cell) FAILS completeness", () => {
  const contract = ba100Contract();
  const trimmed: ReturnContract = { ...contract, cells: contract.cells.slice(0, -1) };
  const v: ReconViolation[] = [];
  assertCompleteness(trimmed, xsdCellCodes(ba100Entry()), v);
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
  assertCompleteness(padded, xsdCellCodes(ba100Entry()), v);
  expect(v.some((x) => x.severity === "fail" && /NOT a typed leaf/.test(x.message))).toBe(true);
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

// --- (5) FX-leaf slice-dimension contract (WS-BA100-FX-DATA-REPORTING) ------
//
// Every FX-sourced BA 100 leaf-input cell (Banking C0010 / Trading C0020 of a
// row whose dataRequirements name an FX product) must carry a resolvable
// discriminator + canonicalHome. Fail-closed; harden-only. Foundation:
// D-FX-BA110-NO-LINE.

test("the real BA 100 contract carries slice dimensions on every FX-sourced leaf", () => {
  const contract = ba100Contract();
  const v: ReconViolation[] = [];
  const asserted = assertFxLeafSliceDimensions(contract, v);
  expect(asserted).toBeGreaterThan(0); // FX leaves exist (R0330 / R0660 etc.)
  expect(v.filter((x) => x.severity === "fail")).toEqual([]);
});

test("stripping the slice dimension off an FX leaf FAILS (fail-closed, harden-only)", () => {
  const contract = ba100Contract();
  // Remove sliceDimension from every cell — every FX-sourced leaf must now fail.
  const stripped: ReturnContract = {
    ...contract,
    cells: contract.cells.map((c) => ({ ...c, sliceDimension: undefined })),
  };
  const v: ReconViolation[] = [];
  const asserted = assertFxLeafSliceDimensions(stripped, v);
  expect(asserted).toBeGreaterThan(0);
  expect(v.length).toBe(asserted); // one fail per FX leaf
  expect(v.every((x) => x.severity === "fail")).toBe(true);
  expect(v.some((x) => /has no sliceDimension/.test(x.message))).toBe(true);
});

test("an FX leaf with discriminator but canonicalHome 'none-computed' FAILS", () => {
  const contract = ba100Contract();
  const cells = contract.cells.map((c) => {
    if (
      c.cellRef.column === "C0010" &&
      c.dataRequirements.some(
        (d) => d.sourceKind === "product-attribute" && d.ref.startsWith("prd:bank:fx:"),
      )
    ) {
      return {
        ...c,
        sliceDimension: { discriminator: "x='y'", canonicalHome: "none-computed" as const },
      };
    }
    return c;
  });
  const v: ReconViolation[] = [];
  assertFxLeafSliceDimensions({ ...contract, cells }, v);
  expect(v.some((x) => /'none-computed'/.test(x.message))).toBe(true);
});

// --- BA 501 xlsx-only oracle: in-process zip read is deterministic ---------
//
// Regression guard for the CI flake fixed 2026-06-23: the inner xlsx parts were
// previously materialised to a `.local/recon-ba501-<pid>-<ts>.xlsx` temp via the
// async, un-awaited `Bun.write` and re-`unzip`ped, which raced under parallel
// `bun test` workers (read-before-flush → 0-byte temp → `unzip` "EOCD not
// found"). The in-process `readZipMember` parse has no temp file and no
// subprocess, so it is deterministic. These tests assert exactly that.

test("readZipMember round-trips a DEFLATE xlsx part (in-process, no temp/subprocess)", () => {
  // BA501.zip → inner xlsx → xl/workbook.xml, two levels of nested zip, all read
  // in memory. A well-formed SpreadsheetML workbook part starts with an XML
  // declaration and contains the <sheets> collection.
  const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
  const entry = ba501Entry();
  const xlsxName = entry.xlsxName;
  if (xlsxName === undefined) throw new Error("BA501 entry has no xlsxName");
  const schemaZip = readFileSync(resolve(repoRoot, entry.schemaZipRelPath));
  const xlsxBytes = readZipMember(schemaZip, xlsxName);
  const workbookXml = new TextDecoder().decode(readZipMember(xlsxBytes, "xl/workbook.xml"));
  expect(workbookXml.startsWith("<?xml")).toBe(true);
  expect(workbookXml).toContain("<sheets");
});

test("readZipMember throws loudly on a non-zip buffer (fail-closed)", () => {
  expect(() => readZipMember(new Uint8Array([1, 2, 3, 4, 5]), "anything")).toThrow(
    /end-of-central-directory/i,
  );
});

test("xlsxCellCodes(BA501) is non-empty and stable across concurrent calls", async () => {
  // The pre-fix temp-file race only surfaced under concurrency; run the oracle
  // many times in parallel and assert every call returns the identical cell set.
  const baseline = xlsxCellCodes(ba501Entry());
  expect(baseline.size).toBeGreaterThan(0);
  const runs = await Promise.all(
    Array.from({ length: 24 }, async () => xlsxCellCodes(ba501Entry())),
  );
  for (const codes of runs) {
    expect(codes.size).toBe(baseline.size);
    for (const c of baseline) expect(codes.has(c)).toBe(true);
  }
});

test("run() is green on the real repository state", async () => {
  const result = await run();
  expect(result.pipeline).toBe("ba-return-cell-contract");
  expect(result.ok).toBe(true);
  expect(result.violations.filter((x) => x.severity === "fail")).toEqual([]);
  expect(result.asserted).toBeGreaterThan(800);
});
