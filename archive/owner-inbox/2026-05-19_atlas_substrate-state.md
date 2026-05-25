---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-19T23:39:25.614Z
decision-required: false
---

# Atlas — substrate state, 2026-05-19

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 8615 events across 68 types; 31/31 personas have operating specs; 119 runtime handlers registered; 371 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `.local/event.db` · Total events: 8615

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `SubstrateAgentRunStarted` | 1639 | 2026-05-17 | 2026-05-19 |
| `BusDispatched` | 1625 | 2026-05-17 | 2026-05-19 |
| `SubstrateAgentRunCompleted` | 1524 | 2026-05-17 | 2026-05-19 |
| `ScheduledTrigger` | 423 | 2026-05-17 | 2026-05-19 |
| `Decision` | 360 | 2026-05-01 | 2026-05-19 |
| `AgentGoalEvaluated` | 323 | 2026-05-17 | 2026-05-19 |
| `SubstrateAlert` | 318 | 2026-05-17 | 2026-05-19 |
| `LegacyFanoutShadowed` | 307 | 2026-05-17 | 2026-05-19 |
| `AgentGoalDeferred` | 295 | 2026-05-17 | 2026-05-19 |
| `WorkstreamRegistered` | 151 | 2026-05-17 | 2026-05-19 |
| `RiskRaised` | 133 | 2026-05-17 | 2026-05-19 |
| `DashboardProjectionRefreshed` | 126 | 2026-05-19 | 2026-05-19 |
| `RecordFiled` | 125 | 2026-05-17 | 2026-05-19 |
| `SubstrateAgentRunFailed` | 114 | 2026-05-17 | 2026-05-19 |
| `ReconResult` | 111 | 2026-05-17 | 2026-05-19 |
| `InboundMessageReceived` | 87 | 2026-05-19 | 2026-05-19 |
| `AgentPerformanceEvaluated` | 84 | 2026-05-17 | 2026-05-19 |
| `AgentFeedbackIssued` | 84 | 2026-05-17 | 2026-05-19 |
| `PermissionPolicyPublished` | 78 | 2026-05-18 | 2026-05-19 |
| `IRRBBChecked` | 70 | 2026-05-19 | 2026-05-19 |
| `IntradayHQLAStressProjection` | 56 | 2026-05-19 | 2026-05-19 |
| `AgentBriefIssued` | 43 | 2026-05-18 | 2026-05-19 |
| `SubLedgerPostingEmitted` | 40 | 2026-05-18 | 2026-05-19 |
| `AgentEscalation` | 36 | 2026-05-18 | 2026-05-19 |
| `AgentRegistered` | 34 | 2026-05-18 | 2026-05-19 |
| `PartyRelationshipAsserted` | 34 | 2026-05-18 | 2026-05-19 |
| `AgentRunStarted` | 33 | 2026-05-18 | 2026-05-19 |
| `PartyRegistered` | 33 | 2026-05-18 | 2026-05-19 |
| `AgentRunCompleted` | 32 | 2026-05-18 | 2026-05-19 |
| `AgentGoalSelected` | 28 | 2026-05-17 | 2026-05-19 |
| `FxTradeExecuted` | 25 | 2026-05-18 | 2026-05-19 |
| `MessageCorrelated` | 20 | 2026-05-19 | 2026-05-19 |
| `SubstrateStateSnapshot` | 19 | 2026-05-17 | 2026-05-19 |
| `AgentDecision` | 18 | 2026-05-18 | 2026-05-19 |
| `FxPositionRevalued` | 15 | 2026-05-19 | 2026-05-19 |
| `FxTradeCancelled` | 15 | 2026-05-19 | 2026-05-19 |
| `AccountingReadinessSnapshot` | 12 | 2026-05-17 | 2026-05-19 |
| `LCRComputed` | 10 | 2026-05-19 | 2026-05-19 |
| `NSFRComputed` | 10 | 2026-05-19 | 2026-05-19 |
| `DataProjectionSnapshot` | 9 | 2026-05-17 | 2026-05-19 |
| `InboxHygieneSweep` | 9 | 2026-05-17 | 2026-05-19 |
| `FtpCurvePublished` | 9 | 2026-05-17 | 2026-05-19 |
| `CollateralInventorySnapshot` | 8 | 2026-05-19 | 2026-05-19 |
| `DailyPnLReportGenerated` | 8 | 2026-05-19 | 2026-05-19 |
| `FxSettlementInstructed` | 8 | 2026-05-19 | 2026-05-19 |
| `PrincipalPayment` | 8 | 2026-05-19 | 2026-05-21 |
| `ALMRunCompleted` | 7 | 2026-05-19 | 2026-05-19 |
| `ClientCandidateRegistered` | 4 | 2026-05-18 | 2026-05-18 |
| `KYCIdentityCollected` | 4 | 2026-05-18 | 2026-05-18 |
| `KYCIdentityVerified` | 4 | 2026-05-18 | 2026-05-18 |
| `KYCSanctionsPEPScreened` | 4 | 2026-05-18 | 2026-05-18 |
| `KYCUBOResolved` | 4 | 2026-05-18 | 2026-05-18 |
| `KYCRiskRated` | 4 | 2026-05-18 | 2026-05-18 |
| `KYCDecisionMade` | 4 | 2026-05-18 | 2026-05-18 |
| `ClientAccepted` | 4 | 2026-05-18 | 2026-05-18 |
| `LawfulProcessingRegistered` | 4 | 2026-05-18 | 2026-05-18 |
| `SettlementConfirmed` | 4 | 2026-05-19 | 2026-05-21 |
| `OutboundMessageDispatched` | 4 | 2026-05-19 | 2026-05-19 |
| `AuditFinding` | 3 | 2026-05-19 | 2026-05-19 |
| `GovernanceCyclePrep` | 2 | 2026-05-17 | 2026-05-19 |
| `MLROAttestation` | 2 | 2026-05-17 | 2026-05-18 |
| `CdmBindingsRegenerated` | 2 | 2026-05-17 | 2026-05-18 |
| `AccountingPeriodOpened` | 1 | 2026-05-17 | 2026-05-17 |
| `ObligationsRegisterSnapshot` | 1 | 2026-05-17 | 2026-05-17 |
| `SecuritySubstrateSnapshot` | 1 | 2026-05-17 | 2026-05-17 |
| `AgentOpsReadinessSnapshot` | 1 | 2026-05-17 | 2026-05-17 |
| `ManualJournalEntry` | 1 | 2026-05-18 | 2026-05-18 |
| `IdentityKeyRotated` | 1 | 2026-05-19 | 2026-05-19 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

119 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

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

_Narrative generation failed (The operation timed out.)._

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
