// platform/event-store/registry/balance-sheet.ts
//
// Balance sheet projection event-type registry rows.
//
// Covers:
//   BalanceSheetProjected — period-end balance-sheet projection providing
//     supplemental BA 120 ASF/RSF line items not captured in trade events.
//
// Retention classification:
//   - BalanceSheetProjected → RETENTION_ACCOUNTING_7Y
//     (statutory financial-statement supporting record; NSFR computation input)
//
// Authority: BA 120; BCBS D396; Banks Act Reg 26A; D-TREASURY-GAPS-WAVE1.
// Author: Bea (Accounting and financial reporting engineer, engineering)

import { balanceSheetProjectedPayloadSchema } from "../event-types/balance-sheet";
import { RETENTION_ACCOUNTING_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Balance sheet projection event-type registry rows.
 *
 * Subscribers:
 *   Bea (Accounting/Financial Reporting engineer) — owns emission.
 *   Ravi (Treasury/ALM Engineer, engineering) — ASF/RSF computation.
 *   Helena (Chief Risk Officer, governance) — NSFR appetite inputs.
 *   Eitan (Treasurer, governance) — ALCO balance-sheet visibility.
 */
export const BALANCE_SHEET_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "BalanceSheetProjected",
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Ravi", "Helena", "Eitan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: balanceSheetProjectedPayloadSchema,
    citationsHint: ["BA-120", "BCBS-D396", "BANKS-ACT-REG-26A", "D-TREASURY-GAPS-WAVE1"],
    source: "platform/event-store/event-types/balance-sheet.ts",
  },
];
