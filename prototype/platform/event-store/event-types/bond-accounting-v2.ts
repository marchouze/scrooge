// platform/event-store/event-types/bond-accounting-v2.ts
//
// V2-PARALLEL lifecycle event schemas for the JSE bond instrument family. These
// run DUAL-PARALLEL to the V1 schemas in `bond-accounting.ts`
// (D-V1-REMOVAL-PHASE-3C): the V1 events stay `v1-only`; these 5 V2 events are
// `v2-parallel` and feed the V2 bond GL posting handlers
// (gl-posting-engine-v2-bond.ts) and the V1↔V2 bond GL parity gate.
//
// Each V2 payload is IDENTICAL to its V1 counterpart EXCEPT:
//   - `tenantId: TenantId`     — the multi-tenant axis (S2).
//   - amounts are `MoneyWire`   — decimal-native major-unit money, NEVER a
//                                 minor-unit `z.number().int()` (the
//                                 no-float-money / no-residual-minor gates).
//   - `schemaVersion: 2`        — the V2 schema marker (literal).
//
// CURRENCY-AGNOSTIC (WS-MULTI-BASE-CURRENCY, #1382): every money field carries
// its OWN currency on the MoneyWire. The V1 `unrealisedPnlZarMinor` field is
// lifted to a currency-carrying `unrealisedPnl` MoneyWire — a USD bond records
// `{ currency: "USD", amount }`, never an implied-ZAR minor integer.
//
// UNLIKE the Phase 3b money-market events (amortised cost), a bond is FVTPL and
// DISCOUNTS: BondPositionRevaluedV2 carries the fair-value movement (IFRS 9
// §5.7.1) the V2 bond FIL model (v2-core/fil-models/ir/bond) produces, and the
// modified-duration risk metric.
//
// F-032 (three sites): this module is exported from the event-types barrel
// (`index.ts`), registered in the registry domain file
// (`registry/bond-accounting-v2.ts`), and categorised in `provenance-category.ts`.
//
// Authority: D-V1-REMOVAL-PHASE-3C (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16;
//            IFRS 9 §3.1.1, §3.2.3, §4.1.4, §5.4.1, §5.7.1; IAS 32; Banks Act 94 of 1990.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { tenantIdSchema } from "../../../v2-core/control-plane/tenant";
import { moneyWireSchema } from "../../core/money-codec";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

/** Every V2 bond payload carries the literal schema-version marker. */
const SCHEMA_VERSION_2 = z.literal(2);

// ===========================================================================
// BondTradeExecuted — V2 (initial recognition; FVTPL designation)
// ===========================================================================

