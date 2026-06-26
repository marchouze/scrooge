// platform/reporting/ba-320-equity-events-adapter.ts
//
// Derives the BA 320 equity position-risk rows from EquityTradingPositionOpened
// events (minus EquityTradingPositionClosed derecognitions). Fills the
// `Ba320PeriodCloseSubscriberInput.equity` field which was previously a
// caller-supplied placeholder (empty array → zero charge, per
// D-MARKETS-CAPITAL-TIME-SHAPE).
//
// Only TRADING-BOOK positions incur BA 320 equity risk. Banking-book equity is
// BA 340 (banking-book equity), NOT BA 320 — out of scope here (the boundary the
// FRTB desk structure enforces).
//
// Design (mirrors ba-320-bond-events-adapter.ts):
//   EquityTradingPositionOpened (bookType="trading") events
//     → derecognise via EquityTradingPositionClosed
//     → net long/short per national MARKET (Reg 28(3)(a) — equity charge is per
//       national market; positions in different markets are NOT netted)
//     → aggregate into EquityRow[] (net = long − short; gross = long + short)
//
// The pure BA 320 generator (`ba-320-market-risk.ts`) then computes, per market:
//   general charge  = 8% × |net|
//   specific charge = (liquidAndDiversified ? 4% : 8%) × gross
// per Reg 28(3)(a); BCBS D352 §718(xi)–(xii).
//
// DECIMAL-NATIVE: the event payloads carry MoneyWire (major-unit decimal);
// this adapter converts to the engine's minor-unit `number` contract via
// `minorFromMoneyWire` at the fold boundary (the same boundary the bond/FX
// adapters cross).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; Regulations Relating to Banks Reg 28(3)(a);
//   BCBS D352 §718(xi)–(xii); Principles/1-events-are-truth.md.
//
// Author: Atlas (Core banking platform architect, engineering).

import { minorFromMoneyWire } from "../core/money-codec";
import type { EventStore } from "../event-store/store";
import type {
  EquityTradingPositionClosedPayload,
  EquityTradingPositionOpenedPayload,
} from "../event-store/event-types/trading-book-positions";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import type { EquityRow } from "./ba-320-market-risk";

// ---------------------------------------------------------------------------
// Frozen-cursor replay option type (mirrors ba-320-bond-events-adapter.ts)
// ---------------------------------------------------------------------------

interface FrozenCursorOpts {
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Input contract
// ---------------------------------------------------------------------------

export interface EquityAdapterInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entity: string;
  /** Period-end ISO 8601 date-time. Positions opened ≤ periodEnd are folded. */
  readonly periodEnd: string;
  /** Event store — provides EquityTradingPosition{Opened,Closed}. */
  readonly eventStore: EventStore;
  /**
   * Upper bound (inclusive) on the event `sequence` column — frozen cursor.
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Per-market accumulator
// ---------------------------------------------------------------------------

interface MarketAccumulator {
  /** Σ |market value| of long positions in this market (minor units). */
  longMinor: number;
  /** Σ |market value| of short positions in this market (minor units). */
  shortMinor: number;
  /**
   * The diversification flag for the market. Per Reg 28(3)(a) the reduced 4%
   * specific weight applies to a liquid + well-diversified portfolio. We treat
   * the market as qualifying ONLY if EVERY folded position in it qualifies
   * (fail-closed — a single non-diversified single-name position in the market
   * pulls the whole market to the conservative 8% specific weight).
   */
  allLiquidAndDiversified: boolean;
  /** True once at least one position has been folded (so the AND below is sound). */
  seeded: boolean;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Derive the BA 320 equity position-risk rows from EquityTradingPositionOpened
 * events.
 *
 * Logic:
 *   1. Collect derecognised positionIds from EquityTradingPositionClosed.
 *   2. Replay EquityTradingPositionOpened ≤ periodEnd.
 *   3. Filter to trading-book positions only (banking-book → BA 340).
 *   4. Exclude derecognised positions.
 *   5. Net long/short per national market (long and short kept separate so the
 *      generator can compute |net| and gross).
 *   6. Emit one EquityRow per market with a non-zero position.
 *
 * Citations: Reg 28(3)(a); BCBS D352 §718(xi)–(xii); D-BA-RETURN-SIMULATOR-FIRST;
 *   Principles/1-events-are-truth.md.
 */
export function buildEquityRows(input: EquityAdapterInput): EquityRow[] {
  const { eventStore, entity, periodEnd, untilSequence } = input;
  const frozenCursorOpts: FrozenCursorOpts = untilSequence !== undefined ? { untilSequence } : {};
  const provenanceFilter = defaultProvenanceFilter();

  // ---- Step 1: collect derecognised position IDs ----
  const derecognisedPositionIds = new Set<string>();
  for (const ev of eventStore.replay({
    entity,
    type: "EquityTradingPositionClosed",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as EquityTradingPositionClosedPayload;
    if (p.positionId) derecognisedPositionIds.add(p.positionId);
  }

  // ---- Step 2: accumulate net long/short per market ----
  const byMarket = new Map<string, MarketAccumulator>();

  for (const ev of eventStore.replay({
    entity,
    type: "EquityTradingPositionOpened",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as EquityTradingPositionOpenedPayload;

    // Only trading-book equity enters BA 320. Banking-book → BA 340.
    if (p.bookType !== "trading") continue;
    // Exclude derecognised positions.
    if (derecognisedPositionIds.has(p.positionId)) continue;

    const valueMinor = Math.abs(minorFromMoneyWire(p.marketValue));
    const acc = byMarket.get(p.market) ?? {
      longMinor: 0,
      shortMinor: 0,
      allLiquidAndDiversified: true,
      seeded: false,
    };
    if (p.side === "long") acc.longMinor += valueMinor;
    else acc.shortMinor += valueMinor;
    // Fail-closed AND: the market qualifies for the reduced specific weight only
    // if every folded position qualifies. Index positions are diversified by
    // construction (carried as liquidAndDiversified=true by the emitter).
    acc.allLiquidAndDiversified = acc.allLiquidAndDiversified && p.liquidAndDiversified;
    acc.seeded = true;
    byMarket.set(p.market, acc);
  }

  // ---- Step 3: emit EquityRow[] in stable (sorted) market order ----
  const rows: EquityRow[] = [];
  for (const market of [...byMarket.keys()].sort()) {
    const acc = byMarket.get(market);
    if (!acc || !acc.seeded) continue;
    if (acc.longMinor === 0 && acc.shortMinor === 0) continue;
    rows.push({
      market,
      netLongMinusShortMinor: acc.longMinor - acc.shortMinor,
      grossLongPlusShortMinor: acc.longMinor + acc.shortMinor,
      liquidAndDiversified: acc.allLiquidAndDiversified,
    });
  }

  return rows;
}
