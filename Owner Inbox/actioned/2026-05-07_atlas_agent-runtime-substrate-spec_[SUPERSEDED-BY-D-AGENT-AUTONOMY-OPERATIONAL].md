---
title: Agent-runtime substrate — specification
author: Atlas
date: 2026-05-07
summary: Substrate hosting the autonomous-agent fleet (Principle 7) — identity, scheduler, event-trigger bus, run lifecycle, escalation channel, oversight UI. Local-first; Azure-lift-compatible. A0–A5 build phases specified.
decision-required: true
decision-id: D-AGENT-RUNTIME-AUTHORIZE
decision-category: near-term
decision-owner: Atlas (build) · Devon (governance)
decision-for-ceo: Authorise build of the agent-runtime substrate (phases A0–A3) so the autonomous-agent doctrine becomes operational rather than session-simulated.
decision-recommendation: Approve A0 schema-freeze immediately; sequence A1–A3 over ~5 weeks. Defer M8 cloud-lift sign-off until post-licence.
---

# Agent-runtime substrate — specification

**Author:** Atlas (Core banking platform architect)
**Reports through:** Devon (COO)
**Contributors / dependencies:** Senna (security primitives, agent identity), Rashida (CISO — zero-trust policy envelope), Anya (data substrate, event schemas), Vera (audit hooks — `AgentEscalation` / `AgentDecision` shapes for Wave-4 #14, #15), Iris (POPIA-by-design for the oversight UI), Owen (procedure binding).
**Date:** 2026-05-07
**For:** Marc (CEO)
**Authority:** Principle 7 (Autonomous by default; humans oversee the residual), CLAUDE.md as of 2026-05-07. Step 2 of the four-step rollout (Steps in order: Vera CCM extension ✓ → persona-spec rollout ✓ → **Atlas runtime substrate spec** → procedure audit).
**Status:** **Specification only — no build at this stage.** Build follows under Atlas + Senna + Devon, sequenced in §10.

> **Derivation note (Principle 6 — downward).** This spec sits at the *standard* layer (technical specification of the substrate processes will run on). It cites the Information Security Policy, the Cyber Resilience Policy, the Change Management Policy, the Secure SDLC Policy, the Operational Risk Policy, and the (planned) Internal Audit Charter. It implements the operational shape Principle 7 requires; it does not author principle-level substance independently.

---

## 1. Purpose

Specify the substrate on which every persona in `/Team/` runs as a standing autonomous agent (Principle 7). The substrate must:

- **Run agents continuously** — schedule, trigger, execute, log, retire — without a human-in-the-loop for steady-state operation.
- **Enforce zero-trust agent identity** — every agent acts as a typed identity with scoped permissions; no implicit trust based on co-location.
- **Carry typed escalations** — when an agent reaches a decision outside its scope, it produces an `AgentEscalation` event consumed by a named human overseer (today: Marc as CEO via the Owner Inbox; soon: a coded oversight UI).
- **Be auditable end-to-end** — every agent run, every decision, every escalation is an event in the event store (Principle 1) carrying a citation (Principle 2). Vera's Wave-4 pipelines #10–#15 read this stream directly.
- **Honour Principle 3's implementation sequence** — full local build first, lift to Azure as a single coherent phase. Substrate-replacement seams are designed in from day one.

The substrate does **not** carry domain logic. Each agent's `decisions in scope`, `procedures owned`, and `data contracts` are defined in its `/Team/<name>.md` file and in the procedures library; the substrate is the runtime that hosts them.

## 2. Architectural principles applied

- **P1 (Events as truth).** Every substrate operation is an event: `AgentRegistered`, `AgentRunStarted`, `AgentRunCompleted`, `AgentDecision`, `AgentEscalation`, `AgentRetired`. The agent run-log is a query over those events, not stored authoritative state.
- **P2 (Traceability).** Every substrate event carries a citation slot. Agents emit decisions with citations into the obligations register or their owning procedure. Escalations cite the `decisions that escalate` table row in the agent's spec.
- **P3 (Cloud-native, no manual).** The substrate runs end-to-end without operator intervention in steady state. Operator access is just-in-time, recorded as events, and short-lived. Local-first build per the CEO directive of 2026-05-06; Azure-lift mapping in §6.
- **P4 (Security designed in).** Agents authenticate per request, agents authorise per decision, and every action is logged. Threat model: agent compromise (impersonation, escalation-bypass, capability-creep). Mitigations: per-agent identity binding, signed `AgentDecision` events, capability-creep detection (Vera Wave-5), HSM-backed signing keys.
- **P5 (Multi-everything).** Agent specs and substrate events carry currency / legal-entity / jurisdiction context where applicable. The scheduler is calendar-aware (jurisdictional holidays). Agents that produce multi-entity events (e.g. Mira's transaction-monitoring across legal entities) declare the entity scope in their spec.
- **P6 (Single-graph).** Every substrate capability binds to a procedure (§7). No orphan capabilities. Agents are mandate-bearing — Wave-4 #12 reconciles bidirectionally.
- **P7 (Autonomous by default).** The substrate's existence is the operational realisation of P7. Until §9's components land, agents run via Scrooge in-session; that is a substrate gap, not a steady state.

## 3. Components

### 3.1 Agent Identity & Permissioning

Each persona file in `/Team/<name>.md` resolves to exactly one agent identity. The substrate issues:

- **Agent ID** — stable URN: `agent:<name>` (lowercase persona name). Bound at registration.
- **Agent identity certificate** — short-lived signing key (HSM-backed in production; software-backed locally), scoped to the agent's `system capabilities called` set in §12 of its spec.
- **Permission policy** — generated from the agent's spec: capability allow-list, event-stream subscribe allow-list, event-emit allow-list, register write allow-list. Stored as a `PermissionPolicyPublished` event.
- **Re-issuance cadence** — keys rotate every 24h (production) / 7d (local). Rotation is a `IdentityKeyRotated` event.

**Architectural seam:** `@platform/agent-identity/AgentIdentityIssuer` — `issue(agentSpec)`, `rotate(agentId)`, `verify(token, capability)`. Local: software-backed crypto. Cloud: Azure Entra ID workload identity + Key Vault Managed HSM.

**Audit boundary:** Vera's identity has a hardcoded carve-out — read-only on every stream regardless of permission policy. Enforced at the substrate layer; not configurable per-installation.

### 3.2 Scheduler

Wakes scheduled agents per their spec's §6 cadence. Implemented as a deterministic event-emitting clock.

- **Schedule registry** — derived from agent specs at registration. Each entry: `agentId`, `cron-or-natural-language`, `nextRunAt`, `lastRunAt`.
- **Wake mechanism** — emits a `ScheduledTrigger` event addressed to the agent. The agent's run-handler subscribes to its own scheduled-trigger stream.
- **Calendar awareness** — schedules carry jurisdictional calendar (P5). South African public holidays for the local SA entity; per-jurisdiction extension when entities multiply.
- **Inactivity SLA enforcement** — if an agent fails to emit an `AgentRunCompleted` within its declared inactivity SLA, the scheduler emits a `SubstrateAlert` consumed by Atlas (and by Vera's pipeline #13).

**Architectural seam:** `@platform/scheduler/Scheduler` — `register(scheduleEntry)`, `tick(now)`, `inactivityCheck()`. Local: Bun-process polling SQLite at 1Hz. Cloud: Azure Container Apps Jobs + Logic Apps for the cron surface.

### 3.3 Event-Trigger Bus (subscriptions)

Wakes event-triggered agents per their spec's §7 trigger table.

- **Subscription registry** — derived from agent specs at registration. Each entry: `agentId`, `eventType`, `filterExpression?`, `responseSlaSeconds`.
- **Delivery semantics** — at-least-once, ordered-per-stream, deduplicated by event sequence number on the agent side. Idempotency is the agent's responsibility (event-sourcing discipline).
- **Backpressure** — per-agent in-flight cap. Excess deliveries are queued; queue depth is a `SubstrateAlert` once it crosses a per-agent threshold.

**Architectural seam:** `@platform/event-trigger-bus/EventTriggerBus` — `subscribe(subscription)`, `dispatch(event)`. Local: in-process bus over the SQLite event-store change stream. Cloud: Event Hubs + Service Bus consumer groups.

### 3.4 Agent Run Lifecycle

Every agent invocation is a tracked **run**. Lifecycle events:

1. `AgentRunStarted` — when the runtime instantiates the agent for a trigger or schedule. Carries the trigger reference, the agent identity, the run ID.
2. **The run executes.** During the run the agent may emit any number of `AgentDecision` events (within scope) and `AgentEscalation` events (out of scope). Domain events the agent emits are subject to the same permissioning as direct event-store appends.
3. `AgentRunCompleted` — terminal event. Carries success / failure status, count of decisions emitted, count of escalations emitted, duration.
4. `AgentRunFailed` — alternative terminal event. Carries failure mode + stack-trace hash. Triggers retry per agent's retry policy in spec.

**Architectural seam:** `@platform/agent-runtime/AgentRunner` — `runOnce(agentId, trigger)`, `attachAgentImpl(agentId, fn)`. Local: Bun worker per agent (light-weight). Cloud: Azure Container Apps Jobs (one per agent) or Functions (per-trigger).

### 3.5 Escalation Channel

Typed channel from agents to human overseers. Replaces side-channel escalation (chat, email, ad-hoc Owner Inbox files). Wave-4 #14 asserts no escalation arrives outside this channel.

- **Schema** (Zod-validated at append):

  ```ts
  AgentEscalation = {
    eventType: "AgentEscalation",
    sequence: number,
    agentId: AgentId,                      // agent issuing the escalation
    runId: RunId,
    decision: string,                      // free-text label of the decision
    optionsConsidered: Array<{
      label: string,
      pros: string[],
      cons: string[],
      citations: ObligationUrn[],
    }>,
    blockingConstraint: string,            // what prevents the agent from deciding
    targetOverseer: PersonaId,             // governance seat or named human
    deadline: ISO8601Timestamp,
    sealed?: { reason: "fraud" | "whistleblowing" | "popia-incident" }, // optional confidentiality wrapper
    citations: ObligationUrn[],            // P2 enforcement
  }
  ```

- **Routing** — the substrate consults `targetOverseer`, resolves to the overseer's preferred channel (today: Owner Inbox; later: oversight UI inbox + push notification). Sealed escalations route only to the `sealed.reason`-appropriate seat (e.g. fraud: CAE + CEO + CoSec only).
- **Acknowledgement** — the overseer's response is itself an event: `AgentEscalationAcknowledged` (overseer has seen it), `AgentEscalationDecided` (overseer has chosen an option), `AgentEscalationDelegated` (overseer has reassigned to a different overseer). The agent's run resumes (or its next run consumes the decision) on `AgentEscalationDecided`.
- **Deadline enforcement** — if no `AgentEscalationDecided` event lands by the declared deadline, the substrate emits an `AgentEscalationOverdue` event routed up the governance line (per the persona spec's reports-to chain).

### 3.6 CEO Oversight UI

The interface Marc uses to oversee the autonomous fleet. Cohabits with the existing dashboard (`prototype/dashboard/`).

- **Inbox view** — open `AgentEscalation` events addressed to Marc, sorted by deadline. Each carries the agent's decision-label, options-considered, and a one-click set of decision actions that emit `AgentEscalationDecided`.
- **Fleet status view** — agent-by-agent: last run, next run, in-flight runs, pending escalations, recent decisions, current-state of substrate-gap inventory (Vera Wave-4 #13).
- **Decision drill-down** — for any `AgentDecision` event, show the citation chain (P2), the procedure that owns the decision (P6), the agent's spec entry that authorised it (P7).
- **Escalation history** — closed escalations and their resolution; learning surface for Marc and for the agents (an agent that consistently escalates a class of decision may have its scope updated).
- **POPIA discipline** — Iris's standing template for automated-decisioning notices is rendered into the UI for any decision falling under POPIA s.71. Subject-rights routes (objection, human-review request) are first-class affordances.

**Architectural seam:** `@platform/oversight-ui` — single-page TypeScript app reading derived projections of the substrate event streams; deployed alongside the dashboard. No write paths except the typed escalation-decision events.

## 4. Substrate-emitted event types

Atlas registers the following event types at substrate genesis. Schemas live in `prototype/platform/event-store/agent-runtime-events.ts`.

| Event type | Purpose | Issued by |
|---|---|---|
| `AgentRegistered` | Agent spec validated, identity issued, permission policy published | Atlas (substrate) |
| `AgentRetired` | Agent removed from registry; permissions revoked | Atlas |
| `IdentityKeyRotated` | Signing key rotated for an agent | Substrate |
| `PermissionPolicyPublished` | Permission policy derived from spec; published | Substrate |
| `ScheduledTrigger` | Scheduler woke an agent | Scheduler |
| `AgentRunStarted` | An agent run began | Substrate |
| `AgentRunCompleted` | Successful terminal | Substrate |
| `AgentRunFailed` | Failure terminal | Substrate |
| `AgentDecision` | An in-scope decision the agent made | Issuing agent |
| `AgentEscalation` | An out-of-scope decision routed to a human | Issuing agent |
| `AgentEscalationAcknowledged` | Overseer has seen the escalation | Overseer (or their substrate proxy) |
| `AgentEscalationDecided` | Overseer has chosen | Overseer |
| `AgentEscalationDelegated` | Overseer has reassigned | Overseer |
| `AgentEscalationOverdue` | Deadline missed | Substrate |
| `SubstrateAlert` | Capacity / latency / inactivity / integrity issue | Substrate |

Schema details deferred to the build-phase PR; this spec freezes the event type set so domain personas can begin referencing them now.

## 5. TypeScript interface seams

Every component has a single interface; the substrate is the only place it's implemented. Domain code imports the interface, never the implementation. This is the substrate-replacement seam Principle 3 requires.

```ts
// prototype/platform/agent-runtime/index.ts
export interface AgentRuntime {
  registry: AgentRegistry;
  identity: AgentIdentityIssuer;
  scheduler: Scheduler;
  triggerBus: EventTriggerBus;
  runner: AgentRunner;
  escalation: EscalationChannel;
}

// Each member has its own file with a focused interface.
```

The seam keeps the build local-first while the cloud-target Azure mapping below preserves the same interfaces.

## 6. Local → Azure migration mapping

| Substrate component | Local | Cloud (M8) |
|---|---|---|
| Agent identity issuer | Software-backed crypto, SQLite-stored permissions | **Azure Entra ID workload identity** + **Key Vault Managed HSM** for signing keys |
| Scheduler | Bun-process polling SQLite at 1Hz | **Azure Container Apps Jobs** (cron) + **Logic Apps** for natural-language schedules |
| Event-trigger bus | In-process bus over SQLite change stream | **Azure Event Hubs** (high-volume) + **Service Bus** (per-agent topics) |
| Agent runner | Bun worker per agent | **Azure Container Apps Jobs** (one per agent) or **Functions** (per-trigger) |
| Escalation channel | Typed events in SQLite event store; Owner Inbox sink | Same event semantics on Cosmos DB / PG; sink shifts to oversight UI |
| Oversight UI | Local Bun-served SPA | **Azure Container Apps** (SPA hosting) + Entra ID SSO |
| Agent code | Bun module per agent | Same module, packaged as Container App image |

The interface contracts in §5 are unchanged across the lift. M8 is configuration + redeploy; not a rewrite.

## 7. Procedure binding

This substrate is itself a system capability (Principle 6 — no orphan capability). It binds to:

- **`Procedures/by-policy/agent-runtime-deploy.md`** — **owner: Atlas** (planned). The procedure for adding / changing the runtime substrate. Source policy: Change Management Policy, Secure SDLC Policy, Information Security Policy, Internal Audit Charter (D6). Source regulations: Joint Standard 1 of 2024 (cyber resilience); BCBS principles on operational resilience; PA Directive 3 of 2018 (cloud, post-M8).
- **`Procedures/by-policy/event-schema-evolution.md`** — **owner: Atlas** (planned). Specifically covers the substrate-event types in §4.
- **`Procedures/by-policy/agent-discipline-attestation.md`** — Vera's quarterly attestation reads the substrate's event streams; the substrate guarantees the streams' integrity.
- **`Procedures/by-policy/incident-response.md`** — extended (Senna + Iris + Zara to update) to cover agent-runtime incidents (compromised agent identity, runtime outage, escalation-channel failure).
- **`Procedures/by-policy/secure-sdlc.md`** — already populated; the substrate's build follows it (threat-model gate at design, signed builds, supply-chain verification).

Owen is the curator route to land these procedure files alongside this spec at the next IAF reading.

## 8. Dependencies on other personas

| Dependency | Persona | What I need from them, and by when |
|---|---|---|
| Threat model for the substrate | Senna + Rashida | Threat model for agent compromise + escalation bypass + capability creep, before build commences |
| Permission-policy review | Senna + Rashida | Review the per-agent permission generator output for the vanguard four; sign off on the derivation rule |
| Audit-event schemas | Vera | Final shapes of `AgentDecision` and `AgentEscalation` (Vera's Wave-4 #14, #15 read these directly) — joint review before schema freeze |
| POPIA discipline in the oversight UI | Iris | Standing template for automated-decisioning notices (POPIA s.71); subject-rights surfaces |
| Procedure binding | Owen | `agent-runtime-deploy.md` and `event-schema-evolution.md` lifecycle and IAF tabling |
| Data-contract review | Anya | Substrate-emitted event types added to the semantic layer; consumed-projection schemas reviewed |
| Operating-model framing | Devon | Sign-off on the substrate as an operational-resilience-relevant capability and inclusion in the BCP / DR programme |

## 9. Roadmap (build phases)

The build is sequenced so the agent-runtime can host its first real autonomous run as early as possible, with audit hooks live from day one.

| Phase | Components | Exit criterion |
|---|---|---|
| **A0 — schemas frozen** (this week) | §4 event types + Zod schemas added to the event store; permission-policy derivation rule defined | Vera's Wave-4 #10–#13 pipelines can run against artefacts produced by §4 |
| **A1 — registry + identity** (~2 weeks) | Agent registry; identity issuer (software-backed local); permission-policy publisher | A vanguard agent (Vera) can be registered; identity certificate verifies |
| **A2 — scheduler + trigger bus** (~3 weeks) | Scheduler ticking; event-trigger bus dispatching | Vera's pipelines run via the substrate, not via Scrooge in-session |
| **A3 — escalation + oversight UI v1** (~5 weeks) | Escalation channel typed end-to-end; oversight UI inbox view | Marc consumes a real escalation through the UI |
| **A4 — fleet rollout** (rolling) | Tranches 2–6 of the persona rollout (`2026-05-07_persona-agent-spec-rollout.md` §3) register against the substrate | All 26 agents registered |
| **A5 — substrate audit cycle** (post-A4) | Vera's first quarterly opinion-pack covers agent-discipline | Thandiwe signs |
| **M8 — Azure lift** (post-licence) | Cloud-target migration per §6 | Production cutover |

## 10. What this spec does *not* cover

- **Agent code** — each persona's run-handler implementation is its engineering work, not the substrate's. Atlas reviews first integrations; doesn't author them.
- **Agent decision-quality monitoring** — drift detection on agent decision outcomes (e.g. Mira's alert-disposition false-positive rate) is the agent's own self-monitoring or the second-line's challenge surface (Helena's model-risk), not substrate scope.
- **Inter-agent coordination beyond pub-sub** — agents coordinate through events. Workflow orchestration across multiple agents (e.g. KYC onboarding spans Niko + Mira + Imani + Senna) is a domain-engineering concern; the substrate offers events, not orchestration primitives.
- **Production-grade SLA enforcement** — local deployment runs at laptop scale with best-effort SLAs; production SLAs land at M8 with the cloud lift.
- **Multi-tenant agent hosting** — the bank is a single tenant. The substrate does not need cross-tenant isolation primitives.

## 11. Open items routed elsewhere

- **To Senna + Rashida:** threat model for the substrate (impersonation, escalation bypass, capability creep) needed before A1. I will table at the next threat-model gate.
- **To Vera:** confirm `AgentDecision` and `AgentEscalation` schema fields are sufficient for Wave-4 #14 / #15 before A0 freeze.
- **To Iris:** POPIA-by-design review of the oversight UI; standing automated-decisioning notice template before A3.
- **To Owen:** `agent-runtime-deploy.md` and `event-schema-evolution.md` to be added to `Procedures/_index.md` under Operations & technology; D6 (Internal Audit Charter) to incorporate the agent-discipline sub-clause Vera identified.
- **To Anya:** add `AgentRegistered`, `AgentDecision`, `AgentEscalation` to the semantic layer with named projections.
- **To Devon:** confirm operational-resilience treatment of the substrate (severity tier, BCP / DR scope inclusion).
- **To Helena:** confirm model-risk treatment for any agent whose decisions use ML — the substrate hosts those agents but does not change the model-risk envelope.
- **To Scrooge:** during the A0–A2 build window, continue coordinating in-session agent runs and recording each as a substrate-gap entry. The gap inventory closes as A1–A3 land.

—Atlas
