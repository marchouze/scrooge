// platform/event-store/event-types/bond-accounting.ts
//
// JSE bond lifecycle accounting event-payload schemas.
//
// Events (5):
//   BondTradeExecuted      — initial recognition at trade date (banking-book
//                            amortised cost per IFRS 9 §5.1.1; trading-book
//                            FVTPL per IFRS 9 §4.1.4)
//   BondInterestAccrued    — daily EIR accrual (IFRS 9 §5.4.1 effective
//                            interest method)
//   BondPositionRevalued   — fair-value remeasurement for trading-book only
//                            (IFRS 9 §5.7.1)
//   BondMatured            — derecognition at maturity (IFRS 9 §3.2.3)
//   BondSold               — derecognition on sale (IFRS 9 §3.2.3)
//
// Authority:
//   - D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   - IFRS 9 §3.1.1, §3.2.3, §4.1.1, §5.1.1, §5.4.1, §5.7.1
//   - Banks Act 94 of 1990
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// BondTradeExecuted
//
// Emitted when the bank executes a JSE bond trade. Covers both banking-book
// (amortised cost, IFRS 9 §4.1.2) and trading-book (FVTPL, IFRS 9 §4.1.4).
// Dirty price = clean price + accrued interest at trade date.
// ---------------------------------------------------------------------------

export const bondTradeExecutedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),
  /** JSE ISIN of the bond (e.g. "ZAG000149037"). */
  bondIsin: z.string().min(1),
  /** Bank's side: buy = asset inflow; sell = asset outflow (short-selling). */
  side: z.enum(["buy", "sell"]),
  /** Nominal / face value in minor currency units (e.g. 10000000 = R100,000). */
  nominalMinor: z.number().int().positive(),
  /** Clean price as percentage of nominal (e.g. 97.50 = 97.5%). */
  cleanPricePercent: z.number().positive(),
  /** Accrued interest component in minor currency units. */
  accruedInterestMinor: z.number().int().nonnegative(),
  /** Dirty price as percentage (clean + accrued / nominal × 100). */
  dirtyPricePercent: z.number().positive(),
  /** T+3 settlement date in ISO 8601 date format (YYYY-MM-DD). */
  settlementDate: z.string().min(1),
  /** IFRS 9 portfolio classification determines accounting treatment. */
  portfolio: z.enum(["trading-book", "banking-book"]),
  /** Annual coupon rate (e.g. 0.0850 for 8.50%). */
  couponRate: z.number().nonnegative(),
  /** Maturity date in ISO 8601 date format. */
  maturityDate: z.string().min(1),
  /** ISO 4217 currency (typically "ZAR" for JSE bonds). */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Counterparty LEI. */
  counterpartyLei: z.string().min(1),
  /** ISO 8601 timestamp of trade execution. */
  executedAt: z.string().min(1),
  /**
   * Prudential book designation — trading book or banking book.
   * Determines capital treatment: trading book → market-risk capital (BA 320);
   * banking book → IRRBB / credit-risk capital (BA 330 / BA 200).
   * Optional additive field; absent for legacy events pre-WS-BA-RETURNS-P1-SOURCING.
   * Authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL.
   */
  bookDesignation: z.enum(["trading", "banking"]).optional(),
});

export type BondTradeExecutedPayload = z.infer<typeof bondTradeExecutedPayloadSchema>;

export function makeBondTradeExecuted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondTradeExecutedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "BondTradeExecuted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondTradeExecuted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondTradeExecutedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BondInterestAccrued
//
// Daily accrual of interest income using the effective interest rate (EIR)
// method per IFRS 9 §5.4.1. The EIR amortises any discount or premium on
// the bond into interest income over the bond's life.
// ---------------------------------------------------------------------------

