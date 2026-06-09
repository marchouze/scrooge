// platform/reporting/ba-320-irs-events-adapter.ts
//
// Derives BA 320 interest-rate general-risk maturity-ladder contributions from
// OTC IRS DV01 sensitivities, events-first (WS-BA-RETURNS-P1-SOURCING Phase 3).
//
// Previously the IRS interest-rate general-risk sub-charge was a
// PLACEHOLDER / caller-supplied input on the BA 320 events adapter. This module
// replaces that with an events-first fold that mirrors
// `ba-320-bond-events-adapter.ts`:
//
//   IrdSwapTradeExecuted (bookDesignation === "trading", OR absent ⇒ trading
//     per Phase 1 default — OTC IRD is FVTPL/trading book per IFRS 9 §4.1.4)
//     → derecognise via IrdSwapTerminated
//     → for each live swap, take the latest IrdSwapPositionRevalued
//     → read dv01ByTenorBucket (Partial<Record<BaselMaturityBand, number>>)
//     → map each BaselMaturityBand → BA 320 IR general-risk maturity band
//     → sum DV01 across swaps per band (sign → long/short)
//     → IrMaturityBandRow[]
//
// DV01 IS the weighted (risk-sensitivity) position for an interest-rate
// instrument: it is the rand change in value for a 1bp parallel shift. The BA
// 320 IR general-risk ladder nets weighted long / short per band, so the DV01
// per tenor bucket feeds the ladder directly (no further risk-weighting — the
// duration sensitivity is the weight). A positive DV01 (value rises when rates
// fall — i.e. long-duration / receiver-of-fixed exposure) is a long position;
// a negative DV01 is a short position.
//
// Banking-book swaps (bookDesignation === "banking") are EXCLUDED — they are
// IRRBB (BA 330), not BA 320 trading-book market risk.
//
// Substrate gap (Phase 1 carry-over): the IRS revaluation engine
// (platform/markets/eod/irs-revaluation.ts) currently emits the markets-CDM
// `IrsPositionRevalued` family with a single scalar `dv01`, NOT the accounting
// `IrdSwapPositionRevalued` family with `dv01ByTenorBucket`. Until a bucketed-
// DV01 emitter lands on the accounting family, any live trading-book swap with
// no populated `dv01ByTenorBucket` is surfaced as a substrate gap (its tradeId
// is returned) — it is NOT silently dropped and a DV01 is NOT fabricated.
//
// Helena (Chief Risk Officer, governance) calibration sign-off of the DV01 →
// maturity-band mapping methodology is pending (advisory; does not block the
// events-first wiring).
//
// Authority:
//   - Regulations Relating to Banks Reg 28(3)(a) (IR general-risk maturity ladder)
//   - Reg 28(5)(b) (standardised maturity bands)
//   - BCBS d368 §21 (IRRBB standardised tenor bands)
//   - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO-approved 2026-06-09)
//   - D-BA-RETURNS-P1-SOURCING-WORKSTREAM
//   - Principles/1-events-are-truth.md
//
// Author: Mira (Regulatory reporting engineer, engineering)

import type {
  IrdSwapPositionRevaluedPayload,
  IrdSwapTerminatedPayload,
  IrdSwapTradeExecutedPayload,
} from "../event-store/event-types/ird-accounting";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import type { BaselMaturityBand } from "../types/basel";
import type { IrMaturityBandRow } from "./ba-320-market-risk";

// ---------------------------------------------------------------------------
// BaselMaturityBand → BA 320 maturity-band identity map.
//
// The BaselMaturityBand union values are byte-identical to the BA 320 IR
// general-risk band identifiers used by ba-320-bond-events-adapter.ts
// (MATURITY_BANDS.band) and consumed by generateBa310MarketRisk. The mapping
// is therefore the identity — but we declare it explicitly and exhaustively so
// that any future divergence between the two band vocabularies is a compile
// error, not a silent mis-bucketing.
// ---------------------------------------------------------------------------

const BASEL_BAND_TO_BA320_BAND: Record<BaselMaturityBand, string> = {
  "0-1m": "0-1m",
  "1-3m": "1-3m",
  "3-6m": "3-6m",
  "6-12m": "6-12m",
  "1-2y": "1-2y",
  "2-3y": "2-3y",
  "3-4y": "3-4y",
  "4-5y": "4-5y",
  "5-7y": "5-7y",
  "7-10y": "7-10y",
  "10-15y": "10-15y",
  "15-20y": "15-20y",
  ">20y": ">20y",
};

