// platform/reporting/ba-350-market-risk.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 (this dispatch) — BA 350
// (market-risk return) projection.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-
// approved 2026-05-10), pack §6 Slice 4 (the BA 350 sub-scope) consolidated
// with §6 Slice 5 (XML render layer).
//
// This module is a *pure projection* over a market-risk-input bundle (raw
// trading-book exposures decomposed by sub-charge). No event side-effects;
// no document-store writes; no event-store reads. Callers (the CLI wrapper
// at `prototype/scripts/render-ba-350.ts`, downstream `ReportGenerated`
// event emitters) compose the inputs and consume the output.
//
// Computation per BCBS D352 §718 + Regulations Relating to Banks Reg 28
// (standardised approach):
//
//   IR general risk        = sum(maturityBand.weightedNet) + disallowances
//   IR specific risk       = sum(grossPosition × specificRiskWeight) per issuer
//   Equity position risk   = 8% × |netPosition| + 8% × grossPosition
//   FX risk                = 8% × max(sum(longs), sum(shorts))     [shorthand]
//   Commodity risk         = simplified-method sum (15% net + 3% gross)
//
//   marketRiskCapital = sum(above)
//   marketRiskRwa     = 12.5 × marketRiskCapital
//
// Build-phase posture: all inputs are caller-supplied numbers (in money-
// minor units). The recon-callable `MarketRiskInputBundle` is an explicit
// record so synthetic fixtures + future projection-derived inputs share
// the same shape. Live numbers populate at commencement-of-trading.
//
// Per-entity. Bank-licence-bound; only Hoz Bank LE-ZA-HOZ-BANK is in scope
// (per `D-REGULATORY-PERIMETER`). The generator throws on non-bank
// entities.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Helena (Chief Risk Officer, governance — reports to CEO; market-
//   risk methodology owner — citation)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration).

// P1 fix note (C-2): the events-first entry point for BA 350 lives at
// `ba-350-events-adapter.ts` → `generateBa350MarketRiskFromEvents()`. Callers
// that have access to an EventStore should prefer that path to derive FX
// positions directly from FxTradeExecuted events rather than from the trial
// balance. Authority: Principles/1-events-are-truth.md, D-MARKETS-CAPITAL-TIME-SHAPE.

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * One maturity-band row for the IR general-risk maturity-method ladder.
 * Per Reg 28(3)(a) Annex — 13 time bands; weighted-net by band.
 */
export interface IrMaturityBandRow {
  /** Band identifier (e.g. "0-1m", "1-3m", "3-6m"). Free-form for v0; Mira will pin to SARB. */
  readonly band: string;
  /** Sum of weighted long positions in the band (post weight). */
  readonly weightedLongMinor: number;
  /** Sum of weighted short positions in the band (post weight). */
  readonly weightedShortMinor: number;
}

/**
 * IR specific-risk row — one per issuer / rating-grade slice.
 */
export interface IrSpecificRiskRow {
  readonly issuerLabel: string;
  /** Gross position (long + short, absolute value). */
  readonly grossPositionMinor: number;
  /** Specific-risk weight (0..1) — e.g. 0.0 (sovereign AAA), 0.0025 (qualifying), 0.08 (high-yield). */
  readonly specificRiskWeight: number;
}

/**
 * Equity position-risk row per market.
 */
export interface EquityRow {
  /** Market identifier (e.g. "JSE", "LSE"). */
  readonly market: string;
  readonly netLongMinusShortMinor: number;
  readonly grossLongPlusShortMinor: number;
  /** True if market qualifies for the 4% specific-risk reduction (liquid + diversified). */
  readonly liquidAndDiversified: boolean;
}

/**
 * FX position row — one per non-functional currency.
 */
export interface FxPositionRow {
  /** ISO 4217 currency. */
  readonly currency: string;
  /** Net position in the currency, *converted to functional currency minor units*. Sign: long positive, short negative. */
  readonly netPositionFunctionalMinor: number;
}

/**
 * Commodity position row — one per commodity.
 */
export interface CommodityPositionRow {
  readonly commodity: string;
  readonly netPositionMinor: number;
  readonly grossPositionMinor: number;
}

/**
 * The complete generator input.
 */
