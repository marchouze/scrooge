---
agent: Atlas
trigger: substrate-state
asOf: 2026-06-19T08:00:35.147Z
decision-required: false
---

# Atlas — substrate state, 2026-06-19

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 129917 events across 177 types; 31/31 personas have operating specs; 144 runtime handlers registered; 850 files in /Owner Inbox/; 14 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 129917

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `SubstrateAgentRunStarted` | 20993 | 2026-05-26 | 2026-06-19 |
| `SubstrateAgentRunCompleted` | 20820 | 2026-05-26 | 2026-06-19 |
| `BusDispatched` | 19579 | 2026-05-25 | 2026-06-19 |
| `LegacyFanoutShadowed` | 15950 | 2026-05-26 | 2026-06-19 |
| `ProvenanceReclassified` | 11479 | 2026-05-27 | 2026-06-12 |
| `DashboardProjectionRefreshed` | 4409 | 2026-05-26 | 2026-06-19 |
| `WorkstreamRegistered` | 4228 | 2026-05-07 | 2026-06-19 |
| `RecordFiled` | 2983 | 2026-05-05 | 2026-06-19 |
| `Decision` | 2879 | 2026-04-30 | 2026-06-19 |
| `CalculationPerformed` | 2817 | 2026-06-01 | 2026-06-19 |
| `ObligationAdopted` | 2590 | 2026-06-04 | 2026-06-15 |
| `SubstrateAlert` | 2183 | 2025-01-01 | 2026-06-19 |
| `ScheduledTrigger` | 1396 | 2026-05-26 | 2026-06-19 |
| `RiskRaised` | 1225 | 2026-05-07 | 2026-06-02 |
| `AgentGoalEvaluated` | 1142 | 2026-05-26 | 2026-06-19 |
| `ReconResult` | 1017 | 2026-05-07 | 2026-06-19 |
| `AgentRunCompleted` | 854 | 2026-05-10 | 2026-06-19 |
| `AgentRunStarted` | 833 | 2026-05-10 | 2026-06-19 |
| `ApplicabilityAssessmentRequested` | 732 | 2026-06-13 | 2026-06-15 |
| `ApplicabilityAssessmentPerformed` | 732 | 2026-06-13 | 2026-06-15 |
| `ApplicabilityAssessmentConcluded` | 732 | 2026-06-13 | 2026-06-15 |
| `AgentPerformanceEvaluated` | 713 | 2026-05-28 | 2026-06-19 |
| `AgentFeedbackIssued` | 713 | 2026-05-28 | 2026-06-19 |
| `AgentGoalSelected` | 645 | 2026-05-26 | 2026-06-19 |
| `AgentBriefIssued` | 611 | 2026-05-10 | 2026-06-19 |
| `MarketsProjectionRefreshed` | 555 | 2026-05-09 | 2026-05-09 |
| `IdentityKeyRotated` | 547 | 2026-05-27 | 2026-06-14 |
| `SubstrateStateSnapshot` | 505 | 2026-05-07 | 2026-06-19 |
| `AgentGoalDeferred` | 497 | 2026-05-26 | 2026-06-19 |
| `ObligationReviewCompleted` | 454 | 2026-06-09 | 2026-06-10 |
| `PermissionPolicyPublished` | 411 | 2026-05-26 | 2026-06-14 |
| `DecisionDistilled` | 299 | 2026-06-12 | 2026-06-15 |
| `AuditFindingClosed` | 239 | 2026-06-02 | 2026-06-10 |
| `AuditFinding` | 228 | 2026-05-07 | 2026-06-13 |
| `ProductDimensionAttested` | 224 | 2026-05-26 | 2026-06-17 |
| `M1CitationTrancheRegistered` | 172 | 2026-05-09 | 2026-05-09 |
| `IRRBBChecked` | 170 | 2026-06-02 | 2026-06-19 |
| `SubstrateAgentRunFailed` | 168 | 2026-05-26 | 2026-06-09 |
| `IntradayHQLAStressProjection` | 136 | 2026-06-02 | 2026-06-19 |
| `DecisionRequested` | 129 | 2026-05-10 | 2026-05-10 |
| `IntradayLiquidityReported` | 98 | 2026-06-11 | 2026-06-19 |
| `ConflictOfInterestDisclosed` | 97 | 2026-05-17 | 2026-06-11 |
| `PartyAttributeChanged` | 92 | 2026-06-01 | 2026-06-14 |
| `LiquidityLimitBreached` | 86 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 86 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 86 | 2026-05-10 | 2026-05-10 |
| `AgentRegistered` | 68 | 2026-05-26 | 2026-06-13 |
| `DataProjectionSnapshot` | 67 | 2026-05-07 | 2026-06-19 |
| `InboxHygieneSweep` | 67 | 2026-05-07 | 2026-06-19 |
| `AgentEscalation` | 66 | 2026-05-07 | 2026-06-12 |
| `PartyRegistered` | 65 | 2026-05-23 | 2026-06-01 |
| `ProvisionScopeAdopted` | 63 | 2026-06-11 | 2026-06-12 |
| `DecisionImpactSweepRequested` | 62 | 2026-06-13 | 2026-06-19 |
| `DecisionImpactAssessed` | 62 | 2026-06-13 | 2026-06-19 |
| `DailyPnLReportGenerated` | 58 | 2026-06-14 | 2026-06-19 |
| `SlaRulePublished` | 53 | 2026-01-01 | 2026-06-06 |
| `SlaRuleApproved` | 53 | 2026-01-01 | 2026-06-06 |
| `RiskAppetiteSnapshot` | 49 | 2026-05-27 | 2026-06-19 |
| `ClientCandidateRegistered` | 48 | 2026-06-01 | 2026-06-01 |
| `BriefSuperseded` | 47 | 2026-05-10 | 2026-05-31 |
| `ObligationsRegisterSnapshot` | 44 | 2026-05-07 | 2026-06-17 |
| `SecuritySubstrateSnapshot` | 44 | 2026-05-07 | 2026-06-18 |
| `BestExecutionVerified` | 44 | 2026-06-11 | 2026-06-11 |
| `FaisClassificationSuitabilityChecked` | 44 | 2026-06-11 | 2026-06-11 |
| `PaNotificationSubmitted` | 43 | 2026-05-11 | 2026-05-11 |
| `GovernanceCyclePrep` | 42 | 2026-05-07 | 2026-06-17 |
| `ALMReadinessSnapshot` | 41 | 2026-05-29 | 2026-06-19 |
| `FtpCurvePublished` | 38 | 2026-05-26 | 2026-06-19 |
| `PostureRegistered` | 38 | 2026-06-12 | 2026-06-15 |
| `PostureActivated` | 38 | 2026-06-12 | 2026-06-15 |
| `AccountingReadinessSnapshot` | 36 | 2026-05-26 | 2026-06-19 |
| `PartyRelationshipAsserted` | 36 | 2026-06-01 | 2026-06-01 |
| `LiquiditySnapshot` | 34 | 2026-06-02 | 2026-06-19 |
| `ModelValidationApproved` | 33 | 2026-05-27 | 2026-06-18 |
| `RiskRunCompleted` | 32 | 2026-06-02 | 2026-06-19 |
| `ModelSubmitted` | 26 | 2026-05-27 | 2026-05-29 |
| `ModelTierClassified` | 26 | 2026-05-27 | 2026-05-29 |
| `KYCIdentityCollected` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCIdentityVerified` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCSanctionsPEPScreened` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCUBOResolved` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCRiskRated` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCDecisionMade` | 26 | 2026-06-01 | 2026-06-01 |
| `ClientAccepted` | 26 | 2026-06-01 | 2026-06-01 |
| `LawfulProcessingRegistered` | 26 | 2026-06-01 | 2026-06-01 |
| `LCRComputed` | 26 | 2026-06-02 | 2026-06-19 |
| `NSFRComputed` | 26 | 2026-06-02 | 2026-06-19 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `OfficialMarkAdopted` | 24 | 2026-06-15 | 2026-06-18 |
| `ObligationEquivalenceClassified` | 22 | 2026-06-09 | 2026-06-09 |
| `PaymentsReadinessSnapshot` | 21 | 2026-05-29 | 2026-06-19 |
| `ISDACSAAssessmentCompleted` | 21 | 2026-05-20 | 2026-06-11 |
| `AgentEscalationDecided` | 20 | 2026-05-26 | 2026-06-12 |
| `CounterpartyFaisClassified` | 19 | 2026-06-11 | 2026-06-11 |
| `LegalDocumentationSigned` | 19 | 2026-06-12 | 2026-06-12 |
| `CounterpartyEligibilityScreened` | 19 | 2026-06-12 | 2026-06-12 |
| `SanctionsClearancePassed` | 19 | 2026-06-12 | 2026-06-12 |
| `RegulatorySourceReviewed` | 19 | 2026-06-15 | 2026-06-15 |
| `CounterpartyBaselClassAssigned` | 18 | 2026-06-11 | 2026-06-11 |
| `ValuationAdjustmentComputed` | 18 | 2026-06-15 | 2026-06-18 |
| `ALMRunCompleted` | 17 | 2026-06-02 | 2026-06-19 |
| `CollateralInventorySnapshotted` | 17 | 2026-06-02 | 2026-06-19 |
| `ValidationFindingRaised` | 16 | 2026-05-27 | 2026-06-18 |
| `IntradayLiquidityMetricsComputed` | 14 | 2026-06-11 | 2026-06-19 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `FinancialInstrumentDefined` | 13 | 2026-06-02 | 2026-06-02 |
| `MarketRiskMeasureComputed` | 13 | 2026-06-03 | 2026-06-19 |
| `EntityReclassified` | 13 | 2026-06-11 | 2026-06-11 |
| `ProductApproved` | 11 | 2026-05-26 | 2026-06-17 |
| `InboundMessageReceived` | 11 | 2026-06-01 | 2026-06-02 |
| `ProductProposalRegistered` | 10 | 2026-05-26 | 2026-06-17 |
| `ProductConceptualised` | 10 | 2026-05-26 | 2026-06-17 |
| `ProductDueDiligenceCompleted` | 10 | 2026-05-26 | 2026-06-17 |
| `MessageCorrelated` | 10 | 2026-06-01 | 2026-06-02 |
| `BalanceSheetProjected` | 9 | 2026-05-27 | 2026-06-19 |
| `FinancialInstrumentClassified` | 9 | 2026-06-02 | 2026-06-02 |
| `DailyReconciliationReport` | 9 | 2026-06-10 | 2026-06-19 |
| `ObligationLifecycleTransitioned` | 8 | 2026-06-04 | 2026-06-12 |
| `DecisionComment` | 8 | 2026-06-05 | 2026-06-19 |
| `CsiCategoryRegistered` | 8 | 2026-06-13 | 2026-06-13 |
| `ProductWithheld` | 8 | 2026-06-15 | 2026-06-18 |
| `RiskResolved` | 7 | 2026-06-02 | 2026-06-02 |
| `AgentOpsReadinessSnapshot` | 6 | 2026-05-26 | 2026-06-19 |
| `FilInstrumentCreated` | 6 | 2026-06-01 | 2026-06-03 |
| `MLROAttestation` | 5 | 2026-05-26 | 2026-06-15 |
| `CdmBindingsRegenerated` | 5 | 2026-05-26 | 2026-06-15 |
| `AgentDecision` | 5 | 2026-05-28 | 2026-06-05 |
| `DocumentRegistered` | 5 | 2026-06-09 | 2026-06-09 |
| `ContextPackBuilt` | 5 | 2026-06-15 | 2026-06-15 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `LegalReadinessSnapshot` | 4 | 2026-05-29 | 2026-06-19 |
| `OperationalResilienceSnapshot` | 4 | 2026-05-29 | 2026-06-15 |
| `CyberResilienceSnapshot` | 4 | 2026-05-29 | 2026-06-18 |
| `POPIAControlsSnapshot` | 4 | 2026-05-29 | 2026-06-17 |
| `AuditCommitteePackPrepped` | 4 | 2026-05-29 | 2026-06-17 |
| `TaxReadinessSnapshot` | 4 | 2026-05-29 | 2026-06-18 |
| `MarketsReadinessSnapshot` | 4 | 2026-05-29 | 2026-06-15 |
| `CcrReplacementCostComputed` | 4 | 2026-06-11 | 2026-06-13 |
| `MarketsProjectionRegistered` | 3 | 2026-05-09 | 2026-05-09 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `RoleResearchQueueSnapshot` | 3 | 2026-05-29 | 2026-06-12 |
| `EvalRunCompleted` | 3 | 2026-06-13 | 2026-06-14 |
| `RegulatoryInstrumentRegistered` | 3 | 2026-06-15 | 2026-06-15 |
| `MtmRunCompleted` | 3 | 2026-06-15 | 2026-06-18 |
| `PrudentValuationAvaAggregated` | 3 | 2026-06-15 | 2026-06-18 |
| `PnLAttributionGenerated` | 3 | 2026-06-15 | 2026-06-18 |
| `PnLFlashRecorded` | 3 | 2026-06-15 | 2026-06-18 |
| `PnLFlashActualReconciled` | 3 | 2026-06-15 | 2026-06-18 |
| `PnLSignedOff` | 3 | 2026-06-15 | 2026-06-18 |
| `EntityFunctionalCurrencyAssigned` | 3 | 2026-06-16 | 2026-06-16 |
| `RasLimitSchedulePublished` | 2 | 2026-05-14 | 2026-05-21 |
| `RasLineCalibrated` | 2 | 2026-05-10 | 2026-06-13 |
| `OutboundMessageDispatched` | 2 | 2026-06-01 | 2026-06-02 |
| `FinancialPositionSnapshot` | 2 | 2026-06-08 | 2026-06-15 |
| `BestExecutionPolicySchedule` | 2 | 2026-06-12 | 2026-06-15 |
| `CreditLimitLoaded` | 2 | 2026-05-20 | 2026-05-20 |
| `ExamSetRegistered` | 2 | 2026-06-14 | 2026-06-14 |
| `CreditLimitApproved` | 2 | 2026-05-20 | 2026-05-20 |
| `CreditLimitLoadedV2` | 2 | 2026-05-20 | 2026-05-20 |
| `CreditLimitApprovedV2` | 2 | 2026-05-20 | 2026-05-20 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `PartyClassified` | 1 | 2026-06-01 | 2026-06-01 |
| `SeedDescoped` | 1 | 2026-06-01 | 2026-06-01 |
| `CapitalEvent` | 1 | 2026-06-01 | 2026-06-01 |
| `LCRRatioProjection` | 1 | 2026-06-02 | 2026-06-02 |
| `AccountingPeriodOpened` | 1 | 2026-06-02 | 2026-06-02 |
| `BankModePolicySet` | 1 | 2026-06-03 | 2026-06-03 |
| `ProductRetired` | 1 | 2026-06-10 | 2026-06-10 |
| `ProductVersionPublished` | 1 | 2026-06-11 | 2026-06-11 |
| `WorkstreamCompleted` | 1 | 2026-06-10 | 2026-06-10 |
| `ThreatModelGateDecision` | 1 | 2026-06-12 | 2026-06-12 |
| `FilModelImplementationDeclared` | 1 | 2026-06-13 | 2026-06-13 |
| `FilInstrumentTerminated` | 1 | 2026-06-03 | 2026-06-03 |
| `RwaComputedV2` | 1 | 2026-06-01 | 2026-06-01 |
| `ValidationFindingClosed` | 1 | 2026-06-18 | 2026-06-18 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

144 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

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
| Bea | `gl-posting-engine` |
| Bea | `m1-ifrs-classification-rules` |
| Bea | `event-triage` |
| Bea | `period-close` |
| Bea | `ba310-period-close` |
| Bea | `ba300-lcr-period-close` |
| Bea | `rwa-period-close` |
| Bea | `ba700-period-close` |
| Bea | `ba400-period-close` |
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
| Owen | `decision-impact-sweep` |
| Rohan | `risk-run` |
| Rohan | `daily-mtm` |
| Rohan | `market-risk-measure` |
| Rohan | `sa-ccr-eod` |
| Rohan | `goal-loop` |
| Rohan | `backtest-harness` |
| Rohan | `market-risk-limit-check` |
| Rohan | `event-triage` |
| Rohan | `conduct-risk-events` |
| Rohan | `conduct-surveillance-sweep` |
| Mira | `obligations-snapshot` |
| Mira | `citation-gate` |
| Mira | `goal-loop` |
| Mira | `m1-regulator-citation-urns` |
| Mira | `kyc-onboarding-gateway` |
| Mira | `sanctions-gateway-check` |
| Mira | `counterparty-eligibility-check` |
| Mira | `event-triage` |
| Mira | `ba330-period-close` |
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
| Ravi | `intraday-liquidity-metrics` |
| Ravi | `cfp-ewi-monitor` |
| Ravi | `jibar-fixing-ingest` |
| Ravi | `jibar-swap-curve-ingest` |
| Ravi | `repo-rate-ingest` |
| Ravi | `zaronia-ingest` |
| Ravi | `sagb-yield-ingest` |
| Ravi | `goal-loop` |
| Ravi | `event-triage` |
| Ravi | `balance-sheet-projector` |
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
- Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised + closure family (RiskResolved / RiskAccepted / RiskMitigated) — DEFINED in `platform/event-store/event-types/risk.ts` + `.../event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Substrate gaps surface on the SubstrateStateSnapshot `gaps[]` status inventory + per-gap WorkstreamRegistered events; they are NOT risk-register findings, so Atlas no longer emits RiskRaised for them (WS-RISK-REGISTER-CLOSURE). The closure family lets goal-loops resolve a risk register by riskId pairing. Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.
- Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).
- Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.
- Projection-cache persistence: closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives the dashboard projection from canonical sources + the live event store and writes it to the runtime cache `prototype/.local/dashboard-state.json` (gitignored). D-EVENT-STORE-SCALING Slice 3a (PR #138, 2026-05-10) split this runtime path off the previously-committed seed; Slice 3b (same day) removed the seed from the commit graph entirely — the recon harness now derives + asserts internal consistency at recon time rather than comparing against a stored cache.
- Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).
- GitHub Actions cron unreliability — interim substrate. GH Actions silently dropped Anya 03:00 UTC + Scrooge 04:00 UTC daily slots overnight 2026-05-07/08; Vera 02:00 UTC fired 2h46m late. All ten scheduled workflows re-pinned 2026-05-08 to off-the-hour distinct minutes (Vera 02:13, Anya 03:17, Scrooge 04:27, Helena 04:30, Devon Mon 05:23, Zara Mon 05:30, Atlas Mon 06:19, Owen Tue 07:31, Mira Wed 07:29, Senna Thu 07:37). Permanent fix is A2.1 — substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process — at which point cron files become thin shims or retire entirely.
- prd:bank:equity:jse-equity-cash (JSE listed cash equity, M1) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle (incl. data-quality dimension, no design-attested-without-tracked-gaps) before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.
- prd:bank:bond:sagb-fixed-coupon (SAGB fixed-coupon bond) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.
- prd:bank:bond:open-repo-gmra (open repo under GMRA) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.
- prd:bank:ird:vanilla-zar-fix-zaronia (vanilla ZAR fixed-vs-ZARONIA IRS) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.
- prd:bank:treasury:repo-sagb-term (SAGB-backed term repo, M5) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.
- prd:bank:treasury:mmd-deposit (Money Market Deposit, M6) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.
- prd:bank:treasury:funding-line (Committed Funding Line, M7) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.

## Atlas's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CcCGRi7CFVqb6LJEDqxBG"})._

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
