// v2-core/regulatory-returns/fx-product-return-cells.ts
//
// L3 (FX SPECIALISATION) — "where does an FX trade report?".
//
// This module answers the concrete operational question the lineage review
// surfaced and the BA-320 / BA-100 generator stubs deferred ("[citation: TBC —
// exact SARB BA 320 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema
// ingestion]"):
//
//     "An FX OTC vanilla trade is booked — which SARB BA-return CELLS (form,
//      row, column, XSD element) does it populate, in BOTH the balance-sheet/
//      P&L direction and the prudential direction?"
//
// It is the FX SPECIALISATION of the generic inverse index (`inverse-index.ts`).
// The generic index answers it for ANY product by walking `product-attribute`
// dataRequirements whose ref names the product. For FX OTC vanilla the only
// return whose contract already carries that product edge is BA 100 (the
// `balanceSheetClassification` derivative lines) — so the generic walk alone
// returns ONLY the BA 100 cells. The prudential returns (BA 320 market risk,
// BA 700 capital, BA 200 counterparty credit risk) carry their FX line-items at
// AGGREGATE risk-class granularity (e.g. BA 320 "Foreign exchange risk / Total")
// fed by the market-risk fold, NOT by a per-product attribute — so the FX
// product does not (and should not) appear as a `product-attribute` ref on those
// cells. This module names those aggregate FX line-items EXPLICITLY, as a curated
// typed map, so the FX→cell lineage is complete in both directions.
//
// PRINCIPLE BINDINGS
// ------------------
//   P1 — pure read over the reference-data L2 contracts (no events, no stored
//        state, no money value).
//   P2 — every declared cell is asserted to resolve VERBATIM (form + row +
//        column + XSD element + label) against the XSD-sourced L2 contract by
//        `recon:fx-return-cell-lineage`; a drifted or fabricated cell is a loud
//        recon failure, never a silent pass (Engineering-Charter cmd 4 — source,
//        don't hardcode: the contract, sourced from the SARB XSD, is the oracle;
//        this map only NAMES which of those sourced cells FX feeds).
//
// HONEST SCOPE (Engineering-Charter cmd 5 — no silent partial). The seven
// FX-relevant returns from the lineage review map as follows:
//   - BA 100 (Balance Sheet)       — REAL FX edges: the FVTPL derivative
//       financial-instrument asset / liability lines (R0330 / R0660), already
//       carried as `prd:bank:fx:otc-vanilla#balanceSheetClassification`
//       product-attribute requirements in the BA 100 contract. Surfaced here via
//       the generic walk (`fxProductGenericFedCells`).
//   - BA 320 (Market Risk)         — REAL FX edges: the FX-risk-class aggregate
//       lines (net open position per currency, the 8 % charge). Curated below.
//   - BA 700 (Capital)             — REAL FX edges: the market-RWA contribution
//       of the FX charge (BA 320 → BA 700 numerator). Curated below.
//   - BA 200 (Credit Risk)         — REAL FX edges: the OTC-derivative
//       counterparty-credit-risk exposure (SA-CCR EAD) of the FX trade. Curated
//       below.
//   - BA 120 (Income Statement)    — REAL FX edges: FX trading revenue (the
//       FVTPL fair-value movement + IAS 21 revaluation) in the trading-revenue
//       lines. Curated below.
//   - BA 300 (Liquidity)           — DEFERRED (tracked gap GAP-FX-BA300-CASHFLOW):
//       FX settlement cashflows feed the LCR maturity-bucket inflow/outflow grid,
//       but the BA 300 inflow/outflow cells are entity-aggregate
//       (`licence-day-data`) with no per-product attribute and no settled FX
//       cashflow projection wired into the LCR fold yet. Named as a tracked gap,
//       not a fabricated edge.
//   - BA 110 (Off-Balance-Sheet)   — NOT APPLICABLE (recorded finding
//       FINDING-FX-BA110-NO-LINE): the SARB BA 110 schema has NO foreign-exchange
//       forward / swap notional line — its rows are guarantees, letters of credit,
//       acceptances, committed facilities, credit-derivative instruments, lease
//       commitments. FX OTC derivative exposure is captured in the prudential
//       returns (BA 320 market risk + BA 200 counterparty credit risk), NOT as a
//       BA 110 off-balance-sheet notional. The lineage-review premise that BA 110
//       carries "forward/swap notionals, CCF-weighted" does not hold against the
//       published BA 110 XSD.
//
// Authority: D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING (CEO-approved
//   2026-06-21); D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Backing brief: brief:mira:typed-per-cell-fx-return-contracts-fx-product-to:2026-06-21.
// Citations: ORG-PR-RETURNS-012 (BA 320 Market Risk); ORG-PR-RETURNS-002 (BA 100);
//   ORG-PR-RETURNS-022 (BA 700); ORG-PR-RETURNS-007 (BA 200); ORG-PR-RETURNS-004
//   (BA 120); SARB PA Directive D5/2025; the FX treatment modules
//   (`v2-core/reporting-treatments/fx-modules.ts`).

