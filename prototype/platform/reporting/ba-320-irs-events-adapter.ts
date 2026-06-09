// platform/reporting/ba-320-irs-events-adapter.ts
//
// Derives BA 320 interest-rate general-risk maturity-ladder contributions from
// vanilla OTC IRS positions using the BCBS / Reg 28(3)(a) MATURITY-METHOD
// notional decomposition, events-first (WS-BA-RETURNS-FOLLOWON G1).
//
// ─── THE DEFECT THIS FIXES (G1) ─────────────────────────────────────────────
// Previously this adapter fed `Math.abs(dv01Raw)` (raw DV01, rand-per-bp) into
// the SAME per-band accumulators that the bond adapter fills with
// `nominalMinor × bandRiskWeight` (weighted nominal). The two units are
// INCOMMENSURABLE — `combineIrGeneralLadders` summed them, producing a
// meaningless mixed-unit ladder in which the IRS contribution was ~3 orders of
// magnitude too small (a R100m 5y swap has a DV01 of ~R45k, vs a weighted
// nominal of ~R3.25m at the 5-7y 3.25% band). Confirmed at code level and by
// Helena (Chief Risk Officer, governance) review.
//
// ─── THE FIX: MATURITY-METHOD NOTIONAL DECOMPOSITION ────────────────────────
// Under the Reg 28(3)(a) / BCBS D352 §718(b) maturity method, an interest-rate
// swap is decomposed into two notional legs of opposite sign:
//   - a FIXED-RATE-BOND leg, slotted at the swap's RESIDUAL MATURITY band;
//   - a FLOATING-RATE-NOTE (FRN) leg, slotted at the TIME-TO-NEXT-RESET band.
// Each leg contributes `notionalMinor × bandRiskWeight` — the SAME unit the
// bond adapter produces — so the combined ladder is dimensionally coherent.
//
// Leg signs by the bank's role:
//   pay-fixed     → pays fixed, receives float  → SHORT fixed-bond, LONG FRN
//   receive-fixed → receives fixed, pays float  → LONG  fixed-bond, SHORT FRN
// (A receiver-of-fixed is long duration on the fixed leg, exactly as a
// long fixed-rate-bond holder is.)
//
// Only the FIXED leg carries meaningful general-market-risk weight at longer
// tenors; the FRN leg sits in a short repricing band (small weight) — but both
// are emitted so vertical/horizontal offsetting against bond positions in the
// same band is correct.
//
// ─── SUBSTRATE GAPS (NOT FABRICATED) ────────────────────────────────────────
// The accounting `IrdSwapTradeExecuted` event carries notional, role,
// startDate, and maturityDate directly. The next-reset date — required for the
// FRN leg's band — is taken from `nextResetDate` (or derived from
// `resetFrequencyMonths` rolled forward from `startDate`). When NEITHER is
// present, the FRN leg cannot be slotted without fabricating a reset frequency,
// so the swap's tradeId is surfaced in `swapsMissingTerms` (NOT dropped, NOT
// fabricated). Non-vanilla roles (`pay-float` / `receive-float`, i.e. basis
// swaps with no fixed leg) likewise cannot be maturity-method-decomposed and
// are surfaced as gaps — G2 (multi-curve / basis) is a separate brief.
//
// `dv01ByTenorBucket` REMAINS on `IrdSwapPositionRevalued` as a valid internal
// interest-rate-sensitivity view (used by IRRBB / risk dashboards). It NO
// LONGER feeds the BA 320 maturity ladder — that feed is now the maturity-
// method notional decomposition above.
//
// Authority:
//   - Regulations Relating to Banks Reg 28(3)(a) (IR general-risk maturity ladder)
//   - Reg 28(5)(b) (standardised maturity bands)
//   - BCBS D352 §718(b) (general market risk — maturity method; swap decomposition)
//   - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO-approved 2026-06-09)
//   - D-IRS-DV01-BUCKETING-CALIBRATION (G1 weighting-basis unification)
//   - D-BA-RETURNS-P1-SOURCING-WORKSTREAM
//   - Principles/1-events-are-truth.md
//
// Author: Mira (Regulatory reporting engineer, engineering)

import type {
  IrdSwapTerminatedPayload,
  IrdSwapTradeExecutedPayload,
} from "../event-store/event-types/ird-accounting";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import {
  assignMaturityBand,
  BA320_BAND_ORDER,
  MATURITY_METHOD_WEIGHTED_NOMINAL,
  residualYears,
} from "./ba-320-ir-maturity-bands";
import type { IrMaturityBandRow } from "./ba-320-market-risk";