export interface Ba350GeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank. */
  readonly entity: string;
  /** ISO 8601 — period-end as-of date. */
  readonly asOf: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /** Maturity-ladder rows for IR general-risk. */
  readonly irGeneralMaturityLadder: readonly IrMaturityBandRow[];
  /** Issuer rows for IR specific-risk. */
  readonly irSpecificRisk: readonly IrSpecificRiskRow[];
  /** Equity rows per market. */
  readonly equity: readonly EquityRow[];
  /** FX positions per non-functional currency. */
  readonly fxPositions: readonly FxPositionRow[];
  /** Commodity positions. Empty array OK (build-phase default). */
  readonly commodity: readonly CommodityPositionRow[];
  /**
   * Vertical/horizontal disallowances per Reg 28(3)(a) — pre-computed by
   * the call site (the disallowance algebra requires within-band /
   * cross-zone offsets which depend on a finer maturity decomposition than
   * v0 carries; supply directly).
   */
  readonly irGeneralDisallowancesMinor?: number;
  /**
   * Optional citation — chains BA 350 back to a TrialBalanceSnapshotted event.
   *
   * @deprecated — P1 violation (C-2): FX positions should be derived from
   * FxTradeExecuted primary trade events, not from the trial balance.
   * Use `generateBa350MarketRiskFromEvents()` from `ba-350-events-adapter.ts`
   * when an EventStore is available. This field is retained for backward
   * compatibility. Authority: Principles/1-events-are-truth.md,
   * D-MARKETS-CAPITAL-TIME-SHAPE.
   */
  readonly trialBalanceSnapshotEventId?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface Ba350LineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly note?: string;
}

export interface Ba350IrGeneralSection {
  readonly maturityLadder: readonly Ba350LineItem[];
  readonly disallowancesMinor: number;
  readonly capitalMinor: number;
}

export interface Ba350IrSpecificSection {
  readonly issuerLines: readonly Ba350LineItem[];
  readonly capitalMinor: number;
}

export interface Ba350EquitySection {
  readonly marketLines: readonly Ba350LineItem[];
  readonly capitalMinor: number;
}

export interface Ba350FxSection {
  readonly currencyLines: readonly Ba350LineItem[];
  readonly sumNetLongsMinor: number;
  readonly sumNetShortsMinor: number;
  readonly capitalMinor: number;
}

export interface Ba350CommoditySection {
  readonly commodityLines: readonly Ba350LineItem[];
  readonly capitalMinor: number;
}

