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
  PnLByPair,
} from "../event-store/event-types/product-control";
import type { TradeMaturedFxSpotPayload } from "../event-store/event-types/trade-matured";
import type { EventStore } from "../event-store/store";
import { toCanonicalPair } from "../market-data/canonical-pair";
import type { SettlementRealisedPnlCorrectedPayload } from "../markets/cdm/fx";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Per-trade detail row returned by the API (not stored in the event). */
export interface TradeDetailRow {
  tradeId: string;
  pair: string;
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
}

export interface DailyPnLResult {
  payload: DailyPnLReportGeneratedPayload;
  trades: TradeDetailRow[];
  marksUnavailableCount: number;
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
 */
export function computeDailyPnL(store: EventStore, reportDate: string): DailyPnLResult {
  // -------------------------------------------------------------------------
  // 1. Collect cancelled trade IDs (graceful — event may not exist yet).
  // -------------------------------------------------------------------------
  const cancelledIds = new Set<string>();
  try {
    for (const e of store.replay({ type: "FxTradeCancelled" })) {
      const p = e.payload as { tradeId?: string | { value?: string } };
      const tid = p.tradeId;
      const idStr =
        typeof tid === "object" && tid !== null && "value" in tid
          ? (tid.value ?? "")
          : String(tid ?? "");
      if (idStr) cancelledIds.add(idStr);
    }
  } catch {
    // FxTradeCancelled not registered — silently continue.
  }

  // -------------------------------------------------------------------------
  // 2. Collect all FX trades.
  // -------------------------------------------------------------------------
  const tradeMap = new Map<string, FxTradeExecutedPayload>();
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
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
  for (const e of store.replay({ type: "TradeMatured" })) {
    const p = e.payload as unknown as TradeMaturedFxSpotPayload;
    settledIds.add(p.tradeId);
    // Accumulate — a trade may have multiple legs settled.
    const existing = realisedByTrade.get(p.tradeId) ?? 0;
    realisedByTrade.set(p.tradeId, existing + p.realisedPnlZarMinor);
  }
  for (const e of store.replay({ type: "SettlementConfirmed" })) {
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
    for (const e of store.replay({ type: "SettlementRealisedPnlCorrected" })) {
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
  for (const e of store.replay({ type: "FxPositionRevalued" })) {
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
  const byPairMap = new Map<string, { trades: number; unrealised: number; realised: number }>();
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

  for (const [tradeId, trade] of tradeMap) {
    // Per-trade `pair` retains the booked direction (for trader-audit
    // visibility in the trades grid). The aggregation key below uses the
    // **canonical** form so that "buy USD/ZAR" and "sell ZAR/USD" land in
    // the same bucket (Marc, 2026-05-21 — brief:bea:fx-pair-canonicalisation-
    // in-product-control-aggr:2026-05-21). P&L sums are in ZAR minor
    // (functional currency) and are sign-stable across pair-direction flips
    // because the per-trade P&L was already computed with the right sign
    // for the trade's booked side downstream — only the bucket *key* needs
    // canonicalisation; the numbers don't.
    const pair = `${trade.currencyPair.base}/${trade.currencyPair.quote}`;
    const canonicalPairKey = toCanonicalPair(
      trade.currencyPair.base,
      trade.currencyPair.quote,
    ).pairKey;
    const cid = trade.counterparty.partyId;
    const cname = trade.counterparty.name ?? cid;
    const bookId = trade.bookId;
    const reval = latestRevalByTrade.get(tradeId);
    const realised = realisedByTrade.get(tradeId) ?? 0;
    const unrealised = reval?.unrealisedPnlZarMinor ?? 0;
    const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
    const bookRate = nearLeg?.rate.amount ?? 0;
    const revalRate = reval?.revalRate ?? null;

    let status: "live" | "settled" | "cancelled";
    if (cancelledIds.has(tradeId)) {
      status = "cancelled";
      cancelledPositions++;
    } else if (settledIds.has(tradeId)) {
      status = "settled";
      // Settled positions contribute realised P&L but no unrealised.
      totalRealised += realised;
    } else {
      status = "live";
      activePositions++;
      totalUnrealised += unrealised;
      totalRealised += realised;
    }

    const markStatus = status === "cancelled" ? ("unavailable" as const) : deriveMarkStatus(reval);
    if (status === "live" && markStatus === "unavailable") {
      marksUnavailableCount++;
    }

    // Unrealised P&L is only carried by live positions. Settled trades have
    // crystallised their P&L into realised (a stale FxPositionRevalued may
    // still sit in the log if the daily MTM ran before settlement was
    // recorded), and cancelled trades carry none. Zeroing here keeps the
    // per-trade rows and the by-pair/counterparty/book breakdowns reconciled
    // with the top-level totalUnrealised, which already excludes non-live.
    const unrealisedForReporting = status === "live" ? unrealised : 0;

    trades.push({
      tradeId,
      pair,
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
    });

    if (status !== "cancelled") {
      // Aggregate by **canonical** pair so direct and inverse directions
      // share a single bucket. P&L is ZAR-functional and direction-stable.
      const pairRow = byPairMap.get(canonicalPairKey) ?? {
        trades: 0,
        unrealised: 0,
        realised: 0,
      };
      pairRow.trades++;
      pairRow.unrealised += unrealisedForReporting;
      pairRow.realised += realised;
      byPairMap.set(canonicalPairKey, pairRow);

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
  // 6. Build aggregation arrays.
  // -------------------------------------------------------------------------
  const byPair: PnLByPair[] = [...byPairMap.entries()].map(([pair, v]) => ({
    pair,
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

  const payload: DailyPnLReportGeneratedPayload = {
    reportId,
    reportDate,
    deskId: DESK_ID,
    totalUnrealisedPnlZarMinor: totalUnrealised,
    totalRealisedPnlZarMinor: totalRealised,
    totalPnlZarMinor: totalUnrealised + totalRealised,
    activePositions,
    cancelledPositions,
    byPair,
    byCounterparty,
    byBook,
    generatedAt,
    generatedBy: ENGINE_ACTOR.id,
  };

  return { payload, trades, marksUnavailableCount };
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
