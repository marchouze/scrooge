---
title: Deprecated entity-reference audit — BANK-ZA-001 in the canonical event store
author: Vera (Internal audit engineer, governance — functional reporting to Thandiwe (Chief Audit Executive, governance))
date: 2026-05-21
classification: governance-seat
register-key: documents
decision-required: false
citations:
  - D-PARTY-REGISTER
  - PR #669
  - PR #666
  - PR #672
  - Regulations/_party-register.md
  - prototype/platform/identity/entity-short-ids.ts
---

# Deprecated entity-reference audit — `BANK-ZA-001` in the canonical event store

**Author:** Vera (Internal audit engineer, governance — functional reporting to Thandiwe (Chief Audit Executive, governance))
**Date:** 2026-05-21
**Brief:** `brief:vera:audit-production-event-store-for-deprecated-bank:2026-05-21` (Scrooge, Chief of Staff)
**Workstream:** WS-MARKET-RISK-PROCEDURES (substrate hygiene)
**Scope:** read-only audit of the canonical event store; surface findings + recommend remediation; do NOT remediate in this PR.

## 1. Question

Owen (Company Secretary, governance) flagged in PR #672 close-out that the original D-OPRISK-ENGINEER-ROLE script (PR #666) used `entity: "BANK-ZA-001"` — canonical at the time, but retired by Atlas (Core banking platform architect, engineering) + Imani (Chief Legal Counsel, governance) in the entity-identity unification (PR #669, merged 2026-05-21 08:57Z UTC). `recon:entity-identity-coherence` is now hard-fail on any non-canonical `entity` value.

This audit answers:

1. Are there any events with `entity: "BANK-ZA-001"` (or any other non-canonical short-id) still in the canonical store?
2. If yes, what kinds, which agents, when?
3. What is the right remediation path per cohort — re-emit, migrate-in-place, or document as historical-immutable?

## 2. Method

- Iterate every event in the canonical store via `eventStore.replay({})` (composition root; same store the recon walks).
- For each event whose `entity` is not in `LEGAL_ENTITY_SHORT_ID_REGISTRY` with status `active`, accumulate per `(entity, type, actor.id)` group.
- Per group, record `count`, `earliestAsOf`, `latestAsOf`, and `postCutoverCount` (events emitted at or after the migration boundary).

- **Migration boundary:** `2026-05-21T08:57:13.000Z` — the merge timestamp of PR #669 on `main`. Events strictly before this timestamp are immutable history under Principle 1 ("events are the only source of truth"); events at or after this timestamp are live source drift.

- **Canonical active short-ids:** `[LE-ZA-HOZ-BANK]` per `LEGAL_ENTITY_SHORT_ID_REGISTRY`.

## 3. Headline numbers

- Total events in canonical store: **10,917**
- Events with canonical `entity`: **358**
- Events with non-canonical `entity`: **10,559** (96.7%)
- Distinct non-canonical `entity` values: 1 (`BANK-ZA-001`)
- Post-cutover drift groups: **6** (live source paths to fix)
- Post-cutover drift events: **23**

### Entity distribution across the canonical store

| Entity | Status | Count |
|---|---|---:|
| `BANK-ZA-001` | unregistered | 10,559 |
| `LE-ZA-HOZ-BANK` | active | 358 |

## 4. Post-cutover live drift (source-fix candidates)

These 6 group(s) emitted events with the deprecated entity short-id **at or after** the PR #669 cutover. They indicate code paths that still hardcode `BANK-ZA-001` and must be patched at source.

| Entity | Event type | Actor | Count (total) | Post-cutover | Earliest | Latest |
|---|---|---|---:|---:|---|---|
| `BANK-ZA-001` | `SubstrateAlert` | `agent:atlas:permission-gate` | 194 | **5** | 2026-05-17T18:50:48.857Z | 2026-05-21T09:30:00.000Z |
| `BANK-ZA-001` | `ProductDimensionAttested` | `agent:owen:governance` | 7 | **7** | 2026-05-21T09:30:00.000Z | 2026-05-21T09:30:00.000Z |
| `BANK-ZA-001` | `ProductDimensionAttested` | `agent:saskia:cmo` | 7 | **7** | 2026-05-21T09:30:00.000Z | 2026-05-21T09:30:00.000Z |
| `BANK-ZA-001` | `RecordFiled` | `agent:saskia:cmo` | 2 | **2** | 2026-05-21T09:23:45.383Z | 2026-05-21T09:23:45.383Z |
| `BANK-ZA-001` | `ProductProposalRegistered` | `agent:saskia:cmo` | 1 | **1** | 2026-05-21T09:30:00.000Z | 2026-05-21T09:30:00.000Z |
| `BANK-ZA-001` | `ProductDueDiligenceCompleted` | `agent:saskia:cmo` | 1 | **1** | 2026-05-21T09:30:00.000Z | 2026-05-21T09:30:00.000Z |

