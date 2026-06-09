// platform/reporting/ba-400-op-risk.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 (this dispatch) — BA 400
// (Operational Risk return) projection.
//
// Form-number authority: the SARB Excel form set — BA 400 = "Operational
// Risk" (workbook tab A1). The prior "BA 300" label was a fabricated
// numbering artefact: BA 300 is actually "Liquidity Risk" (the LCR return).
// Re-numbered forward-only under D-BA-RETURN-NUMBERING-EXCEL-CANONICAL
// (CEO 2026-06-09), which supersedes D-BA-RETURN-FORM-NUMBERING-RECON
// wholesale; see Regulations/SARB-PA/ba-returns/_canonical-register.md.
// Internal `Ba300*` symbol names retained pending a separate symbol-rename pass.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-
// approved 2026-05-10), pack §6 Slice 4 (BA 300 sub-scope) consolidated
// with §6 Slice 5 (XML render layer).
//
// Pure projection over caller-supplied annual gross-income inputs.
//
// Computation per BCBS D196 §645–§654 / Reg 33:
//
//   BIA  capital = α × (sum_{y in years where gi_y > 0} gi_y) / nPositive
//                  with α = 15%
//
//   TSA  capital = (1/3) × sum_y max(0, sum_i β_i × gi_{y,i})
//                  with β_i in {12%, 15%, 18%} per business line
//
//   Op-risk RWA = 12.5 × selectedApproachCapital
//
// Build-phase: rehearsal-grade. Live numbers populate post-licence-day +
// 3 fiscal years of audited gross income. Until then synthetic fixtures
// exercise the engine.
//
// Per-entity. Bank-licence-bound; only Hoz Bank LE-ZA-HOZ-BANK is in scope.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Helena (Chief Risk Officer, governance — reports to CEO; op-risk
//   methodology owner — citation)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration).

// ---------------------------------------------------------------------------
// Business lines + β factors
// ---------------------------------------------------------------------------

/**
 * Basel business lines per BCBS D196 §654 / Reg 33(4) Annex.
 */
export type BaselBusinessLine =
  | "corporate-finance"
  | "trading-and-sales"
  | "retail-banking"
  | "commercial-banking"
  | "payment-and-settlement"
  | "agency-services"
  | "asset-management"
  | "retail-brokerage";

/**
 * Per-business-line β factor. Values per BCBS D196 / Reg 33(4) Annex.
 */
export const BUSINESS_LINE_BETA: Readonly<Record<BaselBusinessLine, number>> = {
  "corporate-finance": 0.18,
  "trading-and-sales": 0.18,
  "payment-and-settlement": 0.18,
  "commercial-banking": 0.15,
  "agency-services": 0.15,
  "retail-banking": 0.12,
  "retail-brokerage": 0.12,
  "asset-management": 0.12,
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * One row in the per-business-line per-year gross-income table.
 */
export interface OpRiskGrossIncomeRow {
  /** Calendar year identifier (e.g. "2024", "2025"). Free-form string for v0. */
  readonly fiscalYear: string;
  readonly businessLine: BaselBusinessLine;
  readonly grossIncomeMinor: number;
}

/**
 * The complete generator input.
 */
export interface Ba300GeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank. */
  readonly entity: string;
  /** ISO 8601 — period-end as-of date. */
  readonly asOf: string;
  /** Period identifier. */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /** Up-to-3-year gross-income table per business line per year. */
  readonly grossIncome: readonly OpRiskGrossIncomeRow[];
  /** Which approach the bank reports under. Build-phase: BIA. */
  readonly approach: "bia" | "tsa";
  /** Optional provenance — TrialBalanceSnapshotted.event_id chain. */
  readonly trialBalanceSnapshotEventId?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface Ba300LineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly note?: string;
}

export interface Ba300BiaSection {
  readonly perYearGrossIncome: readonly Ba300LineItem[];
  /** Sum of *positive-only* gross income over the supplied years. */
  readonly sumPositiveYearsMinor: number;
  /** Count of positive-income years (denominator). */
  readonly nPositiveYears: number;
  /** Average positive-year gross income. */
  readonly averagePositiveMinor: number;
  /** α × average. */
  readonly capitalMinor: number;
}

export interface Ba300TsaSection {
  readonly perYearWeighted: readonly Ba300LineItem[];
  /** 1/3 × sum_y max(0, sum_i β_i × gi). */
  readonly capitalMinor: number;
}

