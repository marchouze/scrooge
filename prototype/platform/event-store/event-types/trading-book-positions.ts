// platform/event-store/event-types/trading-book-positions.ts
//
// Born-V2 trading-book position events for the BA 320 (Market Risk) equity- and
// commodity-position-risk folds. These are the event streams that the BA 320
// standardised-position-risk engine (`platform/reporting/ba-320-market-risk.ts`)
// needs for its equity + commodity risk classes — the streams the period-close
// subscriber previously had to fill with caller-supplied placeholder zeros
// ("// TODO: derive from EquityPositionOpened events").
//
// ── WHY THESE EVENTS EXIST ─────────────────────────────────────────────────
// The BA 320 engine ALREADY implements equity position risk (Reg 28(3)(a) /
// BCBS D352 §718(xi)–(xii): 8% general + 8%/4% specific) and commodity risk
// (simplified method: 15% net + 3% gross — §718(xv)). What it lacked was an
// EVENTS-FIRST input for those two risk classes: there was no
// `EquityTradingPositionOpened` / `CommodityTradingPositionOpened` stream for an
// adapter to fold (Principle 1). The CDM `EquityTradeExecuted` lifecycle event
// (`platform/markets/cdm/equity.ts`) carries trade fills but NOT the FRTB
// trading/banking-book designation (`bookType` + `deskId`) the BA 320 fold needs
// to separate trading-book positions (which incur BA 320 market risk) from
// banking-book positions (which do NOT — banking-book equity is BA 340; IRRBB is
// BA 330). Rather than widen the broadly-subscribed v1-only CDM event, these
// purpose-built born-V2 position events carry the FRTB desk allocation + the
// risk-class fields the standardised charge needs, and nothing else.
//
// ── FRTB DESK BOUNDARY ─────────────────────────────────────────────────────
// Every position carries `deskId` + `bookType`. Only `bookType: "trading"`
// positions enter BA 320 market risk. The desk is resolved against the canonical
// FRTB desk roster (`v2-core/desk/roster.ts`); `recon:frtb-desk-integrity`
// asserts the boundary. A banking-book (treasury) desk on a trading position is
// a finding — these events DO NOT enforce desk membership at parse time (the
// roster is an event-sourced register, not a compile-time constant the schema
// can import without a v2→v1 cycle); the recon gate is the runtime authority.
//
// ── DECIMAL-NATIVE MONEY (D-MONEY-DECIMAL-REDENOMINATION) ────────────────────
// All monetary values are MoneyWire (canonical decimal-string MAJOR units),
// never minor-unit integers. The BA 320 adapters convert to the engine's
// minor-unit `number` contract at the fold boundary via `minorFromMoneyWire`
// (the same boundary the bond/FX adapters cross).
//
// Authority:
//   - D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26)
//   - D-FX-V2-SIMULATOR-FIRST (the simulator-first principle this extends)
//   - D-FRTB-TRADING-DESK-STRUCTURE (CEO-approved 2026-06-21)
//   - D-MONEY-DECIMAL-REDENOMINATION; D-MONEY-DECIMAL-BUILD-PROCEED
//   - Regulations Relating to Banks Reg 28(3)(a) (equity + commodity position risk)
//   - BCBS D352 §718(xi)–(xv) (standardised equity + commodity charge)
//   - Principle 1 (events are truth); Principle 2 (single-graph); Principle 5
//     (currency at the type level)
//
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { moneyWireSchema } from "../../core/money-codec";
import { type Actor, type Event, type ProvenanceTag, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

/**
 * FRTB book type. Only `trading` positions enter BA 320 market risk;
 * `banking-treasury` positions are out of scope (BA 330 IRRBB / BA 340 banking-
 * book equity). Mirrors `v2-core/desk` `DeskBookType`.
 */
export const tradingBookTypeSchema = z.enum(["trading", "banking-treasury"]);

/** Side of the position from the bank's perspective. */
export const positionSideSchema = z.enum(["long", "short"]);

// ---------------------------------------------------------------------------
// EquityTradingPositionOpened
//
// A trading-book equity (single-name or index) position is opened. Feeds the
// BA 320 equity position-risk fold (Reg 28(3)(a); BCBS D352 §718(xi)–(xii)):
//   general charge  = 8% × |net (long − short)| per national market
//   specific charge = 8% × gross (long + short), reduced to 4% where the market
//                     is liquid and well-diversified (and an index for the
//                     index-specific add-on).
// ---------------------------------------------------------------------------

export const equityTradingPositionOpenedPayloadSchema = z.object({
  /** Stable position identifier (one open position; closed by a matching close event). */
  positionId: z.string().min(1),
  /** Instrument identifier — JSE alpha code or ISIN. */
  instrumentId: z.string().min(1),
  /** Human-readable instrument name (e.g. "Naspers N", "FTSE/JSE Top 40 index"). */
  instrumentName: z.string().min(1),
  /**
   * National equity market the instrument belongs to — the BA 320 equity charge
   * is computed per national market (Reg 28(3)(a); positions in different
   * markets are NOT netted). E.g. "JSE", "LSE".
   */
  market: z.string().min(1),
  /**
   * True when the position is an equity INDEX (basket / futures), not a
   * single name. Index positions attract the index-specific add-on
   * (Reg 28(3)(a); BCBS D352 §718(xii)) and qualify for the diversified
   * treatment by construction.
   */
  isIndex: z.boolean(),
  /** Position side (long / short). */
  side: positionSideSchema,
  /** Number of shares / index units (positive integer). */
  quantity: z.number().int().positive(),
  /** Mark-to-market value of the position (MAJOR-unit decimal money, ABSOLUTE). */
  marketValue: moneyWireSchema,
  /**
   * True if the market is liquid AND the position diversified enough to qualify
   * for the reduced 4% specific-risk weight (Reg 28(3)(a); BCBS D352 §718(xi)).
   * Index positions are diversified by construction.
   */
  liquidAndDiversified: z.boolean(),
  /** FRTB desk this position is booked to (canonical desk roster id). */
  deskId: z.string().min(1),
  /** FRTB book type — only `trading` enters BA 320. */
  bookType: tradingBookTypeSchema,
  /** ISO 8601 — date the position was opened. */
  openedDate: z.string().min(1),
});

export type EquityTradingPositionOpenedPayload = z.infer<
  typeof equityTradingPositionOpenedPayloadSchema
>;

export function makeEquityTradingPositionOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquityTradingPositionOpenedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("EquityTradingPositionOpened requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquityTradingPositionOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equityTradingPositionOpenedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// EquityTradingPositionClosed — derecognition (sale / unwind / expiry).
// ---------------------------------------------------------------------------

export const equityTradingPositionClosedPayloadSchema = z.object({
  /** The position being closed (matches an EquityTradingPositionOpened.positionId). */
  positionId: z.string().min(1),
  /** ISO 8601 — date the position was closed. */
  closedDate: z.string().min(1),
});

export type EquityTradingPositionClosedPayload = z.infer<
  typeof equityTradingPositionClosedPayloadSchema
>;

export function makeEquityTradingPositionClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquityTradingPositionClosedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("EquityTradingPositionClosed requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquityTradingPositionClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equityTradingPositionClosedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// CommodityTradingPositionOpened
//
// A trading-book commodity position is opened. Feeds the BA 320 commodity-risk
// fold under the SIMPLIFIED METHOD (Reg 28(3)(a); BCBS D352 §718(xv)):
//   charge = 15% × |net position| + 3% × gross position
// per commodity. (The maturity-ladder method — Reg 28 R0730 — is the more
// granular alternative; the simplified method is the build-phase default the
// engine implements.)
// ---------------------------------------------------------------------------

/**
 * Commodity group per Reg 28 BA 320 memorandum rows (R0770–R0800):
 *   precious-metals, agricultural, minerals, base-metals.
 * Gold is FX-and-gold (BA 320 R0150), NOT a commodity — excluded here.
 */
export const commodityGroupSchema = z.enum([
  "precious-metals",
  "agricultural",
  "minerals",
  "base-metals",
]);

export type CommodityGroup = z.infer<typeof commodityGroupSchema>;

export const commodityTradingPositionOpenedPayloadSchema = z.object({
  /** Stable position identifier. */
  positionId: z.string().min(1),
  /** Commodity identifier (e.g. "XPT" platinum, "BRENT", "MAIZE"). */
  commodity: z.string().min(1),
  /** Human-readable commodity name. */
  commodityName: z.string().min(1),
  /** Reg 28 BA 320 commodity memorandum group. */
  group: commodityGroupSchema,
  /** Position side (long / short). */
  side: positionSideSchema,
  /** Quantity in the commodity's standard unit (lots / ounces / tonnes). */
  quantity: z.number().positive(),
  /** Mark-to-market value of the position (MAJOR-unit decimal money, ABSOLUTE). */
  marketValue: moneyWireSchema,
  /** FRTB desk this position is booked to. */
  deskId: z.string().min(1),
  /** FRTB book type — only `trading` enters BA 320. */
  bookType: tradingBookTypeSchema,
  /** ISO 8601 — date the position was opened. */
  openedDate: z.string().min(1),
});

export type CommodityTradingPositionOpenedPayload = z.infer<
  typeof commodityTradingPositionOpenedPayloadSchema
>;

export function makeCommodityTradingPositionOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CommodityTradingPositionOpenedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("CommodityTradingPositionOpened requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CommodityTradingPositionOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: commodityTradingPositionOpenedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// CommodityTradingPositionClosed — derecognition.
// ---------------------------------------------------------------------------

export const commodityTradingPositionClosedPayloadSchema = z.object({
  /** The position being closed. */
  positionId: z.string().min(1),
  /** ISO 8601 — date the position was closed. */
  closedDate: z.string().min(1),
});

export type CommodityTradingPositionClosedPayload = z.infer<
  typeof commodityTradingPositionClosedPayloadSchema
>;

export function makeCommodityTradingPositionClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CommodityTradingPositionClosedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("CommodityTradingPositionClosed requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CommodityTradingPositionClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: commodityTradingPositionClosedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// Registry vocabulary
// ---------------------------------------------------------------------------

export const TRADING_BOOK_POSITION_EVENT_TYPES = [
  "EquityTradingPositionOpened",
  "EquityTradingPositionClosed",
  "CommodityTradingPositionOpened",
  "CommodityTradingPositionClosed",
] as const;

export type TradingBookPositionEventType = (typeof TRADING_BOOK_POSITION_EVENT_TYPES)[number];
