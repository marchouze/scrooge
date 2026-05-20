// platform/event-store/event-types/credit-limit.ts
//
// WS-CREDIT-LIMIT-ENGINE — Credit-limit lifecycle typed event-payload schemas.
//
// Covers the application → analysis → ISDA/CSA assessment → proposal →
// approval → load → annual review → breach lifecycle for counterparty
// credit limits under the SA LEX regime + Banks Act §73.
//
// Event family (10 events):
//   CreditLimitApplicationSubmitted (PROC-RISK-CO-01 Step 1)
//   CreditLimitExtensionRequested
//   CreditAnalysisCompleted          (PROC-RISK-CO-01 Step 2)
//   ISDACSAAssessmentCompleted       (PROC-RISK-CO-01 Step 3)
//   CreditLimitProposed              (PROC-RISK-CO-01 Step 4)
//   CreditLimitApproved              (PROC-RISK-CO-01 Step 5)
//   CreditLimitLoaded                (PROC-RISK-CO-01 Step 6)
//   CreditLimitAnnualReviewCompleted (PROC-RISK-CO-01 Step 7)
//   CreditLimitBreached              (PROC-RISK-CO-01 Step 8; policy §1.4)
//   CreditLimitBreachDisposed
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//
// Citations:
//   Banks Act 94 of 1990 §73 (large exposures — single counterparty);
//   Regulations Relating to Banks (RRB) Regulation 23 (credit-risk large
//     exposure limits);
//   LEX Directive D3/2022 (Large Exposures);
//   BCBS 283 (supervisory framework for measuring and controlling large
//     exposures, 2014);
//   ISDA Master Agreement (2002);
//   GMRA (2011);
//   Policies/credit-risk-policy-v1.md (IN FORCE 2026-05-13);
//   Procedures/by-policy/credit-origination.md (PROC-RISK-CO-01);
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Rohan (Market risk quantitative engineer, engineering — SA-CCR / RC shapes).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { deterministicAggregateId, makeAggregateLabel } from "../aggregate";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared enumerations
// ---------------------------------------------------------------------------

/**
 * Approval-authority level. Routes through the credit-risk governance
 * hierarchy per Credit Risk Policy §7 (line 232) and the SA Banks Act
 * delegation of authority schedule.
 *
 *   CRO   — Chief Risk Officer (intra-mandate)
 *   CRC   — Credit Risk Committee
 *   BRC   — Board Risk Committee
 *   CEO   — Chief Executive Officer (escalation)
 *   Board — Full Board (super-threshold or PA-notifiable exposures)
 */
export const creditApprovalAuthoritySchema = z.enum(["CRO", "CRC", "BRC", "CEO", "Board"]);

export type CreditApprovalAuthority = z.infer<typeof creditApprovalAuthoritySchema>;

/**
 * Basis on which a proposed limit was derived. Policy §3 mandates that
 * derivative + repo exposures be sized off the SA-CCR replacement-cost
 * + PFE methodology, while vanilla unsecured exposure uses the rating
 * matrix. Citation: Credit Risk Policy §3 line 129.
 */
export const creditLimitBasisSchema = z.enum(["rating-matrix", "sa-ccr-derived", "pfe-derived"]);

export type CreditLimitBasis = z.infer<typeof creditLimitBasisSchema>;

/**
 * Severity of a credit-limit breach. Drives the escalation channel per
 * Credit Risk Policy §1.4 (traffic-light protocol).
 *   amber    — soft breach, within tolerance band; CRO notified
 *   red      — hard breach; CRC convened; new trades blocked
 *   critical — RAS Tier-1 breach; BRC + CEO escalation; PA notification
 */
export const creditBreachSeveritySchema = z.enum(["amber", "red", "critical"]);

export type CreditBreachSeverity = z.infer<typeof creditBreachSeveritySchema>;

/**
 * Disposition type for a closed breach. PROC-RISK-CO-01 Step 8.
 *   unwound     — offending position closed
 *   novated     — transferred to another counterparty
 *   accepted    — CRC-approved standing exception (cf. CrcLimitExceptionApproved)
 *   remediated  — collateral top-up / netting amendment brought exposure back in line
 */
export const creditBreachDispositionSchema = z.enum([
  "unwound",
  "novated",
  "accepted",
  "remediated",
]);

export type CreditBreachDisposition = z.infer<typeof creditBreachDispositionSchema>;

