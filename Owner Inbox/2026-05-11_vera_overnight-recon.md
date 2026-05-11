---
agent: Vera
trigger: overnight-recon
asOf: 2026-05-11T05:51:44.968Z
decision-required: false
---

# Vera — overnight recon, 2026-05-11

Autonomous run of Vera's continuous-controls pipelines per `Team/Vera.md` operating spec § 6 (Cadence) and § 7 (Triggers). Run by the agent runtime; no human-in-the-loop.

**Headline:** FAIL — 1204 assertions; 1 fail violations; 26 warn violations across 7 pipelines.

## Pipeline results

| Pipeline | OK | Asserted | Fail | Warn |
|---|---|---|---|---|
| mandate-ownership-integrity | ✓ | 122 | 0 | 0 |
| decision-event-reconciliation | ✗ | 99 | 1 | 0 |
| dashboard-derivation-reconciliation | ✓ | 140 | 0 | 5 |
| no-prose-duplication-of-canonical-facts | ✓ | 70 | 0 | 0 |
| permission-gate-default | ✓ | 381 | 0 | 7 |
| event-type-registry-coverage | ✓ | 342 | 0 | 14 |
| decision-required-event-pairing | ✓ | 50 | 0 | 0 |

## Findings

### decision-event-reconciliation

- **[fail]** `D-MARKETS-CAPITAL-TIME-SHAPE` — Event store has CeoDecision D-MARKETS-CAPITAL-TIME-SHAPE but derived decisionsResolved does not surface it

### dashboard-derivation-reconciliation

- **[warn]** `WS-REPORTING-M2-M3` — In-flight item WS-REPORTING-M2-M3 owner "Atlas + Anya + Bea" does not resolve to a direct report or known governance seat
- **[warn]** `WS-PROCEDURES-DRAFTING` — In-flight item WS-PROCEDURES-DRAFTING owner "Domain leads" does not resolve to a direct report or known governance seat
- **[warn]** `WS-INSTRUMENT-ANALYSES` — In-flight item WS-INSTRUMENT-ANALYSES owner "Mira" does not resolve to a direct report or known governance seat
- **[warn]** `WS-SUBSTRATE-BUDGET` — In-flight item WS-SUBSTRATE-BUDGET owner "Atlas + Anya" does not resolve to a direct report or known governance seat
- **[warn]** `WS-AGENT-RUNTIME-SUBSTRATE` — In-flight item WS-AGENT-RUNTIME-SUBSTRATE owner "Atlas + Anya" does not resolve to a direct report or known governance seat

### permission-gate-default

- **[warn]** `actor:agent:atlas:registry` — Agent actor `agent:atlas:registry` has appended events without a published PermissionPolicy. Publish via `bun run identity:issue` or add to ACCEPTED_NO_POLICY_ACTORS with a citation if the carve-out is intentional. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:atlas:identity-issuer` — Agent actor `agent:atlas:identity-issuer` has appended events without a published PermissionPolicy. Publish via `bun run identity:issue` or add to ACCEPTED_NO_POLICY_ACTORS with a citation if the carve-out is intentional. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:atlas:permission-policy` — Agent actor `agent:atlas:permission-policy` has appended events without a published PermissionPolicy. Publish via `bun run identity:issue` or add to ACCEPTED_NO_POLICY_ACTORS with a citation if the carve-out is intentional. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:atlas:scheduler` — Agent actor `agent:atlas:scheduler` has appended events without a published PermissionPolicy. Publish via `bun run identity:issue` or add to ACCEPTED_NO_POLICY_ACTORS with a citation if the carve-out is intentional. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:atlas:substrate-runner` — Agent actor `agent:atlas:substrate-runner` has appended events without a published PermissionPolicy. Publish via `bun run identity:issue` or add to ACCEPTED_NO_POLICY_ACTORS with a citation if the carve-out is intentional. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:vera:overnight-recon` — Agent actor `agent:vera:overnight-recon` has appended events without a published PermissionPolicy. Publish via `bun run identity:issue` or add to ACCEPTED_NO_POLICY_ACTORS with a citation if the carve-out is intentional. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).
- **[warn]** `actor:agent:atlas:scheduled-trigger-consumer` — Agent actor `agent:atlas:scheduled-trigger-consumer` has appended events without a published PermissionPolicy. Publish via `bun run identity:issue` or add to ACCEPTED_NO_POLICY_ACTORS with a citation if the carve-out is intentional. Citations: P4-SECURITY-DESIGNED-IN, ORG-CY-09, Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01), Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011).

### event-type-registry-coverage

- **[warn]** `event-type:AuditCommitteePackPrepped` — Event type `AuditCommitteePackPrepped` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:CyberResilienceSnapshot` — Event type `CyberResilienceSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:TaxReadinessSnapshot` — Event type `TaxReadinessSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:RoleResearchQueueSnapshot` — Event type `RoleResearchQueueSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:ALMReadinessSnapshot` — Event type `ALMReadinessSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:LiquiditySnapshot` — Event type `LiquiditySnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:LegalReadinessSnapshot` — Event type `LegalReadinessSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:PaymentsReadinessSnapshot` — Event type `PaymentsReadinessSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:RiskRunCompleted` — Event type `RiskRunCompleted` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:POPIAControlsSnapshot` — Event type `POPIAControlsSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:OperationalResilienceSnapshot` — Event type `OperationalResilienceSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:MarketsReadinessSnapshot` — Event type `MarketsReadinessSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:FinancialPositionSnapshot` — Event type `FinancialPositionSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).
- **[warn]** `event-type:RiskAppetiteSnapshot` — Event type `RiskAppetiteSnapshot` is referenced by eventStore.append but has no row in EVENT_TYPE_REGISTRY (`platform/event-store/registry.ts`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: P1-EVENTS-AS-TRUTH, P6-SINGLE-GRAPH-DISCIPLINE, Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md, Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032).

## Vera's narrative

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Mechanical recon results above stand on their own. Set the secret in GitHub Actions to enable narrative generation._

## Substrate

Pipelines invoked: `mandate-ownership`, `decision-event`, `dashboard-derivation`, `prose-duplication`, `permission-gate-default`, `event-type-registry-coverage`, `decision-required-event-pairing`. Citation gate runs separately under `bun run citation-gate` / CI; future runs will wrap it here.

Events emitted: one `ReconResult` per pipeline (7); one `AuditFinding` per fail violation (1).

Routing: fail violations recommend owner `Thandiwe` (CAE) per Vera spec § 9. Warn violations are tracked but not escalated unless they cluster.
