---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-31T11:00:57.120Z
decision-required: false
---

# Atlas — substrate state, 2026-05-31

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 129734 events across 187 types; 31/31 personas have operating specs; 130 runtime handlers registered; 537 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 129734

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 44286 | 2026-05-27 | 2026-05-30 |
| `InboundMessageReceived` | 13423 | 2026-05-25 | 2026-05-28 |
| `SubstrateAgentRunStarted` | 6946 | 2026-05-25 | 2026-05-31 |
| `BusDispatched` | 6822 | 2026-05-25 | 2026-05-31 |
| `SubstrateAgentRunCompleted` | 6780 | 2026-05-25 | 2026-05-31 |
| `GatewayCheckRequested` | 4074 | 2026-05-09 | 2026-05-20 |
| `SubLedgerPostingEmitted` | 3980 | 2026-05-09 | 2026-05-31 |
| `Decision` | 2707 | 2026-04-30 | 2026-05-31 |
| `LegacyFanoutShadowed` | 2663 | 2026-05-25 | 2026-05-31 |
| `GatewayCheckCompleted` | 2496 | 2026-05-17 | 2026-05-20 |
| `RiskRaised` | 2210 | 2025-12-01 | 2026-05-31 |
| `OrderProposed` | 1650 | 2026-05-09 | 2026-05-20 |
| `ISDACSAAssessmentCompleted` | 1490 | 2024-01-01 | 2026-05-20 |
| `CreditLimitLoaded` | 1327 | 2024-01-01 | 2026-05-21 |
| `CreditLimitApplicationSubmitted` | 1308 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 1308 | 2024-01-01 | 2026-05-20 |
| `RecordFiled` | 1234 | 2026-05-05 | 2026-05-31 |
| `WorkstreamRegistered` | 1132 | 2026-05-07 | 2026-05-31 |
| `CreditAnalysisCompleted` | 990 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 990 | 2024-01-01 | 2026-05-20 |
| `DashboardProjectionRefreshed` | 937 | 2026-05-25 | 2026-05-31 |
| `CcrReplacementCostComputed` | 873 | 2026-05-18 | 2026-05-20 |
| `SubstrateAlert` | 841 | 2025-01-01 | 2026-05-31 |
| `BacktestRequested` | 816 | 2026-01-10 | 2026-01-10 |
| `BacktestRun` | 769 | 2026-05-09 | 2026-05-09 |
| `FxTradeExecuted` | 695 | 2026-05-17 | 2026-05-30 |
| `ScheduledTrigger` | 647 | 2026-05-25 | 2026-05-31 |
| `ReconResult` | 603 | 2026-05-07 | 2026-05-31 |
| `MarketsProjectionRefreshed` | 585 | 2026-05-09 | 2026-05-09 |
| `AgentGoalEvaluated` | 547 | 2026-05-25 | 2026-05-31 |
| `ClientCandidateRegistered` | 544 | 2026-05-25 | 2026-05-29 |
| `CounterpartyFaisClassified` | 500 | 2026-05-01 | 2026-05-17 |
| `KYCIdentityCollected` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCIdentityVerified` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCSanctionsPEPScreened` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCDecisionMade` | 491 | 2026-05-25 | 2026-05-29 |
| `CalculationPerformed` | 471 | 2026-05-29 | 2026-05-31 |
| `FxPositionRevalued` | 454 | 2026-05-28 | 2026-05-31 |
| `OfficialMarkAdopted` | 452 | 2026-05-28 | 2026-05-31 |
| `ClientRejected` | 419 | 2026-05-25 | 2026-05-29 |
| `AgentGoalDeferred` | 408 | 2026-05-25 | 2026-05-31 |
| `KYCUBOResolved` | 357 | 2026-05-25 | 2026-05-29 |
| `KYCRiskRated` | 357 | 2026-05-25 | 2026-05-29 |
| `ClientAccepted` | 351 | 2026-05-13 | 2026-05-29 |
| `IdentityKeyRotated` | 350 | 2026-05-25 | 2026-05-31 |
| `FxSettlementInstructed` | 340 | 2026-05-19 | 2026-05-28 |
| `CcrEadComputed` | 339 | 2026-05-18 | 2026-05-20 |
| `PermissionPolicyPublished` | 323 | 2026-05-25 | 2026-05-31 |
| `LawfulProcessingRegistered` | 312 | 2026-05-25 | 2026-05-29 |
| `AgentRunCompleted` | 279 | 2026-05-10 | 2026-05-31 |
| `PrincipalPayment` | 276 | 2026-05-23 | 2026-05-30 |
| `AgentBriefIssued` | 271 | 2026-05-10 | 2026-05-31 |
| `AgentRunStarted` | 271 | 2026-05-10 | 2026-05-31 |
| `AuditFinding` | 227 | 2026-05-07 | 2026-05-30 |
| `M1CitationTrancheRegistered` | 180 | 2026-05-09 | 2026-05-09 |
| `IrsPositionRevalued` | 180 | 2026-05-19 | 2026-05-20 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `SettlementConfirmed` | 170 | 2026-05-19 | 2026-05-30 |
| `SubstrateAgentRunFailed` | 161 | 2026-05-25 | 2026-05-31 |
| `IRRBBChecked` | 160 | 2026-05-26 | 2026-05-31 |
| `AgentPerformanceEvaluated` | 153 | 2026-05-25 | 2026-05-31 |
| `AgentFeedbackIssued` | 153 | 2026-05-25 | 2026-05-31 |
| `SubstrateStateSnapshot` | 141 | 2026-05-07 | 2026-05-31 |
| `AgentGoalSelected` | 139 | 2026-05-25 | 2026-05-31 |
| `DecisionRequested` | 135 | 2026-05-10 | 2026-05-10 |
| `EquityTradeBooked` | 135 | 2026-05-09 | 2026-05-09 |
| `IfrsClassificationApplied` | 135 | 2026-05-09 | 2026-05-09 |
| `IrsTradeBooked` | 135 | 2026-05-20 | 2026-05-20 |
| `KYCEDDInitiated` | 134 | 2026-05-25 | 2026-05-29 |
| `KYCEDDCompleted` | 134 | 2026-05-25 | 2026-05-29 |
| `IntradayHQLAStressProjection` | 128 | 2026-05-26 | 2026-05-31 |
| `DailyPnLReportGenerated` | 125 | 2026-05-25 | 2026-05-31 |
| `CdmBindingsRegenerated` | 119 | 2026-05-09 | 2026-05-26 |
| `OrderApprovedAtGateway` | 117 | 2026-05-17 | 2026-05-17 |
| `OrderRejectedAtGateway` | 117 | 2026-05-17 | 2026-05-17 |
| `CreditLimitBreached` | 90 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 90 | 2026-05-23 | 2026-05-23 |
| `LiquidityLimitBreached` | 90 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 90 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 90 | 2026-05-10 | 2026-05-10 |
| `PartyRelationshipAsserted` | 81 | 2026-05-19 | 2026-05-26 |
| `AgentEscalation` | 78 | 2026-05-07 | 2026-05-30 |
| `DocumentRegistered` | 71 | 2026-05-11 | 2026-05-25 |
| `FxTradeCancelled` | 57 | 2026-05-21 | 2026-05-31 |
| `ConflictOfInterestDisclosed` | 55 | 2026-05-17 | 2026-05-17 |
| `BestExecutionVerified` | 54 | 2026-05-17 | 2026-05-17 |
| `AgentRegistered` | 54 | 2026-05-26 | 2026-05-31 |
| `SanctionsClearancePassed` | 52 | 2026-05-13 | 2026-05-13 |
| `PEPScreeningCompleted` | 52 | 2026-05-13 | 2026-05-13 |
| `BeneficialOwnerResolved` | 52 | 2026-05-13 | 2026-05-13 |
| `RiskRatingAssigned` | 52 | 2026-05-13 | 2026-05-13 |
| `DataProjectionSnapshot` | 51 | 2026-05-07 | 2026-05-31 |
| `InboxHygieneSweep` | 51 | 2026-05-07 | 2026-05-31 |
| `FaisClassificationSuitabilityChecked` | 49 | 2026-05-17 | 2026-05-17 |
| `BriefSuperseded` | 49 | 2026-05-10 | 2026-05-31 |
| `BestExecutionBreached` | 47 | 2026-05-17 | 2026-05-17 |
| `CreditLimitAnnualReviewCompleted` | 45 | 2026-05-21 | 2026-05-21 |
| `LexUtilisationComputed` | 45 | 2026-05-20 | 2026-05-20 |
| `EquitySettlementInstructed` | 45 | 2026-05-13 | 2026-05-13 |
| `PaNotificationSubmitted` | 45 | 2026-05-11 | 2026-05-11 |
| `CreditLimitWithdrawn` | 45 | 2026-05-12 | 2026-05-12 |
| `OrderAccepted` | 45 | 2026-05-13 | 2026-05-13 |
| `ObligationsRegisterSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `SecuritySubstrateSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `GovernanceCyclePrep` | 41 | 2026-05-07 | 2026-05-28 |
| `PopiaConsentRecorded` | 39 | 2026-05-13 | 2026-05-13 |
| `PartyRegistered` | 38 | 2026-05-23 | 2026-05-30 |
| `ModelValidationApproved` | 26 | 2026-05-27 | 2026-05-29 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `ValuationAdjustmentComputed` | 24 | 2026-05-31 | 2026-05-31 |
| `ModelSubmitted` | 23 | 2026-05-27 | 2026-05-29 |
| `ModelTierClassified` | 23 | 2026-05-27 | 2026-05-29 |
| `MtmRunCompleted` | 21 | 2026-05-26 | 2026-05-31 |
| `AccountingReadinessSnapshot` | 17 | 2026-05-26 | 2026-05-31 |
| `FtpCurvePublished` | 16 | 2026-05-26 | 2026-05-31 |
| `ALMRunCompleted` | 16 | 2026-05-26 | 2026-05-31 |
| `LCRComputed` | 14 | 2026-05-26 | 2026-05-29 |
| `NSFRComputed` | 14 | 2026-05-26 | 2026-05-29 |
| `AgentEscalationDecided` | 14 | 2026-05-26 | 2026-05-30 |
| `BalanceSheetSubstantiationCompleted` | 14 | 2026-05-30 | 2026-05-30 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `EddInitiated` | 13 | 2026-05-13 | 2026-05-13 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `RiskAppetiteSnapshot` | 11 | 2026-05-27 | 2026-05-31 |
| `PnLAttributionGenerated` | 9 | 2026-05-31 | 2026-05-31 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `LiquiditySnapshot` | 7 | 2026-05-28 | 2026-05-31 |
| `CollateralInventorySnapshot` | 6 | 2026-05-26 | 2026-05-26 |
| `CollateralInventorySnapshotted` | 6 | 2026-05-28 | 2026-05-31 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `AgentDecision` | 5 | 2026-05-07 | 2026-05-30 |
| `RiskRunCompleted` | 5 | 2026-05-29 | 2026-05-31 |
| `ALMReadinessSnapshot` | 5 | 2026-05-29 | 2026-05-31 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `CounterpartyExposureCalculated` | 4 | 2026-05-18 | 2026-05-18 |
| `InterbankLoanPlaced` | 4 | 2026-05-27 | 2026-05-28 |
| `LCRRatioProjection` | 4 | 2026-05-28 | 2026-05-29 |
| `ILAAPScenarioRun` | 4 | 2026-05-30 | 2026-05-30 |
| `PrudentValuationAvaAggregated` | 4 | 2026-05-31 | 2026-05-31 |
| `AgentOpsReadinessSnapshot` | 3 | 2026-05-26 | 2026-05-29 |
| `TrialBalanceSnapshotted` | 3 | 2026-05-15 | 2026-06-01 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `PaymentsReadinessSnapshot` | 3 | 2026-05-29 | 2026-05-31 |
| `PnLFlashRecorded` | 3 | 2026-05-31 | 2026-05-31 |
| `PnLFlashActualReconciled` | 3 | 2026-05-31 | 2026-05-31 |
| `PnLSignedOff` | 3 | 2026-05-31 | 2026-05-31 |
| `MLROAttestation` | 2 | 2026-05-26 | 2026-05-26 |
| `ConductObligationFlagged` | 2 | 2026-05-17 | 2026-05-17 |
| `AccountingPeriodOpened` | 2 | 2026-05-01 | 2026-05-28 |
| `AccountingPeriodClosed` | 2 | 2026-05-31 | 2026-06-01 |
| `RepoTradeOpened` | 2 | 2026-05-27 | 2026-05-28 |
| `DepositTaken` | 2 | 2026-05-27 | 2026-05-28 |
| `RepoTradeTerminatedEarly` | 2 | 2026-05-28 | 2026-05-28 |
| `InterbankLoanRecalledEarly` | 2 | 2026-05-28 | 2026-05-28 |
| `ALCOPackGenerated` | 2 | 2026-05-30 | 2026-05-30 |
| `RegulatoryInstrumentRegistered` | 1 | 2026-05-25 | 2026-05-25 |
| `RegulatoryInstrumentContextualised` | 1 | 2026-05-25 | 2026-05-25 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `FundingLineDrawn` | 1 | 2026-05-27 | 2026-05-27 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `FXPositionBreach` | 1 | 2026-05-28 | 2026-05-28 |
| `DepositWithdrawnEarly` | 1 | 2026-05-28 | 2026-05-28 |
| `RoleResearchQueueSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `LegalReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `OperationalResilienceSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `CyberResilienceSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `POPIAControlsSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `AuditCommitteePackPrepped` | 1 | 2026-05-29 | 2026-05-29 |
| `TaxReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `MarketsReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `FinancialPositionSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `PartyClassified` | 1 | 2026-05-30 | 2026-05-30 |
| `SubLedgerPostingRemediationRecorded` | 1 | 2026-05-30 | 2026-05-30 |
| `ILAAPSummaryCompleted` | 1 | 2026-05-30 | 2026-05-30 |
| `IcaapIlaapInputReady` | 1 | 2026-05-30 | 2026-05-30 |
| `PnLAttributionExceptionRaised` | 1 | 2026-05-31 | 2026-05-31 |
| `PnLCommentaryRecorded` | 1 | 2026-05-31 | 2026-05-31 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

130 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

| Agent | Trigger |
|---|---|
| Vera | `overnight-recon` |
| Vera | `codebase-quality-review` |
| Vera | `goal-loop` |
| Vera | `event-triage` |
| Vera | `issues-tracker` |
| Atlas | `substrate-state` |
| Atlas | `goal-loop` |
| Atlas | `event-triage` |
| Atlas | `permission-policy-refresh` |
| Atlas | `collateral-snapshot` |
| Atlas | `ilaap-run` |
| Atlas | `alco-pack` |
| Atlas | `product-narrative-fulfilment` |
| Bea | `goal-loop` |
| Bea | `accounting-readiness` |
| Bea | `fx-posting-engine` |
| Bea | `gl-posting-engine` |
| Bea | `m1-ifrs-classification-rules` |
| Bea | `event-triage` |
| Bea | `period-close` |
| Bea | `product-control-daily` |
| Helena | `risk-appetite-watch` |
| Helena | `goal-loop` |
| Helena | `event-triage` |
| Devon | `operational-resilience-snapshot` |
| Devon | `goal-loop` |
| Devon | `event-triage` |
| Devon | `fx-rates-ingest` |
| Devon | `fx-twelvedata-ingest` |
| Camille | `financial-position-snapshot` |
| Camille | `goal-loop` |
| Camille | `event-triage` |
| Anya | `goal-loop` |
| Anya | `projection-drift` |
| Anya | `projection-refresh` |
| Anya | `m1-projection-runtime-mapping` |
| Anya | `event-triage` |
| Anya | `liquidity-projection` |
| Scrooge | `inbox-hygiene` |
| Scrooge | `ceo-decision-record` |
| Scrooge | `follow-on-router` |
| Scrooge | `owner-inbox-archiver` |
| Scrooge | `event-triage` |
| Owen | `goal-loop` |
| Owen | `governance-cycle-prep` |
| Owen | `event-triage` |
| Rohan | `risk-run` |
| Rohan | `daily-mtm` |
| Rohan | `goal-loop` |
| Rohan | `backtest-harness` |
| Rohan | `market-risk-limit-check` |
| Rohan | `event-triage` |
| Rohan | `conduct-risk-events` |
| Mira | `obligations-snapshot` |
| Mira | `citation-gate` |
| Mira | `goal-loop` |
| Mira | `m1-regulator-citation-urns` |
| Mira | `kyc-onboarding-gateway` |
| Mira | `sanctions-gateway-check` |
| Mira | `counterparty-eligibility-check` |
| Mira | `event-triage` |
| Senna | `security-substrate-state` |
| Senna | `goal-loop` |
| Senna | `m1-trading-stack-threat-model` |
| Senna | `event-triage` |
| Zara | `mlro-supervision` |
| Zara | `goal-loop` |
| Zara | `event-triage` |
| Thandiwe | `audit-committee-prep` |
| Thandiwe | `goal-loop` |
| Thandiwe | `event-triage` |
| Rashida | `goal-loop` |
| Rashida | `cyber-resilience-snapshot` |
| Rashida | `event-triage` |
| Iris | `popia-controls-snapshot` |
| Iris | `goal-loop` |
| Iris | `event-triage` |
| Eitan | `liquidity-snapshot` |
| Eitan | `goal-loop` |
| Eitan | `event-triage` |
| Env | `readiness` |
| Saskia | `markets-readiness-snapshot` |
| Saskia | `goal-loop` |
| Saskia | `event-triage` |
| Kai | `m1-cdm-typescript-bindings` |
| Kai | `pre-trade-gateway-aggregator` |
| Kai | `identity-gateway-check` |
| Kai | `suitability-gateway-check` |
| Kai | `credit-capital-funding-check` |
| Kai | `goal-loop` |
| Kai | `event-triage` |
| Yael | `tax-readiness` |
| Yael | `event-triage` |
| Tomas | `payments-readiness` |
| Tomas | `daily-reconciliation` |
| Tomas | `goal-loop` |
| Tomas | `event-triage` |
| Imani | `legal-readiness` |
| Imani | `goal-loop` |
| Imani | `event-triage` |
| Ravi | `alm-readiness` |
| Ravi | `ftp-curve-publish` |
| Ravi | `ftp-attribution` |
| Ravi | `alm-run` |
| Ravi | `intraday-stress` |
| Ravi | `jibar-fixing-ingest` |
| Ravi | `jibar-swap-curve-ingest` |
| Ravi | `repo-rate-ingest` |
| Ravi | `goal-loop` |
| Ravi | `event-triage` |
| Sade | `agentops-readiness` |
| Sade | `token-usage-analysis` |
| Sade | `efficiency-advisory` |
| Sade | `fleet-optimisation` |
| Sade | `event-triage` |
| Sade | `agent-retirement` |
| PAX | `role-research-queue` |
| PAX | `event-triage` |
| Nadia | `event-triage` |
| Nadia | `validation-cycle` |
| Niko | `event-triage` |
| Niko | `client-lifecycle` |
| Noa | `feature-shipped` |
| Noa | `design-review-complete` |
| Noa | `ux-finding-raised` |
| Noa | `ops-cycle` |
| Linnea | `event-triage` |
| Linnea | `ops-cycle` |
| Nolan | `event-triage` |
| Nolan | `hiring-cycle` |

## Substrate gaps

Tracked engineering items that block agents from running fully autonomously. Each closes when the corresponding substrate work lands.

- Event store: cloud-shared via Neon Postgres (`BANK_EVENT_DB_URL`); local sqlite remains canonical-shape on every host. Bidirectional sync runs before/after every agent workflow via `bun run event-store:sync`. Senna threat model APPROVED for build-phase use under exception `TM-NEON-EVENT-STORE-001` (Owen's substrate-exception register). Hardening conditions §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) deferred while events remain non-sensitive; required before any sensitive-data event flows. M8 cloud lift swaps Neon for Neon-on-Azure or Azure Postgres without code change.
- Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised — DEFINED in `platform/event-store/event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Atlas now emits one RiskRaised per substrate gap on his weekly run, exercising the schema. The remaining three types are available for handlers to adopt as their decision / escalation / workstream paths are wired; Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.
- Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).
- Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.
- Projection-cache persistence: closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives the dashboard projection from canonical sources + the live event store and writes it to the runtime cache `prototype/.local/dashboard-state.json` (gitignored). D-EVENT-STORE-SCALING Slice 3a (PR #138, 2026-05-10) split this runtime path off the previously-committed seed; Slice 3b (same day) removed the seed from the commit graph entirely — the recon harness now derives + asserts internal consistency at recon time rather than comparing against a stored cache.
- Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).
- GitHub Actions cron unreliability — interim substrate. GH Actions silently dropped Anya 03:00 UTC + Scrooge 04:00 UTC daily slots overnight 2026-05-07/08; Vera 02:00 UTC fired 2h46m late. All ten scheduled workflows re-pinned 2026-05-08 to off-the-hour distinct minutes (Vera 02:13, Anya 03:17, Scrooge 04:27, Helena 04:30, Devon Mon 05:23, Zara Mon 05:30, Atlas Mon 06:19, Owen Tue 07:31, Mira Wed 07:29, Senna Thu 07:37). Permanent fix is A2.1 — substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process — at which point cron files become thin shims or retire entirely.

