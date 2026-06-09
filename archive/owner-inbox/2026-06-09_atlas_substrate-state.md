---
agent: Atlas
trigger: substrate-state
asOf: 2026-06-09T08:00:53.655Z
decision-required: false
---

# Atlas — substrate state, 2026-06-09

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 86836 events across 155 types; 31/31 personas have operating specs; 131 runtime handlers registered; 690 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 86836

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `SubstrateAgentRunStarted` | 13343 | 2026-05-25 | 2026-06-09 |
| `SubstrateAgentRunCompleted` | 13170 | 2026-05-25 | 2026-06-09 |
| `BusDispatched` | 11832 | 2026-05-25 | 2026-06-09 |
| `ProvenanceReclassified` | 11478 | 2026-05-27 | 2026-05-29 |
| `LegacyFanoutShadowed` | 8301 | 2026-05-25 | 2026-06-09 |
| `Decision` | 2688 | 2026-04-30 | 2026-06-09 |
| `WorkstreamRegistered` | 2508 | 2026-05-07 | 2026-06-09 |
| `DashboardProjectionRefreshed` | 2503 | 2026-05-25 | 2026-06-09 |
| `RiskRaised` | 2448 | 2025-12-01 | 2026-06-02 |
| `CalculationPerformed` | 1518 | 2026-06-01 | 2026-06-08 |
| `SubstrateAlert` | 1245 | 2025-01-01 | 2026-06-09 |
| `ScheduledTrigger` | 1121 | 2026-05-25 | 2026-06-09 |
| `RecordFiled` | 1050 | 2026-05-10 | 2026-06-09 |
| `AgentGoalEvaluated` | 895 | 2026-05-25 | 2026-06-09 |
| `ReconResult` | 855 | 2026-05-07 | 2026-06-09 |
| `BacktestRequested` | 786 | 2026-01-10 | 2026-01-10 |
| `BacktestRun` | 740 | 2026-05-09 | 2026-05-09 |
| `SubLedgerPostingEmitted` | 564 | 2026-06-01 | 2026-06-09 |
| `MarketsProjectionRefreshed` | 555 | 2026-05-09 | 2026-05-09 |
| `OfficialMarkAdopted` | 538 | 2026-05-28 | 2026-06-08 |
| `AgentGoalDeferred` | 516 | 2026-05-25 | 2026-06-09 |
| `IdentityKeyRotated` | 516 | 2026-05-27 | 2026-06-02 |
| `ObligationAdopted` | 437 | 2026-06-04 | 2026-06-08 |
| `AgentPerformanceEvaluated` | 432 | 2026-05-25 | 2026-06-09 |
| `AgentFeedbackIssued` | 432 | 2026-05-25 | 2026-06-09 |
| `AgentGoalSelected` | 379 | 2026-05-25 | 2026-06-09 |
| `AgentRunCompleted` | 360 | 2026-05-10 | 2026-06-09 |
| `AgentBriefIssued` | 348 | 2026-05-10 | 2026-06-09 |
| `AgentRunStarted` | 347 | 2026-05-10 | 2026-06-09 |
| `PermissionPolicyPublished` | 317 | 2026-05-26 | 2026-06-01 |
| `SubstrateStateSnapshot` | 313 | 2026-05-07 | 2026-06-09 |
| `AuditFindingClosed` | 229 | 2026-06-02 | 2026-06-09 |
| `AuditFinding` | 226 | 2026-05-07 | 2026-06-08 |
| `M1CitationTrancheRegistered` | 176 | 2026-05-09 | 2026-05-09 |
| `BondTradeExecuted` | 172 | 2026-06-01 | 2026-06-08 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `BondSettlementInstructed` | 170 | 2026-06-07 | 2026-06-08 |
| `BondCustodianSettlementConfirmed` | 170 | 2026-06-07 | 2026-06-08 |
| `SubstrateAgentRunFailed` | 168 | 2026-05-26 | 2026-06-09 |
| `DailyPnLReportGenerated` | 143 | 2026-06-01 | 2026-06-08 |
| `DecisionRequested` | 132 | 2026-05-10 | 2026-05-10 |
| `BondPositionRevalued` | 130 | 2026-06-08 | 2026-06-08 |
| `CdmBindingsRegenerated` | 115 | 2026-05-09 | 2026-06-08 |
| `LiquidityLimitBreached` | 88 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 88 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 88 | 2026-05-10 | 2026-05-10 |
| `IRRBBChecked` | 80 | 2026-06-02 | 2026-06-09 |
| `AgentEscalation` | 77 | 2026-05-07 | 2026-06-02 |
| `DocumentRegistered` | 71 | 2026-05-11 | 2026-05-25 |
| `PartyRegistered` | 65 | 2026-05-23 | 2026-06-01 |
| `IntradayHQLAStressProjection` | 64 | 2026-06-02 | 2026-06-09 |
| `AgentRegistered` | 60 | 2026-05-26 | 2026-06-01 |
| `DataProjectionSnapshot` | 58 | 2026-05-07 | 2026-06-09 |
| `InboxHygieneSweep` | 58 | 2026-05-07 | 2026-06-09 |
| `PartyAttributeChanged` | 56 | 2026-06-01 | 2026-06-07 |
| `ConflictOfInterestDisclosed` | 54 | 2026-05-17 | 2026-05-17 |
| `FxSettlementInstructed` | 54 | 2026-06-01 | 2026-06-08 |
| `SlaRulePublished` | 51 | 2026-01-01 | 2026-06-06 |
| `SlaRuleApproved` | 51 | 2026-01-01 | 2026-06-06 |
| `BriefSuperseded` | 48 | 2026-05-10 | 2026-05-31 |
| `ClientCandidateRegistered` | 48 | 2026-06-01 | 2026-06-01 |
| `PaNotificationSubmitted` | 44 | 2026-05-11 | 2026-05-11 |
| `ObligationsRegisterSnapshot` | 42 | 2026-05-07 | 2026-06-03 |
| `SecuritySubstrateSnapshot` | 42 | 2026-05-07 | 2026-06-04 |
| `ValuationAdjustmentComputed` | 42 | 2026-06-01 | 2026-06-08 |
| `GovernanceCyclePrep` | 41 | 2026-05-07 | 2026-06-09 |
| `FxTradeExecuted` | 40 | 2026-06-01 | 2026-06-08 |
| `PartyRelationshipAsserted` | 36 | 2026-06-01 | 2026-06-01 |
| `PrincipalPayment` | 36 | 2026-06-02 | 2026-06-09 |
| `RiskAppetiteSnapshot` | 30 | 2026-05-27 | 2026-06-09 |
| `FxPositionRevalued` | 30 | 2026-06-02 | 2026-06-08 |
| `AccountingReadinessSnapshot` | 27 | 2026-05-26 | 2026-06-09 |
| `FtpCurvePublished` | 26 | 2026-05-26 | 2026-06-09 |
| `ModelValidationApproved` | 26 | 2026-05-27 | 2026-05-29 |
| `KYCIdentityCollected` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCIdentityVerified` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCSanctionsPEPScreened` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCUBOResolved` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCRiskRated` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCDecisionMade` | 26 | 2026-06-01 | 2026-06-01 |
| `ClientAccepted` | 26 | 2026-06-01 | 2026-06-01 |
| `LawfulProcessingRegistered` | 26 | 2026-06-01 | 2026-06-01 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `ModelSubmitted` | 23 | 2026-05-27 | 2026-05-29 |
| `ModelTierClassified` | 23 | 2026-05-27 | 2026-05-29 |
| `ALMReadinessSnapshot` | 23 | 2026-05-29 | 2026-06-09 |
| `FxTradeCancelled` | 21 | 2026-06-01 | 2026-06-01 |
| `SettlementConfirmed` | 18 | 2026-06-02 | 2026-06-09 |
| `AgentEscalationDecided` | 17 | 2026-05-26 | 2026-06-03 |
| `LiquiditySnapshot` | 16 | 2026-06-02 | 2026-06-09 |
| `RiskRunCompleted` | 14 | 2026-06-02 | 2026-06-09 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `FinancialInstrumentDefined` | 13 | 2026-06-02 | 2026-06-02 |
| `PaymentsReadinessSnapshot` | 12 | 2026-05-29 | 2026-06-09 |
| `LCRComputed` | 12 | 2026-06-02 | 2026-06-09 |
| `NSFRComputed` | 12 | 2026-06-02 | 2026-06-09 |
| `InboundMessageReceived` | 11 | 2026-06-01 | 2026-06-02 |
| `MessageCorrelated` | 10 | 2026-06-01 | 2026-06-02 |
| `FinancialInstrumentClassified` | 9 | 2026-06-02 | 2026-06-02 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `MtmRunCompleted` | 8 | 2026-06-01 | 2026-06-08 |
| `PnLAttributionGenerated` | 8 | 2026-06-01 | 2026-06-08 |
| `ALMRunCompleted` | 8 | 2026-06-02 | 2026-06-09 |
| `CollateralInventorySnapshotted` | 8 | 2026-06-02 | 2026-06-09 |
| `RealisedPnlRecognised` | 8 | 2026-06-03 | 2026-06-08 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `PrudentValuationAvaAggregated` | 7 | 2026-06-01 | 2026-06-08 |
| `RiskResolved` | 7 | 2026-06-02 | 2026-06-02 |
| `PnLSignedOff` | 6 | 2026-06-01 | 2026-06-08 |
| `DecisionComment` | 6 | 2026-06-05 | 2026-06-06 |
| `AgentDecision` | 5 | 2026-05-28 | 2026-06-05 |
| `IrsPositionRevalued` | 5 | 2026-06-02 | 2026-06-08 |
| `PnLFlashRecorded` | 5 | 2026-06-03 | 2026-06-08 |
| `PnLFlashActualReconciled` | 5 | 2026-06-03 | 2026-06-08 |
| `ObligationLifecycleTransitioned` | 5 | 2026-06-04 | 2026-06-08 |
| `MLROAttestation` | 4 | 2026-05-26 | 2026-06-08 |
| `AgentOpsReadinessSnapshot` | 4 | 2026-05-26 | 2026-06-05 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `MarketsProjectionRegistered` | 3 | 2026-05-09 | 2026-05-09 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `OperationalResilienceSnapshot` | 3 | 2026-05-29 | 2026-06-08 |
| `AuditCommitteePackPrepped` | 3 | 2026-05-29 | 2026-06-09 |
| `MarketsReadinessSnapshot` | 3 | 2026-05-29 | 2026-06-08 |
| `MarketRiskMeasureComputed` | 3 | 2026-06-03 | 2026-06-08 |
| `RoleResearchQueueSnapshot` | 2 | 2026-05-29 | 2026-06-05 |
| `LegalReadinessSnapshot` | 2 | 2026-05-29 | 2026-06-05 |
| `CyberResilienceSnapshot` | 2 | 2026-05-29 | 2026-06-04 |
| `POPIAControlsSnapshot` | 2 | 2026-05-29 | 2026-06-03 |
| `TaxReadinessSnapshot` | 2 | 2026-05-29 | 2026-06-04 |
| `DepositTaken` | 2 | 2026-06-01 | 2026-06-02 |
| `InterbankLoanPlaced` | 2 | 2026-06-01 | 2026-06-01 |
| `OutboundMessageDispatched` | 2 | 2026-06-01 | 2026-06-02 |
| `ManualJournalEntry` | 2 | 2026-06-07 | 2026-06-07 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `PartyClassified` | 1 | 2026-06-01 | 2026-06-01 |
| `RepoTradeOpened` | 1 | 2026-06-01 | 2026-06-01 |
| `FundingLineDrawn` | 1 | 2026-06-01 | 2026-06-01 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `SeedDescoped` | 1 | 2026-06-01 | 2026-06-01 |
| `CapitalEvent` | 1 | 2026-06-01 | 2026-06-01 |
| `LCRRatioProjection` | 1 | 2026-06-02 | 2026-06-02 |
| `AccountingPeriodOpened` | 1 | 2026-06-02 | 2026-06-02 |
| `IrsTradeBooked` | 1 | 2026-06-02 | 2026-06-02 |
| `FundingDrawnDown` | 1 | 2026-06-02 | 2026-06-02 |
| `SettlementInstructionIssued` | 1 | 2026-06-02 | 2026-06-02 |
| `BankModePolicySet` | 1 | 2026-06-03 | 2026-06-03 |
| `FinancialPositionSnapshot` | 1 | 2026-06-08 | 2026-06-08 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

131 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

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
| Rohan | `market-risk-measure` |
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
- Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised + closure family (RiskResolved / RiskAccepted / RiskMitigated) — DEFINED in `platform/event-store/event-types/risk.ts` + `.../event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Substrate gaps surface on the SubstrateStateSnapshot `gaps[]` status inventory + per-gap WorkstreamRegistered events; they are NOT risk-register findings, so Atlas no longer emits RiskRaised for them (WS-RISK-REGISTER-CLOSURE). The closure family lets goal-loops resolve a risk register by riskId pairing. Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.
- Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).
- Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.
- Projection-cache persistence: closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives the dashboard projection from canonical sources + the live event store and writes it to the runtime cache `prototype/.local/dashboard-state.json` (gitignored). D-EVENT-STORE-SCALING Slice 3a (PR #138, 2026-05-10) split this runtime path off the previously-committed seed; Slice 3b (same day) removed the seed from the commit graph entirely — the recon harness now derives + asserts internal consistency at recon time rather than comparing against a stored cache.
- Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).
- GitHub Actions cron unreliability — interim substrate. GH Actions silently dropped Anya 03:00 UTC + Scrooge 04:00 UTC daily slots overnight 2026-05-07/08; Vera 02:00 UTC fired 2h46m late. All ten scheduled workflows re-pinned 2026-05-08 to off-the-hour distinct minutes (Vera 02:13, Anya 03:17, Scrooge 04:27, Helena 04:30, Devon Mon 05:23, Zara Mon 05:30, Atlas Mon 06:19, Owen Tue 07:31, Mira Wed 07:29, Senna Thu 07:37). Permanent fix is A2.1 — substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process — at which point cron files become thin shims or retire entirely.

## Atlas's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbsLMWMJ7wAY5spErC1AT"})._

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
