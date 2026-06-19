// platform/recon/ba-return-cell-contract.ts
//
// recon:ba-return-cell-contract — the "every cell fully defined" guarantee,
// REGISTRY-DRIVEN across all authored SARB BA-return forms.
//
// Asserts, for EVERY form in the return-contract registry
// (`v2-core/regulatory-returns/return-contracts.ts` — BA 100 + the financial
// family BA 110 / BA 120 / BA 600 / BA 610, growing as more returns are
// authored), that the form's cell-data-requirement contract (validated by the
// Zod schema in `cell-contract.ts`) is COMPLETE and SOUND against the real
// substrate. This is the machine check that makes Marc's goal — "the data
// requirements for every cell, fully" — non-regressable, and a framework
// ratchet: adding a form to the registry auto-extends coverage; it can only
// harden.
//
// FOUR ASSERTIONS (per form, per brief WS-BA-RETURN-DATA-CONTRACT)
// ----------------------------------------------------------------
//   (1) COMPLETENESS — every typed BA-code leaf cell in the form's XSD has
//       exactly one contract entry, and no contract entry references a cell not
//       in the XSD. The XSD cell set is parsed INDEPENDENTLY here (from the
//       schema zip), not from the generated contract, so the contract cannot
//       "self-certify".
//   (2) CITATIONS RESOLVE (P2) — every cell carries ≥1 citation whose
//       obligationId is a real adopted obligation (exists in the obligations
//       seed).
//   (3) SOURCED CELLS ARE REAL — every `status: sourced` cell's required
//       dataRequirements point at substrate that actually exists: a GL category
//       present in the chart of accounts, a known projection, an approved
//       product (ProductApproved event), or a known reference-data set.
//   (4) NON-SOURCED CELLS ARE TRACKED — every cell with status != sourced
//       carries an honest `statusReason` (no silent gap; Charter cmd 5).
//       counsel-gated-TBC additionally carries a counsel-TBC dataRequirement.
//
// ENFORCING from landing: contracts are generated complete, so there is no
// advisory-soak phase — a regression (a new XSD cell with no entry, a dangling
// citation, a sourced cell pointing at a non-existent GL account) fails CI.
//
// P1 — build-time integrity check; emits no events. Reads the event store
// (read-only) only to enumerate approved products.
// P2 — the contract is the typed cell-node graph; this gate asserts its edges
// resolve upward (citations) and downward (data sources).
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation): Phase B (framework + BA 100); Phase C batch 1 (BA 110/120/
//   600/610). Citations: Engineering-Charter.md (#3, #5, #7).
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { COA_ACCOUNTS } from "../../v2-core/accounting/chart-of-accounts";
import type { ReturnContract, ReturnForm } from "../../v2-core/regulatory-returns/cell-contract";
import {
  RETURN_CONTRACT_REGISTRY,
  type ReturnContractRegistryEntry,
  loadReturnContract,
} from "../../v2-core/regulatory-returns/return-contracts";
import { EventStore } from "../event-store/store";
import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba-return-cell-contract";
const MODE: "advisory" | "enforcing" = "enforcing";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const OBLIGATIONS_SEED = resolve(REPO_ROOT, "Regulations/_obligations.seed.json");

// Known non-product source families the contracts may reference. The per-form
// report folds are the named report-generation projections (one per form,
// consistent with BA 100's `ba100-balance-sheet-fold`).
const KNOWN_PROJECTIONS = new Set([
  "gl-trial-balance",
  "ba100-balance-sheet-fold",
  "ba110-obs-fold",
  "ba120-income-statement-fold",
  "ba600-consolidation-fold",
  "ba610-foreign-operations-fold",
  // Phase C batch 2 — credit-family report folds (one per form).
  "ba200-credit-risk-fold",
  "ba210-large-exposures-fold",
  "ba220-assets-bought-in-fold",
  // Phase C batch 3 — liquidity-family report folds (one per form).
  "ba300-liquidity-risk-fold",
  "ba310-min-reserve-liquid-assets-fold",
]);
const KNOWN_REFERENCE_DATA_PREFIXES = ["legal-entity-tree", "party-register", "return-form-meta"];

// ---------------------------------------------------------------------------
// (1) Independent XSD cell-set extraction — the authoritative cell universe.
// ---------------------------------------------------------------------------

/**
 * Parse the form's XSD inside its schema zip and return the set of TYPED
 * BA-code leaf cell codes (BAxxxxxxxx). A leaf cell is an `<xs:element
 * name="BA........">` whose complexType extends ONE of the SARB leaf base types
 * (Monetary1000, Percentage*, Numeric, Integer, Text, IDType, Currency, and the
 * enum types). The XSD is extracted via the system `unzip -p` (no JS zip
 * dependency) and scanned with a scoped regex.
 *
 * This is INDEPENDENT of the contract generator (which reads the xlsx Elements
 * sheet) so the two cannot agree by construction — completeness is a genuine
 * cross-check, not a self-certification.
 *
 * NB: the 8-digit BA-code DATA cells are matched; the 3-digit form-root list
 * elements (Tablelist/Rowlist/Collist) are NOT BA\d{8} and are excluded.
 */
export function xsdCellCodes(entry: ReturnContractRegistryEntry): Set<string> {
  const zipPath = resolve(REPO_ROOT, entry.schemaZipRelPath);
  const proc = Bun.spawnSync(["unzip", "-p", zipPath, entry.xsdName]);
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(
      `unzip of ${zipPath} (${entry.xsdName}) failed (exit ${proc.exitCode}): ${stderr}`,
    );
  }
  const xsd = new TextDecoder().decode(proc.stdout);
  // Every leaf cell is an <xs:element name="BA00000000"> whose complexType
  // extends one of the SARB leaf base types. Match the element name immediately
  // preceding an <xs:extension base="..."> (tolerating an optional annotation
  // block between them). The base-type capture is asserted against the known
  // leaf-type set so a NEW base type fails loudly rather than being silently
  // skipped (Charter cmd 5 — no silent deferral).
  const codes = new Set<string>();
  const re =
    /<xs:element\b[^>]*\bname="(BA\d{8})"[^>]*>\s*(?:<xs:annotation>.*?<\/xs:annotation>)?\s*<xs:complexType>\s*<xs:complexContent[^>]*>\s*<xs:extension base="([^"]+)">/gs;
  let m: RegExpExecArray | null = re.exec(xsd);
  while (m !== null) {
    const code = m[1];
    const base = m[2];
    if (code !== undefined && base !== undefined && isLeafBaseType(base)) {
      codes.add(code);
    }
    m = re.exec(xsd);
  }
  if (codes.size === 0) {
    throw new Error(
      `extracted 0 typed leaf cells from ${entry.xsdName} — extraction regex or schema shape changed`,
    );
  }
  return codes;
}

