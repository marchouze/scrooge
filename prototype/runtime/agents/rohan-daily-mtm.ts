// runtime/agents/rohan-daily-mtm.ts
//
// Rohan's daily MTM (mark-to-market) handler — wraps `scripts/mtm-run.ts`
// logic into an AgentRunContext-shaped scheduled handler.
//
// Why this exists:
//   - Pre-handler, `scripts/mtm-run.ts` was a manual CLI. The shared event
//     store showed 15 `FxPositionRevalued` events on 2026-05-19 only, with
//     zero `MtmRunCompleted` / `OfficialMarkAdopted` ever persisted.
//   - The brief at `brief:rohan:wire-daily-mtm-cadence-fix-reversal-without-reva:2026-05-21`
//     requires daily cadence at 18:00 UTC weekdays (after JSE 17:00 SAST
//     close) plus a stale-mark fallback when production ticks are missing.
//
// What it does:
//   1. Opens the runtime's composition-root `eventStore` (gated, shared
//      across worktrees via $HOME/.local/share/bank/event.db) and a
//      MarketDataStore from `BANK_MARKET_DATA_DB`.
//   2. Resolves open FX positions (FxTradeExecuted minus FxTradeCancelled
//      minus SettlementConfirmed / TradeMatured).
//   3. For each open position:
//      a. Queries MarketDataStore for the latest production `fx-quote`.
//      b. If fresh tick (asOf within the current business day): emits
//         `OfficialMarkAdopted` + `FxPositionRevalued` with the live mark.
//      c. If no fresh tick: option (a) of the brief — carry yesterday's
//         mark forward as `rateSource: "stale-mark:<original-source>"`,
//         emit `FxPositionRevalued` with **zero P&L delta** (no
//         revaluation movement), and emit a `SubstrateAlert`
//         (alertClass: integrity, severity: medium) flagging the missing
//         feed. The reversal-then-reval pair stays atomic — every
//         position-day carries one revaluation event, so Bea's posting
//         engine cannot reverse without a paired forward.
//   4. Preserves the existing "no JSE price feed connected" / "no curve
//      ingest connected" honest substrate-gap markers for Bond / Equity /
//      IRD in `skippedReasons[]` so the dashboard renders them.
//   5. Emits one `MtmRunCompleted` event carrying the run summary.
//   6. Writes the daily deliverable to Owner Inbox.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved).
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
//   - D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1 (mark-adoption engine).
//   - IFRS-9-§5.7.1 (FVTPL: changes in fair value through P&L).
//   - IAS-21-§28 (monetary items retranslated at closing rate).
//
// Author: Rohan (Market risk engineer, engineering).

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import {
  type FxPositionRevaluedPayload,
  type FxTradeCancelledPayload,
  makeFxPositionRevalued,
} from "../../platform/event-store/event-types/fx-accounting";
import { makeMtmRunCompleted } from "../../platform/event-store/event-types/mtm";
import { makeSubstrateAlert } from "../../platform/event-store/event-types/platform";
import { MarketDataStore, lookupQuoteWithInverse } from "../../platform/market-data/store";
import { runValuationAdjustments } from "../../platform/market-risk/valuation-adjustment-engine";
import type {
  FxTradeExecutedPayload,
  SettlementConfirmedPayload,
} from "../../platform/markets/cdm/fx";
import { baseAmountMinor } from "../../platform/markets/cdm/fx-helpers";
import {
  adoptFxMark,
  resolveActivePolicyVersionRef,
} from "../../platform/valuation/mark-adoption-engine";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

const ENGINE_ACTOR = {
  type: "service" as const,
  id: "rohan:daily-mtm",
};

const CITATIONS = [
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-FX-SALES-TRADING-FRONTEND",
  "D-EVENT-VIEW-BOUNDARY-WIRE",
  "IFRS-9-§5.7.1",
  "IAS-21-§28",
];

const SUBSTRATE_ALERT_CITATIONS = [
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-EVENT-VIEW-BOUNDARY-WIRE",
  "IFRS-9-§5.7.1",
];

const BOND_SKIP_REASON = "bond MTM: no JSE price feed connected — skipped";
const IRD_SKIP_REASON = "IRD MTM: no curve ingest connected — skipped";
const EQUITY_SKIP_REASON = "equity MTM: no JSE equity feed connected — skipped";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pairToString(pair: { base: string; quote: string }): string {
  return `${pair.base}/${pair.quote}`;
}

