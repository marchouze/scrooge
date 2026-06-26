// platform/reporting/ba-350-derivatives-fold.ts
//
// BA 350 (Derivatives Instruments) notional + fair-value inventory fold over the
// derivative book (D-BA-RETURN-SIMULATOR-FIRST Phase 2b).
//
// BA 350 is an INVENTORY return — not a capital charge. It reports, over every
// derivative the bank holds, two measures:
//   - gross NOTIONAL (always a positive magnitude), and
//   - FAIR VALUE (signed: gross positive = net asset; gross negative = net
//     liability; net = positive + negative).
// segmented by the BA 350 grid axes:
//   - underlying ASSET CLASS  (interest-rate / FX / equity / commodity / credit / other)
//   - VENUE                   (exchange-traded / over-the-counter)
//   - INSTRUMENT TYPE         (future / forward-FRA / swap / option written/purchased / …)
//   - MATURITY BAND           (<1y / 1-5y / >5y)
//   - BOOK                    (trading / banking) — both books report on BA 350.
//
// This fold is the BA 350 analogue of the BA 320 equity/commodity adapters: it
// reads the born-V2 DerivativeTradingPositionOpened stream (minus the matching
// Closed derecognitions), applies the canonical provenance filter, and produces
// a typed inventory the BA 350 cell-assembly maps onto the return grid. It is a
// PURE READ — no appends.
//
// PROVENANCE BOUNDARY (the R300m-into-Prod lesson): the fold takes a
// ProvenanceFilter and only folds events that match it. The PRODUCTION read
// (`defaultProvenanceFilter()`, production-only) excludes the simulated book, so
// the production BA 350 inventory is empty (all zero) pre-licence-day. The
// simulated read appears only under a simulated-inclusive filter. Both legs are
// proven by `recon:ba350-derivatives-sim-drive`.
//
// DECIMAL-NATIVE: the event payloads carry MoneyWire (major-unit decimal); this
// fold converts to minor-unit `number` at the fold boundary via
// `minorFromMoneyWire` (the same boundary the BA 320 adapters cross). The minor
// figures are summed with integer addition (no float-money arithmetic).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-MONEY-DECIMAL-REDENOMINATION; Regulations Relating to Banks Reg 28 / Reg 30;
//   Principle 1 (events are truth); Principle 5 (currency at the type level).
//
// Author: Atlas (Core banking platform architect, engineering).

import { minorFromMoneyWire } from "../core/money-codec";
import type {
  DerivativeAssetClass,
  DerivativeInstrumentType,
  DerivativeMaturityBand,
  DerivativePositionClosedPayload,
  DerivativePositionOpenedPayload,
  DerivativeVenue,
} from "../event-store/event-types/derivative-book-positions";
import type { EventStore } from "../event-store/store";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../projections/filter";

// ---------------------------------------------------------------------------
// Output contract
// ---------------------------------------------------------------------------

/** The two BA 350 book columns. */
export type Ba350Book = "trading" | "banking";

/**
 * The aggregated measures for one grid cell. All in minor units (cents). Notional
 * is an absolute positive magnitude; fair-value is split into the positive
 * (asset) and negative (liability) legs, plus their net.
 */
export interface Ba350Measures {
  /** Gross notional (Σ |notional|), minor units. */
  readonly notionalMinor: number;
  /** Gross POSITIVE fair value (Σ fairValue where fairValue > 0), minor units, positive. */
  readonly positiveFairValueMinor: number;
  /** Gross NEGATIVE fair value (Σ fairValue where fairValue < 0), minor units, negative or 0. */
  readonly negativeFairValueMinor: number;
  /** Net fair value = positive + negative, minor units (signed). */
  readonly netFairValueMinor: number;
  /** Number of open positions folded into this cell. */
  readonly positionCount: number;
}

/** One grid row, fully keyed. */
export interface Ba350GridRow {
  readonly assetClass: DerivativeAssetClass;
  readonly venue: DerivativeVenue;
  readonly instrumentType: DerivativeInstrumentType;
  readonly maturityBand: DerivativeMaturityBand;
  readonly book: Ba350Book;
  readonly measures: Ba350Measures;
}

