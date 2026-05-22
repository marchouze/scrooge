// platform/event-store/registry/fixed-income.ts
//
// CDM fixed-income event-type registry rows (Slice 10).
//
// Covers one CDM-layer event type:
//   BondTradeExecuted — CDM bond trade booking with full structured fields
//     (ISIN, clean price, accrued interest, yield-to-maturity, T+3 settlement).
//     This is the CDM-layer canonical event; separate from the accounting-layer
//     BondTradeExecuted in registry/bonds.ts (which derives from
//     event-types/bond-accounting.ts).
//
// Retention classification:
//   BondTradeExecuted → RETENTION_JSE_TRADE_7Y.
//   Rationale: bond trade records are subject to the JSE Debt Listings
//   Requirements record-keeping provisions and the Banks Act 7-year floor.
//
// Authority:
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) Slice 10.
//   IFRS 9 §4.1 (classification and measurement categories).
//   Banks Act 94 of 1990 (prudential record-keeping).
//   JSE-RULES-BONDS (Debt Listings Requirements, T+3 settlement).
//
// Author: Eitan (IRRBB / derivatives engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY Slice 10 (CEO-approved 2026-05-22).

import { bondTradeExecutedPayloadSchema } from "../../markets/cdm/fixed-income";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * CDM fixed-income event-type registry rows.
 *
 * Subscribers:
 *   Eitan (IRRBB / derivatives engineer, engineering) — bond trade bookings
 *     and IRRBB cash-flow projection inputs.
 *   Bea (Accounting & financial reporting engineer, engineering) — bond
 *     accounting event chain (BondInterestAccrued, BondPositionRevalued).
 *   Helena (Chief Risk Officer, governance) — bond positions for IRRBB / LCR.
 *   Rohan (Market risk quantitative engineer, engineering) — DV01 / duration
 *     risk metrics.
 *   Atlas (Core banking platform architect, engineering) — substrate monitoring.
 */
export const FIXED_INCOME_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "BondTradeExecuted",
    class: "markets",
    issuer: "Eitan",
    subscribers: ["Eitan", "Bea", "Helena", "Rohan", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondTradeExecutedPayloadSchema,
    citationsHint: [
      "D-FINANCIAL-INSTRUMENT-ENTITY",
      "ISDA-2002-MASTER",
      "IFRS9-4-1",
      "JSE-RULES-BONDS",
    ],
    source: "platform/markets/cdm/fixed-income.ts",
  },
];