export interface Ba350Output {
  readonly meta: {
    readonly form: "BA 350";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly trialBalanceSnapshotEventId?: string;
  };
  readonly interestRateGeneral: Ba350IrGeneralSection;
  readonly interestRateSpecific: Ba350IrSpecificSection;
  readonly equity: Ba350EquitySection;
  readonly fx: Ba350FxSection;
  readonly commodity: Ba350CommoditySection;
  /** Sum of all sub-charges. */
  readonly totalMarketRiskCapitalMinor: number;
  /** RWA = 12.5 × capital. */
  readonly totalMarketRiskRwaMinor: number;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba350GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba350GeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

export const BA_350_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_350_BANK_ENTITIES.includes(entity)) {
    throw new Ba350GeneratorError(
      `BA 350 (market risk) is bank-licence-bound; entity '${entity}' is not in BA_350_BANK_ENTITIES (${BA_350_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 350 (market-risk) projection. Pure function;
 * deterministic.
 */
export function generateBa350MarketRisk(input: Ba350GeneratorInput): Ba350Output {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba350GeneratorError(
      `BA 350 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  const ccy = input.functionalCurrency;

  // ---- IR general risk ---------------------------------------------------
  const ladderLines: Ba350LineItem[] = [];
  let irGeneralWeightedSum = 0;
  // Stable iteration — input order preserved.
  for (const row of input.irGeneralMaturityLadder) {
    if (row.weightedLongMinor < 0 || row.weightedShortMinor < 0) {
      throw new Ba350GeneratorError(
        `BA 350: maturity-band '${row.band}' weighted long/short must be non-negative (signed offsets are produced upstream)`,
      );
    }
    const weightedNet = Math.abs(row.weightedLongMinor - row.weightedShortMinor);
    ladderLines.push({
      lineId: `ir-general.band.${row.band}`,
      lineLabel: `IR general — band ${row.band}`,
      amountMinor: weightedNet,
      currency: ccy,
      note: `long=${row.weightedLongMinor} short=${row.weightedShortMinor}`,
    });
    irGeneralWeightedSum += weightedNet;
  }
  const disallowances = Math.max(0, input.irGeneralDisallowancesMinor ?? 0);
  const irGeneralCapital = irGeneralWeightedSum + disallowances;

  // ---- IR specific risk --------------------------------------------------
  const irSpecificLines: Ba350LineItem[] = [];
  let irSpecificCapital = 0;
  for (const row of input.irSpecificRisk) {
    if (row.specificRiskWeight < 0 || row.specificRiskWeight > 1) {
      throw new Ba350GeneratorError(
        `BA 350: specificRiskWeight on issuer '${row.issuerLabel}' must be in [0,1], got ${row.specificRiskWeight}`,
      );
    }
    const charge = Math.round(Math.abs(row.grossPositionMinor) * row.specificRiskWeight);
    irSpecificLines.push({
      lineId: `ir-specific.${row.issuerLabel}`,
      lineLabel: `IR specific — ${row.issuerLabel}`,
      amountMinor: charge,
      currency: ccy,
      note: `gross=${row.grossPositionMinor} weight=${row.specificRiskWeight}`,
    });
    irSpecificCapital += charge;
  }

  // ---- Equity risk -------------------------------------------------------
  const equityLines: Ba350LineItem[] = [];
  let equityCapital = 0;
  for (const row of input.equity) {
    const generalCharge = Math.round(0.08 * Math.abs(row.netLongMinusShortMinor));
    const specificFactor = row.liquidAndDiversified ? 0.04 : 0.08;
    const specificCharge = Math.round(specificFactor * row.grossLongPlusShortMinor);
    const charge = generalCharge + specificCharge;
    equityLines.push({
      lineId: `equity.${row.market}`,
      lineLabel: `Equity — market ${row.market}`,
      amountMinor: charge,
      currency: ccy,
      note: `general=${generalCharge} specific=${specificCharge} (factor=${specificFactor})`,
    });
    equityCapital += charge;
  }

  // ---- FX risk -----------------------------------------------------------
  const fxLines: Ba350LineItem[] = [];
  let sumNetLongs = 0;
  let sumNetShorts = 0;
  for (const row of input.fxPositions) {
    if (row.currency === ccy) {
      // Functional-currency leg excluded from the FX charge per Reg 28(5).
      continue;
    }
    const net = row.netPositionFunctionalMinor;
    if (net > 0) sumNetLongs += net;
    else sumNetShorts += -net;
    fxLines.push({
      lineId: `fx.${row.currency}`,
      lineLabel: `FX — ${row.currency} net position`,
      amountMinor: net,
      currency: ccy,
      note: `direction=${net >= 0 ? "long" : "short"}`,
    });
  }
  const fxCapital = Math.round(0.08 * Math.max(sumNetLongs, sumNetShorts));

  // ---- Commodity risk (simplified method) -------------------------------
  const commodityLines: Ba350LineItem[] = [];
  let commodityCapital = 0;
  for (const row of input.commodity) {
    const charge =
      Math.round(0.15 * Math.abs(row.netPositionMinor)) + Math.round(0.03 * row.grossPositionMinor);
    commodityLines.push({
      lineId: `commodity.${row.commodity}`,
      lineLabel: `Commodity — ${row.commodity}`,
      amountMinor: charge,
      currency: ccy,
      note: `net=${row.netPositionMinor} gross=${row.grossPositionMinor} (simplified)`,
    });
    commodityCapital += charge;
  }

  const totalCapital =
    irGeneralCapital + irSpecificCapital + equityCapital + fxCapital + commodityCapital;
  const totalRwa = Math.round(12.5 * totalCapital);

  const placeholders: string[] = [
    "[citation: TBC — exact SARB BA 350 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
  ];
  if (input.irGeneralDisallowancesMinor === undefined) {
    placeholders.push(
      "[citation: TBC — IR-general vertical/horizontal disallowances supplied as zero (caller did not provide); finer maturity-decomposition required for closed-form algebra]",
    );
  }

  return {
    meta: {
      form: "BA 350",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: ccy,
      generatorVersion: "v0.1",
      ...(input.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
        : {}),
    },
    interestRateGeneral: {
      maturityLadder: ladderLines,
      disallowancesMinor: disallowances,
      capitalMinor: irGeneralCapital,
    },
    interestRateSpecific: {
      issuerLines: irSpecificLines,
      capitalMinor: irSpecificCapital,
    },
    equity: { marketLines: equityLines, capitalMinor: equityCapital },
    fx: {
      currencyLines: fxLines,
      sumNetLongsMinor: sumNetLongs,
      sumNetShortsMinor: sumNetShorts,
      capitalMinor: fxCapital,
    },
    commodity: { commodityLines, capitalMinor: commodityCapital },
    totalMarketRiskCapitalMinor: totalCapital,
    totalMarketRiskRwaMinor: totalRwa,
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-5",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 28",
      "BCBS D352",
    ],
    placeholders,
  };
}