import type { FX_TREATMENT_MODULE_IDS } from "../reporting-treatments/fx-modules";
import type { ReturnContract, ReturnForm } from "./cell-contract";
import { returnDataObligationsForProduct } from "./inverse-index";

// ---------------------------------------------------------------------------
// The FX product identity + its treatment dimensions.
// ---------------------------------------------------------------------------

/** The live, NPA-approved FX OTC vanilla product the lineage is anchored on. */
export const FX_OTC_VANILLA_PRODUCT_ID = "prd:bank:fx:otc-vanilla" as const;

/**
 * The reporting-treatment dimension a curated FX cell is reached THROUGH. This
 * is the both-directions link the brief asks for: a cell is fed by FX because of
 * a specific treatment module the FX product picks (its IFRS classification, its
 * prudential treatment, its tax treatment). Re-exported from the canonical FX
 * module menu so the two never drift.
 */
export type FxTreatmentModuleId = (typeof FX_TREATMENT_MODULE_IDS)[number];

// ---------------------------------------------------------------------------
// Curated FX cell declaration — the typed both-directions edge.
// ---------------------------------------------------------------------------

/**
 * One SARB return cell an FX OTC vanilla trade feeds, named at its VERBATIM XSD
 * coordinate. Every field here is asserted against the XSD-sourced L2 contract
 * by `recon:fx-return-cell-lineage` — so this declaration cannot drift from the
 * SARB schema (the contract is the oracle; this only selects from it).
 */
export interface FxFedCellDeclaration {
  readonly returnForm: ReturnForm;
  /** The XSD element code (e.g. "BA01019454") — the upload-schema identity. */
  readonly xsdElement: string;
  /** Grid row coordinate (e.g. "R0140"). */
  readonly row: string;
  /** Grid column coordinate (e.g. "C0030"). */
  readonly column: string;
  /** The SARB line-item label this trade feeds (verbatim, for human lineage). */
  readonly sarbLabel: string;
  /** The FX treatment dimension this edge is reached through (both-directions). */
  readonly throughTreatment: FxTreatmentModuleId;
  /** Plain-language why-this-cell, for the lineage view. */
  readonly rationale: string;
}

/**
 * A DEFERRED FX→cell edge — a return the FX trade genuinely feeds but whose cell
 * cannot be sourced from the current substrate. Tracked (Engineering-Charter
 * cmd 5), NOT a fabricated edge or a bare TBC. The recon asserts `gapId` is a
 * real, registered tracked gap so it cannot rot silently.
 */
