// platform/event-store/registry/regulatory-pa.ts
//
// PA / FSCA / FIC regulator-notification event-type registry rows.
//
// Covers:
//   - PaNotificationSubmitted
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//
// Retention classification:
//   - Notifications to a regulator are governance-grade records —
//     RETENTION_GOVERNANCE_7Y, consistent with Banks Act s.60 / s.91
//     audit trail and PA / FSCA inspection scope.
//
// Citations:
//   Banks Act 94 of 1990 §§ 60A + 73;
//   RRB Regulation 23; LEX Directive D3/2022;
//   FIC Act 38 of 2001; Joint Standard 2 of 2024;
//   Policies/credit-risk-policy-v1.md §8 line 252.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering) +
//   Helena (Chief Risk Officer, governance).

import { paNotificationSubmittedPayloadSchema } from "../event-types/regulatory-pa";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

/**
 * PA / FSCA / FIC regulator-notification event-type registry rows.
 *
 * Subscribers:
 *   Helena (CRO, governance) — credit-risk / LEX notifications.
 *   Mira (Compliance / RegTech engineer, engineering) — all notifications
 *     (regulator interface ownership).
 *   Owen (Company Secretary, governance) — board / committee record.
 *   Vera (Internal audit engineer, third-line) — escalation audit trail.
 *   Atlas (Core banking platform architect, engineering) — substrate
 *     monitoring of regulator-facing emissions.
 */
export const REGULATORY_PA_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "PaNotificationSubmitted",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Helena", "Mira", "Owen", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: paNotificationSubmittedPayloadSchema,
    source: "platform/event-store/event-types/regulatory-pa.ts",
    citationsHint: [
      "BANKS-ACT-94-1990-S60A",
      "BANKS-ACT-94-1990-S73",
      "RRB-REG-23",
      "LEX-D3-2022",
      "FIC-ACT-38-2001",
      "JS2-2024",
      "POLICY:credit-risk-policy-v1-S8",
    ],
  },
];