## Atlas's narrative

The substrate is dense and largely load-bearing: 129,734 events across 187 types, 31/31 personas specced, 130 runtime handlers registered across all named agents, and the seven planned Claude-narrative integrations rolled out. The headline state is that the core write-side is no longer the constraint — schemas are typed, scheduled/event-driven/on-request triggers are first-class, projections derive cleanly from the event store, and the Neon-shared event DB has Senna's approval under `TM-NEON-EVENT-STORE-001`. What is closing is observability of agent reasoning itself: `AgentGoalEvaluated` (547), `AgentGoalSelected` (139), `AgentGoalDeferred` (408), `AgentPerformanceEvaluated` (153) and `AgentPromptOptimizationApplied` (13) are now emitting at volume, giving Sade real substrate to optimise against. What is blocking is the Neon hardening conditions §5.1/§5.2 — required before any sensitive-data event flows, which gates several downstream payload designs.

The consequential changes this cycle: (1) the M1 close-the-books arc landed end-to-end — `PnLFlashRecorded`, `PnLFlashActualReconciled`, `PnLAttributionGenerated` (9), `PnLAttributionExceptionRaised`, `PnLCommentaryRecorded`, `PnLSignedOff`, `AccountingPeriodClosed`, and `BalanceSheetSubstantiationCompleted` (14) are all now first-emission types, with Bea's `period-close` and `product-control-daily` handlers wired in; (2) the prudent valuation / model risk lane came online — `ValuationAdjustmentComputed` (24), `PrudentValuationAvaAggregated`, `ModelSubmitted`/`ModelTierClassified`/`ModelValidationApproved`/`ValidationFindingRaised`/`ValidationMethodologyPublished` under Nadia's `validation-cycle`; (3) `AgentEscalationDecided` (14) now closes the loop against `AgentEscalation` (78) — the escalation lifecycle has a terminating event type for the first time.

Ranked by downstream load: the **Owner Inbox at 537 deliverables** is the single largest blockage — Scrooge has `inbox-hygiene` and `owner-inbox-archiver` running but the backlog is growing faster than triage, and most of what should be human-decision substrate is silting up there rather than flowing back as `AgentDecision` (only 5) or `Decision` events tied to escalations. Second, **`AgentEscalation` payload-schema adoption remains partial** — the type is defined and 78 events exist, with 14 now `AgentEscalationDecided`, but Vera's audit pipelines #14/#15 still need every handler's escalation path to use the typed factory before they can run cleanly. Third, **GH Actions cron drift** is still interim substrate — `ScheduledTrigger` (647) is emitting and proves the shape works, but cron files remain the trigger of record until A2.1 lands a Bun-process scheduler; every silent cron miss is an unbacked claim about a daily run.

What the substrate needs next: drain the Owner Inbox via a typed decision-routing path (Scrooge `follow-on-router` → `AgentDecision`/`Decision`), then retire cron in favour of the `ScheduledTrigger`-emitting Bun scheduler.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
