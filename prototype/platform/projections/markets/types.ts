// platform/projections/markets/types.ts
//
// Shared types + semantic-layer entries for the M1 markets projections.
//
// Per CLAUDE.md Principle 1, every quantity below is a *query* over the
// canonical equity event log. The reducer is the rule; the event log is
// the truth. Per Principle 2, every named quantity carries a citation
// chain (CDM primitive → projection rule → presentation field).
//
// Author: Anya · M1 per D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07).

import type { Event } from "../../event-store/types";
import type {
  EquityCorporateActionAppliedPayload,
  EquitySettlementInstructedPayload,
  EquityTradeBookedPayload,
} from "../../markets/cdm/equity";

// ---------------------------------------------------------------------------
// Strongly-typed event-shape narrows. The CDM module already validates the
// payload at append; these aliases give the reducers a typed Event view
// without paying the schema-parse cost on every fold step.
// ---------------------------------------------------------------------------

export type EquityTradeBookedEvent = Event & {
  readonly type: "EquityTradeBooked";
  readonly payload: EquityTradeBookedPayload;
};

export type EquityCorporateActionAppliedEvent = Event & {
  readonly type: "EquityCorporateActionApplied";
  readonly payload: EquityCorporateActionAppliedPayload;
};

export type EquitySettlementInstructedEvent = Event & {
  readonly type: "EquitySettlementInstructed";
  readonly payload: EquitySettlementInstructedPayload;
};

export type EquityLifecycleEvent =
  | EquityTradeBookedEvent
  | EquityCorporateActionAppliedEvent
  | EquitySettlementInstructedEvent;

// ---------------------------------------------------------------------------
// Semantic-layer entry shape.
//
// Each named quantity (e.g. equity-position-quantity) resolves to a single
// canonical definition with the citation chain that justifies it. The
// chain has three rungs per the M1 brief §3:
//
//   - cdmPrimitive — the CDM event-type or primitive that the quantity
//                    derives from.
//   - projectionRule — the projection name + reducer behaviour.
//   - presentationField — the dashboard / report field this entry feeds.
//
// citations[] is the obligations-register hook (Principle 2). When a
// citation does not yet exist in the register the value is a string
// of the form "[citation: route to Mira]" so Vera's URN-coverage recon
// surfaces the gap.
// ---------------------------------------------------------------------------

export interface SemanticLayerEntry {
  /** Stable id used as the cross-reference key. */
  readonly id: string;
  /** Human-readable name (matches the dashboard / report column). */
  readonly name: string;
  /** One-line definition (terse; not narrative). */
  readonly definition: string;
  /** CDM event-type or primitive that the quantity derives from. */
  readonly cdmPrimitive: string;
  /** Projection name + reducer behaviour the quantity is computed by. */
  readonly projectionRule: string;
  /** Presentation field the quantity surfaces in. */
  readonly presentationField: string;
  /** Obligations-register IDs (and route-to-Mira flags). */
  readonly citations: readonly string[];
  /** Unit of measurement — share count, currency code, or "ratio". */
  readonly unit: string;
}

// ---------------------------------------------------------------------------
// M1 semantic-layer entries.
//
// Four named quantities per the brief §3:
//   - equity-position-quantity
//   - equity-position-average-cost
//   - equity-position-mark-to-market
//   - equity-position-unrealised-pnl
//
// Each carries the citation chain CDM-primitive → projection-rule →
// presentation-field. ORG-AC-01 (IFRS 9) gates classification; ORG-AC-05
// (IFRS 13) gates fair-value measurement; JSE-RULES-EQUITIES + FMA-S5
// anchor the listed-equity domain. The mark-to-market entry routes
// price-feed provenance to Mira (no PRICE-FEED-PROVENANCE register
// entry yet).
// ---------------------------------------------------------------------------

export const SEMANTIC_LAYER_ENTRIES: readonly SemanticLayerEntry[] = [
  {
    id: "equity-position-quantity",
    name: "Equity position quantity",
    definition:
      "Net shares held per (entity, instrument, bookId) at as-of, derived from EquityTradeBooked side+quantity and EquityCorporateActionApplied ratios.",
    cdmPrimitive: "EquityTradeBooked.quantity (signed by side); EquityCorporateActionApplied.ratio",
    projectionRule:
      "markets.position — fold(state, event): buy ⇒ +qty, sell ⇒ −qty; corporate-action ratio applies multiplicatively at exDate.",
    presentationField: "Markets ▸ Position ▸ Quantity",
    citations: ["JSE-RULES-EQUITIES", "FMA-S5", "ORG-AC-01"],
    unit: "share",
  },
  {
    id: "equity-position-average-cost",
    name: "Equity position average cost",
    definition:
      "Weighted-average acquisition cost per share for the open position. Resets only on full close-out per the moving-average-cost convention used by Bea's IFRS sub-ledger.",
    cdmPrimitive: "EquityTradeBooked.consideration / EquityTradeBooked.quantity",
    projectionRule:
      "markets.position — moving-weighted-average over buys; sells reduce quantity at the existing average; full close-out resets to zero before the next buy seeds a new average.",
    presentationField: "Markets ▸ Position ▸ Average cost",
    citations: ["ORG-AC-01", "ORG-AC-05"],
    unit: "currency-per-share",
  },
  {
    id: "equity-position-mark-to-market",
    name: "Equity position mark-to-market",
    definition:
      "Position value at the most recent mark price × quantity. M1 sources mark price from the most recent EquityTradeBooked.price for the instrument; v0 placeholder until Anya's market-data substrate (M2) supplies a separate price feed.",
    cdmPrimitive: "EquityTradeBooked.price (most-recent); position quantity",
    projectionRule:
      "markets.position — quantity × latest-EquityTradeBooked-price-by-instrument. M2 swaps in a market-data feed; reducer signature is stable.",
    presentationField: "Markets ▸ Position ▸ Mark-to-market",
    citations: ["ORG-AC-05", "[citation: route to Mira] PRICE-FEED-PROVENANCE"],
    unit: "currency",
  },
  {
    id: "equity-position-unrealised-pnl",
    name: "Equity position unrealised P&L",
    definition:
      "(mark-to-market − average-cost × quantity) for the open position. Currency is the trade currency; FX translation to reporting currency is a separate Anya projection (M2).",
    cdmPrimitive:
      "Derived: equity-position-mark-to-market − (equity-position-average-cost × equity-position-quantity)",
    projectionRule:
      "markets.position — pure derivation from the three quantities above; no event ingest of its own.",
    presentationField: "Markets ▸ P&L ▸ Unrealised",
    citations: ["ORG-AC-01", "ORG-AC-05", "ORG-PR-19"],
    unit: "currency",
  },
];

// ---------------------------------------------------------------------------
// Markets-projection identifiers — stable names used by the runtime
// registration event (`MarketsProjectionRegistered.payload.projectionName`)
// and by Vera's reconciliation harness.
// ---------------------------------------------------------------------------

export const MARKETS_PROJECTION_NAMES = [
  "markets.trade-record",
  "markets.position",
  "markets.sub-ledger",
] as const;

export type MarketsProjectionName = (typeof MARKETS_PROJECTION_NAMES)[number];
