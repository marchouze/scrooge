// platform/projections/markets/sub-ledger.ts
//
// Sub-ledger projection — M1 equity slice + FX Spot extension.
//
// Materialises typed accounting entries that Bea's IFRS classifier consumes
// without bespoke plumbing. Each row is the raw posting candidate keyed by
// (sourceEventId, leg); classification (HFT / FVTPL / FVOCI / amortised
// cost) is Bea's downstream call — this projection is the typed input.
//
// FX extension added in this slice:
//   - FxTradeExecuted  → "fx-receivable" + "fx-payable" legs
//   - FxPositionRevalued → "fx-revaluation" leg
//   - TradeMatured → "fx-settlement-receive" + "fx-settlement-deliver" legs
//
// P1 — derived from the event log.
// P2 — every row inherits the source event's citations.
// P5 — entity + currency on every row.
// P6 — the projection is the typed contract Bea consumes.
//
// Authors: Anya (Data / analytics engineer, engineering) · M1 equity per
//   D-MARKETS-SCHEMA-FOUNDATION. FX extension: Camille (CFO, finance) +
//   Bea (Accounting & financial reporting engineer, engineering) per
//   D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12).

import {
  fxRevaluationJournals,
  fxSettlementJournals,
  fxTradeBookingJournals,
} from "../../accounting/posting-rules/fx-spot";
import type { FxPositionRevaluedPayload } from "../../event-store/event-types/fx-accounting";
import type { TradeMaturedFxSpotPayload } from "../../event-store/event-types/trade-matured";
import type { Event } from "../../event-store/types";
import { isCancelledInstance, resolveTradeLifecycle } from "../../lifecycle/trade-lifecycle-state";
import type { FxTradeExecutedPayload } from "../../markets/cdm/fx";
import type { Projection } from "../types";
import type {
  EquityCorporateActionAppliedEvent,
  EquityLifecycleEvent,
  EquitySettlementInstructedEvent,
  EquityTradeBookedEvent,
} from "./types";

export type SubLedgerLegKind =
  /** The trade-booking leg — recognises the financial-instrument acquisition / disposal. */
  | "trade-acquisition"
  | "trade-disposal"
  /** Cash leg of a corporate action (dividend received). */
  | "ca-cash"
  /** Quantity-only leg of a corporate action (split / consolidation / scrip). */
  | "ca-ratio"
  /** Settlement leg — net cash + net quantity exchanged at the CSD. */
  | "settlement-net"
  // FX Spot legs
  /** FX trading receivable — initial recognition on FxTradeExecuted. */
  | "fx-receivable"
  /** FX trading payable — initial recognition on FxTradeExecuted. */
  | "fx-payable"
  /** Daily FVTPL revaluation leg — FxPositionRevalued. */
  | "fx-revaluation"
  /** Settlement receive leg — cash arrives at nostro on TradeMatured. */
  | "fx-settlement-receive"
  /** Settlement deliver leg — cash leaves nostro on TradeMatured. */
  | "fx-settlement-deliver";

export interface SubLedgerRow {
  /** Primary key — (sourceEventId, legKind) uniquely identifies a row. */
  readonly sourceEventId: string;
  readonly legKind: SubLedgerLegKind;
  readonly entity: string;
  readonly asOf: string;
  readonly instrumentId: string | null;
  readonly bookId: string | null;
  /** Currency of the leg (single currency per row). */
  readonly currency: string | null;
  /** Signed cash impact in the smallest currency unit (positive = cash in, negative = cash out). */
  readonly cashAmountMinor: number | null;
  /** Signed quantity impact. */
  readonly quantityAmount: number | null;
  /** Trade / settlement / corporate-action identifier rolled forward. */
  readonly externalRef: string | null;
  /** Citations carried forward from the source event (Principle 2). */
  readonly citations: readonly string[];
}

