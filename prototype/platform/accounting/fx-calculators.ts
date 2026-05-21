// platform/accounting/fx-calculators.ts
//
// FX accounting calculators — four pure functions over the event stream.
//
// Per Principle 1: positions, P&L, and capital charges are *queries*
// over the event log. No mutable state; no side-effects. All inputs are
// arrays of typed event payloads; all outputs are typed value objects.
//
// Calculators implemented:
//   1. fxPositionCalculator    — net long/short per currency pair
//   2. unrealisedPnlCalculator — open-position FVTPL P&L
//   3. realisedPnlCalculator   — settled-trade P&L from settlement events
//   4. fxRwaCalculator         — standardised-approach FX RWA / capital charge
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - Regulations Relating to Banks Reg 28(5) (FX standardised-approach)
//   - BCBS D352 §718(xiii) (FX risk capital charge: 8% × max(longs, shorts))
//
// Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting
//   engineer, engineering)

import type {
  FxPositionRevaluedPayload,
  FxSettlementConfirmedPayload,
} from "../event-store/event-types/fx-accounting";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { baseAmountMinor } from "../markets/cdm/fx-helpers";

// ---------------------------------------------------------------------------
// Calculator 1 — FX Position Calculator
//
// Net long/short per currency pair from open (unsettled) FxTradeExecuted
// events. A trade is "open" if there is no corresponding FxSettlementConfirmed
// event for that tradeId.
//
// Output: per currency pair, net long (positive) and net short (negative)
// positions in ZAR minor units equivalent.
// ---------------------------------------------------------------------------

export interface FxPositionResult {
  readonly currencyPair: string;
  /** Net long position in base-currency minor units (positive = net long). */
  readonly netPositionBaseMinor: number;
  /** Net long position in ZAR minor units (for capital calculation). */
  readonly netPositionZarMinor: number;
  /** Sum of all buy-side notionals. */
  readonly grossLongBaseMinor: number;
  /** Sum of all sell-side notionals (absolute value). */
  readonly grossShortBaseMinor: number;
  /** Number of open trades in this pair. */
  readonly openTradeCount: number;
  readonly asOf: string;
}

/**
 * Compute net open positions per currency pair.
 *
 * @param trades - Array of FxTradeExecuted payloads (tradeId may be string or Identifier)
 * @param settledTradeIds - Set of trade ID strings for which FxSettlementConfirmed has been received
 * @param zarRates - Map from currency code → ZAR rate (units of ZAR per 1 minor unit of currency)
 * @param asOf - ISO 8601 as-of timestamp for the snapshot
 */
