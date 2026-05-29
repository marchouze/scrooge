// platform/projections/markets/unified-position.ts
//
// Unified cross-asset position projection — D-FINANCIAL-INSTRUMENT-ENTITY Slice 11.
//
// Maintains net quantity, average cost, mark-to-market, and unrealised P&L
// per (entity, instrumentId, bookId) key across equities, bonds, and IRS swaps.
// Keys on the canonical FinancialInstrument entity ID so positions from
// different asset classes are comparable in a single register.
//
// Reducer is pure; replay determinism asserted in tests.
//
// Event acceptance:
//   EquityTradeBooked   — when payload.instrumentId is present (backward-compat:
//                         legacy events without instrumentId are skipped; the
//                         equity-only markets.position projection handles them)
//   BondTradeExecuted   — store-wired flat bond-accounting schema (the only
//                         bond-trade event actually emitted; see
//                         event-store/event-types/bond-accounting.ts). The
//                         canonical instrument key is derived as
//                         "fi:bond:<bondIsin>" and the position book is the
//                         IFRS-9 portfolio (trading-book / banking-book);
//                         quantity is nominal face value (minor units, signed by
//                         side); price is clean price (% of face).
//   IrsTradeBooked      — when payload.instrumentId is present; quantity is
//                         notional (positive = receive-fixed, negative = pay-fixed);
//                         price proxy is the fixed rate (MTM will replace in M2)
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY — CEO-approved 2026-05-22; authority for the
//     unified instrument entity, ACTUS contract types, and per-asset-class links.
//   D-MARKETS-SCHEMA-FOUNDATION   — CEO-approved 2026-05-07; markets projection
//     naming and semantic-layer discipline.
//   IFRS-9-§4.1 — measurement category (amortised-cost / FVTOCI / FVTPL) drives
//     how unrealised P&L is recognised; this projection does not implement that
//     split (Bea's GL posting rules handle it downstream).
//   Principles/1-events-are-truth.md — projection is a derivation; events are truth.
//   Principles/5-multi-currency-entity-country.md — currency travels on the row.
//
// Author: Anya (Data / analytics engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY Slice 11 (CEO-approved 2026-05-22).

import type { BondTradeExecutedPayload } from "../../event-store/event-types/bond-accounting";
import type { Event } from "../../event-store/types";
import type { IrsTradeBookedPayload } from "../../markets/cdm/ird";
import type { Projection } from "../types";
import type { EquityTradeBookedEvent } from "./types";

// ---------------------------------------------------------------------------
// Typed event narrows for Slice 11
// ---------------------------------------------------------------------------

type BondTradeExecutedEvent = Event & {
  readonly type: "BondTradeExecuted";
  readonly payload: BondTradeExecutedPayload;
};

type IrsTradeBookedEvent = Event & {
  readonly type: "IrsTradeBooked";
  readonly payload: IrsTradeBookedPayload;
};

/** Union of all event types accepted by the unified position projection. */
export type UnifiedPositionEvent =
  | EquityTradeBookedEvent
  | BondTradeExecutedEvent
  | IrsTradeBookedEvent;

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export interface UnifiedPositionKey {
  readonly entity: string;
  /**
   * Canonical FinancialInstrument entity ID.
   * Convention: "fi:equity:<exchange>:<ticker>", "fi:bond:<ISIN>", "fi:irs:<tradeId>".
   */
  readonly instrumentId: string;
  readonly bookId: string;
}

export interface UnifiedPositionRow {
  readonly key: UnifiedPositionKey;
  /** Asset class derived from event type. */
  readonly assetClass: "equity" | "bond" | "irs";
  /** ACTUS contract type — STK / PAM / IRS (informational; drives downstream ACTUS engine). */
  readonly actusContractType: "STK" | "PAM" | "IRS";
  /**
   * Net position quantity.
   * Equity: shares (signed — positive = long, negative = short).
   * Bond: nominal face value in minor units (signed by side).
   * IRS: notional in minor units (positive = receive-fixed, negative = pay-fixed).
   */
  readonly quantity: number;
  /** Weighted-average acquisition cost per unit. */
  readonly averageCost: number;
  /** Trade currency (ISO 4217). */
  readonly currency: string;
  /**
   * Most-recent observed price / rate proxy.
   * Equity: last execution price per share.
   * Bond: last clean price as % of face (e.g. 98.50).
   * IRS: fixed rate (decimal; placeholder until M2 market-data substrate).
   */
  readonly lastObservedPrice: number;
  /** Mark-to-market = quantity × lastObservedPrice. */
  readonly markToMarket: number;
  /** Unrealised P&L = markToMarket − (averageCost × quantity). */
  readonly unrealisedPnl: number;
  /** Number of events folded into this row (audit aid). */
  readonly eventCount: number;
}

export interface UnifiedPositionState {
  /** Map keyed by `${entity}::${instrumentId}::${bookId}`. */
  readonly rows: ReadonlyMap<string, UnifiedPositionRow>;
}