export interface SubLedgerState {
  /** Append-ordered rows; idempotent on (sourceEventId, legKind). */
  readonly rows: ReadonlyArray<SubLedgerRow>;
}

export const subLedgerInitial: SubLedgerState = { rows: [] };

function rowKey(r: Pick<SubLedgerRow, "sourceEventId" | "legKind">): string {
  return `${r.sourceEventId}::${r.legKind}`;
}

function appendIfFresh(state: SubLedgerState, newRow: SubLedgerRow): SubLedgerState {
  for (const existing of state.rows) {
    if (rowKey(existing) === rowKey(newRow)) return state;
  }
  return { rows: [...state.rows, newRow] };
}

function isEquityLifecycle(event: { type: string }): event is EquityLifecycleEvent {
  return (
    event.type === "EquityTradeBooked" ||
    event.type === "EquityCorporateActionApplied" ||
    event.type === "EquitySettlementInstructed"
  );
}

function applyTradeBooked(state: SubLedgerState, e: EquityTradeBookedEvent): SubLedgerState {
  const p = e.payload;
  const isAcquisition = p.side === "buy";
  const cashAmountMinor = isAcquisition
    ? -p.consideration.amountMinor
    : p.consideration.amountMinor;
  const quantityAmount = isAcquisition ? p.quantity.amount : -p.quantity.amount;
  return appendIfFresh(state, {
    sourceEventId: e.event_id,
    legKind: isAcquisition ? "trade-acquisition" : "trade-disposal",
    entity: e.entity,
    asOf: e.as_of,
    instrumentId: p.instrument.identifier.value,
    bookId: p.bookId,
    currency: p.consideration.currency,
    cashAmountMinor,
    quantityAmount,
    externalRef: p.tradeId.value,
    citations: e.citations,
  });
}

function applyCorporateAction(
  state: SubLedgerState,
  e: EquityCorporateActionAppliedEvent,
): SubLedgerState {
  const p = e.payload;
  let next = state;
  if (p.cashPerShare) {
    // cashPerShare is a Price (major unit per share); positionAtRecord is in
    // the share quantity unit. The leg amount is captured in the smallest
    // currency unit by multiplying through and rounding to the nearest
    // minor unit (centavo / cent). Bea's classifier owns the precise
    // accounting policy on rounding; the projection records the raw leg.
    const major = p.cashPerShare.amount * p.positionAtRecord.amount;
    const cashAmountMinor = Math.round(major * 100);
    next = appendIfFresh(next, {
      sourceEventId: e.event_id,
      legKind: "ca-cash",
      entity: e.entity,
      asOf: e.as_of,
      instrumentId: p.instrument.identifier.value,
      bookId: p.bookId,
      currency: p.cashPerShare.currency,
      cashAmountMinor,
      quantityAmount: null,
      externalRef: p.actionId.value,
      citations: e.citations,
    });
  }
  if (p.ratio && p.ratio.numerator !== p.ratio.denominator) {
    const ratio = p.ratio.numerator / p.ratio.denominator;
    const delta = p.positionAtRecord.amount * (ratio - 1);
    next = appendIfFresh(next, {
      sourceEventId: e.event_id,
      legKind: "ca-ratio",
      entity: e.entity,
      asOf: e.as_of,
      instrumentId: p.instrument.identifier.value,
      bookId: p.bookId,
      currency: null,
      cashAmountMinor: null,
      quantityAmount: delta,
      externalRef: p.actionId.value,
      citations: e.citations,
    });
  }
  return next;
}

function applySettlementInstructed(
  state: SubLedgerState,
  e: EquitySettlementInstructedEvent,
): SubLedgerState {
  const p = e.payload;
  return appendIfFresh(state, {
    sourceEventId: e.event_id,
    legKind: "settlement-net",
    entity: e.entity,
    asOf: e.as_of,
    instrumentId: null,
    bookId: null,
    currency: p.netCash.currency,
    cashAmountMinor: p.netCash.amountMinor,
    quantityAmount: p.netQuantity.amount,
    externalRef: p.settlementId.value,
    citations: e.citations,
  });
}