/**
 * ISDA / CSA assessment status. PROC-RISK-CO-01 Step 3.
 *   executed       — ISDA Master + CSA in force; netting enforceable opinion held
 *   in-negotiation — drafts exchanged but not signed; treat exposure gross
 *   absent         — no master agreement; counterparty restricted to spot / cash
 */
export const isdaCsaStatusSchema = z.enum(["executed", "in-negotiation", "absent"]);

export type IsdaCsaStatus = z.infer<typeof isdaCsaStatusSchema>;

// ---------------------------------------------------------------------------
// CreditLimitApplicationSubmitted — PROC-RISK-CO-01 Step 1
// ---------------------------------------------------------------------------

export const creditLimitApplicationSubmittedPayloadSchema = z.object({
  /**
   * Application aggregate identifier. Convention:
   *   `CL-APP-<YYYY>-<seq>` for greenfield applications;
   *   `CL-EXT-<YYYY>-<seq>` for extension requests downstream-linked
   *   into the same aggregate.
   */
  applicationId: z.string().min(1),

  /** Party register ID of the institutional counterparty under application. */
  counterpartyId: z.string().min(1),

  /** Requested limit in minor units (cents). Non-negative integer. */
  requestedLimit: z.number().int().nonnegative(),

  /** ISO 4217 currency code of the requested limit. */
  currency: z.string().min(3).max(3),

  /** Tenor of the requested facility, free-form (e.g., "364D", "5Y"). */
  tenor: z.string().min(1),

  /**
   * Product types covered by the application. Free-form list of
   * canonical product codes (DCAM layer-1) — e.g., ["fx-spot", "fx-forward",
   * "ird-swap", "repo"].
   */
  productTypes: z.array(z.string().min(1)).min(1),

  /** Trading desk seeking the limit (e.g., "FX-Sales", "Rates-Trading"). */
  tradingDesk: z.string().min(1),

  /** Free-text commercial rationale (1-3 sentences). */
  commercialRationale: z.string().min(1),

  /** Agent / human that submitted (party register ID or seat). */
  submittedBy: z.string().min(1),

  /** ISO 8601 timestamp of submission. */
  submittedAt: z.string().min(1),
});

export type CreditLimitApplicationSubmittedPayload = z.infer<
  typeof creditLimitApplicationSubmittedPayloadSchema
>;

export function makeCreditLimitApplicationSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditLimitApplicationSubmittedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("credit-limit-app", args.payload.applicationId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditLimitApplicationSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditLimitApplicationSubmittedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CreditLimitExtensionRequested
// ---------------------------------------------------------------------------

export const creditLimitExtensionRequestedPayloadSchema = z.object({
  applicationId: z.string().min(1),
  counterpartyId: z.string().min(1),
  /** Current approved limit at the time of extension request (minor units). */
  currentLimit: z.number().int().nonnegative(),
  /** Newly requested limit (minor units). */
  requestedLimit: z.number().int().nonnegative(),
  /** Free-text reason for the extension (e.g., "client growing FX flow"). */
  reason: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
});

export type CreditLimitExtensionRequestedPayload = z.infer<
  typeof creditLimitExtensionRequestedPayloadSchema
>;

export function makeCreditLimitExtensionRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditLimitExtensionRequestedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("credit-limit-app", args.payload.applicationId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditLimitExtensionRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditLimitExtensionRequestedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CreditAnalysisCompleted — PROC-RISK-CO-01 Step 2
// ---------------------------------------------------------------------------

export const creditAnalysisCompletedPayloadSchema = z.object({
  applicationId: z.string().min(1),
  counterpartyId: z.string().min(1),
  /** External rating (e.g., "BBB+", "A-", "Baa2"). Empty string when unrated. */
  externalRating: z.string(),
  /** Internal rating per the bank's PD-grade master scale (e.g., "IG-3"). */
  internalRating: z.string().min(1),
  /** Capital-adequacy ratio % (0-100+). */
  capitalAdequacyRatio: z.number(),
  /** Liquidity coverage / current ratio (proxy depending on counterparty type). */
  liquidityRatio: z.number(),
  /** Concentration flags raised (e.g., ["sector-concentration", "country-concentration"]). */
  concentrationFlags: z.array(z.string().min(1)),
  /** Party register ID of the analyst (typically an agent). */
  analystRef: z.string().min(1),
  completedAt: z.string().min(1),
});

export type CreditAnalysisCompletedPayload = z.infer<typeof creditAnalysisCompletedPayloadSchema>;

export function makeCreditAnalysisCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditAnalysisCompletedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("credit-limit-app", args.payload.applicationId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditAnalysisCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditAnalysisCompletedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// ISDACSAAssessmentCompleted — PROC-RISK-CO-01 Step 3
// ---------------------------------------------------------------------------

export const isdaCsaAssessmentCompletedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  isdaStatus: isdaCsaStatusSchema,
  /** CSA threshold in minor units. The amount of uncollateralised exposure
   * the bank tolerates before collateral calls fire. */
  csaThreshold: z.number().int().nonnegative(),
  /** Minimum transfer amount in minor units. */
  mta: z.number().int().nonnegative(),
  /** ISO 4217 currency code for csaThreshold + mta. */
  currency: z.string().min(3).max(3),
  /** True iff a clean netting-enforceability legal opinion is on file. */
  nettingEnforceable: z.boolean(),
  /** RMS document-store ID of the jurisdiction-of-incorporation opinion. */
  jurisdictionOpinionRef: z.string().min(1).optional(),
  assessedBy: z.string().min(1),
  assessedAt: z.string().min(1),
});

export type ISDACSAAssessmentCompletedPayload = z.infer<
  typeof isdaCsaAssessmentCompletedPayloadSchema
>;

export function makeISDACSAAssessmentCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ISDACSAAssessmentCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ISDACSAAssessmentCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: isdaCsaAssessmentCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CreditLimitProposed — PROC-RISK-CO-01 Step 4
// ---------------------------------------------------------------------------

export const creditLimitProposedPayloadSchema = z.object({
  applicationId: z.string().min(1),
  counterpartyId: z.string().min(1),
  proposedLimit: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
  basis: creditLimitBasisSchema,
  /** Proposed limit expressed as a % of eligible capital (LEX denominator). */
  largeExposurePct: z.number(),
  /** Headroom this proposal leaves under the RAS counterparty-concentration ceiling. */
  rasHeadroomPct: z.number(),
  /** Free-form list of conditions (e.g., "ISDA-execution-prerequisite"). */
  conditions: z.array(z.string().min(1)),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
});

export type CreditLimitProposedPayload = z.infer<typeof creditLimitProposedPayloadSchema>;

export function makeCreditLimitProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditLimitProposedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("credit-limit-app", args.payload.applicationId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditLimitProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditLimitProposedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CreditLimitApproved — PROC-RISK-CO-01 Step 5
// ---------------------------------------------------------------------------

export const creditLimitApprovedPayloadSchema = z.object({
  applicationId: z.string().min(1),
  counterpartyId: z.string().min(1),
  limit: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
  tenor: z.string().min(1),
  approvedBy: z.string().min(1),
  approvalAuthority: creditApprovalAuthoritySchema,
  approvedAt: z.string().min(1),
  conditions: z.array(z.string().min(1)),
  /** ISO 8601 expiry date for the approved limit (one-year ceiling typical). */
  expiryDate: z.string().min(1).optional(),
});

export type CreditLimitApprovedPayload = z.infer<typeof creditLimitApprovedPayloadSchema>;

export function makeCreditLimitApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditLimitApprovedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("credit-limit-app", args.payload.applicationId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditLimitApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditLimitApprovedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CreditLimitLoaded — PROC-RISK-CO-01 Step 6
// ---------------------------------------------------------------------------

export const creditLimitLoadedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  limit: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
  loadedAt: z.string().min(1),
  /** ISO 8601 — when the limit becomes effective for pre-deal checks. */
  effectiveFrom: z.string().min(1),
  loadedBy: z.string().min(1),
});

export type CreditLimitLoadedPayload = z.infer<typeof creditLimitLoadedPayloadSchema>;

export function makeCreditLimitLoaded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditLimitLoadedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditLimitLoaded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditLimitLoadedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CreditLimitAnnualReviewCompleted — PROC-RISK-CO-01 Step 7
// ---------------------------------------------------------------------------

export const creditLimitAnnualReviewCompletedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /** Four-digit calendar year of the review (e.g., 2026). */
  reviewYear: z.number().int().min(2000),
  revisedLimit: z.number().int().nonnegative(),
  /** ISO 4217 currency for the revised limit. */
  currency: z.string().min(3).max(3),
  rationale: z.string().min(1),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().min(1),
});

export type CreditLimitAnnualReviewCompletedPayload = z.infer<
  typeof creditLimitAnnualReviewCompletedPayloadSchema
>;

export function makeCreditLimitAnnualReviewCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditLimitAnnualReviewCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditLimitAnnualReviewCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditLimitAnnualReviewCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CreditLimitBreached — PROC-RISK-CO-01 Step 8; Credit Risk Policy §1.4
// ---------------------------------------------------------------------------

