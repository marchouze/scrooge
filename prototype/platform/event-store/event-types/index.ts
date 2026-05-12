// platform/event-store/event-types/index.ts
//
// Barrel re-export for the per-domain event-type modules.
//
// F-020 (Atlas, 2026-05-11): split the god-file into per-domain modules;
// this barrel preserves the existing import surface so no callers need to
// change their import paths — `from '../event-store/event-types'` continues
// to resolve here (TypeScript resolves index.ts from the directory name).
//
// Domain modules:
//   - agent.ts          — AgentEscalation family, AgentDecision,
//                         AgentRegistered, SubstrateAgentRun*, RMS agent-runs
//                         (AgentBriefIssued, AgentRunStarted/Completed)
//   - platform.ts       — WorkstreamRegistered, DecisionComment,
//                         ScheduledTrigger, SubstrateAlert, IdentityKeyRotated,
//                         PermissionPolicyPublished, BusDispatched,
//                         LegacyFanoutShadowed
//   - risk.ts           — RiskRaised, RasLineCalibrated
//   - model-risk.ts     — ModelSubmitted, ModelTierClassified,
//                         ModelValidation*, ValidationFinding*, Backtest*,
//                         ModelDriftDetected, ProductionUseRequested,
//                         MethodologyChangeRequested,
//                         ValidationMethodologyPublished
//   - trading.ts        — OrderProposed, GatewayCheck*, OrderApproved/Rejected,
//                         PreTradeLimitChanged, CounterpartyEligibility*,
//                         SwitchTest*
//   - legal-entity.ts   — LegalEntityRegistered/Changed,
//                         IntraGroupArrangementSigned
//   - product.ts        — 12 product-lifecycle events
//   - rms.ts            — DecisionRequested, Feedback, BriefSuperseded,
//                         RecordFiled, CeoDecisionRmsExtended
//   - accounting.ts     — BankAccount*, AccountingPeriod*, TrialBalanceSnapshotted
//   - fx-accounting.ts  — FxPositionRevalued, FxSettlementConfirmed,
//                         SubLedgerPostingEmitted (FX accounting lifecycle)
//
// Party domain lives in prototype/domains/party/ (its own domain package);
// re-exported directly here as before.

export * from "./agent";
export * from "./governance";
export * from "./platform";
export * from "./risk";
export * from "./model-risk";
export * from "./trading";
export * from "./legal-entity";
export * from "./product";
export * from "./rms";
export * from "./accounting";
// Slice 2 — institutional counterparty onboarding lifecycle (7 new phase events).
export * from "./customer";
export * from "./fx-accounting";

// ---------------------------------------------------------------------------
// Party domain — re-exported from domains/party (per D-PARTY-REGISTER
// PR 1 convention: schemas authored in domains/party, re-exported here so
// registry consumers have a single import surface).
// ---------------------------------------------------------------------------

export type {
  AgentAttrs as PartyAgentAttrs,
  BeneficialOwnerChainAssertedPayload,
  KindAttributes as PartyKindAttributes,
  LegalEntityAttrs as PartyLegalEntityAttrs,
  NaturalPersonAttrs as PartyNaturalPersonAttrs,
  PartyAttributeChangedPayload,
  PartyClassifiedPayload,
  PartyDeactivatedPayload,
  PartyDeclassifiedPayload,
  PartyEventType,
  PartyId,
  PartyKind,
  PartyRegisteredPayload,
  PartyRelationshipAssertedPayload,
  PartyRelationshipChangedPayload,
  PartyRelationshipRevokedPayload,
  PartyScreeningCompletedPayload,
  RelationshipKind,
} from "../../../domains/party";

export {
  PARTY_EVENT_TYPES,
  PARTY_KINDS,
  RELATIONSHIP_KINDS,
  RELATIONSHIP_KIND_CONSTRAINTS,
  beneficialOwnerChainAssertedPayloadSchema,
  kindAttributesSchema,
  makeBeneficialOwnerChainAsserted,
  makePartyAttributeChanged,
  makePartyClassified,
  makePartyDeactivated,
  makePartyDeclassified,
  makePartyRegistered,
  makePartyRelationshipAsserted,
  makePartyRelationshipChanged,
  makePartyRelationshipRevoked,
  makePartyScreeningCompleted,
  partyAttributeChangedPayloadSchema,
  partyClassifiedPayloadSchema,
  partyDeactivatedPayloadSchema,
  partyDeclassifiedPayloadSchema,
  partyId,
  partyIdSchema,
  partyKindSchema,
  partyRegisteredPayloadSchema,
  partyRelationshipAssertedPayloadSchema,
  partyRelationshipChangedPayloadSchema,
  partyRelationshipRevokedPayloadSchema,
  partyScreeningCompletedPayloadSchema,
  relationshipKindSchema,
} from "../../../domains/party";

