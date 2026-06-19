// platform/recon/ba-return-cell-contract.ts
//
// recon:ba-return-cell-contract — the "every cell fully defined" guarantee.
//
// Asserts, for BA 100 (the pilot return), that the cell-data-requirement
// contract (`v2-core/regulatory-returns/ba100-contract.json`, validated by the
// Zod schema in `cell-contract.ts`) is COMPLETE and SOUND against the real
// substrate. This is the machine check that makes Marc's goal — "the data
// requirements for every cell, fully" — non-regressable.
//
// FOUR ASSERTIONS (per brief WS-BA-RETURN-DATA-CONTRACT)
// ------------------------------------------------------
//   (1) COMPLETENESS — every BA100.xsd Monetary1000 leaf cell has exactly one
//       contract entry, and no contract entry references a cell that is not in
//       the XSD. The XSD cell set is parsed INDEPENDENTLY here (not from the
//       generated contract) so the contract cannot "self-certify".
//   (2) CITATIONS RESOLVE (P2) — every cell carries ≥1 citation whose
//       obligationId is a real adopted obligation (exists in the obligations
//       seed).
//   (3) SOURCED CELLS ARE REAL — every `status: sourced` cell's required
//       dataRequirements point at substrate that actually exists: a GL category
//       present in the chart of accounts, a known projection, an approved
//       product (ProductApproved event), or a known reference-data set.
//   (4) NON-SOURCED CELLS ARE TRACKED — every cell with status !=
//       sourced carries an honest `statusReason` (no silent gap; Charter
//       cmd 5). counsel-gated-TBC additionally carries a counsel-TBC
//       dataRequirement (enforced by the schema; re-asserted here).
//
// ENFORCING from landing: the contract is generated complete, so there is no
// advisory-soak phase — a regression (a new XSD cell with no entry, a dangling
// citation, a sourced cell pointing at a non-existent GL account) fails CI.
//
// P1 — build-time integrity check; emits no events. Reads the event store
// (read-only) only to enumerate approved products.
// P2 — the contract is the typed cell-node graph; this gate asserts its edges
// resolve upward (citations) and downward (data sources).
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation), Phase B. Citations: Engineering-Charter.md (#3, #5, #7);
//   ORG-PR-RETURNS-002; D5/2025 §2.1.3.
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { COA_ACCOUNTS } from "../../v2-core/accounting/chart-of-accounts";
import { ba100Contract } from "../../v2-core/regulatory-returns/ba100-contract";
import type { ReturnContract } from "../../v2-core/regulatory-returns/cell-contract";
import { EventStore } from "../event-store/store";
import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba-return-cell-contract";
const MODE: "advisory" | "enforcing" = "enforcing";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SCHEMA_ZIP = resolve(HERE, "../../../Regulations/SARB-PA/ba-returns/schemas/BA100.zip");
const OBLIGATIONS_SEED = resolve(HERE, "../../../Regulations/_obligations.seed.json");

// Known non-product source families the contract may reference.
const KNOWN_PROJECTIONS = new Set(["gl-trial-balance", "ba100-balance-sheet-fold"]);
const KNOWN_REFERENCE_DATA_PREFIXES = ["legal-entity-tree", "party-register"];

// ---------------------------------------------------------------------------
// (1) Independent XSD cell-set extraction — the authoritative cell universe.
// ---------------------------------------------------------------------------

/**
 * Parse the BA100.xsd inside BA100.zip and return the set of Monetary1000 leaf
 * cell codes (BAxxxxxxxx). The XSD is extracted via the system `unzip -p`
 * (no JS zip dependency) and scanned with a scoped regex over the leaf
 * `<xs:element name="BA........"> … <xs:extension base="Monetary1000">` shape.
 * This is INDEPENDENT of the contract generator (which reads the xlsx Elements
 * sheet) so the two cannot agree by construction — completeness is a genuine
 * cross-check, not a self-certification.
 */
export function xsdCellCodes(): Set<string> {
  const proc = Bun.spawnSync(["unzip", "-p", SCHEMA_ZIP, "BA100.xsd"]);
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(`unzip of ${SCHEMA_ZIP} (BA100.xsd) failed (exit ${proc.exitCode}): ${stderr}`);
  }
  const xsd = new TextDecoder().decode(proc.stdout);
  // Every leaf monetary cell is an <xs:element name="BA00000000"> whose
  // complexType extends Monetary1000. Match the element name immediately
  // preceding an extension base="Monetary1000" (tolerating an optional
  // annotation block between them).
  const codes = new Set<string>();
  const re =
    /<xs:element\b[^>]*\bname="(BA\d{8})"[^>]*>\s*(?:<xs:annotation>.*?<\/xs:annotation>)?\s*<xs:complexType>\s*<xs:complexContent[^>]*>\s*<xs:extension base="Monetary1000">/gs;
  let m: RegExpExecArray | null = re.exec(xsd);
  while (m !== null) {
    const code = m[1];
    if (code !== undefined) codes.add(code);
    m = re.exec(xsd);
  }
  if (codes.size === 0) {
    throw new Error(
      "extracted 0 Monetary1000 leaf cells from BA100.xsd — extraction regex or schema shape changed",
    );
  }
  return codes;
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
// Assertions.
// ---------------------------------------------------------------------------

export function assertCompleteness(
  contract: ReturnContract,
  xsdCodes: Set<string>,
  violations: ReconViolation[],
): number {
  const contractCodes = new Set(contract.cells.map((c) => c.cellRef.xsdElement));
  // (a) no orphan contract cell (in contract, not in XSD).
  for (const code of contractCodes) {
    if (!xsdCodes.has(code)) {
      violations.push({
        subject: `BA100.${code}`,
        message: `contract entry references cell ${code} which is NOT a Monetary1000 leaf in BA100.xsd`,
        severity: "fail",
      });
    }
  }
  // (b) no missing XSD cell (in XSD, not in contract) — completeness.
  for (const code of xsdCodes) {
    if (!contractCodes.has(code)) {
      violations.push({
        subject: `BA100.${code}`,
        message: `BA100.xsd cell ${code} has NO contract entry (incomplete coverage)`,
        severity: "fail",
      });
    }
  }
  // (c) no duplicate cell entries.
  if (contractCodes.size !== contract.cells.length) {
    violations.push({
      subject: "BA100",
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
  let asserted = 0;
  for (const cell of contract.cells) {
    asserted++;
    if (cell.citations.length === 0) {
      violations.push({
        subject: `BA100.${cell.cellRef.xsdElement}`,
        message: "cell has no citations (P2 orphan)",
        severity: "fail",
      });
      continue;
    }
    for (const cit of cell.citations) {
      if (!obIds.has(cit.obligationId)) {
        violations.push({
          subject: `BA100.${cell.cellRef.xsdElement}`,
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
  let asserted = 0;
  for (const cell of contract.cells) {
    if (cell.status !== "sourced") continue;
    for (const d of cell.dataRequirements) {
      if (!d.required) continue;
      asserted++;
      const where = `BA100.${cell.cellRef.xsdElement}`;
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
  let asserted = 0;
  for (const cell of contract.cells) {
    if (cell.status === "sourced") continue;
    asserted++;
    const where = `BA100.${cell.cellRef.xsdElement}`;
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
// Entry point.
// ---------------------------------------------------------------------------

export async function run(): Promise<ReconResult> {
  const result = emptyResult(PIPELINE);
  const contract = ba100Contract(); // throws on schema violation (fail-closed)
  const xsdCodes = xsdCellCodes();
  const obIds = obligationIds();
  const cats = coaCategories();
  const approved = approvedProductIds();

  let asserted = 0;
  asserted += assertCompleteness(contract, xsdCodes, result.violations);
  asserted += assertCitationsResolve(contract, obIds, result.violations);
  asserted += assertSourcedCellsReal(contract, cats, approved, result.violations);
  asserted += assertNonSourcedTracked(contract, result.violations);

  result.asserted = asserted;
  result.ok = !result.violations.some((v) => v.severity === "fail");
  return result;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  const warns = result.violations.filter((v) => v.severity === "warn");
  if (result.violations.length > 0) {
    logger.error(
      {
        pipeline: PIPELINE,
        mode: MODE,
        asserted: result.asserted,
        fails: fails.length,
        warns: warns.length,
      },
      `${PIPELINE} (${MODE}): ${result.asserted} asserted, ${fails.length} fail / ${warns.length} warn`,
    );
    for (const v of result.violations.slice(0, 50)) {
      logger.error({ subject: v.subject, severity: v.severity }, v.message);
    }
    if (!result.ok) process.exit(1);
  } else {
    logger.info(
      { pipeline: PIPELINE, mode: MODE, asserted: result.asserted },
      `${PIPELINE} (${MODE}): ${result.asserted} asserted, no violations`,
    );
  }
}