export interface FxDeferredEdge {
  readonly returnForm: ReturnForm;
  readonly gapId: string;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// The curated FX prudential / P&L cells (the edges NOT carried as a per-product
// attribute on the aggregate-fold returns). VERBATIM from the L2 contracts —
// asserted by recon, so they are sourced, not hardcoded-without-oracle.
// ---------------------------------------------------------------------------

export const FX_CURATED_FED_CELLS: readonly FxFedCellDeclaration[] = [
  // === BA 320 — Market Risk: the FX-risk-class aggregate the 8 % charge lands on.
  {
    returnForm: "BA320",
    xsdElement: "BA01019454",
    row: "R0140",
    column: "C0030",
    sarbLabel: "Foreign exchange risk / Total",
    throughTreatment: "prudential-treatment:fx-trading-book",
    rationale:
      "The FX trade's net open position per currency aggregates into the foreign-exchange-risk capital requirement (8 % of the greater of net long / net short aggregate positions — Reg 28; BCBS standardised FX risk). This is the headline FX market-risk charge cell.",
  },
  {
    returnForm: "BA320",
    xsdElement: "BA01011100",
    row: "R0650",
    column: "C0010",
    sarbLabel: "Total foreign currency and gold position / Trading book - Long",
    throughTreatment: "prudential-treatment:fx-trading-book",
    rationale:
      "The FX trade's long currency leg accumulates into the aggregate trading-book long foreign-currency position, the net-open-position basis of the FX charge.",
  },
  {
    returnForm: "BA320",
    xsdElement: "BA01011101",
    row: "R0650",
    column: "C0020",
    sarbLabel: "Total foreign currency and gold position / Trading book - Short",
    throughTreatment: "prudential-treatment:fx-trading-book",
    rationale:
      "The FX trade's short currency leg accumulates into the aggregate trading-book short foreign-currency position, the net-open-position basis of the FX charge.",
  },
  // === BA 120 — Income Statement: the FX trading P&L line.
  {
    returnForm: "BA120",
    xsdElement: "BA01000897",
    row: "R0490",
    column: "C0020",
    sarbLabel: "Net trading income / (loss) / Trading",
    throughTreatment: "ifrs-classification:fx-fvtpl",
    rationale:
      "The FX trade is FVTPL (IFRS 9 §4.1.4 — fails SPPI, trading business model); its fair-value movement plus IAS 21 §23 revaluation flow into net trading income in the trading column.",
  },
  // === BA 200 — Credit Risk: the OTC-derivative counterparty-credit-risk EAD.
  {
    returnForm: "BA200",
    xsdElement: "BA01002049",
    row: "R0120",
    column: "C0010",
    sarbLabel: "Exposure at default (EAD) / Total",
    throughTreatment: "prudential-treatment:fx-trading-book",
    rationale:
      "The FX OTC derivative carries counterparty credit risk; its SA-CCR exposure-at-default (replacement cost + potential future exposure) aggregates into the total counterparty-credit-risk EAD. This cell is licence-day-data — the EAD fold has no real counterparty positions pre-licence-day — but the FX→BA 200 edge is real and sourced (the line exists, the SA-CCR fold exists).",
  },
  // === BA 700 — Capital: the market-risk capital allocation the FX charge feeds.
  {
    returnForm: "BA700",
    xsdElement: "BA01020462",
    row: "R0870",
    column: "C0010",
    sarbLabel: "of which: allocated to support market risk",
    throughTreatment: "prudential-treatment:fx-trading-book",
    rationale:
      "The BA 320 FX market-risk charge (8 %) becomes market RWA (× 12.5) and consumes capital allocated to support market risk in the BA 700 capital-adequacy return — the BA 320 → BA 700 numerator/denominator link. Licence-day-data (no real capital pre-licence-day), but the FX→BA 700 edge is real and the line exists.",
  },
];

// ---------------------------------------------------------------------------
// The deferred FX edges — tracked, not silent.
// ---------------------------------------------------------------------------

export const FX_DEFERRED_EDGES: readonly FxDeferredEdge[] = [
  {
    returnForm: "BA300",
    gapId: "GAP-FX-BA300-CASHFLOW",
    reason:
      "FX settlement cashflows feed the BA 300 LCR maturity-bucket inflow / outflow grid, but those cells are entity-aggregate (licence-day-data) and no settled-FX-cashflow projection is wired into the LCR fold yet. The FX→BA 300 edge is real but not sourceable today; tracked here, not fabricated.",
  },
];

// ---------------------------------------------------------------------------
// The non-applicable finding — BA 110 has no FX line (recorded, not hidden).
// ---------------------------------------------------------------------------

export interface FxNonApplicableFinding {
  readonly returnForm: ReturnForm;
  readonly findingId: string;
  readonly reason: string;
}

export const FX_NON_APPLICABLE: readonly FxNonApplicableFinding[] = [
  {
    returnForm: "BA110",
    findingId: "FINDING-FX-BA110-NO-LINE",
    reason:
      "The published SARB BA 110 (Off-Balance-Sheet Activities) XSD has NO foreign-exchange forward / swap notional line — its rows are guarantees, letters of credit, acceptances, committed facilities, credit-derivative instruments and lease commitments. FX OTC derivative exposure is captured in BA 320 (market risk) and BA 200 (counterparty credit risk), not as a BA 110 off-balance-sheet notional.",
  },
];

// ---------------------------------------------------------------------------
// The public both-directions query.
// ---------------------------------------------------------------------------

/** A cell FX feeds, with where it came from (generic product-attribute walk or curated edge). */
export interface FxFedCell {
  readonly returnForm: ReturnForm;
  readonly xsdElement: string;
  readonly label: string;
  readonly source: "product-attribute" | "curated-aggregate";
  /** Present for curated cells — the FX treatment dimension the edge runs through. */
  readonly throughTreatment?: FxTreatmentModuleId;
}

export interface FxReturnLineage {
  readonly productId: string;
  /** Every cell FX feeds — the BA 100 per-product edges + the curated prudential / P&L edges. */
  readonly fedCells: readonly FxFedCell[];
  /** The forms FX touches with a real, sourceable cell today. */
  readonly forms: readonly ReturnForm[];
  /** Returns FX genuinely feeds but cannot source yet (tracked gaps). */
  readonly deferred: readonly FxDeferredEdge[];
  /** Returns whose schema has no FX line (recorded findings). */
  readonly nonApplicable: readonly FxNonApplicableFinding[];
}

/**
 * Build the complete FX→return-cell lineage. Combines:
 *   (a) the generic per-product walk (the BA 100 `balanceSheetClassification`
 *       edges already in the contract), and
 *   (b) the curated aggregate prudential / P&L edges (BA 320 / BA 200 / BA 120 /
 *       BA 700) that the FX trade feeds via the market-risk / counterparty /
 *       trading-revenue folds rather than a per-product attribute.
 * Pure over the supplied L2 contracts (pass `allReturnContracts()`).
 */
export function fxReturnLineage(contracts: readonly ReturnContract[]): FxReturnLineage {
  const fedCells: FxFedCell[] = [];

  // (a) generic per-product edges (BA 100).
  const generic = returnDataObligationsForProduct(FX_OTC_VANILLA_PRODUCT_ID, contracts);
  for (const c of generic.cells) {
    fedCells.push({
      returnForm: c.returnForm,
      xsdElement: c.xsdElement,
      label: c.label,
      source: "product-attribute",
    });
  }

  // (b) curated aggregate edges — looked up in the contracts for the verbatim
  // label (the recon independently asserts coordinates match; here we surface
  // the contract's own label so the lineage view shows the SARB text).
  const cellIndex = new Map<string, { form: ReturnForm; label: string }>();
  for (const contract of contracts) {
    for (const cell of contract.cells) {
      cellIndex.set(`${contract.returnForm}::${cell.cellRef.xsdElement}`, {
        form: contract.returnForm,
        label: cell.label,
      });
    }
  }
  for (const decl of FX_CURATED_FED_CELLS) {
    const found = cellIndex.get(`${decl.returnForm}::${decl.xsdElement}`);
    fedCells.push({
      returnForm: decl.returnForm,
      xsdElement: decl.xsdElement,
      label: found?.label ?? decl.sarbLabel,
      source: "curated-aggregate",
      throughTreatment: decl.throughTreatment,
    });
  }

  const forms = [...new Set(fedCells.map((c) => c.returnForm))].sort();
  return {
    productId: FX_OTC_VANILLA_PRODUCT_ID,
    fedCells: fedCells.sort((a, b) =>
      a.returnForm === b.returnForm
        ? a.xsdElement.localeCompare(b.xsdElement)
        : a.returnForm.localeCompare(b.returnForm),
    ),
    forms,
    deferred: FX_DEFERRED_EDGES,
    nonApplicable: FX_NON_APPLICABLE,
  };
}
