// platform/event-store/registry/mtm.ts
//
// MTM (mark-to-market) engine event-type registry rows.
//
// Covers:
//   MtmRunCompleted   — end-of-MTM-run summary (positions valued, skipped,
//                       total P&L delta). Issued by the mtm:run script.
//   IpvExceptionRaised — IPV tolerance breach in LIVE mode: primary rate
//                       diverges from secondary source beyond the per-pair
//                       (or default) bps / absolute thresholds. Lifts into
//                       the live appetite-watch surface. Issued by the
//                       mtm:run script during the IPV pass.
//   IpvBreachShadow   — IPV tolerance breach in SHADOW mode (10-trading-day
//                       cutover window per D-MR-1-FX-IPV-TOLERANCE-RECAL-
//                       2026-05-21). Recorded on a separate channel and does
//                       NOT lift into the live appetite-watch surface. Issued
//                       by the mtm:run script when `config.mode === "shadow"`.
//
// Retention classification:
//   All three events → RETENTION_JSE_TRADE_7Y (market risk control records;
//   Banks Act 94 of 1990 §7-year retention norm for trading records).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved);
//   D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
//   D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 (CEO-approved 2026-05-21);
//   IFRS-9-§5.7.1; ORG-MK-08.
// Author: Rohan (Market risk engineer, engineering)

import {
  ipvBreachShadowPayloadSchema,
  ipvExceptionRaisedPayloadSchema,
  mtmRunCompletedPayloadSchema,
} from "../event-types/mtm";
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
  {
    type: "IpvBreachShadow",
    class: "markets",
    issuer: "Rohan",
    subscribers: ["Rohan", "Helena"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: ipvBreachShadowPayloadSchema,
    citationsHint: [
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21",
      "D-FX-SALES-TRADING-FRONTEND",
    ],
    source: "platform/event-store/event-types/mtm.ts",
  },
];
