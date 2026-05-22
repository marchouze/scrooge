---
policy-id: agent-operations-policy
title: Agent Operations Policy v1
version: "1"
status: CORPORATE-BIND
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Banks Act 94 of 1990 s.60 (risk management systems — AI systems as key operational infrastructure)
  - Regulations Relating to Banks 2012 (as amended) reg.39 (internal controls)
  - PA/FSCA Joint Standard 2 of 2024 s.6 (technology risk — AI systems and automated decision-making)
  - POPIA s.19 (security safeguards — AI processing of personal data)
  - Principle 6 (autonomous by default; humans oversee the residual)
author: Devon (Chief Operating Officer, governance) + Sade (AgentOps & Token Efficiency Engineer, engineering)
date: 2026-05-22
summary: Agent Operations Policy establishing authorisation tiers for agent deployment (Tier 1 CEO / Tier 2 COO / Tier 3 Sade), mandatory capability scope documents, token budget governance, agent-runtime deploy gate, agent retirement procedure, human-in-the-loop escalation thresholds, audit trail requirement, agent-to-agent communication governance, quarterly performance review. Typed events AgentDeployed, AgentParameterChanged, AgentRetired, AgentTokenBudgetExceeded, AgentEscalationTriggered. CORPORATE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-TOR
---

# Agent Operations Policy v1

> **Authors.** Devon (Chief Operating Officer, governance) — lead; Sade (AgentOps & Token Efficiency Engineer, engineering) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). The bank is an autonomous AI-driven institution (Principle 6); agents are the primary workforce. This policy is the operational governance layer for that workforce — the equivalent of an HR and operations policy for the AI agent fleet. Implements Banks Act 94 of 1990 s.60 risk management system obligations (AI systems are key risk management infrastructure), Regulations Relating to Banks reg.39 internal controls, and PA/FSCA Joint Standard 2 of 2024 s.6 technology risk governance for AI systems.
> **Obligations closed.** Banks Act s.60 (risk management systems must be appropriately governed; AI systems are risk management tools); reg.39 (internal controls over automated systems); PA/FSCA JS-2 s.6 (technology risk governance for automated decision-making systems); POPIA s.19 (security safeguards for personal information processed by AI agents).
> **Status.** CORPORATE-BIND. The agent fleet is operational in the build phase; governance is required from first deployment. Every agent currently operating under `D-REGULATORY-READINESS-GATE-PLAN` is retrospectively governed by this policy from its effective date; gaps between current agent deployments and this policy's requirements are substrate gaps for Sade to report and close.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Agent Operations — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual policy review; agent deployment governance is continuous · **Citation:** Banks Act 94 of 1990 s.60 + Regulations Relating to Banks reg.39 + PA/FSCA Joint Standard 2 of 2024 s.6 + POPIA s.19 + Principle 6

### Purpose

This policy governs the deployment, operation, parameterisation, monitoring, and retirement of every autonomous AI agent in Hoz Bank Limited's (the "Bank's") agent fleet. The Bank's operating model is autonomous by default (Principle 6): agents are the primary workforce; humans oversee the residual set of decisions and actions an agent cannot make on its own. This policy is the governance framework that ensures the agent fleet operates within its authorised mandate, within the Bank's risk appetite, and in compliance with the applicable regulatory requirements for automated decision-making systems.

The policy addresses five governance dimensions: (1) authorisation tiers (who may approve what types of agent change); (2) capability scope (what each agent is authorised to do); (3) token budget governance (cost and resource controls); (4) operational controls (deploy, retire, escalate, audit); and (5) agent-to-agent communication governance (no ad-hoc side channels).

Every agent is a standing autonomous agent operating against its operating spec (`/Team/<Name>.md`). The operating spec is the agent's capability scope document; this policy requires it to exist and requires it to be current before deployment.

### Principles

- **Every agent action produces a typed event.** No agent action — whether a decision, a deliverable, a data modification, or a communication — may occur without a typed event in the event log (Principle 1). An agent that acts without producing a typed event has violated Principle 1. This is the foundational audit trail requirement; it is not negotiable.
- **No agent action above delegated authority without human escalation.** Every agent has a defined authority boundary (its operating spec). Any decision or action that exceeds the agent's delegated authority triggers a mandatory human escalation before the action is taken. The escalation threshold is defined in the agent's operating spec and must be enforced by the agent's capability code, not merely stated in policy.
- **Structured event bus is the only agent-to-agent channel.** Agents communicate with each other exclusively through typed events on the shared event bus. No ad-hoc direct messaging between agents, no shared mutable state outside the event log, no side-channel APIs. Any agent-to-agent communication that is not mediated by the event bus is a governance violation reportable to Vera.
- **Agent authorisation is tiered.** Three tiers of authority govern agent changes (§2). No tier may be bypassed. Sade monitors compliance with the tiers and reports violations to Devon.
- **Token budget governance prevents runaway costs.** The Bank's primary current cost is Anthropic API token spend (per build-phase operating model). Token budgets per agent prevent uncontrolled cost accumulation. Sade monitors token usage and emits `AgentTokenBudgetExceeded` events when an agent exceeds its monthly budget; Devon and Sade must jointly approve overage.
- **POPIA compliance for personal data.** Agents that process personal information (as defined by POPIA s.1) must do so only to the extent permitted by the agent's capability scope document, which must specify the personal information categories processed and the legal basis. Zara (Chief Compliance Officer, governance) reviews the POPIA section of each agent's operating spec before first deployment.

