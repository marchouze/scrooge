---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-28T08:21:18.097Z
decision-required: false
---

# Atlas — substrate state, 2026-05-28

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 103863 events across 158 types; 31/31 personas have operating specs; 125 runtime handlers registered; 483 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 103863

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 37591 | 2026-05-27 | 2026-05-28 |
| `InboundMessageReceived` | 13488 | 2026-05-23 | 2026-05-28 |
| `SubstrateAgentRunStarted` | 4313 | 2026-05-25 | 2026-05-28 |
| `BusDispatched` | 4273 | 2026-05-25 | 2026-05-28 |
| `SubstrateAgentRunCompleted` | 4186 | 2026-05-25 | 2026-05-28 |
| `GatewayCheckRequested` | 3580 | 2026-05-09 | 2026-05-20 |
| `SubLedgerPostingEmitted` | 2449 | 2026-05-09 | 2026-05-28 |
| `Decision` | 2395 | 2026-04-30 | 2026-05-28 |
| `GatewayCheckCompleted` | 2176 | 2026-05-17 | 2026-05-20 |
| `RiskRaised` | 1570 | 2025-12-01 | 2026-05-28 |
| `OrderProposed` | 1442 | 2026-05-09 | 2026-05-20 |
| `ISDACSAAssessmentCompleted` | 1358 | 2024-01-01 | 2026-05-20 |
| `CreditLimitLoaded` | 1200 | 2024-01-01 | 2026-05-21 |
| `CreditLimitApplicationSubmitted` | 1181 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 1181 | 2024-01-01 | 2026-05-20 |
| `LegacyFanoutShadowed` | 1011 | 2026-05-25 | 2026-05-28 |
| `RecordFiled` | 969 | 2026-05-05 | 2026-05-28 |
| `CreditAnalysisCompleted` | 902 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 902 | 2024-01-01 | 2026-05-20 |
| `CcrReplacementCostComputed` | 788 | 2026-05-18 | 2026-05-20 |
| `BacktestRequested` | 729 | 2026-01-10 | 2026-01-10 |
| `BacktestRun` | 686 | 2026-05-09 | 2026-05-09 |
| `FxTradeExecuted` | 653 | 2026-05-17 | 2026-05-28 |
| `SubstrateAlert` | 602 | 2025-01-01 | 2026-05-28 |
| `WorkstreamRegistered` | 552 | 2026-05-07 | 2026-05-28 |
| `MarketsProjectionRefreshed` | 510 | 2026-05-09 | 2026-05-09 |
| `ClientCandidateRegistered` | 489 | 2026-05-25 | 2026-05-28 |
| `ReconResult` | 486 | 2026-05-07 | 2026-05-28 |
| `ScheduledTrigger` | 463 | 2026-05-25 | 2026-05-28 |
| `CounterpartyFaisClassified` | 444 | 2026-05-01 | 2026-05-17 |
| `KYCIdentityCollected` | 437 | 2026-05-25 | 2026-05-28 |
| `KYCIdentityVerified` | 437 | 2026-05-25 | 2026-05-28 |
| `KYCSanctionsPEPScreened` | 437 | 2026-05-25 | 2026-05-28 |
| `KYCDecisionMade` | 436 | 2026-05-25 | 2026-05-28 |
| `OfficialMarkAdopted` | 405 | 2026-05-28 | 2026-05-28 |
| `FxPositionRevalued` | 405 | 2026-05-28 | 2026-05-28 |
| `ClientRejected` | 399 | 2026-05-25 | 2026-05-28 |
| `AgentGoalEvaluated` | 390 | 2026-05-25 | 2026-05-28 |
| `AgentGoalDeferred` | 339 | 2026-05-25 | 2026-05-28 |
| `DashboardProjectionRefreshed` | 334 | 2026-05-25 | 2026-05-28 |
| `KYCUBOResolved` | 317 | 2026-05-25 | 2026-05-28 |
| `KYCRiskRated` | 317 | 2026-05-25 | 2026-05-28 |
| `ClientAccepted` | 316 | 2026-05-13 | 2026-05-28 |
| `CcrEadComputed` | 303 | 2026-05-18 | 2026-05-20 |
| `FxSettlementInstructed` | 286 | 2026-05-23 | 2026-05-28 |
| `LawfulProcessingRegistered` | 277 | 2026-05-25 | 2026-05-28 |
| `AgentRunCompleted` | 214 | 2026-05-10 | 2026-05-28 |
| `AgentBriefIssued` | 213 | 2026-05-10 | 2026-05-28 |
| `AgentRunStarted` | 210 | 2026-05-10 | 2026-05-28 |
| `AuditFinding` | 177 | 2026-05-07 | 2026-05-27 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `M1CitationTrancheRegistered` | 164 | 2026-05-09 | 2026-05-09 |
| `IrsPositionRevalued` | 164 | 2026-05-19 | 2026-05-20 |
| `PermissionPolicyPublished` | 141 | 2026-05-25 | 2026-05-27 |
| `IRRBBChecked` | 130 | 2026-05-26 | 2026-05-28 |
| `DecisionRequested` | 123 | 2026-05-10 | 2026-05-10 |
| `EquityTradeBooked` | 123 | 2026-05-09 | 2026-05-09 |
| `IfrsClassificationApplied` | 123 | 2026-05-09 | 2026-05-09 |
| `IrsTradeBooked` | 123 | 2026-05-20 | 2026-05-20 |
| `SubstrateAgentRunFailed` | 122 | 2026-05-25 | 2026-05-28 |
| `KYCEDDInitiated` | 119 | 2026-05-25 | 2026-05-28 |
| `KYCEDDCompleted` | 119 | 2026-05-25 | 2026-05-28 |
| `CdmBindingsRegenerated` | 104 | 2026-05-09 | 2026-05-26 |
| `IntradayHQLAStressProjection` | 104 | 2026-05-26 | 2026-05-28 |
| `PrincipalPayment` | 102 | 2026-05-23 | 2026-05-28 |
| `OrderApprovedAtGateway` | 102 | 2026-05-17 | 2026-05-17 |
| `OrderRejectedAtGateway` | 102 | 2026-05-17 | 2026-05-17 |
| `IdentityKeyRotated` | 90 | 2026-05-25 | 2026-05-27 |
| `SettlementConfirmed` | 82 | 2026-05-19 | 2026-05-28 |
| `CreditLimitBreached` | 82 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 82 | 2026-05-23 | 2026-05-23 |
| `LiquidityLimitBreached` | 82 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 82 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 82 | 2026-05-10 | 2026-05-10 |
| `PartyRelationshipAsserted` | 77 | 2026-05-19 | 2026-05-26 |
| `AgentEscalation` | 77 | 2026-05-07 | 2026-05-28 |
| `DocumentRegistered` | 72 | 2026-05-11 | 2026-05-25 |
| `SubstrateStateSnapshot` | 69 | 2026-05-07 | 2026-05-28 |
| `MessageCorrelated` | 65 | 2026-05-23 | 2026-05-23 |
| `AgentPerformanceEvaluated` | 60 | 2026-05-25 | 2026-05-28 |
| `AgentFeedbackIssued` | 60 | 2026-05-25 | 2026-05-28 |
| `DailyPnLReportGenerated` | 57 | 2026-05-25 | 2026-05-28 |
| `SanctionsClearancePassed` | 52 | 2026-05-13 | 2026-05-13 |
| `PEPScreeningCompleted` | 52 | 2026-05-13 | 2026-05-13 |
| `BeneficialOwnerResolved` | 52 | 2026-05-13 | 2026-05-13 |
| `RiskRatingAssigned` | 52 | 2026-05-13 | 2026-05-13 |
| `ConflictOfInterestDisclosed` | 51 | 2026-05-17 | 2026-05-17 |
| `AgentGoalSelected` | 51 | 2026-05-25 | 2026-05-28 |
| `BestExecutionVerified` | 50 | 2026-05-17 | 2026-05-17 |
| `FxTradeCancelled` | 50 | 2026-05-21 | 2026-05-28 |
| `FaisClassificationSuitabilityChecked` | 45 | 2026-05-17 | 2026-05-17 |
| `BestExecutionBreached` | 43 | 2026-05-17 | 2026-05-17 |
| `DataProjectionSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `InboxHygieneSweep` | 43 | 2026-05-07 | 2026-05-28 |
| `AgentRegistered` | 42 | 2026-05-25 | 2026-05-27 |
| `CreditLimitAnnualReviewCompleted` | 41 | 2026-05-21 | 2026-05-21 |
| `LexUtilisationComputed` | 41 | 2026-05-20 | 2026-05-20 |
| `BriefSuperseded` | 41 | 2026-05-10 | 2026-05-10 |
| `EquitySettlementInstructed` | 41 | 2026-05-13 | 2026-05-13 |
| `PaNotificationSubmitted` | 41 | 2026-05-11 | 2026-05-11 |
| `CreditLimitWithdrawn` | 41 | 2026-05-12 | 2026-05-12 |
| `OrderAccepted` | 41 | 2026-05-13 | 2026-05-13 |
| `PopiaConsentRecorded` | 39 | 2026-05-13 | 2026-05-13 |
| `ObligationsRegisterSnapshot` | 38 | 2026-05-07 | 2026-05-28 |
| `SecuritySubstrateSnapshot` | 37 | 2026-05-07 | 2026-05-26 |
| `PartyRegistered` | 37 | 2026-05-23 | 2026-05-26 |
| `GovernanceCyclePrep` | 36 | 2026-05-07 | 2026-05-28 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `OutboundMessageDispatched` | 13 | 2026-05-23 | 2026-05-23 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `MtmRunCompleted` | 13 | 2026-05-26 | 2026-05-28 |
| `FtpCurvePublished` | 13 | 2026-05-26 | 2026-05-28 |
| `ALMRunCompleted` | 13 | 2026-05-26 | 2026-05-28 |
| `AgentEscalationDecided` | 13 | 2026-05-26 | 2026-05-28 |
| `EddInitiated` | 13 | 2026-05-13 | 2026-05-13 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `LCRComputed` | 12 | 2026-05-26 | 2026-05-28 |
| `NSFRComputed` | 12 | 2026-05-26 | 2026-05-28 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `AccountingReadinessSnapshot` | 11 | 2026-05-26 | 2026-05-28 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `CollateralInventorySnapshot` | 6 | 2026-05-26 | 2026-05-26 |
| `ModelValidationApproved` | 6 | 2026-05-27 | 2026-05-27 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `RiskAppetiteSnapshot` | 5 | 2026-05-27 | 2026-05-28 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `CounterpartyExposureCalculated` | 4 | 2026-05-18 | 2026-05-18 |
| `AgentDecision` | 3 | 2026-05-07 | 2026-05-28 |
| `ModelSubmitted` | 3 | 2026-05-27 | 2026-05-27 |
| `ModelTierClassified` | 3 | 2026-05-27 | 2026-05-27 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `CollateralInventorySnapshotted` | 3 | 2026-05-28 | 2026-05-28 |
| `LCRRatioProjection` | 3 | 2026-05-28 | 2026-05-28 |
| `MLROAttestation` | 2 | 2026-05-26 | 2026-05-26 |
| `AgentOpsReadinessSnapshot` | 2 | 2026-05-26 | 2026-05-26 |
| `ConductObligationFlagged` | 2 | 2026-05-17 | 2026-05-17 |
| `AccountingPeriodOpened` | 2 | 2026-05-01 | 2026-05-28 |
| `TrialBalanceSnapshotted` | 2 | 2026-05-15 | 2026-06-01 |
| `InterbankLoanPlaced` | 2 | 2026-05-27 | 2026-05-27 |
| `RegulatoryInstrumentRegistered` | 1 | 2026-05-25 | 2026-05-25 |
| `RegulatoryInstrumentContextualised` | 1 | 2026-05-25 | 2026-05-25 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `AccountingPeriodClosed` | 1 | 2026-06-01 | 2026-06-01 |
| `RepoTradeOpened` | 1 | 2026-05-27 | 2026-05-27 |
| `DepositTaken` | 1 | 2026-05-27 | 2026-05-27 |
| `FundingLineDrawn` | 1 | 2026-05-27 | 2026-05-27 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `LiquiditySnapshot` | 1 | 2026-05-28 | 2026-05-28 |
| `FXPositionBreach` | 1 | 2026-05-28 | 2026-05-28 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

125 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

| Agent | Trigger |
|---|---|
| Vera | `overnight-recon` |
| Vera | `codebase-quality-review` |
| Vera | `goal-loop` |
| Vera | `event-triage` |
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

The substrate is operationally dense and closing on coherence: 103,863 events across 158 types in the canonical store, 31/31 personas with operating specs, 125 registered runtime handlers, and the four typed payload schemas (`AgentEscalation`, `AgentDecision`, `WorkstreamRegistered`, `RiskRaised`) all defined and being emitted in anger. The Neon-shared event store is live under Senna's `TM-NEON-EVENT-STORE-001` exception, the Claude narrative path is rolled out to seven handlers, and the projection-cache seed has been removed from the commit graph entirely. What remains blocking is concentrated in two places: the absence of an in-substrate scheduler, and the still-thin coverage of decision/escalation/workstream lifecycle events relative to the volume of mechanical activity.

Three changes carry most of the weight since prior runs. First, `WorkstreamCompleted` has appeared in the store (7 events, all 2026-05-28) alongside the 552 `WorkstreamRegistered` events — the workstream lifecycle is now closed-loop in the substrate, which is what the dashboard's curated-seed retirement was waiting on. Second, `AgentEscalation` is at 77 events and `AgentEscalationDecided` at 13 — Vera's audit pipelines #14/#15 now have real substrate to consume rather than a schema with no emitters. Third, Sade's `AgentPromptOptimizationApplied` (13 events, 2026-05-27) and Nadia's model-validation chain (`ModelSubmitted`/`ModelTierClassified`/`ModelRegistered`/`ValidationMethodologyPublished`/`ModelValidationApproved`/`ValidationFindingRaised`) have all begun emitting — the agent-ops and model-risk loops are no longer paper.

Ranking the gaps by downstream impact: (1) The GH Actions cron interim is the highest-leverage remaining gap — 463 `ScheduledTrigger` events show the typed-trigger shape is proven in-process, but until A2.1 lands as a Bun-resident scheduler, every scheduled handler is exposed to the same silent-drop failure mode that hit Anya and Scrooge on 2026-05-08. (2) `AgentDecision` is still at 3 events against 2,395 generic `Decision` events and 390 `AgentGoalEvaluated` — the typed decision schema exists but the goal-loop handlers haven't migrated onto it, which leaves Owen's governance-cycle prep working off the untyped surface. (3) Neon hardening conditions §5.1 (role downgrade) and §5.2 (IP allowlist) remain deferred and become load-bearing the moment any sensitive-data event type is proposed — that's a gate, not a gap, but it will bind before M8.

Next: land A2.1 — the substrate-resident scheduler emitting typed `ScheduledTrigger` events — and retire the cron shims.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
