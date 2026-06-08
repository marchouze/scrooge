// platform/product-control/daily-pnl.ts
//
// Product Control daily FX P&L engine.
//
// Algorithm:
//   1. Replay FxTradeExecuted — all trades ever booked.
//   2. Replay TradeMatured — settled (closed) trade IDs.
//   3. Replay FxPositionRevalued — latest unrealised P&L per trade.
//   4. Replay TradeMatured for realised P&L amounts.
//   5. Aggregate by currency pair, counterparty, and book.
//   6. Return a DailyPnLReportGeneratedPayload (caller appends the event).
//
// Cancelled positions: if FxTradeCancelled events exist in the store
// (parallel PR — may or may not be present), they are treated as
// cancellations and excluded from the P&L total.
//
// Idempotency: the caller decides whether to append; re-calling
// computeDailyPnL is a pure read — no side effects.
//
// Authority:
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { newEventId, nowUtc } from "../core/types";
import type { FxPositionRevaluedPayload } from "../event-store/event-types/fx-accounting";
import { makeDailyPnLReportGenerated } from "../event-store/event-types/product-control";
import type {
  DailyPnLReportGeneratedPayload,
  PnLByBook,
  PnLByCounterparty,
  PnLByCurrency,
} from "../event-store/event-types/product-control";
import type { TradeMaturedFxSpotPayload } from "../event-store/event-types/trade-matured";
import type { EventStore } from "../event-store/store";
import { isCancelledInstance, resolveTradeLifecycle } from "../lifecycle/trade-lifecycle-state";
import type { SettlementRealisedPnlCorrectedPayload } from "../markets/cdm/fx";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { type FinancialInput, absent, isPresent, present } from "../types/financial-input";
import { computeDeskCashPositions } from "./desk-cash-positions";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Per-trade detail row returned by the API (not stored in the event). */
export interface TradeDetailRow {
  tradeId: string;
  pair: string;
  /** FX product taxonomy — Spot / Forward / Swap / NDF (all folded by this engine). */
  productTaxonomy: "FX-spot" | "FX-forward" | "FX-swap" | "NDF";
  side: string;
  counterpartyId: string;
  counterpartyName: string;
  bookId: string;
  bookRate: number;
  revalRate: number | null;
  /** Latest unrealised P&L delta in ZAR minor units (from FxPositionRevalued). */
  unrealisedPnlZarMinor: number;
  /** Realised P&L in ZAR minor units (from TradeMatured). 0 if open. */
  realisedPnlZarMinor: number;
  status: "live" | "settled" | "cancelled";
  /** Data quality of the unrealised P&L mark. */
  markStatus: "live" | "stale" | "overnight" | "unavailable";
  /** ISO YYYY-MM-DD trade date. */
  tradeDate: string;
  /** ISO YYYY-MM-DD settlement date (near leg). */
  settleDate: string;
  /** ISO 4217 base currency of the pair. */
  baseCurrency: string;
  /** ISO 4217 quote currency of the pair. */
  quoteCurrency: string;
  /** Base-currency notional in minor units. */
  notionalBaseMinor: number;
  /** Quote-currency notional in minor units. */
  notionalQuoteMinor: number;
}

export interface DailyPnLResult {
  payload: DailyPnLReportGeneratedPayload;
  trades: TradeDetailRow[];
  marksUnavailableCount: number;
  /**
   * The headline unrealised P&L as a `FinancialInput` (no-silent-zero
   * primitive). `present` when every live position was markable; `absent`
   * (degraded) when ≥1 live position had no usable mark — the partial sum is
   * still carried on the payload, but this wrapper forces a consumer to handle
   * the incompleteness rather than read the number as complete.
   * Authority: D-TRUSTED-FIGURES-PROGRAM-V1.
   */
  totalUnrealised: FinancialInput<number>;
}