### Roles

Devon (Chief Operating Officer, governance) is the policy owner and the Tier 2 approval authority for agent parameter changes. Devon chairs the quarterly agent performance review.

Sade (AgentOps & Token Efficiency Engineer, engineering) is the operational lead for agent fleet management. Sade owns: token budget monitoring; Tier 3 operational configuration authority; agent deployment coordination; agent performance metrics; quarterly performance report to Devon; `AgentTokenBudgetExceeded`, `AgentDeployed`, `AgentParameterChanged`, `AgentRetired` event emission.

Zara (Chief Compliance Officer, governance) reviews the POPIA compliance section of each agent's operating spec before first deployment and at the annual review cycle.

Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) audits the agent fleet annually: does every active agent have an operating spec? Are all token budgets current? Are all deployments backed by a `AgentDeployed` event? Are there any `AgentEscalationTriggered` events that were not resolved within the prescribed timeframe?

The CEO is the Tier 1 approval authority for new agent deployments and new capability scope expansions.

---

## 2. Agent Authorisation Tiers

**Owner:** Sade (AgentOps & Token Efficiency Engineer, engineering) — monitoring; Devon (COO) — Tier 2 authority · **Approval:** Per tier — see table · **Cadence:** Applied to every agent change request · **Citation:** Banks Act 94 of 1990 s.60 + PA/FSCA Joint Standard 2 of 2024 s.6