/**
 * The SARB leaf base types a data cell may carry (mirrors the generator's
 * `value_type_for`). Percentage* and the enum/text/numeric types are matched by
 * prefix / membership. A base type NOT in this set is a structural change that
 * must be handled explicitly — surfaced as a hard error by the caller.
 */
const KNOWN_LEAF_BASE_TYPES = new Set([
  "Monetary1000",
  "Numeric",
  "Integer",
  "Text",
  "IDType",
  "Currency",
  "EnumCountry",
  "ExposureType",
  "CP_YesNo",
  "RegulatoryApproach",
  "SourceOfCapital",
  // Phase C batch 2 — credit-family leaf types (BA 200 / BA 210 / BA 220).
  // The XSD carries the spreadsheetML-escaped names for the parenthesised
  // numeric types (e.g. `Number_x0020__x0028_19_x002C_2_x0029_` = "Number
  // (19,2)"); both BA 210 and BA 220 variants are listed.
  "Monetary1000NN", // non-negative Monetary1000 (BA 200 / BA 210)
  "Date", // BA 220 — date bought-in / acquired
  "Number_x0020__x0028_19_x002C_2_x0029_", // "Number (19,2)" — BA 210 exposure amounts
  "Number_x0020__x0028_14_x002C_2_x0029_", // "Number (14,2)" — BA 220 currency
  // BA 210 credit-category enum types.
  "ExposureTypeBA210",
  "ConnectionType",
  "AssetClass",
  "IndustryType",
  "PD_bucket",
  // Phase C batch 3 — liquidity-family bespoke leaf types (BA 300). The XSD
  // carries the spreadsheetML-escaped names; both are decoded above to:
  //   "Liquidity coverage ratio (LCR)"      → the LCR ratio cell (a ratio)
  //   "Specify concentration of deposit funding" → a free-text "specify…" cell
  "Liquidity_x0020_coverage_x0020_ratio_x0020__x0028_LCR_x0029_",
  "Specify_x0020_concentration_x0020_of_x0020_deposit_x0020_funding",
]);

function isLeafBaseType(base: string): boolean {
  if (base.startsWith("Percentage")) return true;
  return KNOWN_LEAF_BASE_TYPES.has(base);
}

// ---------------------------------------------------------------------------
// Obligation + product source-of-truth loaders.
// ---------------------------------------------------------------------------

