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

import type { OfficialMarkAdoptedPayload } from "../../event-store/event-types/valuation";
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
// Cross-pair ZAR cost-basis imputation (D-FX-CROSS-PAIR-CASH-COST-BASIS)
// ---------------------------------------------------------------------------

/** One day-stamped CCY/ZAR rate (ZAR per 1 FCY) for cost-basis imputation. */
interface DatedRate {
  readonly day: string; // YYYY-MM-DD
  readonly rate: number; // ZAR per 1 FCY
}

const dayOf = (iso: string): string => iso.slice(0, 10);

/**
 * Fold OfficialMarkAdopted fx-rate marks into a `${ccy}` → ascending [{day,rate}]
 * map (ZAR per 1 FCY), deriving either direction (CCY/ZAR direct, ZAR/CCY
 * inverted). Used ONLY to impute a ZAR cost basis for cross-pair FX legs that
 * carry no ZAR settlement leg — a ZAR-pair leg still takes its cost from the
 * trade's own ZAR consideration, never a mark.
 */
function foldFxMarksByDate(store: EventStore, bound: { asOf?: string }): Map<string, DatedRate[]> {
  const byCcy = new Map<string, DatedRate[]>();
  const push = (ccy: string, day: string, rate: number) => {
    const arr = byCcy.get(ccy) ?? [];
    arr.push({ day, rate });
    byCcy.set(ccy, arr);
  };
  for (const e of store.replay({ type: "OfficialMarkAdopted", ...bound })) {
    const p = e.payload as unknown as OfficialMarkAdoptedPayload;
    if (p.markType !== "fx-rate") continue;
    const value = Number(p.mark);
    if (!Number.isFinite(value) || value <= 0) continue;
    const day = dayOf(p.markAsOf ?? "");
    if (!day) continue;
    const [base, quote] = p.instrumentKey.split("/");
    if (quote === REPORTING_CURRENCY && base) push(base, day, value);
    else if (base === REPORTING_CURRENCY && quote) push(quote, day, 1 / value);
  }
  for (const arr of byCcy.values()) arr.sort((a, b) => (a.day < b.day ? -1 : 1));
  return byCcy;
}

/**
 * The CCY/ZAR rate to use as a cross-pair leg's cost basis: the latest mark on
 * or before the leg's settlement day; failing that (settlement predates the
 * first mark) the earliest available mark. Returns undefined only when the
 * currency has NO mark at all — then the leg is skipped (no silent fabrication).
 */