export const creditLimitBreachedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /** Breach identifier. Convention: `CL-BREACH-<YYYY>-<seq>`. */
  breachId: z.string().min(1),
  /** Observed exposure (minor units) at detection. */
  exposure: z.number().int().nonnegative(),
  /** Approved limit at the time of breach (minor units). */
  limit: z.number().int().nonnegative(),
  /** ISO 4217 currency for exposure + limit. */
  currency: z.string().min(3).max(3),
  severity: creditBreachSeveritySchema,
  detectedAt: z.string().min(1),
});

export type CreditLimitBreachedPayload = z.infer<typeof creditLimitBreachedPayloadSchema>;

export function makeCreditLimitBreached(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditLimitBreachedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("credit-limit-breach", args.payload.breachId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditLimitBreached",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditLimitBreachedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CreditLimitBreachDisposed
// ---------------------------------------------------------------------------

export const creditLimitBreachDisposedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  breachId: z.string().min(1),
  dispositionType: creditBreachDispositionSchema,
  approvedBy: z.string().min(1),
  /** ISO 8601 deadline for full remediation (may equal disposedAt for unwound/accepted). */
  remediationDeadline: z.string().min(1),
  disposedAt: z.string().min(1),
});

export type CreditLimitBreachDisposedPayload = z.infer<
  typeof creditLimitBreachDisposedPayloadSchema
>;

export function makeCreditLimitBreachDisposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CreditLimitBreachDisposedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("credit-limit-breach", args.payload.breachId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CreditLimitBreachDisposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: creditLimitBreachDisposedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CrcLimitExceptionApproved — Credit Risk Policy §7 line 232
// ---------------------------------------------------------------------------

export const crcLimitExceptionApprovedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /** Free-form exception type (e.g., "temporary-cap-override", "intra-day-relaxation"). */
  exceptionType: z.string().min(1),
  /** Originating application/breach ID, when the exception attaches to one. */
  applicationId: z.string().min(1).optional(),
  approvedAt: z.string().min(1),
  /** RMS document-store ID of the CRC minutes recording the approval. */
  minutesRef: z.string().min(1),
});

export type CrcLimitExceptionApprovedPayload = z.infer<
  typeof crcLimitExceptionApprovedPayloadSchema
>;

export function makeCrcLimitExceptionApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CrcLimitExceptionApprovedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CrcLimitExceptionApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: crcLimitExceptionApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SubInvestmentGradeCounterpartyApproved — Credit Risk Policy §3 line 146
// ---------------------------------------------------------------------------

export const subInvestmentGradeCounterpartyApprovedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  /** Rating at the time the BRC / CEO approved trading with the counterparty. */
  ratingAtApproval: z.string().min(1),
  /** ISO 8601 date of approval. */
  approvalDate: z.string().min(1),
  /** ISO 8601 date by which the standing approval must be re-reviewed. */
  reviewDate: z.string().min(1),
  /** Approving authority. Sub-IG counterparties may only be approved by BRC or CEO. */
  approverAuthority: z.enum(["BRC", "CEO"]),
});

export type SubInvestmentGradeCounterpartyApprovedPayload = z.infer<
  typeof subInvestmentGradeCounterpartyApprovedPayloadSchema
>;

export function makeSubInvestmentGradeCounterpartyApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SubInvestmentGradeCounterpartyApprovedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SubInvestmentGradeCounterpartyApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: subInvestmentGradeCounterpartyApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CREDIT_LIMIT_TYPED_EVENT_TYPES — registry of event types in this module.
//
// To add a new credit-limit event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a row to platform/event-store/registry/credit-limit.ts,
//   (4) add a spread in event-types/index.ts.
// ---------------------------------------------------------------------------

export const CREDIT_LIMIT_TYPED_EVENT_TYPES = [
  "CreditLimitApplicationSubmitted",
  "CreditLimitExtensionRequested",
  "CreditAnalysisCompleted",
  "ISDACSAAssessmentCompleted",
  "CreditLimitProposed",
  "CreditLimitApproved",
  "CreditLimitLoaded",
  "CreditLimitAnnualReviewCompleted",
  "CreditLimitBreached",
  "CreditLimitBreachDisposed",
  "CrcLimitExceptionApproved",
  "SubInvestmentGradeCounterpartyApproved",
] as const;

export type CreditLimitEventType = (typeof CREDIT_LIMIT_TYPED_EVENT_TYPES)[number];