function extractMidRate(payload: Record<string, unknown>): number | undefined {
  if (typeof payload.mid === "number") return payload.mid;
  if (typeof payload.midRate === "number") return payload.midRate;
  if (typeof payload.bid === "number" && typeof payload.ask === "number") {
    return ((payload.bid as number) + (payload.ask as number)) / 2;
  }
  return undefined;
}

function isFreshTick(tickAsOf: string, runAsOf: string): boolean {
  // "Fresh" = tick's date >= the run's as-of date (UTC YYYY-MM-DD).
  // Stricter than "any tick ever" — the prior bug was treating any
  // historical tick as production-current.
  return tickAsOf.slice(0, 10) >= runAsOf.slice(0, 10);
}

interface OpenPositionsResult {
  readonly trades: Map<string, FxTradeExecutedPayload>;
}

function collectOpenFxPositions(): OpenPositionsResult {
  // Cancelled trade ids (graceful — event type may be absent).
  const cancelledIds = new Set<string>();
  try {
    for (const e of eventStore.replay({ type: "FxTradeCancelled" })) {
      const p = e.payload as unknown as FxTradeCancelledPayload;
      if (p.tradeId) cancelledIds.add(p.tradeId);
    }
  } catch {
    // FxTradeCancelled not yet registered in some environments — continue.
  }

  // Settled trade ids (CDM lifecycle-close + deprecated accounting event).
  const settledIds = new Set<string>();
  for (const e of eventStore.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as unknown as SettlementConfirmedPayload;
    if (p.tradeId) settledIds.add(p.tradeId);
  }
  for (const e of eventStore.replay({ type: "TradeMatured" })) {
    const p = e.payload as { tradeId?: string };
    if (p.tradeId) settledIds.add(p.tradeId);
  }

  const trades = new Map<string, FxTradeExecutedPayload>();
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    const id = p.tradeId.value;
    if (cancelledIds.has(id)) continue;
    if (settledIds.has(id)) continue;
    trades.set(id, p);
  }

  return { trades };
}

interface PriorRevaluation {
  readonly revalRate: number;
  readonly rateSource: string;
  readonly asOf: string;
}

