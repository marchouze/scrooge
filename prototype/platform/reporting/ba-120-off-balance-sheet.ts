// platform/reporting/ba-120-off-balance-sheet.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 9 — BA 120 (Off-Balance-
// Sheet Activities) projection. Monthly SARB return.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 9.
// Additional authority: Marc's 2026-05-17 directive.
//
// BA 120 is the SARB Prudential Authority monthly return covering off-
// balance-sheet exposures: derivative notionals, guarantees, credit
// commitments, documentary credits (letters of credit), and other
// contingent items. Off-balance-sheet items are those that do not
// appear as assets or liabilities on the balance sheet but represent
// future obligations or contingent exposures.
//
// Pipeline:
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → FORWARD OBLIGATIONS PROJECTION
//              (`platform/forward-obligations/projection.ts`)
//              FxTradeExecuted → ForwardObligation[] — FX derivative
//              notionals flow through here.
//      → BA 120 PROJECTION     — this module — pure function
//      → RENDER + STORE        — `ba-120-render.ts` + RMS doc store
//
// Computation per Banks Act 94 of 1990 §13 (off-balance-sheet obligations
// disclosure) + Regulations Relating to Banks Reg 23 (off-balance-sheet
// activities monthly return):
//
//   derivatives     — notional amounts by product type + remaining-maturity
//                     band (< 1Y / 1–5Y / > 5Y), split interest-rate vs FX
//                     vs equity vs commodity derivatives.
//   guarantees      — financial guarantees (credit-substitute) + performance
//                     guarantees, by remaining term band.
//   commitments     — irrevocable and revocable undrawn credit facilities,
//                     split by original term (< 1Y = 0% CCF; ≥ 1Y = 50% CCF).
//   documentary     — letters of credit (import L/Cs, export L/Cs,
//                     acceptances). v0: caller marks as classificationGap.
//   other           — residual contingent items not captured above.
//
// Per-entity: LE-ZA-HOZ-BANK only at v0. The generator throws on group
// or securities entity (see `D-REGULATORY-PERIMETER`).
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **Commitments sub-ledger not yet built** — v0 uses caller-supplied
//     `Ba120CommitmentsEntry[]`. When the commitments sub-ledger lands
//     (planned; no decision-ID yet), the generator input-shape is forward-
//     compatible — the sub-ledger's typed output will match
//     `Ba120CommitmentsEntry` (no generator API change).
//   - **Custody / safekeeping register not yet built** — the BA 120 form
//     has a custody section (items held in safe custody, acting as
//     custodian / sub-custodian). Omitted at v0; noted in
//     `classificationGaps` output so the recon pipeline can track the
//     outstanding gap. Custody section lands once the custody register
//     merges (planned under `WS-CUSTODY-REGISTER`, no decision-ID yet).
//   - **XML adapter deferred** — SARB-portal XML submission (the machine-
//     readable BA 120 submission format) is deferred to a downstream slice
//     under `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN`. The JSON render
//     at `ba-120-render.ts` is the canonical output at v0; the XML adapter
//     will transform from it.
//   - **Group-consolidated BA 120** (LE-ZA-HOZ-GROUP look-through per
//     Banks Act §60) deferred under `D-REGULATORY-PERIMETER` (CEO-approved
//     2026-05-10). Solo entity only at v0.
//   - **Guarantee sub-ledger** — similar gap to commitments; v0 uses
//     caller-supplied `Ba120GuaranteesEntry[]`. Production form deferred.
//   - **Notional classification by product type** — FX derivative notionals
//     flow from `ForwardObligation[]` (via FxTradeExecuted events); IR
//     derivative notionals (swaps, FRAs) are not yet booked in the event
//     store. The BA 120 derivatives section captures FX notionals from the
//     forward-obligations projection and reports IR/equity/commodity
//     sections as empty with a classificationGap note.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration)
//   + Kai (Derivatives & structured products engineer, engineering —
//   derivative notional + product classification).

import type { ForwardObligation } from "../forward-obligations/types";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * BA 120 classification map — maps obligation category to BA 120 form line.
 *
 * At v0 the map is caller-supplied. When the chart-of-accounts schema gains
 * BA-120 line-number fields (planned for Slice 10+), the map will be derived
 * from the chart-of-accounts rather than supplied externally.
 *
 * The `formLine` field carries the SARB BA 120 published line reference.
 * `[citation: TBC — exact line numbering pending Mira's WS-INSTRUMENT-ANALYSES
 * SARB BA 120 schema ingestion]`.
 */
