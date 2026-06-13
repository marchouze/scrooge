// platform/event-store/event-types/equity-accounting.ts
//
// IFRS 9 GL-specific equity accounting event-payload schemas.
//
// NOTE: The CDM equity lifecycle events (EquityTradeExecuted, EquityPositionRevalued,
// EquitySettlementConfirmed, EquitySettlementInstructed, EquityTradeBooked,
// EquityCorporateActionApplied) are defined in platform/markets/cdm/equity.ts
// and registered in platform/event-store/registry/markets.ts (Kai). The GL
// posting engine subscribes to those CDM events directly.
//
// This module adds the two GL-specific events that CDM does not define:
//
//   EquityDividendAccrued  — dividend income recognition at ex-dividend date
//                            (IFRS 9 §5.7.1A; IAS 32 §35). CDM has
//                            EquityCorporateActionApplied but it's too broad;
//                            this typed event carries the exact accounting
//                            fields Bea's posting rule needs (gross / net /
//                            withholding tax).
//
//   EquitySold             — derecognition on sale (IFRS 9 §3.2.3) with
//                            FVTPL/FVOCI classification and the FVOCI
//                            no-recycling constraint (§5.7.5). CDM doesn't
//                            carry the IFRS 9 classification or the OCI
//                            reclassification amounts needed for the
//                            GL postings.
//
// Authority:
//   - D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   - IFRS 9 §3.2.3, §5.7.1A, §5.7.5
//   - IAS 32 §35 (dividend recognition)
//   - JSE Equities Rules
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// EquityDividendAccrued
//
// Cash dividend declared by the issuer. Bank recognises dividend receivable
// (Dr Dividend Receivable / Cr Dividend Income) on the ex-dividend date.
// Per IFRS 9 §5.7.1A: dividends recognised in P&L for both FVTPL and FVOCI
// instruments (unlike changes in fair value which for FVOCI go to OCI).
//
// Withholding tax payable recognised simultaneously where applicable
// (SA dividends tax: 20% for most recipients, ITAct §64E).
// ---------------------------------------------------------------------------