export const subLedgerProjection: Projection<SubLedgerState, EquityLifecycleEvent> = {
  name: "markets.sub-ledger",
  initial: subLedgerInitial,
  accepts: (e): e is EquityLifecycleEvent => isEquityLifecycle(e),
  reduce(state, event) {
    switch (event.type) {
      case "EquityTradeBooked":
        return applyTradeBooked(state, event);
      case "EquityCorporateActionApplied":
        return applyCorporateAction(state, event);
      case "EquitySettlementInstructed":
        return applySettlementInstructed(state, event);
    }
  },
};

// ---------------------------------------------------------------------------
// FX sub-ledger projection — extends the equity projection with FX Spot
// lifecycle events. Separate projection instance so equity and FX can be
// composed independently by callers.
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering) per D-MARKETS-CAPITAL-TIME-SHAPE.
// ---------------------------------------------------------------------------

export type FxSubLedgerEvent = Event & {
  type: "FxTradeExecuted" | "FxPositionRevalued" | "TradeMatured" | "FxTradeCancelled";
};

function isFxSubLedgerEvent(event: { type: string }): event is FxSubLedgerEvent {
  return (
    event.type === "FxTradeExecuted" ||
    event.type === "FxPositionRevalued" ||
    event.type === "TradeMatured" ||
    event.type === "FxTradeCancelled"
  );
}

function applyFxTradeExecuted(state: SubLedgerState, e: Event): SubLedgerState {
  const p = e.payload as unknown as FxTradeExecutedPayload & { tradeId: string };
  const tradeId = p.tradeId ?? e.event_id;
  const journals = fxTradeBookingJournals({
    tradeId: typeof tradeId === "string" ? tradeId : (tradeId as { value: string }).value,
    side: p.side,
    legs: p.legs,
    currencyPair: p.currencyPair,
  });

  let next = state;
  // Each journal leg maps to a sub-ledger row.
  // Group legs by currency: debit legs → "fx-receivable", credit legs → "fx-payable".
  for (const leg of journals) {
    const legKind: SubLedgerLegKind = leg.debitCredit === "debit" ? "fx-receivable" : "fx-payable";
    const cashAmountMinor = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
    next = appendIfFresh(next, {
      sourceEventId: e.event_id,
      legKind,
      entity: e.entity,
      asOf: e.as_of,
      instrumentId: typeof tradeId === "string" ? tradeId : (tradeId as { value: string }).value,
      bookId: p.bookId ?? null,
      currency: leg.currency,
      cashAmountMinor,
      quantityAmount: null,
      externalRef: typeof tradeId === "string" ? tradeId : (tradeId as { value: string }).value,
      citations: e.citations,
    });
  }
  return next;
}

function applyFxPositionRevalued(state: SubLedgerState, e: Event): SubLedgerState {
  const p = e.payload as unknown as FxPositionRevaluedPayload;
  const journals = fxRevaluationJournals(p);

  let next = state;
  for (const leg of journals) {
    const cashAmountMinor = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
    next = appendIfFresh(next, {
      sourceEventId: e.event_id,
      legKind: "fx-revaluation",
      entity: e.entity,
      asOf: e.as_of,
      instrumentId: p.tradeId,
      bookId: null,
      currency: leg.currency,
      cashAmountMinor,
      quantityAmount: null,
      externalRef: p.tradeId,
      citations: e.citations,
    });
  }
  return next;
}

