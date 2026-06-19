// v2-core/regulatory-returns/return-contracts.ts
//
// THE RETURN-CONTRACT REGISTRY — the single `{form → contract.json + its XSD}`
// table that the framework iterates. The cell-data-requirement contract
// (`cell-contract.ts`) is reusable across all ~27 SARB BA returns; this module
// is the registry of the form INSTANCES that have been authored against it.
//
// One registry, two consumers:
//   - `recon:ba-return-cell-contract` iterates it to assert EVERY authored
//     form's contract is complete + sound against its OWN independent XSD
//     extract (so each new return auto-gets completeness/citation/source
//     coverage — a framework ratchet, hardens only).
//   - the NPA gate (`recon:npa-return-data-obligation-integrity`) consumes
//     `allReturnContracts()` so a product is gated on capturing the data EVERY
//     authored return's cells need (not just BA 100).
//
// Each contract JSON is machine-generated from the form's XSD/xlsx (provenance:
// `gen-ba100-contract.py` for BA 100; `gen-return-contract.py` for the
// financial family) and validated against the Zod schema at first access —
// fail-closed (Engineering Charter cmd 2): a malformed contract throws, never
// half-loads.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19):
//   Phase B = framework + BA 100 pilot; Phase C batch 1 = the financial family
//   (BA 110, BA 120, BA 600, BA 610).
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type ReturnContract, type ReturnForm, parseReturnContract } from "./cell-contract";

/**
 * One registry entry: an authored return form, the generated contract JSON it
 * loads, and the source schema zip (which contains the form's XSD — the
 * independent completeness oracle the recon re-extracts).
 */
export interface ReturnContractRegistryEntry {
  readonly form: ReturnForm;
  /** Absolute path to the generated, checked-in contract JSON. */
  readonly contractJsonPath: string;
  /** The XSD file name inside the schema zip (the cell-universe oracle). */
  readonly xsdName: string;
  /** Repo-relative path to the schema zip the contract was sourced from. */
  readonly schemaZipRelPath: string;
}

const jsonPath = (file: string): string => fileURLToPath(new URL(`./${file}`, import.meta.url));

/**
 * The canonical registry of authored return-form contracts. Adding a new form
 * = generating its `<form>-contract.json` and appending one entry here; the
 * recon + NPA gate then cover it automatically.
 */
export const RETURN_CONTRACT_REGISTRY: readonly ReturnContractRegistryEntry[] = [
  {
    form: "BA100",
    contractJsonPath: jsonPath("ba100-contract.json"),
    xsdName: "BA100.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA100.zip",
  },
  {
    form: "BA110",
    contractJsonPath: jsonPath("ba110-contract.json"),
    xsdName: "BA110.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA110.zip",
  },
  {
    form: "BA120",
    contractJsonPath: jsonPath("ba120-contract.json"),
    xsdName: "BA120.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA120.zip",
  },
  {
    form: "BA600",
    contractJsonPath: jsonPath("ba600-contract.json"),
    xsdName: "BA600.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA600.zip",
  },
  {
    form: "BA610",
    contractJsonPath: jsonPath("ba610-contract.json"),
    xsdName: "BA610.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA610.zip",
  },
];

const cache = new Map<ReturnForm, ReturnContract>();

/**
 * Load + Zod-validate the contract for one registered form. Parsed on first
 * call, then memoised. Throws on any schema violation (fail-closed) or if the
 * loaded form's `returnForm` does not match the registry key (provenance
 * integrity).
 */
export function loadReturnContract(form: ReturnForm): ReturnContract {
  const cached = cache.get(form);
  if (cached !== undefined) return cached;

  const entry = RETURN_CONTRACT_REGISTRY.find((e) => e.form === form);
  if (entry === undefined) {
    throw new Error(`no return-contract registry entry for form ${form}`);
  }
  const raw: unknown = JSON.parse(readFileSync(entry.contractJsonPath, "utf-8"));
  const contract = parseReturnContract(raw);
  if (contract.returnForm !== form) {
    throw new Error(
      `return-contract provenance mismatch: ${entry.contractJsonPath} declares ` +
        `returnForm '${contract.returnForm}' but is registered as '${form}'`,
    );
  }
  cache.set(form, contract);
  return contract;
}

/**
 * Every authored return contract, in registry order. The NPA gate consumes
 * this so product return-data obligations span ALL authored forms.
 */
export function allReturnContracts(): readonly ReturnContract[] {
  return RETURN_CONTRACT_REGISTRY.map((e) => loadReturnContract(e.form));
}
