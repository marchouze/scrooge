---
agent: Devon
trigger: operational-resilience-snapshot
asOf: 2026-06-08T05:23:42.436Z
decision-required: false
---

# Devon — operational-resilience snapshot, 2026-06-08

Autonomous run of Devon's weekly operational-resilience snapshot per `Team/Devon.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Second handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 6-seat engineering bench · 29 runtime handlers live · 0 incidents (last 7d) · 147 upstream snapshots observed · 1 substrate exception on register.

## Engineering bench

| Seat | Runtime handlers | Keys |
|---|---|---|
| Atlas | 8 | `atlas:substrate-state`, `atlas:goal-loop`, `atlas:event-triage`, `atlas:permission-policy-refresh`, `atlas:collateral-snapshot`, `atlas:ilaap-run`, `atlas:alco-pack`, `atlas:product-narrative-fulfilment` |
| Tomas | 4 | `tomas:payments-readiness`, `tomas:daily-reconciliation`, `tomas:goal-loop`, `tomas:event-triage` |
| Anya | 6 | `anya:goal-loop`, `anya:projection-drift`, `anya:projection-refresh`, `anya:m1-projection-runtime-mapping`, `anya:event-triage`, `anya:liquidity-projection` |
| Niko | 2 | `niko:event-triage`, `niko:client-lifecycle` |
| Imani | 3 | `imani:legal-readiness`, `imani:goal-loop`, `imani:event-triage` |
| Sade | 6 | `sade:agentops-readiness`, `sade:token-usage-analysis`, `sade:efficiency-advisory`, `sade:fleet-optimisation`, `sade:event-triage`, `sade:agent-retirement` |

## Operational events (last 7 days)

| Event | Count |
|---|---|
| `IncidentRaised` | 0 |
| `SLOBudgetBurn` | 0 |
| `CapacityBreach` | 0 |
| `ChangeApproved` | 0 |
| `ResilienceTestResult` | 0 |
| `AuditFinding` (ops-flavoured) | 0 |

_Build-phase posture: incident / SLO / capacity event production runs against synthetic flows only. Live event types activate when the SLO observability projection (Atlas) and the resilience-test harness (Tomas) ship._

## Upstream substrate snapshots (last 7 days)

| Source | Cadence per spec | Observed (last 7d) |
|---|---|---|
| Atlas — `SubstrateStateSnapshot` | weekly | 139 |
| Anya — `DataProjectionSnapshot` | daily | 7 |
| Senna — `SecuritySubstrateSnapshot` | weekly | 1 |

## Substrate exceptions on register

- `TM-NEON-EVENT-STORE-001`

## Substrate gaps surfaced this run

- **RTO/RPO definitions per service tier** — not yet authored. Devon + Atlas + Senna co-author at next governance cycle (per fleet-rollout plan §7 #8).
- **Resilience-test harness** — Tomas's substrate; not yet built. `ResilienceTestResult` event-type registered but no producer.
- **SLO observability projection** — Atlas's substrate; in scope but not yet specified. SLO budget-burn detection depends on this.
- **Capacity-projection** — Anya / Atlas joint; not yet built. `CapacityBreach` event-type registered but no producer.
- **Engineering-bench coverage** — 0 of 6 seats have no runtime handler yet (engineering personas: ).

## Devon's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbqEYZDnhVPJj5cQ6nGad"})._

## Provenance

Engineering-bench from CLAUDE.md top-of-house memory; runtime-handler coverage from `runtime/handlers-metadata.ts`; event counts via `eventStore.replay({type:...})` filtered to last 7 days; substrate-exception IDs parsed from `Owner Inbox/2026-05-07_owen_substrate-exception-register.md`.
