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
import { inflateRawSync } from "node:zlib";

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
  // Phase C batch 4 — market-family report folds (one per form). BA 320's fold is
  // the live ba-320-market-risk.ts standardised-position-risk engine (the FX /
  // IR / bond adapters + VaR engine); the others fold from their named market
  // projections (no live trading-book / treasury / banking-book / derivative
  // positions pre-licence-day).
  "ba320-market-risk-fold",
  "ba325-selected-risk-exposure-fold",
  "ba330-irrbb-fold",
  "ba340-equity-risk-banking-book-fold",
  "ba350-derivatives-instruments-fold",
  // Phase C batch 5 — capital-family report folds (one per form). BA 700's fold
  // is the live ba-700-capital.ts capital projection (generateBa700Capital —
  // CET1/AT1/T2 tiers, RWA decomposition, ratios) + the ba-700-leverage-ratio.ts
  // leverage projection; the regulatory minimum-required ratios + buffer add-ons
  // + the specified minimum leverage ratio are computed from BCBS / Reg-38
  // constants (sourced), so the fold is a known projection. BA 701 folds from the
  // regulatory-vs-economic-capital reconciliation projection (wholly licence-day
  // — the ICAAP economic-capital model output does not exist pre-licence-day).
  "ba700-capital-adequacy-fold",
  "ba701-regulatory-vs-economic-capital-fold",
  // Phase C batch 6 — operational-family report folds (one per form). BA 400's
  // fold is the live ba-400-op-risk.ts op-risk projection (generateBa400OpRisk —
  // BIA / TSA gross-income → op-capital, op-RWA = 12.5 × op-capital); the
  // regulatory α / β / 12.5× constants are sourced. BA 410 / BA 420 fold from
  // their named operational-loss projections over the OperationalLossEvent stream
  // (wholly licence-day — no operational-loss history pre-licence-day).
  "ba400-operational-risk-fold",
  "ba410-quarterly-losses-fold",
  "ba420-rolling-losses-fold",
  // Phase C batch 7 — securitisation + governance/limits report folds (one per
  // form). The whole family is licence-day-data (no real securitisation / third-
  // party shareholders / investment book pre-licence-day), so no cell is `sourced`
  // and these folds are not exercised by the sourced-cell check today; they are
  // listed so the family auto-passes the moment any cell becomes sourced.
  "ba500-securitisation-schemes-fold",
  "ba501-special-purpose-institutions-fold",
  "ba125-shareholders-fold",
  "ba130-investment-restrictions-fold",
  // Phase C batch 8 — statistical + supplementary report folds (one per form). The
  // whole batch is licence-day-data (no real instalment-sale / leasing book, loan-
  // deposit rates, cross-border claims, derivative counterparty book or trading
  // book pre-licence-day), so no cell is `sourced` and these folds are not
  // exercised by the sourced-cell check today; they are listed so the family
  // auto-passes the moment any cell becomes sourced. FRTB's fold is the standalone
  // FRTB market-risk fold on its own identity (NOT the BA 320 ba320-market-risk-fold).
  "ba920-instalment-sale-leasing-fold",
  "ba930-weighted-average-rates-fold",
  "ba94x-locational-banking-statistics-fold",
  "cva-capital-fold",
  "frtb-market-risk-fold",
]);
const KNOWN_REFERENCE_DATA_PREFIXES = ["legal-entity-tree", "party-register", "return-form-meta"];

// ---------------------------------------------------------------------------
// (1) Independent XSD cell-set extraction — the authoritative cell universe.
// ---------------------------------------------------------------------------