/** Why each unmarkable live position lacks a mark. */
export interface MarksUnavailableBreakdown {
  /** Total unmarkable live positions (=== `marksUnavailableCount`). */
  count: number;
  /**
   * Positions whose pair HAS a production market-data tick — they are simply
   * awaiting revaluation (e.g. booked since the last MTM run, or before the
   * inline booking-time reval landed). NOT a feed gap.
   */
  awaitingReval: { count: number; tradeIds: string[]; pairs: string[] };
  /**
   * Positions whose pair has NO production tick at all — a genuine market-data
   * feed gap. These are the only ones for which "MTM feed required" is true.
   */
  feedMissing: { count: number; tradeIds: string[]; pairs: string[] };
}

/**
 * Split unmarkable live positions into "awaiting revaluation" (a mark exists,
 * just not yet revalued) vs "feed missing" (no production tick for the pair),
 * so the dashboard can state an honest cause instead of always asserting
 * "MTM feed required". `hasProductionMark` probes the MarketDataStore for the
 * pair (direction-aware) and is injected so this stays a pure, testable
 * function. A trade whose pair cannot be resolved from `trades` is treated
 * conservatively as feed-missing.
 */
export function classifyUnmarkable(
  unmarkableLiveTradeIds: string[],
  trades: TradeDetailRow[],
  hasProductionMark: (pair: string) => boolean,
): MarksUnavailableBreakdown {
  const pairByTrade = new Map(trades.map((t) => [t.tradeId, t.pair]));
  const awaitingTradeIds: string[] = [];
  const awaitingPairs = new Set<string>();
  const feedTradeIds: string[] = [];
  const feedPairs = new Set<string>();
  for (const id of unmarkableLiveTradeIds) {
    const pair = pairByTrade.get(id);
    if (pair !== undefined && hasProductionMark(pair)) {
      awaitingTradeIds.push(id);
      awaitingPairs.add(pair);
    } else {
      feedTradeIds.push(id);
      if (pair !== undefined) feedPairs.add(pair);
    }
  }
  return {
    count: unmarkableLiveTradeIds.length,
    awaitingReval: {
      count: awaitingTradeIds.length,
      tradeIds: awaitingTradeIds,
      pairs: [...awaitingPairs].sort(),
    },
    feedMissing: {
      count: feedTradeIds.length,
      tradeIds: feedTradeIds,
      pairs: [...feedPairs].sort(),
    },
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveMarkStatus(
  reval: FxPositionRevaluedPayload | undefined,
): "live" | "stale" | "overnight" | "unavailable" {
  if (!reval) return "unavailable";
  if (reval.rateSource.startsWith("stale-mark:")) return "stale";
  if (reval.rateSource.startsWith("overnight-close:")) return "overnight";
  return "live";
}

const DESK_ID = "FX-SPOT";
const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const ENGINE_ACTOR = {
  type: "service" as const,
  id: "agent:product-control-engine",
};
const CITATIONS = ["D-FX-SALES-TRADING-FRONTEND", "IFRS-9-§5.7.1", "D-MARKETS-SCHEMA-FOUNDATION"];

/**
 * Compute the daily P&L report for `reportDate` (YYYY-MM-DD).
 *
 * Pure read — no appends. The caller decides whether to persist.
 *
 * `asOfBound` (optional, ISO 8601 inclusive upper bound on `event.as_of`):
 * when supplied, every event replay is bounded to events at or before that
 * instant, yielding a point-in-time P&L *as of* that moment. The P&L
 * Attribution engine uses this to take two genuinely-distinct snapshots
 * (end-of-prior-day and end-of-report-day) so the day-over-day move is real
 * rather than two reads of the same full history. Omitted ⟹ unbounded (the
 * current full-history total), preserving the original single-arg behaviour.
 */
export function computeDailyPnL(
  store: EventStore,
  reportDate: string,
  asOfBound?: string,
): DailyPnLResult {
  // Replay filter shared by every fold below — bounds the universe to events
  // at or before `asOfBound` when supplied (point-in-time), else unbounded.
  const bound = asOfBound !== undefined ? { asOf: asOfBound } : {};
  // -------------------------------------------------------------------------
  // 1. Collect cancelled trade IDs (graceful — event may not exist yet).
  // -------------------------------------------------------------------------
  // Canonical registry-driven resolver (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE):
  // cancellation classification keyed off TRADE_LIFECYCLE_REGISTRY.
  const cancelledIds = new Set<string>();
  try {
    const lifecycleIdx = resolveTradeLifecycle([
      ...store.replay({ type: "FxTradeExecuted", ...bound }),
      ...store.replay({ type: "FxTradeCancelled", ...bound }),
    ]);
    for (const [id, status] of lifecycleIdx) {
      if (isCancelledInstance(status)) cancelledIds.add(id);
    }
  } catch {
    // FxTradeCancelled not registered — silently continue.
  }

  // -------------------------------------------------------------------------
  // 2. Collect all FX trades.
  // -------------------------------------------------------------------------
  const tradeMap = new Map<string, FxTradeExecutedPayload>();
  for (const e of store.replay({ type: "FxTradeExecuted", ...bound })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    const tradeId = p.tradeId.value;
    tradeMap.set(tradeId, p);
  }

  // -------------------------------------------------------------------------
  // 3. Collect settled trade IDs and realised P&L.
  //
  // Settled-trade detection folds two event types:
  //   - Accounting `TradeMatured` (DEPRECATED 2026-05-20; kept for
  //     back-compat with legacy tests). Carries `realisedPnlZarMinor`.
  //   - CDM `SettlementConfirmed` (2026-05-20 GL-significant under
  //     PR-FX-LIFECYCLE-CLOSE). Carries `realisedPnlDelta` (ZAR minor).
  // -------------------------------------------------------------------------
  const settledIds = new Set<string>();
  const realisedByTrade = new Map<string, number>(); // tradeId → ZAR minor
  for (const e of store.replay({ type: "TradeMatured", ...bound })) {
    const p = e.payload as unknown as TradeMaturedFxSpotPayload;
    settledIds.add(p.tradeId);
    // Accumulate — a trade may have multiple legs settled.
    const existing = realisedByTrade.get(p.tradeId) ?? 0;
    realisedByTrade.set(p.tradeId, existing + p.realisedPnlZarMinor);
  }
  for (const e of store.replay({ type: "SettlementConfirmed", ...bound })) {
    const p = e.payload as { tradeId?: unknown; realisedPnlDelta?: unknown };
    if (typeof p.tradeId !== "string") continue;
    settledIds.add(p.tradeId);
    if (typeof p.realisedPnlDelta === "number") {
      const existing = realisedByTrade.get(p.tradeId) ?? 0;
      realisedByTrade.set(p.tradeId, existing + p.realisedPnlDelta);
    }
  }
  // Fold SettlementRealisedPnlCorrected — supersedes any zero/incorrect
  // realisedPnlDelta on the original SettlementConfirmed for the same trade.
  // The correction replaces (not adds to) the P&L already accumulated from
  // the original event: correction.realisedPnlZarMinor is the full correct
  // value, not an incremental delta.
  //
  // Authority: IAS 21 §28; PR-FX-LIFECYCLE-CLOSE; Principle 1 (events immutable,
  //   corrections via new event type).
  const correctedTradeIds = new Set<string>();
  try {
    for (const e of store.replay({ type: "SettlementRealisedPnlCorrected", ...bound })) {
      const p = e.payload as unknown as SettlementRealisedPnlCorrectedPayload;
      if (!p.tradeId) continue;
      // Apply only the latest correction per trade (last-write-wins in replay order).
      realisedByTrade.set(p.tradeId, p.realisedPnlZarMinor);
      correctedTradeIds.add(p.tradeId);
    }
  } catch {
    // SettlementRealisedPnlCorrected not yet registered — silently continue.
  }

  // -------------------------------------------------------------------------
  // 4. Collect latest unrealised P&L per trade (max revaluedAt).
  // -------------------------------------------------------------------------
  const latestRevalByTrade = new Map<string, FxPositionRevaluedPayload>();
  for (const e of store.replay({ type: "FxPositionRevalued", ...bound })) {
    const p = e.payload as unknown as FxPositionRevaluedPayload;
    if (cancelledIds.has(p.tradeId)) continue;
    const existing = latestRevalByTrade.get(p.tradeId);
    if (!existing || p.revaluedAt > existing.revaluedAt) {
      latestRevalByTrade.set(p.tradeId, p);
    }
  }

  // -------------------------------------------------------------------------
  // 5. Build per-trade detail rows.
  // -------------------------------------------------------------------------
  const trades: TradeDetailRow[] = [];
  const byCurrencyMap = new Map<string, { trades: number; unrealised: number; realised: number }>();
  const byCounterpartyMap = new Map<
    string,
    {
      name: string;
      trades: number;
      unrealised: number;
      realised: number;
    }
  >();
  const byBookMap = new Map<string, { trades: number; unrealised: number; realised: number }>();

  let totalUnrealised = 0;
  let totalRealised = 0;
  let activePositions = 0;
  let cancelledPositions = 0;
  let marksUnavailableCount = 0;
  // Live positions that could not be marked. These are NOT folded into
  // `totalUnrealised` as a silent 0 — they are excluded and counted so the
  // aggregate can declare itself incomplete (no-silent-zero).
  const unmarkableLiveTradeIds: string[] = [];

  for (const [tradeId, trade] of tradeMap) {
    // Per-trade `pair` retains the booked direction (for trader-audit
    // visibility in the trades grid). byCurrency keying is by ISO 4217 code,
    // not pair direction — direction-stable by construction.
    const pair = `${trade.currencyPair.base}/${trade.currencyPair.quote}`;
    const baseCcy = trade.currencyPair.base;
    const quoteCcy = trade.currencyPair.quote;

    const cid = trade.counterparty.partyId;
    const cname = trade.counterparty.name ?? cid;
    const bookId = trade.bookId;
    const reval = latestRevalByTrade.get(tradeId);
    const realised = realisedByTrade.get(tradeId) ?? 0;
    const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
    const bookRate = nearLeg?.rate.amount ?? 0;
    const revalRate = reval?.revalRate ?? null;

    // Trade economics fields (for trade detail modal)
    const tradeDate = trade.tradeDate?.iso ?? "";
    const settleDate = nearLeg?.settlementDate?.iso ?? "";
    const notionalBaseMinor = (() => {
      if (!nearLeg) return 0;
      if (nearLeg.notional.currency === baseCcy) return nearLeg.notional.amountMinor;
      if (nearLeg.counterNotional && nearLeg.counterNotional.currency === baseCcy)
        return nearLeg.counterNotional.amountMinor;
      return nearLeg.notional.amountMinor;
    })();
    const notionalQuoteMinor = (() => {
      if (!nearLeg) return 0;
      if (nearLeg.notional.currency === quoteCcy) return nearLeg.notional.amountMinor;
      if (nearLeg.counterNotional && nearLeg.counterNotional.currency === quoteCcy)
        return nearLeg.counterNotional.amountMinor;
      return nearLeg.counterNotional?.amountMinor ?? 0;
    })();

    // Determine status first, then derive the mark quality. The unrealised P&L
    // is read from the reval ONLY when a mark exists; a missing mark on a LIVE
    // position is NOT coerced to a silent 0 — it is excluded from the aggregate
    // and counted, so the headline figure can declare itself incomplete
    // (Trusted-Figures no-silent-zero; D-TRUSTED-FIGURES-PROGRAM-V1).
    let status: "live" | "settled" | "cancelled";
    if (cancelledIds.has(tradeId)) {
      status = "cancelled";
      cancelledPositions++;
    } else if (settledIds.has(tradeId)) {
      status = "settled";
    } else {
      status = "live";
      activePositions++;
    }

    const markStatus = status === "cancelled" ? ("unavailable" as const) : deriveMarkStatus(reval);
    const liveUnmarkable = status === "live" && markStatus === "unavailable";
    if (liveUnmarkable) {
      marksUnavailableCount++;
      unmarkableLiveTradeIds.push(tradeId);
    }

    // Fold realised for every non-cancelled position.
    if (status === "settled" || status === "live") {
      totalRealised += realised;
    }
    // Fold unrealised ONLY for a markable live position. A live position with
    // no usable mark contributes NOTHING here (not a 0) — it is tracked in
    // `unmarkableLiveTradeIds` and surfaced as a data failure instead.
    if (status === "live" && !liveUnmarkable && reval) {
      totalUnrealised += reval.unrealisedPnlZarMinor;
    }

    // Unrealised P&L is only carried by markable live positions. Settled trades
    // have crystallised their P&L into realised (a stale FxPositionRevalued may
    // still sit in the log if the daily MTM ran before settlement was
    // recorded), and cancelled trades carry none. Unmarkable live positions
    // report 0 in the per-row unrealised column but are flagged
    // markStatus:"unavailable" — the badge, not the number, is the signal.
    // Zeroing here keeps the per-trade rows and the by-currency/counterparty/book
    // breakdowns reconciled with the top-level totalUnrealised, which excludes
    // both non-live AND unmarkable-live positions.
    const unrealisedForReporting =
      status === "live" && !liveUnmarkable && reval ? reval.unrealisedPnlZarMinor : 0;

    trades.push({
      tradeId,
      pair,
      productTaxonomy: trade.productTaxonomy,
      side: trade.side,
      counterpartyId: cid,
      counterpartyName: cname,
      bookId,
      bookRate,
      revalRate,
      unrealisedPnlZarMinor: unrealisedForReporting,
      realisedPnlZarMinor: status === "cancelled" ? 0 : realised,
      status,
      markStatus,
      tradeDate,
      settleDate,
      baseCurrency: baseCcy,
      quoteCurrency: quoteCcy,
      notionalBaseMinor,
      notionalQuoteMinor,
    });

    if (status !== "cancelled") {
      // -----------------------------------------------------------------------
      // Aggregate by currency (per-currency ZAR MTM).
      // Each non-ZAR currency in the trade gets its own bucket.
      // Authority: IAS-21-§28, CEO instruction 2026-05-31.
      // -----------------------------------------------------------------------

      // Determine per-currency unrealised P&L split.
      // If the reval event has zarRateBase/zarRateQuote, split accurately.
      // Fallback for legacy events: attribute full unrealised to base only.
      const hasPerCcyRates = reval?.zarRateBase !== undefined && reval?.zarRateQuote !== undefined;

      const baseUnrealised = (() => {
        if (!hasPerCcyRates || !reval) return unrealisedForReporting;
        // With per-currency rates: base contribution = full P&L minus quote contribution.
        // The quote leg contribution is encoded in unrealisedPnlZarMinor as the net,
        // so we reconstruct the split from the zarRate fields.
        // For ZAR-quoted pairs (zarRateQuote = 0), all P&L is on the base leg.
        if (reval.zarRateQuote === 0) return unrealisedForReporting;
        // For cross pairs: attribute pro-rata by notional ratio (base : quote).
        // Approximation: base/(base+quote) of total (direction-signed).
        const total = notionalBaseMinor + notionalQuoteMinor;
        if (total === 0) return unrealisedForReporting;
        return Math.round((unrealisedForReporting * notionalBaseMinor) / total);
      })();

      const quoteUnrealised = (() => {
        if (!hasPerCcyRates || !reval || reval.zarRateQuote === 0) return 0;
        return unrealisedForReporting - baseUnrealised;
      })();

      // For realised: bucket under receive currency.
      // BUY = receive base; SELL = receive quote.
      const realisedBaseCcy = trade.side === "buy" ? realised : 0;
      const realisedQuoteCcy = trade.side === "sell" ? realised : 0;

      // Base currency bucket (always non-ZAR for cross pairs; skip if base IS ZAR).
      if (baseCcy !== "ZAR") {
        const bRow = byCurrencyMap.get(baseCcy) ?? { trades: 0, unrealised: 0, realised: 0 };
        bRow.trades++;
        bRow.unrealised += baseUnrealised;
        bRow.realised += realisedBaseCcy;
        byCurrencyMap.set(baseCcy, bRow);
      }

      // Quote currency bucket (skip if quote IS ZAR — it's the reporting currency).
      if (quoteCcy !== "ZAR") {
        const qRow = byCurrencyMap.get(quoteCcy) ?? { trades: 0, unrealised: 0, realised: 0 };
        qRow.trades++;
        qRow.unrealised += quoteUnrealised;
        qRow.realised += realisedQuoteCcy;
        byCurrencyMap.set(quoteCcy, qRow);
      }

      // Aggregate by counterparty.
      const cpRow = byCounterpartyMap.get(cid) ?? {
        name: cname,
        trades: 0,
        unrealised: 0,
        realised: 0,
      };
      cpRow.trades++;
      cpRow.unrealised += unrealisedForReporting;
      cpRow.realised += realised;
      byCounterpartyMap.set(cid, cpRow);

      // Aggregate by book.
      const bookRow = byBookMap.get(bookId) ?? { trades: 0, unrealised: 0, realised: 0 };
      bookRow.trades++;
      bookRow.unrealised += unrealisedForReporting;
      bookRow.realised += realised;
      byBookMap.set(bookId, bookRow);
    }
  }

  // -------------------------------------------------------------------------
  // 5b. Fold the desk FX cash-instrument valuation — BOTH unrealised (mark-to-
  // market against ZAR) AND realised (crystallised close-outs).
  //
  // When an FX trade SETTLES it drops out of the live-reval universe above, but
  // the bank still holds the resulting foreign-currency cash. That settled cash
  // balance IS a financial instrument (fi:csh:<CCY>:<book>, CEO 2026-05-31): it
  // is retranslated at the closing ZAR rate each day (IAS 21 §28) and its
  // close-outs crystallise realised P&L. Without this fold the moment a trade
  // settled its P&L vanished from the headline (the "valuation disappeared"
  // regression, Marc 2026-06-03).
  //
  // This is the CANONICAL desk-cash P&L source (single graph, Principle 2) and
  // SUPERSEDES the prior RealisedPnlRecognised-event fold — that event was a
  // derived re-emission of these same currency-position close-outs and depended
  // on an agent run to exist, so realised silently read 0 whenever the MTM agent
  // was idle. Reading the projection directly removes that dependency and the
  // double-count risk.
  //
  // No-silent-zero: an unmarkable cash position (no production CCY/ZAR mark) is
  // EXCLUDED from the unrealised total (never folded as 0) and tracked in
  // `cashUnmarkableKeys`, mirroring `unmarkableLiveTradeIds`.
  //
  // Authority: IAS 21 §23/§28; IFRS 9 §5.7.1; D-FINANCIAL-INSTRUMENT-ENTITY;
  //   CEO 2026-05-31; CEO 2026-06-03.
  // -------------------------------------------------------------------------
  const deskCash = computeDeskCashPositions(store, asOfBound);
  const cashUnmarkableKeys: string[] = [...deskCash.unmarkableKeys];
  for (const cp of deskCash.positions) {
    const markable = isPresent(cp.unrealisedPnlZarMinor);
    const cashUnrealised = markable ? cp.unrealisedPnlZarMinor.value : 0;
    const cashRealised = cp.realisedZarMinorCumulative;

    if (markable) totalUnrealised += cashUnrealised;
    totalRealised += cashRealised;

    // Breakdowns stay reconciled with the headline (by currency + by book).
    if (cp.currency !== "ZAR") {
      const cr = byCurrencyMap.get(cp.currency) ?? { trades: 0, unrealised: 0, realised: 0 };
      if (markable) cr.unrealised += cashUnrealised;
      cr.realised += cashRealised;
      byCurrencyMap.set(cp.currency, cr);
    }
    const br = byBookMap.get(cp.bookId) ?? { trades: 0, unrealised: 0, realised: 0 };
    if (markable) br.unrealised += cashUnrealised;
    br.realised += cashRealised;
    byBookMap.set(cp.bookId, br);
  }

  // -------------------------------------------------------------------------
  // 6. Build aggregation arrays.
  // -------------------------------------------------------------------------
  const byCurrency: PnLByCurrency[] = [...byCurrencyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, v]) => ({
      currency,
      tradeCount: v.trades,
      unrealisedPnlZarMinor: v.unrealised,
      realisedPnlZarMinor: v.realised,
    }));

  const byCounterparty: PnLByCounterparty[] = [...byCounterpartyMap.entries()].map(
    ([counterpartyId, v]) => ({
      counterpartyId,
      counterpartyName: v.name,
      tradeCount: v.trades,
      unrealisedPnlZarMinor: v.unrealised,
      realisedPnlZarMinor: v.realised,
    }),
  );

  const byBook: PnLByBook[] = [...byBookMap.entries()].map(([bookId, v]) => ({
    bookId,
    tradeCount: v.trades,
    unrealisedPnlZarMinor: v.unrealised,
    realisedPnlZarMinor: v.realised,
  }));

  const generatedAt = nowUtc();
  const reportId = `pnl:${reportDate}:${newEventId().slice(0, 8)}`;

  // The headline unrealised is complete only when BOTH every live FX position
  // AND every desk-cash instrument was markable. The unmarkable ledger unions
  // FX live-trade ids with desk-cash instrument ids (no-silent-zero).
  const allUnmarkable = [...unmarkableLiveTradeIds, ...cashUnmarkableKeys];
  const unrealisedComplete = allUnmarkable.length === 0;

  const payload: DailyPnLReportGeneratedPayload = {
    reportId,
    reportDate,
    deskId: DESK_ID,
    totalUnrealisedPnlZarMinor: totalUnrealised,
    unrealisedComplete,
    unmarkableLivePositions: allUnmarkable.length,
    unmarkableLiveTradeIds: allUnmarkable,
    totalRealisedPnlZarMinor: totalRealised,
    totalPnlZarMinor: totalUnrealised + totalRealised,
    activePositions,
    cancelledPositions,
    byCurrency,
    byCounterparty,
    byBook,
    generatedAt,
    generatedBy: ENGINE_ACTOR.id,
  };

  // The headline unrealised P&L as a no-silent-zero FinancialInput: present
  // (complete) when every live position was markable; absent (degraded) when
  // ≥1 live position had no usable mark, so a consumer cannot read the partial
  // sum as a complete figure. The partial sum stays on the payload for display
  // alongside the incompleteness signal.
  const totalUnrealisedInput: FinancialInput<number> = unrealisedComplete
    ? present(
        totalUnrealised,
        "product-control/daily-pnl: FxPositionRevalued per live position + desk FX cash mark (IAS 21 §28)",
      )
    : absent(
        `${allUnmarkable.length} position(s) had no usable mark — unrealised P&L is incomplete (excludes ${allUnmarkable.join(", ")})`,
        "FxPositionRevalued (live FX) + OfficialMarkAdopted CCY/ZAR (desk cash) for every position",
      );

  return {
    payload,
    trades,
    marksUnavailableCount,
    totalUnrealised: totalUnrealisedInput,
  };
}

/**
 * Run the daily P&L report: compute and append the event.
 * Idempotent in the sense that every call appends a fresh report
 * (history is preserved for trend analysis). The API returns only
 * the most recent report.
 */
export function runDailyPnLReport(store: EventStore, clockNow: () => string): void {
  const reportDate = clockNow().slice(0, 10);
  const { payload } = computeDailyPnL(store, reportDate);
  store.append(
    makeDailyPnLReportGenerated({
      asOf: reportDate,
      entity: BANK_ENTITY,
      actor: ENGINE_ACTOR,
      citations: CITATIONS,
      payload,
    }),
  );
}
