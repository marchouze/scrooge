// platform/projections/markets/position.ts
//
// Position projection — M1 equity slice. Maintains net quantity, average
// cost, mark-to-market, and unrealised P&L per (entity, instrumentIsin,
// bookId) key. Reducer is pure; replay determinism asserted in tests.
//
// P1 — projection is a derivation, never authoritative.
// P5 — keys are scoped by entity; currency travels on the row.
// P6 — semantic-layer entries in ./types.ts pin every named quantity to
//      its CDM primitive and its presentation field.
//
// M1 mark-to-market uses the most-recent EquityTradeBooked.price for the
// instrument (placeholder for the M2 market-data substrate). Reducer
// signature stays stable across the M2 swap-in.
//
// Author: Anya · M1 per D-MARKETS-SCHEMA-FOUNDATION.

import type { Projection } from "../types";
import type {
  EquityCorporateActionAppliedEvent,
  EquityLifecycleEvent,
  EquityTradeBookedEvent,
} from "./types";

export interface PositionKey {
  readonly entity: string;
  /** Instrument identifier value (scheme = ISIN typically for M1 listed equities). */
  readonly instrumentId: string;
  readonly bookId: string;
}

export interface PositionRow {
  readonly key: PositionKey;
  /** Net shares held (signed quantity rolled up). */
  readonly quantity: number;
  /** Weighted-average acquisition cost per share (in trade currency). */
  readonly averageCost: number;
  /** Trade currency (single currency per row in M1; multi-currency = multi-row). */
  readonly currency: string;
  /** Most-recent observed trade price for the instrument (placeholder MTM source). */
  readonly lastObservedPrice: number;
  /** Mark-to-market = quantity × lastObservedPrice. */
  readonly markToMarket: number;
  /** Unrealised P&L = markToMarket − (averageCost × quantity). */
  readonly unrealisedPnl: number;
  /** Number of equity events folded into this row (audit aid). */
  readonly eventCount: number;
}

export interface PositionState {
  /** Map keyed by `${entity}::${isin}::${bookId}`. */
  readonly rows: ReadonlyMap<string, PositionRow>;
}

export const positionInitial: PositionState = { rows: new Map() };

function keyOf(k: PositionKey): string {
  return `${k.entity}::${k.instrumentId}::${k.bookId}`;
}

function isEquityLifecycle(event: { type: string }): event is EquityLifecycleEvent {
  return (
    event.type === "EquityTradeBooked" ||
    event.type === "EquityCorporateActionApplied" ||
    event.type === "EquitySettlementInstructed"
  );
}

function recompute(row: PositionRow): PositionRow {
  const markToMarket = row.quantity * row.lastObservedPrice;
  const costBasis = row.averageCost * row.quantity;
  return {
    ...row,
    markToMarket,
    unrealisedPnl: markToMarket - costBasis,
  };
}

function applyTradeBooked(state: PositionState, e: EquityTradeBookedEvent): PositionState {
  const p = e.payload;
  const key: PositionKey = {
    entity: e.entity,
    instrumentId: p.instrument.identifier.value,
    bookId: p.bookId,
  };
  const k = keyOf(key);
  const signed = p.side === "buy" ? p.quantity.amount : -p.quantity.amount;
  const existing = state.rows.get(k);
  const next = new Map(state.rows);

  if (!existing) {
    // Fresh position. Sells without prior holding are short positions —
    // average cost is the sell price (the open price the position needs
    // to close back through). Same algebra; no special-case.
    next.set(
      k,
      recompute({
        key,
        quantity: signed,
        averageCost: p.price.amount,
        currency: p.consideration.currency,
        lastObservedPrice: p.price.amount,
        markToMarket: 0,
        unrealisedPnl: 0,
        eventCount: 1,
      }),
    );
    return { rows: next };
  }

  const prevQty = existing.quantity;
  const newQty = prevQty + signed;

  let averageCost = existing.averageCost;
  if (Math.sign(prevQty) === Math.sign(signed) || prevQty === 0) {
    // Same-sided trade (both buy / both sell side, or fresh): roll the
    // weighted average forward.
    const numerator = existing.averageCost * Math.abs(prevQty) + p.price.amount * Math.abs(signed);
    const denominator = Math.abs(prevQty) + Math.abs(signed);
    averageCost = denominator === 0 ? p.price.amount : numerator / denominator;
  } else if (Math.abs(signed) >= Math.abs(prevQty)) {
    // Reversal (sell exceeds long, or buy exceeds short). Existing
    // position closes out; the residual seeds a new position at the
    // trade price.
    averageCost = newQty === 0 ? 0 : p.price.amount;
  }
  // else: partial close-out keeps averageCost at the previous level.

  next.set(
    k,
    recompute({
      key,
      quantity: newQty,
      averageCost,
      currency: existing.currency,
      lastObservedPrice: p.price.amount,
      markToMarket: 0,
      unrealisedPnl: 0,
      eventCount: existing.eventCount + 1,
    }),
  );
  return { rows: next };
}

function applyCorporateAction(
  state: PositionState,
  e: EquityCorporateActionAppliedEvent,
): PositionState {
  const p = e.payload;
  // Only ratio-bearing actions move the position projection in M1;
  // cash-dividends flow through Bea's sub-ledger, not the share count.
  if (!p.ratio) return state;
  const ratio = p.ratio.numerator / p.ratio.denominator;
  if (ratio === 1) return state;
  const targetInstrument = p.instrument.identifier.value;

  const next = new Map(state.rows);
  let mutated = false;
  for (const [k, row] of state.rows) {
    if (row.key.instrumentId !== targetInstrument || row.key.bookId !== p.bookId) continue;
    if (row.key.entity !== e.entity) continue;
    const newQty = row.quantity * ratio;
    const newAvg = ratio === 0 ? row.averageCost : row.averageCost / ratio;
    next.set(
      k,
      recompute({
        ...row,
        quantity: newQty,
        averageCost: newAvg,
        eventCount: row.eventCount + 1,
      }),
    );
    mutated = true;
  }
  return mutated ? { rows: next } : state;
}

export const positionProjection: Projection<PositionState, EquityLifecycleEvent> = {
  name: "markets.position",
  initial: positionInitial,
  accepts: (e): e is EquityLifecycleEvent => isEquityLifecycle(e),
  reduce(state, event) {
    switch (event.type) {
      case "EquityTradeBooked":
        return applyTradeBooked(state, event);
      case "EquityCorporateActionApplied":
        return applyCorporateAction(state, event);
      case "EquitySettlementInstructed":
        // Settlement instruction is a downstream Tomas-domain pairing;
        // it does not alter the position quantity (the trade booking did).
        return state;
    }
  },
};
