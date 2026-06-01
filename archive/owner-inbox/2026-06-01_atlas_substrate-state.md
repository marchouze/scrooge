---
agent: Atlas
trigger: substrate-state
asOf: 2026-06-01T16:00:31.051Z
decision-required: false
---

# Atlas — substrate state, 2026-06-01

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 56933 events across 116 types; 31/31 personas have operating specs; 130 runtime handlers registered; 556 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 56933

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 11478 | 2026-05-27 | 2026-05-29 |
| `SubstrateAgentRunStarted` | 7887 | 2026-05-25 | 2026-06-01 |
| `SubstrateAgentRunCompleted` | 7720 | 2026-05-25 | 2026-06-01 |
| `BusDispatched` | 6375 | 2026-05-25 | 2026-06-01 |
| `LegacyFanoutShadowed` | 3257 | 2026-05-25 | 2026-06-01 |
| `Decision` | 2715 | 2026-04-30 | 2026-06-01 |
| `RiskRaised` | 2392 | 2025-12-01 | 2026-06-01 |
| `WorkstreamRegistered` | 1340 | 2026-05-07 | 2026-06-01 |
| `RecordFiled` | 1289 | 2026-05-05 | 2026-06-01 |
| `DashboardProjectionRefreshed` | 1171 | 2026-05-25 | 2026-06-01 |
| `SubstrateAlert` | 1009 | 2025-01-01 | 2026-06-01 |
| `BacktestRequested` | 816 | 2026-01-10 | 2026-01-10 |
| `BacktestRun` | 769 | 2026-05-09 | 2026-05-09 |
| `ScheduledTrigger` | 708 | 2026-05-25 | 2026-06-01 |
| `ReconResult` | 648 | 2026-05-07 | 2026-06-01 |
| `AgentGoalEvaluated` | 591 | 2026-05-25 | 2026-06-01 |
| `MarketsProjectionRefreshed` | 585 | 2026-05-09 | 2026-05-09 |
| `IdentityKeyRotated` | 519 | 2026-05-25 | 2026-06-01 |
| `OfficialMarkAdopted` | 464 | 2026-05-28 | 2026-05-31 |
| `AgentGoalDeferred` | 418 | 2026-05-25 | 2026-06-01 |
| `PermissionPolicyPublished` | 325 | 2026-05-25 | 2026-06-01 |
| `CalculationPerformed` | 286 | 2026-06-01 | 2026-06-01 |
| `AgentRunCompleted` | 284 | 2026-05-10 | 2026-06-01 |
| `AgentBriefIssued` | 275 | 2026-05-10 | 2026-06-01 |
| `AgentRunStarted` | 273 | 2026-05-10 | 2026-06-01 |
| `AuditFinding` | 227 | 2026-05-07 | 2026-05-30 |
| `AgentPerformanceEvaluated` | 184 | 2026-05-25 | 2026-06-01 |
| `AgentFeedbackIssued` | 184 | 2026-05-25 | 2026-06-01 |
| `M1CitationTrancheRegistered` | 180 | 2026-05-09 | 2026-05-09 |
| `AgentGoalSelected` | 173 | 2026-05-25 | 2026-06-01 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `SubstrateStateSnapshot` | 167 | 2026-05-07 | 2026-06-01 |
| `SubstrateAgentRunFailed` | 162 | 2026-05-25 | 2026-06-01 |
| `DecisionRequested` | 135 | 2026-05-10 | 2026-05-10 |
| `CdmBindingsRegenerated` | 120 | 2026-05-09 | 2026-06-01 |
| `LiquidityLimitBreached` | 90 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 90 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 90 | 2026-05-10 | 2026-05-10 |
| `AgentEscalation` | 78 | 2026-05-07 | 2026-05-30 |
| `DocumentRegistered` | 71 | 2026-05-11 | 2026-05-25 |
| `PartyRegistered` | 65 | 2026-05-23 | 2026-06-01 |
| `AgentRegistered` | 60 | 2026-05-26 | 2026-06-01 |
| `ConflictOfInterestDisclosed` | 55 | 2026-05-17 | 2026-05-17 |
| `DataProjectionSnapshot` | 52 | 2026-05-07 | 2026-06-01 |
| `InboxHygieneSweep` | 52 | 2026-05-07 | 2026-06-01 |
| `BriefSuperseded` | 49 | 2026-05-10 | 2026-05-31 |
| `ClientCandidateRegistered` | 48 | 2026-06-01 | 2026-06-01 |
| `PaNotificationSubmitted` | 45 | 2026-05-11 | 2026-05-11 |
| `ObligationsRegisterSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `SecuritySubstrateSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `GovernanceCyclePrep` | 41 | 2026-05-07 | 2026-05-28 |
| `SubLedgerPostingEmitted` | 40 | 2026-06-01 | 2026-06-01 |
| `PartyRelationshipAsserted` | 36 | 2026-06-01 | 2026-06-01 |
| `ModelValidationApproved` | 26 | 2026-05-27 | 2026-05-29 |
| `DailyPnLReportGenerated` | 26 | 2026-06-01 | 2026-06-01 |
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
| `FxTradeExecuted` | 20 | 2026-06-01 | 2026-06-01 |
| `FxTradeCancelled` | 19 | 2026-06-01 | 2026-06-01 |
| `AccountingReadinessSnapshot` | 18 | 2026-05-26 | 2026-06-01 |
| `FtpCurvePublished` | 17 | 2026-05-26 | 2026-06-01 |
| `AgentEscalationDecided` | 14 | 2026-05-26 | 2026-05-30 |
| `FxSettlementInstructed` | 14 | 2026-06-01 | 2026-06-01 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `RiskAppetiteSnapshot` | 13 | 2026-05-27 | 2026-06-01 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `ALMReadinessSnapshot` | 7 | 2026-05-29 | 2026-06-01 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `AgentDecision` | 5 | 2026-05-07 | 2026-05-30 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `PaymentsReadinessSnapshot` | 4 | 2026-05-29 | 2026-06-01 |
| `MLROAttestation` | 3 | 2026-05-26 | 2026-06-01 |
| `AgentOpsReadinessSnapshot` | 3 | 2026-05-26 | 2026-05-29 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `OperationalResilienceSnapshot` | 2 | 2026-05-29 | 2026-06-01 |
| `MarketsReadinessSnapshot` | 2 | 2026-05-29 | 2026-06-01 |
| `InterbankLoanPlaced` | 2 | 2026-06-01 | 2026-06-01 |
| `PrincipalPayment` | 2 | 2026-06-03 | 2026-06-03 |
| `RegulatoryInstrumentRegistered` | 1 | 2026-05-25 | 2026-05-25 |
| `RegulatoryInstrumentContextualised` | 1 | 2026-05-25 | 2026-05-25 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `RoleResearchQueueSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `LegalReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `CyberResilienceSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `POPIAControlsSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `AuditCommitteePackPrepped` | 1 | 2026-05-29 | 2026-05-29 |
| `TaxReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `PartyClassified` | 1 | 2026-06-01 | 2026-06-01 |
| `RepoTradeOpened` | 1 | 2026-06-01 | 2026-06-01 |
| `DepositTaken` | 1 | 2026-06-01 | 2026-06-01 |
| `FundingLineDrawn` | 1 | 2026-06-01 | 2026-06-01 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `SeedDescoped` | 1 | 2026-06-01 | 2026-06-01 |
| `CapitalEvent` | 1 | 2026-06-01 | 2026-06-01 |
| `BondTradeExecuted` | 1 | 2026-06-01 | 2026-06-01 |
| `SettlementConfirmed` | 1 | 2026-06-03 | 2026-06-03 |

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

Substrate is dense and broadly load-bearing: 56,933 events across 116 types in the host event store, 130 registered runtime handlers across 31/31 personas with operating specs, and event-driven dispatch is now first-class in `runtime/run.ts`. What's closing is the typed-payload migration (`AgentEscalation`, `AgentDecision`, `WorkstreamRegistered`, `RiskRaised` all defined and at least one — `RiskRaised` — being emitted on my own weekly pass), the Claude narrative integration (rolled out to all seven persona handlers that needed it), and projection-cache persistence (Anya's `projection-refresh` derives the dashboard live from the event store; the curated seed is out of the commit graph as of PR #138 Slice 3b). What's blocking remains the same shape as last cycle: cross-process event-bus, the substrate scheduler, and Neon hardening §5.1/§5.2 before any sensitive-data event flows.

The consequential moves this week are visible in the type breakdown. KYC is now end-to-end as substrate — `KYCIdentityCollected` through `KYCDecisionMade` and `ClientAccepted` (26 each, all 2026-06-01), wired through `mira:kyc-onboarding-gateway` and `niko:client-lifecycle`. The trading and posting stack came online the same day: `FxTradeExecuted` (20), `FxSettlementInstructed` (14), `BondTradeExecuted`, `RepoTradeOpened`, `InterbankLoanPlaced`, `DepositTaken`, `FundingLineDrawn`, with `SubLedgerPostingEmitted` (40) and `DailyPnLReportGenerated` (26) closing the loop through Bea's posting engines. And Ravi's ALM/FTP path is producing: `FtpCurvePublished` (17) and `ALMReadinessSnapshot` (7). These are net-new substrate, not refactors.

On load-bearing gaps: Vera's audit pipelines #14/#15 now have `AgentEscalation` substrate to consume (78 events, latest 2026-05-30) and `AgentEscalationDecided` (14) — the schema is defined, the events exist, the gap is the consumer side, not the producer side. The dashboard's curated-seed retirement is functionally closed: `WorkstreamRegistered` is flowing (1,340 events) and Anya's projection refresh is event-driven off it. The remaining structurally-blocking gap is the in-process-only event bus: event-driven dispatch fans out within a parent run but not across workflows, which means anything cross-persona still rides scheduled triggers and the cron-pinning workaround. That fix is A2.1 — the substrate scheduler emitting typed `ScheduledTrigger` events from a long-lived Bun process — and it would also retire the GH Actions cron shims.

Next: stand up A2.1 (substrate scheduler) so `ScheduledTrigger` becomes a first-class event rather than a cron-file artefact, and the cross-process bus stops being M8-deferred infrastructure.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
