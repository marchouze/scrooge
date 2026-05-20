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
//   - conduct.ts        — ConductComplaintFiled, ConductComplaintResolved,
//                         ConductIncidentLogged, BestExecutionAnalysisCompleted,
//                         ConductDisclosureEmitted (M3 Slice 9)
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
// M3 Slice 9 — Conduct events (FSCA/FSR Act market conduct framework).
// Period-level: ConductComplaintFiled, ConductComplaintResolved,
//   ConductIncidentLogged, BestExecutionAnalysisCompleted, ConductDisclosureEmitted.
// Trade-level: ConductObligationFlagged, BestExecutionVerified,
//   BestExecutionBreached, MarketConductAlertRaised,
//   FaisClassificationSuitabilityChecked, ConflictOfInterestDisclosed.
// Authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
export * from "./conduct";
// M3 Slice 10 — Counterparty-exposure events (large-exposure framework).
// CounterpartyExposureCalculated — per-counterparty, per-exposure-type snapshot
//   with netting, collateral, uncovered exposure, and limit utilisation.
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
export * from "./counterparty-exposure";
// WS-CREDIT-LIMIT-ENGINE — Credit-limit lifecycle (12 events: application,
// analysis, ISDA/CSA assessment, proposal, approval, load, annual review,
// breach + disposal, CRC exception, sub-IG counterparty approval).
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20);
//   Policies/credit-risk-policy-v1.md; Procedures/by-policy/credit-origination.md.
export * from "./credit-limit";
// WS-CREDIT-LIMIT-ENGINE — SA-CCR / LEX computation outputs (3 events:
// CcrReplacementCostComputed, LexUtilisationComputed, LexExceptionApproved).
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD; BCBS 279 (SA-CCR); BCBS 283 (LEX).
export * from "./counterparty-credit-risk";
// Regulator-notification events (PaNotificationSubmitted; PA / FSCA / FIC).
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Banks Act §§ 60A + 73; FIC Act §§ 28A + 29.
export * from "./regulatory-pa";
// D-KYC-ONBOARDING-BUILD — KYC gateway lifecycle events.
// KYCIdentityCollected, KYCIdentityVerified, KYCIdentityVerificationFailed,
//   KYCSanctionsPEPScreened, KYCUBOResolved, KYCRiskRated,
//   KYCEDDInitiated, KYCEDDCompleted, KYCDecisionMade,
//   ClientAccepted, ClientRejected, LawfulProcessingRegistered,
//   KYCRefreshScheduled, KYCRefreshCompleted, KYCRatingRevised,
//   CounterpartyCategorised, CounterpartyDeclined.
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
export * from "./kyc";
// F-032 extended event-type files — typed Zod schemas replacing PT placeholders.
// Authority: F-032 (event-type-registry-coverage recon, 2026-05-16).
// Author: Atlas (Core banking platform architect, engineering)
export * from "./agent-substrate-extended";
export * from "./governance-extended";
export * from "./risk-treasury-extended";
export * from "./aml-popia-extended";
export * from "./ifrs-accounting-extended";
export * from "./security-devops-extended";
export * from "./markets-trading-extended";
// D-TRADE-LIFECYCLE-IFRS-CHAIN — JSE bond lifecycle accounting events.
// BondTradeExecuted, BondInterestAccrued, BondPositionRevalued,
//   BondMatured, BondSold.
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
export * from "./bond-accounting";
// D-TRADE-LIFECYCLE-IFRS-CHAIN — JSE equity lifecycle accounting events.
// EquityTradeExecuted, EquityPositionRevalued,
//   EquityDividendAccrued, EquitySold.
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
export * from "./equity-accounting";
// D-TRADE-LIFECYCLE-IFRS-CHAIN — OTC IRD swap lifecycle accounting events.
// IrdSwapTradeExecuted, IrdSwapPositionRevalued,
//   IrdSwapCouponSettled, IrdSwapTerminated.
// Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
export * from "./ird-accounting";
// D-RAS-CLIMATE-SCENARIO-FRAMEWORK — climate-risk scenario and daily proxy events.
// ClimateScenarioRun (quarterly PA GN 1/2024 scenario run),
//   ClimateExposureRevalued (daily proxy climate VaR).
// Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved 2026-05-19);
//   PA Guidance Note 1 of 2024; PROC-RISK-CR-01.
export * from "./climate-risk";
// D-TREASURY-GAPS-WAVE1 — ALM engine event types.
// ALMRunCompleted — daily ALM run summary (repricing gap, ΔEVE, ΔNII).
// IRRBBChecked — per-metric/shock IRRBB sensitivity check.
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365; Banks Act Reg 26/27.
export * from "./alm";
// D-TREASURY-GAPS-WAVE1 — collateral inventory substrate (HQLA tracking).
// CollateralInventorySnapshot (daily HQLA buffer snapshot + cap checks),
//   CollateralUpdated (per-security inventory change — add/remove/revalue).
// Authority: BA 325 Annex 1; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
export * from "./collateral";
// D-TREASURY-GAPS-WAVE1 — liquidity projection engine (LCR/NSFR).
// LCRComputed — result of a single LCR computation (BA 325 / Basel III).
// NSFRComputed — result of a single NSFR computation (BA 326 / Basel III).
// Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 325; BA 326.
export * from "./liquidity";
// D-TREASURY-GAPS-WAVE1 — ILAAP engine (stress scenarios + survival horizon).
// ILAAPScenarioRun — per-scenario liquidity stress result (4 scenarios).
// ILAAPSummaryCompleted — aggregated worst-case ILAAP assessment.
// Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; BA 325; PA ILAAP guidance.
export * from "./ilaap";
// D-TREASURY-GAPS-WAVE1 — ALCO pack event types.
// ALCOPackGenerated — monthly ALCO pack generation event (8 sections).
// IntradayHQLAStressProjection — intraday HQLA stress-scenario output.
// Authority: D-TREASURY-GAPS-WAVE1; BA 325; BA 326; BCBS d365.
export * from "./alco";
// Product Control — daily FX P&L report event.
// DailyPnLReportGenerated — aggregated unrealised + realised P&L by pair/counterparty/book.
// Authority: D-FX-SALES-TRADING-FRONTEND; IFRS 9 §5.7.1; D-MARKETS-SCHEMA-FOUNDATION.
export * from "./product-control";
// MTM engine events — MtmRunCompleted, IpvExceptionRaised.
// Authority: D-MARKETS-SCHEMA-FOUNDATION; D-FX-SALES-TRADING-FRONTEND; IFRS-9-§5.7.1.
// Author: Rohan (Market risk engineer, engineering)
export * from "./mtm";
// D-EVENT-VIEW-BOUNDARY-WIRE Slice A — PolicyVersionActivated.
// Generic umbrella covering valuation / accounting-IFRS / fx-translation
// policy-in-force activations. Slice B (OfficialMarkAdopted) and Slice C
// (PeriodClosed) carry `policyVersionRef`(s) resolving to this stream.
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
// Author: Atlas (Core banking platform architect, engineering).
export * from "./policy-activation";
// D-EVENT-VIEW-BOUNDARY-WIRE Slice B — OfficialMarkAdopted.
// The valuation engine's elected mark for an instrument at a timestamp,
// under a named valuation policy version. Distinct from raw market-data
// ticks (which live in MarketDataStore as reference data per
// D-MARKETS-SCHEMA-FOUNDATION). Four mark types: price, fx-rate,
// curve-point, vol-point.
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
// Author: Atlas (Core banking platform architect, engineering).
export * from "./valuation";
// D-EVENT-VIEW-BOUNDARY-WIRE Slice C — PeriodClosed.
// CFO attestation closing a financial period; pins policyVersionRefs,
// codeSha, and derivedStatementHashes for replay-determinism verification.
// Supersedes/extends AccountingPeriodClosed for the attestation role.
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
// Authors: Bea (Accounting engineer) + Atlas (Core banking architect).
export * from "./close-management";

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
import { AGENT_SUBSTRATE_EXTENDED_TYPED_EVENT_TYPES } from "./agent-substrate-extended";
import { ALCO_TYPED_EVENT_TYPES } from "./alco";
import { ALM_TYPED_EVENT_TYPES } from "./alm";
import { AML_POPIA_EXTENDED_TYPED_EVENT_TYPES } from "./aml-popia-extended";
import { SEMANTIC_LAYER_TYPED_EVENT_TYPES } from "./analytics";
import { AUDIT_TYPED_EVENT_TYPES } from "./audit";
import { BOND_ACCOUNTING_EVENT_TYPES } from "./bond-accounting";
import { CLIMATE_RISK_TYPED_EVENT_TYPES } from "./climate-risk";
import { CLOSE_MANAGEMENT_TYPED_EVENT_TYPES } from "./close-management";
import { COLLATERAL_TYPED_EVENT_TYPES } from "./collateral";
import { CONDUCT_TYPED_EVENT_TYPES } from "./conduct";
import { COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES } from "./counterparty-credit-risk";
import { COUNTERPARTY_EXPOSURE_TYPED_EVENT_TYPES } from "./counterparty-exposure";
import { CREDIT_LIMIT_TYPED_EVENT_TYPES } from "./credit-limit";
import { CUSTOMER_TYPED_EVENT_TYPES } from "./customer";
import { DECISION_TYPED_EVENT_TYPES } from "./decision";
import { DECISION_REQUEST_TYPED_EVENT_TYPES } from "./decision-request";
import { EQUITY_ACCOUNTING_EVENT_TYPES } from "./equity-accounting";
import { FTP_TYPED_EVENT_TYPES } from "./ftp";
import { FX_ACCOUNTING_EVENT_TYPES } from "./fx-accounting";
import { GOVERNANCE_TYPED_EVENT_TYPES } from "./governance";
import { GOVERNANCE_EXTENDED_TYPED_EVENT_TYPES } from "./governance-extended";
import { GOVERNANCE_SNAPSHOTS_TYPED_EVENT_TYPES } from "./governance-snapshots";
import { IFRS_ACCOUNTING_EXTENDED_TYPED_EVENT_TYPES } from "./ifrs-accounting-extended";
import { ILAAP_TYPED_EVENT_TYPES } from "./ilaap";
import { INTRANET_EVENT_TYPES } from "./intranet";
import { IRD_ACCOUNTING_EVENT_TYPES } from "./ird-accounting";
import { KYC_TYPED_EVENT_TYPES } from "./kyc";
import { LEGAL_DOCUMENTATION_TYPED_EVENT_TYPES } from "./legal-documentation";
import { LEGAL_ENTITY_TYPED_EVENT_TYPES } from "./legal-entity";
import { LIQUIDITY_TYPED_EVENT_TYPES } from "./liquidity";
import { MARKETS_TRADING_EXTENDED_TYPED_EVENT_TYPES } from "./markets-trading-extended";
import { MODEL_RISK_TYPED_EVENT_TYPES } from "./model-risk";
import { MTM_TYPED_EVENT_TYPES } from "./mtm";
import { PAYMENTS_TYPED_EVENT_TYPES } from "./payments";
import { PERFORMANCE_TYPED_EVENT_TYPES } from "./performance";
import { PLATFORM_TYPED_EVENT_TYPES } from "./platform";
import { POLICY_ACTIVATION_TYPED_EVENT_TYPES } from "./policy-activation";
import { PRODUCT_TYPED_EVENT_TYPES } from "./product";
import { PRODUCT_CONTROL_EVENT_TYPES } from "./product-control";
import { REGULATORY_TYPED_EVENT_TYPES } from "./regulatory";
import { REGULATORY_PA_TYPED_EVENT_TYPES } from "./regulatory-pa";
import { REGULATORY_REPORTING_TYPED_EVENT_TYPES } from "./regulatory-reporting";
import { RISK_TYPED_EVENT_TYPES } from "./risk";
import { RISK_TREASURY_EXTENDED_TYPED_EVENT_TYPES } from "./risk-treasury-extended";
import { RMS_TYPED_EVENT_TYPES } from "./rms";
import { SECURITY_DEVOPS_EXTENDED_TYPED_EVENT_TYPES } from "./security-devops-extended";
import { TRADING_TYPED_EVENT_TYPES } from "./trading";
import { VALUATION_TYPED_EVENT_TYPES } from "./valuation";

