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
//   requirements the NPA gate binds on; batch 3 = liquidity (BA 300, BA 310);
//   batch 4 = market (BA 320, BA 325, BA 330, BA 340, BA 350); batch 5 = capital
//   (BA 700, BA 701); batch 6 = the operational family (BA 400, BA 410, BA 420)
//   — entity-level (gross income + loss events), so ZERO product-attribute
//   requirements (like the capital family).
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
  /**
   * The XSD file name inside the schema zip (the cell-universe oracle the recon
   * completeness check re-extracts). `null` for an xlsx-ONLY form whose SARB
   * schema package carries NO XSD (BA 501 — Special-purpose institutions
   * schemes): for such a form the completeness oracle is the workbook Elements
   * sheet (`xlsxName`), independently re-parsed by the recon. Never silently
   * skipped — the recon asserts completeness against the xlsx cell universe.
   */
  readonly xsdName: string | null;
  /**
   * The xlsx file name inside the schema zip (the contract generator's cell
   * source). Required ONLY for an xlsx-only form (where it doubles as the recon
   * completeness oracle); optional otherwise (the generator finds the single
   * xlsx by suffix).
   */
  readonly xlsxName?: string;
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
  // Phase C batch 5 — the CAPITAL FAMILY (BA 700 / BA 701). The apex prudential
  // returns. BA 700 (Capital Adequacy and Leverage and TLAC) has LIVE substrate
  // for the regulatory minimum-required ratios + buffer add-ons + the specified
  // minimum leverage ratio (computed from BCBS / Reg-38 constants in
  // platform/reporting/ba-700-capital.ts + ba-700-leverage-ratio.ts) → those
  // cells are `sourced`; every achieved-capital / RWA / ratio / excess-shortfall
  // / TLAC cell needs REAL capital (the R300m is a licence-day target, not a
  // present balance) → `licence-day-data`. BA 701 (Regulatory vs Economic
  // Capital) is wholly `licence-day-data` (the ICAAP economic-capital model
  // output + real positions do not exist pre-licence-day). Capital is GL-/RWA-
  // derived (numerator = capital-classified GL; denominator = the credit BA 200 +
  // market BA 320 + operational BA 400 RWA), so the capital family carries ZERO
  // product-attribute requirements — no product is gated on a capital cell, and
  // the live FX product is never wrongly blocked.
  {
    form: "BA700",
    contractJsonPath: jsonPath("ba700-contract.json"),
    xsdName: "BA700.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA700.zip",
  },
  {
    form: "BA701",
    contractJsonPath: jsonPath("ba701-contract.json"),
    xsdName: "BA701.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA701.zip",
  },
  // Phase C batch 6 — the OPERATIONAL FAMILY (BA 400 / BA 410 / BA 420). The
  // operational-risk capital return (BIA / TSA gross income → op-capital,
  // op-RWA = 12.5 × op-capital, feeding the BA 700 RWA denominator) plus its two
  // operational-loss companions (BA 410 quarterly, BA 420 12-month rolling).
  // Operational risk is gross-income- and loss-event-derived (entity-level), so
  // the family carries ZERO product-attribute requirements (like the capital
  // family) — no product, and in particular not the live FX product, is gated on
  // an operational cell. BA 400's regulatory α / β / 12.5× constants are
  // `sourced`; every gross-income / capital / RWA / ILM cell and every BA 410 /
  // BA 420 loss cell is `licence-day-data` (no audited 3-year gross income and no
  // loss history pre-licence-day — the known GAP-BA700-OPERATIONAL-RWA). BA 420's
  // XSD is version-suffixed.
  {
    form: "BA400",
    contractJsonPath: jsonPath("ba400-contract.json"),
    xsdName: "BA400.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA400.zip",
  },
  {
    form: "BA410",
    contractJsonPath: jsonPath("ba410-contract.json"),
    xsdName: "BA410.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA410.zip",
  },
  {
    form: "BA420",
    contractJsonPath: jsonPath("ba420-contract.json"),
    xsdName: "BA420_v15012026.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA420.zip",
  },
  // Phase C batch 7 — the SECURITISATION + GOVERNANCE/LIMITS family (BA 500 /
  // BA 501 / BA 125 / BA 130). BA 500 / BA 501 (securitisation) carry real
  // securitisation product-attribute requirements (role / approach / asset class /
  // tranche-seniority / rating / risk-retention) the NPA gate binds on (attached
  // to the FUTURE `prd:bank:securitisation:scheme`, never the live FX product).
  // BA 125 (shareholders) + BA 130 (investment restrictions) are entity-/portfolio-
  // level governance/limits returns carrying ZERO product-attribute requirements.
  // The whole family is licence-day-data (no real securitisation / third-party
  // shareholders / investment book pre-licence-day). ★BA 501 is xlsx-ONLY (no XSD
  // in the SARB schema package) — its completeness oracle is the workbook Elements
  // sheet (xsdName: null + xlsxName), re-parsed independently by the recon.
  {
    form: "BA500",
    contractJsonPath: jsonPath("ba500-contract.json"),
    xsdName: "BA500.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA500.zip",
  },
  {
    form: "BA501",
    contractJsonPath: jsonPath("ba501-contract.json"),
    xsdName: null, // xlsx-only — no XSD in the SARB schema package.
    xlsxName: "SARB-Return - BA501_v20022026.xlsx",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA501.zip",
  },
  {
    form: "BA125",
    contractJsonPath: jsonPath("ba125-contract.json"),
    xsdName: "BA125.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA125.zip",
  },
  {
    form: "BA130",
    contractJsonPath: jsonPath("ba130-contract.json"),
    xsdName: "BA130.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA130.zip",
  },
  // Phase C batch 8 — STATISTICAL (BA 920 / BA 930 / BA 94x) + SUPPLEMENTARY
  // (CVA / FRTB) returns. BA 920 (instalment-sale / leasing analysis) carries real
  // product-attribute requirements (finance type / financed asset class) a future
  // instalment-sale / leasing product must capture; BA 930 (weighted-average rates)
  // and BA 94x (locational banking statistics, BA 941–944, multi-sub-form) are
  // AGGREGATE / entity-level statistical returns carrying ~0 product-attribute
  // requirements. CVA / FRTB are the SUPPLEMENTARY market-risk returns — their XSD
  // leaf cells carry the `MR########` element code (the recon's xsdCellCodes
  // accepts both BA / MR prefixes). FRTB is the STANDALONE Fundamental Review of
  // the Trading Book return on its OWN identity (NOT BA 320 Market Risk, NOT BA 325
  // Selected Risk Exposure). CVA / FRTB lack a D5/2025 BA-numbered obligation row,
  // so a replay-safe obligation is authored for each (ORG-PR-RETURNS-030 /
  // ORG-PR-RETURNS-031). The whole batch is licence-day-data (no real instalment-
  // sale / leasing book, loan-deposit rates, cross-border claims, derivative
  // counterparty book or trading book pre-licence-day). ★BA 94x is multi-sub-form:
  // the workbook references the SAME XSD leaf element from multiple BA 941–944 sub-
  // forms (the shared country-code dimension), but the XSD defines each leaf ONCE,
  // so the contract carries each leaf ONCE (the generator deduplicates by XSD
  // element; the recon's XSD oracle yields each leaf once — they agree).
  {
    form: "BA920",
    contractJsonPath: jsonPath("ba920-contract.json"),
    xsdName: "BA920.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA920.zip",
  },
  {
    form: "BA930",
    contractJsonPath: jsonPath("ba930-contract.json"),
    xsdName: "BA930.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA930.zip",
  },
  {
    form: "BA94x",
    contractJsonPath: jsonPath("ba94x-contract.json"),
    xsdName: "BA94x_v20251031.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA94x.zip",
  },
  {
    form: "CVA",
    contractJsonPath: jsonPath("cva-contract.json"),
    xsdName: "CVA_v06112025.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/CVA.zip",
  },
  {
    form: "FRTB",
    contractJsonPath: jsonPath("frtb-contract.json"),
    xsdName: "FRTB_v20251031.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/FRTB.zip",
  },
  // Phase C batch 9 — the FINAL return, completing the full SARB BA-return suite:
  // BA 900 ECONOMIC STATISTICS (the SARB statistical Balance Sheet of Deposit-
  // Taking Institutions per institutional and maturity breakdown). The LARGEST
  // workbook in the suite (XSD 6.2 MB, xlsx 2.9 MB; 10,752 typed leaf cells) and a
  // MULTI-SUB-FORM return (BA900_1..7, plus trailing _8 / _9 control sub-forms in
  // the Elements list). Every XSD leaf code is DISTINCT (no code is reused across
  // sub-forms), so the generator's multi-sub-form dedup is a no-op and the recon's
  // XSD oracle yields the same 10,752-leaf universe the xlsx Elements sheet does
  // (they agree by construction). The sub-form identity is folded into each cell's
  // label / regulatoryDefinition (the framework cellRef has no sub-form axis —
  // mirroring the BA 94x handling). BA 900 is an AGGREGATE / entity-level sectoral
  // balance-sheet statistical return reported by institutional sector + maturity,
  // so it carries ZERO product-attribute requirements (like BA 930 / BA 94x); no
  // product — and in particular not the live FX product — is gated on a BA 900
  // cell. The whole form is licence-day-data (no real statistical balance sheet
  // pre-licence-day). Obligation: ORG-PR-RETURNS-024 (the post-#1451-corrected
  // BA 900 = Economic statistics row; §2.1.25 / Annexure 24A/24B) — already
  // adopted, so NO new obligation is authored.
  {
    form: "BA900",
    contractJsonPath: jsonPath("ba900-contract.json"),
    xsdName: "BA900.xsd",
    schemaZipRelPath: "Regulations/SARB-PA/ba-returns/schemas/BA900.zip",
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
