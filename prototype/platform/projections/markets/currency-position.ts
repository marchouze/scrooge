// platform/projections/markets/currency-position.ts
//
// FX cash-inventory position — the desk's settled foreign-currency balance as
// a first-class financial instrument (ACTUS CSH; instrumentId
// `fi:csh:<CCY>:<bookId>`).
//
// THE MODEL (CEO instruction 2026-05-31): the foreign-currency asset/liability
// a desk accumulates from its settled FX trades IS a financial instrument. It
// is *added to* at the cost of the trade that increased it and *subtracted
// from* at the cost of the trade that decreased it (weighted-average cost),
// and the net instrument is *marked to market against ZAR* daily — exactly
// like any other position. This is NOT a separate management-accounting
// framework; it sits in the one citable instrument/position graph (Principle 2).
//
// Why this exists: the daily MTM run (rohan-daily-mtm) revalues only LIVE
// (unsettled) trades — the moment a trade settles it drops out of the reval
// universe and its resulting foreign cash becomes invisible to P&L. The nostro
// GL balance is a general-purpose account that does not reconcile to any one
// desk, so marking *it* to market is wrong. The desk owns the cash position;
// this module reconstructs it per (entity, book, currency) and the daily run
// marks it to ZAR.
//
// Cost basis = the ACTUAL ZAR consideration exchanged at settlement (the ZAR
// PrincipalPayment leg ÷ the FCY PrincipalPayment leg), weighted-averaged
// across acquisitions. Robust to the settlement-mark realised bug: total desk
// P&L (realised + unrealised) is correct regardless of any settlement rate.
//
// Realised P&L crystallises on CLOSE-OUT — an opening purchase of USD realises
// nothing (the desk holds USD); selling it back realises
// (disposalRate − avgCost) × amountClosed. Each close-out is surfaced as a
// `realisations` entry that the daily run emits as a RealisedPnlRecognised
// event (the canonical realised source, replacing the always-0
// SettlementConfirmed.realisedPnlDelta).
//
// Pure read — multi-pass replay, mirroring buildFxSubLedger / buildPositionSet.
//
// Authority:
//   - IAS 21 §23/§28 (monetary items retranslated at closing rate;
//     exchange differences on settlement → P&L)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - D-FINANCIAL-INSTRUMENT-ENTITY (CSH cash instrument / SecurityMaster)
//   - CEO instruction 2026-05-31 (FX cash as a financial instrument)
//
// Author: Bea (Accounting & financial reporting engineer, engineering),
//   with Rohan (Market risk engineer, engineering) — mark sourcing.

import type { EventStore } from "../../event-store/store";
import { isCancelledInstance, resolveTradeLifecycle } from "../../lifecycle/trade-lifecycle-state";
import type { FxTradeExecutedPayload, PrincipalPaymentPayload } from "../../markets/cdm/fx";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The reporting / functional currency. ZAR cash is not revalued against itself. */
export const REPORTING_CURRENCY = "ZAR";

/** A desk's net settled foreign-currency cash position (one per entity·book·ccy). */
export interface CurrencyPositionRow {
  readonly entity: string;
  readonly bookId: string;
  /** ISO 4217 foreign currency code (never ZAR). */
  readonly currency: string;
  /** SecurityMaster instrument id — `fi:csh:<CCY>:<bookId>`. */
  readonly instrumentId: string;
  /** Net FCY cash held, signed minor units (+long / −short). */
  readonly fcyQuantityMinor: number;
  /** Weighted-average ZAR acquisition cost (ZAR per 1 FCY). 0 when flat. */
  readonly avgCostZarRate: number;
  /** Cumulative realised P&L crystallised on close-outs, ZAR minor. */
  readonly realisedZarMinorCumulative: number;
  /** Settled trades folded into this row (audit aid). */
  readonly eventCount: number;
}

/** A single close-out crystallisation, to be emitted as RealisedPnlRecognised. */
export interface DeskCashRealisation {
  readonly instrumentId: string;
  readonly entity: string;
  readonly bookId: string;
  readonly currency: string;
  readonly amountClosedMinor: number;
  readonly avgCostZarRate: number;
  readonly disposalCostZarRate: number;
  readonly realisedPnlZarMinor: number;
  readonly sourceTradeId: string;
  readonly recognisedAt: string;
}