/** The full BA 350 inventory derived from the book. */
export interface Ba350Inventory {
  readonly entity: string;
  readonly periodEnd: string;
  /** Every populated grid row (cells with no positions are omitted, not zero-filled). */
  readonly rows: readonly Ba350GridRow[];
  /** Total open positions folded (across all cells). */
  readonly totalPositions: number;
  /** Provenance-filter digest the inventory was computed under (audit trail). */
  readonly provenanceDigest: string;
}

// ---------------------------------------------------------------------------
// Input contract
// ---------------------------------------------------------------------------

export interface Ba350FoldInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entity: string;
  /** Period-end ISO 8601 date-time. Positions opened ≤ periodEnd are folded. */
  readonly periodEnd: string;
  /** Event store — provides DerivativeTradingPosition{Opened,Closed}. */
  readonly eventStore: EventStore;
  /**
   * Provenance filter. Defaults to the canonical production-only filter
   * (`defaultProvenanceFilter()`) — so a caller that does NOT pass a filter gets
   * the production read (simulated book excluded). The recon / simulated read
   * passes a simulated-inclusive filter explicitly.
   */
  readonly provenanceFilter?: ProvenanceFilter;
}

// ---------------------------------------------------------------------------
// Per-cell accumulator
// ---------------------------------------------------------------------------

interface CellAccumulator {
  notionalMinor: number;
  positiveFairValueMinor: number;
  negativeFairValueMinor: number;
  positionCount: number;
}

function cellKey(p: {
  assetClass: DerivativeAssetClass;
  venue: DerivativeVenue;
  instrumentType: DerivativeInstrumentType;
  maturityBand: DerivativeMaturityBand;
  book: Ba350Book;
}): string {
  return `${p.assetClass}|${p.venue}|${p.instrumentType}|${p.maturityBand}|${p.book}`;
}

function bookOf(bookType: "trading" | "banking-treasury"): Ba350Book {
  return bookType === "trading" ? "trading" : "banking";
}

// ---------------------------------------------------------------------------
// Main fold
// ---------------------------------------------------------------------------

/**
 * Fold the derivative book into the BA 350 inventory grid. Pure read.
 *
 * Logic:
 *   1. Collect derecognised positionIds from DerivativeTradingPositionClosed.
 *   2. Replay DerivativeTradingPositionOpened ≤ periodEnd, provenance-filtered.
 *   3. Exclude derecognised positions.
 *   4. Accumulate notional + positive/negative fair value per grid cell.
 *   5. Emit one Ba350GridRow per populated cell (empty cells omitted, NOT
 *      zero-filled — a zero-position cell is "no inventory", which the BA 350
 *      assembly renders 0 by absence, never a fabricated figure).
 *
 * Citations: Reg 28 / Reg 30 (derivative-instruments return);
 *   D-BA-RETURN-SIMULATOR-FIRST; Principle 1.
 */
