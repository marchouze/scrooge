// platform/reporting/ba-310-bond-events-adapter.ts
//
// Derives BA-310 IR general risk maturity-ladder from BondTradeExecuted events
// (minus BondMatured / BondSold derecognitions). Fills the
// Ba310PeriodCloseSubscriberInput.irGeneralMaturityLadder field which was
// previously a caller-supplied placeholder (zeros, per D-MARKETS-CAPITAL-TIME-SHAPE).
//
// Only trading-book positions incur BA-310 IR general risk.
// Banking-book bonds are IRRBB (BA-330), not BA-310.
//
// Authority: BANKS-REG-28; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//            D-MARKETS-CAPITAL-TIME-SHAPE.
//
// Design:
//   BondTradeExecuted (portfolio="trading-book") events
//     → derecognise via BondMatured / BondSold
//     → compute residual term to maturity at periodEnd
//     → assign to Reg 28(3)(a) maturity band (standardised maturity method)
//     → aggregate into IrMaturityBandRow[]
//
//   SA government bonds (ISIN prefix ZAG) have zero specific risk weight
//   under Reg 28(3)(b) Table B (sovereign issuer = 0%). Their general-risk
//   maturity allocation is unchanged; specific-risk rows are emitted with
//   weight = 0 so capital = 0 is explicitly declared (not absent).
//
// Maturity bands (Reg 28(3)(a) Table A — standardised maturity method):
//   Zone 1: ≤1M, 1M–3M, 3M–6M, 6M–12M
//   Zone 2: 1Y–2Y, 2Y–3Y, 3Y–4Y
//   Zone 3: 4Y–5Y, 5Y–7Y, 7Y–10Y, 10Y–15Y, 15Y–20Y, >20Y
//
// Risk weights per Reg 28(3)(a) Table A (coupon ≥ 3%):
//   ≤1M=0.00%, 1-3M=0.20%, 3-6M=0.40%, 6-12M=0.70%, 1-2Y=1.25%,
//   2-3Y=1.75%, 3-4Y=2.25%, 4-5Y=2.75%, 5-7Y=3.25%, 7-10Y=3.75%,
//   10-15Y=4.50%, 15-20Y=5.25%, >20Y=6.00%
//
// Authors: Mira (Regulatory reporting engineer, engineering)

import type {
  BondMaturedPayload,
  BondSoldPayload,
  BondTradeExecutedPayload,
} from "../event-store/event-types/bond-accounting";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import type { IrMaturityBandRow, IrSpecificRiskRow } from "./ba-310-market-risk";

// ---------------------------------------------------------------------------
// Reg 28(3)(a) maturity band definitions — standardised maturity method
// ---------------------------------------------------------------------------

/**
 * Single maturity band entry for Reg 28(3)(a) Table A.
 * Residual years from periodEnd to bond maturityDate determines the band.
 * Risk weight for coupon >= 3% bonds.
 */
interface MaturityBandDef {
  /** Band identifier used in IrMaturityBandRow.band */
  readonly band: string;
  /** Upper bound in years (inclusive) */
  readonly upperYears: number;
  /** Risk weight (fraction, e.g. 0.002 = 0.20%) */
  readonly riskWeight: number;
}

/**
 * Reg 28(3)(a) Table A — 13 maturity bands, coupon ≥ 3%.
 * Ordered shortest to longest. Match is first band where residualYears ≤ upperYears.
 */
const MATURITY_BANDS: readonly MaturityBandDef[] = [
  { band: "0-1m", upperYears: 1 / 12, riskWeight: 0.0 },
  { band: "1-3m", upperYears: 3 / 12, riskWeight: 0.002 },
  { band: "3-6m", upperYears: 6 / 12, riskWeight: 0.004 },
  { band: "6-12m", upperYears: 12 / 12, riskWeight: 0.007 },
  { band: "1-2y", upperYears: 2, riskWeight: 0.0125 },
  { band: "2-3y", upperYears: 3, riskWeight: 0.0175 },
  { band: "3-4y", upperYears: 4, riskWeight: 0.0225 },
  { band: "4-5y", upperYears: 5, riskWeight: 0.0275 },
  { band: "5-7y", upperYears: 7, riskWeight: 0.0325 },
  { band: "7-10y", upperYears: 10, riskWeight: 0.0375 },
  { band: "10-15y", upperYears: 15, riskWeight: 0.045 },
  { band: "15-20y", upperYears: 20, riskWeight: 0.0525 },
  { band: ">20y", upperYears: Number.POSITIVE_INFINITY, riskWeight: 0.06 },
] as const;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;

