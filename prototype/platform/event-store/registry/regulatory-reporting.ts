// platform/event-store/registry/regulatory-reporting.ts
//
// Event-type registry rows for regulatory reporting events.
//
// Covers:
//   - TradeReportSubmitted — FinSurv cross-border FX trade report submission
//     (build-phase: stub emits "pending"; production: live API)
//
// Authority:
//   - D-FX-AD-STATUS (Authorised Dealer; FinSurv reporting required)
//   - EXCON-SARB-CIRC-3-2020 (FX reporting obligations)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//
// Authors: Mira (Compliance / RegTech engineer, engineering),
//          Anya (Data / analytics engineer, engineering)

import { TradeReportSubmittedPayloadSchema } from "../event-types/regulatory-reporting";
import { type EventTypeMetadata, RETENTION_JSE_TRADE_7Y } from "./types";

export const REGULATORY_REPORTING_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "TradeReportSubmitted",
    class: "governance",
    payloadSchema: TradeReportSubmittedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira", "Zara", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-FX-AD-STATUS", "EXCON-SARB-CIRC-3-2020", "ORG-EXCON-ODP-001"],
    // Regulatory submissions — 7-year retention per SARB inspection requirements.
    // Cross-reference: EXCON-SARB-CIRC-3-2020 reporting record obligations;
    // FSCA inspection / Banks Act s.91 audit requirements.
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/regulatory/finsurv-stub.ts (build-phase); live FinSurv API (post-licence)",
  },
];
