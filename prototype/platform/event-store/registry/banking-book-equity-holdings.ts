// platform/event-store/registry/banking-book-equity-holdings.ts
//
// EVENT_TYPE_REGISTRY rows for the BORN-V2 banking-book equity-holding events
// (D-BA-RETURN-SIMULATOR-FIRST Phase 2c). These two events feed the BA 340
// (Equity Risk in the Banking Book) simple-risk-weight engine — the engine that
// did NOT exist before this slice (BA 340 was contract-only).
//
// Born V2 — every row is tagged `v2-parallel` (never `v1-only`): the BA 340
// fold reads these events directly; there is no V1 equivalent stream and none
// is created (V1-retirement directive — never widen the v1-only estate).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-MONEY-DECIMAL-REDENOMINATION;
//   Regulations Relating to Banks Reg 31 (equity risk in the banking book —
//   simple risk-weight method); Reg 38 (8% min ratio); Basel CRE.
//
// Retention: RETENTION_JSE_TRADE_7Y (equity-holding record retention norm —
//   same 7-year basis as the trading-book position events).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  bankingBookEquityHoldingClosedPayloadSchema,
  bankingBookEquityHoldingOpenedPayloadSchema,
} from "../event-types/banking-book-equity-holdings";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/banking-book-equity-holdings.ts";

/**
 * Registry rows for the born-V2 banking-book equity-holding event types.
 *
 * Subscribers:
 *   Mira (Regulatory reporting engineer) — BA 340 fold.
 *   Bea (Accounting & financial reporting engineer) — BA-form line mapping + engine owner.
 *   Helena (Chief Risk Officer) — banking-book equity-risk methodology owner.
 *   Atlas (platform) — substrate / recon monitoring.
 *   Vera (internal audit engineer) — third-line assurance.
 */
export const BANKING_BOOK_EQUITY_HOLDING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "BankingBookEquityHoldingOpened",
    class: "markets",
    issuer: "Mira",
    subscribers: ["Mira", "Bea", "Helena", "Atlas", "Vera"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bankingBookEquityHoldingOpenedPayloadSchema,
    citationsHint: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-31", "BASEL-CRE-EQUITY"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "BankingBookEquityHoldingClosed",
    class: "markets",
    issuer: "Mira",
    subscribers: ["Mira", "Bea", "Helena", "Atlas", "Vera"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bankingBookEquityHoldingClosedPayloadSchema,
    citationsHint: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-31"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
];