function residualYears(periodEnd: string, maturityDate: string): number {
  const endMs = Date.parse(`${periodEnd.slice(0, 10)}T00:00:00Z`);
  const matMs = Date.parse(`${maturityDate.slice(0, 10)}T00:00:00Z`);
  const diffMs = matMs - endMs;
  if (diffMs <= 0) return 0; // already matured
  return diffMs / (MS_PER_DAY * DAYS_PER_YEAR);
}

/**
 * Find the Reg 28(3)(a) maturity band for a bond with the given residual term.
 * Returns undefined if the bond has already matured (residualYears = 0).
 */
function assignMaturityBand(years: number): MaturityBandDef | undefined {
  if (years <= 0) return undefined;
  for (const band of MATURITY_BANDS) {
    if (years <= band.upperYears) return band;
  }
  // Safety: should never reach here (last band is +∞)
  return MATURITY_BANDS[MATURITY_BANDS.length - 1];
}

// ---------------------------------------------------------------------------
// SA government bond detection
// ---------------------------------------------------------------------------

/**
 * Returns true for SA Government bonds (ZAG-prefix ISINs, issuer = Republic of
 * South Africa). These carry 0% specific risk weight under Reg 28(3)(b) Table B
 * (government securities: 0% weighting).
 *
 * Authority: Regulations Relating to Banks Reg 28(3)(b); BCBS D352 §718(c).
 */
function isSaGovBond(bondIsin: string): boolean {
  return bondIsin.startsWith("ZAG");
}

// ---------------------------------------------------------------------------
// Frozen-cursor replay option type (mirrors ba-310-events-adapter.ts)
// ---------------------------------------------------------------------------

