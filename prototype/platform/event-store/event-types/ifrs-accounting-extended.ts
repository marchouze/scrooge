// platform/event-store/event-types/ifrs-accounting-extended.ts
//
// IFRS, accounting, regulatory reporting event-payload schemas.
//
// Covers: IFRS9ECLChange, IFRS9ECLPublished, MaterialIFRSClassificationChange,
//   PortfolioReclassification, AccrualBooked, DepositReceived, FundingDrawn,
//   FundingDrawnDown, LoanBooked, RestatementProposed, FinancialPositionSnapshot,
//   ObligationRegistered (already in agent-substrate-extended), SARSGuidanceUpdate,
//   TaxClassificationPublished, ExchangeRuleChange, SchemeRuleChange,
//   RegulatoryInstrumentUpdate, InterEntityTransactionProposed,
//   RelatedPartyTransactionProposed, MOIChangeProposed, LegalEntityChange,
//   ECTAExceptionFlagged, ClauseChangeProposed, ContractDraftRequested,
//   SignatureRequested
//
// Authority: F-032 (event-type-registry-coverage recon).
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// IFRS9ECLPublished
// ---------------------------------------------------------------------------

export const ifrs9ECLPublishedPayloadSchema = z.object({
  eclId: z.string().min(1),
  reportingPeriod: z.string().min(1),
  publishedBy: z.string().min(1),
  publishedAt: z.string().min(1),
  totalECL: z.number(),
  currency: z.string().min(3).max(3),
  stage1Amount: z.number().optional(),
  stage2Amount: z.number().optional(),
  stage3Amount: z.number().optional(),
  modelVersion: z.string().optional(),
});

export type IFRS9ECLPublishedPayload = z.infer<typeof ifrs9ECLPublishedPayloadSchema>;

export function makeIFRS9ECLPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IFRS9ECLPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IFRS9ECLPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ifrs9ECLPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IFRS9ECLChange
// ---------------------------------------------------------------------------

export const ifrs9ECLChangePayloadSchema = z.object({
  changeId: z.string().min(1),
  reportingPeriod: z.string().min(1),
  detectedAt: z.string().min(1),
  priorECL: z.number(),
  currentECL: z.number(),
  changeAmount: z.number(),
  currency: z.string().min(3).max(3),
  materialityThreshold: z.number().optional(),
  isMaterial: z.boolean(),
});

export type IFRS9ECLChangePayload = z.infer<typeof ifrs9ECLChangePayloadSchema>;