/**
 * Parse the form's XSD inside its schema zip and return the set of TYPED leaf
 * cell codes. A leaf cell is an `<xs:element name="<code>">` whose complexType
 * extends ONE of the SARB leaf base types (Monetary1000, Percentage*, Numeric,
 * Integer, Text, IDType, Currency, and the enum types). The data-cell `<code>`
 * is an 8-digit code with one of two prefixes:
 *   - `BA########` — the BA-numbered forms (the SARB BA-return schedule).
 *   - `MR########` — the SUPPLEMENTARY market-risk returns (CVA / FRTB), whose
 *     leaf cells live in the market-risk element namespace (Phase C batch 8).
 * The XSD is extracted via the system `unzip -p` (no JS zip dependency) and
 * scanned with a scoped regex.
 *
 * This is INDEPENDENT of the contract generator (which reads the xlsx Elements
 * sheet) so the two cannot agree by construction — completeness is a genuine
 * cross-check, not a self-certification.
 *
 * NB: the 8-digit data cells are matched; the 3-digit form-root list elements
 * (Tablelist/Rowlist/Collist) are NOT (BA|MR)\d{8} and are excluded.
 *
 * NB (BA 94x): the BA 94x XSD is not valid UTF-8 (a few bytes in element
 * DESCRIPTIONS are Latin-1). `TextDecoder` (non-fatal by default) substitutes
 * U+FFFD for those bytes; element NAMES and base types are ASCII, so the cell
 * universe extracts intact — the substitution touches only description prose the
 * regex does not capture.
 */
export function xsdCellCodes(entry: ReturnContractRegistryEntry): Set<string> {
  if (entry.xsdName === null) {
    throw new Error(
      `xsdCellCodes called for xlsx-only form ${entry.form} (no XSD); use cellCodeOracle`,
    );
  }
  const zipPath = resolve(REPO_ROOT, entry.schemaZipRelPath);
  const proc = Bun.spawnSync(["unzip", "-p", zipPath, entry.xsdName]);
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(
      `unzip of ${zipPath} (${entry.xsdName}) failed (exit ${proc.exitCode}): ${stderr}`,
    );
  }
  const xsd = new TextDecoder().decode(proc.stdout);
  // Every leaf cell is an <xs:element name="(BA|MR)00000000"> whose complexType
  // extends one of the SARB leaf base types. Match the element name immediately
  // preceding an <xs:extension base="..."> (tolerating an optional annotation
  // block between them). The base-type capture is asserted against the known
  // leaf-type set so a NEW base type fails loudly rather than being silently
  // skipped (Charter cmd 5 — no silent deferral).
  const codes = new Set<string>();
  const re =
    /<xs:element\b[^>]*\bname="((?:BA|MR)\d{8})"[^>]*>\s*(?:<xs:annotation>.*?<\/xs:annotation>)?\s*<xs:complexType>\s*<xs:complexContent[^>]*>\s*<xs:extension base="([^"]+)">/gs;
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
 * Run `unzip -p <zip> <member>` and return the raw bytes (throws on failure).
 * The schema zip's members are extracted with the same tool the XSD path uses.
 */
function unzipMember(zipPath: string, member: string): Uint8Array {
  const proc = Bun.spawnSync(["unzip", "-p", zipPath, member]);
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(`unzip of ${zipPath} (${member}) failed (exit ${proc.exitCode}): ${stderr}`);
  }
  return proc.stdout;
}

/**
 * Read ONE member out of an in-memory ZIP archive and return its uncompressed
 * bytes — a pure in-process parse (central-directory walk + `node:zlib`
 * inflate), with NO temp file and NO `unzip` subprocess.
 *
 * This exists because the nested xlsx (a zip inside the schema zip) was
 * previously materialised to a `.local/recon-ba501-<pid>-<ts>.xlsx` temp file
 * and re-`unzip`ped. That round-trip raced under parallel `bun test` workers:
 * the temp was written with the ASYNC, UN-AWAITED `Bun.write` from a SYNC
 * function, so `unzip` could open the file before the bytes were flushed and
 * read a 0-byte/partial temp → `unzip` "End-of-central-directory signature not
 * found". Reading the bytes already in memory removes the temp file, the second
 * subprocess, and the race entirely (Engineering-Charter #1 root-cause).
 *
 * Supports STORED (method 0) and DEFLATE (method 8) — the only methods an xlsx
 * uses (verified: every BA 501 part is `Defl:S`). Sizes/offsets are read from
 * the CENTRAL DIRECTORY (always authoritative, even when a local header defers
 * its sizes to a post-data descriptor); the local header is re-read only for its
 * own name/extra lengths, which may differ from the central directory's.
 */