export interface CurrencyPositionResult {
  readonly rows: CurrencyPositionRow[];
  readonly realisations: DeskCashRealisation[];
  /** Trades excluded from the cash-inventory (e.g. crosses with no ZAR leg). */
  readonly skipped: { tradeId: string; reason: string }[];
}

/** Canonical CSH cash-instrument id for a (currency, book). */
export function cashInstrumentId(currency: string, bookId: string): string {
  return `fi:csh:${currency}:${bookId}`;
}

// ---------------------------------------------------------------------------
// Internal accumulation types
// ---------------------------------------------------------------------------

interface TradeMeta {
  readonly entity: string;
  readonly bookId: string;
  readonly base: string;
  readonly quote: string;
}

interface SettledLeg {
  readonly currency: string;
  readonly netCash: number;
  readonly settlementDate: string;
}

interface MutableRow {
  entity: string;
  bookId: string;
  currency: string;
  instrumentId: string;
  quantity: number;
  avgCost: number;
  realisedCumulative: number;
  eventCount: number;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Reconstruct every desk's settled FX cash position by folding PrincipalPayment
 * legs (joined to FxTradeExecuted for book/entity) in settlement order, with
 * weighted-average ZAR cost and close-out realised P&L. Pure read — no appends.
 */
export function computeCurrencyPositions(store: EventStore): CurrencyPositionResult {
  // 1. Cancelled trades — voided from the cash inventory. Canonical
  //    registry-driven resolver (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE) —
  //    only cancellations are excluded; settled FX legs KEEP their currency
  //    position (the bank still holds the cash), so this uses isCancelledInstance,
  //    not isLiveInstance.
  const lifecycleIdx = resolveTradeLifecycle([
    ...store.replay({ type: "FxTradeExecuted" }),
    ...store.replay({ type: "FxTradeCancelled" }),
  ]);

  // 2. Trade metadata (bookId, entity, pair) keyed by tradeId.
  const tradeMeta = new Map<string, TradeMeta>();
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    const id = p.tradeId.value;
    tradeMeta.set(id, {
      entity: e.entity,
      bookId: p.bookId,
      base: p.currencyPair.base,
      quote: p.currencyPair.quote,
    });
  }

  // 3. PrincipalPayment legs grouped by tradeId, in replay (settlement) order.
  const legsByTrade = new Map<string, SettledLeg[]>();
  const tradeOrder: string[] = []; // first-seen order = settlement order
  for (const e of store.replay({ type: "PrincipalPayment" })) {
    const p = e.payload as unknown as PrincipalPaymentPayload;
    if (!p.tradeId) continue;
    if (!legsByTrade.has(p.tradeId)) {
      legsByTrade.set(p.tradeId, []);
      tradeOrder.push(p.tradeId);
    }
    legsByTrade.get(p.tradeId)?.push({
      currency: p.currency,
      netCash: p.netCash,
      settlementDate: p.settlementDate,
    });
  }

  // 4. Order settled trades by settlement date, tie-break by first-seen order.
  const settledTradeIds = tradeOrder.filter((id) => !isCancelledInstance(lifecycleIdx.get(id)));
  settledTradeIds.sort((a, b) => {
    const da = legsByTrade.get(a)?.[0]?.settlementDate ?? "";
    const db = legsByTrade.get(b)?.[0]?.settlementDate ?? "";
    if (da !== db) return da < db ? -1 : 1;
    return tradeOrder.indexOf(a) - tradeOrder.indexOf(b);
  });

  const rows = new Map<string, MutableRow>();
  const realisations: DeskCashRealisation[] = [];
  const skipped: { tradeId: string; reason: string }[] = [];

