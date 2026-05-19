// platform/event-store/registry/mtm.ts
//
// MTM (mark-to-market) engine event-type registry rows.
//
// Covers:
//   MtmRunCompleted   — end-of-MTM-run summary (positions valued, skipped,
//                       total P&L delta). Issued by the mtm:run script.
//   IpvExceptionRaised — IPV tolerance breach for a single position: primary
//                       rate diverges from secondary source beyond 0.25% or
//                       ZAR 50k. Issued by the mtm:run script during IPV pass.
//
// Retention classification:
//   Both events → RETENTION_JSE_TRADE_7Y (market risk control records;
//   Banks Act 94 of 1990 §7-year retention norm for trading records).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved);
//   D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
//   IFRS-9-§5.7.1; ORG-MK-08.
// Author: Rohan (Market risk engineer, engineering)

import { ipvExceptionRaisedPayloadSchema, mtmRunCompletedPayloadSchema } from "../event-types/mtm";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * MTM engine event-type registry rows.
 *
 * Subscribers:
 *   Rohan (Market risk engineer, engineering) — primary author / consumer.
 *   Helena (Chief Risk Officer, governance) — RAS market-risk monitoring.
 *   Bea (Accounting & financial reporting engineer, engineering) — P&L chain.
 *   Mira (Regulatory reporting engineer, engineering) — FinSurv inputs.
 *   Atlas (platform) — substrate monitoring.
 */
export const MTM_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "MtmRunCompleted",
    class: "markets",
    issuer: "Rohan",
    subscribers: ["Rohan", "Helena", "Bea", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: mtmRunCompletedPayloadSchema,
    citationsHint: [
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-FX-SALES-TRADING-FRONTEND",
      "IFRS-9-§5.7.1",
      "ORG-MK-08",
    ],
    source: "platform/event-store/event-types/mtm.ts",
  },
  {
    type: "IpvExceptionRaised",
    class: "markets",
    issuer: "Rohan",
    subscribers: ["Rohan", "Helena"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: ipvExceptionRaisedPayloadSchema,
    citationsHint: ["D-MARKETS-SCHEMA-FOUNDATION", "D-FX-SALES-TRADING-FRONTEND", "ORG-MK-08"],
    source: "platform/event-store/event-types/mtm.ts",
  },
];