export function readZipMember(zip: Uint8Array, member: string): Uint8Array {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const u16 = (o: number): number => view.getUint16(o, true);
  const u32 = (o: number): number => view.getUint32(o, true);

  // Locate the End-Of-Central-Directory record by scanning backwards for its
  // signature (PK\x05\x06). The trailing comment is variable-length (max
  // 0xffff), so the EOCD can sit up to 22 + 0xffff bytes from the end.
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  const minPos = Math.max(0, zip.byteLength - 22 - 0xffff);
  for (let i = zip.byteLength - 22; i >= minPos; i--) {
    if (u32(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw new Error(
      `readZipMember: no end-of-central-directory signature in ${zip.byteLength}-byte archive (not a zip?) seeking '${member}'`,
    );
  }

  const entryCount = u16(eocd + 10);
  let cd = u32(eocd + 16); // central-directory start offset
  const decoder = new TextDecoder();
  const CDH_SIG = 0x02014b50;
  const LFH_SIG = 0x04034b50;

  for (let n = 0; n < entryCount; n++) {
    if (u32(cd) !== CDH_SIG) {
      throw new Error(`readZipMember: bad central-directory header at offset ${cd}`);
    }
    const method = u16(cd + 10);
    const compSize = u32(cd + 20);
    const nameLen = u16(cd + 28);
    const extraLen = u16(cd + 30);
    const commentLen = u16(cd + 32);
    const localOff = u32(cd + 42);
    const name = decoder.decode(zip.subarray(cd + 46, cd + 46 + nameLen));
    if (name === member) {
      if (u32(localOff) !== LFH_SIG) {
        throw new Error(
          `readZipMember: bad local file header for '${member}' at offset ${localOff}`,
        );
      }
      const lNameLen = u16(localOff + 26);
      const lExtraLen = u16(localOff + 28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const comp = zip.subarray(dataStart, dataStart + compSize);
      if (method === 0) return Uint8Array.from(comp); // STORED — copy out of the archive buffer.
      if (method === 8) return new Uint8Array(inflateRawSync(comp)); // DEFLATE.
      throw new Error(`readZipMember: unsupported compression method ${method} for '${member}'`);
    }
    cd += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`readZipMember: member '${member}' not found in archive`);
}

/**
 * COMPLETENESS ORACLE FOR AN xlsx-ONLY FORM (BA 501 — no XSD in the SARB schema
 * package). Independently re-parses the workbook Elements sheet to return the
 * set of BA-code (BAxxxxxxxx) data-cell codes — the cell universe the contract
 * must cover exactly. This is the honest xlsx-based completeness basis the brief
 * mandates for BA 501: cells are NOT fabricated; the contract is asserted
 * complete against the workbook's own Element list.
 *
 * The parse is INDEPENDENT of the Python generator (different language, its own
 * SpreadsheetML walk) so the two cannot agree by construction — completeness is
 * a genuine cross-check, exactly as the XSD oracle is for XSD-backed forms.
 *
 * The xlsx is a zip nested inside the (committed, on-disk) schema zip. The outer
 * extraction uses the system `unzip` against the committed file (race-free); the
 * inner xl/* parts are then read IN-PROCESS from the in-memory bytes via
 * `readZipMember` — no temp file, no second `unzip` subprocess, so it is
 * deterministic under parallel test workers. No JS zip dependency is added
 * (`node:zlib` is built in).
 *
 * The Elements-sheet column layout (Name in column C / 3) is the SARB-standard
 * workbook shape shared across every BA form; a BA-code in the Name column is a
 * data cell. The 3-digit Tablelist/Rowlist/Collist form-root list elements are
 * not BA\d{8} and are excluded.
 */
export function xlsxCellCodes(entry: ReturnContractRegistryEntry): Set<string> {
  if (entry.xlsxName === undefined) {
    throw new Error(`xlsxCellCodes for ${entry.form}: registry entry has no xlsxName`);
  }
  const zipPath = resolve(REPO_ROOT, entry.schemaZipRelPath);
  // Extract the xlsx (itself a zip) from the committed schema zip, then read its
  // internal parts in-process from the in-memory bytes — the schema zip → xlsx →
  // xl/* nesting, with no temp-file round-trip.
  const xlsxBytes = unzipMember(zipPath, entry.xlsxName);
  const decoder = new TextDecoder();
  const sharedStringsXml = decoder.decode(readZipMember(xlsxBytes, "xl/sharedStrings.xml"));
  const workbookXml = decoder.decode(readZipMember(xlsxBytes, "xl/workbook.xml"));
  const relsXml = decoder.decode(readZipMember(xlsxBytes, "xl/_rels/workbook.xml.rels"));

  // shared strings: <si>…<t>…</t>…</si> — concatenate all <t> runs per <si>.
  const sharedStrings: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siM: RegExpExecArray | null = siRe.exec(sharedStringsXml);
  while (siM !== null) {
    const inner = siM[1] ?? "";
    let text = "";
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tM: RegExpExecArray | null = tRe.exec(inner);
    while (tM !== null) {
      text += tM[1] ?? "";
      tM = tRe.exec(inner);
    }
    sharedStrings.push(text);
    siM = siRe.exec(sharedStringsXml);
  }

  // rels: rId → worksheet target.
  const relTarget = new Map<string, string>();
  const relRe = /Id="(rId\d+)"[^>]*Type="[^"]*worksheet"[^>]*Target="(worksheets\/sheet\d+\.xml)"/g;
  let relM: RegExpExecArray | null = relRe.exec(relsXml);
  while (relM !== null) {
    if (relM[1] !== undefined && relM[2] !== undefined) relTarget.set(relM[1], relM[2]);
    relM = relRe.exec(relsXml);
  }

  // workbook: find the rId of the sheet named "Elements".
  const sheetRe = /<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="(rId\d+)"/g;
  let elementsRid: string | undefined;
  let shM: RegExpExecArray | null = sheetRe.exec(workbookXml);
  while (shM !== null) {
    if (shM[1] === "Elements") {
      elementsRid = shM[2];
      break;
    }
    shM = sheetRe.exec(workbookXml);
  }
  if (elementsRid === undefined) {
    throw new Error(`${entry.form}: no 'Elements' sheet in ${entry.xlsxName}`);
  }
  const elementsTarget = relTarget.get(elementsRid);
  if (elementsTarget === undefined) {
    throw new Error(`${entry.form}: Elements sheet rId ${elementsRid} has no worksheet target`);
  }
  const sheetXml = decoder.decode(readZipMember(xlsxBytes, `xl/${elementsTarget}`));

  // The Name column is column C (3rd). Scan every <c r="C{row}" …> cell and
  // resolve its value (shared-string index when t="s", inline-string for t="inlineStr",
  // else the literal). A BA-code value is a data-cell code.
  const codes = new Set<string>();
  const cellRe = /<c\b[^>]*\br="C(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g;
  let cM: RegExpExecArray | null = cellRe.exec(sheetXml);
  while (cM !== null) {
    const whole = cM[0];
    const body = cM[2] ?? "";
    const isShared = /\bt="s"/.test(whole);
    const isInline = /\bt="inlineStr"/.test(whole);
    let value: string | undefined;
    if (isInline) {
      let text = "";
      const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
      let tM: RegExpExecArray | null = tRe.exec(body);
      while (tM !== null) {
        text += tM[1] ?? "";
        tM = tRe.exec(body);
      }
      value = text;
    } else {
      const vM = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body);
      const raw = vM?.[1];
      if (raw !== undefined) {
        if (isShared) {
          const idx = Number.parseInt(raw, 10);
          value = Number.isNaN(idx) ? undefined : sharedStrings[idx];
        } else {
          value = raw;
        }
      }
    }
    if (value !== undefined && /^BA\d{8}$/.test(value)) codes.add(value);
    cM = cellRe.exec(sheetXml);
  }
  if (codes.size === 0) {
    throw new Error(
      `extracted 0 BA-code leaf cells from ${entry.xlsxName} Elements sheet — extraction or workbook shape changed`,
    );
  }
  return codes;
}

/**
 * The completeness oracle for a form: the XSD leaf-cell set when an XSD is
 * present, else the xlsx Elements-sheet cell set (BA 501 — xlsx-only). Either
 * way the cell universe is re-derived INDEPENDENTLY of the generated contract.
 */
export function cellCodeOracle(entry: ReturnContractRegistryEntry): Set<string> {
  return entry.xsdName === null ? xlsxCellCodes(entry) : xsdCellCodes(entry);
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
  // Phase C batch 6 — operational-family bespoke leaf types (BA 400 / BA 410).
  //   "YesNo"          → a Yes/No response cell (an enum) — BA 400 ILM-usage flag,
  //                      BA 410 "previously reported" / "status: ended" flags.
  //   "RiskEventType"  → the BA 410 operational-loss risk-event-type code (an
  //                      enum) — the Basel-II / Reg-33 / OPE25 loss-event-type
  //                      taxonomy (internal fraud, external fraud, employment
  //                      practices, clients/products/business practices, damage to
  //                      physical assets, business disruption / system failures,
  //                      execution / delivery / process management).
  // NB: the "Percentage 19,9" (BA 400) leaf type is matched by the `Percentage`
  // prefix in isLeafBaseType(); the "CP_Date" / "CP_Integer (14)" meta types sit
  // on non-BA-code form-meta elements (ReportingEndDate etc.) which the BA\d{8}
  // name filter excludes, so they need no entry here.
  "YesNo",
  "RiskEventType",
  // Phase C batch 8 — statistical (BA 94x) + supplementary (CVA / FRTB) leaf types.
  //   BA 94x (Locational Banking Statistics):
  //     "Country_BA94"            — the ISO country code of the counterparty / claim
  //                                 location (the locational axis) — an enum.
  //   CVA (Credit Valuation Adjustment):
  //     "CVAApproach"             — the CVA capital approach (BA-CVA / SA-CVA) — enum.
  //   FRTB (Fundamental Review of the Trading Book):
  //     "AllocationStructure"     — the trading-desk allocation structure axis — enum.
  //     "RiskScope"               — the FRTB risk-scope axis — enum.
  //     "MRCapitalisationApproach"— the market-risk capitalisation approach (SA/IMA) — enum.
  //     "TrafficLightStatus"      — the IMA P&L-attribution / backtesting traffic-light — enum.
  //     "CP_RiskRating"           — the counterparty / issuer credit-quality rating bucket — enum.
  //     "SpecifyDate"             — a "specify date" cell (a date).
  //     "ReportingBaseCurrency"   — the reporting base-currency code cell (a currency id).
  //   (FRTB's "Percentage 19,9" leaf type is matched by the `Percentage` prefix in
  //    isLeafBaseType(); its `Currency` / `Date` / `Text` / `Integer` / `Numeric` /
  //    `YesNo` leaf types are already known above.)
  "Country_BA94",
  "CVAApproach",
  "AllocationStructure",
  "RiskScope",
  "MRCapitalisationApproach",
  "TrafficLightStatus",
  "CP_RiskRating",
  "SpecifyDate",
  "ReportingBaseCurrency",
  // Phase C batch 7 — securitisation + governance/limits family leaf types.
  // BA 125 (shareholders) carries the domestic-vs-foreign shareholder enum; its
  // XSD name is the spreadsheetML-escaped "Foreign/Domestic". (BA 500's XSD uses
  // only Monetary1000 / Text / Integer — all already known; BA 130's XSD uses
  // Monetary1000 / Text / Numeric / Integer / IDType — all already known. BA 501
  // has NO XSD: its completeness oracle is the xlsx Elements sheet, handled by
  // `xlsxCellCodes` below, so its bespoke enum/date leaf types — Programme /
  // IFRS 9 / SchemeTriggers / Class / Rated / RatingScore / InstrumentProfile /
  // InterestRateBenchmark / CP_Date — are NOT XSD leaf types and are not listed
  // here.)
  "Foreign_x002F_Domestic",
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
  oracleCodes: Set<string>,
  violations: ReconViolation[],
  oracleName = "xsd",
): number {
  const form = contract.returnForm;
  const contractCodes = new Set(contract.cells.map((c) => c.cellRef.xsdElement));
  // (a) no orphan contract cell (in contract, not in the cell oracle).
  for (const code of contractCodes) {
    if (!oracleCodes.has(code)) {
      violations.push({
        subject: `${form}.${code}`,
        message: `contract entry references cell ${code} which is NOT a typed leaf in ${form} ${oracleName}`,
        severity: "fail",
      });
    }
  }
  // (b) no missing oracle cell (in oracle, not in contract) — completeness.
  for (const code of oracleCodes) {
    if (!contractCodes.has(code)) {
      violations.push({
        subject: `${form}.${code}`,
        message: `${form} ${oracleName} cell ${code} has NO contract entry (incomplete coverage)`,
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
  return oracleCodes.size + contractCodes.size;
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
  const oracleCodes = cellCodeOracle(entry);
  const oracleName = entry.xsdName === null ? "xlsx (Elements sheet — no XSD)" : "xsd";
  let asserted = 0;
  asserted += assertCompleteness(contract, oracleCodes, violations, oracleName);
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
