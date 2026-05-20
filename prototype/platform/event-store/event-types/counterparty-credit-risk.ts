// platform/event-store/event-types/counterparty-credit-risk.ts
//
// WS-CREDIT-LIMIT-ENGINE — SA-CCR / LEX computation typed event-payload
// schemas.
//
// Covers the daily measurement outputs feeding the credit-limit engine:
//   CcrReplacementCostComputed — SA-CCR replacement-cost per netting set
//     (Credit Risk Policy §3 line 129).
//   CcrEadComputed             — SA-CCR exposure-at-default per netting set
//     (Credit Risk Policy §3 line 131; BCBS d317 §10 EAD = α × (RC + PFE)).
//   LexUtilisationComputed     — large-exposure utilisation per counterparty
//     or connected group (Credit Risk Policy §2 line 107).
//   LexExceptionApproved       — sub-limit / cap exception register entry
//     (Credit Risk Policy §2 line 103).
//
// These are the measurement / governance siblings of the lifecycle events
// in `credit-limit.ts`. Splitting them out keeps the lifecycle (which is
// driven by PROC-RISK-CO-01) cleanly separate from the daily computation
// outputs (which are driven by the SA-CCR engine — follow-on slice).
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//
// Citations:
//   Banks Act 94 of 1990 §73;
//   RRB Regulation 23 (large exposures);
//   LEX Directive D3/2022 (Large Exposures);
//   BCBS 279 (SA-CCR — standardised approach for counterparty credit risk,
//     March 2014, rev. 2017);
//   BCBS 283 (large exposures framework, 2014);
//   Policies/credit-risk-policy-v1.md §2 + §3 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Authors: Rohan (Market risk quantitative engineer, engineering — SA-CCR
//   shapes) + Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// CcrReplacementCostComputed — Credit Risk Policy §3 line 129
//
// SA-CCR Replacement Cost (RC) is the larger of the current net mark-to-
// market of the netting set less collateral held, or zero. BCBS 279 §136.
//
//   RC = max(V − C ; 0)
//
// where V is the current MTM of the trades in the netting set and C is the
// market value of net collateral held (positive when collateral favours
// the bank). The PFE (potential-future-exposure) add-on lives on a
// separate event-type to keep concerns small (follow-on slice).
// ---------------------------------------------------------------------------

export const ccrReplacementCostComputedPayloadSchema = z.object({
  /**
   * Netting-set identifier. A netting set is the set of trades subject to
   * a single legally-enforceable netting agreement (typically a single
   * ISDA Master + CSA pair). Convention: `NS-<counterpartyId>-<ccy>`.
   */
  nettingSetId: z.string().min(1),

  /** Party register ID of the counterparty under measurement. */
  counterpartyId: z.string().min(1),

  /** Replacement cost (RC) in minor units of `currency`. Non-negative
   * integer — BCBS 279 §136 floors at zero. */
  rc: z.number().int().nonnegative(),

  /** ISO 4217 currency code of the rc / vMtm / collateralHeld figures. */
  currency: z.string().min(3).max(3),

  /** ISO 8601 — the as-of date of the measurement (T-0 close of business). */
  computationDate: z.string().min(1),

  /**
   * Methodology marker. SA-CCR is the only supported flavour at present;
   * the field is present so the event-type can carry a future IMM
   * (internal-model method) extension without a schema break.
   */
  methodology: z.literal("sa-ccr"),

  /**
   * Net mark-to-market of the netting set (in minor units). Signed integer —
   * positive when net favourable to the bank, negative when adverse. The
   * RC formula floors at zero but vMtm is preserved here for audit and
   * follow-on Vera recon (RC ≥ max(vMtm − collateralHeld, 0)).
   */
  vMtm: z.number().int(),

  /** Net collateral held against the netting set (minor units, non-negative). */
  collateralHeld: z.number().int().nonnegative(),
});

export type CcrReplacementCostComputedPayload = z.infer<
  typeof ccrReplacementCostComputedPayloadSchema
>;

export function makeCcrReplacementCostComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CcrReplacementCostComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CcrReplacementCostComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ccrReplacementCostComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CcrEadComputed — Credit Risk Policy §3 line 131
//
// SA-CCR Exposure-At-Default (EAD) composition over a netting set:
//
//   EAD = α × (RC + PFE)   with α = 1.4
//
// where RC is the Replacement Cost (per `CcrReplacementCostComputed`) and
// PFE is the aggregated potential-future-exposure add-on across the asset
// classes observed in the netting set. BCBS d317 §10 / CRE52 §52.5.
//
// This event is the canonical EAD figure the credit-limit engine reads.
// Before this event existed, `pre-deal-check` had to re-derive
// `α × (RC + PFE)` from the RC event on every call; with `CcrEadComputed`
// the engine can read the EAD directly (and fall back to RC-only as a
// degraded mode when no EAD event is observed).
//
// `sourceEvents` records the chain back to the inputs:
//   rcEventId      — event_id of the CcrReplacementCostComputed used as input.
//   pfeComponents  — count of AddOnComponent inputs aggregated into PFE
//     (zero is legitimate — netting set with no trades has PFE = 0).
// ---------------------------------------------------------------------------