export interface Ba300Output {
  readonly meta: {
    readonly form: "BA 400";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly approach: "bia" | "tsa";
    readonly trialBalanceSnapshotEventId?: string;
  };
  readonly bia?: Ba300BiaSection;
  readonly tsa?: Ba300TsaSection;
  /** The selected-approach capital. */
  readonly opRiskCapitalMinor: number;
  /** RWA = 12.5 × capital. */
  readonly opRiskRwaMinor: number;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba300GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba300GeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

export const BA_300_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_300_BANK_ENTITIES.includes(entity)) {
    throw new Ba300GeneratorError(
      `BA 300 (operational risk) is bank-licence-bound; entity '${entity}' is not in BA_300_BANK_ENTITIES (${BA_300_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// BIA arithmetic
// ---------------------------------------------------------------------------

const BIA_ALPHA = 0.15;

function buildBia(rows: readonly OpRiskGrossIncomeRow[], ccy: string): Ba300BiaSection {
  // Aggregate gross income per year (BIA does not decompose by business line).
  const yearTotals = new Map<string, number>();
  for (const r of rows) {
    yearTotals.set(r.fiscalYear, (yearTotals.get(r.fiscalYear) ?? 0) + r.grossIncomeMinor);
  }
  const sortedYears = [...yearTotals.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const perYear: Ba300LineItem[] = sortedYears.map(([year, gi]) => ({
    lineId: `bia.year.${year}`,
    lineLabel: `BIA — gross income ${year}`,
    amountMinor: gi,
    currency: ccy,
    note: gi <= 0 ? "excluded from average (non-positive)" : "included in average",
  }));
  const positives = sortedYears.filter(([, gi]) => gi > 0).map(([, gi]) => gi);
  const sumPositive = positives.reduce((s, v) => s + v, 0);
  const nPositive = positives.length;
  const averagePositive = nPositive > 0 ? Math.round(sumPositive / nPositive) : 0;
  const capital = Math.round(BIA_ALPHA * averagePositive);
  return {
    perYearGrossIncome: perYear,
    sumPositiveYearsMinor: sumPositive,
    nPositiveYears: nPositive,
    averagePositiveMinor: averagePositive,
    capitalMinor: capital,
  };
}

// ---------------------------------------------------------------------------
// TSA arithmetic
// ---------------------------------------------------------------------------

function buildTsa(rows: readonly OpRiskGrossIncomeRow[], ccy: string): Ba300TsaSection {
  // Group by year, then by business line, then weight + sum + max(0,_).
  const perYear = new Map<string, Map<BaselBusinessLine, number>>();
  for (const r of rows) {
    const yMap = perYear.get(r.fiscalYear) ?? new Map<BaselBusinessLine, number>();
    yMap.set(r.businessLine, (yMap.get(r.businessLine) ?? 0) + r.grossIncomeMinor);
    perYear.set(r.fiscalYear, yMap);
  }
  const sortedYears = [...perYear.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const perYearLines: Ba300LineItem[] = [];
  let sumYears = 0;
  let nYears = 0;
  for (const [year, yMap] of sortedYears) {
    let yearWeighted = 0;
    for (const [bl, gi] of yMap.entries()) {
      yearWeighted += BUSINESS_LINE_BETA[bl] * gi;
    }
    const flooredYear = Math.max(0, Math.round(yearWeighted));
    perYearLines.push({
      lineId: `tsa.year.${year}`,
      lineLabel: `TSA — sum_i(β_i × gi_i) for ${year}`,
      amountMinor: flooredYear,
      currency: ccy,
      note: yearWeighted < 0 ? `floored from ${Math.round(yearWeighted)}` : "no floor",
    });
    sumYears += flooredYear;
    nYears += 1;
  }
  const capital = nYears > 0 ? Math.round(sumYears / 3) : 0;
  return { perYearWeighted: perYearLines, capitalMinor: capital };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateBa300OpRisk(input: Ba300GeneratorInput): Ba300Output {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba300GeneratorError(
      `BA 300 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  const ccy = input.functionalCurrency;

  const bia = buildBia(input.grossIncome, ccy);
  const tsa = buildTsa(input.grossIncome, ccy);

  const selectedCapital = input.approach === "tsa" ? tsa.capitalMinor : bia.capitalMinor;
  const rwa = Math.round(12.5 * selectedCapital);

  const placeholders: string[] = [
    "[citation: TBC — exact SARB BA 300 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
    "[citation: TBC — SMA (BCBS D424) replaces BIA / TSA at SARB transition; Reg 33 revision tracked as substrate gap]",
  ];
  if (bia.nPositiveYears < 3) {
    placeholders.push(
      `[citation: TBC — BIA average computed over ${bia.nPositiveYears} positive years (need 3 for steady-state); build-phase rehearsal acceptable]`,
    );
  }

  return {
    meta: {
      form: "BA 400",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: ccy,
      generatorVersion: "v0.1",
      approach: input.approach,
      ...(input.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
        : {}),
    },
    bia,
    tsa,
    opRiskCapitalMinor: selectedCapital,
    opRiskRwaMinor: rwa,
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-5",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 33",
      "BCBS D196",
    ],
    placeholders,
  };
}