export const unifiedPositionInitial: UnifiedPositionState = { rows: new Map() };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function keyOf(k: UnifiedPositionKey): string {
  return `${k.entity}::${k.instrumentId}::${k.bookId}`;
}

function recompute(row: UnifiedPositionRow): UnifiedPositionRow {
  const markToMarket = row.quantity * row.lastObservedPrice;
  const costBasis = row.averageCost * row.quantity;
  return { ...row, markToMarket, unrealisedPnl: markToMarket - costBasis };
}

/**
 * Apply a trade to a position row using the weighted-average cost convention.
 * Works for any signed (quantity, price) pair.
 */
function applyTrade(
  state: UnifiedPositionState,
  key: UnifiedPositionKey,
  signed: number,
  price: number,
  currency: string,
  assetClass: UnifiedPositionRow["assetClass"],
  actusContractType: UnifiedPositionRow["actusContractType"],
): UnifiedPositionState {
  const k = keyOf(key);
  const existing = state.rows.get(k);
  const next = new Map(state.rows);

  if (!existing) {
    next.set(
      k,
      recompute({
        key,
        assetClass,
        actusContractType,
        quantity: signed,
        averageCost: price,
        currency,
        lastObservedPrice: price,
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
    // Same-sided: roll weighted average forward.
    const num = existing.averageCost * Math.abs(prevQty) + price * Math.abs(signed);
    const den = Math.abs(prevQty) + Math.abs(signed);
    averageCost = den === 0 ? price : num / den;
  } else if (Math.abs(signed) >= Math.abs(prevQty)) {
    // Reversal: existing position closes; residual seeds a new position.
    averageCost = newQty === 0 ? 0 : price;
  }
  // else: partial close — averageCost unchanged.

  next.set(
    k,
    recompute({
      key,
      assetClass,
      actusContractType,
      quantity: newQty,
      averageCost,
      currency: existing.currency,
      lastObservedPrice: price,
      markToMarket: 0,
      unrealisedPnl: 0,
      eventCount: existing.eventCount + 1,
    }),
  );
  return { rows: next };
}

// ---------------------------------------------------------------------------
// Per-event-type handlers
// ---------------------------------------------------------------------------

function applyEquityTrade(
  state: UnifiedPositionState,
  e: EquityTradeBookedEvent,
): UnifiedPositionState {
  const p = e.payload;
  // Only process events with an instrumentId link (Slice 6 backward-compat rule).
  if (!p.instrumentId) return state;
  const signed = p.side === "buy" ? p.quantity.amount : -p.quantity.amount;
  return applyTrade(
    state,
    { entity: e.entity, instrumentId: p.instrumentId, bookId: p.bookId },
    signed,
    p.price.amount,
    p.consideration.currency,
    "equity",
    "STK",
  );
}

function applyBondTrade(
  state: UnifiedPositionState,
  e: BondTradeExecutedEvent,
): UnifiedPositionState {
  const p = e.payload;
  // The flat bond-accounting schema has no explicit instrumentId / bookId, so
  // derive the canonical instrument key from the ISIN ("fi:bond:<ISIN>" per the
  // FinancialInstrument convention) and use the IFRS-9 portfolio as the book.
  const instrumentId = `fi:bond:${p.bondIsin}`;
  const signed = p.side === "buy" ? p.nominalMinor : -p.nominalMinor;
  return applyTrade(
    state,
    { entity: e.entity, instrumentId, bookId: p.portfolio },
    signed,
    p.cleanPricePercent,
    p.currency,
    "bond",
    "PAM",
  );
}

function applyIrsTrade(state: UnifiedPositionState, e: IrsTradeBookedEvent): UnifiedPositionState {
  const p = e.payload;
  // Only process events with an instrumentId link (Slice 7 backward-compat rule).
  if (!p.instrumentId) return state;
  // Receive-fixed = positive notional; pay-fixed = negative.
  const signed = p.bankPays === "floating" ? p.notional.amountMinor : -p.notional.amountMinor;
  return applyTrade(
    state,
    { entity: e.entity, instrumentId: p.instrumentId, bookId: p.bookId },
    signed,
    p.fixedRate,
    p.notional.currency,
    "irs",
    "IRS",
  );
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isUnifiedPositionEvent(event: {
  type: string;
  payload: unknown;
}): event is UnifiedPositionEvent {
  return (
    event.type === "EquityTradeBooked" ||
    event.type === "BondTradeExecuted" ||
    event.type === "IrsTradeBooked"
  );
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export const unifiedPositionProjection: Projection<UnifiedPositionState, UnifiedPositionEvent> = {
  name: "markets.unified-position",
  initial: unifiedPositionInitial,
  accepts: (e): e is UnifiedPositionEvent => isUnifiedPositionEvent(e),
  reduce(state, event) {
    switch (event.type) {
      case "EquityTradeBooked":
        return applyEquityTrade(state, event);
      case "BondTradeExecuted":
        return applyBondTrade(state, event);
      case "IrsTradeBooked":
        return applyIrsTrade(state, event);
    }
  },
};