export const ccrEadComputedPayloadSchema = z.object({
  /** Netting-set identifier. Convention: `NS-<counterpartyId>-<ccy>`. */
  nettingSetId: z.string().min(1),

  /** Party register ID of the counterparty under measurement. */
  counterpartyId: z.string().min(1),

  /** Replacement cost (RC) in minor units of `currency`. Non-negative —
   * BCBS d317 §136 floors at zero. Sourced from the input
   * `CcrReplacementCostComputed` event. */
  rc: z.number().int().nonnegative(),

  /** Aggregated PFE add-on in minor units of `currency`. Non-negative —
   * `Σ AddOnComponent.addOn` per BCBS d317 Table 2. */
  pfe: z.number().int().nonnegative(),

  /** BCBS d317 §10 regulatory multiplier α. Constant 1.4 — recorded so the
   * event is self-describing for audit. */
  alpha: z.literal(1.4),

  /** Exposure-at-default in minor units of `currency`. Non-negative integer.
   * Computed as `α × (RC + PFE)` with half-up rounding to minor units. */
  ead: z.number().int().nonnegative(),

  /** ISO 4217 currency code for `rc`, `pfe`, `ead`. */
  currency: z.string().min(3).max(3),

  /** ISO 8601 — the as-of date of the measurement (T-0 close of business). */
  computationDate: z.string().min(1),

  /** Methodology marker. SA-CCR only at present; future IMM extension would
   * be carried as a discriminated variant rather than overloading this
   * literal. */
  methodology: z.literal("sa-ccr"),

  /** Provenance chain back to the RC + PFE inputs that produced this EAD. */
  sourceEvents: z.object({
    /** event_id of the `CcrReplacementCostComputed` event whose RC fed this
     * EAD computation. Vera recon asserts the chain. */
    rcEventId: z.string().min(1),
    /** Count of `AddOnComponent` inputs aggregated into PFE. Zero is valid
     * (netting set with no live trades). */
    pfeComponents: z.number().int().nonnegative(),
  }),
});

export type CcrEadComputedPayload = z.infer<typeof ccrEadComputedPayloadSchema>;

export function makeCcrEadComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CcrEadComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CcrEadComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ccrEadComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LexUtilisationComputed — Credit Risk Policy §2 line 107
//
// Daily large-exposure utilisation per counterparty (and, where present,
// the connected group). Utilisation = totalExposure / eligibleCapital.
// The 25% Tier-1 + Tier-2 LEX cap (RRB Reg 23, BCBS 283) is enforced by
// downstream Vera recon — this event-type only records the inputs and
// derived %.
// ---------------------------------------------------------------------------

export const lexUtilisationComputedPayloadSchema = z.object({
  /** Party register ID of the counterparty under measurement. */
  counterpartyId: z.string().min(1),

  /** When the counterparty is part of a recognised connected group, the
   * group identifier. BCBS 283 §15 defines "group of connected counterparties". */
  connectedGroupId: z.string().min(1).optional(),

  /** Total exposure across all exposure types (minor units). Non-negative
   * integer — the LEX denominator already nets where eligible. */
  totalExposure: z.number().int().nonnegative(),

  /** Bank's eligible LEX capital base (Tier-1 + eligible Tier-2) in minor
   * units. Recomputed at each measurement; sourced from the capital-
   * adequacy projection. */
  eligibleCapital: z.number().int().nonnegative(),

  /** ISO 4217 currency for totalExposure + eligibleCapital. Must match the
   * bank's reporting currency (ZAR). */
  currency: z.string().min(3).max(3),

  /** Utilisation as a percentage (0–100+). >25 indicates LEX breach. */
  utilisationPct: z.number(),

  computedAt: z.string().min(1),
});

export type LexUtilisationComputedPayload = z.infer<typeof lexUtilisationComputedPayloadSchema>;

export function makeLexUtilisationComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LexUtilisationComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LexUtilisationComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: lexUtilisationComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LexExceptionApproved — Credit Risk Policy §2 line 103
//
// Where the credit-risk governance route has authorised a deviation from
// the default LEX rule (either a sub-limit relaxation or a cap override),
// the approval is recorded here. CRC may approve sub-limit exceptions
// under tolerance; BRC and PA escalate at higher thresholds.
// ---------------------------------------------------------------------------

export const lexExceptionApprovedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),

  /**
   * Exception type. `sub-limit` is a relaxation within the overall cap;
   * `cap` is an override of the 25% Tier-1 + Tier-2 ceiling (only
   * legitimately approvable by the PA per RRB Reg 23(7)).
   */
  exceptionType: z.enum(["sub-limit", "cap"]),

  /** Party register ID / seat of the approver. */
  approver: z.string().min(1),

  /** Authority level of the approver. PA = Prudential Authority. */
  approverAuthority: z.enum(["CRC", "BRC", "PA"]),

  /** ISO 8601 — when the standing exception expires. */
  expiryDate: z.string().min(1),

  approvedAt: z.string().min(1),
});

export type LexExceptionApprovedPayload = z.infer<typeof lexExceptionApprovedPayloadSchema>;

export function makeLexExceptionApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LexExceptionApprovedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LexExceptionApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: lexExceptionApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES — registry of event types
// in this module.
//
// To add a new CCR / LEX event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a row to platform/event-store/registry/counterparty-credit-risk.ts,
//   (4) add a spread in event-types/index.ts.
// ---------------------------------------------------------------------------

export const COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES = [
  "CcrReplacementCostComputed",
  "CcrEadComputed",
  "LexUtilisationComputed",
  "LexExceptionApproved",
] as const;

export type CounterpartyCreditRiskEventType =
  (typeof COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES)[number];
