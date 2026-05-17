// platform/event-store/registry/missing-types.ts
//
// Vera finding: event-type-registry-coverage (2026-05-16) — 143 event types
// referenced in agent-spec `subscribesTo` fields but absent from EVENT_TYPE_REGISTRY.
// This file registers all of them as envelope-only (no payloadSchema) build-phase
// placeholder rows, citing F-032 (Vera codebase quality review, 2026-05-10).
//
// Authority: P1-EVENTS-AS-TRUTH, Principle 2 (single-graph discipline).
// Author: Atlas (Platform Engineer, engineering) + Kai (Quantitative Markets Architect, engineering).
// Vera finding source: Owner Inbox/2026-05-16_vera_overnight-recon.md
//
// Substrate gaps:
//   - Every row below uses RETENTION_CONSERVATIVE_DEFAULT and no payloadSchema.
//     Before commencement-of-trading, each row needs a classified retention
//     constant and a typed Zod payload schema. Tracked as F-032 follow-on.
//   - Build-phase placeholder form is explicitly tolerated by registry.ts header
//     ("Type not in registry → no-op (build-phase forward compat)") until
//     Vera's #11 / #12 pipelines assert the registry is complete.
//
// Domain groupings (for future split into per-domain modules):
//   A — FX / markets / trading (Kai, Bea)
//   B — ALM / treasury / liquidity (Ravi, Eitan)
//   C — Risk (Helena, Rohan)
//   D — Accounting / financial reporting (Bea, Camille)
//   E — Compliance / AML / FIC (Zara, Mira, Iris)
//   F — Governance / legal / company-secretary (Owen, Imani)
//   G — Payments / settlement (Tomas)
//   H — Infrastructure / DevSecOps (Atlas, Devon, Senna, Rashida)
//   I — AgentOps / HR / people (Sade, Nolan, PAX)
//   J — Regulatory horizon-scanning (Mira, Anya)
//   K — Client lifecycle / CRM (Niko, Mira)
//   L — Model / quant validation (Nadia, Rohan)
//   M — Readiness snapshots (various)
//   N — Tax (Yael)

import { tokenUsageRecordedPayloadSchema } from "../event-types/agent-ops";
import {
  agentCapabilityChangedPayloadSchema,
  eventSchemaProposalPayloadSchema,
  eventSchemaPublishedPayloadSchema,
  mandateGapDetectedPayloadSchema,
  mergeRequestedPayloadSchema,
  personaSpecChangedPayloadSchema,
  riskRunCompletedPayloadSchema,
  roleBriefDeliveredPayloadSchema,
  roleResearchQueueSnapshotPayloadSchema,
  roleResearchRequestedPayloadSchema,
} from "../event-types/agent-substrate-extended";
import {
  adverseMediaPublishedPayloadSchema,
  adviceRecordRequestedPayloadSchema,
  clientCandidateRegisteredPayloadSchema,
  clientReviewTriggeredPayloadSchema,
  consentWithdrawnPayloadSchema,
  counterpartyEventPayloadSchema,
  crossBorderTransferRequestedPayloadSchema,
  dsarReceivedPayloadSchema,
  faisConductBreachSuspectedPayloadSchema,
  informationRegulatorInquiryPayloadSchema,
  leadCapturedPayloadSchema,
  newProcessingPurposeProposedPayloadSchema,
  onboardingHandoffPendingPayloadSchema,
  paiaRequestPayloadSchema,
  pepListPublishedPayloadSchema,
  pepMatchExceedsThresholdPayloadSchema,
  personalInformationCompromiseSuspectedPayloadSchema,
  popiaControlsSnapshotPayloadSchema,
  sanctionsHitPayloadSchema,
  sanctionsHoldRaisedPayloadSchema,
  sanctionsListPublishedPayloadSchema,
  strCandidatePayloadSchema,
  suitabilityAssessmentRequiredPayloadSchema,
  suspiciousAuthEventPayloadSchema,
} from "../event-types/aml-popia-extended";
import {
  fxPositionRevaluedPayloadSchema,
  fxSettlementConfirmedPayloadSchema,
} from "../event-types/fx-accounting";
import {
  alertOpenedPayloadSchema,
  auditCommitteePackPreppedPayloadSchema,
  auditIssueClosedPayloadSchema,
  auditIssueOpenedPayloadSchema,
  capacityBreachPayloadSchema,
  changeApprovalRequestedPayloadSchema,
  conflictDeclaredPayloadSchema,
  disciplinaryActionRequestedPayloadSchema,
  externalAuditorInquiryPayloadSchema,
  hireConfirmedPayloadSchema,
  identityPermissionChangeProposalPayloadSchema,
  incidentRaisedPayloadSchema,
  leaveGrantedPayloadSchema,
  licenceGrantedPayloadSchema,
  modelRiskDecisionRequiredPayloadSchema,
  policyChangePayloadSchema,
  regulatorCyberInquiryPayloadSchema,
  regulatorInquiryPayloadSchema,
  regulatorRequestPayloadSchema,
  resilienceTestResultPayloadSchema,
  resolutionRequiredPayloadSchema,
  riskPolicyChangePayloadSchema,
  riskPolicyChangeProposalPayloadSchema,
  sloBudgetBurnPayloadSchema,
  supervisoryLetterReceivedPayloadSchema,
  terminationPayloadSchema,
  whistleblowingDisclosurePayloadSchema,
} from "../event-types/governance-extended";
import {
  accrualBookedPayloadSchema,
  clauseChangeProposedPayloadSchema,
  contractDraftRequestedPayloadSchema,
  depositReceivedPayloadSchema,
  ectaExceptionFlaggedPayloadSchema,
  exchangeRuleChangePayloadSchema,
  financialPositionSnapshotPayloadSchema,
  fundingDrawnDownPayloadSchema,
  fundingDrawnPayloadSchema,
  ifrs9ECLChangePayloadSchema,
  ifrs9ECLPublishedPayloadSchema,
  interEntityTransactionProposedPayloadSchema,
  legalEntityChangePayloadSchema,
  loanBookedPayloadSchema,
  materialIFRSClassificationChangePayloadSchema,
  moiChangeProposedPayloadSchema,
  portfolioReclassificationPayloadSchema,
  regulatoryInstrumentUpdatePayloadSchema,
  relatedPartyTransactionProposedPayloadSchema,
  restatementProposedPayloadSchema,
  sarsGuidanceUpdatePayloadSchema,
  schemeRuleChangePayloadSchema,
  signatureRequestedPayloadSchema,
  taxClassificationPublishedPayloadSchema,
} from "../event-types/ifrs-accounting-extended";
import {
  collateralUpdatedPayloadSchema,
  dealerMandateBreachPayloadSchema,
  fxPositionBreachPayloadSchema,
  hedgeIneffectivePayloadSchema,
  marketDataOutagePayloadSchema,
  orderFilledPayloadSchema,
  orderRoutingAnomalyPayloadSchema,
  orderSubmittedPayloadSchema,
  positionAdjustedPayloadSchema,
  preTradeGatewayBlockPayloadSchema,
  surveillanceAlertPayloadSchema,
  surveillanceFeedGapPayloadSchema,
  tradeBooedPayloadSchema,
  tradePostedPayloadSchema,
  transactionPostedPayloadSchema,
} from "../event-types/markets-trading-extended";
import {
  paymentInitiatedPayloadSchema,
  paymentSettledPayloadSchema,
  reconciliationBreakPayloadSchema,
  settlementInstructionReceivedPayloadSchema,
} from "../event-types/payments";
import {
  almReadinessSnapshotPayloadSchema,
  appetiteBreachPayloadSchema,
  backtestTriggeredPayloadSchema,
  capitalActionTriggerPayloadSchema,
  capitalEventPayloadSchema,
  curveSourceAnomalyPayloadSchema,
  cutOffBreachPayloadSchema,
  cyberResilienceSnapshotPayloadSchema,
  hqlaCompositionDriftPayloadSchema,
  icaapIlaapInputReadyPayloadSchema,
  irrbBExcursionPayloadSchema,
  lcrRatioProjectionPayloadSchema,
  legalReadinessSnapshotPayloadSchema,
  limitBreachActionedPayloadSchema,
  limitBreachProposedPayloadSchema,
  liquiditySnapshotPayloadSchema,
  marketsReadinessSnapshotPayloadSchema,
  modelRegisteredPayloadSchema,
  nsfrRatioProjectionPayloadSchema,
  operationalResilienceSnapshotPayloadSchema,
  paymentsReadinessSnapshotPayloadSchema,
  rasCalibrationChangePayloadSchema,
  riskAppetiteSnapshotPayloadSchema,
  samosFundingShortfallPayloadSchema,
  taxReadinessSnapshotPayloadSchema,
} from "../event-types/risk-treasury-extended";
import {
  cspAttestationDuePayloadSchema,
  dependencyVulnDetectedPayloadSchema,
  keyCeremonyScheduledPayloadSchema,
  keyRotationDuePayloadSchema,
  sbomAcceptanceRequiredPayloadSchema,
  sbomRequiredPayloadSchema,
  securityIncidentRaisedPayloadSchema,
  threatModelExceptionRequestedPayloadSchema,
  threatModelGateDecisionPayloadSchema,
  vendorSecurityReviewPayloadSchema,
} from "../event-types/security-devops-extended";
import { type EventTypeMetadata, RETENTION_CONSERVATIVE_DEFAULT } from "./types";

