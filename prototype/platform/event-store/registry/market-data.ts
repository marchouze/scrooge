// platform/event-store/registry/market-data.ts
//
// Market-data domain event-type registry rows.
//
// Covers:
//   MarketDataStaleAlert    — stale market-data alert for an instrument/source.
//   ModelValidationApproved — pricing/risk model validation approval record.
//                             Schema lives in event-types/model-risk.ts;
//                             this registry row adds market-data governance
//                             context (Helena as issuer for pricing models).
//
// Standing authority: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07);
//   Policies/valuation-policy-v1.md §5.
//
// Citations:
//   BCBS 239 (2013) §§8–11 (risk-data aggregation and validation);
//   Policies/valuation-policy-v1.md §5;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Authors: Atlas (Core Banking Platform Architect, engineering) +
//   Rohan (Quant Risk Engineer, markets) +
//   Helena (Chief Risk Officer, governance).

import {
  jibarFixingPublishedPayloadSchema,
  marketDataStaleAlertPayloadSchema,
  oisCurvePublishedPayloadSchema,
  sagbYieldsPublishedPayloadSchema,
  zaroniaRatePublishedPayloadSchema,
  zaroniaTermRatePublishedPayloadSchema,
} from "../event-types/market-data";
import { modelValidationApprovedPayloadSchema } from "../event-types/model-risk";
import { RETENTION_BANKING_5Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Market-data event-type registry rows.
 *
 * Retention classification:
 *   - MarketDataStaleAlert — RETENTION_BANKING_5Y
 *     (operational risk record; Banks Act s.60 + BCBS 239 data-quality audit
 *     trail; 5-year floor).
 *   - ModelValidationApproved — RETENTION_BANKING_5Y
 *     (model governance record; Banks Act s.60 + BCBS 239 §§8–11 model-risk
 *     audit trail; 5-year floor).
 *
 * Subscribers:
 *   Rohan (Quant Risk Engineer) issues and consumes MarketDataStaleAlert to
 *   feed the intraday market-data quality dashboard.
 *   Helena (CRO) subscribes to both events for risk oversight and model
 *   governance attestation (BCBS 239 §§8–11).
 *   Vera (internal audit engineer) subscribes for recon and audit coverage.
 */
export const MARKET_DATA_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "MarketDataStaleAlert",
    class: "markets",
    issuer: "Rohan",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: marketDataStaleAlertPayloadSchema,
    source: "platform/event-store/event-types/market-data.ts; Policies/valuation-policy-v1.md §5",
    citationsHint: ["BCBS-239-2013", "D-MARKETS-SCHEMA-FOUNDATION"],
  },
  {
    type: "ModelValidationApproved",
    class: "markets",
    issuer: "Helena",
    subscribers: ["Helena", "Rohan", "Vera"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: modelValidationApprovedPayloadSchema,
    source: "platform/event-store/event-types/model-risk.ts; Policies/valuation-policy-v1.md §5",
    citationsHint: ["BCBS-239-2013", "D-MARKETS-SCHEMA-FOUNDATION"],
  },
  // -------------------------------------------------------------------------
  // FTP / ALM market-data feed events (W2.3, D-TREASURER-WAVE2-SUBSTRATE)
  // -------------------------------------------------------------------------
  {
    type: "ZaroniaRatePublished",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Eitan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: zaroniaRatePublishedPayloadSchema,
    source: "platform/event-store/event-types/market-data.ts",
    citationsHint: ["D-TREASURER-WAVE2-SUBSTRATE"],
  },
  {
    type: "ZaroniaTermRatePublished",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Eitan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: zaroniaTermRatePublishedPayloadSchema,
    source: "platform/event-store/event-types/market-data.ts",
    citationsHint: ["D-TREASURER-WAVE2-SUBSTRATE"],
  },
  {
    type: "JibarFixingPublished",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: jibarFixingPublishedPayloadSchema,
    source: "platform/event-store/event-types/market-data.ts",
    citationsHint: ["D-TREASURER-WAVE2-SUBSTRATE"],
  },
  {
    type: "OisCurvePublished",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Eitan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: oisCurvePublishedPayloadSchema,
    source: "platform/event-store/event-types/market-data.ts",
    citationsHint: ["D-TREASURER-WAVE2-SUBSTRATE"],
  },
  {
    type: "SagbYieldsPublished",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Eitan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: sagbYieldsPublishedPayloadSchema,
    source: "platform/event-store/event-types/market-data.ts",
    citationsHint: ["D-TREASURER-WAVE2-SUBSTRATE"],
  },
];
