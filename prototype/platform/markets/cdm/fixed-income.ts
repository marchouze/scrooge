// platform/markets/cdm/fixed-income.ts
//
// CDM fixed-income event types — bond trade lifecycle (Slice 10).
//
// One event shape:
//   - BondTradeExecuted — a bond trade has been agreed, priced, and recorded
//     at the CDM layer. This is the CDM-layer canonical booking event; it
//     carries full structured bond-market fields (ISIN, clean price, accrued
//     interest, yield-to-maturity, JSE venue). The accounting-layer event
//     BondTradeExecuted in platform/event-store/event-types/bond-accounting.ts
//     is a separate, accounting-focused projection; both coexist.
//
// Design follows the CDM pattern established in platform/markets/cdm/equity.ts
// and platform/markets/cdm/ird.ts. The aggregate is keyed on tradeId so the
// full trade lifecycle (booking → settlement → maturity) is grouped under one
// aggregate root.
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY — CEO-approved 2026-05-22; authority for
//     this CDM event shape, the bond FinancialInstrument seed payloads, and
//     the per-ACTUS-type contractTerms validation in instrument.ts Slice 5.
//   ISDA-2002-MASTER — master confirmation framework for OTC bond trades.
//   IFRS-9-§4.1 — measurement category classification drives GL posting rules.
//   JSE-RULES-BONDS — JSE Debt Listings Requirements; T+3 settlement cycle;
//     bond quoting convention (clean price + accrued interest).
//
// Author: Eitan (IRRBB / derivatives engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY Slice 10 (CEO-approved 2026-05-22).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { deterministicAggregateId, makeAggregateLabel } from "../../event-store/aggregate";
import { type Actor, type Event, eventSchema } from "../../event-store/types";
import {
  type CdmDate,
  cdmDateSchema,
  identifierSchema,
  moneySchema,
  partySchema,
} from "./primitives";

// ---------------------------------------------------------------------------
// BondTradeExecuted
// ---------------------------------------------------------------------------

/**
 * Payload schema for BondTradeExecuted (CDM layer).
 *
 * Emitted when the bank executes a bond trade at the CDM layer. Carries the
 * full set of bond-market fields: ISIN, clean price, accrued interest,
 * consideration, yield-to-maturity, T+3 settlement date, counterparty, venue.
 *
 * The `instrumentId` references an existing FinancialInstrumentDefined event
 * with actusContractType = "PAM". Convention: `"fi:bond:<ISIN>"`.
 *
 * References:
 *   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) — Slice 10.
 *   IFRS-9-§4.1 — classification drives measurement and GL posting rules.
 *   JSE-RULES-BONDS — T+3 bond settlement cycle; clean price quoting.
 */
export const bondTradeExecutedPayloadSchema = z.object({
  /** Stable internal trade identifier. */
  tradeId: identifierSchema,
  /**
   * Reference to the FinancialInstrument entity for this bond.
   * Must match an existing FinancialInstrumentDefined with actusContractType = "PAM".
   * Convention: "fi:bond:<ISIN>".
   */
  instrumentId: z.string().min(1),
  /** ISIN of the bond (ISO 6166, 12 characters). */
  isin: z.string().length(12),
  /** Side from the bank's perspective. */
  side: z.enum(["buy", "sell"]),
  /** Nominal / face value traded (in bond currency). */
  nominalAmount: moneySchema,
  /** Clean price as percentage of face value (e.g. 98.50 = 98.50%). */
  cleanPrice: z.number().positive(),
  /** Accrued interest at settlement date (in bond currency). */
  accruedInterest: moneySchema,
  /** Total consideration = (cleanPrice/100 × nominal) + accrued interest. */
  consideration: moneySchema,
  /** Trade date (when agreed). */
  tradeDate: cdmDateSchema,
  /** Settlement date (T+3 for JSE bonds). */
  settlementDate: cdmDateSchema,
  /** Counterparty. */
  counterparty: partySchema,
  /** Trading venue — "JSE" for listed bonds, "OTC" for bilateral. */
  venue: z.enum(["JSE", "OTC"]),
  /** Trader reference. */
  traderRef: z.string().min(1),
  /** Trading book. */
  bookId: z.string().min(1),
  /** Yield-to-maturity at execution (decimal, e.g. 0.0875 = 8.75%). */
  yieldToMaturity: z.number().positive(),
});

export type BondTradeExecutedPayload = z.infer<typeof bondTradeExecutedPayloadSchema>;

/**
 * Factory for BondTradeExecuted (CDM layer) events.
 *
 * Sets `aggregateId` + `aggregateLabel` on the envelope using
 * `makeAggregateLabel("bond-trade", tradeId.value)` so the full bond trade
 * lifecycle is grouped under one aggregate root and
 * `recon:aggregate-id-coverage` can assert full coverage.
 */
export function makeBondTradeExecuted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondTradeExecutedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("bond-trade", args.payload.tradeId.value);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondTradeExecuted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondTradeExecutedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// Fixed-income event-type registry — for runtime registration into the
// event store and for recon:aggregate-id-coverage assertions.
// ---------------------------------------------------------------------------

export const FIXED_INCOME_EVENT_TYPES = ["BondTradeExecuted"] as const;

export type FixedIncomeEventType = (typeof FIXED_INCOME_EVENT_TYPES)[number];

/** Re-export the date type for downstream consumers (Anya projections). */
export type { CdmDate };
