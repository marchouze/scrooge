// platform/event-store/registry/product-control.ts
//
// Product Control event-type registry rows.
//
// Covers:
//   DailyPnLReportGenerated — daily FX P&L aggregation report (unrealised
//     mark-to-market + realised P&L) by pair, counterparty, and book.
//
// Retention classification:
//   - DailyPnLReportGenerated → RETENTION_JSE_TRADE_7Y
//     (trading P&L record; JSE Rules and Banks Act 94 of 1990 — 7 years)
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
//   IFRS 9 §5.7.1; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { dailyPnLReportGeneratedPayloadSchema } from "../event-types/product-control";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Product Control event-type registry rows.
 *
 * Subscribers:
 *   Bea (Accounting & financial reporting engineer, engineering) — primary author.
 *   Camille (CFO, governance) — P&L oversight + IFRS 9 reporting.
 *   Helena (Chief Risk Officer, governance) — market risk / RAS monitoring.
 *   Eitan (Treasurer, governance) — desk-level P&L attribution.
 *   Mira (Regulatory reporting engineer, engineering) — FinSurv P&L inputs.
 *   Atlas (platform) — substrate monitoring.
 */
export const PRODUCT_CONTROL_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "DailyPnLReportGenerated",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Eitan", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: dailyPnLReportGeneratedPayloadSchema,
    citationsHint: ["D-FX-SALES-TRADING-FRONTEND", "IFRS-9-§5.7.1", "D-MARKETS-SCHEMA-FOUNDATION"],
    source: "platform/event-store/event-types/product-control.ts",
  },
];