// ---------------------------------------------------------------------------
// A — FX / markets / trading events
// ---------------------------------------------------------------------------

const MARKETS_TRADING_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted by Kai / trading infrastructure when an FX position revaluation
    // completes (e.g. end-of-day mark-to-market on an open FX position).
    // Subscribes: Bea (fx-posting-engine).
    type: "FxPositionRevalued",
    class: "markets",
    payloadSchema: fxPositionRevaluedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Bea"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source:
      "runtime/agents/metadata/bea.ts; Team/Kai.md; platform/event-store/event-types/fx-accounting.ts",
  },
  {
    // Emitted when FX settlement is confirmed by the counterparty / correspondent bank.
    // Subscribes: Bea (fx-posting-engine).
    type: "FxSettlementConfirmed",
    class: "markets",
    payloadSchema: fxSettlementConfirmedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Bea"],
    replay: "idempotent-terminal",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source:
      "runtime/agents/metadata/bea.ts; Team/Kai.md; platform/event-store/event-types/fx-accounting.ts",
  },
  {
    // Emitted by Ravi / Kai when a trade (bond, equity, IRS) is booked into the
    // trading book. Primary trigger for FTP attribution.
    // Subscribes: Ravi (ftp-attribution), Rohan (event-triage).
    type: "TradeBooked",
    class: "markets",
    payloadSchema: tradeBooedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Ravi", "Rohan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts; runtime/agents/metadata/rohan.ts",
  },
  {
    // Emitted by Bea / Kai when a trade is posted to the sub-ledger / GL.
    // Subscribes: Bea (event-triage), Ravi (event-triage).
    type: "TradePosted",
    class: "markets",
    payloadSchema: tradePostedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Ravi"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/bea.ts; runtime/agents/metadata/ravi.ts",
  },
  {
    // Emitted when a capital market / money-market funding drawdown is executed.
    // Subscribes: Bea (event-triage), Ravi (event-triage).
    type: "FundingDrawn",
    class: "markets",
    payloadSchema: fundingDrawnPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Bea", "Ravi"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/bea.ts; runtime/agents/metadata/ravi.ts",
  },
  {
    // Variant of FundingDrawn used in the FTP attribution flow
    // (Ravi:ftp-attribution subscribes separately).
    type: "FundingDrawnDown",
    class: "markets",
    payloadSchema: fundingDrawnDownPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Ravi"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts",
  },
  {
    // Emitted by Kai when a client or proprietary order is submitted to the
    // execution venue / OMS.
    type: "OrderSubmitted",
    class: "markets",
    payloadSchema: orderSubmittedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Kai"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/kai.ts",
  },
  {
    // Emitted when an order fill is confirmed by the exchange / OMS.
    type: "OrderFilled",
    class: "markets",
    payloadSchema: orderFilledPayloadSchema,
    issuer: "Kai",
    subscribers: ["Kai"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/kai.ts",
  },
  {
    // Emitted by the pre-trade gateway when a proposed order is blocked by a
    // risk / limit / compliance gate.
    type: "PreTradeGatewayBlock",
    class: "markets",
    payloadSchema: preTradeGatewayBlockPayloadSchema,
    issuer: "Kai",
    subscribers: ["Kai"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/kai.ts",
  },
  {
    // Emitted when an anomaly is detected in order routing (e.g. unexpected
    // latency, wrong venue, misrouted order).
    type: "OrderRoutingAnomaly",
    class: "markets",
    payloadSchema: orderRoutingAnomalyPayloadSchema,
    issuer: "Kai",
    subscribers: ["Kai"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/kai.ts",
  },
  {
    // Emitted when the surveillance feed from an exchange or data vendor has
    // a gap (missing ticks, disconnection).
    type: "SurveillanceFeedGap",
    class: "markets",
    payloadSchema: surveillanceFeedGapPayloadSchema,
    issuer: "Kai",
    subscribers: ["Kai"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/kai.ts",
  },
  {
    // Emitted when a market data feed is fully unavailable for a covered
    // instrument / venue (escalation of SurveillanceFeedGap).
    type: "MarketDataOutage",
    class: "markets",
    payloadSchema: marketDataOutagePayloadSchema,
    issuer: "Kai",
    subscribers: ["Kai"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/kai.ts",
  },
  {
    // Emitted when a JSE / exchange rule change is published that may affect
    // the bank's trading or membership obligations.
    type: "ExchangeRuleChange",
    class: "markets",
    payloadSchema: exchangeRuleChangePayloadSchema,
    issuer: "Kai",
    subscribers: ["Kai"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/kai.ts",
  },
  {
    // Emitted when Rohan adjusts an open position record (e.g. after a
    // corporate action or an erroneous trade correction).
    type: "PositionAdjusted",
    class: "markets",
    payloadSchema: positionAdjustedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Rohan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rohan.ts",
  },
  {
    // Emitted when the collateral register is updated (margin call received,
    // collateral posted, haircuts reapplied).
    type: "CollateralUpdated",
    class: "markets",
    payloadSchema: collateralUpdatedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Rohan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rohan.ts",
  },
  {
    // Emitted when a limit breach is detected and proposed to Rohan / Helena
    // for response.
    type: "LimitBreachProposed",
    class: "markets",
    payloadSchema: limitBreachProposedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Rohan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rohan.ts",
  },
  {
    // Emitted when a limit breach response action has been decided and enacted.
    type: "LimitBreachActioned",
    class: "markets",
    payloadSchema: limitBreachActionedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Rohan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rohan.ts",
  },
  {
    // Emitted when a portfolio classification changes (e.g. HFT → AFS, AFS → HTM
    // per IFRS 9 reclassification rules).
    type: "PortfolioReclassification",
    class: "markets",
    payloadSchema: portfolioReclassificationPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Rohan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rohan.ts",
  },
  {
    // Emitted when a loan is booked into the banking book.
    // Subscribes: Ravi (ftp-attribution).
    type: "LoanBooked",
    class: "markets",
    payloadSchema: loanBookedPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Ravi"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts",
  },
  {
    // Emitted when a deposit is received from a counterparty.
    // Subscribes: Ravi (ftp-attribution + event-triage).
    type: "DepositReceived",
    class: "markets",
    payloadSchema: depositReceivedPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Ravi"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts",
  },
  {
    // Emitted when Saskia detects a dealer mandate breach (unauthorised
    // instrument class, size, or counterparty).
    type: "DealerMandateBreach",
    class: "markets",
    payloadSchema: dealerMandateBreachPayloadSchema,
    issuer: "Saskia",
    subscribers: ["Saskia"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/saskia.ts",
  },
  {
    // Emitted when a surveillance alert fires on trade or order data
    // (e.g. layering, spoofing, front-running indicators).
    type: "SurveillanceAlert",
    class: "markets",
    payloadSchema: surveillanceAlertPayloadSchema,
    issuer: "Saskia",
    subscribers: ["Saskia"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/saskia.ts",
  },
  {
    // Emitted when an anomaly is detected in a pricing / yield curve source
    // (stale, missing, or implausible data point).
    type: "CurveSourceAnomaly",
    class: "markets",
    payloadSchema: curveSourceAnomalyPayloadSchema,
    issuer: "Saskia",
    subscribers: ["Saskia"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/saskia.ts",
  },
  {
    // Emitted by Saskia on a material counterparty event (default, rating
    // change, insolvency filing). Generic container — producers must set
    // a sub-type in the payload.
    type: "CounterpartyEvent",
    class: "markets",
    payloadSchema: counterpartyEventPayloadSchema,
    issuer: "Saskia",
    subscribers: ["Saskia"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/saskia.ts",
  },
  {
    // Emitted when a RAS limit-schedule calibration change is approved and
    // takes effect.
    type: "RASCalibrationChange",
    class: "markets",
    payloadSchema: rasCalibrationChangePayloadSchema,
    issuer: "Saskia",
    subscribers: ["Saskia"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/saskia.ts",
  },
  {
    // Emitted when a regulatory licence is granted (SARB banking licence,
    // FSP licence, etc.).
    type: "LicenceGranted",
    class: "governance",
    payloadSchema: licenceGrantedPayloadSchema,
    issuer: "Owen",
    subscribers: ["Saskia", "Owen", "dashboard"],
    replay: "idempotent-terminal",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/saskia.ts",
  },
  {
    // Emitted when accrual entries (interest, fee, dividend) are booked.
    type: "AccrualBooked",
    class: "markets",
    payloadSchema: accrualBookedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/bea.ts",
  },
  {
    // Emitted when payment is settled by correspondent / NPS participant.
    type: "PaymentSettled",
    class: "markets",
    payloadSchema: paymentSettledPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Bea"],
    replay: "idempotent-terminal",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/bea.ts; platform/event-store/event-types/payments.ts",
  },
];

// ---------------------------------------------------------------------------
// B — ALM / treasury / liquidity events
// ---------------------------------------------------------------------------

const ALM_TREASURY_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted by the SAMOS interface when a funding shortfall is detected
    // at the central bank settlement window.
    type: "SAMOSFundingShortfall",
    class: "markets",
    payloadSchema: samosFundingShortfallPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Ravi"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts",
  },
  {
    // Emitted when HQLA composition drifts outside the LCR buffer policy band.
    type: "HQLACompositionDrift",
    class: "markets",
    payloadSchema: hqlaCompositionDriftPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Ravi"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts",
  },
  {
    // Emitted by Ravi / Eitan when IRRBB sensitivity metrics exceed the
    // appetite threshold.
    type: "IRRBBExcursion",
    class: "markets",
    payloadSchema: irrbBExcursionPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Ravi", "Eitan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts; runtime/agents/metadata/eitan.ts",
  },
  {
    // Emitted when an FX position breaches the approved limit.
    type: "FXPositionBreach",
    class: "markets",
    payloadSchema: fxPositionBreachPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Ravi", "Eitan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts; runtime/agents/metadata/eitan.ts",
  },
  {
    // Emitted when a hedge is assessed as ineffective under IFRS 9 §6.4.
    type: "HedgeIneffective",
    class: "markets",
    payloadSchema: hedgeIneffectivePayloadSchema,
    issuer: "Ravi",
    subscribers: ["Ravi"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts",
  },
  {
    // Emitted by Eitan's liquidity engine: projected LCR ratio for the
    // next N days.
    type: "LCRRatioProjection",
    class: "markets",
    payloadSchema: lcrRatioProjectionPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Eitan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/eitan.ts",
  },
  {
    // Emitted by Eitan: projected NSFR ratio.
    type: "NSFRRatioProjection",
    class: "markets",
    payloadSchema: nsfrRatioProjectionPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Eitan"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/eitan.ts",
  },
  {
    // Emitted when a capital action trigger fires (AT1 coupon skip,
    // bail-in trigger, CET1 breach of buffer).
    type: "CapitalActionTrigger",
    class: "markets",
    payloadSchema: capitalActionTriggerPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Eitan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/eitan.ts",
  },
  {
    // Emitted on a significant capital event (equity issuance, capital
    // injection, tier-2 issuance).
    type: "CapitalEvent",
    class: "markets",
    payloadSchema: capitalEventPayloadSchema,
    issuer: "Camille",
    subscribers: ["Camille"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/camille.ts",
  },
  {
    // Snapshot of the bank's aggregate financial position (P&L,
    // balance sheet totals, capital ratios).
    type: "FinancialPositionSnapshot",
    class: "markets",
    payloadSchema: financialPositionSnapshotPayloadSchema,
    issuer: "Camille",
    subscribers: ["Camille", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/camille.ts",
  },
  {
    // Emitted by Eitan's liquidity engine: point-in-time liquidity snapshot.
    type: "LiquiditySnapshot",
    class: "markets",
    payloadSchema: liquiditySnapshotPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Eitan", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/eitan.ts",
  },
  {
    // Emitted when a material IFRS classification change is made to a
    // financial instrument (e.g. AFS → FVTPL per IFRS 9 §4.4).
    type: "MaterialIFRSClassificationChange",
    class: "markets",
    payloadSchema: materialIFRSClassificationChangePayloadSchema,
    issuer: "Bea",
    subscribers: ["Camille"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/camille.ts",
  },
  {
    // Emitted when Camille proposes a financial restatement (error correction
    // per IAS 8).
    type: "RestatementProposed",
    class: "markets",
    payloadSchema: restatementProposedPayloadSchema,
    issuer: "Camille",
    subscribers: ["Camille", "Bea"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/camille.ts; runtime/agents/metadata/bea.ts",
  },
  {
    // Emitted when a regulator request (information, data, document) is
    // received from SARB / FSCA / FIC.
    type: "RegulatorRequest",
    class: "governance",
    payloadSchema: regulatorRequestPayloadSchema,
    issuer: "Owen",
    subscribers: ["Camille", "Owen"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/camille.ts",
  },
];

// ---------------------------------------------------------------------------
// C — Risk events (Helena, Rohan, Nadia)
// ---------------------------------------------------------------------------

const RISK_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted when an aggregate risk-appetite limit is breached.
    // Subscribes: Helena (event-triage), Thandiwe.
    type: "AppetiteBreach",
    class: "audit",
    payloadSchema: appetiteBreachPayloadSchema,
    issuer: "Helena",
    subscribers: ["Helena", "Thandiwe"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/helena.ts",
  },
  {
    // Emitted when a model risk event requires CRO-level decision.
    type: "ModelRiskDecisionRequired",
    class: "governance",
    payloadSchema: modelRiskDecisionRequiredPayloadSchema,
    issuer: "Helena",
    subscribers: ["Helena"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/helena.ts",
  },
  {
    // Emitted when a SARB supervisory letter is received.
    type: "SupervisoryLetterReceived",
    class: "governance",
    payloadSchema: supervisoryLetterReceivedPayloadSchema,
    issuer: "Owen",
    subscribers: ["Helena", "Owen"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/helena.ts; runtime/agents/metadata/owen.ts",
  },
  {
    // Emitted when ICAAP / ILAAP input data is ready for Helena's review.
    type: "IcaapIlaapInputReady",
    class: "governance",
    payloadSchema: icaapIlaapInputReadyPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Helena"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/helena.ts",
  },
  {
    // Emitted when a risk policy change is proposed for CRO / Board approval.
    type: "RiskPolicyChangeProposal",
    class: "governance",
    payloadSchema: riskPolicyChangeProposalPayloadSchema,
    issuer: "Helena",
    subscribers: ["Helena"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/helena.ts",
  },
  {
    // Emitted when Nadia's model validation run completes.
    type: "RiskRunCompleted",
    class: "markets",
    payloadSchema: riskRunCompletedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Rohan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rohan.ts",
  },
  {
    // Snapshot of risk-appetite metrics (VaR, stress PnL, concentration).
    type: "RiskAppetiteSnapshot",
    class: "audit",
    payloadSchema: riskAppetiteSnapshotPayloadSchema,
    issuer: "Helena",
    subscribers: ["Helena", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/helena.ts",
  },
  {
    // Emitted when a risk policy changes (approved version bump).
    type: "RiskPolicyChange",
    class: "governance",
    payloadSchema: riskPolicyChangePayloadSchema,
    issuer: "Helena",
    subscribers: ["Nadia", "Rohan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/nadia.ts",
  },
  {
    // Emitted when a model is formally registered in the model inventory.
    type: "ModelRegistered",
    class: "governance",
    payloadSchema: modelRegisteredPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Nadia"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/nadia.ts",
  },
  {
    // Emitted by Rohan's backtest engine to trigger a model validation run.
    type: "BacktestTriggered",
    class: "markets",
    payloadSchema: backtestTriggeredPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Nadia"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/nadia.ts",
  },
];

// ---------------------------------------------------------------------------
// D — Accounting / IFRS events (Bea, Camille, Yael)
// ---------------------------------------------------------------------------

const ACCOUNTING_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted by Bea when an IFRS 9 ECL estimate is published for the loan book.
    type: "IFRS9ECLPublished",
    class: "markets",
    payloadSchema: ifrs9ECLPublishedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/bea.ts",
  },
  {
    // Emitted by Yael / Bea when an IFRS 9 ECL model output changes materially.
    type: "IFRS9ECLChange",
    class: "markets",
    payloadSchema: ifrs9ECLChangePayloadSchema,
    issuer: "Bea",
    subscribers: ["Yael"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/yael.ts",
  },
  {
    // Emitted when Yael completes a tax classification for a new instrument
    // or transaction type.
    type: "TaxClassificationPublished",
    class: "governance",
    payloadSchema: taxClassificationPublishedPayloadSchema,
    issuer: "Yael",
    subscribers: ["Bea"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/bea.ts",
  },
];

// ---------------------------------------------------------------------------
// E — Compliance / AML / FIC / POPIA events (Zara, Mira, Iris)
// ---------------------------------------------------------------------------

const COMPLIANCE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted when a sanctions list update is published by UNSC / OFAC / EU.
    type: "SanctionsListPublished",
    class: "governance",
    payloadSchema: sanctionsListPublishedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira", "Zara"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/mira.ts",
  },
  {
    // Emitted when a PEP list update is published.
    type: "PepListPublished",
    class: "governance",
    payloadSchema: pepListPublishedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira", "Zara"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/mira.ts",
  },
  {
    // Emitted when adverse media is published about a client / counterparty.
    type: "AdverseMediaPublished",
    class: "governance",
    payloadSchema: adverseMediaPublishedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/mira.ts",
  },
  {
    // Emitted when an AML / compliance alert is opened for investigation.
    type: "AlertOpened",
    class: "audit",
    payloadSchema: alertOpenedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/mira.ts",
  },
  {
    // Emitted when a transaction is posted to the AML transaction monitoring
    // engine for screening.
    type: "TransactionPosted",
    class: "markets",
    payloadSchema: transactionPostedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/mira.ts",
  },
  {
    // STR candidate: a transaction flagged as requiring Suspicious Transaction
    // Report review by the MLRO.
    type: "STRCandidate",
    class: "audit",
    payloadSchema: strCandidatePayloadSchema,
    issuer: "Mira",
    subscribers: ["Zara"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/zara.ts",
  },
  {
    // Emitted when a sanctions screening run produces a hit.
    type: "SanctionsHit",
    class: "audit",
    payloadSchema: sanctionsHitPayloadSchema,
    issuer: "Mira",
    subscribers: ["Zara"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/zara.ts",
  },
  {
    // Emitted when a PEP match score exceeds the configured threshold.
    type: "PEPMatchExceedsThreshold",
    class: "audit",
    payloadSchema: pepMatchExceedsThresholdPayloadSchema,
    issuer: "Mira",
    subscribers: ["Zara"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/zara.ts",
  },
  {
    // Emitted when a suspected FAIS conduct breach is detected.
    type: "FAISConductBreachSuspected",
    class: "audit",
    payloadSchema: faisConductBreachSuspectedPayloadSchema,
    issuer: "Zara",
    subscribers: ["Zara"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/zara.ts",
  },
  {
    // Emitted when a regulatory enquiry is received from a regulator.
    type: "RegulatorInquiry",
    class: "governance",
    payloadSchema: regulatorInquiryPayloadSchema,
    issuer: "Owen",
    subscribers: ["Zara", "Owen"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/zara.ts",
  },
  {
    // Emitted when a sanctions hold is raised on a payment pending resolution.
    type: "SanctionsHoldRaised",
    class: "audit",
    payloadSchema: sanctionsHoldRaisedPayloadSchema,
    issuer: "Zara",
    subscribers: ["Tomas"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/tomas.ts",
  },
  {
    // Emitted by Iris when a POPIA data breach or suspected compromise is detected.
    type: "PersonalInformationCompromiseSuspected",
    class: "audit",
    payloadSchema: personalInformationCompromiseSuspectedPayloadSchema,
    issuer: "Iris",
    subscribers: ["Iris", "Rashida"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/iris.ts; runtime/agents/metadata/rashida.ts",
  },
  {
    // Data Subject Access Request received by Iris (POPIA s.23).
    type: "DSARReceived",
    class: "governance",
    payloadSchema: dsarReceivedPayloadSchema,
    issuer: "Iris",
    subscribers: ["Iris"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/iris.ts",
  },
  {
    // Emitted when a new processing purpose is proposed for personal information.
    type: "NewProcessingPurposeProposed",
    class: "governance",
    payloadSchema: newProcessingPurposeProposedPayloadSchema,
    issuer: "Iris",
    subscribers: ["Iris"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/iris.ts",
  },
  {
    // Emitted when a data subject withdraws consent.
    type: "ConsentWithdrawn",
    class: "governance",
    payloadSchema: consentWithdrawnPayloadSchema,
    issuer: "Iris",
    subscribers: ["Iris", "Niko"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/iris.ts; runtime/agents/metadata/niko.ts",
  },
  {
    // Emitted when a cross-border personal information transfer is requested.
    type: "CrossBorderTransferRequested",
    class: "governance",
    payloadSchema: crossBorderTransferRequestedPayloadSchema,
    issuer: "Iris",
    subscribers: ["Iris"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/iris.ts",
  },
  {
    // Emitted when the Information Regulator (POPIA) issues an inquiry.
    type: "InformationRegulatorInquiry",
    class: "governance",
    payloadSchema: informationRegulatorInquiryPayloadSchema,
    issuer: "Iris",
    subscribers: ["Iris"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/iris.ts",
  },
  {
    // Emitted when a PAIA (Promotion of Access to Information Act) request
    // is received.
    type: "PAIARequest",
    class: "governance",
    payloadSchema: paiaRequestPayloadSchema,
    issuer: "Owen",
    subscribers: ["Owen"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/owen.ts",
  },
  {
    // Snapshot of POPIA controls state (data mapping, consent register,
    // breach log).
    type: "POPIAControlsSnapshot",
    class: "audit",
    payloadSchema: popiaControlsSnapshotPayloadSchema,
    issuer: "Iris",
    subscribers: ["Iris", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/iris.ts",
  },
];

// ---------------------------------------------------------------------------
// F — Governance / legal / company-secretary events (Owen, Imani)
// ---------------------------------------------------------------------------

const GOVERNANCE_LEGAL_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted when a dispute resolution or arbitration requirement arises.
    type: "ResolutionRequired",
    class: "governance",
    payloadSchema: resolutionRequiredPayloadSchema,
    issuer: "Owen",
    subscribers: ["Owen"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/owen.ts",
  },
  {
    // Emitted when a conflict of interest is declared by a director / officer.
    type: "ConflictDeclared",
    class: "governance",
    payloadSchema: conflictDeclaredPayloadSchema,
    issuer: "Owen",
    subscribers: ["Owen"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/owen.ts",
  },
  {
    // Emitted when a related-party transaction is proposed (Companies Act s.75 / s.76).
    type: "RelatedPartyTransactionProposed",
    class: "governance",
    payloadSchema: relatedPartyTransactionProposedPayloadSchema,
    issuer: "Owen",
    subscribers: ["Owen"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/owen.ts",
  },
  {
    // Emitted when a protected disclosure / whistleblowing incident is raised.
    type: "WhistleblowingDisclosure",
    class: "audit",
    payloadSchema: whistleblowingDisclosurePayloadSchema,
    issuer: "Owen",
    subscribers: ["Owen", "Thandiwe"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/owen.ts; runtime/agents/metadata/thandiwe.ts",
  },
  {
    // Emitted when a MOI change is proposed for the bank's Memorandum of
    // Incorporation.
    type: "MOIChangeProposed",
    class: "governance",
    payloadSchema: moiChangeProposedPayloadSchema,
    issuer: "Owen",
    subscribers: ["Owen"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/owen.ts",
  },
  {
    // Emitted by Imani when a contract draft is requested.
    type: "ContractDraftRequested",
    class: "governance",
    payloadSchema: contractDraftRequestedPayloadSchema,
    issuer: "Imani",
    subscribers: ["Imani"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/imani.ts",
  },
  {
    // Emitted when a change to a contract clause is proposed.
    type: "ClauseChangeProposed",
    class: "governance",
    payloadSchema: clauseChangeProposedPayloadSchema,
    issuer: "Imani",
    subscribers: ["Imani"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/imani.ts",
  },
  {
    // Emitted when a document requires a digital signature under ECTA.
    type: "SignatureRequested",
    class: "governance",
    payloadSchema: signatureRequestedPayloadSchema,
    issuer: "Imani",
    subscribers: ["Imani"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/imani.ts",
  },
  {
    // Emitted when an ECTA (Electronic Communications and Transactions Act)
    // exception is flagged in a contract or transaction.
    type: "ECTAExceptionFlagged",
    class: "governance",
    payloadSchema: ectaExceptionFlaggedPayloadSchema,
    issuer: "Imani",
    subscribers: ["Imani"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/imani.ts",
  },
  {
    // Emitted when a legal entity change is recorded (name, registration,
    // shareholder, directorship).
    type: "LegalEntityChange",
    class: "governance",
    payloadSchema: legalEntityChangePayloadSchema,
    issuer: "Imani",
    subscribers: ["Imani"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/imani.ts",
  },
  {
    // Emitted by Thandiwe when an audit issue is opened following a finding.
    type: "AuditIssueOpened",
    class: "audit",
    payloadSchema: auditIssueOpenedPayloadSchema,
    issuer: "Thandiwe",
    subscribers: ["Thandiwe"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/thandiwe.ts",
  },
  {
    // Emitted by Thandiwe when an audit issue is closed and management
    // action verified.
    type: "AuditIssueClosed",
    class: "audit",
    payloadSchema: auditIssueClosedPayloadSchema,
    issuer: "Thandiwe",
    subscribers: ["Thandiwe"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/thandiwe.ts",
  },
  {
    // Emitted when an external auditor formal inquiry is received.
    type: "ExternalAuditorInquiry",
    class: "governance",
    payloadSchema: externalAuditorInquiryPayloadSchema,
    issuer: "Thandiwe",
    subscribers: ["Thandiwe"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/thandiwe.ts",
  },
  {
    // Emitted when Owen / Thandiwe complete the quarterly audit committee
    // pack.
    type: "AuditCommitteePackPrepped",
    class: "governance",
    payloadSchema: auditCommitteePackPreppedPayloadSchema,
    issuer: "Thandiwe",
    subscribers: ["Thandiwe", "Owen"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/thandiwe.ts",
  },
  {
    // Generic policy change event — emitted when any governed policy document
    // is updated and takes effect.
    type: "PolicyChange",
    class: "governance",
    payloadSchema: policyChangePayloadSchema,
    issuer: "Owen",
    subscribers: ["Anya", "Zara", "Rohan", "Eitan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/anya.ts; runtime/agents/metadata/zara.ts",
  },
  {
    // Inter-entity transaction proposed between group entities (requires
    // SARB / Companies Act review).
    type: "InterEntityTransactionProposed",
    class: "governance",
    payloadSchema: interEntityTransactionProposedPayloadSchema,
    issuer: "Owen",
    subscribers: ["Yael"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/yael.ts",
  },
];

// ---------------------------------------------------------------------------
// G — Payments / settlement events (Tomas)
// ---------------------------------------------------------------------------

const PAYMENTS_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted when a settlement instruction is received from a counterparty.
    type: "SettlementInstructionReceived",
    class: "markets",
    payloadSchema: settlementInstructionReceivedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/tomas.ts; platform/event-store/event-types/payments.ts",
  },
  {
    // Emitted when a payment instruction is initiated via the correspondent
    // bank channel.
    type: "PaymentInitiated",
    class: "markets",
    payloadSchema: paymentInitiatedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/tomas.ts; platform/event-store/event-types/payments.ts",
  },
  {
    // Emitted when a reconciliation break is detected between the bank's
    // records and the correspondent's statement.
    type: "ReconciliationBreak",
    class: "audit",
    payloadSchema: reconciliationBreakPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/tomas.ts; platform/event-store/event-types/payments.ts",
  },
  {
    // Emitted when a settlement cut-off time breach is detected.
    type: "CutOffBreach",
    class: "markets",
    payloadSchema: cutOffBreachPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/tomas.ts",
  },
  {
    // Emitted when a payment scheme rule change is published.
    type: "SchemeRuleChange",
    class: "governance",
    payloadSchema: schemeRuleChangePayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/tomas.ts",
  },
  {
    // Emitted when a CSP (Common Secure Platform) attestation is due.
    type: "CSPAttestationDue",
    class: "governance",
    payloadSchema: cspAttestationDuePayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/tomas.ts",
  },
];

// ---------------------------------------------------------------------------
// H — Infrastructure / DevSecOps events (Atlas, Devon, Senna, Rashida)
// ---------------------------------------------------------------------------

const INFRA_SECURITY_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted when Atlas proposes a new event schema for review and approval.
    type: "EventSchemaProposal",
    class: "runtime",
    payloadSchema: eventSchemaProposalPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/atlas.ts",
  },
  {
    // Emitted when Atlas proposes an identity / permission change for review.
    type: "IdentityPermissionChangeProposal",
    class: "runtime",
    payloadSchema: identityPermissionChangeProposalPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/atlas.ts",
  },
  {
    // Emitted when Atlas publishes a reviewed and approved event schema.
    type: "EventSchemaPublished",
    class: "runtime",
    payloadSchema: eventSchemaPublishedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Anya", "Anya"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/anya.ts",
  },
  {
    // Emitted when an operational incident is raised (SRE / security).
    type: "IncidentRaised",
    class: "audit",
    payloadSchema: incidentRaisedPayloadSchema,
    issuer: "Devon",
    subscribers: ["Devon"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/devon.ts",
  },
  {
    // Emitted when the SLO error budget burn rate exceeds the alert threshold.
    type: "SLOBudgetBurn",
    class: "runtime",
    payloadSchema: sloBudgetBurnPayloadSchema,
    issuer: "Devon",
    subscribers: ["Devon"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/devon.ts",
  },
  {
    // Emitted when infrastructure capacity is projected to breach a threshold.
    type: "CapacityBreach",
    class: "runtime",
    payloadSchema: capacityBreachPayloadSchema,
    issuer: "Devon",
    subscribers: ["Devon"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/devon.ts",
  },
  {
    // Emitted when a change is submitted for approval via the change-advisory
    // process.
    type: "ChangeApprovalRequested",
    class: "governance",
    payloadSchema: changeApprovalRequestedPayloadSchema,
    issuer: "Devon",
    subscribers: ["Devon"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/devon.ts",
  },
  {
    // Emitted when a resilience test (BCP, DR, chaos engineering) result
    // is recorded.
    type: "ResilienceTestResult",
    class: "audit",
    payloadSchema: resilienceTestResultPayloadSchema,
    issuer: "Devon",
    subscribers: ["Devon"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/devon.ts",
  },
  {
    // Emitted when a security incident is raised (cyber attack, data
    // exfiltration, unauthorised access).
    type: "SecurityIncidentRaised",
    class: "audit",
    payloadSchema: securityIncidentRaisedPayloadSchema,
    issuer: "Senna",
    subscribers: ["Senna", "Rashida"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/senna.ts; runtime/agents/metadata/rashida.ts",
  },
  {
    // Emitted when a cryptographic key rotation is due.
    type: "KeyRotationDue",
    class: "runtime",
    payloadSchema: keyRotationDuePayloadSchema,
    issuer: "Senna",
    subscribers: ["Senna"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/senna.ts",
  },
  {
    // Emitted when a dependency vulnerability is detected via SCA scanning.
    type: "DependencyVulnDetected",
    class: "runtime",
    payloadSchema: dependencyVulnDetectedPayloadSchema,
    issuer: "Senna",
    subscribers: ["Senna"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/senna.ts",
  },
  {
    // Emitted when a suspicious authentication event is detected (brute
    // force, credential stuffing, anomalous login).
    type: "SuspiciousAuthEvent",
    class: "audit",
    payloadSchema: suspiciousAuthEventPayloadSchema,
    issuer: "Senna",
    subscribers: ["Senna"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/senna.ts",
  },
  {
    // Emitted when an SBOM (Software Bill of Materials) is required for a
    // dependency / component before it can be merged.
    type: "SBOMRequired",
    class: "runtime",
    payloadSchema: sbomRequiredPayloadSchema,
    issuer: "Senna",
    subscribers: ["Senna"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/senna.ts",
  },
  {
    // Emitted when a merge request is submitted for security review.
    type: "MergeRequested",
    class: "runtime",
    payloadSchema: mergeRequestedPayloadSchema,
    issuer: "Senna",
    subscribers: ["Senna"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/senna.ts",
  },
  {
    // Emitted when Rashida requires SBOM acceptance confirmation from a
    // vendor / supplier before onboarding.
    type: "SBOMAcceptanceRequired",
    class: "governance",
    payloadSchema: sbomAcceptanceRequiredPayloadSchema,
    issuer: "Rashida",
    subscribers: ["Rashida"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rashida.ts",
  },
  {
    // Emitted when a key ceremony is scheduled (HSM key generation / ceremony).
    type: "KeyCeremonyScheduled",
    class: "governance",
    payloadSchema: keyCeremonyScheduledPayloadSchema,
    issuer: "Rashida",
    subscribers: ["Rashida"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rashida.ts",
  },
  {
    // Emitted when a vendor security review is triggered (third-party risk).
    type: "VendorSecurityReview",
    class: "governance",
    payloadSchema: vendorSecurityReviewPayloadSchema,
    issuer: "Rashida",
    subscribers: ["Rashida"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rashida.ts",
  },
  {
    // Emitted when a regulator (SARB / FSCA / FIC) issues a cyber security
    // inquiry.
    type: "RegulatorCyberInquiry",
    class: "governance",
    payloadSchema: regulatorCyberInquiryPayloadSchema,
    issuer: "Rashida",
    subscribers: ["Rashida"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rashida.ts",
  },
  {
    // Emitted when Rashida requests a threat model gate decision from the
    // CRO / CISO.
    type: "ThreatModelGateDecision",
    class: "governance",
    payloadSchema: threatModelGateDecisionPayloadSchema,
    issuer: "Rashida",
    subscribers: ["Rashida"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rashida.ts",
  },
  {
    // Emitted when a threat model exception is requested (deviation from
    // the approved threat model).
    type: "ThreatModelExceptionRequested",
    class: "governance",
    payloadSchema: threatModelExceptionRequestedPayloadSchema,
    issuer: "Rashida",
    subscribers: ["Rashida"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rashida.ts",
  },
  {
    // Cyber resilience snapshot: point-in-time summary of the bank's cyber
    // posture.
    type: "CyberResilienceSnapshot",
    class: "audit",
    payloadSchema: cyberResilienceSnapshotPayloadSchema,
    issuer: "Rashida",
    subscribers: ["Rashida", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/rashida.ts",
  },
  {
    // Operational resilience snapshot (BCP / DR / SLO status).
    type: "OperationalResilienceSnapshot",
    class: "audit",
    payloadSchema: operationalResilienceSnapshotPayloadSchema,
    issuer: "Devon",
    subscribers: ["Devon", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/devon.ts",
  },
];

// ---------------------------------------------------------------------------
// I — AgentOps / HR / people events (Sade, Nolan, PAX)
// ---------------------------------------------------------------------------

const AGENTOPS_HR_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted by Sade when an agent token usage event is recorded.
    type: "TokenUsageRecorded",
    class: "runtime",
    payloadSchema: tokenUsageRecordedPayloadSchema,
    issuer: "Sade",
    subscribers: ["Sade"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/sade.ts; platform/event-store/event-types/agent-ops.ts",
  },
  {
    // Emitted when an agent's capability set changes (new handler added /
    // removed).
    type: "AgentCapabilityChanged",
    class: "runtime",
    payloadSchema: agentCapabilityChangedPayloadSchema,
    issuer: "Sade",
    subscribers: ["Sade"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/sade.ts",
  },
  {
    // Emitted when an agent's persona spec is changed (mandate, trigger,
    // cadence update).
    type: "PersonaSpecChanged",
    class: "runtime",
    payloadSchema: personaSpecChangedPayloadSchema,
    issuer: "Sade",
    subscribers: ["Sade"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/sade.ts",
  },
  {
    // Emitted when Nolan / Scrooge confirms a hire (new agent registered).
    type: "HireConfirmed",
    class: "governance",
    payloadSchema: hireConfirmedPayloadSchema,
    issuer: "Nolan",
    subscribers: ["Sade", "Scrooge"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/sade.ts; runtime/agents/metadata/scrooge.ts",
  },
  {
    // Emitted when an agent or human employee is terminated.
    type: "Termination",
    class: "governance",
    payloadSchema: terminationPayloadSchema,
    issuer: "Nolan",
    subscribers: ["Sade"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/sade.ts",
  },
  {
    // Emitted when leave is granted to an employee / agent.
    type: "LeaveGranted",
    class: "governance",
    payloadSchema: leaveGrantedPayloadSchema,
    issuer: "Nolan",
    subscribers: ["Sade"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/sade.ts",
  },
  {
    // Emitted when a disciplinary action is requested for an agent / employee.
    type: "DisciplinaryActionRequested",
    class: "governance",
    payloadSchema: disciplinaryActionRequestedPayloadSchema,
    issuer: "Nolan",
    subscribers: ["Sade"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/sade.ts",
  },
  {
    // Emitted when Nolan delivers a role brief (persona spec) for a new hire.
    type: "RoleBriefDelivered",
    class: "governance",
    payloadSchema: roleBriefDeliveredPayloadSchema,
    issuer: "Nolan",
    subscribers: ["Nolan"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/nolan.ts",
  },
  {
    // Emitted when a mandate gap is detected (agent lacks a required capability).
    type: "MandateGapDetected",
    class: "runtime",
    payloadSchema: mandateGapDetectedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Nolan", "PAX", "Scrooge"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/nolan.ts; runtime/agents/metadata/pax.ts",
  },
  {
    // Emitted by PAX when a role research task is requested.
    type: "RoleResearchRequested",
    class: "governance",
    payloadSchema: roleResearchRequestedPayloadSchema,
    issuer: "PAX",
    subscribers: ["PAX"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/pax.ts",
  },
  {
    // Snapshot of PAX's role research queue state.
    type: "RoleResearchQueueSnapshot",
    class: "runtime",
    payloadSchema: roleResearchQueueSnapshotPayloadSchema,
    issuer: "PAX",
    subscribers: ["PAX", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/pax.ts",
  },
  // NOTE: AgentOpsReadinessSnapshot is already registered in governance.ts
  // with a payloadSchema (F-032 closed type). Omitting here to avoid
  // overriding the schema-bearing row with this placeholder.
];

// ---------------------------------------------------------------------------
// J — Regulatory horizon-scanning events (Mira, Anya)
// ---------------------------------------------------------------------------

const REGULATORY_HORIZON_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted when a regulatory instrument update is published (new guidance,
    // amended standard, new circular).
    type: "RegulatoryInstrumentUpdate",
    class: "governance",
    payloadSchema: regulatoryInstrumentUpdatePayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/mira.ts",
  },
  {
    // Emitted by Yael when SARS issues new tax guidance.
    type: "SARSGuidanceUpdate",
    class: "governance",
    payloadSchema: sarsGuidanceUpdatePayloadSchema,
    issuer: "Yael",
    subscribers: ["Yael"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/yael.ts",
  },
];

// ---------------------------------------------------------------------------
// K — Client lifecycle / CRM events (Niko, Mira, Yael)
// ---------------------------------------------------------------------------

const CLIENT_LIFECYCLE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted when a prospective client lead is captured.
    type: "LeadCaptured",
    class: "markets",
    payloadSchema: leadCapturedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Niko"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/niko.ts",
  },
  {
    // Emitted when a suitability assessment is required for a client.
    type: "SuitabilityAssessmentRequired",
    class: "governance",
    payloadSchema: suitabilityAssessmentRequiredPayloadSchema,
    issuer: "Niko",
    subscribers: ["Niko"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/niko.ts",
  },
  {
    // Emitted when an advice record is required for a client interaction
    // (FAIS §7 obligation).
    type: "AdviceRecordRequested",
    class: "governance",
    payloadSchema: adviceRecordRequestedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Niko"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/niko.ts",
  },
  {
    // Emitted when an onboarding process reaches the handoff point from
    // Niko to Mira (KYC gate).
    type: "OnboardingHandoffPending",
    class: "governance",
    payloadSchema: onboardingHandoffPendingPayloadSchema,
    issuer: "Niko",
    subscribers: ["Niko"],
    replay: "pair-coupled",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/niko.ts",
  },
  {
    // Emitted by Mira / Niko when a client candidate is registered in the
    // KYC pipeline.
    type: "ClientCandidateRegistered",
    class: "governance",
    payloadSchema: clientCandidateRegisteredPayloadSchema,
    issuer: "Niko",
    subscribers: ["Mira", "Yael"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/mira.ts; runtime/agents/metadata/yael.ts",
  },
  {
    // Emitted when a periodic client review cycle is triggered.
    type: "ClientReviewTriggered",
    class: "governance",
    payloadSchema: clientReviewTriggeredPayloadSchema,
    issuer: "Mira",
    subscribers: ["Yael"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/yael.ts",
  },
];

// ---------------------------------------------------------------------------
// L — Model / quant validation events (Nadia)
// ---------------------------------------------------------------------------

const MODEL_VALIDATION_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // Emitted by Nadia when a model backtest is triggered.
    // (Distinct from BacktestRequested which Rohan consumes.)
    type: "BacktestTriggered",
    class: "markets",
    payloadSchema: backtestTriggeredPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Nadia"],
    replay: "append-only-audit",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/nadia.ts",
  },
];

// ---------------------------------------------------------------------------
// M — Readiness snapshots (various — build-phase sentinel events)
// ---------------------------------------------------------------------------

const READINESS_SNAPSHOT_EXTENDED_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    // ALM / Treasury readiness snapshot.
    type: "ALMReadinessSnapshot",
    class: "audit",
    payloadSchema: almReadinessSnapshotPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Ravi", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/ravi.ts",
  },
  {
    // Markets / Saskia readiness snapshot.
    type: "MarketsReadinessSnapshot",
    class: "audit",
    payloadSchema: marketsReadinessSnapshotPayloadSchema,
    issuer: "Saskia",
    subscribers: ["Saskia", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/saskia.ts",
  },
  {
    // Payments / Tomas readiness snapshot.
    type: "PaymentsReadinessSnapshot",
    class: "audit",
    payloadSchema: paymentsReadinessSnapshotPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/tomas.ts",
  },
  {
    // Legal / Imani readiness snapshot.
    type: "LegalReadinessSnapshot",
    class: "audit",
    payloadSchema: legalReadinessSnapshotPayloadSchema,
    issuer: "Imani",
    subscribers: ["Imani", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/imani.ts",
  },
  {
    // Tax / Yael readiness snapshot.
    type: "TaxReadinessSnapshot",
    class: "audit",
    payloadSchema: taxReadinessSnapshotPayloadSchema,
    issuer: "Yael",
    subscribers: ["Yael", "dashboard"],
    replay: "latest-wins-per-key",
    retention: RETENTION_CONSERVATIVE_DEFAULT,
    source: "runtime/agents/metadata/yael.ts",
  },
];

// ---------------------------------------------------------------------------
// N — Tax events (Yael)
// ---------------------------------------------------------------------------

// (No additional types beyond those already captured above in domain D/K/J.)

// ---------------------------------------------------------------------------
// Combined export
// ---------------------------------------------------------------------------

// De-duplicate BacktestTriggered: it appears in both domains C and L with
// the same definition. The registry requires unique type strings.
// We keep domain C's entry (issuer: Nadia's trigger from Rohan) since that
// is the higher-frequency consumer pattern. Domain L is the same row.

const SEEN = new Set<string>();
const dedupedRows: EventTypeMetadata[] = [];

function addRows(rows: readonly EventTypeMetadata[]): void {
  for (const row of rows) {
    if (!SEEN.has(row.type)) {
      SEEN.add(row.type);
      dedupedRows.push(row);
    }
  }
}

addRows(MARKETS_TRADING_EVENT_TYPES);
addRows(ALM_TREASURY_EVENT_TYPES);
addRows(RISK_EVENT_TYPES);
addRows(ACCOUNTING_EVENT_TYPES);
addRows(COMPLIANCE_EVENT_TYPES);
addRows(GOVERNANCE_LEGAL_EVENT_TYPES);
addRows(PAYMENTS_EVENT_TYPES);
addRows(INFRA_SECURITY_EVENT_TYPES);
addRows(AGENTOPS_HR_EVENT_TYPES);
addRows(REGULATORY_HORIZON_EVENT_TYPES);
addRows(CLIENT_LIFECYCLE_EVENT_TYPES);
addRows(MODEL_VALIDATION_EVENT_TYPES);
addRows(READINESS_SNAPSHOT_EXTENDED_EVENT_TYPES);

export const MISSING_EVENT_TYPES: readonly EventTypeMetadata[] = dedupedRows;
