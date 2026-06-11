// platform/event-store/registry/intraday-liquidity.ts
//
// WS-TREASURER-WAVE1-SUBSTRATE — BCBS 248 intraday liquidity monitoring
// event-type registry rows.
//
// Covers:
//   IntradayLiquidityReported        — per-tool BCBS 248 measurement stream
//                                      (LRM Policy v1 §4.2 event pattern).
//   IntradayLiquidityMetricsComputed — seven-tool run summary; the
//                                      register-bound measure for the
//                                      `appetite:liquidity:intraday` RAS
//                                      line (Helena (Chief Risk Officer,
//                                      governance) follow-on).
//
// Standing authority:
//   - D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11); parent
//     D-TREASURER-ROLE-DEFINITION-REVIEW.
//
// Citations:
//   BCBS 248 (Monitoring tools for intraday liquidity management, 2013);
//   Banks Act 94 of 1990 Reg 26; ORG-PR-08;
//   Policies/liquidity-risk-management-policy-v1.md §4.2;
//   D-SAMOS-NON-CLEARING (indirect NPS participant posture).
//
// Retention classification:
//   Intraday monitoring streams are regulator-inspection-scope liquidity
//   records → RETENTION_BANKING_5Y.
//
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import {
  intradayLiquidityMetricsComputedPayloadSchema,
  intradayLiquidityReportedPayloadSchema,
} from "../event-types/intraday-liquidity";
import { RETENTION_BANKING_5Y } from "./types";
import type { EventTypeMetadata } from "./types";

const INTRADAY_LIQUIDITY_CITATIONS_HINT = [
  "BCBS-248-INTRADAY",
  "BANKS-ACT-94-1990",
  "RRB-REG-26",
  "POLICY:liquidity-risk-management-policy-v1-S4.2",
];

/**
 * BCBS 248 intraday liquidity monitoring event-type registry rows.
 *
 * Subscribers:
 *   Eitan (Treasurer, governance) — intraday liquidity first-line owner;
 *     end-of-day report reviewer per LRM Policy v1 §4.4.
 *   Helena (Chief Risk Officer, governance) — RAS intraday appetite-line
 *     monitoring (follow-on `appetite:liquidity:intraday`).
 *   Ravi (Treasury and ALM engineer) — metrics issuer; EWI monitor reads
 *     the summary stream for §4.5 stress detection.
 *   Mira (Compliance / RegTech engineer) — BA 300-family return commentary.
 *   Atlas (Core banking platform architect, engineering) — substrate
 *     monitoring.
 */
export const INTRADAY_LIQUIDITY_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "IntradayLiquidityReported",
    class: "governance",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Ravi", "Mira", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: intradayLiquidityReportedPayloadSchema,
    source: "platform/event-store/event-types/intraday-liquidity.ts",
    citationsHint: INTRADAY_LIQUIDITY_CITATIONS_HINT,
  },
  {
    type: "IntradayLiquidityMetricsComputed",
    class: "governance",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Ravi", "Mira", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: intradayLiquidityMetricsComputedPayloadSchema,
    source: "platform/event-store/event-types/intraday-liquidity.ts",
    citationsHint: INTRADAY_LIQUIDITY_CITATIONS_HINT,
  },
];