export const TYPED_EVENT_TYPES = [
  ...AGENT_TYPED_EVENT_TYPES,
  ...PLATFORM_TYPED_EVENT_TYPES,
  ...RISK_TYPED_EVENT_TYPES,
  ...MODEL_RISK_TYPED_EVENT_TYPES,
  ...TRADING_TYPED_EVENT_TYPES,
  ...LEGAL_ENTITY_TYPED_EVENT_TYPES,
  ...LEGAL_DOCUMENTATION_TYPED_EVENT_TYPES,
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
  // F-032 extended typed event types — replacing PT placeholder rows
  ...AGENT_SUBSTRATE_EXTENDED_TYPED_EVENT_TYPES,
  ...GOVERNANCE_EXTENDED_TYPED_EVENT_TYPES,
  ...RISK_TREASURY_EXTENDED_TYPED_EVENT_TYPES,
  ...AML_POPIA_EXTENDED_TYPED_EVENT_TYPES,
  ...IFRS_ACCOUNTING_EXTENDED_TYPED_EVENT_TYPES,
  ...SECURITY_DEVOPS_EXTENDED_TYPED_EVENT_TYPES,
  ...MARKETS_TRADING_EXTENDED_TYPED_EVENT_TYPES,
  // M3 Slice 9 — conduct risk event types (trade-level + period-level).
  // Authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
  ...CONDUCT_TYPED_EVENT_TYPES,
  // M3 Slice 10 — counterparty-exposure event types (large-exposure framework).
  // Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
  ...COUNTERPARTY_EXPOSURE_TYPED_EVENT_TYPES,
  // WS-CREDIT-LIMIT-ENGINE — credit-limit lifecycle event types.
  // Authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20);
  //   Policies/credit-risk-policy-v1.md; Procedures/by-policy/credit-origination.md.
  ...CREDIT_LIMIT_TYPED_EVENT_TYPES,
  // WS-CREDIT-LIMIT-ENGINE — SA-CCR / LEX computation outputs.
  // Authority: D-CREDIT-LIMIT-ENGINE-BUILD; BCBS 279; BCBS 283; RRB Reg 23.
  ...COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES,
  // Regulator-notification event types (PaNotificationSubmitted) — PA / FSCA / FIC.
  // Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Banks Act §§ 60A + 73; FIC Act §§ 28A + 29.
  ...REGULATORY_PA_TYPED_EVENT_TYPES,
  // D-KYC-ONBOARDING-BUILD — KYC gateway lifecycle event types.
  // Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
  ...KYC_TYPED_EVENT_TYPES,
  // D-TRADE-LIFECYCLE-IFRS-CHAIN — JSE bond lifecycle accounting event types.
  // Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
  ...BOND_ACCOUNTING_EVENT_TYPES,
  // D-TRADE-LIFECYCLE-IFRS-CHAIN — JSE equity lifecycle accounting event types.
  // Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
  ...EQUITY_ACCOUNTING_EVENT_TYPES,
  // D-TRADE-LIFECYCLE-IFRS-CHAIN — OTC IRD swap lifecycle accounting event types.
  // Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
  ...IRD_ACCOUNTING_EVENT_TYPES,
  // D-RAS-CLIMATE-SCENARIO-FRAMEWORK — climate-risk scenario and daily proxy event types.
  // Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved 2026-05-19).
  ...CLIMATE_RISK_TYPED_EVENT_TYPES,
  // D-TREASURY-GAPS-WAVE1 — ALM engine event types (repricing gap, ΔEVE, ΔNII).
  // Authority: D-TREASURY-GAPS-WAVE1; BCBS d365; Banks Act Reg 26/27.
  ...ALM_TYPED_EVENT_TYPES,
  // D-TREASURY-GAPS-WAVE1 — collateral inventory substrate (HQLA tracking).
  // Authority: BA 325 Annex 1; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
  ...COLLATERAL_TYPED_EVENT_TYPES,
  // D-TREASURY-GAPS-WAVE1 — liquidity projection engine event types (LCR/NSFR).
  // Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 325; BA 326.
  ...LIQUIDITY_TYPED_EVENT_TYPES,
  // D-TREASURY-GAPS-WAVE1 — ILAAP engine event types (stress scenarios + survival horizon).
  // Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; BA 325; PA ILAAP guidance.
  ...ILAAP_TYPED_EVENT_TYPES,
  // D-TREASURY-GAPS-WAVE1 — ALCO pack event types.
  // ALCOPackGenerated, IntradayHQLAStressProjection.
  // Authority: D-TREASURY-GAPS-WAVE1; BA 325; BA 326; BCBS d365.
  ...ALCO_TYPED_EVENT_TYPES,
  // Product Control — daily FX P&L report event.
  // DailyPnLReportGenerated — aggregated unrealised + realised P&L.
  // Authority: D-FX-SALES-TRADING-FRONTEND; IFRS 9 §5.7.1.
  ...PRODUCT_CONTROL_EVENT_TYPES,
  // MTM engine events — MtmRunCompleted, IpvExceptionRaised.
  // Authority: D-MARKETS-SCHEMA-FOUNDATION; D-FX-SALES-TRADING-FRONTEND; IFRS-9-§5.7.1.
  ...MTM_TYPED_EVENT_TYPES,
  // D-EVENT-VIEW-BOUNDARY-WIRE Slice A — PolicyVersionActivated.
  // Generic umbrella for policy-in-force events (valuation, accounting-IFRS,
  // fx-translation today). Authority: D-EVENT-VIEW-BOUNDARY-WIRE.
  ...POLICY_ACTIVATION_TYPED_EVENT_TYPES,
  // D-EVENT-VIEW-BOUNDARY-WIRE Slice B — OfficialMarkAdopted.
  // The valuation engine's elected mark per (instrumentKey, markAsOf,
  // policyVersionRef). Four mark types: price, fx-rate, curve-point,
  // vol-point. Authority: D-EVENT-VIEW-BOUNDARY-WIRE.
  ...VALUATION_TYPED_EVENT_TYPES,
  // D-EVENT-VIEW-BOUNDARY-WIRE Slice C — PeriodClosed.
  // CFO attestation closing a financial period; pins policyVersionRefs,
  // codeSha, and derivedStatementHashes for replay-determinism.
  // Authority: D-EVENT-VIEW-BOUNDARY-WIRE.
  ...CLOSE_MANAGEMENT_TYPED_EVENT_TYPES,
] as const;

export type TypedEventType = (typeof TYPED_EVENT_TYPES)[number];