export function makeIFRS9ECLChange(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IFRS9ECLChangePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IFRS9ECLChange",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ifrs9ECLChangePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MaterialIFRSClassificationChange
// ---------------------------------------------------------------------------

export const materialIFRSClassificationChangePayloadSchema = z.object({
  changeId: z.string().min(1),
  instrumentId: z.string().min(1),
  priorClassification: z.enum(["FVTPL", "FVTOCI", "AC", "HFT", "AFS", "HTM", "other"]),
  newClassification: z.enum(["FVTPL", "FVTOCI", "AC", "HFT", "AFS", "HTM", "other"]),
  effectiveDate: z.string().min(1),
  approvedBy: z.string().min(1),
  ifrsReference: z.string().min(1),
  rationale: z.string().optional(),
});

export type MaterialIFRSClassificationChangePayload = z.infer<
  typeof materialIFRSClassificationChangePayloadSchema
>;

export function makeMaterialIFRSClassificationChange(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MaterialIFRSClassificationChangePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MaterialIFRSClassificationChange",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: materialIFRSClassificationChangePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PortfolioReclassification
// ---------------------------------------------------------------------------

export const portfolioReclassificationPayloadSchema = z.object({
  reclassificationId: z.string().min(1),
  instrumentId: z.string().min(1),
  fromPortfolio: z.string().min(1),
  toPortfolio: z.string().min(1),
  effectiveDate: z.string().min(1),
  approvedBy: z.string().min(1),
  rationale: z.string().optional(),
  ifrsReference: z.string().optional(),
});

export type PortfolioReclassificationPayload = z.infer<
  typeof portfolioReclassificationPayloadSchema
>;

export function makePortfolioReclassification(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PortfolioReclassificationPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PortfolioReclassification",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: portfolioReclassificationPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AccrualBooked
// ---------------------------------------------------------------------------

export const accrualBookedPayloadSchema = z.object({
  accrualId: z.string().min(1),
  accrualKind: z.enum(["interest", "fee", "dividend", "amortisation", "other"]),
  instrumentId: z.string().min(1),
  amount: z.number(),
  currency: z.string().min(3).max(3),
  accrualDate: z.string().min(1),
  glAccount: z.string().optional(),
  period: z.string().optional(),
});

export type AccrualBookedPayload = z.infer<typeof accrualBookedPayloadSchema>;

export function makeAccrualBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AccrualBookedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AccrualBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: accrualBookedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DepositReceived
// ---------------------------------------------------------------------------

export const depositReceivedPayloadSchema = z.object({
  depositId: z.string().min(1),
  counterpartyRef: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  depositDate: z.string().min(1),
  maturityDate: z.string().optional(),
  depositKind: z.enum(["call", "term", "overnight", "repo", "other"]),
  interestRate: z.number().nonnegative().optional(),
});

export type DepositReceivedPayload = z.infer<typeof depositReceivedPayloadSchema>;

export function makeDepositReceived(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositReceivedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositReceived",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositReceivedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FundingDrawn
// ---------------------------------------------------------------------------

export const fundingDrawnPayloadSchema = z.object({
  drawdownId: z.string().min(1),
  facilityId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  drawnAt: z.string().min(1),
  maturityDate: z.string().optional(),
  fundingKind: z.enum(["repo", "money-market", "bond-issuance", "interbank", "other"]),
});

export type FundingDrawnPayload = z.infer<typeof fundingDrawnPayloadSchema>;

export function makeFundingDrawn(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FundingDrawnPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FundingDrawn",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fundingDrawnPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FundingDrawnDown
// ---------------------------------------------------------------------------

export const fundingDrawnDownPayloadSchema = z.object({
  drawdownId: z.string().min(1),
  facilityId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  drawnAt: z.string().min(1),
  ftpAttributionRequired: z.boolean(),
  maturityDate: z.string().optional(),
});

export type FundingDrawnDownPayload = z.infer<typeof fundingDrawnDownPayloadSchema>;

export function makeFundingDrawnDown(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FundingDrawnDownPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FundingDrawnDown",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fundingDrawnDownPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LoanBooked
// ---------------------------------------------------------------------------

export const loanBookedPayloadSchema = z.object({
  loanId: z.string().min(1),
  counterpartyRef: z.string().min(1),
  principalAmount: z.number().positive(),
  currency: z.string().min(3).max(3),
  bookingDate: z.string().min(1),
  maturityDate: z.string().min(1),
  interestRate: z.number().nonnegative(),
  loanKind: z.enum(["term", "revolving", "overdraft", "mortgage", "other"]),
  portfolio: z.enum(["banking-book", "trading-book"]),
});

export type LoanBookedPayload = z.infer<typeof loanBookedPayloadSchema>;

export function makeLoanBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LoanBookedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LoanBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: loanBookedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RestatementProposed
// ---------------------------------------------------------------------------

export const restatementProposedPayloadSchema = z.object({
  restatementId: z.string().min(1),
  period: z.string().min(1),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
  ias8Reference: z.string().optional(),
  errorDescription: z.string().min(1),
  estimatedImpact: z.number().optional(),
  currency: z.string().min(3).max(3).optional(),
});

export type RestatementProposedPayload = z.infer<typeof restatementProposedPayloadSchema>;

export function makeRestatementProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RestatementProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RestatementProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: restatementProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FinancialPositionSnapshot
// ---------------------------------------------------------------------------
//
// Schema aligned with camille-financial-position-snapshot.ts handler emission
// shape (2026-05-29). Handler emits: camilleOwnedObligations,
// obligationsInForce/Partial/Planned/Drafting/NAyet, beaHandlerCount,
// yaelHandlerCount, plus ...snap.events (tax / accounting domain events),
// lastCloseApproved, lastBaReturnSigned, lastAfsSigned,
// lastCapitalPlanRefresh, runTrigger.
// Original idealised fields (snapshotId, asOf, currency) now optional for
// backward compat.
//
export const financialPositionSnapshotPayloadSchema = z
  .object({
    // Handler-emitted fields (authoritative)
    camilleOwnedObligations: z.number().int().nonnegative().optional(),
    obligationsInForce: z.number().int().nonnegative().optional(),
    obligationsPartial: z.number().int().nonnegative().optional(),
    obligationsPlanned: z.number().int().nonnegative().optional(),
    obligationsDrafting: z.number().int().nonnegative().optional(),
    obligationsNAyet: z.number().int().nonnegative().optional(),
    beaHandlerCount: z.number().int().nonnegative().optional(),
    yaelHandlerCount: z.number().int().nonnegative().optional(),
    lastCloseApproved: z.string().nullable().optional(),
    lastBaReturnSigned: z.string().nullable().optional(),
    lastAfsSigned: z.string().nullable().optional(),
    lastCapitalPlanRefresh: z.string().nullable().optional(),
    runTrigger: z.string().optional(),
    // Original idealised fields (optional, backward compat)
    snapshotId: z.string().min(1).optional(),
    asOf: z.string().min(1).optional(),
    totalAssets: z.number().optional(),
    totalLiabilities: z.number().optional(),
    equity: z.number().optional(),
    netPnL: z.number().optional(),
    currency: z.string().min(3).max(3).optional(),
    cet1RatioPct: z.number().optional(),
    reportingPeriod: z.string().optional(),
  })
  .passthrough();

export type FinancialPositionSnapshotPayload = z.infer<
  typeof financialPositionSnapshotPayloadSchema
>;

export function makeFinancialPositionSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FinancialPositionSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FinancialPositionSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: financialPositionSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SARSGuidanceUpdate
// ---------------------------------------------------------------------------

export const sarsGuidanceUpdatePayloadSchema = z.object({
  guidanceId: z.string().min(1),
  title: z.string().min(1),
  publishedAt: z.string().min(1),
  taxKind: z.enum(["CIT", "VAT", "STT", "PAYE", "transfer-pricing", "other"]),
  effectiveDate: z.string().optional(),
  summary: z.string().optional(),
  requiresAction: z.boolean(),
});

export type SARSGuidanceUpdatePayload = z.infer<typeof sarsGuidanceUpdatePayloadSchema>;

export function makeSARSGuidanceUpdate(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SARSGuidanceUpdatePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SARSGuidanceUpdate",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sarsGuidanceUpdatePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// TaxClassificationPublished
// ---------------------------------------------------------------------------

export const taxClassificationPublishedPayloadSchema = z.object({
  classificationId: z.string().min(1),
  instrumentKind: z.string().min(1),
  taxTreatment: z.string().min(1),
  publishedBy: z.string().min(1),
  publishedAt: z.string().min(1),
  effectiveDate: z.string().min(1),
  sarsReference: z.string().optional(),
});

export type TaxClassificationPublishedPayload = z.infer<
  typeof taxClassificationPublishedPayloadSchema
>;

export function makeTaxClassificationPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TaxClassificationPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TaxClassificationPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: taxClassificationPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ExchangeRuleChange
// ---------------------------------------------------------------------------

export const exchangeRuleChangePayloadSchema = z.object({
  ruleId: z.string().min(1),
  exchange: z.string().min(1),
  ruleDescription: z.string().min(1),
  publishedAt: z.string().min(1),
  effectiveDate: z.string().min(1),
  affectedProducts: z.array(z.string()).optional(),
  requiresAction: z.boolean(),
});

export type ExchangeRuleChangePayload = z.infer<typeof exchangeRuleChangePayloadSchema>;

export function makeExchangeRuleChange(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ExchangeRuleChangePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ExchangeRuleChange",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: exchangeRuleChangePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SchemeRuleChange
// ---------------------------------------------------------------------------

export const schemeRuleChangePayloadSchema = z.object({
  ruleId: z.string().min(1),
  schemeName: z.string().min(1),
  ruleDescription: z.string().min(1),
  publishedAt: z.string().min(1),
  effectiveDate: z.string().min(1),
  requiresAction: z.boolean(),
  complianceDeadline: z.string().optional(),
});

export type SchemeRuleChangePayload = z.infer<typeof schemeRuleChangePayloadSchema>;

export function makeSchemeRuleChange(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SchemeRuleChangePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SchemeRuleChange",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: schemeRuleChangePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RegulatoryInstrumentUpdate
// ---------------------------------------------------------------------------

export const regulatoryInstrumentUpdatePayloadSchema = z.object({
  updateId: z.string().min(1),
  instrumentTitle: z.string().min(1),
  regulator: z.string().min(1),
  updateKind: z.enum(["new", "amendment", "withdrawal", "guidance"]),
  publishedAt: z.string().min(1),
  effectiveDate: z.string().optional(),
  summary: z.string().optional(),
  requiresAction: z.boolean(),
});

export type RegulatoryInstrumentUpdatePayload = z.infer<
  typeof regulatoryInstrumentUpdatePayloadSchema
>;

export function makeRegulatoryInstrumentUpdate(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatoryInstrumentUpdatePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatoryInstrumentUpdate",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatoryInstrumentUpdatePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// InterEntityTransactionProposed
// ---------------------------------------------------------------------------

export const interEntityTransactionProposedPayloadSchema = z.object({
  proposalId: z.string().min(1),
  fromEntity: z.string().min(1),
  toEntity: z.string().min(1),
  transactionKind: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  proposedAt: z.string().min(1),
  transferPricingRequired: z.boolean(),
  approvalRequired: z.boolean(),
});

export type InterEntityTransactionProposedPayload = z.infer<
  typeof interEntityTransactionProposedPayloadSchema
>;

export function makeInterEntityTransactionProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterEntityTransactionProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterEntityTransactionProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interEntityTransactionProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RelatedPartyTransactionProposed
// ---------------------------------------------------------------------------

export const relatedPartyTransactionProposedPayloadSchema = z.object({
  proposalId: z.string().min(1),
  relatedPartyRef: z.string().min(1),
  transactionDescription: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  proposedAt: z.string().min(1),
  companiesActSection: z.string().optional(),
  boardApprovalRequired: z.boolean(),
});

export type RelatedPartyTransactionProposedPayload = z.infer<
  typeof relatedPartyTransactionProposedPayloadSchema
>;

export function makeRelatedPartyTransactionProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RelatedPartyTransactionProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RelatedPartyTransactionProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: relatedPartyTransactionProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MOIChangeProposed
// ---------------------------------------------------------------------------

export const moiChangeProposedPayloadSchema = z.object({
  proposalId: z.string().min(1),
  changeDescription: z.string().min(1),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
  cipcFilingRequired: z.boolean(),
  shareholders: z.number().int().nonnegative().optional(),
  approvalKind: z.enum(["special-resolution", "ordinary-resolution", "board"]),
});

export type MOIChangeProposedPayload = z.infer<typeof moiChangeProposedPayloadSchema>;

export function makeMOIChangeProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MOIChangeProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MOIChangeProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: moiChangeProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LegalEntityChange
// ---------------------------------------------------------------------------

export const legalEntityChangePayloadSchema = z.object({
  entityRef: z.string().min(1),
  changeKind: z.enum([
    "name",
    "registration-number",
    "shareholder",
    "directorship",
    "domicile",
    "other",
  ]),
  changedAt: z.string().min(1),
  effectiveDate: z.string().min(1),
  authorizedBy: z.string().min(1),
  description: z.string().min(1),
  cipcFiled: z.boolean().optional(),
});

export type LegalEntityChangePayload = z.infer<typeof legalEntityChangePayloadSchema>;

export function makeLegalEntityChange(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegalEntityChangePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegalEntityChange",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legalEntityChangePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ECTAExceptionFlagged
// ---------------------------------------------------------------------------

export const ectaExceptionFlaggedPayloadSchema = z.object({
  exceptionId: z.string().min(1),
  contractRef: z.string().min(1),
  ectaSection: z.string().min(1),
  flaggedBy: z.string().min(1),
  flaggedAt: z.string().min(1),
  exceptionDescription: z.string().min(1),
  requiresHumanReview: z.boolean(),
});

export type ECTAExceptionFlaggedPayload = z.infer<typeof ectaExceptionFlaggedPayloadSchema>;

export function makeECTAExceptionFlagged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ECTAExceptionFlaggedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ECTAExceptionFlagged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ectaExceptionFlaggedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ClauseChangeProposed
// ---------------------------------------------------------------------------

export const clauseChangeProposedPayloadSchema = z.object({
  proposalId: z.string().min(1),
  contractRef: z.string().min(1),
  clauseRef: z.string().min(1),
  proposedBy: z.string().min(1),
  proposedAt: z.string().min(1),
  changeDescription: z.string().min(1),
  counterpartyApprovalRequired: z.boolean(),
});

export type ClauseChangeProposedPayload = z.infer<typeof clauseChangeProposedPayloadSchema>;

export function makeClauseChangeProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ClauseChangeProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ClauseChangeProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: clauseChangeProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ContractDraftRequested
// ---------------------------------------------------------------------------

export const contractDraftRequestedPayloadSchema = z.object({
  requestId: z.string().min(1),
  contractKind: z.enum(["ISDA", "GMRA", "CSA", "NDA", "service-agreement", "custody", "other"]),
  counterpartyRef: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.string().min(1),
  targetSigningDate: z.string().optional(),
  specialConditions: z.string().optional(),
});

export type ContractDraftRequestedPayload = z.infer<typeof contractDraftRequestedPayloadSchema>;

export function makeContractDraftRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ContractDraftRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ContractDraftRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: contractDraftRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SignatureRequested
// ---------------------------------------------------------------------------

export const signatureRequestedPayloadSchema = z.object({
  requestId: z.string().min(1),
  documentRef: z.string().min(1),
  documentTitle: z.string().min(1),
  signatoryRef: z.string().min(1),
  requestedAt: z.string().min(1),
  signatureKind: z.enum(["electronic", "wet", "advanced-electronic", "qualified-electronic"]),
  ectaSection: z.string().optional(),
  deadline: z.string().optional(),
});

export type SignatureRequestedPayload = z.infer<typeof signatureRequestedPayloadSchema>;

export function makeSignatureRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SignatureRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SignatureRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: signatureRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const IFRS_ACCOUNTING_EXTENDED_TYPED_EVENT_TYPES = [
  "IFRS9ECLPublished",
  "IFRS9ECLChange",
  "MaterialIFRSClassificationChange",
  "PortfolioReclassification",
  "AccrualBooked",
  "DepositReceived",
  "FundingDrawn",
  "FundingDrawnDown",
  "LoanBooked",
  "RestatementProposed",
  "FinancialPositionSnapshot",
  "SARSGuidanceUpdate",
  "TaxClassificationPublished",
  "ExchangeRuleChange",
  "SchemeRuleChange",
  "RegulatoryInstrumentUpdate",
  "InterEntityTransactionProposed",
  "RelatedPartyTransactionProposed",
  "MOIChangeProposed",
  "LegalEntityChange",
  "ECTAExceptionFlagged",
  "ClauseChangeProposed",
  "ContractDraftRequested",
  "SignatureRequested",
] as const;