export interface Ba120ClassificationEntry {
  /** The obligation category (e.g. "fx-spot", "fx-forward", "irrevocable-credit-facility"). */
  readonly category: string;
  /** Which BA 120 section this category maps to. */
  readonly section: Ba120Section;
  /**
   * Free-form SARB BA 120 form-line label.
   * `[citation: TBC — exact line numbering pending Mira's WS-INSTRUMENT-ANALYSES]`
   */
  readonly formLine: string;
  /** Optional sub-line label for granular rendering within the section. */
  readonly subLine?: string;
}

/** Top-level sections of the BA 120 return. */
export type Ba120Section =
  | "derivatives"
  | "guarantees"
  | "commitments"
  | "documentary-credits"
  | "other";

/**
 * Classification map — keyed by obligation category string.
 * Caller supplies this; the generator indexes it internally.
 */
export type Ba120ClassificationMap = readonly Ba120ClassificationEntry[];

/**
 * Remaining-maturity band for derivative notional bucketing per BA 120
 * derivative sections. Bands mirror the standard SARB time-horizon buckets.
 */
export type Ba120MaturityBand = "lt1y" | "1y-to-5y" | "gt5y";

/**
 * Derivative product type. v0 supports FX and interest-rate (stub);
 * equity and commodity are noted as classificationGaps.
 */
export type Ba120DerivativeProductType = "fx" | "ir" | "equity" | "commodity";

/**
 * One entry in the derivatives section — a notional amount in a given
 * product type, maturity band, and currency.
 */
export interface Ba120DerivativeEntry {
  /** Product type per SARB BA 120 derivatives taxonomy. */
  readonly productType: Ba120DerivativeProductType;
  /** Remaining-maturity band. */
  readonly maturityBand: Ba120MaturityBand;
  /** Gross notional in `currency` minor units. */
  readonly notionalMinor: number;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** Source obligation ID from the forward-obligations projection. */
  readonly sourceObligationId: string;
  /** Optional trade ID for provenance. */
  readonly tradeId?: string;
}

/**
 * One guarantees entry — financial or performance guarantee.
 * v0: caller-supplied. Guarantees sub-ledger not yet built.
 */
export interface Ba120GuaranteesEntry {
  /** "financial" = credit-substitute guarantee; "performance" = non-credit. */
  readonly guaranteeType: "financial" | "performance";
  /** Remaining maturity in days (for maturity-band derivation). */
  readonly remainingMaturityDays: number;
  /** Gross nominal in `currency` minor units. */
  readonly nominalMinor: number;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** Counterparty ID. */
  readonly counterpartyId: string;
  /** Optional reference to the guarantee instrument. */
  readonly instrumentRef?: string;
}

/**
 * One credit-commitment entry — irrevocable or revocable undrawn facility.
 * v0: caller-supplied. Commitments sub-ledger not yet built.
 *
 * Credit-conversion factor per Regulations Relating to Banks Reg 23:
 *   - irrevocable, original term < 1Y  → CCF 0%   (no capital charge)
 *   - irrevocable, original term ≥ 1Y  → CCF 50%
 *   - revocable                         → CCF 0%   (no capital charge)
 */
export interface Ba120CommitmentsEntry {
  /** Whether the facility can be cancelled unconditionally ("revocable") or not. */
  readonly commitmentType: "irrevocable" | "revocable";
  /**
   * Original term of the facility in months. Used to apply the correct CCF
   * per Reg 23 (< 12 months → 0% CCF; ≥ 12 months → 50% CCF).
   */
  readonly originalTermMonths: number;
  /** Undrawn committed amount in `currency` minor units. */
  readonly undrawnAmountMinor: number;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** Counterparty or borrower ID. */
  readonly counterpartyId: string;
  /** Optional reference to the credit agreement. */
  readonly facilityRef?: string;
}

/**
 * The full BA 120 generator input.
 *
 * Three caller-supplied inputs feed the sections that have no live sub-ledger
 * yet: classificationMap, guarantees, commitments. The derivatives section
 * is derived from the forward-obligations projection (FxTradeExecuted events).
 */
