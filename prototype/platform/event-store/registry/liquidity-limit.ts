// platform/event-store/registry/liquidity-limit.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — Liquidity-limit lifecycle event-type registry
// rows.
//
// Covers:
//   LiquidityLimitBreached, LiquidityLimitBreachDisposed.
//
// Standing authority:
//   - D-RAS (CEO-approved 2026-05-06; Owner Inbox §B3 liquidity-risk lines).
//   - Liquidity Risk Management Policy v1 (Camille + Eitan + Helena,
//     2026-05-11; archive/owner-inbox/2026-05-11_camille-eitan-helena_
//     liquidity-risk-management-policy-v1.md).
//   - brief:ravi:liquidity-limit-engine-mirroring-credit-limit-en:2026-05-21.
//
// Citations:
//   Banks Act 94 of 1990 §§ 60–72;
//   RRB Regulation 26 (liquidity-risk management); Regulation 26A (NSFR);
//   PA D6/2015 (revised LCR); PA D1/2023 (NSFR); PA D4/2021 (stress);
//   BCBS 144; BCBS D295 (LCR); BCBS D335 (NSFR); BCBS 248 (intraday);
//   LRM Policy v1;
//   Procedures/by-policy/liquidity-limit-management.md (PROC-RISK-LLM-01).
//
// Retention classification:
//   - Breach + disposal events
//     → RETENTION_BANKING_5Y (regulator inspection scope under Reg 26).
//
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import {
  liquidityLimitBreachDisposedPayloadSchema,
  liquidityLimitBreachedPayloadSchema,
} from "../event-types/liquidity-limit";
import { RETENTION_BANKING_5Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Liquidity-limit lifecycle event-type registry rows.
 *
 * Subscribers:
 *   Eitan (Treasurer, governance) — every event; first-line ownership of
 *     liquidity risk per LRM Policy v1 §8.1.
 *   Helena (Chief Risk Officer, governance) — every event; second-line
 *     oversight per LRM Policy v1 §8.2 (challenges first-line decisions
 *     that approach or breach RAS appetite lines).
 *   Camille (Chief Financial Officer, governance) — every event; ICAAP/
 *     ILAAP liquidity-side governance per LRM Policy v1 §8.1 + §6.
 *   Ravi (Treasury and ALM engineer) — every event; engine issuer +
 *     ALM-substrate substrate monitoring.
 *   Anya (Liquidity & projections engineer) — every event; upstream
 *     LCR/NSFR computation owner; needs visibility on which thresholds
 *     fire.
 *   Mira (Compliance / RegTech engineer) — every event; BA 110 / BA 120
 *     return commentary attaches breach narratives.
 *   Owen (Company Secretary, governance) — every event; the decisions
 *     register cites BRC/ALCO/CEO exception decisions, which the breach
 *     flow may trigger.
 *   Atlas (Core banking platform architect, engineering) — every event
 *     for substrate monitoring.
 */
export const LIQUIDITY_LIMIT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "LiquidityLimitBreached",
    class: "audit",
    issuer: "Ravi",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Anya", "Mira", "Owen", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: liquidityLimitBreachedPayloadSchema,
    source: "platform/event-store/event-types/liquidity-limit.ts",
    citationsHint: [
      "BANKS-ACT-94-1990",
      "RRB-REG-26",
      "RRB-REG-26A",
      "BA-110",
      "BA-120",
      "POLICY:liquidity-risk-management-policy-v1-S9.1",
      "PROC-RISK-LLM-01",
    ],
    v2Status: "v1-only",
  },
  {
    type: "LiquidityLimitBreachDisposed",
    class: "audit",
    issuer: "Eitan",
    subscribers: ["Eitan", "Helena", "Camille", "Ravi", "Anya", "Mira", "Owen", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: liquidityLimitBreachDisposedPayloadSchema,
    source: "platform/event-store/event-types/liquidity-limit.ts",
    citationsHint: ["POLICY:liquidity-risk-management-policy-v1-S9.3", "PROC-RISK-LLM-01"],
    v2Status: "v1-only",
  },
];
