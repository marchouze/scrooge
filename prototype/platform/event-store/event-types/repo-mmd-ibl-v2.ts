// platform/event-store/event-types/repo-mmd-ibl-v2.ts
//
// V2-PARALLEL lifecycle event schemas for the money-market instrument families
// (Repo / Money Market Deposit / Funding Line / Interbank Loan). These run
// DUAL-PARALLEL to the V1 schemas in `repo-mmd-ibl.ts` (D-V1-REMOVAL-PHASE-3B):
// the V1 events stay `v1-only`; these V2 events are `v2-parallel` and feed the
// V2 GL posting handlers (gl-posting-engine-v2.ts) and the V1↔V2 BA-300 parity
// gate.
//
// Each V2 payload is IDENTICAL to its V1 counterpart EXCEPT:
//   - `tenantId: TenantId`         — the multi-tenant axis (S2).
//   - amounts are `MoneyWire`       — decimal-native major-unit money, NEVER a
//                                     minor-unit `z.number().int()` (the
//                                     no-float-money / no-residual-minor gates).
//   - `schemaVersion: 2`            — the V2 schema marker (literal).
//
// CURRENCY-AGNOSTIC (WS-MULTI-BASE-CURRENCY, #1382): every money field carries
// its OWN currency on the MoneyWire. There is NO hardcoded reporting / base
// currency anywhere — the V1 `*Zar` minor fields are lifted to currency-carrying
// MoneyWire, so a deposit in USD records `{ currency: "USD", amount }` rather
// than implying ZAR.
//
// F-032 (three sites): this module is exported from the event-types barrel
// (`index.ts`), registered in the registry domain file
// (`registry/repo-mmd-ibl-v2.ts`), and categorised in `provenance-category.ts`.
//
// Authority: D-V1-REMOVAL-PHASE-3B (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16;
//            IFRS 9 §3.1.1, §4.1.2, §4.2.1, §5.4.1; IAS 39 §27;
//            Banks Act 94 of 1990 Reg 26/27; BA 300.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { tenantIdSchema } from "../../../v2-core/control-plane/tenant";
import { moneyWireSchema } from "../../core/money-codec";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

/** Every V2 money-market payload carries the literal schema-version marker. */
const SCHEMA_VERSION_2 = z.literal(2);

// ===========================================================================
// Repo — V2
// ===========================================================================

export const repoTradeOpenedV2PayloadSchema = z.object({
  tradeId: z.string(),
  counterpartyLei: z.string(),
  startLegSettlementDate: z.string(),
  endLegSettlementDate: z.string(),
  /** Cash received on start leg (decimal-native, currency-carrying). */
  startLegCash: moneyWireSchema,
  /** Agreed repurchase price (decimal-native, currency-carrying). */
  repurchasePrice: moneyWireSchema,
  repoRateDecimal: z.number(),
  collateralIsin: z.string(),
  /** Face / nominal value of collateral (decimal-native, currency-carrying). */
  collateralFaceValue: moneyWireSchema,
  collateralHaircutPct: z.number(),
  bookId: z.string(),
  traderRef: z.string(),
  instrumentRef: z.string(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type RepoTradeOpenedV2Payload = z.infer<typeof repoTradeOpenedV2PayloadSchema>;

export function makeRepoTradeOpenedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoTradeOpenedV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoTradeOpenedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoTradeOpenedV2PayloadSchema.parse(args.payload),
  });
}

export const repoTradeTerminatedV2PayloadSchema = z.object({
  tradeId: z.string(),
  /** Actual repurchase price paid at the end leg (decimal-native). */
  repurchasePrice: moneyWireSchema,
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type RepoTradeTerminatedV2Payload = z.infer<typeof repoTradeTerminatedV2PayloadSchema>;

export function makeRepoTradeTerminatedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoTradeTerminatedV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoTradeTerminatedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoTradeTerminatedV2PayloadSchema.parse(args.payload),
  });
}

