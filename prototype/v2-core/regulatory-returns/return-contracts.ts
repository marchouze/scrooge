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
//   (BA 110, BA 120, BA 600, BA 610); Phase C batch 2 = the credit family
//   (BA 200, BA 210, BA 220) — the first batch with real product-attribute
//   requirements the NPA gate binds on.
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
  // Phase C batch 2 — the credit family (BA 200 / BA 210 / BA 220). The first
  // batch to carry real product-attribute requirements a credit product must
  // capture (the NPA gate binds on these). XSD names are version-suffixed.
  {
    form: "BA200",
    contractJsonPath: jsonPath("ba200-contract.json"),
    xsdName: "BA200_v15012026.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA200.zip",
  },
  {
    form: "BA210",
    contractJsonPath: jsonPath("ba210-contract.json"),
    xsdName: "BA210.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA210.zip",
  },
  {
    form: "BA220",
    contractJsonPath: jsonPath("ba220-contract.json"),
    xsdName: "BA220_v20022026.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA220.zip",
  },
  // Phase C batch 3 — the liquidity family (BA 300 / BA 310). The first batch to
  // carry product-attribute requirements on the LIABILITY (deposit funding-
  // stability / category / maturity) and HQLA-asset (level / eligibility /
  // haircut) axes, AND the first with LIVE numerator substrate (the HQLA
  // classifier + SecurityMaster + the BA-300 LCR fold) — so HQLA / LCR-numerator
  // cells are `sourced` while deposit-funding / NSFR / reserve cells are
  // `licence-day-data`. BA 300's XSD is version-suffixed.
  {
    form: "BA300",
    contractJsonPath: jsonPath("ba300-contract.json"),
    xsdName: "BA300_v20260323.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA300.zip",
  },
  {
    form: "BA310",
    contractJsonPath: jsonPath("ba310-contract.json"),
    xsdName: "BA310.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA310.zip",
  },
  // Phase C batch 4 — the market family (BA 320 / BA 325 / BA 330 / BA 340 /
  // BA 350). BA 320 (Market Risk) has LIVE substrate (the ba-320-market-risk.ts
  // standardised-position-risk fold + FX / IR / bond event adapters + VaR
  // engine), so its FX-risk-class aggregate cells are `sourced` while the rest of
  // BA 320 — and every BA 325 (trading & treasury selected risk) / BA 330 (IRRBB)
  // / BA 340 (equity risk in the banking book) / BA 350 (derivatives instruments)
  // cell — is `licence-day-data` (the folds exist; no real trading-book /
  // treasury / banking-book / derivative positions pre-licence-day). The market
  // product-static attributes (trading-book designation, risk class, derivative
  // type, equity holding class, rate type) attach to FUTURE, unapproved market
  // product ids, so the live FX product is never wrongly blocked. NB: BA 325 is
  // built on its CANONICAL "Selected Risk Exposure Arising from Trading and
  // Treasury Activities" identity — NOT FRTB (the FRTB-SA charge feeds BA 320; the
  // standalone FRTB workbook is the separate schemas/FRTB.zip).
  {
    form: "BA320",
    contractJsonPath: jsonPath("ba320-contract.json"),
    xsdName: "BA320.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA320.zip",
  },
  {
    form: "BA325",
    contractJsonPath: jsonPath("ba325-contract.json"),
    xsdName: "BA325.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA325.zip",
  },
  {
    form: "BA330",
    contractJsonPath: jsonPath("ba330-contract.json"),
    xsdName: "BA330.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA330.zip",
  },
  {
    form: "BA340",
    contractJsonPath: jsonPath("ba340-contract.json"),
    xsdName: "BA340.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA340.zip",
  },
  {
    form: "BA350",
    contractJsonPath: jsonPath("ba350-contract.json"),
    xsdName: "BA350.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA350.zip",
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