function applyTradeMatured(state: SubLedgerState, e: Event): SubLedgerState {
  const p = e.payload as unknown as TradeMaturedFxSpotPayload;
  const journals = fxSettlementJournals(p);

  let next = state;
  for (const leg of journals) {
    // Settlement legs: nostro debits = receive, nostro credits = deliver
    const legKind: SubLedgerLegKind =
      leg.debitCredit === "debit" ? "fx-settlement-receive" : "fx-settlement-deliver";
    const cashAmountMinor = leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
    next = appendIfFresh(next, {
      sourceEventId: e.event_id,
      legKind,
      entity: e.entity,
      asOf: e.as_of,
      instrumentId: p.tradeId,
      bookId: null,
      currency: leg.currency,
      cashAmountMinor,
      quantityAmount: null,
      externalRef: p.tradeId,
      citations: e.citations,
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// buildFxSubLedger — two-pass replay with cancellation filtering.
//
// Replays the full event list, first collecting cancelled trade IDs from
// FxTradeCancelled events, then folding FxTradeExecuted / FxPositionRevalued
// / TradeMatured events while skipping any whose tradeId is in the
// cancelled set. Cancellations themselves produce no sub-ledger rows (the
// original rows remain absent from the ledger, i.e. they are never added).
//
// Authority: CEO instruction 2026-05-19 (cancel 15 bad simulated trades).
// ---------------------------------------------------------------------------

export function buildFxSubLedger(events: readonly Event[]): SubLedgerState {
  // Pass 1 — resolve cancelled trade IDs via the canonical registry-driven
  // resolver (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE). Only cancellations are
  // skipped; settled/matured legs still post their settlement journals.
  const lifecycleIdx = resolveTradeLifecycle(events);

  // Helper: extract tradeId string from a FxTradeExecuted / FxPositionRevalued payload.
  function extractTradeId(p: Record<string, unknown>): string | null {
    const raw = p.tradeId as Record<string, unknown> | string | undefined;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw.value === "string") return raw.value;
    return null;
  }

  // Pass 2 — fold events, skipping cancelled trades.
  let state = subLedgerInitial;
  for (const e of events) {
    if (!isFxSubLedgerEvent(e)) continue;
    switch (e.type) {
      case "FxTradeCancelled":
        // No sub-ledger rows produced for cancellations; the tradeId was collected
        // in Pass 1 so the related FxTradeExecuted and FxPositionRevalued rows
        // are simply never added.
        break;
      case "FxTradeExecuted": {
        const tradeId = extractTradeId(e.payload as Record<string, unknown>);
        if (tradeId && isCancelledInstance(lifecycleIdx.get(tradeId))) break;
        state = applyFxTradeExecuted(state, e);
        break;
      }
      case "FxPositionRevalued": {
        const p = e.payload as Record<string, unknown>;
        if (typeof p.tradeId === "string" && isCancelledInstance(lifecycleIdx.get(p.tradeId)))
          break;
        state = applyFxPositionRevalued(state, e);
        break;
      }
      case "TradeMatured": {
        const p = e.payload as Record<string, unknown>;
        if (typeof p.tradeId === "string" && isCancelledInstance(lifecycleIdx.get(p.tradeId)))
          break;
        state = applyTradeMatured(state, e);
        break;
      }
    }
  }
  return state;
}

export const fxSubLedgerProjection: Projection<SubLedgerState, FxSubLedgerEvent> = {
  name: "markets.fx-sub-ledger",
  initial: subLedgerInitial,
  accepts: (e): e is FxSubLedgerEvent => isFxSubLedgerEvent(e),
  reduce(state, event) {
    switch (event.type) {
      case "FxTradeCancelled":
        // Single-event reduce cannot perform two-pass cancellation filtering.
        // Use buildFxSubLedger() for cancellation-aware projection.
        // This case is included so the accepts() guard lets the event through
        // without a TypeScript exhaustive-check error.
        return state;
      case "FxTradeExecuted":
        return applyFxTradeExecuted(state, event);
      case "FxPositionRevalued":
        return applyFxPositionRevalued(state, event);
      case "TradeMatured":
        return applyTradeMatured(state, event);
    }
  },
};