| Tier | Scope | Authority |
|---|---|---|
| **Tier 1** | New agent deployment; new capability scope added to an existing agent; expansion of an existing agent's delegation authority (e.g., increasing the decision amount an agent can approve) | CEO |
| **Tier 2** | Parameter changes within existing mandate (e.g., adjusting a threshold within an approved range; updating the model version for an existing agent's substrate); token budget changes (increases or decreases); agent capability scope document update within approved boundaries | COO (Devon) |
| **Tier 3** | Routine operational configuration within pre-approved bounds (e.g., adjusting an alert threshold that is below the Tier 2 threshold; updating a prompt template within an approved framework; restart or health-check of an agent's substrate) | Sade |

**Tier 1 deployment process:**
1. Sade proposes the new agent (or scope expansion) — including the draft operating spec, capability scope document, POPIA compliance section, token budget, and escalation thresholds.
2. Zara reviews the POPIA section.
3. Helena reviews any risk-significant capabilities (e.g., agents with authority over risk limits, credit decisions, or trading parameters).
4. CEO approves; `AgentDeployed { agentId, agentName, capabilityScopeRef, approvedBy: "ceo", tokenBudget }` event emitted.

**Tier 2 change process:**
1. Sade or the relevant engineering team proposes the parameter change.
2. Devon reviews and approves; `AgentParameterChanged { agentId, parameterType, oldValue, newValue, approvedBy: "devon" }` event emitted.

**Tier 3 change process:**
1. Sade executes the configuration change within pre-approved bounds.
2. `AgentParameterChanged { agentId, parameterType, tier: 3, approvedBy: "sade" }` event emitted.

---

## 3. Capability Scope Documents

**Owner:** Sade (AgentOps & Token Efficiency Engineer, engineering) — registry; per-agent operating spec owner — content · **Approval:** CEO for scope definition (Tier 1); COO for scope updates within mandate (Tier 2) · **Cadence:** Updated on every material capability change · **Citation:** Principle 6 + PA/FSCA Joint Standard 2 of 2024 s.6

Every registered agent must have a current capability scope document before deployment. The capability scope document is the agent's operating spec (`/Team/<Name>.md`), which must include per the standard template (sections 6–17 per `Team/_agent-spec-template.md`):

- **Cadence and Triggers** (sections 6–7): when the agent runs, what triggers it.
- **Inputs and Outputs** (sections 8 and 11): what data the agent consumes and produces.
- **Decisions in scope** (section 9): what decisions the agent may make autonomously.
- **Decisions that escalate** (section 10): what decisions must be escalated to a human before action.
- **POPIA compliance** (within section 14 Data contracts): if the agent processes personal information, what categories and on what legal basis.
- **Delegation boundaries**: the maximum amount, the maximum risk level, the maximum scope of any single autonomous action.

An agent operating without a current, complete operating spec (sections 6–17 populated) is an operational risk event reportable to Vera and a Tier 1 gap for Sade to escalate to Devon.

---

## 4. Token Budget Governance

**Owner:** Sade (AgentOps & Token Efficiency Engineer, engineering) · **Approval:** Sade + COO for overage; COO for budget increases · **Cadence:** Monthly budget tracking; immediate alert on budget breach · **Citation:** Build-phase cost governance (Anthropic API token spend is the Bank's primary current cost)

### 4.1 Budget Setting

Each active agent has a monthly token budget (measured in Anthropic API input + output tokens). Budgets are set by Sade based on the agent's expected activity level and reviewed quarterly (or when the agent's mandate changes materially). Budget changes are Tier 2 decisions (Devon's approval).

The token budget register is maintained by Sade as a projection over `AgentDeployed` and `AgentParameterChanged { parameterType: "tokenBudget" }` events.

### 4.2 Monitoring and Overage

Sade monitors cumulative token usage per agent in real time. When an agent's cumulative monthly usage reaches 80% of its budget, Sade issues an `AgentTokenBudgetExceeded { agentId, budgetMonth, usedTokens, budgetTokens, severity: "warning" }` event and notifies Devon.

When an agent's cumulative monthly usage reaches 100% of its budget, Sade issues `AgentTokenBudgetExceeded { severity: "breach" }` and the agent is automatically rate-limited to Tier 3 operational tasks only (no new Tier 1/2 capability invocations) until Devon and Sade jointly approve a budget extension. The extension approval is a `AgentParameterChanged { parameterType: "tokenBudgetExtension" }` event.

### 4.3 Efficiency Standards

Sade monitors token efficiency (output value per token consumed) as a secondary metric. An agent with systematically low token efficiency (producing low-value outputs per token) is flagged for Sade's review; Sade may recommend prompt re-engineering or scope adjustment to Devon.

---

## 5. Human-in-the-Loop Escalation

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO for escalation threshold changes · **Cadence:** Thresholds set at agent deployment; monitored continuously · **Citation:** Principle 6 + Banks Act 94 of 1990 s.60

Human-in-the-loop (HITL) escalation is mandatory when an agent encounters a decision or action that exceeds its delegated authority. The escalation threshold for each agent is defined in its operating spec (section 10: "Decisions that escalate").

When an agent triggers HITL escalation:
1. The agent emits `AgentEscalationTriggered { agentId, agentName, decisionType, description, escalationTo, triggeredAt }`.
2. The agent pauses execution of the relevant action and notifies the escalation target (Marc as CEO, or Devon as COO, per the operating spec's escalation routing).
3. The human authority reviews the decision and provides approval or direction.
4. The agent resumes execution with the human-provided decision as input.

HITL escalations that are not resolved within 24 hours are reported to Devon by Sade. Unresolved escalations beyond 48 hours are reported to the CEO.

An agent that takes an action above its delegated authority without triggering HITL escalation is a serious operational control failure, reportable to Vera and Helena as an operational risk event.

---

## 6. Agent Retirement

**Owner:** Sade (AgentOps & Token Efficiency Engineer, engineering) · **Approval:** CEO for Tier 1 agent retirement (same tier as deployment); COO for parameter reduction prior to retirement · **Cadence:** Triggered by mandate change, business need, or performance failure · **Citation:** Principle 6 + PA/FSCA Joint Standard 2 of 2024 s.6

An agent is retired when: (a) its mandate is no longer required; (b) its capability has been absorbed into another agent; (c) its performance is persistently below the minimum standard despite remediation; or (d) the underlying substrate (model version, platform) is being replaced.

The agent retirement procedure (`Procedures/by-policy/agent-retirement.md`) governs the retirement process:
1. Sade proposes retirement to Devon; Devon approves (Tier 2) or escalates to CEO (if the retiring agent is a Tier 1 deployment).
2. Sade issues a drain instruction: the agent completes any in-flight tasks but accepts no new tasks.
3. Once drained, Sade emits `AgentRetired { agentId, agentName, retiredAt, reason, handoverRef }`.
4. The agent's operating spec is archived (not deleted); the `/Team/<Name>.md` file is updated to record retirement and the date.

A retired agent's event log entries are retained per the Records Management Policy; retirement does not erase history.

---

## 7. Agent-to-Agent Communication Governance

**Owner:** Atlas (Core banking platform architect, engineering) — technical architecture; Devon (COO) — governance · **Approval:** CEO for new inter-agent communication patterns · **Cadence:** Governance enforced at code-review level in Secure SDLC · **Citation:** Principle 1 + Principle 6 + PA/FSCA Joint Standard 2 of 2024 s.6

All communication between agents is mediated by the shared event bus. An agent emits a typed event; other agents subscribe to events of that type and react. There are no direct agent-to-agent API calls, shared mutable memory structures (other than the event log), or ad-hoc message channels outside the event bus.

This governance principle exists for three reasons: (1) it makes all agent communication auditable (every message is an event in the event log); (2) it prevents cascading failures where one agent's malfunction directly corrupts another's state; (3) it aligns with the SARB's emerging expectations for AI governance in financial institutions (PA/FSCA JS-2 s.6).

Any proposed agent-to-agent communication pattern that is not mediated by the event bus requires CEO approval (it is a new capability pattern, therefore Tier 1) before implementation. Atlas reviews all pull requests for compliance with this principle.

---

## 8. Periodic Agent Performance Review

**Owner:** Sade (AgentOps & Token Efficiency Engineer, engineering) · **Approval:** COO receives and reviews the report · **Cadence:** Quarterly · **Citation:** Principle 6 + Banks Act 94 of 1990 s.60 (risk management systems — ongoing adequacy)

Sade produces a quarterly agent performance report covering all active agents:

1. **Task completion rate:** tasks assigned vs. tasks completed within the expected cadence.
2. **Token efficiency:** tokens consumed per substantive deliverable (normalised by task type).
3. **HITL escalation frequency:** number of `AgentEscalationTriggered` events per agent per quarter.
4. **Error rate:** any `AgentRunCompleted { outcome: "blocked" }` or downstream recon failures attributed to the agent.
5. **Token budget utilisation:** cumulative monthly token usage vs. budget; trend.
6. **Capability scope currency:** is the agent's operating spec current and complete (sections 6–17)?

The quarterly report is presented to Devon, who reviews it with Sade and identifies agents requiring: (a) remediation (low performance, high HITL escalation rate); (b) retirement (mandate completed or persistent underperformance); (c) scope expansion (consistently operating below capacity with demonstrated business need for expansion).

The quarterly review is recorded as a `AgentParameterChanged { parameterType: "quarterlyReviewCompleted" }` event per agent reviewed, with the review outcome in the payload.

---

## 9. Typed Events

This policy generates and consumes the following typed events (Principle 1):

| Event type | Trigger | Owner |
|---|---|---|
| `AgentDeployed` | New agent deployed or existing agent re-deployed after scope change | Sade (on CEO approval) |
| `AgentParameterChanged` | Any Tier 2 or Tier 3 parameter change | Sade |
| `AgentRetired` | Agent retirement completed | Sade |
| `AgentTokenBudgetExceeded` | Monthly token usage reaches 80% (warning) or 100% (breach) | Sade |
| `AgentEscalationTriggered` | Agent encounters decision above delegated authority | The escalating agent |

---

## 10. Substrate Dependencies and Gaps

- **Token budget monitoring harness (Sade).** Real-time token usage tracking per agent with threshold alerts. Discharge exit signal: `AgentTokenBudgetExceeded` event auto-generated at 80%/100% threshold.
- **Agent deployment registry (Sade + Atlas).** Machine-readable registry of all active agents with operating spec refs, deployment dates, and token budgets. Discharge exit signal: registry queryable via API; `AgentDeployed` events drive the registry.
- **HITL escalation channel (Atlas).** Automated notification to escalation target when `AgentEscalationTriggered` event emitted. Discharge exit signal: CEO/Devon receive notification within 5 minutes of escalation event.
- **Operating spec compliance gate (Sade).** Automated check that every active agent has a complete operating spec (sections 6–17) before Tier 1 deployment. Discharge exit signal: deployment rejected at code level for agents without complete spec.
- **Procedures pending full authoring:** `Procedures/by-policy/agent-runtime-deploy.md` and `Procedures/by-policy/agent-retirement.md` — referenced herein; full content to be authored by Sade and Atlas under Devon's direction.

---

## 11. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Devon (Chief Operating Officer, governance) + Sade (AgentOps & Token Efficiency Engineer, engineering) | Initial policy authored. Eight operative sections: (1) Overarching — events-first audit trail, no action above authority without HITL, event bus as sole inter-agent channel, token budget governance, POPIA compliance; (2) Authorisation Tiers — Tier 1 CEO / Tier 2 COO / Tier 3 Sade with deployment processes; (3) Capability Scope Documents — operating spec as mandatory prerequisite; (4) Token Budget Governance — budget setting, 80%/100% thresholds, efficiency standards; (5) Human-in-the-Loop Escalation; (6) Agent Retirement; (7) Agent-to-Agent Communication Governance; (8) Quarterly Performance Review. |
