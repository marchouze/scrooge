// platform/event-store/registry/product-control.ts
//
// Product Control event-type registry rows.
//
// Covers:
//   DailyPnLReportGenerated — daily FX P&L aggregation report (unrealised
//     mark-to-market + realised P&L) by pair, counterparty, and book.
//   PnLAttributionGenerated — day-over-day clean-P&L decomposition ("P&L
//     Explain") into additive, reconciling components.
//   PnLAttributionExceptionRaised — typed exception when an attribution is
//     unclean (residual breach or incomplete inputs).
//   PnLSignedOff — formal sign-off on the day's P&L figures (trader or PC).
//   PnLCommentaryRecorded — threshold-based explain commentary on a breach.
//   PnLFlashRecorded — T+0 flash P&L estimate (open positions × latest marks).
//   PnLFlashActualReconciled — T+1 flash-vs-actual comparison with variance.
//
// Retention classification:
//   - All product-control events → RETENTION_JSE_TRADE_7Y
//     (trading P&L record; JSE Rules and Banks Act 94 of 1990 — 7 years)
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
//   D-TRUSTED-FIGURES-PROGRAM-V1; IFRS 9 §5.7.1; FRTB-PLA;
//   D-MARKETS-SCHEMA-FOUNDATION; FIN-BSS-01.
// Author: Bea (Accounting & financial reporting engineer, engineering)

import {
  dailyPnLReportGeneratedPayloadSchema,
  pnlAttributionExceptionRaisedPayloadSchema,
  pnlAttributionGeneratedPayloadSchema,
  pnlCommentaryRecordedPayloadSchema,
  pnlFlashActualReconciledPayloadSchema,
  pnlFlashRecordedPayloadSchema,
  pnlSignedOffPayloadSchema,
} from "../event-types/product-control";
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
  {
    type: "PnLAttributionGenerated",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Eitan", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: pnlAttributionGeneratedPayloadSchema,
    citationsHint: ["D-TRUSTED-FIGURES-PROGRAM-V1", "IFRS-9-§5.7.1", "FRTB-PLA"],
    source: "platform/event-store/event-types/product-control.ts",
  },
  {
    type: "PnLAttributionExceptionRaised",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Eitan", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: pnlAttributionExceptionRaisedPayloadSchema,
    citationsHint: ["D-TRUSTED-FIGURES-PROGRAM-V1", "IFRS-9-§5.7.1", "FRTB-PLA"],
    source: "platform/event-store/event-types/product-control.ts",
  },
  {
    type: "PnLSignedOff",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Eitan", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: pnlSignedOffPayloadSchema,
    citationsHint: ["D-TRUSTED-FIGURES-PROGRAM-V1", "IFRS-9-§5.7.1", "FIN-BSS-01"],
    source: "platform/event-store/event-types/product-control.ts",
  },
  {
    type: "PnLCommentaryRecorded",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: pnlCommentaryRecordedPayloadSchema,
    citationsHint: ["D-TRUSTED-FIGURES-PROGRAM-V1", "FRTB-PLA", "FIN-BSS-01"],
    source: "platform/event-store/event-types/product-control.ts",
  },
  {
    type: "PnLFlashRecorded",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Eitan", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: pnlFlashRecordedPayloadSchema,
    citationsHint: ["D-TRUSTED-FIGURES-PROGRAM-V1", "IFRS-9-§5.7.1", "FIN-BSS-01"],
    source: "platform/event-store/event-types/product-control.ts",
  },
  {
    type: "PnLFlashActualReconciled",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Eitan", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: pnlFlashActualReconciledPayloadSchema,
    citationsHint: ["D-TRUSTED-FIGURES-PROGRAM-V1", "IFRS-9-§5.7.1", "FIN-BSS-01"],
    source: "platform/event-store/event-types/product-control.ts",
  },
];
