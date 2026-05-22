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
// Updated: Anya (Data / analytics engineer, engineering) per D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

import type { Event } from "../../event-store/types";
import type {
  EquityCorporateActionAppliedPayload,
  EquitySettlementInstructedPayload,
  EquityTradeBookedPayload,
} from "../../markets/cdm/equity";
import type {
  FinancialInstrumentDefinedPayload,
  FinancialInstrumentClassifiedPayload,
  FinancialInstrumentDecomposedPayload,
  FinancialInstrumentReconstitutedPayload,
} from "../../markets/cdm/instrument";

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
// FinancialInstrument typed event-shape narrows.
//
// Per D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22): four lifecycle
// events for the unified FinancialInstrument entity. These aliases give
// reducers and projections a typed Event view without re-parsing payloads.
// ---------------------------------------------------------------------------

export type FinancialInstrumentDefinedEvent = Event & {
  readonly type: "FinancialInstrumentDefined";
  readonly payload: FinancialInstrumentDefinedPayload;
};

export type FinancialInstrumentClassifiedEvent = Event & {
  readonly type: "FinancialInstrumentClassified";
  readonly payload: FinancialInstrumentClassifiedPayload;
};

export type FinancialInstrumentDecomposedEvent = Event & {
  readonly type: "FinancialInstrumentDecomposed";
  readonly payload: FinancialInstrumentDecomposedPayload;
};

export type FinancialInstrumentReconstitutedEvent = Event & {
  readonly type: "FinancialInstrumentReconstituted";
  readonly payload: FinancialInstrumentReconstitutedPayload;
};

export type FinancialInstrumentEvent =
  | FinancialInstrumentDefinedEvent
  | FinancialInstrumentClassifiedEvent
  | FinancialInstrumentDecomposedEvent
  | FinancialInstrumentReconstitutedEvent;

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
// anchor the listed-equity domain. The mark-to-market entry cites
// BCBS-239-2013 for price-feed provenance / lineage discipline.
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
    citations: ["ORG-AC-05", "BCBS-239-2013"],
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
// FinancialInstrument semantic-layer entries.
//
// Per D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22). Five named
// quantities covering HQLA tier, IFRS 9 category, Basel risk weight,
// SA-CCR asset class, and ACTUS contract type. Each carries the full
// citation chain (CDM primitive → projection rule → presentation field).
// ---------------------------------------------------------------------------

export const FINANCIAL_INSTRUMENT_SEMANTIC_ENTRIES: readonly SemanticLayerEntry[] = [
  {
    id: "fi-instrument-hqla-level",
    name: "Financial instrument HQLA tier",
    definition:
      "HQLA tier classification (level-1 / level-2a / level-2b / non-hqla) for an instrument, " +
      "derived from the most-recent FinancialInstrumentClassified event for that instrumentId.",
    cdmPrimitive: "FinancialInstrumentClassified.hqlaLevel",
    projectionRule:
      "markets.security-master — latest FinancialInstrumentClassified.hqlaLevel per instrumentId",
    presentationField: "SecurityMaster ▸ Classification ▸ HQLA tier",
    citations: ["BA-325-LCR", "BCBS-LCR-2013", "D-FINANCIAL-INSTRUMENT-ENTITY"],
    unit: "tier-enum",
  },
  {
    id: "fi-instrument-ifrs9-category",
    name: "IFRS 9 measurement category",
    definition:
      "IFRS 9 §4.1 measurement category (amortised-cost / fvtoci / fvtpl / n-a) for an instrument, " +
      "derived from the most-recent FinancialInstrumentClassified event for that instrumentId.",
    cdmPrimitive: "FinancialInstrumentClassified.ifrs9Category",
    projectionRule:
      "markets.security-master — latest FinancialInstrumentClassified.ifrs9Category per instrumentId",
    presentationField: "SecurityMaster ▸ Classification ▸ IFRS 9 category",
    citations: ["IFRS-9-§4.1", "D-FINANCIAL-INSTRUMENT-ENTITY"],
    unit: "category-enum",
  },
  {
    id: "fi-instrument-basel-risk-weight",
    name: "Basel SA risk weight",
    definition:
      "Basel III standardised-approach risk weight (0pct / 20pct / 50pct / 100pct / 150pct / deducted) " +
      "for an instrument, driving RWA computation for capital adequacy.",
    cdmPrimitive: "FinancialInstrumentClassified.baselRiskWeight",
    projectionRule:
      "markets.security-master — latest FinancialInstrumentClassified.baselRiskWeight per instrumentId",
    presentationField: "SecurityMaster ▸ Classification ▸ Basel risk weight",
    citations: ["BCBS-SA-2017", "RRB-REG-23", "D-FINANCIAL-INSTRUMENT-ENTITY"],
    unit: "percent-enum",
  },
  {
    id: "fi-instrument-sacr-asset-class",
    name: "SA-CCR asset class",
    definition:
      "SA-CCR asset class (interest-rate / fx / credit / equity / commodity / n-a) for an instrument, " +
      "used in derivative exposure-at-default calculation under BCBS 279.",
    cdmPrimitive: "FinancialInstrumentClassified.saCcrAssetClass",
    projectionRule:
      "markets.security-master — latest FinancialInstrumentClassified.saCcrAssetClass per instrumentId",
    presentationField: "SecurityMaster ▸ Classification ▸ SA-CCR asset class",
    citations: ["BCBS-279", "RRB-REG-23-APP-I", "D-FINANCIAL-INSTRUMENT-ENTITY"],
    unit: "asset-class-enum",
  },
  {
    id: "fi-instrument-actus-type",
    name: "ACTUS contract type",
    definition:
      "ACTUS Financial Research Foundation contract-type code (PAM / STK / IRS / FXOUT / CLM / CSH / ZCB / CMP) " +
      "assigned at instrument definition; immutable after the FinancialInstrumentDefined event is appended.",
    cdmPrimitive: "FinancialInstrumentDefined.actusContractType",
    projectionRule:
      "markets.security-master — FinancialInstrumentDefined.actusContractType, immutable after definition",
    presentationField: "SecurityMaster ▸ Definition ▸ ACTUS contract type",
    citations: ["ACTUS-FRF-V1.1", "D-FINANCIAL-INSTRUMENT-ENTITY"],
    unit: "contract-type-enum",
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
  "markets.security-master",
] as const;

export type MarketsProjectionName = (typeof MARKETS_PROJECTION_NAMES)[number];
