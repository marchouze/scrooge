// platform/recon/fx-return-cell-lineage.ts
//
// recon:fx-return-cell-lineage — the drift gate for the FX→return-cell inverse
// index (`v2-core/regulatory-returns/fx-product-return-cells.ts`).
//
// The FX inverse index NAMES the SARB BA-return cells an FX OTC vanilla trade
// feeds, at their verbatim XSD coordinate. The cells themselves are SOURCED from
// the SARB XSD by the L2 return contracts (asserted complete by
// `recon:ba-return-cell-contract`). This gate closes the loop: it asserts that
// every cell the FX index DECLARES actually resolves — VERBATIM (form + row +
// column + XSD element + label) — against the XSD-sourced L2 contract. So the
// curated FX map can never drift from the SARB schema: the contract is the
// oracle, the index only selects from it, and this gate proves the selection is
// real (Engineering-Charter cmd 4 — source, don't hardcode; cmd 5 — no silent
// deferral: every deferred edge / non-applicable finding is well-formed and
// tracked).
//
// FOUR ASSERTIONS
// ---------------
//   (1) CURATED CELL RESOLVES — every FX_CURATED_FED_CELLS entry resolves to a
//       real cell in its form's contract, and its declared row / column / label
//       match the contract VERBATIM. A drifted coordinate (the SARB schema moved,
//       the curated map went stale) fails loudly.
//   (2) GENERIC EDGES NON-EMPTY — the FX product's per-product edges (the BA 100
//       balanceSheetClassification derivative lines) still resolve via the
//       generic inverse index. If the FX product is dropped from every contract
//       cell, that is a regression the gate catches (the lineage must not go
//       silently empty).
//   (3) DEFERRED EDGES TRACKED — every FX_DEFERRED_EDGES entry carries a
//       GAP-prefixed id and a reason (tracked, not a bare TBC). The form it
//       defers is a real registered return form.
//   (4) NON-APPLICABLE FINDINGS RECORDED — every FX_NON_APPLICABLE entry carries
//       a finding id and a reason, and its form is a real return form whose
//       contract genuinely contains NO cell the FX index claims (so the
//       not-applicable assertion is honest — we don't declare a return N/A while
//       also feeding it).
//
// P1 — build-time integrity check; emits no events, reads only the reference-data
//      L2 contracts (no event store, no money).
// P2 — asserts the FX cell-node edges resolve into the XSD-sourced contract graph.
//
// Authority: D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING (CEO-approved
//   2026-06-21); D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Citations: Engineering-Charter.md (#4, #5, #7).
// Author: Mira (Compliance / RegTech engineer, engineering — reports to Zanele
//   (Chief Compliance Officer)).

import { fileURLToPath } from "node:url";

import type {
  ReturnCellContract,
  ReturnContract,
} from "../../v2-core/regulatory-returns/cell-contract";
import {
  FX_CURATED_FED_CELLS,
  FX_DEFERRED_EDGES,
  FX_NON_APPLICABLE,
  FX_OTC_VANILLA_PRODUCT_ID,
} from "../../v2-core/regulatory-returns/fx-product-return-cells";
import { returnDataObligationsForProduct } from "../../v2-core/regulatory-returns/inverse-index";
import {
  RETURN_CONTRACT_REGISTRY,
  allReturnContracts,
} from "../../v2-core/regulatory-returns/return-contracts";
import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-return-cell-lineage";
const MODE: "advisory" | "enforcing" = "enforcing";

const REGISTERED_FORMS = new Set(RETURN_CONTRACT_REGISTRY.map((e) => e.form));

/** Index a contract set by `${form}::${xsdElement}` for verbatim lookup. */
function indexCells(contracts: readonly ReturnContract[]): Map<string, ReturnCellContract> {
  const idx = new Map<string, ReturnCellContract>();
  for (const contract of contracts) {
    for (const cell of contract.cells) {
      idx.set(`${contract.returnForm}::${cell.cellRef.xsdElement}`, cell);
    }
  }
  return idx;
}

export function assertCuratedCellsResolve(
  cellIndex: Map<string, ReturnCellContract>,
  violations: ReconViolation[],
): number {
  let asserted = 0;
  for (const decl of FX_CURATED_FED_CELLS) {
    asserted++;
    const subject = `${decl.returnForm}.${decl.xsdElement}`;
    if (!REGISTERED_FORMS.has(decl.returnForm)) {
      violations.push({
        subject,
        message: `curated FX cell names form ${decl.returnForm} which is not in the return-contract registry`,
        severity: "fail",
      });
      continue;
    }
    const cell = cellIndex.get(`${decl.returnForm}::${decl.xsdElement}`);
    if (cell === undefined) {
      violations.push({
        subject,
        message: `curated FX cell ${decl.xsdElement} does NOT resolve to a contract cell in ${decl.returnForm} (drifted or fabricated)`,
        severity: "fail",
      });
      continue;
    }
    // Verbatim coordinate checks — the curated map must mirror the XSD-sourced
    // contract exactly.
    if (cell.cellRef.row !== decl.row) {
      violations.push({
        subject,
        message: `curated FX cell row '${decl.row}' ≠ contract row '${cell.cellRef.row ?? "(none)"}'`,
        severity: "fail",
      });
    }
    if (cell.cellRef.column !== decl.column) {
      violations.push({
        subject,
        message: `curated FX cell column '${decl.column}' ≠ contract column '${cell.cellRef.column ?? "(none)"}'`,
        severity: "fail",
      });
    }
    if (cell.label !== decl.sarbLabel) {
      violations.push({
        subject,
        message: `curated FX cell label '${decl.sarbLabel}' ≠ contract label '${cell.label}' (verbatim drift)`,
        severity: "fail",
      });
    }
  }
  return asserted;
}

