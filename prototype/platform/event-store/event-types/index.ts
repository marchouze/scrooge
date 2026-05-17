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
//   - audit.ts          — AuditFinding (typed finding against an agent's
//                         performance or output quality)
//   - decision-request.ts — AgentDecisionRequired (request-for-input that
//                         blocks forward progress; see platform/event-trigger/)
//   - ftp.ts            — FtpCurvePublished (daily curve publication),
//                         FtpAttributionRecorded (per-transaction spread)
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
export * from "./audit";
export * from "./decision";
export * from "./decision-request";
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
export * from "./regulatory";
export * from "./performance";
// Semantic-layer quantity registration — Anya (Data / analytics engineer).
// Relocated under F-032 (Atlas, 2026-05-16) to the analytics module so the
// factory lives on a surface scanned by the event-type registry coverage
// recon. The legacy `platform/semantic-layer/event-type.ts` module re-exports
// from here for back-compat.
export * from "./analytics";
// AgentOps event family — Sade (AgentOps & Token Efficiency Engineer).
export * from "./agent-ops";
// Governance-snapshot schemas — Atlas (Core banking platform architect, engineering).
// CeoDecision, ReconResult, SubstrateStateSnapshot, GovernanceCyclePrep,
// DataProjectionSnapshot, InboxHygieneSweep, ObligationsRegisterSnapshot,
// SecuritySubstrateSnapshot.
export * from "./governance-snapshots";
// Intranet event family — Noa (Intranet Product Owner & UI Architect).
export * from "./intranet";
// FTP event family — Ravi (Treasury/ALM Engineer).
export * from "./ftp";
// Payments / settlement event family — Tomas (Operations & payments engineer),
// Bea (Accounting & financial reporting engineer), Atlas (substrate).
export * from "./payments";
// Regulatory reporting event family — Mira + Anya (FinSurv TradeReportSubmitted).
export * from "./regulatory-reporting";

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
//
// To add a new event type:
//   (1) define it in its domain file,
//   (2) add its name to the domain's *_TYPED_EVENT_TYPES array in that file,
//   (3) add one spread line here.
// ---------------------------------------------------------------------------

import { PARTY_EVENT_TYPES } from "../../../domains/party";
import { ACCOUNTING_TYPED_EVENT_TYPES } from "./accounting";
import { AGENT_TYPED_EVENT_TYPES } from "./agent";
import { AGENT_OPS_TYPED_EVENT_TYPES } from "./agent-ops";
import { SEMANTIC_LAYER_TYPED_EVENT_TYPES } from "./analytics";
import { AUDIT_TYPED_EVENT_TYPES } from "./audit";
import { CUSTOMER_TYPED_EVENT_TYPES } from "./customer";
import { DECISION_TYPED_EVENT_TYPES } from "./decision";
import { DECISION_REQUEST_TYPED_EVENT_TYPES } from "./decision-request";
import { FTP_TYPED_EVENT_TYPES } from "./ftp";
import { FX_ACCOUNTING_EVENT_TYPES } from "./fx-accounting";
import { GOVERNANCE_SNAPSHOTS_TYPED_EVENT_TYPES } from "./governance-snapshots";
import { GOVERNANCE_TYPED_EVENT_TYPES } from "./governance";
import { INTRANET_EVENT_TYPES } from "./intranet";
import { LEGAL_ENTITY_TYPED_EVENT_TYPES } from "./legal-entity";
import { MODEL_RISK_TYPED_EVENT_TYPES } from "./model-risk";
import { PAYMENTS_TYPED_EVENT_TYPES } from "./payments";
import { PERFORMANCE_TYPED_EVENT_TYPES } from "./performance";
import { PLATFORM_TYPED_EVENT_TYPES } from "./platform";
import { PRODUCT_TYPED_EVENT_TYPES } from "./product";
import { REGULATORY_TYPED_EVENT_TYPES } from "./regulatory";
import { REGULATORY_REPORTING_TYPED_EVENT_TYPES } from "./regulatory-reporting";
import { RISK_TYPED_EVENT_TYPES } from "./risk";
import { RMS_TYPED_EVENT_TYPES } from "./rms";
import { TRADING_TYPED_EVENT_TYPES } from "./trading";

export const TYPED_EVENT_TYPES = [
  ...AGENT_TYPED_EVENT_TYPES,
  ...PLATFORM_TYPED_EVENT_TYPES,
  ...RISK_TYPED_EVENT_TYPES,
  ...MODEL_RISK_TYPED_EVENT_TYPES,
  ...TRADING_TYPED_EVENT_TYPES,
  ...LEGAL_ENTITY_TYPED_EVENT_TYPES,
  ...PRODUCT_TYPED_EVENT_TYPES,
  ...RMS_TYPED_EVENT_TYPES,
  ...ACCOUNTING_TYPED_EVENT_TYPES,
  ...CUSTOMER_TYPED_EVENT_TYPES,
  ...FX_ACCOUNTING_EVENT_TYPES,
  ...REGULATORY_TYPED_EVENT_TYPES,
  ...PERFORMANCE_TYPED_EVENT_TYPES,
  ...AUDIT_TYPED_EVENT_TYPES,
  ...DECISION_REQUEST_TYPED_EVENT_TYPES,
  ...DECISION_TYPED_EVENT_TYPES,
  ...AGENT_OPS_TYPED_EVENT_TYPES,
  ...INTRANET_EVENT_TYPES,
  ...FTP_TYPED_EVENT_TYPES,
  ...PAYMENTS_TYPED_EVENT_TYPES,
  ...GOVERNANCE_TYPED_EVENT_TYPES,
  ...GOVERNANCE_SNAPSHOTS_TYPED_EVENT_TYPES,
  ...SEMANTIC_LAYER_TYPED_EVENT_TYPES,
  ...PARTY_EVENT_TYPES,
  ...REGULATORY_REPORTING_TYPED_EVENT_TYPES,
  // ← new agent adds one spread line here
] as const;

export type TypedEventType = (typeof TYPED_EVENT_TYPES)[number];
