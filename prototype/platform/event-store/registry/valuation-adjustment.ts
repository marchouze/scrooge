// platform/event-store/registry/valuation-adjustment.ts
//
// Valuation-adjustment / prudent-valuation reserve event-type registry rows.
//
// Covers:
//   ValuationAdjustmentComputed — one per adjustment type (close-out / bid-offer,
//     day-1-deferral, CVA, market-price-uncertainty AVA, …); each routed through
//     the no-silent-zero contract (complete + absentReason).
//   Day1PnLDeferralRecorded — IFRS 13 Level-3 day-1 P&L deferral record.
//   PrudentValuationAvaAggregated — the prudent-valuation AVA umbrella
//     (CRR Art 105 / SA-Basel equivalent) summing the populated AVAs.
//
// Retention: valuation reserves / AVAs are accounting figures feeding daily
//   P&L and the fair-value hierarchy → RETENTION_ACCOUNTING_7Y.
//
// Authority: Camille (CFO) recommendation R2; IFRS 13; accounting-policies-
//   ifrs-v1 §3.3; valuation-policy-v1 §7; CRR Art 105 / SA-Basel prudent-
//   valuation; D-TRUSTED-FIGURES-PROGRAM-V1.
// Author: Rohan (Risk engineer, engineering), under
//   brief:rohan:valuation-adjustment-prudent-valuation-reserve-f:2026-05-31.

import {
  day1PnLDeferralRecordedPayloadSchema,
  prudentValuationAvaAggregatedPayloadSchema,
  valuationAdjustmentComputedPayloadSchema,
} from "../event-types/valuation-adjustment";
import { RETENTION_ACCOUNTING_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Valuation-adjustment event-type registry rows.
 *
 * Subscribers:
 *   Rohan (Risk engineer, engineering) — primary author / engine owner.
 *   Camille (CFO, governance) — valuation-reserve / IFRS 13 oversight.
 *   Helena (Chief Risk Officer, governance) — prudent-valuation / AVA oversight.
 *   Bea (Accounting & financial reporting engineer, engineering) — daily P&L consumer.
 *   Atlas (platform) — substrate monitoring.
 */
export const VALUATION_ADJUSTMENT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ValuationAdjustmentComputed",
    class: "markets",
    issuer: "Rohan",
    subscribers: ["Rohan", "Camille", "Helena", "Bea", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: valuationAdjustmentComputedPayloadSchema,
    citationsHint: ["IFRS-13", "accounting-policies-ifrs-v1-§3.3", "D-TRUSTED-FIGURES-PROGRAM-V1"],
    source: "platform/event-store/event-types/valuation-adjustment.ts",
  },
  {
    type: "Day1PnLDeferralRecorded",
    class: "markets",
    issuer: "Rohan",
    subscribers: ["Rohan", "Camille", "Helena", "Bea", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: day1PnLDeferralRecordedPayloadSchema,
    citationsHint: ["IFRS-13", "accounting-policies-ifrs-v1-§3.3"],
    source: "platform/event-store/event-types/valuation-adjustment.ts",
  },
  {
    type: "PrudentValuationAvaAggregated",
    class: "markets",
    issuer: "Rohan",
    subscribers: ["Rohan", "Camille", "Helena", "Bea", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: prudentValuationAvaAggregatedPayloadSchema,
    citationsHint: ["CRR-Art-105", "valuation-policy-v1-§7", "D-TRUSTED-FIGURES-PROGRAM-V1"],
    source: "platform/event-store/event-types/valuation-adjustment.ts",
  },
];
