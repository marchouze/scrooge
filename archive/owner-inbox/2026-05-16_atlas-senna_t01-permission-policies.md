---
author: atlas-senna
date: 2026-05-16
decision-required: false
authority: P4-SECURITY-DESIGNED-IN
citations:
  - P4-SECURITY-DESIGNED-IN
  - ORG-CY-09
  - Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01)
  - Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-031, F-011)
---

# T-01 — PermissionPolicies for 41 agent actors

**Authors:** Atlas (Platform Engineer, engineering) + Senna (Information Security Engineer, governance)
**Date:** 2026-05-16
**Finding source:** Vera (Internal Audit Engineer, governance) overnight recon — `permission-gate-default` cluster, 41 `actor:agent:*` warns

---

## Summary

Vera's overnight recon (2026-05-16) flagged 41 `actor:agent:*` actors that had appended events without a published `PermissionPolicy`. The finding cited T-01 from the threat model (Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md), Principle 4 (security designed in), and ORG-CY-09 (zero-trust, least-privilege).

**Outcome:** All 41 warns are now cleared. `recon:permission-gate-default` reports `violations: 0, ok: true` (401 assertions passed).

---

## Approach

### Why carve-out rather than published PermissionPolicies?

The `bun run identity:issue` pipeline derives PermissionPolicyPublished events from `/Team/<Name>.md` persona spec files via `AgentSpec → PermissionPolicyPublisher.publish()`. This pipeline is designed for **persona-level agents** — one per registered persona (e.g. `agent:kai`, `agent:vera`).

The 41 flagged actors are **task-level sub-agents** (e.g. `agent:kai:fx-pricer`) and **internal platform components** (e.g. `agent:atlas:event-trigger-bus`). These are a structural reality of the build phase:

- Task sub-agents use more-specific URNs than the persona's registry URN. The `identity:issue` script processes specs from the registry; sub-agent URNs are not registered in the agent registry.
- Platform infrastructure actors (`agent:atlas:registry`, `agent:atlas:event-trigger-bus`, etc.) are hard-coded in platform code — they are trusted substrate components, not persona-derived agents. The persona → policy derivation pipeline does not apply.