export const bondTradeExecutedV2PayloadSchema = z.object({
  tradeId: z.string().min(1),
  bondIsin: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  /** Nominal / face value (decimal-native, currency-carrying). */
  nominal: moneyWireSchema,
  cleanPricePercent: z.number().positive(),
  /** Accrued interest component (decimal-native, currency-carrying). */
  accruedInterest: moneyWireSchema,
  dirtyPricePercent: z.number().positive(),
  settlementDate: z.string().min(1),
  portfolio: z.enum(["trading-book", "banking-book"]),
  couponRate: z.number().nonnegative(),
  maturityDate: z.string().min(1),
  counterpartyLei: z.string().min(1),
  executedAt: z.string().min(1),
  bookDesignation: z.enum(["trading", "banking"]).optional(),
  exposureClass: z.enum(["sovereign", "bank", "corporate", "retail"]).optional(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type BondTradeExecutedV2Payload = z.infer<typeof bondTradeExecutedV2PayloadSchema>;

export function makeBondTradeExecutedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondTradeExecutedV2Payload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondTradeExecutedV2 requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondTradeExecutedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondTradeExecutedV2PayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// BondInterestAccrued — V2 (daily EIR accrual; IFRS 9 §5.4.1)
// ===========================================================================

export const bondInterestAccruedV2PayloadSchema = z.object({
  tradeId: z.string().min(1),
  bondIsin: z.string().min(1),
  accrualDate: z.string().min(1),
  /** Accrued interest income for this period (decimal-native). */
  accruedInterest: moneyWireSchema,
  eirRate: z.number().positive(),
  /** Carrying amount at the opening of this accrual period (decimal-native). */
  openingCarryingAmount: moneyWireSchema,
  /** Carrying amount at the close of this accrual period (decimal-native). */
  closingCarryingAmount: moneyWireSchema,
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type BondInterestAccruedV2Payload = z.infer<typeof bondInterestAccruedV2PayloadSchema>;

export function makeBondInterestAccruedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondInterestAccruedV2Payload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondInterestAccruedV2 requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondInterestAccruedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondInterestAccruedV2PayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// BondPositionRevalued — V2 (FVTPL fair-value remeasurement; IFRS 9 §5.7.1)
// ===========================================================================

export const bondPositionRevaluedV2PayloadSchema = z.object({
  tradeId: z.string().min(1),
  bondIsin: z.string().min(1),
  revalDate: z.string().min(1),
  bookCleanPricePercent: z.number().positive(),
  currentCleanPricePercent: z.number().positive(),
  /**
   * Signed unrealised P&L (decimal-native, currency-carrying). Positive = gain
   * (market > book); negative = loss. Replaces the V1 `unrealisedPnlZarMinor`
   * minor-integer with a currency-carrying MoneyWire (WS-MULTI-BASE-CURRENCY).
   */
  unrealisedPnl: moneyWireSchema,
  /** Modified duration at the revaluation date (years; nonnegative). */
  modifiedDuration: z.number().nonnegative().optional(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type BondPositionRevaluedV2Payload = z.infer<typeof bondPositionRevaluedV2PayloadSchema>;

export function makeBondPositionRevaluedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondPositionRevaluedV2Payload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondPositionRevaluedV2 requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondPositionRevaluedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondPositionRevaluedV2PayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// BondMatured — V2 (derecognition at par; IFRS 9 §3.2.3)
// ===========================================================================

export const bondMaturedV2PayloadSchema = z.object({
  tradeId: z.string().min(1),
  bondIsin: z.string().min(1),
  maturityDate: z.string().min(1),
  /** Nominal amount repaid by issuer (decimal-native). */
  nominalRepaid: moneyWireSchema,
  /** Final coupon payment (decimal-native; may be 0 if paid separately). */
  finalCoupon: moneyWireSchema,
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type BondMaturedV2Payload = z.infer<typeof bondMaturedV2PayloadSchema>;

export function makeBondMaturedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondMaturedV2Payload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondMaturedV2 requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondMaturedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondMaturedV2PayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// BondSold — V2 (derecognition on sale; realised gain/loss; IFRS 9 §3.2.3)
// ===========================================================================

export const bondSoldV2PayloadSchema = z.object({
  tradeId: z.string().min(1),
  bondIsin: z.string().min(1),
  side: z.literal("sell"),
  /** Net sale proceeds (decimal-native, currency-carrying). */
  saleProceeds: moneyWireSchema,
  /** Carrying amount at point of sale (decimal-native). */
  carryingAmountAtSale: moneyWireSchema,
  /** Realised P&L = saleProceeds − carryingAmountAtSale (decimal-native, signed). */
  realisedPnl: moneyWireSchema,
  settlementDate: z.string().min(1),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type BondSoldV2Payload = z.infer<typeof bondSoldV2PayloadSchema>;

export function makeBondSoldV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondSoldV2Payload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondSoldV2 requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondSoldV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondSoldV2PayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event-type registry for this module (F-032 barrel input).
// ---------------------------------------------------------------------------

export const BOND_ACCOUNTING_V2_TYPED_EVENT_TYPES = [
  "BondTradeExecutedV2",
  "BondInterestAccruedV2",
  "BondPositionRevaluedV2",
  "BondMaturedV2",
  "BondSoldV2",
] as const;

export type BondAccountingV2EventType = (typeof BOND_ACCOUNTING_V2_TYPED_EVENT_TYPES)[number];
