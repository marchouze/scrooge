// platform/reporting/ba-320-commodity-events-adapter.ts
//
// Derives the BA 320 commodity position-risk rows from
// CommodityTradingPositionOpened events (minus CommodityTradingPositionClosed
// derecognitions). Fills the `Ba320PeriodCloseSubscriberInput.commodity` field
// which was previously a caller-supplied placeholder (empty array → zero charge,
// per D-MARKETS-CAPITAL-TIME-SHAPE).
//
// Only TRADING-BOOK positions incur BA 320 commodity risk.
//
// Design (mirrors ba-320-bond-events-adapter.ts):
//   CommodityTradingPositionOpened (bookType="trading") events
//     → derecognise via CommodityTradingPositionClosed
//     → net long/short per COMMODITY (positions in different commodities are NOT
//       netted under the simplified method)
//     → aggregate into CommodityPositionRow[] (net = long − short; gross = long + short)
//
// The pure BA 320 generator (`ba-320-market-risk.ts`) then computes, per
// commodity, the SIMPLIFIED-METHOD charge (Reg 28(3)(a); BCBS D352 §718(xv)):
//   charge = 15% × |net| + 3% × gross
//
// DECIMAL-NATIVE: the event payloads carry MoneyWire (major-unit decimal); this
// adapter converts to the engine's minor-unit `number` contract via
// `minorFromMoneyWire` at the fold boundary.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; Regulations Relating to Banks Reg 28(3)(a);
//   BCBS D352 §718(xv); Principles/1-events-are-truth.md.
//
// Author: Atlas (Core banking platform architect, engineering).

import { minorFromMoneyWire } from "../core/money-codec";
import type {
  CommodityTradingPositionClosedPayload,
  CommodityTradingPositionOpenedPayload,
} from "../event-store/event-types/trading-book-positions";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import type { CommodityPositionRow } from "./ba-320-market-risk";

// ---------------------------------------------------------------------------
// Frozen-cursor replay option type (mirrors ba-320-bond-events-adapter.ts)
// ---------------------------------------------------------------------------

interface FrozenCursorOpts {
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Input contract
// ---------------------------------------------------------------------------

export interface CommodityAdapterInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). */
  readonly entity: string;
  /** Period-end ISO 8601 date-time. Positions opened ≤ periodEnd are folded. */
  readonly periodEnd: string;
  /** Event store — provides CommodityTradingPosition{Opened,Closed}. */
  readonly eventStore: EventStore;
  /**
   * Upper bound (inclusive) on the event `sequence` column — frozen cursor.
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  readonly untilSequence?: number;
}

// ---------------------------------------------------------------------------
// Per-commodity accumulator
// ---------------------------------------------------------------------------

interface CommodityAccumulator {
  longMinor: number;
  shortMinor: number;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Derive the BA 320 commodity position-risk rows from
 * CommodityTradingPositionOpened events.
 *
 * Logic:
 *   1. Collect derecognised positionIds from CommodityTradingPositionClosed.
 *   2. Replay CommodityTradingPositionOpened ≤ periodEnd.
 *   3. Filter to trading-book positions only.
 *   4. Exclude derecognised positions.
 *   5. Net long/short per commodity.
 *   6. Emit one CommodityPositionRow per commodity with a non-zero position.
 *
 * Citations: Reg 28(3)(a); BCBS D352 §718(xv); D-BA-RETURN-SIMULATOR-FIRST;
 *   Principles/1-events-are-truth.md.
 */
export function buildCommodityRows(input: CommodityAdapterInput): CommodityPositionRow[] {
  const { eventStore, entity, periodEnd, untilSequence } = input;
  const frozenCursorOpts: FrozenCursorOpts = untilSequence !== undefined ? { untilSequence } : {};
  const provenanceFilter = defaultProvenanceFilter();

  // ---- Step 1: collect derecognised position IDs ----
  const derecognisedPositionIds = new Set<string>();
  for (const ev of eventStore.replay({
    entity,
    type: "CommodityTradingPositionClosed",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as CommodityTradingPositionClosedPayload;
    if (p.positionId) derecognisedPositionIds.add(p.positionId);
  }

  // ---- Step 2: accumulate net long/short per commodity ----
  const byCommodity = new Map<string, CommodityAccumulator>();

  for (const ev of eventStore.replay({
    entity,
    type: "CommodityTradingPositionOpened",
    asOf: periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as CommodityTradingPositionOpenedPayload;

    // Only trading-book commodity enters BA 320.
    if (p.bookType !== "trading") continue;
    // Exclude derecognised positions.
    if (derecognisedPositionIds.has(p.positionId)) continue;

    const valueMinor = Math.abs(minorFromMoneyWire(p.marketValue));
    const acc = byCommodity.get(p.commodity) ?? { longMinor: 0, shortMinor: 0 };
    if (p.side === "long") acc.longMinor += valueMinor;
    else acc.shortMinor += valueMinor;
    byCommodity.set(p.commodity, acc);
  }

  // ---- Step 3: emit CommodityPositionRow[] in stable (sorted) order ----
  const rows: CommodityPositionRow[] = [];
  for (const commodity of [...byCommodity.keys()].sort()) {
    const acc = byCommodity.get(commodity);
    if (!acc) continue;
    if (acc.longMinor === 0 && acc.shortMinor === 0) continue;
    rows.push({
      commodity,
      netPositionMinor: acc.longMinor - acc.shortMinor,
      grossPositionMinor: acc.longMinor + acc.shortMinor,
    });
  }

  return rows;
}