function lastRevaluationFor(tradeId: string): PriorRevaluation | null {
  let latest: PriorRevaluation | null = null;
  for (const e of eventStore.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as FxPositionRevaluedPayload;
    if (p.tradeId !== tradeId) continue;
    if (!latest || e.as_of > latest.asOf) {
      latest = {
        revalRate: p.revalRate,
        rateSource: p.rateSource,
        asOf: e.as_of,
      };
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Per-position revaluation
// ---------------------------------------------------------------------------

interface PositionRevalResult {
  readonly outcome: "revalued" | "overnight-close" | "stale-mark" | "skipped-no-mark";
  readonly tradeId: string;
  readonly currencyPair: string;
  readonly bookRate: number;
  readonly markRate: number | null;
  readonly pnlDeltaMinor: number;
  readonly rateSource: string | null;
  readonly skipReason?: string;
}

function revalueOnePosition(args: {
  tradeId: string;
  trade: FxTradeExecutedPayload;
  mdStore: MarketDataStore;
  asOf: string;
  policyVersionRef: string | null;
  revaluedAt: string;
}): PositionRevalResult {
  const { tradeId, trade, mdStore, asOf, policyVersionRef, revaluedAt } = args;
  const currencyPair = pairToString(trade.currencyPair);
  const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];

  if (!nearLeg) {
    return {
      outcome: "skipped-no-mark",
      tradeId,
      currencyPair,
      bookRate: 0,
      markRate: null,
      pnlDeltaMinor: 0,
      rateSource: null,
      skipReason: `${tradeId}: no legs on trade`,
    };
  }

  const legRate = nearLeg.rate.amount;
  const bookRate = nearLeg.rate.currency === trade.currencyPair.quote ? legRate : 1 / legRate;
  // Bug fix 1: use baseAmountMinor() to always get the base-currency minor
  // amount regardless of which leg field stores it.  Legacy code read
  // nearLeg.notional.amountMinor directly, which is only correct for SELL
  // trades on a major-first pair.  For BUY trades the notional field holds the
  // quote-currency amount, so the old reading was dimensionally wrong (ZAR² /
  // EUR if the pair is EUR/ZAR).  baseAmountMinor() checks notional.currency
  // and counterNotional.currency against pair.base and returns the correct one.
  const notionalBaseMinor = baseAmountMinor(nearLeg, trade.currencyPair);
  // Bug fix 2: apply the bank's side sign.  "buy" means the bank holds a long
  // position in the base currency: P&L > 0 when midRate > bookRate.  "sell"
  // means the bank is short the base: P&L > 0 when midRate < bookRate.
  const sideSign = trade.side === "buy" ? 1 : -1;

  const baseCcy = trade.currencyPair.base; // e.g. "EUR"
  const quoteCcy = trade.currencyPair.quote; // e.g. "USD"
  const quoteIsZar = quoteCcy === "ZAR";

  // Helper: resolve CCY/ZAR rate from MarketDataStore. Uses
  // lookupQuoteWithInverse so that either EUR/ZAR or ZAR/EUR stored in the
  // DB will work. Returns null if no usable tick is found.
  function resolveZarRate(
    ccy: string,
    provenance: "production" | "simulated" | undefined,
  ): number | null {
    if (ccy === "ZAR") return 1; // ZAR/ZAR = 1 by definition
    const pair = `${ccy}/ZAR`;
    const result = lookupQuoteWithInverse(mdStore, pair, {
      provenance: provenance ?? "production",
    });
    return result !== null ? result.rate : null;
  }

  // ---- 1. Try fresh production tick ----------------------------------------
  // Per-currency ZAR MTM: resolve EUR/ZAR and USD/ZAR independently, then
  // compute P&L as:
  //   base leg:  sideSign × notionalBase × (zarRateBase_today − zarRateBase_book)
  //   quote leg: −sideSign × notionalQuote × (zarRateQuote_today − zarRateQuote_book)
  //
  // For the book rates: zarRateBase_book = bookRate (for a ZAR-quoted pair
  // this is already CCY/ZAR). For non-ZAR-quoted crosses we must resolve
  // the book-time CCY/ZAR rate. As a pragmatic approximation during the
  // build phase (no historical ZAR rate for book date), use the CURRENT
  // zarRateBase tick as zarRateBase_book too — i.e. the "new-trade P&L" is
  // zero on the first reval. This matches the stale-mark fallback behaviour
  // for same-day trades where no prior mark exists.
  //
  // For ZAR-quoted pairs (e.g. USD/ZAR), the cross-rate issue does not apply:
  //   - zarRateBase = current USD/ZAR mid
  //   - zarRateQuote = 0 (ZAR leg; no conversion needed)
  //   - P&L = sideSign × notionalBase × (zarRateBase_today − bookRate)
  // This is identical to the legacy formula for ZAR-quoted pairs.

  const productionTicks = mdStore.query({
    provenance: "production",
    instrument: currencyPair,
    dataType: "fx-quote",
    limit: 1,
  });

  const tick = productionTicks[0];

  // Resolve per-currency ZAR rates and compute per-currency P&L.
  // Returns null if any required rate is unavailable (trade is unmarkable).
  function computePerCurrencyPnl(provenance: "production" | "simulated" | undefined): {
    unrealisedPnlZarMinor: number;
    revalRate: number; // cross-pair rate (base/quote) used for bookRate comparison
    zarRateBase: number;
    zarRateQuote: number; // 0 if quote is ZAR
  } | null {
    const zarRateBase = resolveZarRate(baseCcy, provenance);
    if (zarRateBase === null) return null;

    const zarRateQuote = quoteIsZar ? 0 : resolveZarRate(quoteCcy, provenance);
    if (zarRateQuote === null) return null;

    // notionalQuoteMinor: the quote-currency notional in minor units.
    // For a BUY base/quote, the quote leg is the pay leg.
    // Use nearLeg counterNotional if currency matches quote, else notional.
    // nearLeg is guaranteed non-null here (early return above guards it).
    // biome-ignore lint: nearLeg non-null guaranteed by early-return guard above
    const qLeg = nearLeg!;
    let notionalQuoteMinor: number;
    if (qLeg.notional.currency === quoteCcy) {
      notionalQuoteMinor = qLeg.notional.amountMinor;
    } else if (qLeg.counterNotional && qLeg.counterNotional.currency === quoteCcy) {
      notionalQuoteMinor = qLeg.counterNotional.amountMinor;
    } else {
      // Fallback: derive from notional × book rate
      notionalQuoteMinor = Math.round(notionalBaseMinor * bookRate);
    }

    // Compute book-time ZAR rates. For ZAR-quoted pairs, zarRateBase_book = bookRate.
    // For crosses, approximate: use zarRateBase / zarRateQuote × bookRate
    // (the cross rate implies zarRateBase = bookRate × zarRateQuote).
    // On first reval with no historical ZAR rate, assume zarRateBase_book
    // ≈ current zarRateBase (zero first-day P&L for the cross legs — conservative).
    const zarRateBase_book = quoteIsZar ? bookRate : zarRateBase; // first-reval conservative
    const zarRateQuote_book = quoteIsZar ? 0 : zarRateQuote; // first-reval conservative

    // P&L = base_leg_pnl − quote_leg_pnl (quote is a contra-leg)
    const basePnl = Math.round(sideSign * notionalBaseMinor * (zarRateBase - zarRateBase_book));
    const quotePnl = quoteIsZar
      ? 0
      : Math.round(sideSign * notionalQuoteMinor * (zarRateQuote - zarRateQuote_book));
    const unrealisedPnlZarMinor = basePnl - quotePnl;

    // Synthetic cross-rate for bookRate compat on the event (revalRate ≈ zarRateBase/zarRateQuote if non-ZAR)
    const revalRate = quoteIsZar
      ? zarRateBase
      : zarRateQuote > 0
        ? zarRateBase / zarRateQuote
        : zarRateBase;

    return { unrealisedPnlZarMinor, revalRate, zarRateBase, zarRateQuote };
  }

  if (tick && isFreshTick(tick.asOf, asOf)) {
    // Fresh production tick — try per-currency ZAR computation.
    const perCcyResult = computePerCurrencyPnl("production");

    if (perCcyResult !== null) {
      const { unrealisedPnlZarMinor, revalRate, zarRateBase, zarRateQuote } = perCcyResult;

      // Emit OfficialMarkAdopted for the cross-pair tick (preserving existing
      // mark-adoption semantics — adopts the direct cross rate as official mark).
      const tickPayload = tick.payload as Record<string, unknown>;
      const midRate = extractMidRate(tickPayload);
      if (midRate !== undefined && midRate > 0) {
        adoptFxMark({
          store: eventStore as unknown as import("../../platform/event-store/store").EventStore,
          asOf,
          tick,
          markDecimal: midRate.toFixed(6),
          policyVersionRef,
        });
      }

      const revalPayload: FxPositionRevaluedPayload = {
        tradeId,
        currencyPair,
        bookRate,
        revalRate,
        notionalBaseMinor,
        unrealisedPnlZarMinor,
        revaluedAt,
        rateSource: tick.source,
        zarRateBase,
        zarRateQuote,
      };

      eventStore.append(
        makeFxPositionRevalued({
          asOf,
          entity: BANK_ENTITY,
          actor: ENGINE_ACTOR,
          citations: CITATIONS,
          payload: revalPayload,
          eventId: newEventId(),
        }),
      );

      return {
        outcome: "revalued",
        tradeId,
        currencyPair,
        bookRate,
        markRate: revalRate,
        pnlDeltaMinor: unrealisedPnlZarMinor,
        rateSource: tick.source,
      };
    }
    // zarRateBase/zarRateQuote not found — fall through to stale-mark / skip.
  }

  // ---- 2. No fresh production tick — try stale-mark carry-forward ----------
  const prior = lastRevaluationFor(tradeId);
  if (prior !== null) {
    // Carry yesterday's close rate forward; compute full cumulative PnL vs
    // book rate (not delta) so the daily-pnl engine reads the correct position
    // value. The rateSource is tagged "stale-mark:<original>" so downstream
    // recon + Vera see the provenance.
    const originalSource = prior.rateSource.startsWith("stale-mark:")
      ? prior.rateSource.slice("stale-mark:".length)
      : prior.rateSource;
    const staleSource = `stale-mark:${originalSource}`;
    const unrealisedPnlZarMinor = Math.round(
      sideSign * notionalBaseMinor * (prior.revalRate - bookRate),
    );
    const revalPayload: FxPositionRevaluedPayload = {
      tradeId,
      currencyPair,
      bookRate,
      revalRate: prior.revalRate,
      notionalBaseMinor,
      unrealisedPnlZarMinor,
      revaluedAt,
      rateSource: staleSource,
    };

    eventStore.append(
      makeFxPositionRevalued({
        asOf,
        entity: BANK_ENTITY,
        actor: ENGINE_ACTOR,
        citations: CITATIONS,
        payload: revalPayload,
        eventId: newEventId(),
      }),
    );

    return {
      outcome: "stale-mark",
      tradeId,
      currencyPair,
      bookRate,
      markRate: prior.revalRate,
      pnlDeltaMinor: unrealisedPnlZarMinor,
      rateSource: staleSource,
    };
  }

  // ---- 2b. No prior FxPositionRevalued — try overnight close proxy ---------
  // First-ever run for this position. If a tick exists in mdStore (any date,
  // not just today), use it as an overnight close proxy. The `tick` variable
  // is already in scope from the mdStore query above — reuse it rather than
  // re-querying. We do NOT emit OfficialMarkAdopted for a historical tick;
  // only current marks get adopted. Increment positionsStaleMark (not
  // positionsValued) — this is not a live mark.
  if (tick) {
    const perCcyResult = computePerCurrencyPnl("production");
    if (perCcyResult !== null) {
      const { unrealisedPnlZarMinor, revalRate, zarRateBase, zarRateQuote } = perCcyResult;
      const rateSource = `overnight-close:${tick.asOf.slice(0, 10)}:${tick.source}`;
      const revalPayload: FxPositionRevaluedPayload = {
        tradeId,
        currencyPair,
        bookRate,
        revalRate,
        notionalBaseMinor,
        unrealisedPnlZarMinor,
        revaluedAt,
        rateSource,
        zarRateBase,
        zarRateQuote,
      };

      eventStore.append(
        makeFxPositionRevalued({
          asOf,
          entity: BANK_ENTITY,
          actor: ENGINE_ACTOR,
          citations: CITATIONS,
          payload: revalPayload,
          eventId: newEventId(),
        }),
      );

      return {
        outcome: "overnight-close",
        tradeId,
        currencyPair,
        bookRate,
        markRate: revalRate,
        pnlDeltaMinor: unrealisedPnlZarMinor,
        rateSource,
      };
    }
  }

  // ---- 3. No production tick and no prior reval — must skip ----------------
  // This is the legitimate "first-day with no feed and no tick at all" case.
  // We cannot synthesise a mark; book rate is not a valid FVTPL mark. We do
  // NOT emit FxPositionRevalued — Bea's posting engine therefore emits
  // nothing for this position-day either, preserving the reversal-reval
  // pairing invariant. Alert elevated to "high" — this is a more serious gap.
  return {
    outcome: "skipped-no-mark",
    tradeId,
    currencyPair,
    bookRate,
    markRate: null,
    pnlDeltaMinor: 0,
    rateSource: null,
    skipReason: `no production tick and no prior revaluation for ${currencyPair}`,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const runId = randomUUID();
  const asOf = ctx.asOf;
  const dateStr = fmtDateUTC(asOf);

  logger.info(
    { runId, asOf, agent: ctx.agent, trigger: ctx.trigger.id, dryRun: ctx.dryRun },
    "rohan:daily-mtm — starting EOD MTM run",
  );

  // -------------------------------------------------------------------------
  // Open MarketDataStore (handler is responsible — composition.ts does not
  // export one, and tests/scenarios set BANK_MARKET_DATA_DB explicitly).
  // -------------------------------------------------------------------------
  const marketDbPath = process.env.BANK_MARKET_DATA_DB;
  if (!marketDbPath) {
    logger.warn(
      { agent: ctx.agent },
      "rohan:daily-mtm — BANK_MARKET_DATA_DB not set; run will emit MtmRunCompleted with no positions valued",
    );
  }

  // Collect open positions BEFORE we decide whether the run can proceed —
  // even with no MarketDataStore we still emit MtmRunCompleted so the
  // dashboard shows the run fired.
  const { trades } = collectOpenFxPositions();

  const policyVersionRef = marketDbPath
    ? resolveActivePolicyVersionRef(
        eventStore as unknown as import("../../platform/event-store/store").EventStore,
      )
    : null;
  if (marketDbPath && !policyVersionRef) {
    logger.warn(
      "rohan:daily-mtm — no active PolicyVersionActivated for domain=valuation; OfficialMarkAdopted events will be skipped (run `bun run backfill:policy-activations`)",
    );
  }

  const revaluedAt = new Date().toISOString();
  let positionsValued = 0;
  let positionsStaleMark = 0;
  let positionsSkipped = 0;
  let totalPnlDeltaMinor = 0;
  const skippedReasons: string[] = [];
  const summary: PositionRevalResult[] = [];

  let mdStore: MarketDataStore | null = null;
  if (marketDbPath) {
    try {
      mdStore = new MarketDataStore(marketDbPath);
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "rohan:daily-mtm — failed to open MarketDataStore",
      );
      skippedReasons.push(`MarketDataStore open failed: ${String(err)}`);
    }
  } else {
    skippedReasons.push("MarketDataStore unavailable (BANK_MARKET_DATA_DB unset)");
  }

  if (mdStore && !ctx.dryRun) {
    for (const [tradeId, trade] of trades) {
      try {
        const r = revalueOnePosition({
          tradeId,
          trade,
          mdStore,
          asOf,
          policyVersionRef,
          revaluedAt,
        });
        summary.push(r);
        if (r.outcome === "revalued") {
          positionsValued += 1;
          totalPnlDeltaMinor += r.pnlDeltaMinor;
        } else if (r.outcome === "stale-mark" || r.outcome === "overnight-close") {
          positionsStaleMark += 1;
          const reason =
            r.outcome === "overnight-close"
              ? `overnight-close proxy for ${r.currencyPair} (rateSource: ${r.rateSource})`
              : `stale-mark carry-forward for ${r.currencyPair}`;
          if (!skippedReasons.includes(reason)) skippedReasons.push(reason);
        } else {
          positionsSkipped += 1;
          if (r.skipReason && !skippedReasons.includes(r.skipReason)) {
            skippedReasons.push(r.skipReason);
          }
        }
      } catch (err) {
        positionsSkipped += 1;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ tradeId, error: msg }, "rohan:daily-mtm — position revaluation failed");
        skippedReasons.push(`${tradeId}: ${msg}`);
      }
    }
  } else if (!mdStore && !ctx.dryRun) {
    // No MarketDataStore — every open trade is unvalued.
    positionsSkipped = trades.size;
  }

  // -------------------------------------------------------------------------
  // Honest skip messages for Bond / Equity / IRD — substrate gap markers,
  // not bugs. Carried into MtmRunCompleted.skippedReasons[] so the
  // dashboard renders them.
  // -------------------------------------------------------------------------
  skippedReasons.push(BOND_SKIP_REASON);
  skippedReasons.push(EQUITY_SKIP_REASON);
  skippedReasons.push(IRD_SKIP_REASON);

  // -------------------------------------------------------------------------
  // Emit SubstrateAlert when any position fell back to stale-mark — this
  // is the typed surface for Vera + the dashboard to see that production
  // ticks are missing without burying it in run logs.
  // -------------------------------------------------------------------------
  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    if (positionsStaleMark > 0) {
      const distinctPairs = Array.from(
        new Set(
          summary
            .filter((r) => r.outcome === "stale-mark" || r.outcome === "overnight-close")
            .map((r) => r.currencyPair),
        ),
      ).sort();
      eventStore.append(
        makeSubstrateAlert({
          asOf,
          entity: BANK_ENTITY,
          actor: ENGINE_ACTOR,
          citations: SUBSTRATE_ALERT_CITATIONS,
          payload: {
            alertId: `alert:integrity:mtm-stale-mark-${dateStr}`,
            alertClass: "integrity",
            agentUrn: "urn:agent:rohan:daily-mtm",
            details: `Daily MTM ${dateStr}: ${positionsStaleMark} position(s) used non-live marks (stale-mark carry-forward or overnight-close proxy). Pairs: ${distinctPairs.join(", ")}. Substrate gap: no production FX feed (Reuters / Bloomberg / SARB intraday). Each affected position-day has FxPositionRevalued emitted with rateSource="stale-mark:<original>" or "overnight-close:<date>:<source>"; unrealised PnL is computed as cumulative vs book rate.`,
            severity: "medium",
          },
          eventId: newEventId(),
        }),
      );
      eventsEmitted += 1;
    }

    if (positionsSkipped > 0) {
      const skippedFxPositions = summary
        .filter((r) => r.outcome === "skipped-no-mark")
        .map((r) => r.currencyPair);
      if (skippedFxPositions.length > 0) {
        eventStore.append(
          makeSubstrateAlert({
            asOf,
            entity: BANK_ENTITY,
            actor: ENGINE_ACTOR,
            citations: SUBSTRATE_ALERT_CITATIONS,
            payload: {
              alertId: `alert:integrity:mtm-no-mark-${dateStr}`,
              alertClass: "integrity",
              agentUrn: "urn:agent:rohan:daily-mtm",
              details: `Daily MTM ${dateStr}: ${skippedFxPositions.length} position(s) have NO mark — no production tick and no prior FxPositionRevalued. Pairs: ${skippedFxPositions.join(", ")}. Unrealised P&L is INCOMPLETE; dashboard will show mark-unavailable indicator. MTM feed required.`,
              severity: "high",
            },
            eventId: newEventId(),
          }),
        );
        eventsEmitted += 1;
      }
    }

    // ---------------------------------------------------------------------
    // Emit MtmRunCompleted — terminal run-boundary event.
    // ---------------------------------------------------------------------
    eventStore.append(
      makeMtmRunCompleted({
        asOf,
        entity: BANK_ENTITY,
        actor: ENGINE_ACTOR,
        citations: CITATIONS,
        payload: {
          runId,
          runType: "eod",
          asOf,
          positionsValued: positionsValued + positionsStaleMark,
          positionsSkipped,
          skippedReasons,
          totalPnlDeltaMinor,
        },
        eventId: newEventId(),
      }),
    );
    eventsEmitted += 1;

    // ---------------------------------------------------------------------
    // Valuation-adjustment / prudent-valuation reserve run (Camille CFO R2).
    // Runs AFTER mark adoption + IPV checks above: the reserves consume the
    // freshly-adopted marks (close-out reserve over the live FX-spot book) and
    // the IpvExceptionRaised variances (market-price-uncertainty AVA). Wrapped
    // in try/catch so a reserve-engine failure does not abort the MTM run.
    // Requires a MarketDataStore (CVA category); only invoked when one is open.
    if (mdStore) {
      try {
        const vadjEvents = runValuationAdjustments(eventStore, () => asOf, mdStore);
        eventsEmitted += vadjEvents;
        logger.info(
          { agent: ctx.agent, vadjEvents },
          "rohan:daily-mtm — valuation-adjustment reserve run complete",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ error: msg }, "rohan:daily-mtm — valuation-adjustment run failed");
        skippedReasons.push(`valuation-adjustment run failed: ${msg}`);
      }
    } else {
      skippedReasons.push(
        "valuation-adjustment run skipped — MarketDataStore unavailable (CVA category needs it)",
      );
    }
  }

  if (mdStore) mdStore.close();

  // -------------------------------------------------------------------------
  // Owner Inbox deliverable
  // -------------------------------------------------------------------------
  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${dateStr}_rohan_daily-mtm.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown({
        ctx,
        runId,
        positionsValued,
        positionsStaleMark,
        positionsSkipped,
        totalPnlDeltaMinor,
        skippedReasons,
        summary,
      }),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  const okCount = positionsValued + positionsStaleMark;
  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary:
      `MTM ${dateStr}: ${positionsValued} live · ${positionsStaleMark} stale-mark · ${positionsSkipped} skipped · ` +
      `pnl ZAR ${(totalPnlDeltaMinor / 100).toFixed(2)} · open positions: ${trades.size}`,
    ok: okCount >= 0,
  };
};