// ---------------------------------------------------------------------------
// Type registry — single place for downstream consumers to enumerate all
// typed events. Must be kept in sync with the per-domain modules above.
// ---------------------------------------------------------------------------

export const TYPED_EVENT_TYPES = [
  "AgentEscalation",
  "AgentEscalationAcknowledged",
  "AgentEscalationDecided",
  "AgentEscalationDelegated",
  "AgentEscalationOverdue",
  "AgentDecision",
  "WorkstreamRegistered",
  "RiskRaised",
  "AgentRegistered",
  "DecisionComment",
  "ScheduledTrigger",
  "SubstrateAlert",
  "IdentityKeyRotated",
  "PermissionPolicyPublished",
  "BusDispatched",
  "LegacyFanoutShadowed",
  "ModelSubmitted",
  "ModelTierClassified",
  "ModelValidationApproved",
  "ModelValidationWithheld",
  "ValidationFindingRaised",
  "ValidationFindingClosed",
  "BacktestRequested",
  "BacktestRun",
  "OrderProposed",
  "GatewayCheckRequested",
  "GatewayCheckCompleted",
  "OrderApprovedAtGateway",
  "OrderRejectedAtGateway",
  "PreTradeLimitChanged",
  "ValidationMethodologyPublished",
  "BacktestBreachDisposed",
  "ModelDriftDetected",
  "ProductionUseRequested",
  "MethodologyChangeRequested",
  "CounterpartyEligibilityScreened",
  "CounterpartyEligibilityRevalidated",
  "CounterpartyEligibilityBreached",
  "SwitchTestActivated",
  "SwitchTestEnded",
  "SwitchTestReport",
  "LegalEntityRegistered",
  "LegalEntityChanged",
  "IntraGroupArrangementSigned",
  // Product-lifecycle event family — D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2.
  "ProductProposalRegistered",
  "ProductConceptualised",
  "ProductDueDiligenceCompleted",
  "ProductDueDiligenceWithheld",
  "ProductDimensionAttested",
  "ProductApproved",
  "ProductWithheld",
  "ProductLaunched",
  "ProductPostImplementationReviewCompleted",
  "ProductReviewCompleted",
  "ProductRetired",
  "ProductVersionPublished",
  // Records Management Substrate event family — D-RMS-PHASE-1 Slice 2.
  "AgentBriefIssued",
  "AgentRunStarted",
  "AgentRunCompleted",
  "DecisionRequested",
  "Feedback",
  "BriefSuperseded",
  "RecordFiled",
  // Bank-account event family — D-BANK-ACCOUNT-SUBSTRATE.
  "BankAccountOpened",
  "BankAccountConfigured",
  "BankAccountClosed",
  // Period-close event family — D-REPORTING-CAPABILITY-SLICE-2.
  "AccountingPeriodOpened",
  "AccountingPeriodClosed",
  "TrialBalanceSnapshotted",
  // Risk Appetite Statement calibration event.
  "RasLineCalibrated",
  // Substrate agent-run lifecycle (S8 primitives).
  // Note: SubstrateAgentRunStarted/Completed/Failed are not in the original
  // TYPED_EVENT_TYPES list — they are registered via the registry directly.
  // Party event family — D-PARTY-REGISTER.
  "PartyRegistered",
  "PartyAttributeChanged",
  "PartyClassified",
  "PartyDeclassified",
  "PartyScreeningCompleted",
  "PartyRelationshipAsserted",
  "PartyRelationshipChanged",
  "PartyRelationshipRevoked",
  "BeneficialOwnerChainAsserted",
  "PartyDeactivated",
  // Goal-loop planning-trace events — D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  "AgentGoalEvaluated",
  "AgentGoalSelected",
  "AgentGoalDeferred",
  // Governance document-lifecycle events — D-POLICY-DOCUMENT-HOME Option C
  // (CEO-approved 2026-05-12). Emitted by the document-registration recon
  // pipeline when a Policies/*.md file is first registered.
  "DocumentRegistered",
  // Onboarding Slice 2 — 7 new counterparty lifecycle phase events.
  "CounterpartyFaisClassified",
  "BeneficialOwnerResolved",
  "SanctionsClearancePassed",
  "FatcaCrsClassified",
  "PopiaConsentRecorded",
  "CreditAssessmentCompleted",
  "AccountsSetupCompleted",
  // FX accounting event family — D-MARKETS-SCHEMA-FOUNDATION +
  // D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12).
  // Authors: Camille (CFO, finance) + Bea (Accounting & financial reporting engineer).
  "FxPositionRevalued",
  "FxSettlementConfirmed",
  "SubLedgerPostingEmitted",
] as const;

export type TypedEventType = (typeof TYPED_EVENT_TYPES)[number];