export function foldBa350Derivatives(input: Ba350FoldInput): Ba350Inventory {
  const { eventStore, entity, periodEnd } = input;
  const provenanceFilter = input.provenanceFilter ?? defaultProvenanceFilter();

  // 1. Derecognitions.
  const closed = new Set<string>();
  for (const ev of eventStore.replay({
    type: "DerivativeTradingPositionClosed",
    asOf: periodEnd,
  })) {
    if (ev.entity !== entity) continue;
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as unknown as DerivativePositionClosedPayload;
    closed.add(p.positionId);
  }

  // 2 + 4. Fold opens.
  const cells = new Map<string, { row: Omit<Ba350GridRow, "measures">; acc: CellAccumulator }>();
  let totalPositions = 0;

  for (const ev of eventStore.replay({
    type: "DerivativeTradingPositionOpened",
    asOf: periodEnd,
  })) {
    if (ev.entity !== entity) continue;
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as unknown as DerivativePositionOpenedPayload;
    if (closed.has(p.positionId)) continue;

    const book = bookOf(p.bookType);
    const key = cellKey({
      assetClass: p.assetClass,
      venue: p.venue,
      instrumentType: p.instrumentType,
      maturityBand: p.maturityBand,
      book,
    });
    let entry = cells.get(key);
    if (!entry) {
      entry = {
        row: {
          assetClass: p.assetClass,
          venue: p.venue,
          instrumentType: p.instrumentType,
          maturityBand: p.maturityBand,
          book,
        },
        acc: {
          notionalMinor: 0,
          positiveFairValueMinor: 0,
          negativeFairValueMinor: 0,
          positionCount: 0,
        },
      };
      cells.set(key, entry);
    }

    // Notional is reported as an absolute magnitude.
    entry.acc.notionalMinor += Math.abs(minorFromMoneyWire(p.notional));
    // Fair value is signed; split into the positive and negative legs.
    const fvMinor = minorFromMoneyWire(p.fairValue);
    if (fvMinor > 0) entry.acc.positiveFairValueMinor += fvMinor;
    else if (fvMinor < 0) entry.acc.negativeFairValueMinor += fvMinor;
    entry.acc.positionCount += 1;
    totalPositions += 1;
  }

  // 5. Emit populated rows.
  const rows: Ba350GridRow[] = [];
  for (const { row, acc } of cells.values()) {
    rows.push({
      ...row,
      measures: {
        notionalMinor: acc.notionalMinor,
        positiveFairValueMinor: acc.positiveFairValueMinor,
        negativeFairValueMinor: acc.negativeFairValueMinor,
        netFairValueMinor: acc.positiveFairValueMinor + acc.negativeFairValueMinor,
        positionCount: acc.positionCount,
      },
    });
  }

  return {
    entity,
    periodEnd,
    rows,
    totalPositions,
    provenanceDigest: provenanceFilter.mode,
  };
}

// ---------------------------------------------------------------------------
// Aggregation helpers — BA 350 cell assembly reads these.
// ---------------------------------------------------------------------------

const ZERO_MEASURES: Ba350Measures = {
  notionalMinor: 0,
  positiveFairValueMinor: 0,
  negativeFairValueMinor: 0,
  netFairValueMinor: 0,
  positionCount: 0,
};

function sumMeasures(rows: readonly Ba350GridRow[]): Ba350Measures {
  let notionalMinor = 0;
  let positiveFairValueMinor = 0;
  let negativeFairValueMinor = 0;
  let positionCount = 0;
  for (const r of rows) {
    notionalMinor += r.measures.notionalMinor;
    positiveFairValueMinor += r.measures.positiveFairValueMinor;
    negativeFairValueMinor += r.measures.negativeFairValueMinor;
    positionCount += r.measures.positionCount;
  }
  return {
    notionalMinor,
    positiveFairValueMinor,
    negativeFairValueMinor,
    netFairValueMinor: positiveFairValueMinor + negativeFairValueMinor,
    positionCount,
  };
}

/**
 * Aggregate measures over a predicate selection (asset class / venue / book /
 * maturity / instrument-type, any combination). Empty selection → ZERO_MEASURES
 * (an honest zero by absence of inventory, never a fabricated figure).
 */
export function aggregateBa350(
  inv: Ba350Inventory,
  predicate: (row: Ba350GridRow) => boolean,
): Ba350Measures {
  const selected = inv.rows.filter(predicate);
  if (selected.length === 0) return ZERO_MEASURES;
  return sumMeasures(selected);
}

/** Notional by asset-class × book (the BA 350 notional grid backbone). */
export function ba350NotionalByAssetClassBook(
  inv: Ba350Inventory,
  assetClass: DerivativeAssetClass,
  book: Ba350Book,
): number {
  return aggregateBa350(inv, (r) => r.assetClass === assetClass && r.book === book).notionalMinor;
}

/** Net fair value by asset-class × book. */
export function ba350NetFairValueByAssetClassBook(
  inv: Ba350Inventory,
  assetClass: DerivativeAssetClass,
  book: Ba350Book,
): number {
  return aggregateBa350(inv, (r) => r.assetClass === assetClass && r.book === book)
    .netFairValueMinor;
}

/** Grand totals across the whole inventory. */
export function ba350GrandTotal(inv: Ba350Inventory): Ba350Measures {
  return sumMeasures(inv.rows);
}
