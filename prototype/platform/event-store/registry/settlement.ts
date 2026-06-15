// platform/event-store/registry/settlement.ts
//
// Settlement instruction event-type registry rows.
//
// Covers:
//   SettlementInstructionIssued — contractual settlement outflow issued to a
//     counterparty (non-trade-originated); feeds LCR denominator per BA 110 §23.
//
// Retention classification:
//   - SettlementInstructionIssued → RETENTION_BANKING_5Y
//     (prudential liquidity record; LCR denominator input)
//
// Authority: BA 110 §23; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
// Author: Ravi (Treasury and ALM engineer, engineering)

import { settlementInstructionIssuedPayloadSchema } from "../event-types/settlement";
import { RETENTION_BANKING_5Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Settlement instruction event-type registry rows.
 *
 * Subscribers:
 *   Ravi (Treasury/ALM Engineer, engineering) — LCR outflow input.
 *   Eitan (Treasurer, governance) — ALCO settlement-outflow visibility.
 *   Helena (Chief Risk Officer, governance) — LCR appetite inputs.
 *   Atlas (platform) — substrate monitoring.
 */
export const SETTLEMENT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "SettlementInstructionIssued",
    class: "markets",
    issuer: "Ravi",
    subscribers: ["Ravi", "Eitan", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: settlementInstructionIssuedPayloadSchema,
    citationsHint: ["BA-110-S23", "BANKS-REG-26", "D-TREASURY-GAPS-WAVE1"],
    source: "platform/event-store/event-types/settlement.ts",
    v2Status: "v1-only",
  },
];