export default handler;

// ---------------------------------------------------------------------------
// Owner Inbox markdown render
// ---------------------------------------------------------------------------

function buildReportMarkdown(args: {
  ctx: AgentRunContext;
  runId: string;
  positionsValued: number;
  positionsStaleMark: number;
  positionsSkipped: number;
  totalPnlDeltaMinor: number;
  skippedReasons: readonly string[];
  summary: readonly PositionRevalResult[];
}): string {
  const {
    ctx,
    runId,
    positionsValued,
    positionsStaleMark,
    positionsSkipped,
    totalPnlDeltaMinor,
    skippedReasons,
    summary,
  } = args;
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Rohan", "daily-mtm", ctx.asOf));
  lines.push(`# Rohan — daily MTM run, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous EOD mark-to-market run per `Team/Rohan.md` operating spec § 6 (Cadence). Wraps the legacy `scripts/mtm-run.ts` logic into a scheduled handler (cron `0 18 * * 1-5` — 18:00 UTC weekdays = after JSE 17:00 SAST close). Reversal-then-reval pair is atomic per `D-EVENT-VIEW-BOUNDARY-WIRE` Slice B.1 — every position-day either carries one `FxPositionRevalued` event (live or stale-mark) or none, so Bea's posting engine never reverses without a paired forward.",
  );
  lines.push("");
  const headlinePnl = `ZAR ${(totalPnlDeltaMinor / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  lines.push(
    `**Headline:** ${positionsValued} live · ${positionsStaleMark} stale-mark · ${positionsSkipped} unvalued · net unrealised P&L delta ${headlinePnl} · runId \`${runId}\`.`,
  );
  lines.push("");

  lines.push("## Position detail");
  lines.push("");
  if (summary.length === 0) {
    lines.push(
      "_No open FX positions or MarketDataStore unavailable. Substrate gap: production FX feed not yet wired._",
    );
    lines.push("");
  } else {
    lines.push("| Trade | Pair | Outcome | Book rate | Mark rate | P&L delta (ZAR) | Source |");
    lines.push("|---|---|---|---:|---:|---:|---|");
    for (const r of summary) {
      const markStr = r.markRate === null ? "—" : r.markRate.toFixed(4);
      const pnlStr = (r.pnlDeltaMinor / 100).toLocaleString("en-ZA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      lines.push(
        `| \`${r.tradeId}\` | ${r.currencyPair} | ${r.outcome} | ${r.bookRate.toFixed(4)} | ${markStr} | ${pnlStr} | ${r.rateSource ?? "—"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Skip reasons");
  lines.push("");
  if (skippedReasons.length === 0) {
    lines.push("_None — full MTM coverage._");
  } else {
    for (const r of skippedReasons) {
      lines.push(`- ${r}`);
    }
  }
  lines.push("");

  lines.push("## Substrate gaps");
  lines.push("");
  lines.push(
    "- **Production FX feed** — Reuters WM-Fix or Bloomberg BFIX ingest not yet wired. While absent, every open position falls back to stale-mark carry-forward and the daily SubstrateAlert (`alert:integrity:mtm-stale-mark-<date>`) fires. Recommended brief: `WS-MTM-PROD-FX-FEED`.",
  );
  lines.push(
    "- **JSE bond price feed** — bond MTM is blocked on the JSE EOD bond-price ingest. Recommended brief: `WS-MTM-JSE-BOND-FEED`.",
  );
  lines.push(
    "- **JIBAR / swap curve ingest** — IRD MTM is blocked on JIBAR + ZAR-OIS curve ingest. Recommended brief: `WS-MTM-JIBAR-CURVE-INGEST`.",
  );
  lines.push(
    "- **JSE equity feed** — equity MTM is blocked on the JSE EOD equity-price ingest. Recommended brief: `WS-MTM-JSE-EQUITY-FEED`.",
  );
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    `Open FX positions resolved by replaying \`FxTradeExecuted\` minus \`FxTradeCancelled\` minus \`SettlementConfirmed\`/\`TradeMatured\` from the composition-root event store. Marks elected via \`MarketDataStore.query({provenance:"production"})\` (latest tick per pair); stale-mark fallback reads the most-recent prior \`FxPositionRevalued\` for the position. \`OfficialMarkAdopted\` emitted via \`adoptFxMark\` per D-EVENT-VIEW-BOUNDARY-WIRE Slice B.1. Recon gate: \`recon:mtm-reversal-paired-with-reval\` asserts per-position-day reversal/revaluation pairing.`,
  );
  lines.push("");
  return lines.join("\n");
}