export const repoTradeTerminatedEarlyV2PayloadSchema = z.object({
  tradeId: z.string(),
  reason: z.string(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type RepoTradeTerminatedEarlyV2Payload = z.infer<
  typeof repoTradeTerminatedEarlyV2PayloadSchema
>;

export function makeRepoTradeTerminatedEarlyV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoTradeTerminatedEarlyV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoTradeTerminatedEarlyV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoTradeTerminatedEarlyV2PayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// Money Market Deposit — V2 (bank as taker; liability)
// ===========================================================================

export const depositTakenV2PayloadSchema = z.object({
  depositId: z.string(),
  counterpartyLei: z.string(),
  /** Principal deposited (decimal-native, currency-carrying). */
  principal: moneyWireSchema,
  interestRateDecimal: z.number(),
  maturityDate: z.string(),
  depositCategory: z.enum([
    "retail-stable",
    "retail-less-stable",
    "wholesale-operational",
    "wholesale-non-operational",
  ]),
  bookId: z.string(),
  instrumentRef: z.string(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type DepositTakenV2Payload = z.infer<typeof depositTakenV2PayloadSchema>;

export function makeDepositTakenV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositTakenV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositTakenV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositTakenV2PayloadSchema.parse(args.payload),
  });
}

export const depositInterestAccruedV2PayloadSchema = z.object({
  depositId: z.string(),
  /** Accrued interest for this period (decimal-native). */
  accruedInterest: moneyWireSchema,
  accrualDate: z.string(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type DepositInterestAccruedV2Payload = z.infer<
  typeof depositInterestAccruedV2PayloadSchema
>;

export function makeDepositInterestAccruedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositInterestAccruedV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositInterestAccruedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositInterestAccruedV2PayloadSchema.parse(args.payload),
  });
}

export const depositMaturedV2PayloadSchema = z.object({
  depositId: z.string(),
  /** Principal repaid (decimal-native). */
  principal: moneyWireSchema,
  /** Total interest paid at maturity (decimal-native). */
  interestPaid: moneyWireSchema,
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type DepositMaturedV2Payload = z.infer<typeof depositMaturedV2PayloadSchema>;

export function makeDepositMaturedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositMaturedV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositMaturedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositMaturedV2PayloadSchema.parse(args.payload),
  });
}

export const depositWithdrawnEarlyV2PayloadSchema = z.object({
  depositId: z.string(),
  /** Early-withdrawal penalty retained by the bank (decimal-native; 0 if none). */
  penalty: moneyWireSchema,
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type DepositWithdrawnEarlyV2Payload = z.infer<
  typeof depositWithdrawnEarlyV2PayloadSchema
>;

export function makeDepositWithdrawnEarlyV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositWithdrawnEarlyV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositWithdrawnEarlyV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositWithdrawnEarlyV2PayloadSchema.parse(args.payload),
  });
}

export const depositRolledOverV2PayloadSchema = z.object({
  depositId: z.string(),
  newMaturityDate: z.string(),
  newInterestRateDecimal: z.number(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type DepositRolledOverV2Payload = z.infer<typeof depositRolledOverV2PayloadSchema>;

export function makeDepositRolledOverV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositRolledOverV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositRolledOverV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositRolledOverV2PayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// Funding line — V2 (wholesale committed facility drawdown; liability)
// ===========================================================================

export const fundingLineDrawnV2PayloadSchema = z.object({
  fundingLineId: z.string(),
  /** Amount drawn (decimal-native, currency-carrying). */
  drawnAmount: moneyWireSchema,
  maturityDate: z.string(),
  rateDecimal: z.number(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type FundingLineDrawnV2Payload = z.infer<typeof fundingLineDrawnV2PayloadSchema>;

export function makeFundingLineDrawnV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FundingLineDrawnV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FundingLineDrawnV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fundingLineDrawnV2PayloadSchema.parse(args.payload),
  });
}

export const fundingLineRepaidV2PayloadSchema = z.object({
  fundingLineId: z.string(),
  /** Amount repaid (decimal-native). */
  repaidAmount: moneyWireSchema,
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type FundingLineRepaidV2Payload = z.infer<typeof fundingLineRepaidV2PayloadSchema>;

export function makeFundingLineRepaidV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FundingLineRepaidV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FundingLineRepaidV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fundingLineRepaidV2PayloadSchema.parse(args.payload),
  });
}

// ===========================================================================
// Interbank Loan — V2 (bank as lender / cash placer; asset)
// ===========================================================================

export const interbankLoanPlacedV2PayloadSchema = z.object({
  placementId: z.string(),
  counterpartyLei: z.string(),
  /** Principal placed (decimal-native, currency-carrying). */
  principal: moneyWireSchema,
  rateDecimal: z.number(),
  startDate: z.string(),
  maturityDate: z.string().nullable(),
  placementType: z.enum(["fixed-term", "call"]),
  bookId: z.string(),
  instrumentRef: z.string(),
  exposureClass: z.enum(["sovereign", "bank", "corporate", "retail"]).optional(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type InterbankLoanPlacedV2Payload = z.infer<typeof interbankLoanPlacedV2PayloadSchema>;

export function makeInterbankLoanPlacedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterbankLoanPlacedV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterbankLoanPlacedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interbankLoanPlacedV2PayloadSchema.parse(args.payload),
  });
}

export const interbankLoanInterestAccruedV2PayloadSchema = z.object({
  placementId: z.string(),
  /** Accrued interest for this period (decimal-native). */
  accruedInterest: moneyWireSchema,
  accrualDate: z.string(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type InterbankLoanInterestAccruedV2Payload = z.infer<
  typeof interbankLoanInterestAccruedV2PayloadSchema
>;

export function makeInterbankLoanInterestAccruedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterbankLoanInterestAccruedV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterbankLoanInterestAccruedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interbankLoanInterestAccruedV2PayloadSchema.parse(args.payload),
  });
}

export const interbankLoanMaturedV2PayloadSchema = z.object({
  placementId: z.string(),
  /** Principal received back (decimal-native). */
  principal: moneyWireSchema,
  /** Total interest received at maturity (decimal-native). */
  interestReceived: moneyWireSchema,
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type InterbankLoanMaturedV2Payload = z.infer<
  typeof interbankLoanMaturedV2PayloadSchema
>;

export function makeInterbankLoanMaturedV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterbankLoanMaturedV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterbankLoanMaturedV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interbankLoanMaturedV2PayloadSchema.parse(args.payload),
  });
}

export const interbankLoanRecalledEarlyV2PayloadSchema = z.object({
  placementId: z.string(),
  tenantId: tenantIdSchema,
  schemaVersion: SCHEMA_VERSION_2,
});

export type InterbankLoanRecalledEarlyV2Payload = z.infer<
  typeof interbankLoanRecalledEarlyV2PayloadSchema
>;

export function makeInterbankLoanRecalledEarlyV2(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterbankLoanRecalledEarlyV2Payload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterbankLoanRecalledEarlyV2",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interbankLoanRecalledEarlyV2PayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event-type registry for this module (F-032 barrel input).
// ---------------------------------------------------------------------------

export const REPO_MMD_IBL_V2_TYPED_EVENT_TYPES = [
  // Repo
  "RepoTradeOpenedV2",
  "RepoTradeTerminatedV2",
  "RepoTradeTerminatedEarlyV2",
  // MMD
  "DepositTakenV2",
  "DepositInterestAccruedV2",
  "DepositMaturedV2",
  "DepositWithdrawnEarlyV2",
  "DepositRolledOverV2",
  // Funding line
  "FundingLineDrawnV2",
  "FundingLineRepaidV2",
  // IBL
  "InterbankLoanPlacedV2",
  "InterbankLoanInterestAccruedV2",
  "InterbankLoanMaturedV2",
  "InterbankLoanRecalledEarlyV2",
] as const;

export type RepoMmdIblV2EventType = (typeof REPO_MMD_IBL_V2_TYPED_EVENT_TYPES)[number];
