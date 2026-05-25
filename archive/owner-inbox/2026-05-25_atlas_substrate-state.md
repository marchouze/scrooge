---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-25T20:12:56.065Z
decision-required: false
---

# Atlas — substrate state, 2026-05-25

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 213116 events across 150 types; 31/31 personas have operating specs; 123 runtime handlers registered; 445 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `.local/event.db` · Total events: 213116

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `InboundMessageReceived` | 91732 | 2026-05-19 | 2026-05-25 |
| `ProvenanceReclassified` | 82550 | 2026-05-22 | 2026-05-25 |
| `EntityReclassified` | 11696 | 2026-05-22 | 2026-05-22 |
| `SubstrateAgentRunStarted` | 2198 | 2026-05-17 | 2026-05-25 |
| `BusDispatched` | 2172 | 2026-05-17 | 2026-05-25 |
| `SubstrateAgentRunCompleted` | 2068 | 2026-05-17 | 2026-05-25 |
| `SubLedgerPostingEmitted` | 1490 | 2026-05-09 | 2026-05-23 |
| `MessageCorrelated` | 1350 | 2026-05-19 | 2026-05-23 |
| `Decision` | 1104 | 2026-05-01 | 2026-05-25 |
| `GatewayCheckRequested` | 1034 | 2026-05-09 | 2026-05-21 |
| `RecordFiled` | 1020 | 2026-05-05 | 2026-05-25 |
| `SubstrateAlert` | 863 | 2025-01-01 | 2026-05-25 |
| `ScheduledTrigger` | 724 | 2026-05-17 | 2026-05-25 |
| `GatewayCheckCompleted` | 654 | 2026-05-17 | 2026-05-21 |
| `FxSettlementInstructed` | 596 | 2026-05-19 | 2026-05-25 |
| `PrincipalPayment` | 572 | 2026-05-19 | 2026-05-25 |
| `RiskRaised` | 532 | 2025-12-01 | 2026-05-20 |
| `FxTradeExecuted` | 457 | 2026-05-17 | 2026-05-25 |
| `OrderProposed` | 422 | 2026-05-09 | 2026-05-21 |
| `LegacyFanoutShadowed` | 410 | 2026-05-17 | 2026-05-25 |
| `AgentGoalEvaluated` | 409 | 2026-05-17 | 2026-05-25 |
| `AuditFinding` | 377 | 2026-05-07 | 2026-05-25 |
| `AgentGoalDeferred` | 367 | 2026-05-17 | 2026-05-25 |
| `IdentityKeyRotated` | 349 | 2026-05-19 | 2026-05-25 |
| `ISDACSAAssessmentCompleted` | 332 | 2024-01-01 | 2026-05-20 |
| `ReconResult` | 327 | 2026-05-07 | 2026-05-25 |
| `CreditLimitLoaded` | 319 | 2024-01-01 | 2026-05-21 |
| `CreditLimitApplicationSubmitted` | 300 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 300 | 2024-01-01 | 2026-05-20 |
| `SettlementConfirmed` | 290 | 2026-05-19 | 2026-05-25 |
| `WorkstreamRegistered` | 279 | 2026-05-07 | 2026-05-20 |
| `OutboundMessageDispatched` | 270 | 2026-05-19 | 2026-05-23 |
| `CreditAnalysisCompleted` | 220 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 220 | 2024-01-01 | 2026-05-20 |
| `CcrReplacementCostComputed` | 200 | 2026-05-20 | 2026-05-20 |
| `BacktestRequested` | 190 | 2026-01-10 | 2026-01-10 |
| `AgentBriefIssued` | 180 | 2026-05-10 | 2026-05-25 |
| `DashboardProjectionRefreshed` | 180 | 2026-05-19 | 2026-05-20 |
| `BacktestRun` | 180 | 2026-05-09 | 2026-05-09 |
| `AgentRunStarted` | 167 | 2026-05-10 | 2026-05-25 |
| `AgentRunCompleted` | 165 | 2026-05-10 | 2026-05-25 |
| `ClientCandidateRegistered` | 152 | 2026-05-18 | 2026-05-25 |
| `AgentPerformanceEvaluated` | 142 | 2026-05-17 | 2026-05-25 |
| `AgentFeedbackIssued` | 142 | 2026-05-17 | 2026-05-25 |
| `SubstrateAgentRunFailed` | 129 | 2026-05-17 | 2026-05-25 |
| `KYCIdentityCollected` | 120 | 2026-05-18 | 2026-05-25 |
| `KYCIdentityVerified` | 120 | 2026-05-18 | 2026-05-25 |
| `KYCSanctionsPEPScreened` | 120 | 2026-05-18 | 2026-05-25 |
| `KYCDecisionMade` | 120 | 2026-05-18 | 2026-05-25 |
| `CounterpartyFaisClassified` | 120 | 2026-05-01 | 2026-05-17 |
| `ClientAccepted` | 104 | 2026-05-13 | 2026-05-25 |
| `DailyPnLReportGenerated` | 102 | 2026-05-19 | 2026-05-25 |
| `RegulatoryConceptExtracted` | 102 | 2026-05-22 | 2026-05-25 |
| `ClientRejected` | 96 | 2026-05-21 | 2026-05-25 |
| `KYCUBOResolved` | 90 | 2026-05-18 | 2026-05-25 |
| `KYCRiskRated` | 90 | 2026-05-18 | 2026-05-25 |
| `PermissionPolicyPublished` | 86 | 2026-05-18 | 2026-05-25 |
| `LawfulProcessingRegistered` | 80 | 2026-05-18 | 2026-05-25 |
| `IRRBBChecked` | 80 | 2026-05-19 | 2026-05-20 |
| `CcrEadComputed` | 80 | 2026-05-20 | 2026-05-20 |
| `MarketsProjectionRefreshed` | 78 | 2026-05-09 | 2026-05-09 |
| `DocumentRegistered` | 72 | 2026-05-11 | 2026-05-25 |
| `AgentEscalation` | 68 | 2026-05-07 | 2026-05-20 |
| `FxTradeCancelled` | 65 | 2026-05-19 | 2026-05-23 |
| `IntradayHQLAStressProjection` | 64 | 2026-05-19 | 2026-05-20 |
| `AgentRegistered` | 60 | 2026-05-18 | 2026-05-25 |
| `PartyRelationshipAsserted` | 44 | 2026-05-18 | 2026-05-19 |
| `AgentGoalSelected` | 42 | 2026-05-17 | 2026-05-25 |
| `M1CitationTrancheRegistered` | 40 | 2026-05-09 | 2026-05-09 |
| `IrsPositionRevalued` | 40 | 2026-05-19 | 2026-05-20 |
| `FxPositionRevalued` | 39 | 2026-05-19 | 2026-05-21 |
| `PartyRegistered` | 37 | 2026-05-18 | 2026-05-21 |
| `SubstrateStateSnapshot` | 35 | 2026-05-07 | 2026-05-20 |
| `AgentDecision` | 33 | 2026-05-07 | 2026-05-20 |
| `OrderApprovedAtGateway` | 32 | 2026-05-17 | 2026-05-21 |
| `SanctionsClearancePassed` | 32 | 2026-05-13 | 2026-05-13 |
| `PEPScreeningCompleted` | 32 | 2026-05-13 | 2026-05-13 |
| `BeneficialOwnerResolved` | 32 | 2026-05-13 | 2026-05-13 |
| `RiskRatingAssigned` | 32 | 2026-05-13 | 2026-05-13 |
| `ObligationCandidateProposed` | 31 | 2026-05-22 | 2026-05-25 |
| `DecisionRequested` | 30 | 2026-05-10 | 2026-05-10 |
| `EquityTradeBooked` | 30 | 2026-05-09 | 2026-05-09 |
| `IfrsClassificationApplied` | 30 | 2026-05-09 | 2026-05-09 |
| `IrsTradeBooked` | 30 | 2026-05-20 | 2026-05-20 |
| `KYCEDDInitiated` | 30 | 2026-05-21 | 2026-05-25 |
| `KYCEDDCompleted` | 30 | 2026-05-21 | 2026-05-25 |
| `OrderRejectedAtGateway` | 30 | 2026-05-17 | 2026-05-17 |
| `ProductDimensionAttested` | 28 | 2026-05-21 | 2026-05-21 |
| `SettlementRealisedPnlCorrected` | 28 | 2026-05-21 | 2026-05-23 |
| `CdmBindingsRegenerated` | 24 | 2026-05-09 | 2026-05-18 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `PopiaConsentRecorded` | 24 | 2026-05-13 | 2026-05-13 |
| `GoLiveConditionUpdated` | 22 | 2026-05-21 | 2026-05-21 |
| `OfficialMarkAdopted` | 22 | 2026-05-21 | 2026-05-21 |
| `DataProjectionSnapshot` | 20 | 2026-05-07 | 2026-05-20 |
| `InboxHygieneSweep` | 20 | 2026-05-07 | 2026-05-20 |
| `CreditLimitBreached` | 20 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 20 | 2026-05-23 | 2026-05-23 |
| `Feedback` | 20 | 2026-05-10 | 2026-05-10 |
| `ConflictOfInterestDisclosed` | 19 | 2026-05-17 | 2026-05-17 |
| `BestExecutionVerified` | 18 | 2026-05-17 | 2026-05-17 |
| `LiquidityLimitBreached` | 18 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 18 | 2026-05-22 | 2026-05-24 |
| `ProductDimensionNarrativeRecorded` | 17 | 2026-05-20 | 2026-05-21 |
| `IpvExceptionRaised` | 17 | 2026-05-21 | 2026-05-21 |
| `AccountingReadinessSnapshot` | 14 | 2026-05-17 | 2026-05-20 |
| `FaisClassificationSuitabilityChecked` | 13 | 2026-05-17 | 2026-05-17 |
| `GovernanceCyclePrep` | 12 | 2026-05-07 | 2026-05-19 |
| `LCRComputed` | 12 | 2026-05-19 | 2026-05-20 |
| `NSFRComputed` | 12 | 2026-05-19 | 2026-05-20 |
| `ObligationsRegisterSnapshot` | 11 | 2026-05-07 | 2026-05-17 |
| `SecuritySubstrateSnapshot` | 11 | 2026-05-07 | 2026-05-17 |
| `BestExecutionBreached` | 11 | 2026-05-17 | 2026-05-17 |
| `FtpCurvePublished` | 10 | 2026-05-17 | 2026-05-20 |
| `CreditLimitAnnualReviewCompleted` | 10 | 2026-05-21 | 2026-05-21 |
| `LexUtilisationComputed` | 10 | 2026-05-20 | 2026-05-20 |
| `BriefSuperseded` | 10 | 2026-05-10 | 2026-05-10 |
| `EquitySettlementInstructed` | 10 | 2026-05-13 | 2026-05-13 |
| `PaNotificationSubmitted` | 10 | 2026-05-11 | 2026-05-11 |
| `CreditLimitWithdrawn` | 10 | 2026-05-12 | 2026-05-12 |
| `OrderAccepted` | 10 | 2026-05-13 | 2026-05-13 |
| `CounterpartyEligibilityScreened` | 9 | 2026-05-20 | 2026-05-20 |
| `ALMRunCompleted` | 8 | 2026-05-19 | 2026-05-20 |
| `CollateralInventorySnapshot` | 8 | 2026-05-19 | 2026-05-19 |
| `EddInitiated` | 8 | 2026-05-13 | 2026-05-13 |
| `AgentPromptOptimizationApplied` | 8 | 2026-05-21 | 2026-05-22 |
| `ProductDimensionNarrativeRequested` | 5 | 2026-05-20 | 2026-05-23 |
| `MtmRunCompleted` | 5 | 2026-05-21 | 2026-05-21 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `RfqRequested` | 4 | 2026-05-21 | 2026-05-21 |
| `QuoteResponded` | 4 | 2026-05-21 | 2026-05-21 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `TradeCancelled` | 4 | 2026-05-21 | 2026-05-21 |
| `RegulatoryInstrumentRegistered` | 4 | 2026-05-22 | 2026-05-25 |
| `InterbankLoanPlaced` | 4 | 2026-05-23 | 2026-05-23 |
| `RegulatoryInstrumentContextualised` | 3 | 2026-05-22 | 2026-05-25 |
| `MLROAttestation` | 2 | 2026-05-17 | 2026-05-18 |
| `GoLiveGateActivated` | 2 | 2026-05-21 | 2026-05-21 |
| `RasLimitSchedulePublished` | 2 | 2026-05-14 | 2026-05-21 |
| `ConductObligationFlagged` | 2 | 2026-05-17 | 2026-05-17 |
| `RepoTradeOpened` | 2 | 2026-05-23 | 2026-05-23 |
| `DepositTaken` | 2 | 2026-05-23 | 2026-05-23 |
| `AccountingPeriodOpened` | 1 | 2026-05-17 | 2026-05-17 |
| `AgentOpsReadinessSnapshot` | 1 | 2026-05-17 | 2026-05-17 |
| `ManualJournalEntry` | 1 | 2026-05-18 | 2026-05-18 |
| `ProductProposalRegistered` | 1 | 2026-05-21 | 2026-05-21 |
| `ProductDueDiligenceCompleted` | 1 | 2026-05-21 | 2026-05-21 |
| `ProductApproved` | 1 | 2026-05-21 | 2026-05-21 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