export interface Ba120GeneratorInput {
  /** Legal entity short-id. The generator throws on non-bank entities. */
  readonly entity: string;
  /** ISO 8601 period-end as-of date. */
  readonly asOf: string;
  /** Period identifier (e.g. `period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /**
   * Forward obligations from the forward-obligations projection.
   * FX derivative notionals flow through here via FxTradeExecuted events.
   * The generator filters to `source === "trade-settlement"` obligations
   * and maps them to derivative entries using the classificationMap.
   */
  readonly forwardObligations: readonly ForwardObligation[];
  /**
   * Caller-supplied classification map — maps obligation category to
   * BA 120 section and form line. Obligations whose category is not in the
   * map are collected in `classificationGaps`.
   */
  readonly classificationMap: Ba120ClassificationMap;
  /**
   * Caller-supplied guarantees entries (v0).
   * Production form: from guarantees sub-ledger once built.
   */
  readonly guarantees: readonly Ba120GuaranteesEntry[];
  /**
   * Caller-supplied credit commitments entries (v0).
   * Production form: from commitments sub-ledger once built.
   */
  readonly commitments: readonly Ba120CommitmentsEntry[];
  /**
   * Optional: cite the source event_id (e.g. a `ForwardObligationsSnapshotted`
   * event) so downstream `ReportGenerated` event can chain provenance.
   */
  readonly forwardObligationsSnapshotEventId?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * Aggregated derivative notional row per product-type + maturity band.
 * Multiple entries in the same (productType, maturityBand, currency)
 * bucket are summed to one row.
 */
export interface Ba120DerivativeRow {
  readonly productType: Ba120DerivativeProductType;
  readonly maturityBand: Ba120MaturityBand;
  readonly notionalMinor: number;
  readonly currency: string;
  /** Count of source obligations contributing to this row. */
  readonly sourceCount: number;
}

/** Derivatives section of the BA 120 return. */
export interface Ba120DerivativesSection {
  /** FX derivative notional rows by maturity band. */
  readonly fxRows: readonly Ba120DerivativeRow[];
  /** Interest-rate derivative notional rows. v0: always empty (no IR events yet). */
  readonly irRows: readonly Ba120DerivativeRow[];
  /** Equity derivative notional rows. v0: always empty. */
  readonly equityRows: readonly Ba120DerivativeRow[];
  /** Commodity derivative notional rows. v0: always empty. */
  readonly commodityRows: readonly Ba120DerivativeRow[];
  /** Grand total notional (all product types + bands, in functionalCurrency). */
  readonly totalNotionalMinor: number;
  /** Note explaining v0 coverage gaps. */
  readonly coverageNote: string;
}

/** Aggregated guarantees row per type + maturity band. */
export interface Ba120GuaranteeRow {
  readonly guaranteeType: "financial" | "performance";
  /** Maturity band derived from remainingMaturityDays. */
  readonly maturityBand: Ba120MaturityBand;
  readonly nominalMinor: number;
  readonly currency: string;
  readonly count: number;
}

/** Guarantees section of the BA 120 return. */
export interface Ba120GuaranteesSection {
  readonly financialGuaranteeRows: readonly Ba120GuaranteeRow[];
  readonly performanceGuaranteeRows: readonly Ba120GuaranteeRow[];
  readonly totalFinancialNominalMinor: number;
  readonly totalPerformanceNominalMinor: number;
}

/** Aggregated commitments row per type + CCF bucket. */
export interface Ba120CommitmentsRow {
  readonly commitmentType: "irrevocable" | "revocable";
  /**
   * Whether the CCF is 50% (irrevocable, original term ≥ 1 year) or 0%
   * (irrevocable < 1 year or revocable).
   */
  readonly ccfApplied: 0 | 50;
  readonly undrawnAmountMinor: number;
  readonly currency: string;
  readonly count: number;
}

/** Commitments section of the BA 120 return. */
export interface Ba120CommitmentsSection {
  readonly rows: readonly Ba120CommitmentsRow[];
  readonly totalIrrevocableMinor: number;
  readonly totalRevocableMinor: number;
  readonly totalUndrawnMinor: number;
}

/** Documentary credits section (L/Cs + acceptances). v0: empty + note. */
export interface Ba120DocumentarySection {
  readonly importLcMinor: number;
  readonly exportLcMinor: number;
  readonly acceptancesMinor: number;
  readonly totalMinor: number;
  readonly coverageNote: string;
}

/** Other off-balance-sheet items (residual). */
export interface Ba120OtherSection {
  readonly items: readonly Ba120OtherItem[];
  readonly totalMinor: number;
}

export interface Ba120OtherItem {
  readonly label: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly sourceRef?: string;
}

/** Grand-total row across all BA 120 sections. */
export interface Ba120Total {
  /** Total derivative notionals (gross). */
  readonly derivativesNotionalMinor: number;
  /** Total guarantee nominals. */
  readonly guaranteesNominalMinor: number;
  /** Total undrawn commitment amounts. */
  readonly commitmentsUndrawnMinor: number;
  /** Total documentary credit amounts (v0: zero). */
  readonly documentaryCreditsMinor: number;
  /** Total other items. */
  readonly otherMinor: number;
  /** Grand total across all categories. */
  readonly grandTotalMinor: number;
  /** ISO 4217 currency (functional currency). */
  readonly currency: string;
}

/**
 * The full BA 120 generator output.
 *
 * `classificationGaps` collects obligation categories encountered in the
 * forward-obligations projection that were not mapped by the caller-supplied
 * `classificationMap`. These feed the recon pipeline to identify outstanding
 * form-line mapping work.
 *
 * `placeholders` carries `[citation: TBC]` markers so the recon pipeline can
 * track placeholder density per Marc's Q1 default.
 */
export interface Ba120OffBalanceSheet {
  readonly meta: {
    readonly form: "BA 120";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly forwardObligationsSnapshotEventId?: string;
    readonly classificationMapFingerprint: string;
  };
  readonly derivatives: Ba120DerivativesSection;
  readonly guarantees: Ba120GuaranteesSection;
  readonly commitments: Ba120CommitmentsSection;
  readonly documentaryCredits: Ba120DocumentarySection;
  readonly other: Ba120OtherSection;
  readonly total: Ba120Total;
  readonly classificationGaps: readonly string[];
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
  readonly asOf: string;
  readonly entity: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba120GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba120GeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

/**
 * Bank-licence-bound entity short-ids in scope for BA 120.
 * Only Hoz Bank (LE-ZA-HOZ-BANK) at v0 per
 * `Regulations/_legal-entity-tree.md`. Group-consolidated BA 120 deferred
 * under `D-REGULATORY-PERIMETER` (CEO-approved 2026-05-10).
 */
export const BA_120_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_120_BANK_ENTITIES.includes(entity)) {
    throw new Ba120GeneratorError(
      `BA 120 (Off-Balance-Sheet Activities) is bank-licence-bound; entity '${entity}' is not in BA_120_BANK_ENTITIES (${BA_120_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER. Group-consolidated BA 120 deferred under D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Maturity band helpers
// ---------------------------------------------------------------------------

/**
 * Derive a BA 120 maturity band from remaining days.
 *   < 365 days    → lt1y
 *   365–1825 days → 1y-to-5y
 *   > 1825 days   → gt5y
 */
export function maturityBandFromDays(remainingDays: number): Ba120MaturityBand {
  if (remainingDays < 365) return "lt1y";
  if (remainingDays <= 1825) return "1y-to-5y";
  return "gt5y";
}

/**
 * Derive remaining days between asOf date and a target date string
 * (ISO YYYY-MM-DD). Returns 0 if the target is on or before asOf.
 */
export function remainingDaysTo(asOf: string, targetDate: string): number {
  const a = new Date(`${asOf.slice(0, 10)}T00:00:00Z`);
  const t = new Date(`${targetDate.slice(0, 10)}T00:00:00Z`);
  const ms = t.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Classification map helpers
// ---------------------------------------------------------------------------

function indexClassificationMap(
  map: Ba120ClassificationMap,
): Map<string, Ba120ClassificationEntry> {
  const idx = new Map<string, Ba120ClassificationEntry>();
  for (const entry of map) {
    if (idx.has(entry.category)) {
      throw new Ba120GeneratorError(
        `BA 120 generator: duplicate classificationMap entry for category '${entry.category}'`,
      );
    }
    idx.set(entry.category, entry);
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Derivative notional extraction from forward obligations
// ---------------------------------------------------------------------------

/**
 * Extract FX derivative notional entries from the forward-obligations
 * projection. The generator filters to `source === "trade-settlement"` items
 * and maps them to `Ba120DerivativeEntry` records.
 *
 * Product-type categorisation:
 *   - obligations with relatedRef containing "fx" or title containing "FX"
 *     → product type "fx"
 *   - obligations with relatedRef containing "swap" or "irs" → "ir" (future)
 *   - all others are collected in `classificationGaps`.
 *
 * This logic will be replaced by the `classificationMap` when the
 * derivatives sub-ledger carries explicit product-type tags per the
 * FxTradeExecuted payload structure.
 */
function extractDerivativeEntries(
  obligations: readonly ForwardObligation[],
  classificationIdx: Map<string, Ba120ClassificationEntry>,
  asOf: string,
  classificationGaps: string[],
): Ba120DerivativeEntry[] {
  const entries: Ba120DerivativeEntry[] = [];

  for (const ob of obligations) {
    if (ob.source !== "trade-settlement") continue;
    if (!ob.cashflow) continue;

    const notionalMinor = Math.round(ob.cashflow.amount * 100);
    if (notionalMinor <= 0) continue;

    const remainingDays = remainingDaysTo(asOf, ob.dueDate);
    const maturityBand = maturityBandFromDays(remainingDays);

    // Determine product type. Check classificationMap first; fall back to
    // heuristic title/ref matching; otherwise gap.
    let productType: Ba120DerivativeProductType | undefined;

    // Check classification map by relatedRef (trade ID).
    const relatedEntry = ob.relatedRef ? classificationIdx.get(ob.relatedRef) : undefined;
    if (relatedEntry && relatedEntry.section === "derivatives") {
      const lineStr = relatedEntry.formLine.toLowerCase();
      if (lineStr.includes("fx") || lineStr.includes("foreign")) productType = "fx";
      else if (lineStr.includes("ir") || lineStr.includes("interest")) productType = "ir";
      else if (lineStr.includes("equity")) productType = "equity";
      else if (lineStr.includes("commodity")) productType = "commodity";
    }

    // Fall back to title heuristic.
    if (productType === undefined) {
      const titleLower = ob.title.toLowerCase();
      const refLower = (ob.relatedRef ?? "").toLowerCase();
      if (titleLower.includes("fx") || titleLower.includes("foreign exchange")) {
        productType = "fx";
      } else if (titleLower.includes("swap") || titleLower.includes("irs") || refLower.includes("irs")) {
        productType = "ir";
      } else if (titleLower.includes("equity")) {
        productType = "equity";
      } else if (titleLower.includes("commodity")) {
        productType = "commodity";
      } else {
        classificationGaps.push(
          `trade-settlement obligation '${ob.id}' (title: '${ob.title}') could not be classified to a BA 120 derivatives product type; not in classificationMap and title heuristic found no match. [citation: TBC — derivatives taxonomy pending WS-INSTRUMENT-ANALYSES]`,
        );
        continue;
      }
    }

    entries.push({
      productType,
      maturityBand,
      notionalMinor,
      currency: ob.cashflow.currency,
      sourceObligationId: ob.id,
      ...(ob.relatedRef ? { tradeId: ob.relatedRef } : {}),
    });
  }

  return entries;
}

/**
 * Aggregate derivative entries into rows, summing notionals per
 * (productType, maturityBand, currency) bucket.
 */
function aggregateDerivativeRows(
  entries: readonly Ba120DerivativeEntry[],
  productType: Ba120DerivativeProductType,
): Ba120DerivativeRow[] {
  const bucketMap = new Map<string, { notionalMinor: number; count: number }>();

  for (const e of entries) {
    if (e.productType !== productType) continue;
    const key = `${e.maturityBand}:${e.currency}`;
    const existing = bucketMap.get(key);
    if (existing) {
      existing.notionalMinor += e.notionalMinor;
      existing.count += 1;
    } else {
      bucketMap.set(key, { notionalMinor: e.notionalMinor, count: 1 });
    }
  }

  const rows: Ba120DerivativeRow[] = [];
  for (const [key, bucket] of bucketMap) {
    const [band, currency] = key.split(":") as [Ba120MaturityBand, string];
    rows.push({
      productType,
      maturityBand: band,
      notionalMinor: bucket.notionalMinor,
      currency,
      sourceCount: bucket.count,
    });
  }

  // Stable sort: maturityBand order (lt1y < 1y-to-5y < gt5y), then currency.
  const bandOrder: Record<Ba120MaturityBand, number> = { "lt1y": 0, "1y-to-5y": 1, "gt5y": 2 };
  rows.sort((a, b) => {
    const bandDiff = bandOrder[a.maturityBand] - bandOrder[b.maturityBand];
    if (bandDiff !== 0) return bandDiff;
    return a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0;
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Guarantees section
// ---------------------------------------------------------------------------

function buildGuaranteesSection(
  guarantees: readonly Ba120GuaranteesEntry[],
  asOf: string,
): Ba120GuaranteesSection {
  const financialRows: Map<string, Ba120GuaranteeRow> = new Map();
  const performanceRows: Map<string, Ba120GuaranteeRow> = new Map();

  for (const g of guarantees) {
    const band = maturityBandFromDays(g.remainingMaturityDays);
    const key = `${band}:${g.currency}`;
    const targetMap = g.guaranteeType === "financial" ? financialRows : performanceRows;
    const existing = targetMap.get(key);
    if (existing) {
      targetMap.set(key, {
        ...existing,
        nominalMinor: existing.nominalMinor + g.nominalMinor,
        count: existing.count + 1,
      });
    } else {
      targetMap.set(key, {
        guaranteeType: g.guaranteeType,
        maturityBand: band,
        nominalMinor: g.nominalMinor,
        currency: g.currency,
        count: 1,
      });
    }
  }

  // Suppress unused parameter warning; asOf is available for future date-based derivation.
  void asOf;

  const bandOrder: Record<Ba120MaturityBand, number> = { "lt1y": 0, "1y-to-5y": 1, "gt5y": 2 };
  const sortRows = (rows: Map<string, Ba120GuaranteeRow>): Ba120GuaranteeRow[] =>
    [...rows.values()].sort((a, b) => {
      const bandDiff = bandOrder[a.maturityBand] - bandOrder[b.maturityBand];
      if (bandDiff !== 0) return bandDiff;
      return a.currency < b.currency ? -1 : 1;
    });

  const fRows = sortRows(financialRows);
  const pRows = sortRows(performanceRows);

  const totalFinancial = fRows.reduce((s, r) => s + r.nominalMinor, 0);
  const totalPerformance = pRows.reduce((s, r) => s + r.nominalMinor, 0);

  return {
    financialGuaranteeRows: fRows,
    performanceGuaranteeRows: pRows,
    totalFinancialNominalMinor: totalFinancial,
    totalPerformanceNominalMinor: totalPerformance,
  };
}

// ---------------------------------------------------------------------------
// Commitments section
// ---------------------------------------------------------------------------

/**
 * CCF per Regulations Relating to Banks Reg 23:
 *   - irrevocable, original term < 12 months → 0%
 *   - irrevocable, original term ≥ 12 months → 50%
 *   - revocable (unconditionally cancellable) → 0%
 */
function deriveCcf(entry: Ba120CommitmentsEntry): 0 | 50 {
  if (entry.commitmentType === "revocable") return 0;
  if (entry.originalTermMonths < 12) return 0;
  return 50;
}

function buildCommitmentsSection(
  commitments: readonly Ba120CommitmentsEntry[],
): Ba120CommitmentsSection {
  const bucketMap = new Map<
    string,
    { commitmentType: "irrevocable" | "revocable"; ccf: 0 | 50; amount: number; currency: string; count: number }
  >();

  for (const c of commitments) {
    const ccf = deriveCcf(c);
    const key = `${c.commitmentType}:${ccf}:${c.currency}`;
    const existing = bucketMap.get(key);
    if (existing) {
      existing.amount += c.undrawnAmountMinor;
      existing.count += 1;
    } else {
      bucketMap.set(key, {
        commitmentType: c.commitmentType,
        ccf,
        amount: c.undrawnAmountMinor,
        currency: c.currency,
        count: 1,
      });
    }
  }

  const rows: Ba120CommitmentsRow[] = [...bucketMap.values()].map((b) => ({
    commitmentType: b.commitmentType,
    ccfApplied: b.ccf,
    undrawnAmountMinor: b.amount,
    currency: b.currency,
    count: b.count,
  }));

  rows.sort((a, b) => {
    if (a.commitmentType !== b.commitmentType)
      return a.commitmentType < b.commitmentType ? -1 : 1;
    if (a.ccfApplied !== b.ccfApplied) return a.ccfApplied - b.ccfApplied;
    return a.currency < b.currency ? -1 : 1;
  });

  const totalIrrevocable = rows
    .filter((r) => r.commitmentType === "irrevocable")
    .reduce((s, r) => s + r.undrawnAmountMinor, 0);
  const totalRevocable = rows
    .filter((r) => r.commitmentType === "revocable")
    .reduce((s, r) => s + r.undrawnAmountMinor, 0);

  return {
    rows,
    totalIrrevocableMinor: totalIrrevocable,
    totalRevocableMinor: totalRevocable,
    totalUndrawnMinor: totalIrrevocable + totalRevocable,
  };
}

// ---------------------------------------------------------------------------
// Fingerprint helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic fingerprint of the classification map for forensic
 * reproducibility. Sorted-stable JSON (mirrors ba-700-capital.ts pattern).
 */
export function fingerprintClassificationMap(map: Ba120ClassificationMap): string {
  const sorted = [...map].sort((a, b) =>
    a.category < b.category ? -1 : a.category > b.category ? 1 : 0,
  );
  return JSON.stringify(sorted);
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 120 (Off-Balance-Sheet Activities) projection from:
 *   - a forward-obligations projection (FX derivative notionals from
 *     FxTradeExecuted events, filtered to trade-settlement items)
 *   - a caller-supplied BA 120 classification map
 *   - caller-supplied guarantees entries (v0; sub-ledger not yet built)
 *   - caller-supplied commitments entries (v0; sub-ledger not yet built)
 *
 * Pure function; deterministic. No event side-effects; no document-store
 * writes; no event-store reads. Callers compose the inputs and consume the
 * output.
 *
 * `classificationGaps` in the output collects:
 *   - trade-settlement obligations not mappable to a derivative product type
 *   - the custody section (always absent at v0)
 *   - the documentary-credits section (always empty at v0)
 *   - IR / equity / commodity derivative gaps (no events yet)
 *
 * Multi-currency note: totals in `Ba120Total` are in `functionalCurrency`
 * minor units. Cross-currency items are reported in their source currency
 * in the section rows; the grand-total adds across currencies (a
 * simplification for v0 — production form should FX-translate to functional
 * currency; gap noted in classificationGaps).
 */
export function generateBa120OffBalanceSheet(input: Ba120GeneratorInput): Ba120OffBalanceSheet {
  assertBankEntity(input.entity);

  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba120GeneratorError(
      `BA 120 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }

  const classificationIdx = indexClassificationMap(input.classificationMap);
  const classificationGaps: string[] = [];

  // Standing v0 classification gaps — always surfaced.
  classificationGaps.push(
    "[citation: TBC — custody/safekeeping section omitted at v0; custody register not yet built (WS-CUSTODY-REGISTER planned)]",
  );
  classificationGaps.push(
    "[citation: TBC — documentary credits (L/Cs, acceptances) section empty at v0; no L/C events in event store yet]",
  );
  classificationGaps.push(
    "[citation: TBC — IR derivative notionals not yet in event store; IR rows empty at v0 pending IRD event substrate]",
  );
  classificationGaps.push(
    "[citation: TBC — equity/commodity derivative notionals not in event store; rows empty at v0]",
  );

  // Multi-currency FX-translation gap note.
  classificationGaps.push(
    "[citation: TBC — BA 120 grand-total sums across currencies without FX translation at v0; production form should translate all amounts to functionalCurrency per Reg 23; gap deferred to commitments sub-ledger slice]",
  );

  // -------------------------------------------------------------------------
  // Derivatives section
  // -------------------------------------------------------------------------
  const derivativeEntries = extractDerivativeEntries(
    input.forwardObligations,
    classificationIdx,
    input.asOf,
    classificationGaps,
  );

  const fxRows = aggregateDerivativeRows(derivativeEntries, "fx");
  const irRows = aggregateDerivativeRows(derivativeEntries, "ir");
  const equityRows = aggregateDerivativeRows(derivativeEntries, "equity");
  const commodityRows = aggregateDerivativeRows(derivativeEntries, "commodity");

  const totalDerivativeNotional = [...fxRows, ...irRows, ...equityRows, ...commodityRows].reduce(
    (s, r) => s + r.notionalMinor,
    0,
  );

  const derivativesSection: Ba120DerivativesSection = {
    fxRows,
    irRows,
    equityRows,
    commodityRows,
    totalNotionalMinor: totalDerivativeNotional,
    coverageNote:
      "v0: FX notionals from FxTradeExecuted events (forward-obligations projection). IR/equity/commodity rows empty pending event-store substrate. Custody section omitted pending WS-CUSTODY-REGISTER. [citation: TBC — SARB BA 120 derivative line taxonomy pending Mira WS-INSTRUMENT-ANALYSES]",
  };

  // -------------------------------------------------------------------------
  // Guarantees section
  // -------------------------------------------------------------------------
  const guaranteesSection = buildGuaranteesSection(input.guarantees, input.asOf);

  // -------------------------------------------------------------------------
  // Commitments section
  // -------------------------------------------------------------------------
  const commitmentsSection = buildCommitmentsSection(input.commitments);

  // -------------------------------------------------------------------------
  // Documentary credits (v0: empty)
  // -------------------------------------------------------------------------
  const documentarySection: Ba120DocumentarySection = {
    importLcMinor: 0,
    exportLcMinor: 0,
    acceptancesMinor: 0,
    totalMinor: 0,
    coverageNote:
      "v0: documentary credits section empty — no letter-of-credit events in event store. Section deferred pending L/C event substrate. [citation: TBC — BA 120 documentary-credits lines pending Mira WS-INSTRUMENT-ANALYSES]",
  };

  // -------------------------------------------------------------------------
  // Other section (v0: empty)
  // -------------------------------------------------------------------------
  const otherSection: Ba120OtherSection = {
    items: [],
    totalMinor: 0,
  };

  // -------------------------------------------------------------------------
  // Grand total
  // -------------------------------------------------------------------------
  const grandTotal: Ba120Total = {
    derivativesNotionalMinor: totalDerivativeNotional,
    guaranteesNominalMinor:
      guaranteesSection.totalFinancialNominalMinor + guaranteesSection.totalPerformanceNominalMinor,
    commitmentsUndrawnMinor: commitmentsSection.totalUndrawnMinor,
    documentaryCreditsMinor: documentarySection.totalMinor,
    otherMinor: otherSection.totalMinor,
    grandTotalMinor:
      totalDerivativeNotional +
      guaranteesSection.totalFinancialNominalMinor +
      guaranteesSection.totalPerformanceNominalMinor +
      commitmentsSection.totalUndrawnMinor +
      documentarySection.totalMinor +
      otherSection.totalMinor,
    currency: input.functionalCurrency,
  };

  // -------------------------------------------------------------------------
  // Placeholders
  // -------------------------------------------------------------------------
  const placeholders: string[] = [
    "[citation: TBC — exact SARB BA 120 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
    "[citation: TBC — commitments sub-ledger not yet built; v0 uses caller-supplied Ba120CommitmentsEntry[]; forward-compatible when sub-ledger lands]",
    "[citation: TBC — guarantees sub-ledger not yet built; v0 uses caller-supplied Ba120GuaranteesEntry[]]",
    "[citation: TBC — SARB BA 120 form version pending Mira's published-schema mapping (Reg 23 return)]",
  ];

  return {
    meta: {
      form: "BA 120",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: input.functionalCurrency,
      generatorVersion: "v0.1",
      ...(input.forwardObligationsSnapshotEventId
        ? { forwardObligationsSnapshotEventId: input.forwardObligationsSnapshotEventId }
        : {}),
      classificationMapFingerprint: fingerprintClassificationMap(input.classificationMap),
    },
    derivatives: derivativesSection,
    guarantees: guaranteesSection,
    commitments: commitmentsSection,
    documentaryCredits: documentarySection,
    other: otherSection,
    total: grandTotal,
    classificationGaps,
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-9",
      "Banks Act 94 of 1990 §13",
      "Regulations Relating to Banks Reg 23",
      "BCBS Basel III — off-balance-sheet credit conversion factors",
    ],
    placeholders,
    asOf: input.asOf,
    entity: input.entity,
  };
}