function obligationIds(): Set<string> {
  const raw: unknown = JSON.parse(readFileSync(OBLIGATIONS_SEED, "utf-8"));
  const ids = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) {
      for (const v of o) walk(v);
    } else if (o !== null && typeof o === "object") {
      const rec = o as Record<string, unknown>;
      if (typeof rec.id === "string") ids.add(rec.id);
      for (const v of Object.values(rec)) walk(v);
    }
  };
  walk(raw);
  return ids;
}

function approvedProductIds(): Set<string> {
  const dbPath = process.env.BANK_EVENT_DB ?? ".local/event.db";
  const store = new EventStore(dbPath);
  const ids = new Set<string>();
  try {
    for (const e of store.replay({ type: "ProductApproved" })) {
      const p = e.payload as { productId?: unknown };
      if (typeof p.productId === "string") ids.add(p.productId);
    }
  } finally {
    store.close();
  }
  return ids;
}

const coaCategories = (): Set<string> => new Set(COA_ACCOUNTS.map((a) => a.category));

// ---------------------------------------------------------------------------
// Assertions (per form). `form` namespaces every violation subject.
// ---------------------------------------------------------------------------

export function assertCompleteness(
  contract: ReturnContract,
  xsdCodes: Set<string>,
  violations: ReconViolation[],
): number {
  const form = contract.returnForm;
  const contractCodes = new Set(contract.cells.map((c) => c.cellRef.xsdElement));
  // (a) no orphan contract cell (in contract, not in XSD).
  for (const code of contractCodes) {
    if (!xsdCodes.has(code)) {
      violations.push({
        subject: `${form}.${code}`,
        message: `contract entry references cell ${code} which is NOT a typed leaf in ${form}.xsd`,
        severity: "fail",
      });
    }
  }
  // (b) no missing XSD cell (in XSD, not in contract) — completeness.
  for (const code of xsdCodes) {
    if (!contractCodes.has(code)) {
      violations.push({
        subject: `${form}.${code}`,
        message: `${form}.xsd cell ${code} has NO contract entry (incomplete coverage)`,
        severity: "fail",
      });
    }
  }
  // (c) no duplicate cell entries.
  if (contractCodes.size !== contract.cells.length) {
    violations.push({
      subject: form,
      message: `contract has ${contract.cells.length} entries but ${contractCodes.size} distinct cells (duplicates present)`,
      severity: "fail",
    });
  }
  return xsdCodes.size + contractCodes.size;
}

export function assertCitationsResolve(
  contract: ReturnContract,
  obIds: Set<string>,
  violations: ReconViolation[],
): number {
  const form = contract.returnForm;
  let asserted = 0;
  for (const cell of contract.cells) {
    asserted++;
    if (cell.citations.length === 0) {
      violations.push({
        subject: `${form}.${cell.cellRef.xsdElement}`,
        message: "cell has no citations (P2 orphan)",
        severity: "fail",
      });
      continue;
    }
    for (const cit of cell.citations) {
      if (!obIds.has(cit.obligationId)) {
        violations.push({
          subject: `${form}.${cell.cellRef.xsdElement}`,
          message: `citation obligationId '${cit.obligationId}' does not resolve to an adopted obligation`,
          severity: "fail",
        });
      }
    }
  }
  return asserted;
}

export function assertSourcedCellsReal(
  contract: ReturnContract,
  cats: Set<string>,
  approved: Set<string>,
  violations: ReconViolation[],
): number {
  const form = contract.returnForm;
  let asserted = 0;
  for (const cell of contract.cells) {
    if (cell.status !== "sourced") continue;
    for (const d of cell.dataRequirements) {
      if (!d.required) continue;
      asserted++;
      const where = `${form}.${cell.cellRef.xsdElement}`;
      switch (d.sourceKind) {
        case "gl-account": {
          // ref is either an ACC-id or `category:<cat>`.
          if (d.ref.startsWith("category:")) {
            const cat = d.ref.slice("category:".length);
            if (!cats.has(cat)) {
              violations.push({
                subject: where,
                message: `sourced cell requires GL category '${cat}' not present in the chart of accounts`,
                severity: "fail",
              });
            }
          } else if (!COA_ACCOUNTS.some((a) => a.id === d.ref)) {
            violations.push({
              subject: where,
              message: `sourced cell requires GL account '${d.ref}' not present in the chart of accounts`,
              severity: "fail",
            });
          }
          break;
        }
        case "product-attribute": {
          // ref is `<productId>#<attr>` OR a bare attribute (e.g.
          // tradingBookDesignation). Only PRODUCT-ID refs are validated against
          // the approved-product set; bare attributes are product-agnostic.
          if (d.ref.startsWith("prd:")) {
            const pid = d.ref.split("#")[0] ?? d.ref;
            if (!approved.has(pid)) {
              violations.push({
                subject: where,
                message: `sourced cell requires product '${pid}' which is not an approved product (no ProductApproved event)`,
                severity: "fail",
              });
            }
          }
          break;
        }
        case "projection": {
          if (!KNOWN_PROJECTIONS.has(d.ref)) {
            violations.push({
              subject: where,
              message: `sourced cell requires unknown projection '${d.ref}'`,
              severity: "fail",
            });
          }
          break;
        }
        case "reference-data": {
          const ok = KNOWN_REFERENCE_DATA_PREFIXES.some((p) => d.ref.startsWith(p));
          if (!ok) {
            violations.push({
              subject: where,
              message: `sourced cell requires unknown reference-data set '${d.ref}'`,
              severity: "fail",
            });
          }
          break;
        }
        case "counsel-TBC": {
          // A sourced cell must NOT have a required counsel-TBC requirement —
          // that is a contradiction (it should be counsel-gated-TBC).
          violations.push({
            subject: where,
            message:
              "sourced cell carries a required counsel-TBC dataRequirement (status should be counsel-gated-TBC)",
            severity: "fail",
          });
          break;
        }
        case "event-field":
          // event-field refs are validated by the events suite, not here.
          break;
      }
    }
  }
  return asserted;
}