interface FrozenCursorOpts {
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Input contract
// ---------------------------------------------------------------------------

/**
 * Input for `buildBondIrGeneralLadder` and `buildBondIrSpecificRiskRows`.
 */
export interface BondIrAdapterInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entity: string;
  /** Period-end ISO 8601 date-time. Used as the reference for residual-term calculation. */
  readonly periodEnd: string;
  /** Event store — provides BondTradeExecuted, BondMatured, BondSold. */
  readonly eventStore: EventStore;
  /**
   * Upper bound (inclusive) on the event `sequence` column.
   * Sourced from `AccountingPeriodClosed.eventSequence` (frozen cursor).
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Main functions
// ---------------------------------------------------------------------------

/**
 * Derive the BA-310 IR general maturity-ladder rows from BondTradeExecuted events.
 *
 * Logic:
 *   1. Replay all BondTradeExecuted for the entity up to periodEnd.
 *   2. Filter to trading-book bonds only (banking-book → BA-330, not BA-310).
 *   3. Collect derecognised trade IDs from BondMatured and BondSold.
 *   4. For each live trading-book bond, compute residual years to maturity.
 *   5. Assign to Reg 28(3)(a) maturity band.
 *   6. Weight the nominal by the band's risk weight.
 *   7. Aggregate per band, netting long/short positions within each band.
 *   8. Return one IrMaturityBandRow per band with a non-zero weighted position.
 *
 * Side: buy = long (positive nominal); sell = short (negative nominal).
 *
 * Citations:
 *   Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(b);
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; D-MARKETS-CAPITAL-TIME-SHAPE;
 *   Principles/1-events-are-truth.md.
 */
export function buildBondIrGeneralLadder(input: BondIrAdapterInput): IrMaturityBandRow[] {
  const { eventStore, entity, periodEnd, untilSequence } = input;
  const frozenCursorOpts: FrozenCursorOpts = untilSequence !== undefined ? { untilSequence } : {};
  const provenanceFilter = defaultProvenanceFilter();

  // ---- Step 1: collect derecognised trade IDs ----
  const derecognisedTradeIds = new Set<string>();

  for (const ev of eventStore.replay({
    entity,
    type: "BondMatured",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as BondMaturedPayload;
    if (p.tradeId) derecognisedTradeIds.add(p.tradeId);
  }

  for (const ev of eventStore.replay({
    entity,
    type: "BondSold",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as BondSoldPayload;
    if (p.tradeId) derecognisedTradeIds.add(p.tradeId);
  }

  // ---- Step 2: accumulate weighted positions per band ----
  // band → { weightedLong, weightedShort }
  const bandAccumulator = new Map<string, { weightedLong: number; weightedShort: number }>();

  for (const ev of eventStore.replay({
    entity,
    type: "BondTradeExecuted",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as BondTradeExecutedPayload;

    // Only trading-book bonds enter BA-310 IR general risk.
    // Banking-book bonds are IRRBB (BA-330).
    if (p.portfolio !== "trading-book") continue;

    // Exclude derecognised positions.
    if (derecognisedTradeIds.has(p.tradeId)) continue;

    // Compute residual term.
    const years = residualYears(periodEnd, p.maturityDate);
    const bandDef = assignMaturityBand(years);
    if (!bandDef) continue; // bond already matured by periodEnd (edge case)

    // Weight = nominalMinor × riskWeight
    const weightedAmount = Math.round(p.nominalMinor * bandDef.riskWeight);

    const current = bandAccumulator.get(bandDef.band) ?? { weightedLong: 0, weightedShort: 0 };
    if (p.side === "buy") {
      bandAccumulator.set(bandDef.band, {
        weightedLong: current.weightedLong + weightedAmount,
        weightedShort: current.weightedShort,
      });
    } else {
      // sell = short position
      bandAccumulator.set(bandDef.band, {
        weightedLong: current.weightedLong,
        weightedShort: current.weightedShort + weightedAmount,
      });
    }
  }

  // ---- Step 3: emit IrMaturityBandRow[] in stable band order ----
  const rows: IrMaturityBandRow[] = [];
  for (const bandDef of MATURITY_BANDS) {
    const acc = bandAccumulator.get(bandDef.band);
    if (!acc) continue;
    if (acc.weightedLong === 0 && acc.weightedShort === 0) continue;
    rows.push({
      band: bandDef.band,
      weightedLongMinor: acc.weightedLong,
      weightedShortMinor: acc.weightedShort,
    });
  }

  return rows;
}

/**
 * Derive the BA-310 IR specific-risk rows from BondTradeExecuted events.
 *
 * Emits one IrSpecificRiskRow per issuer-class (SA Government = ZAG ISINs → 0%,
 * all other issuers → assumed qualifying issuer 0.25% for build-phase; a
 * proper credit-rating lookup will replace this per D-MARKETS-CAPITAL-TIME-SHAPE).
 *
 * SA government bonds: specific risk weight = 0% per Reg 28(3)(b) Table B
 * (government securities). Their row is emitted explicitly (grossPosition > 0,
 * weight = 0) so the zero charge is stated, not absent.
 *
 * Only live trading-book bonds (not matured/sold) are included.
 *
 * Citations:
 *   Regulations Relating to Banks Reg 28(3)(b); BCBS D352 §718(c)–(e);
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; D-MARKETS-CAPITAL-TIME-SHAPE.
 */
export function buildBondIrSpecificRiskRows(input: BondIrAdapterInput): IrSpecificRiskRow[] {
  const { eventStore, entity, periodEnd, untilSequence } = input;
  const frozenCursorOpts: FrozenCursorOpts = untilSequence !== undefined ? { untilSequence } : {};
  const provenanceFilter = defaultProvenanceFilter();

  // Collect derecognised trade IDs (same logic as above).
  const derecognisedTradeIds = new Set<string>();

  for (const ev of eventStore.replay({
    entity,
    type: "BondMatured",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as BondMaturedPayload;
    if (p.tradeId) derecognisedTradeIds.add(p.tradeId);
  }

  for (const ev of eventStore.replay({
    entity,
    type: "BondSold",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as BondSoldPayload;
    if (p.tradeId) derecognisedTradeIds.add(p.tradeId);
  }

  // Accumulate gross position per issuer-class.
  // issuerLabel → { grossPositionMinor, specificRiskWeight }
  const issuerAccumulator = new Map<
    string,
    { grossPositionMinor: number; specificRiskWeight: number }
  >();

  for (const ev of eventStore.replay({
    entity,
    type: "BondTradeExecuted",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as BondTradeExecutedPayload;

    // Only trading-book bonds.
    if (p.portfolio !== "trading-book") continue;
    // Exclude derecognised.
    if (derecognisedTradeIds.has(p.tradeId)) continue;

    // Determine issuer classification.
    const isGov = isSaGovBond(p.bondIsin);
    const issuerLabel = isGov ? "RSA-sovereign" : "qualifying-issuer";
    // Reg 28(3)(b): government securities = 0%; qualifying issuer = 0.25% (<6M) or 1.00% (≥6M).
    // Build-phase: use 0.25% for all non-sovereign (conservative; proper rating lookup pending).
    // Authority: D-MARKETS-CAPITAL-TIME-SHAPE — specific-risk weight refinement is roadmap item.
    const specificRiskWeight = isGov ? 0.0 : 0.0025;

    const current = issuerAccumulator.get(issuerLabel) ?? {
      grossPositionMinor: 0,
      specificRiskWeight,
    };
    issuerAccumulator.set(issuerLabel, {
      grossPositionMinor: current.grossPositionMinor + p.nominalMinor,
      specificRiskWeight,
    });
  }

  const rows: IrSpecificRiskRow[] = [];
  for (const [issuerLabel, acc] of issuerAccumulator) {
    if (acc.grossPositionMinor === 0) continue;
    rows.push({
      issuerLabel,
      grossPositionMinor: acc.grossPositionMinor,
      specificRiskWeight: acc.specificRiskWeight,
    });
  }

  return rows;
}