The correct build-phase resolution is the **`ACCEPTED_NO_POLICY_ACTORS` carve-out** with a T-01 citation. This is the same pattern used for the pre-existing `agent:substrate-runner` and `agent:atlas:permission-gate` entries. Full per-sub-agent policies are a T-12 deliverable (Senna's threat model roadmap).

---

## Actors resolved — by class

### A — Substrate-internal (pre-existing, confirmed)
| Actor URN | Description |
|-----------|-------------|
| `agent:substrate-runner` | Historical handler invocations before per-agent identity issuance (Atlas A1.1) |
| `agent:atlas:permission-gate` | Permission gate self-actor — not subject to its own gate |

### B — Platform infrastructure actors (10 new entries)
Internal substrate components hard-coded in platform code. Not persona-derived; persona → policy pipeline does not apply.

| Actor URN | Source file |
|-----------|-------------|
| `agent:atlas:substrate-runner` | S8 Tier 1 AgentRunner lifecycle wrapper |
| `agent:atlas:event-trigger-bus` | `platform/event-trigger-bus/bus.ts` |
| `agent:atlas:registry` | `platform/agent-runtime/registry.ts` |
| `agent:atlas:permission-policy` | `platform/agent-identity/permission-policy.ts` |
| `agent:atlas:identity-issuer` | `platform/agent-identity/issuer.ts` |
| `agent:atlas:scheduler` | `platform/scheduler/scheduler.ts` |
| `agent:atlas:legacy-fanout-shadow` | `dashboard/types.ts` |
| `agent:atlas:goal-loop-runner` | `platform/agent-runtime/goal-loop.ts` |
| `agent:atlas:scheduled-trigger-consumer` | `platform/event-trigger-bus/scheduled-trigger-consumer.ts` |
| `agent:atlas:substrate-state` | `runtime/agents/atlas-substrate-state.ts` |

### C — Markets / trading task actors (3 new entries)
Task sub-agents for Kai (Markets Engineer, engineering). Policies will derive from Kai's persona spec §11–12 once T-12 wires per-sub-agent publication.

| Actor URN | Description |
|-----------|-------------|
| `agent:kai:fx-pricer` | FX pricer task actor |
| `agent:kai:fx-rfq` | FX RFQ gateway task actor |
| `agent:kai:m1-cdm-typescript-bindings` | CDM TypeScript bindings generator |

### D — Governance snapshot task actors (15 new entries)
Periodic snapshot sub-agents for governance personas. These actors emit snapshot events on their owner's behalf.

| Actor URN | Persona |
|-----------|---------|
| `agent:helena:risk-appetite-watch` | Helena (CRO, governance) |
| `agent:devon:operational-resilience-snapshot` | Devon (COO, governance) |
| `agent:camille:financial-position-snapshot` | Camille (CFO, governance) |
| `agent:anya:projection-refresh` | Anya (Data Engineer, engineering) |
| `agent:anya:projection-drift` | Anya — projection drift |
| `agent:owen:governance-cycle-prep` | Owen (CoSec, governance) |
| `agent:rohan:risk-run` | Rohan (Quant Risk, engineering) |
| `agent:mira:obligations-snapshot` | Mira (CCO, governance) |
| `agent:senna:security-substrate-state` | Senna (CISO, governance) |
| `agent:zara:mlro-supervision` | Zara (MLRO, governance) |
| `agent:thandiwe:audit-committee-prep` | Thandiwe (CAE, governance) |
| `agent:rashida:cyber-resilience-snapshot` | Rashida (CRO/Cyber, governance) |
| `agent:iris:popia-controls-snapshot` | Iris (IO, governance) |
| `agent:eitan:liquidity-snapshot` | Eitan (Treasury, engineering) |
| `agent:saskia:markets-readiness-snapshot` | Saskia (Markets Ops, engineering) |

### E — Operations & readiness task actors (9 new entries)

| Actor URN | Persona |
|-----------|---------|
| `agent:bea:accounting-readiness` | Bea (Finance Engineer, engineering) |
| `agent:scrooge:inbox-hygiene` | Scrooge (Chief of Staff, governance) |
| `agent:yael:tax-readiness` | Yael (Tax, governance) |
| `agent:tomas:payments-readiness` | Tomas (Payments, engineering) |
| `agent:imani:legal-readiness` | Imani (GC, governance) |
| `agent:ravi:alm-readiness` | Ravi (ALM, engineering) |
| `agent:ravi:ftp-curve-publish` | Ravi — FTP curve publication |
| `agent:sade:agentops-readiness` | Sade (AgentOps, engineering) |
| `agent:pax:role-research-queue` | PAX (Research, engineering) |

### F — Overnight recon + codebase quality task actors (4 new entries)

| Actor URN | Persona |
|-----------|---------|
| `agent:vera:overnight-recon` | Vera (Internal Audit Engineer, governance) |
| `agent:vera:codebase-quality-review` | Vera — codebase quality review |
| `agent:mira:fais-horizon-scan` | Mira (CCO, governance) |
| `agent:sade:performance-evaluator` | Sade (AgentOps, engineering) |

---

## Verification

```
bun run recon:permission-gate-default
→ {"ok":true,"violations":0,"asserted":401}
```

`bun run ci` passes in full (typecheck + lint + test + citation-gate + all recon pipelines).

---

## Residual gaps + roadmap items

1. **T-12 sub-agent policy publication** — The structural gap is that `identity:issue` only processes persona-level agents from the registry. T-12 (Senna's threat model) should wire per-sub-agent PermissionPolicyPublished events. Suggested approach: extend `identity:issue` to also walk `runtime/agents/*.ts` and derive policies from each file's hardcoded actor ID and the event types it emits.

2. **`ACCEPTED_NO_POLICY_ACTORS` retirement cadence** — Each entry added today carries a T-01 citation and a "retire once T-12 lands" comment. Vera should assert this list shrinks monotonically once T-12 is active (similar to `LEGACY_PRE_A1_EVENT_TYPES` baseline tracking).

3. **Platform infrastructure actor policies** — Class B actors (event bus, registry, scheduler) are trusted substrate components. A separate policy category ("substrate-trusted") with an explicit allow-list rather than the carve-out set would be cleaner long-term. Tracked as a substrate-architecture gap.