// ---------------------------------------------------------------------------
// Frozen-cursor replay option type (mirrors ba-320-bond-events-adapter.ts)
// ---------------------------------------------------------------------------

interface FrozenCursorOpts {
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Input / output contract
// ---------------------------------------------------------------------------

/**
 * Input for `buildIrsIrGeneralLadder`.
 */
export interface IrsIrAdapterInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entity: string;
  /** Period-end ISO 8601 date-time. Bounds the event replay (asOf). */
  readonly periodEnd: string;
  /** Event store — provides IrdSwapTradeExecuted / -Terminated. */
  readonly eventStore: EventStore;
  /**
   * Upper bound (inclusive) on the event `sequence` column.
   * Sourced from `AccountingPeriodClosed.eventSequence` (frozen cursor).
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  readonly untilSequence?: number;
}

/**
 * Result of `buildIrsIrGeneralLadder`.
 */
export interface IrsIrGeneralLadderResult {
  /**
   * IR general-risk maturity-ladder rows from the IRS maturity-method notional
   * decomposition (`notionalMinor × bandRiskWeight`), commensurate with the
   * bond adapter's rows.
   */
  readonly rows: readonly IrMaturityBandRow[];
  /**
   * Trade IDs of live trading-book swaps that CANNOT be maturity-method-
   * decomposed: either a non-vanilla role (no fixed leg → basis swap, G2) or
   * missing the next-reset terms required for the FRN leg. Surfaced as
   * substrate gaps — NOT dropped, NOT fabricated.
   */
  readonly swapsMissingTerms: readonly string[];
}

// ---------------------------------------------------------------------------
// Next-reset derivation
// ---------------------------------------------------------------------------

const MONTHS_PER_RESET_ROLL_CAP = 2_400; // 200y — defensive roll-forward cap

/**
 * Derive the next floating-leg reset date strictly after `periodEnd`.
 *
 * Precedence:
 *   1. `nextResetDate` if present and after periodEnd (carried directly).
 *   2. `resetFrequencyMonths` rolled forward from `startDate` past periodEnd.
 *   3. undefined → caller surfaces the swap as a substrate gap.
 *
 * The reset date is capped at the swap's `maturityDate`: a floating leg never
 * reprices beyond final maturity, so a next-reset computed past maturity is
 * clamped to maturity (the residual floating exposure is to maturity).
 */
function deriveNextResetDate(
  p: IrdSwapTradeExecutedPayload,
  periodEnd: string,
): string | undefined {
  const periodEndDay = periodEnd.slice(0, 10);
  const maturityDay = p.maturityDate.slice(0, 10);

  // 1. Directly carried next-reset date.
  if (p.nextResetDate !== undefined) {
    const resetDay = p.nextResetDate.slice(0, 10);
    if (resetDay > periodEndDay) {
      return resetDay < maturityDay ? resetDay : maturityDay;
    }
    // A stale next-reset on/before periodEnd is not usable; fall through to the
    // frequency derivation if available rather than fabricating.
  }

  // 2. Roll the reset frequency forward from startDate past periodEnd.
  if (p.resetFrequencyMonths !== undefined && p.resetFrequencyMonths > 0) {
    const start = new Date(`${p.startDate.slice(0, 10)}T00:00:00Z`);
    const periodEndMs = Date.parse(`${periodEndDay}T00:00:00Z`);
    const maturityMs = Date.parse(`${maturityDay}T00:00:00Z`);
    for (let k = 1; k <= MONTHS_PER_RESET_ROLL_CAP; k++) {
      const candidate = new Date(start.getTime());
      candidate.setUTCMonth(start.getUTCMonth() + k * p.resetFrequencyMonths);
      const candMs = candidate.getTime();
      if (candMs > periodEndMs) {
        const clamped = candMs < maturityMs ? candMs : maturityMs;
        return new Date(clamped).toISOString().slice(0, 10);
      }
      if (candMs >= maturityMs) {
        return maturityDay; // never reprices past maturity
      }
    }
  }

  // 3. No usable terms.
  return undefined;
}

// ---------------------------------------------------------------------------
// Per-band accumulator + leg slotting
// ---------------------------------------------------------------------------

type BandAccumulator = Map<string, { weightedLong: number; weightedShort: number }>;

/**
 * Slot one notional leg (`notionalMinor`) into its band at
 * `notionalMinor × bandRiskWeight`, on the given side. The 0-1m band carries a
 * 0% risk weight, so short-reset FRN legs there contribute zero weighted
 * amount (still correct — they net out trivially).
 */
function slotLeg(
  acc: BandAccumulator,
  years: number,
  notionalMinor: number,
  side: "long" | "short",
): void {
  const bandDef = assignMaturityBand(years);
  if (!bandDef) return; // already matured / reset (residual ≤ 0)
  const weightedAmount = Math.round(notionalMinor * bandDef.riskWeight);
  const current = acc.get(bandDef.band) ?? { weightedLong: 0, weightedShort: 0 };
  if (side === "long") {
    acc.set(bandDef.band, {
      weightedLong: current.weightedLong + weightedAmount,
      weightedShort: current.weightedShort,
    });
  } else {
    acc.set(bandDef.band, {
      weightedLong: current.weightedLong,
      weightedShort: current.weightedShort + weightedAmount,
    });
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Derive the BA 320 IR general-risk maturity-ladder contributions from vanilla
 * IRS positions via the Reg 28(3)(a) maturity-method notional decomposition,
 * events-first.
 *
 * Logic:
 *   1. Replay IrdSwapTerminated up to periodEnd → derecognised trade IDs.
 *   2. Replay IrdSwapTradeExecuted up to periodEnd → live swaps.
 *      - bookDesignation === "banking" → excluded (IRRBB / BA 330).
 *      - bookDesignation === "trading" OR absent → included (Phase 1 default).
 *   3. For each live trading-book swap:
 *      - role must be pay-fixed or receive-fixed (vanilla). pay-float /
 *        receive-float (basis) → substrate gap (G2).
 *      - derive next-reset date (nextResetDate or resetFrequencyMonths). None →
 *        substrate gap.
 *      - FIXED leg → residual-maturity band; FRN leg → time-to-next-reset band.
 *      - pay-fixed: short fixed-bond, long FRN. receive-fixed: long fixed-bond,
 *        short FRN.
 *      - slot each leg as `notionalMinor × bandRiskWeight`.
 *   4. Emit one IrMaturityBandRow per non-empty band in stable band order,
 *      stamped with the maturity-method-weighted-nominal basis.
 *
 * Citations: Regulations Relating to Banks Reg 28(3)(a), Reg 28(5)(b);
 *   BCBS D352 §718(b); D-IRS-DV01-BUCKETING-CALIBRATION;
 *   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; D-BA-RETURNS-P1-SOURCING-WORKSTREAM;
 *   Principles/1-events-are-truth.md.
 */
export function buildIrsIrGeneralLadder(input: IrsIrAdapterInput): IrsIrGeneralLadderResult {
  const { eventStore, entity, periodEnd, untilSequence } = input;
  const frozenCursorOpts: FrozenCursorOpts = untilSequence !== undefined ? { untilSequence } : {};
  const provenanceFilter = defaultProvenanceFilter();

  // ---- Step 1: collect derecognised (terminated) trade IDs ----
  const terminatedTradeIds = new Set<string>();
  for (const ev of eventStore.replay({
    entity,
    type: "IrdSwapTerminated",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as IrdSwapTerminatedPayload;
    if (p.tradeId) terminatedTradeIds.add(p.tradeId);
  }

  // ---- Step 2 + 3: fold live trading-book swaps into the maturity ladder ----
  const bandAccumulator: BandAccumulator = new Map();
  const swapsMissingTerms: string[] = [];
  // Latest executed terms per tradeId (a tradeId should execute once; on the
  // off chance of a correcting re-emit, the later-seen wins).
  const seenTradeIds = new Set<string>();

  for (const ev of eventStore.replay({
    entity,
    type: "IrdSwapTradeExecuted",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as IrdSwapTradeExecutedPayload;
    if (!p.tradeId) continue;
    if (terminatedTradeIds.has(p.tradeId)) continue;
    if (p.bookDesignation === "banking") continue; // IRRBB → BA 330
    if (seenTradeIds.has(p.tradeId)) continue;
    seenTradeIds.add(p.tradeId);

    // Vanilla fixed-vs-float only. Basis swaps (pay-float / receive-float) have
    // no fixed leg to slot at residual maturity → G2, surfaced as a gap.
    if (p.role !== "pay-fixed" && p.role !== "receive-fixed") {
      swapsMissingTerms.push(p.tradeId);
      continue;
    }

    const nextResetDate = deriveNextResetDate(p, periodEnd);
    if (nextResetDate === undefined) {
      // FRN leg cannot be slotted without fabricating a reset → substrate gap.
      swapsMissingTerms.push(p.tradeId);
      continue;
    }

    const maturityYears = residualYears(periodEnd, p.maturityDate);
    if (maturityYears <= 0) continue; // already matured by periodEnd
    const resetYears = residualYears(periodEnd, nextResetDate);

    // Leg signs by role:
    //   pay-fixed     → SHORT fixed-bond, LONG FRN
    //   receive-fixed → LONG  fixed-bond, SHORT FRN
    const fixedSide: "long" | "short" = p.role === "receive-fixed" ? "long" : "short";
    const frnSide: "long" | "short" = fixedSide === "long" ? "short" : "long";

    slotLeg(bandAccumulator, maturityYears, p.notionalMinor, fixedSide);
    slotLeg(bandAccumulator, resetYears, p.notionalMinor, frnSide);
  }

  // ---- Step 4: emit IrMaturityBandRow[] in stable band order ----
  const rows: IrMaturityBandRow[] = [];
  for (const band of BA320_BAND_ORDER) {
    const acc = bandAccumulator.get(band);
    if (!acc) continue;
    if (acc.weightedLong === 0 && acc.weightedShort === 0) continue;
    rows.push({
      band,
      weightedLongMinor: acc.weightedLong,
      weightedShortMinor: acc.weightedShort,
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    });
  }

  return { rows, swapsMissingTerms };
}

/**
 * Combine two or more IR general-risk maturity ladders (e.g. bond + IRS) into a
 * single set of per-band nets. Rows for the same band have their weighted long
 * / short summed. Output is in stable band order, stamped with the canonical
 * maturity-method-weighted-nominal basis.
 *
 * WEIGHTING-BASIS GUARD (WS-BA-RETURNS-FOLLOWON G1): every input row MUST be on
 * the `maturity-method-weighted-nominal` basis (`notionalMinor × bandRiskWeight`)
 * or carry no basis at all (back-compat for caller-supplied test/override
 * ladders, which are weighted-nominal by contract). A row carrying ANY OTHER
 * non-empty basis — e.g. a reintroduced raw-DV01 row (rand-per-bp) — is
 * dimensionally incommensurate and throws, so the G1 defect cannot silently
 * recur. The static `recon:ba320-ir-general-weighting-basis` guard enforces the
 * same invariant at the source-code level.
 *
 * Used by the BA 320 period-close subscriber to feed both bond and IRS
 * contributions into the same `generateBa310MarketRisk` IR general-risk ladder.
 */
export function combineIrGeneralLadders(
  ...ladders: readonly (readonly IrMaturityBandRow[])[]
): IrMaturityBandRow[] {
  const merged = new Map<string, { weightedLong: number; weightedShort: number }>();
  for (const ladder of ladders) {
    for (const row of ladder) {
      if (
        row.weightingBasis !== undefined &&
        row.weightingBasis !== MATURITY_METHOD_WEIGHTED_NOMINAL
      ) {
        throw new Error(
          `combineIrGeneralLadders: row for band "${row.band}" carries a foreign weighting basis ` +
            `"${row.weightingBasis}" — only "${MATURITY_METHOD_WEIGHTED_NOMINAL}" ` +
            `(notional × bandRiskWeight) rows may feed the IR general-risk ladder. A raw-DV01 ` +
            `(rand-per-bp) row is dimensionally incommensurate with weighted nominal and would ` +
            `produce a meaningless mixed-unit charge (WS-BA-RETURNS-FOLLOWON G1; ` +
            `D-IRS-DV01-BUCKETING-CALIBRATION).`,
        );
      }
      const current = merged.get(row.band) ?? { weightedLong: 0, weightedShort: 0 };
      merged.set(row.band, {
        weightedLong: current.weightedLong + row.weightedLongMinor,
        weightedShort: current.weightedShort + row.weightedShortMinor,
      });
    }
  }

  // Emit in stable band order; bands not in the canonical vocabulary
  // (defensive — should not occur) are appended afterwards in insertion order.
  const rows: IrMaturityBandRow[] = [];
  const seen = new Set<string>();
  for (const band of BA320_BAND_ORDER) {
    const acc = merged.get(band);
    if (!acc) continue;
    seen.add(band);
    if (acc.weightedLong === 0 && acc.weightedShort === 0) continue;
    rows.push({
      band,
      weightedLongMinor: acc.weightedLong,
      weightedShortMinor: acc.weightedShort,
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    });
  }
  for (const [band, acc] of merged) {
    if (seen.has(band)) continue;
    if (acc.weightedLong === 0 && acc.weightedShort === 0) continue;
    rows.push({
      band,
      weightedLongMinor: acc.weightedLong,
      weightedShortMinor: acc.weightedShort,
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    });
  }
  return rows;
}
