// platform/event-store/registry/ird-swaps.ts
//
// IFRS 9 GL-specific OTC IRD swap accounting event-type registry rows.
//
// Events registered:
//   IrdSwapTradeExecuted   — initial recognition (at-market or off-market)
//   IrdSwapPositionRevalued — FVTPL NPV re-measurement
//   IrdSwapCouponSettled   — net coupon cash settlement
//   IrdSwapTerminated      — derecognition on termination
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18);
//   IFRS 9 §3.2.3, §4.1.4, §5.7.1;
//   Banks Act 94 of 1990.
//
// Retention classification:
//   All IRD lifecycle events → RETENTION_JSE_TRADE_7Y (OTC derivatives
//   documented under ISDA Master Agreement; retention mirrors JSE trade
//   retention for symmetry with bond/equity books).
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import {
  irdSwapCouponSettledPayloadSchema,
  irdSwapPositionRevaluedPayloadSchema,
  irdSwapTerminatedPayloadSchema,
  irdSwapTradeExecutedPayloadSchema,
} from "../event-types/ird-accounting";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * IFRS 9 GL-specific OTC IRD swap accounting event-type registry rows.
 *
 * Subscribers:
 *   Bea (Accounting & financial reporting engineer) — GL posting.
 *   Camille (CFO) — IRD lifecycle for financial reporting.
 *   Atlas (platform) — substrate monitoring.
 */
export const IRD_ACCOUNTING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "IrdSwapTradeExecuted",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: irdSwapTradeExecutedPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-4-1-4"],
    source: "platform/event-store/event-types/ird-accounting.ts",
  },
  {
    type: "IrdSwapPositionRevalued",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: irdSwapPositionRevaluedPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-5-7-1"],
    source: "platform/event-store/event-types/ird-accounting.ts",
  },
  {
    type: "IrdSwapCouponSettled",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: irdSwapCouponSettledPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-5-7-1"],
    source: "platform/event-store/event-types/ird-accounting.ts",
  },
  {
    type: "IrdSwapTerminated",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: irdSwapTerminatedPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-3-2-3"],
    source: "platform/event-store/event-types/ird-accounting.ts",
  },
];