## 5. Full findings — all non-canonical groups

109 group(s) total, ordered by event count.

| Entity | Event type | Actor | Count | Earliest | Latest | Cohort |
|---|---|---|---:|---|---|---|
| `BANK-ZA-001` | `SubstrateAgentRunStarted` | `agent:atlas:substrate-runner` | 2100 | 2026-05-17T18:50:50.020Z | 2026-05-20T08:06:58.615Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SubstrateAgentRunCompleted` | `agent:atlas:substrate-runner` | 1981 | 2026-05-17T18:51:12.015Z | 2026-05-20T08:06:58.621Z | pre-cutover (historical) |
| `BANK-ZA-001` | `BusDispatched` | `agent:atlas:event-trigger-bus` | 1638 | 2026-05-17T18:51:12.043Z | 2026-05-20T08:06:58.601Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ScheduledTrigger` | `agent:atlas:scheduler` | 447 | 2026-05-17T18:50:48.857Z | 2026-05-20T06:00:27.227Z | pre-cutover (historical) |
| `BANK-ZA-001` | `BusDispatched` | `agent:atlas:scheduled-trigger-consumer` | 447 | 2026-05-17T18:50:48.857Z | 2026-05-20T06:00:27.227Z | pre-cutover (historical) |
| `BANK-ZA-001` | `LegacyFanoutShadowed` | `agent:atlas:legacy-fanout-shadow` | 399 | 2026-05-17T18:51:12.028Z | 2026-05-20T06:00:48.678Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentGoalEvaluated` | `agent:atlas:goal-loop-runner` | 361 | 2026-05-17T18:51:12.194Z | 2026-05-20T06:00:52.542Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentGoalDeferred` | `agent:atlas:goal-loop-runner` | 323 | 2026-05-17T18:51:36.035Z | 2026-05-20T04:01:16.307Z | pre-cutover (historical) |
| `BANK-ZA-001` | `WorkstreamRegistered` | `agent:atlas:substrate-state` | 199 | 2026-05-17T18:54:50.905Z | 2026-05-20T06:00:27.345Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SubstrateAlert` | `agent:atlas:permission-gate` | 194 | 2026-05-17T18:50:48.857Z | 2026-05-21T09:30:00.000Z | mixed (straddles cutover) |
| `BANK-ZA-001` | `DashboardProjectionRefreshed` | `agent:anya:projection-refresh` | 180 | 2026-05-19T08:01:03.288Z | 2026-05-20T06:00:50.684Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `marc@tgv.co.za` | 175 | 2026-05-01T00:00:00.000Z | 2026-05-20T07:03:05.819Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RiskRaised` | `agent:atlas:substrate-state` | 175 | 2026-05-17T18:54:50.905Z | 2026-05-20T06:00:27.345Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ReconResult` | `agent:vera:overnight-recon` | 156 | 2026-05-17T18:50:50.020Z | 2026-05-20T03:58:00.306Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `agent:helena` | 150 | 2026-05-09T00:00:00.000Z | 2026-05-16T10:00:00.000Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SubstrateAgentRunFailed` | `agent:atlas:substrate-runner` | 119 | 2026-05-17T18:55:09.686Z | 2026-05-20T05:37:59.369Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:sade:performance-evaluator` | 113 | 2026-05-17T18:55:51.998Z | 2026-05-20T04:01:58.398Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AuditFinding` | `agent:vera:overnight-recon` | 103 | 2026-05-19T02:13:18.341Z | 2026-05-20T03:58:00.306Z | pre-cutover (historical) |
| `BANK-ZA-001` | `IdentityKeyRotated` | `agent:atlas:identity-issuer` | 88 | 2026-05-19T06:46:22.184Z | 2026-05-21T06:11:28.530Z | pre-cutover (historical) |
| `BANK-ZA-001` | `IRRBBChecked` | `agent:ravi:alm-run` | 80 | 2026-05-19T05:55:49.171Z | 2026-05-20T05:50:20.674Z | pre-cutover (historical) |
| `BANK-ZA-001` | `PermissionPolicyPublished` | `agent:atlas:permission-policy` | 78 | 2026-05-18T05:14:33.261Z | 2026-05-19T14:31:31.501Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SubstrateAlert` | `agent:atlas:scheduled-trigger-consumer` | 73 | 2026-05-17T18:50:48.857Z | 2026-05-20T05:37:59.235Z | pre-cutover (historical) |
| `BANK-ZA-001` | `InboundMessageReceived` | `agent:env:correspondent-advice-sim` | 67 | 2026-05-19T14:40:33.331Z | 2026-05-19T14:40:47.397Z | pre-cutover (historical) |
| `BANK-ZA-001` | `IntradayHQLAStressProjection` | `agent:ravi:intraday-stress` | 64 | 2026-05-19T13:21:19.158Z | 2026-05-20T05:55:23.513Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SubstrateAlert` | `agent:atlas:event-trigger-bus` | 54 | 2026-05-17T18:55:09.485Z | 2026-05-19T07:00:35.110Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `agent:owen` | 50 | 2026-05-15T00:00:00.000Z | 2026-05-15T18:00:00.000Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentEscalation` | `agent:atlas:substrate-state` | 48 | 2026-05-18T06:19:19.634Z | 2026-05-20T06:00:27.345Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentBriefIssued` | `agent:scrooge` | 47 | 2026-05-18T05:01:20.164Z | 2026-05-21T07:56:40.709Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentGoalSelected` | `agent:atlas:goal-loop-runner` | 38 | 2026-05-17T18:51:12.194Z | 2026-05-20T06:00:52.542Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRegistered` | `agent:atlas:registry` | 35 | 2026-05-18T05:17:06.932Z | 2026-05-21T06:11:28.525Z | pre-cutover (historical) |
| `BANK-ZA-001` | `DailyPnLReportGenerated` | `agent:product-control-engine` | 35 | 2026-05-19 | 2026-05-21 | pre-cutover (historical) |
| `BANK-ZA-001` | `SubLedgerPostingEmitted` | `agent:bea:fx-posting-engine` | 30 | 2026-05-18T18:55:48.115Z | 2026-05-20T04:41:32.066Z | pre-cutover (historical) |
| `BANK-ZA-001` | `PartyRegistered` | `system:party-backfill:atlas` | 29 | 2026-05-18T05:17:06.932Z | 2026-05-19T14:31:31.496Z | pre-cutover (historical) |
| `BANK-ZA-001` | `PartyRelationshipAsserted` | `system:party-backfill:atlas` | 29 | 2026-05-18T05:17:07.010Z | 2026-05-19T14:31:31.516Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SubstrateStateSnapshot` | `agent:atlas:substrate-state` | 25 | 2026-05-17T18:54:50.905Z | 2026-05-20T06:00:27.345Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunStarted` | `agent:atlas` | 25 | 2026-05-18T06:08:16.398Z | 2026-05-21T08:15:11.665Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SubLedgerPostingEmitted` | `agent:bea:gl-posting-engine` | 25 | 2026-05-19T06:43:45.257Z | 2026-05-19T15:07:14.319Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunCompleted` | `agent:atlas` | 24 | 2026-05-18T06:08:36.503Z | 2026-05-21T08:15:48.829Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:atlas` | 24 | 2026-05-18T06:08:36.503Z | 2026-05-21T08:15:48.829Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentDecision` | `agent:atlas:substrate-state` | 24 | 2026-05-18T06:19:19.634Z | 2026-05-20T06:00:27.345Z | pre-cutover (historical) |
| `BANK-ZA-001` | `FxTradeExecuted` | `agent:devon:fx-sim-engine` | 22 | 2026-05-18T18:55:47.188Z | 2026-05-19T09:33:50.735Z | pre-cutover (historical) |
| `BANK-ZA-001` | `FxPositionRevalued` | `anya:eod-fx-revaluation` | 15 | 2026-05-19 | 2026-05-19 | pre-cutover (historical) |
| `BANK-ZA-001` | `FxTradeCancelled` | `agent:devon:cancel-bad-fx-trades` | 15 | 2026-05-19T08:20:27.616Z | 2026-05-19T08:20:27.616Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AccountingReadinessSnapshot` | `agent:bea:accounting-readiness` | 14 | 2026-05-17T18:55:36.605Z | 2026-05-20T06:00:50.890Z | pre-cutover (historical) |
| `BANK-ZA-001` | `LCRComputed` | `agent:anya:liquidity-projection` | 12 | 2026-05-19T06:09:42.204Z | 2026-05-20T04:01:25.937Z | pre-cutover (historical) |
| `BANK-ZA-001` | `NSFRComputed` | `agent:anya:liquidity-projection` | 12 | 2026-05-19T06:09:42.204Z | 2026-05-20T04:01:25.937Z | pre-cutover (historical) |
| `BANK-ZA-001` | `DataProjectionSnapshot` | `agent:anya:projection-drift` | 10 | 2026-05-17T18:55:41.275Z | 2026-05-20T04:01:16.599Z | pre-cutover (historical) |
| `BANK-ZA-001` | `InboxHygieneSweep` | `agent:scrooge:inbox-hygiene` | 10 | 2026-05-17T18:55:44.081Z | 2026-05-20T04:27:44.767Z | pre-cutover (historical) |
| `BANK-ZA-001` | `FtpCurvePublished` | `agent:ravi:ftp-curve-publish` | 10 | 2026-05-17T18:55:50.880Z | 2026-05-20T05:45:03.703Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SubstrateAlert` | `agent:atlas:scheduler` | 8 | 2026-05-17T19:00:57.014Z | 2026-05-19T15:21:31.767Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ALMRunCompleted` | `agent:ravi:alm-run` | 8 | 2026-05-19T05:55:49.171Z | 2026-05-20T05:50:20.674Z | pre-cutover (historical) |
| `BANK-ZA-001` | `CollateralInventorySnapshot` | `agent:atlas:collateral-snapshot` | 8 | 2026-05-19T06:09:42.043Z | 2026-05-19T06:30:53.786Z | pre-cutover (historical) |
| `BANK-ZA-001` | `FxSettlementInstructed` | `agent:devon:fx-sim-engine` | 8 | 2026-05-19T09:33:50.735Z | 2026-05-19T14:40:46.070Z | pre-cutover (historical) |
| `BANK-ZA-001` | `PrincipalPayment` | `agent:devon:fx-sim-engine` | 8 | 2026-05-19T09:33:50.735Z | 2026-05-21 | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:ravi:intraday-stress` | 8 | 2026-05-19T13:21:19.158Z | 2026-05-20T05:55:23.513Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `agent:scrooge` | 7 | 2026-05-17T19:30:01.000Z | 2026-05-17T19:30:02.000Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ProductDimensionAttested` | `agent:owen:governance` | 7 | 2026-05-21T09:30:00.000Z | 2026-05-21T09:30:00.000Z | post-cutover (live drift) |
| `BANK-ZA-001` | `ProductDimensionAttested` | `agent:saskia:cmo` | 7 | 2026-05-21T09:30:00.000Z | 2026-05-21T09:30:00.000Z | post-cutover (live drift) |
| `BANK-ZA-001` | `PartyRegistered` | `system:party-backfill:imani` | 6 | 2026-05-18T05:17:07.010Z | 2026-05-21T06:11:28.531Z | pre-cutover (historical) |
| `BANK-ZA-001` | `PartyRelationshipAsserted` | `system:party-backfill:imani` | 5 | 2026-05-18T05:17:07.010Z | 2026-05-18T05:17:07.010Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunStarted` | `agent:devon` | 5 | 2026-05-19T06:51:26.894Z | 2026-05-19T11:57:38.148Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunCompleted` | `agent:devon` | 5 | 2026-05-19T07:03:27.516Z | 2026-05-19T12:03:17.008Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:devon` | 5 | 2026-05-19T07:03:27.516Z | 2026-05-19T12:03:17.008Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ClientCandidateRegistered` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.536Z | 2026-05-18T11:59:52.268Z | pre-cutover (historical) |
| `BANK-ZA-001` | `KYCIdentityCollected` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.567Z | 2026-05-18T12:00:00.023Z | pre-cutover (historical) |
| `BANK-ZA-001` | `KYCIdentityVerified` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.583Z | 2026-05-18T12:00:05.924Z | pre-cutover (historical) |
| `BANK-ZA-001` | `KYCSanctionsPEPScreened` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.601Z | 2026-05-18T12:41:52.594Z | pre-cutover (historical) |
| `BANK-ZA-001` | `KYCUBOResolved` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.616Z | 2026-05-18T12:41:55.569Z | pre-cutover (historical) |
| `BANK-ZA-001` | `KYCRiskRated` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.633Z | 2026-05-18T12:41:58.386Z | pre-cutover (historical) |
| `BANK-ZA-001` | `KYCDecisionMade` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.656Z | 2026-05-18T12:42:41.944Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ClientAccepted` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.656Z | 2026-05-18T12:42:41.944Z | pre-cutover (historical) |
| `BANK-ZA-001` | `LawfulProcessingRegistered` | `agent:atlas:kyc-orchestrator` | 4 | 2026-05-18T11:51:31.656Z | 2026-05-18T12:42:41.944Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SettlementConfirmed` | `agent:devon:fx-sim-engine` | 4 | 2026-05-19T09:33:50.735Z | 2026-05-21 | pre-cutover (historical) |
| `BANK-ZA-001` | `ProductDimensionNarrativeRequested` | `marc@tgv.co.za` | 4 | 2026-05-20T06:29:17.847Z | 2026-05-20T08:06:58.594Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:mira` | 3 | 2026-05-18T10:16:15.878Z | 2026-05-18T10:16:15.878Z | pre-cutover (historical) |
| `BANK-ZA-001` | `FxTradeExecuted` | `agent:env:fx-sim-engine` | 3 | 2026-05-19T14:40:37.279Z | 2026-05-19T14:40:46.070Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ProductDimensionNarrativeRecorded` | `agent:atlas:product-narrative-fulfilment` | 3 | 2026-05-20T07:35:01.147Z | 2026-05-20T08:06:58.615Z | pre-cutover (historical) |
| `BANK-ZA-001` | `GovernanceCyclePrep` | `agent:owen:governance-cycle-prep` | 2 | 2026-05-17T18:55:48.165Z | 2026-05-19T07:31:53.032Z | pre-cutover (historical) |
| `BANK-ZA-001` | `MLROAttestation` | `agent:zara:mlro-supervision` | 2 | 2026-05-17T18:55:49.533Z | 2026-05-18T05:30:51.893Z | pre-cutover (historical) |
| `BANK-ZA-001` | `CdmBindingsRegenerated` | `agent:kai:m1-cdm-typescript-bindings` | 2 | 2026-05-17T18:55:50.088Z | 2026-05-18T06:27:40.401Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunStarted` | `agent:helena` | 2 | 2026-05-19T04:04:24.488Z | 2026-05-19T11:39:44.287Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunCompleted` | `agent:helena` | 2 | 2026-05-19T04:14:27.599Z | 2026-05-19T11:44:48.859Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:helena` | 2 | 2026-05-19T04:14:27.599Z | 2026-05-19T11:44:48.859Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:saskia:cmo` | 2 | 2026-05-21T09:23:45.383Z | 2026-05-21T09:23:45.383Z | post-cutover (live drift) |
| `BANK-ZA-001` | `ObligationsRegisterSnapshot` | `agent:mira:obligations-snapshot` | 1 | 2026-05-17T18:55:48.674Z | 2026-05-17T18:55:48.674Z | pre-cutover (historical) |
| `BANK-ZA-001` | `SecuritySubstrateSnapshot` | `agent:senna:security-substrate-state` | 1 | 2026-05-17T18:55:49.178Z | 2026-05-17T18:55:49.178Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentOpsReadinessSnapshot` | `agent:sade:agentops-readiness` | 1 | 2026-05-17T18:55:51.054Z | 2026-05-17T18:55:51.054Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunStarted` | `agent:senna` | 1 | 2026-05-18T05:12:09.488Z | 2026-05-18T05:12:09.488Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `camille@bank` | 1 | 2026-05-18T07:10:14.252Z | 2026-05-18T07:10:14.252Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `devon@bank` | 1 | 2026-05-18T07:10:14.320Z | 2026-05-18T07:10:14.320Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `zara@bank` | 1 | 2026-05-18T07:10:14.382Z | 2026-05-18T07:10:14.382Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `rashida@bank` | 1 | 2026-05-18T07:11:51.625Z | 2026-05-18T07:11:51.625Z | pre-cutover (historical) |
| `BANK-ZA-001` | `Decision` | `thandiwe@bank` | 1 | 2026-05-18T07:11:51.705Z | 2026-05-18T07:11:51.705Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunStarted` | `agent:owen` | 1 | 2026-05-18T08:49:56.336Z | 2026-05-18T08:49:56.336Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunCompleted` | `agent:owen` | 1 | 2026-05-18T08:57:58.679Z | 2026-05-18T08:57:58.679Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:owen` | 1 | 2026-05-18T08:57:58.679Z | 2026-05-18T08:57:58.679Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunStarted` | `agent:mira` | 1 | 2026-05-18T10:04:21.468Z | 2026-05-18T10:04:21.468Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunCompleted` | `agent:mira` | 1 | 2026-05-18T10:16:15.878Z | 2026-05-18T10:16:15.878Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ManualJournalEntry` | `marc@tgv.co.za` | 1 | 2026-05-18T19:10:49.346Z | 2026-05-18T19:10:49.346Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunCompleted` | `agent:bea` | 1 | 2026-05-19T08:32:11.186Z | 2026-05-19T08:32:11.186Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:bea` | 1 | 2026-05-19T08:32:11.186Z | 2026-05-19T08:32:11.186Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunStarted` | `agent:vera` | 1 | 2026-05-19T11:57:38.236Z | 2026-05-19T11:57:38.236Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunStarted` | `agent:rohan` | 1 | 2026-05-19T11:57:38.365Z | 2026-05-19T11:57:38.365Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunCompleted` | `agent:vera` | 1 | 2026-05-19T12:03:43.573Z | 2026-05-19T12:03:43.573Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:vera` | 1 | 2026-05-19T12:03:43.573Z | 2026-05-19T12:03:43.573Z | pre-cutover (historical) |
| `BANK-ZA-001` | `AgentRunCompleted` | `agent:rohan` | 1 | 2026-05-19T12:17:19.349Z | 2026-05-19T12:17:19.349Z | pre-cutover (historical) |
| `BANK-ZA-001` | `RecordFiled` | `agent:rohan` | 1 | 2026-05-19T12:17:19.349Z | 2026-05-19T12:17:19.349Z | pre-cutover (historical) |
| `BANK-ZA-001` | `ProductProposalRegistered` | `agent:saskia:cmo` | 1 | 2026-05-21T09:30:00.000Z | 2026-05-21T09:30:00.000Z | post-cutover (live drift) |
| `BANK-ZA-001` | `ProductDueDiligenceCompleted` | `agent:saskia:cmo` | 1 | 2026-05-21T09:30:00.000Z | 2026-05-21T09:30:00.000Z | post-cutover (live drift) |

## 6. Remediation recommendation

Per the brief, three remediation paths are available; each finding cohort routes to one. Defended below.

### 6.1 Pre-cutover events (cohort: `pre-cutover`) → **document as historical-immutable**

Defence:

- Principle 1 (events are the only source of truth) makes the event log append-only and immutable. Rewriting the `entity` field in-place violates the principle and corrupts the audit chain — every downstream projection, hash, and provenance lineage was computed against the original `entity` value.
- At the time of emission, `BANK-ZA-001` was the canonical short-id. The events are faithful records of what the substrate decided at that point. The retroactive change is a *naming* event, not a *meaning* event — the underlying legal entity (Hoz Bank Limited, `urn:party:legal-entity:hoz-bank`) is unchanged.
- The unification is structurally encoded in `LEGAL_ENTITY_SHORT_ID_REGISTRY`: the retired `BANK-ZA-001` row would resolve via a future `status: "retired"` entry, mapping to the same Party URN. The audit chain stays intact via the registry, not via event mutation.
- The `recon:entity-identity-coherence` pipeline (Atlas, PR #669) currently hard-fails on any short-id not in `LEGAL_ENTITY_SHORT_ID_REGISTRY`. To accommodate pre-cutover history without weakening the live gate, the recon needs awareness of the migration boundary — see §Block D below.

### 6.2 Post-cutover events (cohort: `post-cutover` or `mixed`) → **source fix + supersession** (do NOT modify the emitted events)

Defence:

- These are *new* drift — code paths that hardcoded `BANK-ZA-001` and continued to fire after PR #669 merged. The mistake is in source, not in the event log. Patching source eliminates future drift without rewriting history.
- For events that carry meaningful state (e.g. `Decision`, `RecordFiled`, `ProductDimensionAttested`), Principle 1 forbids in-place mutation. The right remediation is the standard supersession pattern: emit a corrected event with canonical `entity: "LE-ZA-HOZ-BANK"`, citing the original event_id under `supersedes` / `correctsOriginalErrors`. The recon then resolves the live posture to the corrected event.
- For low-stakes lifecycle scaffolding (e.g. `SubstrateAgentRunStarted`, `BusDispatched`, `AgentRunStarted`, `AgentRunCompleted`), supersession is overkill — these are operational telemetry. The right path is: patch source, accept the pre-fix events as immutable telemetry, and let the migration-boundary exemption (§Block D) cover them.

### 6.3 Migrate-in-place at projection time → **NOT recommended**

Defence:

- The brief mentions "normalise `entity` at projection time" as an option. This is feasible *technically* (projections already JOIN against `LEGAL_ENTITY_SHORT_ID_REGISTRY`) but introduces a parallel ledger: events say `BANK-ZA-001`; projections say `LE-ZA-HOZ-BANK`. Two readers, two answers, depending on which side they query — exactly the divergence PR #669 just closed.
- Cleaner approach: keep events as-emitted (P1); resolve to Party URN at the registry layer; have the recon honour the migration boundary so the gate stays meaningful for post-cutover writes.

### 6.4 Per-finding routing summary

- **103 groups → §6.1 (historical-immutable + migration-boundary exemption).**
- **5 groups → §6.2 (source fix; selective supersession for state-bearing events).**
- **1 groups → §6.2 + §6.1 (source fix going forward; pre-cutover share treated as historical).**

## 7. Block C — Follow-on remediation briefs (recommended)

Three follow-on briefs surface as a consequence of this audit. **Vera does not remediate** — the briefs below are recommendations for Scrooge to dispatch, scoped to a single substrate owner each.

### Brief 1 (Atlas, engineering) — Patch hardcoded `BANK-ZA-001` in production source paths

**Scope.** 7 source files still hardcode `entity: "BANK-ZA-001"`:

- `prototype/scripts/dispatch/close-run.ts:242` — the SubstrateAlert emitted on dispatch-bypass paths. **Fires every close-run that hits the bypass gap.** Highest priority.
- `prototype/scripts/file-saskia-owen-npa-fx-spot.ts:132,172` — NPA gate filing (Saskia + Owen) emits `ProductDimensionAttested` + `RecordFiled` events.
- `prototype/scripts/run-npa-gate-fx-spot.ts:83` — NPA gate scenario runner ENTITY constant.
- `prototype/scripts/file-devon-zara-proc-mk-plg-01-rehearsal.ts:46` — Devon + Zara PROC-MK-PLG-01 rehearsal filing.
- `prototype/scripts/record-d-oprisk-engineer-role.ts:117` — original PR #666 script (one-shot historical; Atlas's call whether to retire the script or just fix the constant).
- `prototype/scripts/run-pre-licence-go-live-rehearsal.ts:72` — pre-licence rehearsal ENTITY constant.
- `prototype/platform/accounting/gl-posting-engine.test.ts:44` — **test-only**, can stay as a documented legacy literal or be migrated to `HOZ_BANK_ENTITY` for hygiene.

**Deliverable.** Single PR that flips each `"BANK-ZA-001"` literal to either `HOZ_BANK_ENTITY` (from `platform/core/types`) or the `LE-ZA-HOZ-BANK` literal. CI gate: `recon:entity-identity-coherence` must remain green on a freshly-replayed scenario after the patch.

**Owner.** Atlas (Core banking platform architect, engineering) — owns the identity substrate.
**Authority.** PR #669 (Atlas + Imani) is the source-of-truth for canonical short-ids; this brief is housekeeping under that authority.

### Brief 2 (Atlas, engineering) — Teach `recon:entity-identity-coherence` about the migration boundary

**Scope.** See §Block D below — minimum change to the recon to accept pre-cutover events as historical-immutable without weakening the live gate for post-cutover writes.

**Deliverable.** Single PR; updates `prototype/platform/recon/entity-identity-coherence.ts` to honour a `MIGRATION_BOUNDARY_TIMESTAMP` (constant exported from the same module). Pre-cutover events with retired-but-registered short-ids degrade to a structural `warn`-class violation, not `fail`. Unregistered short-ids stay hard-fail in every era.

**Owner.** Atlas (Core banking platform architect, engineering) — owns the recon.
**Authority.** This audit (Vera) recommends; CEO approval gates because the change relaxes a live recon gate.

### Brief 3 (Owen, governance) — Add a `retired` row for `BANK-ZA-001` to `LEGAL_ENTITY_SHORT_ID_REGISTRY`

**Scope.** Currently `LEGAL_ENTITY_SHORT_ID_REGISTRY` has exactly one row (`LE-ZA-HOZ-BANK`, status `active`). Adding a second row with `shortId: "BANK-ZA-001"`, `partyUrn: "urn:party:legal-entity:hoz-bank"`, `status: "retired"`:

- preserves the upward chain from every pre-cutover event to its canonical Party URN (audit chain intact);
- lets `lookupShortId("BANK-ZA-001")` succeed (with `status: "retired"`) rather than returning `null`, which `recon:entity-identity-coherence` currently treats as the most severe failure class ("unregistered");
- combined with Brief 2's migration-boundary awareness, lets the recon discriminate cleanly between "pre-cutover retired short-id" (acceptable, warn-class) and "unregistered short-id, ever" (always fail).

**Deliverable.** Single small PR adding the row and an idempotent `PartyRegistered{kind:"legal-entity"}` backfill event in case the Party register's `BANK-ZA-001`-era row isn't yet linked. Cross-cite to PR #669.

**Owner.** Owen (Company Secretary, governance) — owns the Party register; PR #669 was Imani + Atlas, but the registry row is governance bookkeeping.
**Authority.** D-PARTY-REGISTER + PR #669; this is the housekeeping companion.

## 8. Block D — Minimum change to `recon:entity-identity-coherence`

Proposed (not implemented in this PR — see Brief 2):

```ts
// platform/recon/entity-identity-coherence.ts