/** Stable band order for emitting rows (shortest → longest). */
const BA320_BAND_ORDER: readonly string[] = Object.values(BASEL_BAND_TO_BA320_BAND);

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
  /** Event store — provides IrdSwapTradeExecuted / -Revalued / -Terminated. */
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
  /** IR general-risk maturity-ladder rows derived from IRS DV01. */
  readonly rows: readonly IrMaturityBandRow[];
  /**
   * Trade IDs of live trading-book swaps that have NO populated
   * `dv01ByTenorBucket` on their latest revaluation (or no revaluation at all).
   * These are surfaced as substrate gaps — NOT dropped, NOT fabricated.
   */
  readonly swapsMissingDv01: readonly string[];
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Derive the BA 320 IR general-risk maturity-ladder contributions from IRS
 * DV01 sensitivities, events-first.
 *
 * Logic:
 *   1. Replay IrdSwapTerminated up to periodEnd → derecognised trade IDs.
 *   2. Replay IrdSwapTradeExecuted up to periodEnd → live trading-book swaps.
 *      - bookDesignation === "banking" → excluded (IRRBB / BA 330).
 *      - bookDesignation === "trading" OR absent → included (Phase 1 default).
 *   3. Replay IrdSwapPositionRevalued up to periodEnd → latest reval per trade
 *      (by revalDate; sequence as tie-break).
 *   4. For each live trading-book swap:
 *      - if no latest reval, or its dv01ByTenorBucket is absent/empty →
 *        surface tradeId as a substrate gap.
 *      - else sum DV01 per band: DV01 > 0 → weightedLong; < 0 → weightedShort
 *        (absolute value, since the ladder takes signed-by-side magnitudes).
 *   5. Emit one IrMaturityBandRow per band with a non-zero contribution, in
 *      stable band order.
 *
 * Citations: Regulations Relating to Banks Reg 28(3)(a), Reg 28(5)(b);
 *   BCBS d368 §21; D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
 *   D-BA-RETURNS-P1-SOURCING-WORKSTREAM; Principles/1-events-are-truth.md.
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

  // ---- Step 2: collect live trading-book swaps ----
  // bookDesignation === "banking" excluded (IRRBB / BA 330).
  // absent ⇒ trading per Phase 1 default (OTC IRD is FVTPL/trading book).
  const liveTradingSwaps = new Set<string>();
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
    liveTradingSwaps.add(p.tradeId);
  }

  // ---- Step 3: latest revaluation per trade ----
  // replay() yields events in ascending `sequence` order, so iterating and
  // keeping the row with the greatest revalDate — and, on equal revalDate, the
  // later-seen row (highest sequence) — gives the most recent revaluation.
  const latestReval = new Map<
    string,
    { payload: IrdSwapPositionRevaluedPayload; revalDate: string }
  >();
  for (const ev of eventStore.replay({
    entity,
    type: "IrdSwapPositionRevalued",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as IrdSwapPositionRevaluedPayload;
    if (!p.tradeId) continue;
    if (!liveTradingSwaps.has(p.tradeId)) continue;
    const prev = latestReval.get(p.tradeId);
    // >= on equal revalDate: later iteration (higher sequence) wins the tie.
    if (prev === undefined || p.revalDate >= prev.revalDate) {
      latestReval.set(p.tradeId, { payload: p, revalDate: p.revalDate });
    }
  }

  // ---- Step 4: accumulate DV01 per band; collect missing-DV01 swaps ----
  // band → { weightedLong, weightedShort } (minor units, absolute by side)
  const bandAccumulator = new Map<string, { weightedLong: number; weightedShort: number }>();
  const swapsMissingDv01: string[] = [];

  for (const tradeId of liveTradingSwaps) {
    const reval = latestReval.get(tradeId);
    const dv01Buckets = reval?.payload.dv01ByTenorBucket;
    if (dv01Buckets === undefined || Object.keys(dv01Buckets).length === 0) {
      // No populated per-bucket DV01 → substrate gap. Do NOT fabricate; do NOT drop.
      swapsMissingDv01.push(tradeId);
      continue;
    }

    for (const [baselBand, dv01Raw] of Object.entries(dv01Buckets) as [
      BaselMaturityBand,
      number | undefined,
    ][]) {
      if (dv01Raw === undefined || dv01Raw === 0) continue;
      const ba320Band = BASEL_BAND_TO_BA320_BAND[baselBand];
      if (ba320Band === undefined) continue; // unknown band key — ignore defensively
      const current = bandAccumulator.get(ba320Band) ?? { weightedLong: 0, weightedShort: 0 };
      const magnitude = Math.round(Math.abs(dv01Raw));
      if (dv01Raw > 0) {
        bandAccumulator.set(ba320Band, {
          weightedLong: current.weightedLong + magnitude,
          weightedShort: current.weightedShort,
        });
      } else {
        bandAccumulator.set(ba320Band, {
          weightedLong: current.weightedLong,
          weightedShort: current.weightedShort + magnitude,
        });
      }
    }
  }

  // ---- Step 5: emit IrMaturityBandRow[] in stable band order ----
  const rows: IrMaturityBandRow[] = [];
  for (const band of BA320_BAND_ORDER) {
    const acc = bandAccumulator.get(band);
    if (!acc) continue;
    if (acc.weightedLong === 0 && acc.weightedShort === 0) continue;
    rows.push({
      band,
      weightedLongMinor: acc.weightedLong,
      weightedShortMinor: acc.weightedShort,
    });
  }

  return { rows, swapsMissingDv01 };
}

/**
 * Combine two IR general-risk maturity ladders (e.g. bond + IRS) into a single
 * set of per-band nets. Rows for the same band have their weighted long / short
 * summed. Output is in stable band order.
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
    });
  }
  for (const [band, acc] of merged) {
    if (seen.has(band)) continue;
    if (acc.weightedLong === 0 && acc.weightedShort === 0) continue;
    rows.push({
      band,
      weightedLongMinor: acc.weightedLong,
      weightedShortMinor: acc.weightedShort,
    });
  }
  return rows;
}