  for (const tradeId of settledTradeIds) {
    const meta = tradeMeta.get(tradeId);
    const legs = legsByTrade.get(tradeId);
    if (!meta || !legs || legs.length === 0) continue;

    // A ZAR-quoted/based pair has exactly one ZAR leg + one FCY leg. Crosses
    // with no ZAR leg cannot derive a ZAR cost basis at settlement without a
    // historical CCY/ZAR rate — skip (no silent fabrication; documented gap).
    const zarLeg = legs.find((l) => l.currency === REPORTING_CURRENCY);
    const fcyLeg = legs.find((l) => l.currency !== REPORTING_CURRENCY);
    if (!fcyLeg) continue; // ZAR/ZAR — nothing to revalue.
    if (!zarLeg) {
      skipped.push({
        tradeId,
        reason: `cross pair ${meta.base}/${meta.quote} has no ZAR leg — cash-inventory ZAR cost basis requires a historical CCY/ZAR rate (substrate gap)`,
      });
      continue;
    }
    if (fcyLeg.netCash === 0) continue;

    const fcyDelta = fcyLeg.netCash; // signed FCY minor (+received / −delivered)
    const zarAmountMinor = Math.abs(zarLeg.netCash); // ZAR minor exchanged
    const tradeRate = zarAmountMinor / Math.abs(fcyDelta); // ZAR per FCY

    const key = `${meta.entity}::${meta.bookId}::${fcyLeg.currency}`;
    const row =
      rows.get(key) ??
      ({
        entity: meta.entity,
        bookId: meta.bookId,
        currency: fcyLeg.currency,
        instrumentId: cashInstrumentId(fcyLeg.currency, meta.bookId),
        quantity: 0,
        avgCost: 0,
        realisedCumulative: 0,
        eventCount: 0,
      } as MutableRow);

    const prevQty = row.quantity;
    const prevAvg = row.avgCost;
    const sameSide = prevQty === 0 || Math.sign(prevQty) === Math.sign(fcyDelta);

    if (sameSide) {
      // Acquiring (or growing) the position — roll the weighted average forward.
      const denom = Math.abs(prevQty) + Math.abs(fcyDelta);
      row.avgCost =
        denom === 0
          ? tradeRate
          : (prevAvg * Math.abs(prevQty) + tradeRate * Math.abs(fcyDelta)) / denom;
      row.quantity = prevQty + fcyDelta;
    } else {
      // Opposite side — close out against the existing position.
      const closedAmount = Math.min(Math.abs(prevQty), Math.abs(fcyDelta));
      // realised = (disposalRate − avgCost) × closed × sign(prevQty):
      //   long  (prevQty>0) disposed: gain when sold above cost
      //   short (prevQty<0) bought back: gain when covered below cost
      const realised = Math.round((tradeRate - prevAvg) * closedAmount * Math.sign(prevQty));
      row.realisedCumulative += realised;
      realisations.push({
        instrumentId: row.instrumentId,
        entity: row.entity,
        bookId: row.bookId,
        currency: row.currency,
        amountClosedMinor: closedAmount,
        avgCostZarRate: prevAvg,
        disposalCostZarRate: tradeRate,
        realisedPnlZarMinor: realised,
        sourceTradeId: tradeId,
        recognisedAt: fcyLeg.settlementDate,
      });

      const newQty = prevQty + fcyDelta;
      if (Math.sign(newQty) === Math.sign(prevQty) || newQty === 0) {
        // Partial or exact close — surviving slice keeps its average; flat → 0.
        row.quantity = newQty;
        row.avgCost = newQty === 0 ? 0 : prevAvg;
      } else {
        // Reversal past flat — residual opens a fresh position at the trade rate.
        row.quantity = newQty;
        row.avgCost = tradeRate;
      }
    }

    row.eventCount += 1;
    rows.set(key, row);
  }

  return {
    rows: [...rows.values()]
      .map((r) => ({
        entity: r.entity,
        bookId: r.bookId,
        currency: r.currency,
        instrumentId: r.instrumentId,
        fcyQuantityMinor: r.quantity,
        avgCostZarRate: r.avgCost,
        realisedZarMinorCumulative: r.realisedCumulative,
        eventCount: r.eventCount,
      }))
      .sort((a, b) => a.instrumentId.localeCompare(b.instrumentId)),
    realisations,
    skipped,
  };
}