export function fxPositionCalculator(args: {
  readonly trades: ReadonlyArray<FxTradeExecutedPayload>;
  readonly settledTradeIds: ReadonlySet<string>;
  readonly zarRates: ReadonlyMap<string, number>;
  readonly asOf: string;
}): FxPositionResult[] {
  // Aggregate by currency pair
  const byPair = new Map<
    string,
    {
      netBaseMinor: number;
      grossLongBaseMinor: number;
      grossShortBaseMinor: number;
      openTradeCount: number;
    }
  >();

  for (const trade of args.trades) {
    // FxTradeExecutedPayload.tradeId is an Identifier { scheme, value }
    const tradeIdStr = trade.tradeId.value;
    if (args.settledTradeIds.has(tradeIdStr)) continue; // settled — not open

    const pairKey = `${trade.currencyPair.base}/${trade.currencyPair.quote}`;
    const existing = byPair.get(pairKey) ?? {
      netBaseMinor: 0,
      grossLongBaseMinor: 0,
      grossShortBaseMinor: 0,
      openTradeCount: 0,
    };

    for (const leg of trade.legs) {
      if (leg.legKind !== "near") continue;
      // Resolve base-currency notional via the Slice-2 helper —
      // (D-FX-QUOTING-CONVENTION). Previously read `leg.notional.amountMinor`
      // directly, which only equals the base amount when the leg's
      // payCurrency is the pair base (SELL on a major-first pair). For BUY
      // trades on a major-first pair, notional is in the quote currency and
      // the base amount lives on counterNotional. The helper picks the right
      // field side-correctly.
      const notional = baseAmountMinor(leg, trade.currencyPair);
      const isBuy = trade.side === "buy";
      if (isBuy) {
        existing.netBaseMinor += notional;
        existing.grossLongBaseMinor += notional;
      } else {
        existing.netBaseMinor -= notional;
        existing.grossShortBaseMinor += notional;
      }
      existing.openTradeCount += 1;
    }

    byPair.set(pairKey, existing);
  }

  const results: FxPositionResult[] = [];
  for (const [pairKey, pos] of byPair.entries()) {
    const [baseCcy] = pairKey.split("/");
    const zarRate = args.zarRates.get(baseCcy ?? "") ?? 1;
    const netPositionZarMinor = Math.round(pos.netBaseMinor * zarRate);

    results.push({
      currencyPair: pairKey,
      netPositionBaseMinor: pos.netBaseMinor,
      netPositionZarMinor,
      grossLongBaseMinor: pos.grossLongBaseMinor,
      grossShortBaseMinor: pos.grossShortBaseMinor,
      openTradeCount: pos.openTradeCount,
      asOf: args.asOf,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Calculator 2 — Unrealised P&L Calculator
//
// For each open FX position, computes unrealised P&L based on the current
// spot rate vs the original book rate. Uses the latest FxPositionRevalued
// event for each trade (or falls back to the book rate from the trade).
//
// Per IFRS 9 §5.7.1: changes in fair value of FVTPL instruments recognised
// in profit or loss (not OCI).
// ---------------------------------------------------------------------------

export interface UnrealisedPnlResult {
  readonly tradeId: string;
  readonly currencyPair: string;
  /** Original agreed rate from trade date. */
  readonly bookRate: number;
  /** Current revaluation rate (from latest FxPositionRevalued or provided rate map). */
  readonly currentRate: number;
  /** Notional in base currency minor units. */
  readonly notionalBaseMinor: number;
  /** Unrealised P&L in ZAR minor units (positive = gain). */
  readonly unrealisedPnlZarMinor: number;
}

/**
 * Compute unrealised P&L for all open positions.
 *
 * @param trades - Open trades (not yet settled)
 * @param revaluations - Latest FxPositionRevalued per trade (keyed by tradeId)
 * @param currentRates - Current spot rates (map from currency → ZAR rate)
 */
export function unrealisedPnlCalculator(args: {
  readonly trades: ReadonlyArray<FxTradeExecutedPayload>;
  readonly settledTradeIds: ReadonlySet<string>;
  readonly latestRevaluations: ReadonlyMap<string, FxPositionRevaluedPayload>;
  readonly currentRates: ReadonlyMap<string, number>;
}): UnrealisedPnlResult[] {
  const results: UnrealisedPnlResult[] = [];

  for (const trade of args.trades) {
    const tradeIdStr = trade.tradeId.value;
    if (args.settledTradeIds.has(tradeIdStr)) continue;

    const nearLeg = trade.legs.find((l) => l.legKind === "near");
    if (!nearLeg) continue;

    const bookRate = nearLeg.rate.amount;
    // Resolve base-currency notional via the Slice-2 helper
    // (D-FX-QUOTING-CONVENTION). The legacy line
    //     const notionalBaseMinor = nearLeg.notional.amountMinor;
    // was incorrect for BUY trades on a major-first pair: notional.currency
    // = payCurrency = quote on a BUY, so `notional.amountMinor` was
    // quote-currency cents, not base. Multiplying by `(currentRate - bookRate)`
    // (which has units quote/base) then produced a number ~rate× too large.
    // The helper resolves to the leg's counterNotional when the leg is on
    // the quote side, keeping `notionalBaseMinor × rateDelta` dimensionally
    // coherent (units = base × quote/base = quote-cents, which is the
    // ZAR-functional unit for the BA-350 ZAR-presented P&L).
    const notionalBaseMinor = baseAmountMinor(nearLeg, trade.currencyPair);
    const pairKey = `${trade.currencyPair.base}/${trade.currencyPair.quote}`;

    // Use latest revaluation rate if available, else fall back to current rate map
    const revaluation = args.latestRevaluations.get(tradeIdStr);
    const currentRate =
      revaluation?.revalRate ?? args.currentRates.get(trade.currencyPair.base) ?? bookRate;

    // P&L = (currentRate - bookRate) × notional
    // For a "buy" trade: bank is long base, short quote
    // Gain when base appreciates (currentRate > bookRate means base worth more ZAR)
    const isBuy = trade.side === "buy";
    const rateDelta = currentRate - bookRate;
    const pnlMinor = Math.round((isBuy ? 1 : -1) * rateDelta * Math.abs(notionalBaseMinor));

    results.push({
      tradeId: tradeIdStr,
      currencyPair: pairKey,
      bookRate,
      currentRate,
      notionalBaseMinor,
      unrealisedPnlZarMinor: pnlMinor,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Calculator 3 — Realised P&L Calculator
//
// Folds FxSettlementConfirmed events to compute realised P&L per trade.
// Realised P&L = settled cash (ZAR equivalent) - carrying amount at
// last revaluation. In the model this is the realisedPnlZarMinor field
// on the settlement event.
// ---------------------------------------------------------------------------

export interface RealisedPnlResult {
  readonly tradeId: string;
  readonly currencyPair: string;
  /** Realised P&L in ZAR minor units. */
  readonly realisedPnlZarMinor: number;
  /** ISO 8601 settlement timestamp. */
  readonly settledAt: string;
}

/**
 * Compute realised P&L from settlement events.
 */
export function realisedPnlCalculator(args: {
  readonly settlements: ReadonlyArray<{ tradeId: string } & FxSettlementConfirmedPayload>;
}): RealisedPnlResult[] {
  return args.settlements.map((s) => ({
    tradeId: s.tradeId,
    currencyPair: s.currencyPair,
    realisedPnlZarMinor: s.realisedPnlZarMinor,
    settledAt: s.settledAt,
  }));
}

// ---------------------------------------------------------------------------
// Calculator 4 — FX RWA Calculator (Standardised Approach)
//
// Per Regulations Relating to Banks Reg 28(5) + BCBS D352 §718(xiii):
//   FX capital charge = 8% × max(sum of net long positions, sum of net short positions)
//   (both expressed in ZAR)
//   RWA = 12.5 × capital charge
//
// Per-currency breakdown: capital allocated pro-rata by position size.
// Functional currency (ZAR) is excluded from the FX charge per Reg 28(5).
// ---------------------------------------------------------------------------

export interface FxRwaResult {
  readonly currency: string;
  /** Net open position in ZAR minor units (positive = long, negative = short). */
  readonly netOpenPositionZarMinor: number;
  /** Capital charge in ZAR minor units (8% × |net position|, allocated). */
  readonly capitalChargeZarMinor: number;
  /** RWA in ZAR minor units (12.5 × capital charge). */
  readonly rwaZarMinor: number;
}

export interface FxRwaSummary {
  readonly perCurrency: FxRwaResult[];
  /** Total FX capital charge = 8% × max(long, short). */
  readonly totalCapitalChargeZarMinor: number;
  /** Total FX RWA = 12.5 × total capital charge. */
  readonly totalRwaZarMinor: number;
  /** Sum of all net long positions in ZAR minor units. */
  readonly sumNetLongsZarMinor: number;
  /** Sum of all net short positions in ZAR minor units (absolute). */
  readonly sumNetShortsZarMinor: number;
  readonly asOf: string;
}

/**
 * Compute FX RWA under the standardised approach.
 *
 * @param positions - FX positions per currency (from fxPositionCalculator output)
 * @param functionalCurrency - Excluded from FX charge (typically "ZAR")
 * @param asOf - Snapshot timestamp
 */
export function fxRwaCalculator(args: {
  readonly positions: ReadonlyArray<FxPositionResult>;
  readonly functionalCurrency: string;
  readonly asOf: string;
}): FxRwaSummary {
  let sumLongs = 0;
  let sumShorts = 0;

  const perCurrency: FxRwaResult[] = [];

  for (const pos of args.positions) {
    const [baseCcy] = pos.currencyPair.split("/");
    // Exclude functional currency leg
    if (baseCcy === args.functionalCurrency) continue;

    const net = pos.netPositionZarMinor;
    if (net > 0) sumLongs += net;
    else sumShorts += -net;

    // Per-currency capital allocated as 8% of |net position|
    // (aggregate is max(longs, shorts); individual lines are informational)
    const capitalChargeZarMinor = Math.round(0.08 * Math.abs(net));
    perCurrency.push({
      currency: baseCcy ?? pos.currencyPair,
      netOpenPositionZarMinor: net,
      capitalChargeZarMinor,
      rwaZarMinor: Math.round(12.5 * capitalChargeZarMinor),
    });
  }

  // Aggregate: max(longs, shorts) per Reg 28(5)
  const totalCapitalChargeZarMinor = Math.round(0.08 * Math.max(sumLongs, sumShorts));
  const totalRwaZarMinor = Math.round(12.5 * totalCapitalChargeZarMinor);

  return {
    perCurrency,
    totalCapitalChargeZarMinor,
    totalRwaZarMinor,
    sumNetLongsZarMinor: sumLongs,
    sumNetShortsZarMinor: sumShorts,
    asOf: args.asOf,
  };
}