export const bondInterestAccruedPayloadSchema = z.object({
  /** The originating trade identifier. */
  tradeId: z.string().min(1),
  /** Bond ISIN. */
  bondIsin: z.string().min(1),
  /** Date of accrual (ISO 8601 date). */
  accrualDate: z.string().min(1),
  /** Accrued interest income in minor currency units for this period. */
  accruedInterestMinor: z.number().int().nonnegative(),
  /** Effective interest rate applied (e.g. 0.0873 = 8.73% per annum). */
  eirRate: z.number().positive(),
  /** Carrying amount at the opening of this accrual period (minor units). */
  openingCarryingAmountMinor: z.number().int().positive(),
  /** Carrying amount at the close of this accrual period (minor units). */
  closingCarryingAmountMinor: z.number().int().positive(),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type BondInterestAccruedPayload = z.infer<typeof bondInterestAccruedPayloadSchema>;

export function makeBondInterestAccrued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondInterestAccruedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondInterestAccrued requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondInterestAccrued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondInterestAccruedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BondPositionRevalued
//
// Trading-book only: daily fair-value remeasurement at current market price.
// Changes in fair value recognised immediately in P&L (IFRS 9 §5.7.1).
// Banking-book bonds measured at amortised cost do NOT emit this event.
// ---------------------------------------------------------------------------

export const bondPositionRevaluedPayloadSchema = z.object({
  /** The originating trade identifier. */
  tradeId: z.string().min(1),
  /** Bond ISIN. */
  bondIsin: z.string().min(1),
  /** Revaluation date (ISO 8601 date). */
  revalDate: z.string().min(1),
  /** Book (carrying) clean price as percentage at last revaluation. */
  bookCleanPricePercent: z.number().positive(),
  /** Current market clean price as percentage at revalDate. */
  currentCleanPricePercent: z.number().positive(),
  /**
   * Signed unrealised P&L in ZAR minor units.
   * Positive = gain (market > book); negative = loss.
   */
  unrealisedPnlZarMinor: z.number().int(),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /**
   * Modified duration at the revaluation date (years).
   * Used to populate the BA 320 / IRRBB duration-bucket grid. Nonnegative —
   * typically in range [0, 30] for investment-grade SA government bonds.
   * Optional additive field; absent for legacy events and when the revaluation
   * engine has not yet computed duration. Emitter updated separately.
   * Authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; BCBS d368 §21.
   */
  modifiedDuration: z.number().nonnegative().optional(),
});

export type BondPositionRevaluedPayload = z.infer<typeof bondPositionRevaluedPayloadSchema>;

export function makeBondPositionRevalued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondPositionRevaluedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondPositionRevalued requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondPositionRevalued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondPositionRevaluedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BondMatured
//
// Bond reached its contractual maturity date. Nominal repaid at par; any
// final coupon crystallised. Position derecognised (IFRS 9 §3.2.3).
// ---------------------------------------------------------------------------

export const bondMaturedPayloadSchema = z.object({
  /** The originating trade identifier. */
  tradeId: z.string().min(1),
  /** Bond ISIN. */
  bondIsin: z.string().min(1),
  /** Contractual maturity date (ISO 8601 date). */
  maturityDate: z.string().min(1),
  /** Nominal amount repaid by issuer in minor currency units. */
  nominalRepaidMinor: z.number().int().positive(),
  /** Final coupon payment in minor currency units (may be 0 if paid separately). */
  finalCouponMinor: z.number().int().nonnegative(),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type BondMaturedPayload = z.infer<typeof bondMaturedPayloadSchema>;

export function makeBondMatured(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondMaturedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondMatured requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondMatured",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondMaturedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BondSold
//
// Bank disposes of a bond position in the secondary market. Position
// derecognised; realised P&L = sale proceeds minus carrying amount at sale
// date (IFRS 9 §3.2.3).
// ---------------------------------------------------------------------------

export const bondSoldPayloadSchema = z.object({
  /** The originating trade identifier. */
  tradeId: z.string().min(1),
  /** Bond ISIN. */
  bondIsin: z.string().min(1),
  /** Always "sell" for this event. */
  side: z.literal("sell"),
  /** Net sale proceeds in minor currency units (dirty price × nominal / 100). */
  saleProceedsMinor: z.number().int().positive(),
  /** Carrying amount at point of sale in minor currency units. */
  carryingAmountAtSaleMinor: z.number().int().positive(),
  /**
   * Realised P&L in minor currency units.
   * Positive = gain; negative = loss.
   * Computed as saleProceedsMinor - carryingAmountAtSaleMinor.
   */
  realisedPnlMinor: z.number().int(),
  /** ISO 8601 settlement date. */
  settlementDate: z.string().min(1),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type BondSoldPayload = z.infer<typeof bondSoldPayloadSchema>;

export function makeBondSold(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondSoldPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondSold requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondSold",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondSoldPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Bond accounting event-type registry
// ---------------------------------------------------------------------------

export const BOND_ACCOUNTING_EVENT_TYPES = [
  "BondTradeExecuted",
  "BondInterestAccrued",
  "BondPositionRevalued",
  "BondMatured",
  "BondSold",
] as const;

export type BondAccountingEventType = (typeof BOND_ACCOUNTING_EVENT_TYPES)[number];
