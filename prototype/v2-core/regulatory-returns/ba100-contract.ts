// v2-core/regulatory-returns/ba100-contract.ts
//
// BA 100 (Balance Sheet) — the pilot instance of the return-cell data-
// requirement contract. The cell data lives in `ba100-contract.json` (843
// cells = the full BA100.xsd Monetary1000 leaf-cell set), MACHINE-GENERATED
// from the SARB Excel form by `gen-ba100-contract.py`. This module loads that
// JSON and validates it against the Zod framework schema at first access —
// fail-closed (Charter cmd 2): a malformed contract throws, never half-loads.
//
// WHY a JSON data file + a TS loader (not an inline literal): the contract is
// ~1.9 MB of generated reference data. The same pattern as the chart-of-
// accounts (`chart-of-accounts.json` + loader). The generator is the single
// authoring path; this module is the typed read surface.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19), Phase B.
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type ReturnContract, parseReturnContract } from "./cell-contract";

const CONTRACT_JSON_PATH = fileURLToPath(new URL("./ba100-contract.json", import.meta.url));

let cached: ReturnContract | undefined;

/**
 * The validated BA 100 Balance-Sheet cell-data-requirement contract — all 843
 * cells. Parsed + Zod-validated on first call, then memoised. Throws on any
 * schema violation (fail-closed).
 */
export function ba100Contract(): ReturnContract {
  if (cached === undefined) {
    const raw: unknown = JSON.parse(readFileSync(CONTRACT_JSON_PATH, "utf-8"));
    cached = parseReturnContract(raw);
  }
  return cached;
}

/** Path to the generated contract JSON — used by the recon gate for provenance. */
export const BA100_CONTRACT_JSON_PATH = CONTRACT_JSON_PATH;