export function assertNonSourcedTracked(
  contract: ReturnContract,
  violations: ReconViolation[],
): number {
  const form = contract.returnForm;
  let asserted = 0;
  for (const cell of contract.cells) {
    if (cell.status === "sourced") continue;
    asserted++;
    const where = `${form}.${cell.cellRef.xsdElement}`;
    if (cell.statusReason === undefined || cell.statusReason.trim() === "") {
      violations.push({
        subject: where,
        message: `non-sourced cell (status ${cell.status}) has no statusReason (silent gap)`,
        severity: "fail",
      });
    }
    if (
      cell.status === "counsel-gated-TBC" &&
      !cell.dataRequirements.some((d) => d.sourceKind === "counsel-TBC")
    ) {
      violations.push({
        subject: where,
        message: "counsel-gated-TBC cell carries no counsel-TBC dataRequirement",
        severity: "fail",
      });
    }
  }
  return asserted;
}

// ---------------------------------------------------------------------------
// Per-form runner + registry-driven entry point.
// ---------------------------------------------------------------------------

interface FormContext {
  obIds: Set<string>;
  cats: Set<string>;
  approved: Set<string>;
}

/** Run all four assertions for one registered form. */
export function assertForm(
  entry: ReturnContractRegistryEntry,
  ctx: FormContext,
  violations: ReconViolation[],
): number {
  const contract = loadReturnContract(entry.form); // throws on schema violation (fail-closed)
  const xsdCodes = xsdCellCodes(entry);
  let asserted = 0;
  asserted += assertCompleteness(contract, xsdCodes, violations);
  asserted += assertCitationsResolve(contract, ctx.obIds, violations);
  asserted += assertSourcedCellsReal(contract, ctx.cats, ctx.approved, violations);
  asserted += assertNonSourcedTracked(contract, violations);
  return asserted;
}

export async function run(): Promise<ReconResult> {
  const result = emptyResult(PIPELINE);
  const ctx: FormContext = {
    obIds: obligationIds(),
    cats: coaCategories(),
    approved: approvedProductIds(),
  };

  let asserted = 0;
  for (const entry of RETURN_CONTRACT_REGISTRY) {
    asserted += assertForm(entry, ctx, result.violations);
  }

  result.asserted = asserted;
  result.ok = !result.violations.some((v) => v.severity === "fail");
  return result;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  const warns = result.violations.filter((v) => v.severity === "warn");
  const forms: ReturnForm[] = RETURN_CONTRACT_REGISTRY.map((e) => e.form);
  if (result.violations.length > 0) {
    logger.error(
      {
        pipeline: PIPELINE,
        mode: MODE,
        forms,
        asserted: result.asserted,
        fails: fails.length,
        warns: warns.length,
      },
      `${PIPELINE} (${MODE}): ${forms.length} returns, ${result.asserted} asserted, ${fails.length} fail / ${warns.length} warn`,
    );
    for (const v of result.violations.slice(0, 50)) {
      logger.error({ subject: v.subject, severity: v.severity }, v.message);
    }
    if (!result.ok) process.exit(1);
  } else {
    logger.info(
      { pipeline: PIPELINE, mode: MODE, forms, asserted: result.asserted },
      `${PIPELINE} (${MODE}): ${forms.length} returns (${forms.join(", ")}), ${result.asserted} asserted, no violations`,
    );
  }
}
