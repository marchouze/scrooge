---
agent: Atlas
trigger: substrate-state
asOf: 2026-06-15T23:00:01.055Z
decision-required: false
---

# Atlas — substrate state, 2026-06-15

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 114429 events across 168 types; 31/31 personas have operating specs; 144 runtime handlers registered; 794 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 114429

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `SubstrateAgentRunStarted` | 18192 | 2026-05-26 | 2026-06-15 |
| `SubstrateAgentRunCompleted` | 18019 | 2026-05-26 | 2026-06-15 |
| `BusDispatched` | 16778 | 2026-05-25 | 2026-06-15 |
| `LegacyFanoutShadowed` | 13307 | 2026-05-26 | 2026-06-15 |
| `ProvenanceReclassified` | 11479 | 2026-05-27 | 2026-06-12 |
| `DashboardProjectionRefreshed` | 3750 | 2026-05-26 | 2026-06-15 |
| `WorkstreamRegistered` | 3622 | 2026-05-07 | 2026-06-15 |
| `Decision` | 2808 | 2026-04-30 | 2026-06-15 |
| `RecordFiled` | 2642 | 2026-05-05 | 2026-06-15 |
| `ObligationAdopted` | 2520 | 2026-06-04 | 2026-06-15 |
| `CalculationPerformed` | 2181 | 2026-06-01 | 2026-06-14 |
| `SubstrateAlert` | 1576 | 2025-01-01 | 2026-06-15 |
| `ScheduledTrigger` | 1238 | 2026-05-26 | 2026-06-15 |
| `RiskRaised` | 1225 | 2026-05-07 | 2026-06-02 |
| `AgentGoalEvaluated` | 1040 | 2026-05-26 | 2026-06-15 |
| `ReconResult` | 945 | 2026-05-07 | 2026-06-15 |
| `ApplicabilityAssessmentRequested` | 732 | 2026-06-13 | 2026-06-15 |
| `ApplicabilityAssessmentPerformed` | 732 | 2026-06-13 | 2026-06-15 |
| `ApplicabilityAssessmentConcluded` | 732 | 2026-06-13 | 2026-06-15 |
| `AgentRunCompleted` | 711 | 2026-05-10 | 2026-06-15 |
| `AgentRunStarted` | 691 | 2026-05-10 | 2026-06-15 |
| `AgentPerformanceEvaluated` | 589 | 2026-05-28 | 2026-06-15 |
| `AgentFeedbackIssued` | 589 | 2026-05-28 | 2026-06-15 |
| `AgentGoalSelected` | 567 | 2026-05-26 | 2026-06-15 |
| `MarketsProjectionRefreshed` | 555 | 2026-05-09 | 2026-05-09 |
| `IdentityKeyRotated` | 547 | 2026-05-27 | 2026-06-14 |
| `AgentBriefIssued` | 546 | 2026-05-10 | 2026-06-15 |
| `AgentGoalDeferred` | 473 | 2026-05-26 | 2026-06-15 |
| `ObligationReviewCompleted` | 454 | 2026-06-09 | 2026-06-10 |
| `SubstrateStateSnapshot` | 452 | 2026-05-07 | 2026-06-15 |
| `PermissionPolicyPublished` | 411 | 2026-05-26 | 2026-06-14 |
| `DecisionDistilled` | 299 | 2026-06-12 | 2026-06-15 |
| `AuditFindingClosed` | 239 | 2026-06-02 | 2026-06-10 |
| `AuditFinding` | 228 | 2026-05-07 | 2026-06-13 |
| `ProductDimensionAttested` | 206 | 2026-05-26 | 2026-06-15 |
| `M1CitationTrancheRegistered` | 172 | 2026-05-09 | 2026-05-09 |
| `SubstrateAgentRunFailed` | 168 | 2026-05-26 | 2026-06-09 |
| `IRRBBChecked` | 140 | 2026-06-02 | 2026-06-15 |
| `DecisionRequested` | 129 | 2026-05-10 | 2026-05-10 |
| `IntradayHQLAStressProjection` | 112 | 2026-06-02 | 2026-06-15 |
| `ConflictOfInterestDisclosed` | 97 | 2026-05-17 | 2026-06-11 |
| `PartyAttributeChanged` | 92 | 2026-06-01 | 2026-06-14 |
| `LiquidityLimitBreached` | 86 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 86 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 86 | 2026-05-10 | 2026-05-10 |
| `IntradayLiquidityReported` | 77 | 2026-06-11 | 2026-06-15 |
| `AgentRegistered` | 68 | 2026-05-26 | 2026-06-13 |
| `AgentEscalation` | 66 | 2026-05-07 | 2026-06-12 |
| `PartyRegistered` | 65 | 2026-05-23 | 2026-06-01 |
| `DataProjectionSnapshot` | 64 | 2026-05-07 | 2026-06-15 |
| `InboxHygieneSweep` | 64 | 2026-05-07 | 2026-06-15 |
| `ProvisionScopeAdopted` | 63 | 2026-06-11 | 2026-06-12 |
| `SlaRulePublished` | 52 | 2026-01-01 | 2026-06-06 |
| `SlaRuleApproved` | 52 | 2026-01-01 | 2026-06-06 |
| `ClientCandidateRegistered` | 48 | 2026-06-01 | 2026-06-01 |
| `BriefSuperseded` | 47 | 2026-05-10 | 2026-05-31 |
| `BestExecutionVerified` | 44 | 2026-06-11 | 2026-06-11 |
| `FaisClassificationSuitabilityChecked` | 44 | 2026-06-11 | 2026-06-11 |
| `PaNotificationSubmitted` | 43 | 2026-05-11 | 2026-05-11 |
| `ObligationsRegisterSnapshot` | 43 | 2026-05-07 | 2026-06-10 |
| `SecuritySubstrateSnapshot` | 43 | 2026-05-07 | 2026-06-11 |
| `RiskAppetiteSnapshot` | 43 | 2026-05-27 | 2026-06-15 |
| `GovernanceCyclePrep` | 41 | 2026-05-07 | 2026-06-09 |
| `PostureRegistered` | 38 | 2026-06-12 | 2026-06-15 |
| `PostureActivated` | 38 | 2026-06-12 | 2026-06-15 |
| `PartyRelationshipAsserted` | 36 | 2026-06-01 | 2026-06-01 |
| `ALMReadinessSnapshot` | 35 | 2026-05-29 | 2026-06-15 |
| `AccountingReadinessSnapshot` | 33 | 2026-05-26 | 2026-06-15 |
| `FtpCurvePublished` | 33 | 2026-05-26 | 2026-06-15 |
| `ModelValidationApproved` | 32 | 2026-05-27 | 2026-06-13 |
| `DecisionImpactSweepRequested` | 32 | 2026-06-13 | 2026-06-15 |
| `DecisionImpactAssessed` | 32 | 2026-06-13 | 2026-06-15 |
| `LiquiditySnapshot` | 28 | 2026-06-02 | 2026-06-15 |
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
| `RiskRunCompleted` | 26 | 2026-06-02 | 2026-06-15 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `ObligationEquivalenceClassified` | 22 | 2026-06-09 | 2026-06-09 |
| `ISDACSAAssessmentCompleted` | 21 | 2026-05-20 | 2026-06-11 |
| `AgentEscalationDecided` | 20 | 2026-05-26 | 2026-06-12 |
| `LCRComputed` | 20 | 2026-06-02 | 2026-06-15 |
| `NSFRComputed` | 20 | 2026-06-02 | 2026-06-15 |
| `CounterpartyFaisClassified` | 19 | 2026-06-11 | 2026-06-11 |
| `LegalDocumentationSigned` | 19 | 2026-06-12 | 2026-06-12 |
| `CounterpartyEligibilityScreened` | 19 | 2026-06-12 | 2026-06-12 |
| `SanctionsClearancePassed` | 19 | 2026-06-12 | 2026-06-12 |
| `RegulatorySourceReviewed` | 19 | 2026-06-15 | 2026-06-15 |
| `PaymentsReadinessSnapshot` | 18 | 2026-05-29 | 2026-06-15 |
| `CounterpartyBaselClassAssigned` | 18 | 2026-06-11 | 2026-06-11 |
| `ALMRunCompleted` | 14 | 2026-06-02 | 2026-06-15 |
| `CollateralInventorySnapshotted` | 14 | 2026-06-02 | 2026-06-15 |
| `ValidationFindingRaised` | 13 | 2026-05-27 | 2026-06-13 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `FinancialInstrumentDefined` | 13 | 2026-06-02 | 2026-06-02 |
| `EntityReclassified` | 13 | 2026-06-11 | 2026-06-11 |
| `InboundMessageReceived` | 11 | 2026-06-01 | 2026-06-02 |
| `IntradayLiquidityMetricsComputed` | 11 | 2026-06-11 | 2026-06-15 |
| `ProductApproved` | 10 | 2026-05-26 | 2026-06-11 |
| `MessageCorrelated` | 10 | 2026-06-01 | 2026-06-02 |
| `ProductProposalRegistered` | 9 | 2026-05-26 | 2026-06-10 |
| `ProductConceptualised` | 9 | 2026-05-26 | 2026-06-10 |
| `ProductDueDiligenceCompleted` | 9 | 2026-05-26 | 2026-06-10 |
| `FinancialInstrumentClassified` | 9 | 2026-06-02 | 2026-06-02 |
| `MarketRiskMeasureComputed` | 9 | 2026-06-03 | 2026-06-15 |
| `ObligationLifecycleTransitioned` | 8 | 2026-06-04 | 2026-06-12 |
| `CsiCategoryRegistered` | 8 | 2026-06-13 | 2026-06-13 |
| `OfficialMarkAdopted` | 8 | 2026-06-15 | 2026-06-15 |
| `RiskResolved` | 7 | 2026-06-02 | 2026-06-02 |
| `BalanceSheetProjected` | 6 | 2026-05-27 | 2026-06-15 |
| `DecisionComment` | 6 | 2026-06-05 | 2026-06-06 |
| `DailyReconciliationReport` | 6 | 2026-06-10 | 2026-06-15 |
| `ValuationAdjustmentComputed` | 6 | 2026-06-15 | 2026-06-15 |
| `MLROAttestation` | 5 | 2026-05-26 | 2026-06-15 |
| `CdmBindingsRegenerated` | 5 | 2026-05-26 | 2026-06-15 |
| `AgentOpsReadinessSnapshot` | 5 | 2026-05-26 | 2026-06-12 |
| `AgentDecision` | 5 | 2026-05-28 | 2026-06-05 |
| `DocumentRegistered` | 5 | 2026-06-09 | 2026-06-09 |
| `ContextPackBuilt` | 5 | 2026-06-15 | 2026-06-15 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `OperationalResilienceSnapshot` | 4 | 2026-05-29 | 2026-06-15 |
| `MarketsReadinessSnapshot` | 4 | 2026-05-29 | 2026-06-15 |
| `CcrReplacementCostComputed` | 4 | 2026-06-11 | 2026-06-13 |
| `MarketsProjectionRegistered` | 3 | 2026-05-09 | 2026-05-09 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `RoleResearchQueueSnapshot` | 3 | 2026-05-29 | 2026-06-12 |
| `LegalReadinessSnapshot` | 3 | 2026-05-29 | 2026-06-12 |
| `CyberResilienceSnapshot` | 3 | 2026-05-29 | 2026-06-11 |
| `POPIAControlsSnapshot` | 3 | 2026-05-29 | 2026-06-10 |
| `AuditCommitteePackPrepped` | 3 | 2026-05-29 | 2026-06-09 |
| `TaxReadinessSnapshot` | 3 | 2026-05-29 | 2026-06-11 |
| `EvalRunCompleted` | 3 | 2026-06-13 | 2026-06-14 |
| `DailyPnLReportGenerated` | 3 | 2026-06-14 | 2026-06-15 |
| `RegulatoryInstrumentRegistered` | 3 | 2026-06-15 | 2026-06-15 |
| `RasLimitSchedulePublished` | 2 | 2026-05-14 | 2026-05-21 |
| `RasLineCalibrated` | 2 | 2026-05-10 | 2026-06-13 |
| `OutboundMessageDispatched` | 2 | 2026-06-01 | 2026-06-02 |
| `FinancialPositionSnapshot` | 2 | 2026-06-08 | 2026-06-15 |
| `BestExecutionPolicySchedule` | 2 | 2026-06-12 | 2026-06-15 |
| `CreditLimitLoaded` | 2 | 2026-05-20 | 2026-05-20 |
| `ExamSetRegistered` | 2 | 2026-06-14 | 2026-06-14 |
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
| `MtmRunCompleted` | 1 | 2026-06-15 | 2026-06-15 |
| `PrudentValuationAvaAggregated` | 1 | 2026-06-15 | 2026-06-15 |
| `PnLAttributionGenerated` | 1 | 2026-06-15 | 2026-06-15 |
| `PnLFlashRecorded` | 1 | 2026-06-15 | 2026-06-15 |
| `PnLFlashActualReconciled` | 1 | 2026-06-15 | 2026-06-15 |
| `PnLSignedOff` | 1 | 2026-06-15 | 2026-06-15 |

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

## Atlas's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cc5snEyRxx7wWuNn8zTTj"})._

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
