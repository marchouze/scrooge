---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-07T13:48:50.638Z
decision-required: false
---

# Atlas — substrate state, 2026-05-07

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 450 events across 21 types; 28/28 personas have operating specs; 11 runtime handlers registered; 67 files in /Owner Inbox/; 6 substrate gaps tracked.

## Event store

Path: `.local/event.db` · Total events: 450

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ReconResult` | 92 | 2026-05-07 | 2026-05-07 |
| `RiskRaised` | 90 | 2026-05-07 | 2026-05-07 |
| `WorkstreamRegistered` | 78 | 2026-05-07 | 2026-05-07 |
| `CeoDecision` | 33 | 2026-05-06 | 2026-05-07 |
| `SubstrateStateSnapshot` | 27 | 2026-05-07 | 2026-05-07 |
| `DataProjectionSnapshot` | 18 | 2026-05-07 | 2026-05-07 |
| `InboxHygieneSweep` | 18 | 2026-05-07 | 2026-05-07 |
| `GovernanceCyclePrep` | 18 | 2026-05-07 | 2026-05-07 |
| `ObligationsRegisterSnapshot` | 18 | 2026-05-07 | 2026-05-07 |
| `SecuritySubstrateSnapshot` | 18 | 2026-05-07 | 2026-05-07 |
| `DashboardProjectionRefreshed` | 17 | 2026-05-07 | 2026-05-07 |
| `AuditFinding` | 10 | 2026-05-07 | 2026-05-07 |
| `WorkstreamCompleted` | 3 | 2026-05-07 | 2026-05-07 |
| `WorkstreamStarted` | 2 | 2026-05-06 | 2026-05-07 |
| `CitationGatePassed` | 2 | 2026-05-07 | 2026-05-07 |
| `ClientCandidateRegistered` | 1 | 2026-05-06 | 2026-05-06 |
| `ClientIdentityVerified` | 1 | 2026-05-06 | 2026-05-06 |
| `KYCRuleEvaluated` | 1 | 2026-05-06 | 2026-05-06 |
| `RiskRatingAssigned` | 1 | 2026-05-06 | 2026-05-06 |
| `ClientAccepted` | 1 | 2026-05-06 | 2026-05-06 |
| `AgentEscalation` | 1 | 2026-05-07 | 2026-05-07 |

## Personas — operating-spec coverage

28 of 28 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

11 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

| Agent | Trigger |
|---|---|
| Vera | `overnight-recon` |
| Atlas | `substrate-state` |
| Anya | `projection-drift` |
| Anya | `projection-refresh` |
| Scrooge | `inbox-hygiene` |
| Scrooge | `ceo-decision-record` |
| Scrooge | `follow-on-router` |
| Owen | `governance-cycle-prep` |
| Mira | `obligations-snapshot` |
| Mira | `citation-gate` |
| Senna | `security-substrate-state` |

## Substrate gaps

Tracked engineering items that block agents from running fully autonomously. Each closes when the corresponding substrate work lands.

- Event store: cloud-shared via Neon Postgres (`BANK_EVENT_DB_URL`); local sqlite remains canonical-shape on every host. Bidirectional sync runs before/after every agent workflow via `bun run event-store:sync`. Senna threat model APPROVED for build-phase use under exception `TM-NEON-EVENT-STORE-001` (Owen's substrate-exception register). Hardening conditions §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) deferred while events remain non-sensitive; required before any sensitive-data event flows. M8 cloud lift swaps Neon for Neon-on-Azure or Azure Postgres without code change.
- Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised — DEFINED in `platform/event-store/event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Atlas now emits one RiskRaised per substrate gap on his weekly run, exercising the schema. The remaining three types are available for handlers to adopt as their decision / escalation / workstream paths are wired; Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.
- Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).
- Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.
- Projection-cache persistence: now closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives `prototype/seeds/dashboard-state.json` from canonical sources + the live event store and writes it to disk. Fans out from any parent run whose appended events match the subscription set; emits `DashboardProjectionRefreshed` for audit.
- Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).

## Atlas's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Substrate snapshot above stands on its own._

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
