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
    // FLIP (WS-V2-AUTHORITATIVE S2) — v1-only → v2-replaced, RETIRED-BY-CONSTRUCTION.
    // Basis: D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16). All four
    // conditions hold and are recorded:
    //   (1) V1 UN-EMITTABLE: dailyPnLReportGeneratedPayloadSchema requires the
    //       numeric `*Minor` fields totalUnrealisedPnlZarMinor / totalRealisedPnlZarMinor
    //       / totalPnlZarMinor (z.number().int()). Any emission of this type trips
    //       recon:no-residual-minor-encoding (no allowlist) → un-emittable on main.
    //   (2) V2 SOLE EMITTABLE PATH PRODUCES: platform/product-control/daily-pnl-v2.ts
    //       (computeDailyPnLV2) reads the FIL-instance projection + MarketDataStore
    //       snapshot → MoneyWire figures. Verified non-vacuous on the ci:migrate
    //       seeded store: totalUnrealisedPnlZarMinor = 789_500_000 (ZAR 7,895,000)
    //       across 3 active FIL positions (D-V1-REMOVAL-PHASE2-GAP-A2 wiring; S1 #1387).
    //   (3) V2 HAS OWN TESTS: daily-pnl-v2 unit tests + recon:daily-pnl-v2-parity.
    //   (4) HISTORICAL V1 REPLAY-READABLE: the schema + decoder remain registered;
    //       historical V1 events (if any pre-date the *Minor purge) replay unchanged.
    // Byte-parity is genuinely N/A by construction (V1 cannot be emitted to compare);
    // the construction conditions are asserted by recon:daily-pnl-v2-parity (Charter cmd 3+5).
    v2Status: "v2-replaced",
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
    v2Status: "v1-only",
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
    v2Status: "v1-only",
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
    v2Status: "v1-only",
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
    v2Status: "v1-only",
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
    v2Status: "v1-only",
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
    v2Status: "v1-only",
  },
];
