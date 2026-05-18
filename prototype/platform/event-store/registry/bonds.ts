// platform/event-store/registry/bonds.ts
//
// JSE bond lifecycle accounting event-type registry rows.
//
// Covers:
//   BondTradeExecuted, BondInterestAccrued, BondPositionRevalued,
//   BondMatured, BondSold
//
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18);
//   IFRS 9 §3.1.1, §3.2.3, §5.1.1, §5.4.1, §5.7.1;
//   Banks Act 94 of 1990; JSE Debt Listings Requirements.
//
// Retention classification:
//   - All bond lifecycle events → RETENTION_JSE_TRADE_7Y
//     (JSE Equities/Debt Rules + Banks Act record-keeping, 7-year floor).
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import {
  bondInterestAccruedPayloadSchema,
  bondMaturedPayloadSchema,
  bondPositionRevaluedPayloadSchema,
  bondSoldPayloadSchema,
  bondTradeExecutedPayloadSchema,
} from "../event-types/bond-accounting";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * JSE bond lifecycle accounting event-type registry rows.
 *
 * Subscribers:
 *   Bea (Accounting & financial reporting engineer) — all bond events for GL posting.
 *   Camille (CFO) — bond lifecycle for financial reporting.
 *   Helena (CRO) — bond positions for risk oversight.
 *   Atlas (platform) — all events for substrate monitoring.
 */
export const BOND_ACCOUNTING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "BondTradeExecuted",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondTradeExecutedPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-3-1-1", "IFRS9-5-1-1"],
    source: "platform/event-store/event-types/bond-accounting.ts",
  },
  {
    type: "BondInterestAccrued",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondInterestAccruedPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-5-4-1"],
    source: "platform/event-store/event-types/bond-accounting.ts",
  },
  {
    type: "BondPositionRevalued",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondPositionRevaluedPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-5-7-1"],
    source: "platform/event-store/event-types/bond-accounting.ts",
  },
  {
    type: "BondMatured",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondMaturedPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-3-2-3"],
    source: "platform/event-store/event-types/bond-accounting.ts",
  },
  {
    type: "BondSold",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondSoldPayloadSchema,
    citationsHint: ["D-TRADE-LIFECYCLE-IFRS-CHAIN", "IFRS9-3-2-3"],
    source: "platform/event-store/event-types/bond-accounting.ts",
  },
];
