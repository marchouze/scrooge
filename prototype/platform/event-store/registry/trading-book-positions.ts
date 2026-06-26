// platform/event-store/registry/trading-book-positions.ts
//
// EVENT_TYPE_REGISTRY rows for the BORN-V2 trading-book position events
// (D-BA-RETURN-SIMULATOR-FIRST). These four events feed the BA 320 (Market
// Risk) equity + commodity position-risk folds — the streams the period-close
// subscriber previously filled with caller-supplied placeholder zeros.
//
// Born V2 — every row is tagged `v2-parallel` (never `v1-only`): the BA 320
// equity / commodity adapters read these events directly; there is no V1
// equivalent stream and none is created (V1-retirement directive — never widen
// the v1-only estate).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-MONEY-DECIMAL-REDENOMINATION;
//   Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(xi)–(xv).
//
// Retention: RETENTION_JSE_TRADE_7Y (trade-record retention norm).
//
// Author: Atlas (Core banking platform architect, engineering).

import {
  commodityTradingPositionClosedPayloadSchema,
  commodityTradingPositionOpenedPayloadSchema,
  equityTradingPositionClosedPayloadSchema,
  equityTradingPositionOpenedPayloadSchema,
} from "../event-types/trading-book-positions";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/trading-book-positions.ts";

/**
 * Registry rows for the born-V2 trading-book position event types.
 *
 * Subscribers:
 *   Mira (Regulatory reporting engineer) — BA 320 equity / commodity adapters.
 *   Bea (Accounting & financial reporting engineer) — BA-form line mapping.
 *   Helena (Chief Risk Officer) — market-risk methodology owner.
 *   Rohan (Market-risk quantitative engineer) — standardised position risk.
 *   Atlas (platform) — substrate / recon monitoring.
 *   Vera (internal audit engineer) — third-line assurance.
 */
export const TRADING_BOOK_POSITION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "EquityTradingPositionOpened",
    class: "markets",
    issuer: "Mira",
    subscribers: ["Mira", "Bea", "Helena", "Rohan", "Atlas", "Vera"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: equityTradingPositionOpenedPayloadSchema,
    citationsHint: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28", "BCBS-D352-718"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "EquityTradingPositionClosed",
    class: "markets",
    issuer: "Mira",
    subscribers: ["Mira", "Bea", "Helena", "Rohan", "Atlas", "Vera"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: equityTradingPositionClosedPayloadSchema,
    citationsHint: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "CommodityTradingPositionOpened",
    class: "markets",
    issuer: "Mira",
    subscribers: ["Mira", "Bea", "Helena", "Rohan", "Atlas", "Vera"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: commodityTradingPositionOpenedPayloadSchema,
    citationsHint: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28", "BCBS-D352-718"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "CommodityTradingPositionClosed",
    class: "markets",
    issuer: "Mira",
    subscribers: ["Mira", "Bea", "Helena", "Rohan", "Atlas", "Vera"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: commodityTradingPositionClosedPayloadSchema,
    citationsHint: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
];