export const equityDividendAccruedPayloadSchema = z.object({
  /** The originating trade identifier (links to EquityTradeExecuted). */
  tradeId: z.string().min(1),
  /** Equity instrument identifier (ISIN or JSE alpha code). */
  instrumentId: z.string().min(1),
  /** Number of shares on which the dividend accrues. */
  quantity: z.number().int().positive(),
  /** Gross dividend per share in minor currency units. */
  grossDividendPerShareMinor: z.number().int().nonnegative(),
  /** Total gross dividend amount in minor currency units. */
  grossDividendTotalMinor: z.number().int().nonnegative(),
  /**
   * Withholding tax rate (e.g. 0.20 for 20%).
   * SA dividends tax rate is 20% for most recipients (ITAct §64E).
   */
  withholdingTaxRate: z.number().nonnegative().max(1),
  /** Withholding tax amount in minor currency units. */
  withholdingTaxMinor: z.number().int().nonnegative(),
  /** Net dividend receivable (gross minus withholding tax). */
  netDividendMinor: z.number().int().nonnegative(),
  /** Ex-dividend date (ISO 8601 date). */
  exDividendDate: z.string().min(1),
  /** Payment date (ISO 8601 date). */
  paymentDate: z.string().min(1),
  /** ISO 4217 currency. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type EquityDividendAccruedPayload = z.infer<typeof equityDividendAccruedPayloadSchema>;

export function makeEquityDividendAccrued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquityDividendAccruedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("EquityDividendAccrued requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquityDividendAccrued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equityDividendAccruedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EquitySold
//
// Bank disposes of an equity position. This accounting event carries the
// IFRS 9 classification (fvtpl/fvoci) and the realised P&L / OCI balance
// needed for correct GL posting.
//
// CDM does not carry these fields; the GL posting engine subscribes to
// this event for derecognition postings.
//
// FVTPL: realised P&L = proceeds - carrying amount → recognised in P&L.
// FVOCI: realised P&L NOT recycled to P&L (§5.7.5 no-recycling constraint).
//        Instead, the cumulative OCI balance is reclassified to retained
//        earnings (within equity), bypassing P&L entirely.
// ---------------------------------------------------------------------------

export const equitySoldPayloadSchema = z.object({
  /** The originating trade identifier (links to EquityTradeExecuted). */
  tradeId: z.string().min(1),
  /** Equity instrument identifier (ISIN or JSE alpha code). */
  instrumentId: z.string().min(1),
  /**
   * IFRS 9 classification from the originating trade:
   *   "fvtpl" — §4.1.4, fair-value through profit or loss
   *   "fvoci" — §4.1.2A irrevocable election, no recycling on sale (§5.7.5)
   */
  classification: z.enum(["fvtpl", "fvoci"]),
  /** Number of shares sold. */
  quantity: z.number().int().positive(),
  /** Sale price per share in minor currency units. */
  salePricePerShareMinor: z.number().int().positive(),
  /** Total sale proceeds in minor currency units. */
  saleProceedsMinor: z.number().int().positive(),
  /** Carrying amount at sale in minor currency units. */
  carryingAmountAtSaleMinor: z.number().int().positive(),
  /**
   * Realised P&L / OCI reclassification amount in minor currency units.
   * For FVTPL: positive = gain, negative = loss. Recognised in P&L.
   * For FVOCI: cumulative OCI reserve balance being reclassified to
   *            retained earnings (NOT to P&L — §5.7.5 no-recycling).
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

export type EquitySoldPayload = z.infer<typeof equitySoldPayloadSchema>;

export function makeEquitySold(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquitySoldPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("EquitySold requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquitySold",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equitySoldPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DECIMAL-MIGRATION: V2 MoneyWire payload types (slice 2)
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION.
// ---------------------------------------------------------------------------

import type { MoneyWire } from "../../core/money-codec";
import { encodeMoney, moneyWireFromMinor } from "../../core/money-codec";
import type { Money } from "../../core/decimal-money";

// ── EquityDividendAccrued V2 ─────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by EquityDividendAccruedPayloadV2. */
export type EquityDividendAccruedPayloadLegacy = EquityDividendAccruedPayload;

export interface EquityDividendAccruedPayloadV2
  extends Omit<
    EquityDividendAccruedPayload,
    | "grossDividendPerShareMinor"
    | "grossDividendTotalMinor"
    | "withholdingTaxMinor"
    | "netDividendMinor"
  > {
  readonly grossDividendPerShare: MoneyWire;
  readonly grossDividendTotal: MoneyWire;
  readonly withholdingTax: MoneyWire;
  readonly netDividend: MoneyWire;
}

export function encodeEquityDividendAccrued(
  base: Omit<
    EquityDividendAccruedPayload,
    | "grossDividendPerShareMinor"
    | "grossDividendTotalMinor"
    | "withholdingTaxMinor"
    | "netDividendMinor"
  >,
  grossDividendPerShare: Money,
  grossDividendTotal: Money,
  withholdingTax: Money,
  netDividend: Money,
): EquityDividendAccruedPayloadV2 {
  return {
    ...base,
    grossDividendPerShare: encodeMoney(grossDividendPerShare),
    grossDividendTotal: encodeMoney(grossDividendTotal),
    withholdingTax: encodeMoney(withholdingTax),
    netDividend: encodeMoney(netDividend),
  };
}

export function decodeEquityDividendAccrued(
  raw: EquityDividendAccruedPayload,
): EquityDividendAccruedPayloadV2 {
  const {
    grossDividendPerShareMinor,
    grossDividendTotalMinor,
    withholdingTaxMinor,
    netDividendMinor,
    ...rest
  } = raw;
  return {
    ...rest,
    grossDividendPerShare: moneyWireFromMinor(grossDividendPerShareMinor, raw.currency),
    grossDividendTotal: moneyWireFromMinor(grossDividendTotalMinor, raw.currency),
    withholdingTax: moneyWireFromMinor(withholdingTaxMinor, raw.currency),
    netDividend: moneyWireFromMinor(netDividendMinor, raw.currency),
  };
}

// ── EquitySold V2 ────────────────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by EquitySoldPayloadV2. */
export type EquitySoldPayloadLegacy = EquitySoldPayload;

export interface EquitySoldPayloadV2
  extends Omit<
    EquitySoldPayload,
    "salePricePerShareMinor" | "saleProceedsMinor" | "carryingAmountAtSaleMinor" | "realisedPnlMinor"
  > {
  readonly salePricePerShare: MoneyWire;
  readonly saleProceeds: MoneyWire;
  readonly carryingAmountAtSale: MoneyWire;
  readonly realisedPnl: MoneyWire;
}

export function encodeEquitySold(
  base: Omit<
    EquitySoldPayload,
    | "salePricePerShareMinor"
    | "saleProceedsMinor"
    | "carryingAmountAtSaleMinor"
    | "realisedPnlMinor"
  >,
  salePricePerShare: Money,
  saleProceeds: Money,
  carryingAmountAtSale: Money,
  realisedPnl: Money,
): EquitySoldPayloadV2 {
  return {
    ...base,
    salePricePerShare: encodeMoney(salePricePerShare),
    saleProceeds: encodeMoney(saleProceeds),
    carryingAmountAtSale: encodeMoney(carryingAmountAtSale),
    realisedPnl: encodeMoney(realisedPnl),
  };
}

export function decodeEquitySold(raw: EquitySoldPayload): EquitySoldPayloadV2 {
  const {
    salePricePerShareMinor,
    saleProceedsMinor,
    carryingAmountAtSaleMinor,
    realisedPnlMinor,
    ...rest
  } = raw;
  return {
    ...rest,
    salePricePerShare: moneyWireFromMinor(salePricePerShareMinor, raw.currency),
    saleProceeds: moneyWireFromMinor(saleProceedsMinor, raw.currency),
    carryingAmountAtSale: moneyWireFromMinor(carryingAmountAtSaleMinor, raw.currency),
    realisedPnl: moneyWireFromMinor(realisedPnlMinor, raw.currency),
  };
}

// ---------------------------------------------------------------------------
// Equity accounting event-type registry
// ---------------------------------------------------------------------------

export const EQUITY_ACCOUNTING_EVENT_TYPES = ["EquityDividendAccrued", "EquitySold"] as const;

export type EquityAccountingEventType = (typeof EQUITY_ACCOUNTING_EVENT_TYPES)[number];