// Source-cutover for the entity-identity unification (PR #669).
// Events emitted strictly BEFORE this timestamp predate the
// unification decision and are immutable history under Principle 1.
// Retired-but-registered short-ids in this window degrade from fail
// to warn; unregistered short-ids stay fail in every era.
export const MIGRATION_BOUNDARY_TIMESTAMP = "2026-05-21T08:57:13.000Z";

// ... inside `run()`, in the existing per-event branch:
if (entry.status !== "active") {
  const preMigration = ev.as_of < MIGRATION_BOUNDARY_TIMESTAMP;
  violations.push({
    subject: `event:${ev.event_id}:${ev.type}`,
    severity: preMigration ? "warn" : "fail",
    message: preMigration
      ? `event.entity "${ev.entity}" resolves to a retired Party register row; pre-cutover history per migration boundary ${MIGRATION_BOUNDARY_TIMESTAMP}.`
      : `event.entity "${ev.entity}" resolves to a retired Party register row. Post-cutover writes must use canonical short-id. Authority: D-PARTY-REGISTER + PR #669.`,
  });
}
```

This change:

- preserves the hard-fail for any unregistered short-id (line 102 of the current recon — the `entry === null` branch — stays unchanged);
- preserves the hard-fail for post-cutover retired-short-id writes (the `else` branch under `status !== active` is unchanged for post-cutover events);
- adds the `warn` carve-out only for pre-cutover events with a retired-but-registered short-id — the exact cohort this audit identifies as historical-immutable;
- requires Brief 3 (the `retired` row for `BANK-ZA-001` in the registry) to be merged first, otherwise pre-cutover events still resolve to `null` and stay hard-fail.

**Important.** This is NOT a bypass. Every pre-cutover event with a retired short-id still produces an audit-trail entry (warn-class). The structurally-honest interpretation is: the substrate notes the legacy short-id, links it to its canonical Party URN via the registry, and surfaces the divergence as a non-blocking observation rather than treating immutable history as a live failure.

## 9. Out of scope (for this PR)

- **No source patches.** All three follow-on briefs are recommendations; Vera does not implement.
- **No event-store mutations.** Read-only audit (Principle 1).
- **No Party register edits.** Owen's brief.
- **No `LEGAL_ENTITY_SHORT_ID_REGISTRY` edits.** Owen's brief.
- **No recon edits.** Atlas's brief.
- **Other deprecated identifiers** (e.g. legacy actor URN forms) are out of scope per the brief — this audit is specifically `BANK-ZA-001`.

## 10. Citations

- D-PARTY-REGISTER (CEO-approved 2026-05-11) — Party register heads the identity chain.
- PR #669 — Atlas + Imani: entity-identity unification (merged 2026-05-21 08:57Z UTC).
- PR #666 — Owen: D-OPRISK-ENGINEER-ROLE decision card (the original offender Owen flagged).
- PR #672 — Owen: Option B implementation (surfaced this audit).
- `Regulations/_party-register.md` — canonical Party register.
- `prototype/platform/identity/entity-short-ids.ts` — resolution authority.
- `prototype/platform/recon/entity-identity-coherence.ts` — the live recon this audit complements.
- Principle 1 — events are the only source of truth (immutable, append-only).
- Principle 2 — single-graph discipline (Party register → short-id registry → event-store `entity` field).
