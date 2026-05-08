// platform/projections/markets/trade-record.ts
//
// Trade-record projection — M1 equity slice. Materialises every booked
// equity trade as a typed row keyed by tradeId. Front-office query
// surface; Bea's IFRS classifier consumes this projection without
// bespoke plumbing (per brief §What good looks like).
//
// P1 — events are the only source of truth; this projection is a cache
//      reproducible from the CDM event log at any as-of.
// P5 — every row carries entity, currency (via consideration / price),
//      and counterparty jurisdiction (via counterparty.lei + venue).
// P6 — single-graph: each row links to its source event_id, and the
//      semantic-layer entries in ./types.ts pin the citation chain.
//
// Idempotency key: tradeId. Replay with the same event set produces an
// identical projection (asserted by tests/runtime-anya-m1-projection-runtime-mapping.test.ts).
//
// Author: Anya · M1 per D-MARKETS-SCHEMA-FOUNDATION.

import type { Projection } from "../types";
import type {
  EquityLifecycleEvent,
  EquitySettlementInstructedEvent,
  EquityTradeBookedEvent,
} from "./types";

export interface TradeRecordRow {
  /** Stable trade identifier (matches EquityTradeBooked.payload.tradeId.value). */
  readonly tradeId: string;
  /** Source EquityTradeBooked event_id — preserved for audit / lineage. */
  readonly sourceEventId: string;
  /** Booking entity (P5 — every row entity-scoped). */
  readonly entity: string;
  /** Buy or sell from the bank's perspective. */
  readonly side: "buy" | "sell";
  /** Instrument identifier (scheme + value — typically ISIN for listed equity). */
  readonly instrumentIdentifier: string;
  readonly instrumentScheme: string;
  /** Instrument class (listed-equity / etf for M1). */
  readonly instrumentClass: string;
  /** Native currency of the instrument. */
  readonly instrumentCurrency: string;
  /** Quantity traded (signed by side: buy = +, sell = −). */
  readonly signedQuantity: number;
  /** Trade price per unit (in trade currency). */
  readonly price: number;
  /** Trade currency. */
  readonly currency: string;
  /** Total consideration before fees, in the smallest currency unit (e.g. cents). */
  readonly considerationMinor: number;
  /** Trade date (T0, ISO-8601). */
  readonly tradeDate: string;
  /** Settlement date (T+n, ISO-8601). */
  readonly settlementDate: string;
  /** Counterparty stable identifier (LEI preferred; internal otherwise). */
  readonly counterpartyId: string;
  /** Trading venue. */
  readonly venue: string;
  /** Trader / desk identifier. */
  readonly trader: string;
  /** Trading book / strategy. */
  readonly bookId: string;
  /** Whether settlement has been instructed (paired with EquitySettlementInstructed). */
  readonly settlementInstructed: boolean;
  /** Settlement-instruction event_id (when settlementInstructed = true). */
  readonly settlementEventId: string | null;
}

export interface TradeRecordState {
  readonly rows: ReadonlyMap<string, TradeRecordRow>;
}

export const tradeRecordInitial: TradeRecordState = { rows: new Map() };

function isEquityLifecycle(event: { type: string }): event is EquityLifecycleEvent {
  return (
    event.type === "EquityTradeBooked" ||
    event.type === "EquitySettlementInstructed" ||
    event.type === "EquityCorporateActionApplied"
  );
}

function applyTradeBooked(state: TradeRecordState, e: EquityTradeBookedEvent): TradeRecordState {
  const p = e.payload;
  const tradeId = p.tradeId.value;
  if (state.rows.has(tradeId)) {
    // Idempotency — duplicate trade events are append-only audit; the
    // projection's first-write wins. Replay determinism preserved.
    return state;
  }
  const signedQuantity = p.side === "buy" ? p.quantity.amount : -p.quantity.amount;
  const next = new Map(state.rows);
  next.set(tradeId, {
    tradeId,
    sourceEventId: e.event_id,
    entity: e.entity,
    side: p.side,
    instrumentIdentifier: p.instrument.identifier.value,
    instrumentScheme: p.instrument.identifier.scheme,
    instrumentClass: p.instrument.class,
    instrumentCurrency: p.instrument.currency,
    signedQuantity,
    price: p.price.amount,
    currency: p.consideration.currency,
    considerationMinor: p.consideration.amountMinor,
    tradeDate: p.tradeDate.iso,
    settlementDate: p.settlementDate.iso,
    counterpartyId: p.counterparty.partyId,
    venue: p.venue,
    trader: p.trader,
    bookId: p.bookId,
    settlementInstructed: false,
    settlementEventId: null,
  });
  return { rows: next };
}

function applySettlementInstructed(
  state: TradeRecordState,
  e: EquitySettlementInstructedEvent,
): TradeRecordState {
  const tradeId = e.payload.tradeId.value;
  const existing = state.rows.get(tradeId);
  if (!existing) return state; // settlement before booking — flag at recon, not here
  if (existing.settlementInstructed) return state; // idempotent
  const next = new Map(state.rows);
  next.set(tradeId, {
    ...existing,
    settlementInstructed: true,
    settlementEventId: e.event_id,
  });
  return { rows: next };
}

export const tradeRecordProjection: Projection<TradeRecordState, EquityLifecycleEvent> = {
  name: "markets.trade-record",
  initial: tradeRecordInitial,
  accepts: (e): e is EquityLifecycleEvent => isEquityLifecycle(e),
  reduce(state, event) {
    switch (event.type) {
      case "EquityTradeBooked":
        return applyTradeBooked(state, event);
      case "EquitySettlementInstructed":
        return applySettlementInstructed(state, event);
      case "EquityCorporateActionApplied":
        // Corporate actions don't alter the trade record itself; they
        // alter the position projection. Trade-record stays immutable
        // post-booking apart from settlement-instruction pairing.
        return state;
    }
  },
};
