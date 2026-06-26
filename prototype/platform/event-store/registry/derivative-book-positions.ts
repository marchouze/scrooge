// platform/event-store/registry/derivative-book-positions.ts
//
// EVENT_TYPE_REGISTRY rows for the BORN-V2 derivative-book position events
// (D-BA-RETURN-SIMULATOR-FIRST Phase 2b). These two events feed the BA 350
// (Derivatives Instruments) notional + fair-value inventory fold and — for OTC
// positions — the CVA capital fold (the CVA engine reuses the same book).
//
// Born V2 — every row is tagged `v2-parallel` (never `v1-only`): the BA 350
// fold reads these events directly; there is no V1 equivalent stream and none
// is created (V1-retirement directive — never widen the v1-only estate).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-MONEY-DECIMAL-REDENOMINATION;
//   Regulations Relating to Banks Reg 28 / Reg 30; BCBS d424 MAR50.
//
// Retention: RETENTION_JSE_TRADE_7Y (trade-record retention norm).
//
// Author: Atlas (Core banking platform architect, engineering).

import {
  derivativePositionClosedPayloadSchema,
  derivativePositionOpenedPayloadSchema,
} from "../event-types/derivative-book-positions";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/derivative-book-positions.ts";

/**
 * Registry rows for the born-V2 derivative-book position event types.
 *
 * Subscribers:
 *   Mira (Regulatory reporting engineer) — BA 350 inventory fold.
 *   Bea (Accounting & financial reporting engineer) — BA-form line mapping.
 *   Helena (Chief Risk Officer) — CVA / counterparty-credit methodology owner.
 *   Rohan (Market-risk quantitative engineer) — CVA exposure / EPE sub-model.
 *   Atlas (platform) — substrate / recon monitoring.
 *   Vera (internal audit engineer) — third-line assurance.
 */
export const DERIVATIVE_BOOK_POSITION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "DerivativeTradingPositionOpened",
    class: "markets",
    issuer: "Mira",
    subscribers: ["Mira", "Bea", "Helena", "Rohan", "Atlas", "Vera"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: derivativePositionOpenedPayloadSchema,
    citationsHint: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28", "BCBS-D424-MAR50"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "DerivativeTradingPositionClosed",
    class: "markets",
    issuer: "Mira",
    subscribers: ["Mira", "Bea", "Helena", "Rohan", "Atlas", "Vera"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: derivativePositionClosedPayloadSchema,
    citationsHint: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
];
