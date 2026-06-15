// platform/event-store/registry/equities.ts
//
// IFRS 9 GL-specific equity accounting event-type registry rows.
//
// NOTE: The CDM equity lifecycle event types (EquityTradeExecuted,
// EquityPositionRevalued, EquitySettlementConfirmed, etc.) are already
// registered in markets.ts (Kai). This module registers only the two
// GL-specific events that CDM does not define:
//
//   EquityDividendAccrued  — dividend accrual with WHT fields (Bea)
//   EquitySold             — IFRS 9-classified sale with OCI reclassification (Bea)
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18);
//   IFRS 9 §3.2.3, §5.7.1A, §5.7.5; IAS 32 §35;
//   Banks Act 94 of 1990; JSE Equities Rules.
//
// Retention classification:
//   - All equity lifecycle events → RETENTION_JSE_TRADE_7Y
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import {
  equityDividendAccruedPayloadSchema,
  equitySoldPayloadSchema,
} from "../event-types/equity-accounting";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * IFRS 9 GL-specific equity accounting event-type registry rows.
 *
 * Subscribers:
 *   Bea (Accounting & financial reporting engineer) — GL posting.
 *   Camille (CFO) — equity lifecycle for financial reporting.
 *   Atlas (platform) — substrate monitoring.
 */
export const EQUITY_ACCOUNTING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "EquityDividendAccrued",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: equityDividendAccruedPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-5-7-1A"],
    source: "platform/event-store/event-types/equity-accounting.ts",
    v2Status: "v1-only",
  },
  {
    type: "EquitySold",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: equitySoldPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-3-2-3", "IFRS9-5-7-5"],
    source: "platform/event-store/event-types/equity-accounting.ts",
    v2Status: "v1-only",
  },
];