export function assertGenericEdgesNonEmpty(
  contracts: readonly ReturnContract[],
  violations: ReconViolation[],
): number {
  const generic = returnDataObligationsForProduct(FX_OTC_VANILLA_PRODUCT_ID, contracts);
  if (generic.cells.length === 0) {
    violations.push({
      subject: FX_OTC_VANILLA_PRODUCT_ID,
      message:
        "FX product has ZERO per-product return-cell edges across all contracts — the BA 100 balanceSheetClassification edges have gone silently empty (regression)",
      severity: "fail",
    });
  }
  return 1;
}

export function assertDeferredEdgesTracked(violations: ReconViolation[]): number {
  let asserted = 0;
  for (const edge of FX_DEFERRED_EDGES) {
    asserted++;
    const subject = `${edge.returnForm}.${edge.gapId}`;
    if (!REGISTERED_FORMS.has(edge.returnForm)) {
      violations.push({
        subject,
        message: `deferred FX edge names form ${edge.returnForm} not in the return-contract registry`,
        severity: "fail",
      });
    }
    if (!edge.gapId.startsWith("GAP-")) {
      violations.push({
        subject,
        message: `deferred FX edge id '${edge.gapId}' must be a GAP-prefixed tracked-gap id (Charter cmd 5)`,
        severity: "fail",
      });
    }
    if (edge.reason.trim() === "") {
      violations.push({
        subject,
        message: "deferred FX edge carries no reason (silent deferral)",
        severity: "fail",
      });
    }
  }
  return asserted;
}

export function assertNonApplicableRecorded(
  cellIndex: Map<string, ReturnCellContract>,
  violations: ReconViolation[],
): number {
  const curatedForms = new Set(FX_CURATED_FED_CELLS.map((c) => c.returnForm));
  let asserted = 0;
  for (const na of FX_NON_APPLICABLE) {
    asserted++;
    const subject = `${na.returnForm}.${na.findingId}`;
    if (!REGISTERED_FORMS.has(na.returnForm)) {
      violations.push({
        subject,
        message: `non-applicable FX finding names form ${na.returnForm} not in the return-contract registry`,
        severity: "fail",
      });
    }
    if (na.findingId.trim() === "" || na.reason.trim() === "") {
      violations.push({
        subject,
        message: "non-applicable FX finding missing findingId or reason",
        severity: "fail",
      });
    }
    // Honesty: a form declared non-applicable must NOT also be fed by a curated
    // FX cell (we cannot both feed it and call it N/A). `cellIndex` is unused for
    // the membership check but kept to assert the form's contract is loadable.
    if (curatedForms.has(na.returnForm)) {
      violations.push({
        subject,
        message: `form ${na.returnForm} is declared FX-non-applicable but also appears in FX_CURATED_FED_CELLS (contradiction)`,
        severity: "fail",
      });
    }
    const hasAnyCell = [...cellIndex.keys()].some((k) => k.startsWith(`${na.returnForm}::`));
    if (!hasAnyCell) {
      violations.push({
        subject,
        message: `form ${na.returnForm} declared FX-non-applicable but its contract loaded ZERO cells (load failure, not a real N/A)`,
        severity: "fail",
      });
    }
  }
  return asserted;
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const contracts = allReturnContracts(); // throws on schema violation (fail-closed)
  const cellIndex = indexCells(contracts);

  let asserted = 0;
  asserted += assertCuratedCellsResolve(cellIndex, result.violations);
  asserted += assertGenericEdgesNonEmpty(contracts, result.violations);
  asserted += assertDeferredEdgesTracked(result.violations);
  asserted += assertNonApplicableRecorded(cellIndex, result.violations);

  result.asserted = asserted;
  result.ok = !result.violations.some((v) => v.severity === "fail");
  return result;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  if (result.violations.length > 0) {
    logger.error(
      { pipeline: PIPELINE, mode: MODE, asserted: result.asserted, fails: fails.length },
      `${PIPELINE} (${MODE}): ${result.asserted} asserted, ${fails.length} fail`,
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
