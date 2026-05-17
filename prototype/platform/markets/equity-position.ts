// platform/markets/equity-position.ts
//
// Equity position projection — builds the open equity book from the event stream.
//
// Algorithm:
//   1. Replay EquityTradeBooked → accumulate positions per instrument (by ISIN).
//   2. Apply EquityCorporateActionApplied → adjust quantity (splits) / cost basis (dividends).
//   3. Remove EquitySettlementConfirmed positions (settled = closed from open book).
//
// Position map key: ISIN value from instrument.identifier.value
//
// This is a pure function over an event array, making it trivially testable and
// composable with any event store adapter.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - IFRS-9-§4.1 (FVTPL classification for trading book)
//   - STRATE-RULE-7 (settlement via Strate CSD)
//
// Authors: Kai (Quantitative Markets Architect, engineering)

import type { EventStore } from "../event-store/store";
import type {
  EquityCorporateActionAppliedPayload,
  EquitySettlementConfirmedPayload,
  EquityTradeBookedPayload,
} from "./cdm/equity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EquityPosition {
  /** ISIN of the instrument. */
  isin: string;
  /** Full instrument record from the most-recent booking event. */
  instrument: EquityTradeBookedPayload["instrument"];
  /** Net quantity held (shares). */
  quantity: number;
  /** Weighted-average cost price in ZAR major units (e.g. R4,250.00). */
  avgCostPriceZAR: number;
  /** Total cost basis in ZAR minor units (cents). */
  totalCostZAR: number;
}

/** Map from ISIN to open equity position. */
export type EquityBook = Map<string, EquityPosition>;

// ---------------------------------------------------------------------------
// Pure builder — no I/O; inject events directly.
// ---------------------------------------------------------------------------

/**
 * Build the open equity book from a raw event array.
 *
 * Events must be in chronological order (the event store replay contract).
 *
 * @param events  Raw event records from the store. Non-equity events are ignored.
 * @returns       The current open equity book (settled positions removed).
 */
export function buildEquityBook(
  events: ReadonlyArray<{ type: string; payload: unknown }>,
): EquityBook {
  const book = new Map<string, EquityPosition>();

  for (const event of events) {
    // -----------------------------------------------------------------------
    // EquityTradeBooked → accumulate position
    // -----------------------------------------------------------------------
    if (event.type === "EquityTradeBooked") {
      const p = event.payload as EquityTradeBookedPayload;
      const isin = p.instrument.identifier.value;
      const qty = p.quantity.amount;
      // consideration.amountMinor is the total cost in minor units
      const costMinor = p.consideration.amountMinor;

      if (p.side === "buy") {
        const existing = book.get(isin);
        if (!existing) {
          book.set(isin, {
            isin,
            instrument: p.instrument,
            quantity: qty,
            avgCostPriceZAR: costMinor / qty / 100, // minor → major per share
            totalCostZAR: costMinor,
          });
        } else {
          // Weighted-average cost
          const newQty = existing.quantity + qty;
          const newTotalCost = existing.totalCostZAR + costMinor;
          book.set(isin, {
            ...existing,
            quantity: newQty,
            totalCostZAR: newTotalCost,
            avgCostPriceZAR: newTotalCost / newQty / 100,
          });
        }
      } else if (p.side === "sell") {
        const existing = book.get(isin);
        if (existing) {
          const newQty = existing.quantity - qty;
          const newTotalCost = existing.avgCostPriceZAR * 100 * newQty;
          if (newQty <= 0) {
            book.delete(isin);
          } else {
            book.set(isin, {
              ...existing,
              quantity: newQty,
              totalCostZAR: Math.round(newTotalCost),
            });
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // EquityCorporateActionApplied → adjust quantity / cost basis
    // -----------------------------------------------------------------------
    if (event.type === "EquityCorporateActionApplied") {
      const p = event.payload as EquityCorporateActionAppliedPayload;
      const isin = p.instrument.identifier.value;
      const existing = book.get(isin);
      if (!existing) continue;

      if (p.actionType === "stock-split" || p.actionType === "bonus-issue") {
        if (p.ratio) {
          const factor = p.ratio.numerator / p.ratio.denominator;
          const newQty = existing.quantity * factor;
          book.set(isin, {
            ...existing,
            quantity: newQty,
            // avg cost per share adjusts inversely
            avgCostPriceZAR: existing.avgCostPriceZAR / factor,
            // total cost basis unchanged
          });
        }
      } else if (p.actionType === "stock-consolidation") {
        if (p.ratio) {
          const factor = p.ratio.numerator / p.ratio.denominator;
          const newQty = existing.quantity * factor;
          book.set(isin, {
            ...existing,
            quantity: newQty,
            avgCostPriceZAR: existing.avgCostPriceZAR / factor,
          });
        }
      }
      // cash-dividend: reduces cost basis by dividend per share received
      // Build-phase simplification: totalCostZAR left unchanged (IFRS-9 §5.5 detail deferred)
    }

    // -----------------------------------------------------------------------
    // EquitySettlementConfirmed → remove settled position from open book
    // -----------------------------------------------------------------------
    if (event.type === "EquitySettlementConfirmed") {
      const p = event.payload as EquitySettlementConfirmedPayload;
      const isin = p.securitiesLeg.instrument.identifier.value;
      book.delete(isin);
    }
  }

  return book;
}

// ---------------------------------------------------------------------------
// Store-aware wrapper — loads events and calls buildEquityBook.
// ---------------------------------------------------------------------------

/**
 * Project the current equity book from the event store.
 *
 * @param store  EventStore instance to replay from.
 * @returns      The open equity book.
 */
export function projectEquityPositions(store: EventStore): EquityBook {
  const events: Array<{ type: string; payload: unknown }> = [];

  // Collect all equity-related events in order
  for (const e of store.replay({ type: "EquityTradeBooked" })) {
    events.push({ type: e.type, payload: e.payload });
  }
  for (const e of store.replay({ type: "EquityCorporateActionApplied" })) {
    events.push({ type: e.type, payload: e.payload });
  }
  for (const e of store.replay({ type: "EquitySettlementConfirmed" })) {
    events.push({ type: e.type, payload: e.payload });
  }

  return buildEquityBook(events);
}
