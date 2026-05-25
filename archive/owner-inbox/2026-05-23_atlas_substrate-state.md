---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-23T07:00:01.150Z
decision-required: false
---

# Atlas — substrate state, 2026-05-23

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 240658 events across 45 types; 31/31 personas have operating specs; 123 runtime handlers registered; 423 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `.local/event.db` · Total events: 240658

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `SubstrateAlert` | 233423 | 2026-05-17 | 2026-05-23 |
| `SubstrateAgentRunStarted` | 1281 | 2026-05-20 | 2026-05-23 |
| `BusDispatched` | 1280 | 2026-05-20 | 2026-05-23 |
| `SubstrateAgentRunCompleted` | 1205 | 2026-05-20 | 2026-05-23 |
| `RecordFiled` | 714 | 2026-05-05 | 2026-05-23 |
| `ScheduledTrigger` | 655 | 2026-05-20 | 2026-05-23 |
| `AgentGoalEvaluated` | 360 | 2026-05-20 | 2026-05-23 |
| `AgentGoalDeferred` | 336 | 2026-05-20 | 2026-05-23 |
| `Decision` | 219 | 2026-05-01 | 2026-05-22 |
| `ReconResult` | 216 | 2026-05-20 | 2026-05-23 |
| `LegacyFanoutShadowed` | 187 | 2026-05-20 | 2026-05-23 |
| `AgentPerformanceEvaluated` | 113 | 2026-05-20 | 2026-05-23 |
| `AgentFeedbackIssued` | 113 | 2026-05-20 | 2026-05-23 |
| `IRRBBChecked` | 100 | 2026-05-20 | 2026-05-23 |
| `IntradayHQLAStressProjection` | 80 | 2026-05-20 | 2026-05-23 |
| `SubstrateAgentRunFailed` | 75 | 2026-05-20 | 2026-05-23 |
| `AgentRegistered` | 30 | 2026-05-22 | 2026-05-22 |
| `PermissionPolicyPublished` | 29 | 2026-05-22 | 2026-05-22 |
| `DashboardProjectionRefreshed` | 27 | 2026-05-20 | 2026-05-22 |
| `AgentGoalSelected` | 24 | 2026-05-20 | 2026-05-23 |
| `WorkstreamRegistered` | 24 | 2026-05-20 | 2026-05-22 |
| `RiskRaised` | 21 | 2026-05-20 | 2026-05-22 |
| `AuditFinding` | 17 | 2026-05-20 | 2026-05-23 |
| `AccountingReadinessSnapshot` | 14 | 2026-05-20 | 2026-05-23 |
| `LCRComputed` | 14 | 2026-05-20 | 2026-05-22 |
| `NSFRComputed` | 14 | 2026-05-20 | 2026-05-22 |
| `CollateralInventorySnapshot` | 11 | 2026-05-20 | 2026-05-23 |
| `DataProjectionSnapshot` | 10 | 2026-05-20 | 2026-05-23 |
| `InboxHygieneSweep` | 10 | 2026-05-20 | 2026-05-23 |
| `FtpCurvePublished` | 10 | 2026-05-20 | 2026-05-23 |
| `ALMRunCompleted` | 10 | 2026-05-20 | 2026-05-23 |
| `MtmRunCompleted` | 7 | 2026-05-21 | 2026-05-22 |
| `AgentEscalation` | 6 | 2026-05-20 | 2026-05-22 |
| `AgentBriefIssued` | 5 | 2026-05-18 | 2026-05-18 |
| `SubstrateStateSnapshot` | 3 | 2026-05-20 | 2026-05-22 |
| `AgentDecision` | 3 | 2026-05-20 | 2026-05-22 |
| `ObligationsRegisterSnapshot` | 2 | 2026-05-20 | 2026-05-20 |
| `SecuritySubstrateSnapshot` | 2 | 2026-05-20 | 2026-05-21 |
| `AgentOpsReadinessSnapshot` | 2 | 2026-05-20 | 2026-05-22 |
| `AccountingPeriodOpened` | 1 | 2026-05-20 | 2026-05-20 |
| `GovernanceCyclePrep` | 1 | 2026-05-20 | 2026-05-20 |
| `MLROAttestation` | 1 | 2026-05-20 | 2026-05-20 |
| `CdmBindingsRegenerated` | 1 | 2026-05-20 | 2026-05-20 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `IdentityKeyRotated` | 1 | 2026-05-22 | 2026-05-22 |

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

Substrate is broadly stood up and emitting: 45 event types across 240,658 events, 31/31 personas have operating specs, 123 runtime handlers registered, and the three trigger kinds (scheduled, event-driven, on-request) are all first-class. The narrative loop is rolled out across all seven Claude-wired handlers, and `anya:projection-refresh` has fully retired the curated dashboard seed — the recon harness now asserts internal consistency at recon time rather than against a stored cache. What's load-bearing right now is signal-to-noise, not coverage: `SubstrateAlert` accounts for 233,423 of 240,658 events (~97%), which means most of the store is operational chatter rather than decisions or state transitions.

Three consequential changes since the prior snapshot. First, identity and permissions came online on 2026-05-22: `AgentRegistered` (30), `PermissionPolicyPublished` (29), and the first `IdentityKeyRotated` all appear inside a single day — the substrate now has a typed audit trail for who is on the fleet and what they're allowed to do. Second, `RiskRaised` is now flowing (21 events) with Atlas emitting one per tracked substrate gap on his weekly pass, exercising the Zod payload schema end-to-end. Third, the Neon Postgres event store is live with bidirectional sync wrapping every agent workflow under Senna's `TM-NEON-EVENT-STORE-001` exception — the local sqlite remains canonical-shape on every host, and M8 swaps the backing store without code change.

Load-bearing gaps, ranked. (1) `AgentEscalation` has the schema defined but only 6 events in the store — Vera's audit pipelines #14/#15 are gated on this volume, and at six events across three days the pipelines have no real corpus to consume. Handlers need to start emitting on their escalation paths. (2) GitHub Actions cron remains the interim scheduler; the 2026-05-07/08 drops are mitigated by off-the-hour pinning but not fixed — A2.1 (typed `ScheduledTrigger` events from a Bun process; 655 already in the store from in-process triggers) is the permanent path. (3) Neon hardening §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) are deferred-but-required before any sensitive-data event flows; today's events are non-sensitive, but the runway shortens the moment a handler wants to emit anything KYC- or position-shaped.

Next: drive `AgentEscalation` adoption into handler escalation paths so Vera #14/#15 have something to audit, and scope A2.1 to retire the cron shims.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