123 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

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

The substrate is materially complete at the layer level: 213,116 events across 150 types in the canonical store, 31/31 personas under operating spec, 123 runtime handlers registered across the agent fleet, and the four substrate layers (event store, typed payloads, trigger kinds, narrative generation) all closed or in named-exception state. What remains open is not scaffolding — it is hardening and reach: Neon's role-downgrade and IP allowlist (§5.1/§5.2) sit deferred under `TM-NEON-EVENT-STORE-001` and gate sensitive-event flows, and GH Actions cron remains the interim scheduler until A2.1 lands.

The consequential changes since prior runs are visible in the snapshot rather than a diff, but three stand out. First, the typed event-payload schemas now have live exercise: `RiskRaised` has 532 instances and `AgentEscalation` has 68 — both schemas defined in `platform/event-store/event-types.ts` are no longer paper, which unblocks Vera's audit pipelines #14/#15 downstream. Second, M1 close-out events have surfaced — `GoLiveGateActivated` (2), `GoLiveConditionUpdated` (22), `MLROAttestation` (2), `ProductApproved` (1) — indicating the go-live machinery is emitting through the substrate, not around it. Third, the regulatory-extraction pipeline is producing: `RegulatoryConceptExtracted` (102) and `ObligationCandidateProposed` (31) over the last three days give Mira's obligations register real input.

On load-bearing gaps: the Neon §5.1/§5.2 hardening is the most consequential — it is the gate between "substrate ready for non-sensitive build-phase events" and "substrate ready for KYC/PII/transaction-sensitive flows," and the 120 `KYCIdentityVerified` / 120 `KYCSanctionsPEPScreened` / 90 `KYCRiskRated` events already in store mean we are accumulating debt against that boundary. Second, GH Actions cron remains a silent-drop risk against all ten scheduled handlers; the 724 `ScheduledTrigger` events show the typed-trigger shape is proven, so A2.1 (Bun scheduler emitting `ScheduledTrigger`) is now a porting exercise, not a design one. Third, the Owner Inbox at 445 deliverables is itself becoming a substrate signal — Scrooge's `inbox-hygiene` and `owner-inbox-archiver` are registered but the count suggests the archiver's retention policy needs review. What the substrate needs next is A2.1 — retire cron as the trigger of record before M8 lifts the store to Azure.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