function imputedCostRate(
  marksByCcy: Map<string, DatedRate[]>,
  ccy: string,
  settlementDay: string,
): number | undefined {
  const arr = marksByCcy.get(ccy);
  if (!arr || arr.length === 0) return undefined;
  let chosen: number | undefined;
  for (const { day, rate } of arr) {
    if (day <= settlementDay) chosen = rate;
    else break;
  }
  return chosen ?? arr[0]?.rate;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Reconstruct every desk's settled FX cash position by folding PrincipalPayment
 * legs (joined to FxTradeExecuted for book/entity) in settlement order, with
 * weighted-average ZAR cost and close-out realised P&L. Pure read — no appends.
 */
export function computeCurrencyPositions(
  store: EventStore,
  asOfBound?: string,
): CurrencyPositionResult {
  // Point-in-time replay bound: when supplied, every replay below is restricted
  // to events at or before `asOfBound` (ISO 8601, inclusive on `event.as_of`),
  // yielding the cash inventory as it stood at that instant. Omitted ⟹ unbounded
  // (current full history). The daily-pnl / P&L-attribution engines pass an
  // end-of-day bound so two genuinely-distinct snapshots produce a real
  // day-over-day move (mirrors computeDailyPnL's asOfBound).
  const bound = asOfBound !== undefined ? { asOf: asOfBound } : {};
  // Day-stamped CCY/ZAR marks for cross-pair cost-basis imputation only
  // (D-FX-CROSS-PAIR-CASH-COST-BASIS). ZAR-pair legs ignore this.
  const marksByCcy = foldFxMarksByDate(store, bound);
  // 1. Cancelled trades — voided from the cash inventory. Canonical
  //    registry-driven resolver (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE) —
  //    only cancellations are excluded; settled FX legs KEEP their currency
  //    position (the bank still holds the cash), so this uses isCancelledInstance,
  //    not isLiveInstance.
  const lifecycleIdx = resolveTradeLifecycle([
    ...store.replay({ type: "FxTradeExecuted", ...bound }),
    ...store.replay({ type: "FxTradeCancelled", ...bound }),
  ]);

  // 2. Trade metadata (bookId, entity, pair) keyed by tradeId.
  const tradeMeta = new Map<string, TradeMeta>();
  for (const e of store.replay({ type: "FxTradeExecuted", ...bound })) {
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
  for (const e of store.replay({ type: "PrincipalPayment", ...bound })) {
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

  // Apply one currency cash movement (signed FCY minor at a ZAR cost rate) to
  // its per-(entity,book,ccy) running position — weighted-average on acquisition,
  // crystallised realised P&L on close-out. Shared by ZAR-pair and cross-pair legs.
  const applyMovement = (
    meta: TradeMeta,
    tradeId: string,
    currency: string,
    fcyDelta: number,
    costRate: number,
    settlementDate: string,
  ): void => {
    const key = `${meta.entity}::${meta.bookId}::${currency}`;
    const row =
      rows.get(key) ??
      ({
        entity: meta.entity,
        bookId: meta.bookId,
        currency,
        instrumentId: cashInstrumentId(currency, meta.bookId),
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
          ? costRate
          : (prevAvg * Math.abs(prevQty) + costRate * Math.abs(fcyDelta)) / denom;
      row.quantity = prevQty + fcyDelta;
    } else {
      // Opposite side — close out against the existing position.
      const closedAmount = Math.min(Math.abs(prevQty), Math.abs(fcyDelta));
      // realised = (disposalRate − avgCost) × closed × sign(prevQty):
      //   long  (prevQty>0) disposed: gain when sold above cost
      //   short (prevQty<0) bought back: gain when covered below cost
      const realised = Math.round((costRate - prevAvg) * closedAmount * Math.sign(prevQty));
      row.realisedCumulative += realised;
      realisations.push({
        instrumentId: row.instrumentId,
        entity: row.entity,
        bookId: row.bookId,
        currency: row.currency,
        amountClosedMinor: closedAmount,
        avgCostZarRate: prevAvg,
        disposalCostZarRate: costRate,
        realisedPnlZarMinor: realised,
        sourceTradeId: tradeId,
        recognisedAt: settlementDate,
      });

      const newQty = prevQty + fcyDelta;
      if (Math.sign(newQty) === Math.sign(prevQty) || newQty === 0) {
        // Partial or exact close — surviving slice keeps its average; flat → 0.
        row.quantity = newQty;
        row.avgCost = newQty === 0 ? 0 : prevAvg;
      } else {
        // Reversal past flat — residual opens a fresh position at the trade rate.
        row.quantity = newQty;
        row.avgCost = costRate;
      }
    }

    row.eventCount += 1;
    rows.set(key, row);
  };

  for (const tradeId of settledTradeIds) {
    const meta = tradeMeta.get(tradeId);
    const legs = legsByTrade.get(tradeId);
    if (!meta || !legs || legs.length === 0) continue;

    const fcyLegs = legs.filter((l) => l.currency !== REPORTING_CURRENCY && l.netCash !== 0);
    if (fcyLegs.length === 0) continue; // ZAR/ZAR or nil-cash — nothing to revalue.
    const zarLeg = legs.find((l) => l.currency === REPORTING_CURRENCY);

    if (zarLeg) {
      // ZAR pair (one ZAR leg + one FCY leg): the FCY leg's cost basis is the
      // ACTUAL ZAR consideration exchanged ÷ the FCY exchanged. Robust to any
      // settlement-rate quirk — no mark involved.
      const zarAmountMinor = Math.abs(zarLeg.netCash);
      for (const fcy of fcyLegs) {
        applyMovement(
          meta,
          tradeId,
          fcy.currency,
          fcy.netCash,
          zarAmountMinor / Math.abs(fcy.netCash),
          fcy.settlementDate,
        );
      }
    } else {
      // Cross pair (no ZAR leg): impute each FCY leg's ZAR cost from the CCY/ZAR
      // official mark at the leg's settlement day (D-FX-CROSS-PAIR-CASH-COST-BASIS,
      // CEO-approved 2026-06-03). Both monetary balances are retranslated daily
      // thereafter (IAS 21 §28). A currency with NO mark at all is skipped (no
      // silent fabrication); the trade is fully skipped only if NEITHER leg prices.
      let pricedAny = false;
      for (const fcy of fcyLegs) {
        const costRate = imputedCostRate(marksByCcy, fcy.currency, dayOf(fcy.settlementDate));
        if (costRate === undefined) {
          skipped.push({
            tradeId,
            reason: `cross pair ${meta.base}/${meta.quote}: no ${fcy.currency}/ZAR official mark to impute a ZAR cost basis for the ${fcy.currency} leg`,
          });
          continue;
        }
        pricedAny = true;
        applyMovement(meta, tradeId, fcy.currency, fcy.netCash, costRate, fcy.settlementDate);
      }
      if (!pricedAny) continue;
    }
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
