---
title: "Operating Model — AI-Driven Bank Build Phase"
author: Devon (Chief Operating Officer, governance)
date: 2026-05-15
decision-required: false
tags: [operations, operating-model, governance, build-phase]
---

# Operating Model — AI-Driven Bank Build Phase

**Prepared by:** Devon (Chief Operating Officer, governance)
**Date:** 2026-05-15
**Status:** Baseline — post-Phase-2 governance deliverable. Next review: Devon's next scheduled quarterly operating-model run.

---

## 1. Overview

The bank is an AI-driven institution-in-formation, intended to operate as a SARB-licensed bank under Banks Act 94 of 1990. Its distinguishing structural feature is that the day-to-day labour force is an autonomous agent fleet, not a human workforce. Human involvement — Marc (CEO) now, plus the statutory minimum set of named humans at licence-day — is reserved for the residual set of decisions and actions that an agent cannot legally or practically take on its own.

This operating model is the practical expression of **Principle 6 (Autonomous by default; humans oversee the residual)**: every persona is a standing autonomous agent that runs on its own cadence and discharges its mandate. Humans are the exception in every procedure step, not the default. Where a human-in-the-loop step appears, it carries a citation to the regulatory or judgement-based reason automation cannot substitute.

Scrooge (Chief of Staff, orchestrator) coordinates the fleet on Marc's behalf. Scrooge does not carry out work directly; every task is analysed and delegated to the appropriate agent. The CEO's day-to-day engagement is reviewing escalations and approvals that the fleet surfaces — not feeding individual tasks.

---

## 2. Build-phase operating posture

The CLAUDE.md operating model section is canonical on what is real now versus what activates at licence-day; this section summarises the operational implications without duplicating it.

**What is real and active in the build phase:**

- The Anthropic API token spend — the dominant current cost.
- Marc's attention as the binding human resource.
- The engineering substrate: event store, recon harnesses, platform handlers, persona specs.
- Procedures, registers, and controls — real engineering work that must be production-grade at the pre-licence go-live readiness gate.

**What activates only at licence-day:**

- Real capital (R300m target). No capital is held now; the figure is a licence-day funding target.
- Real customers. Niko's (Sales/CRM engineer) client lifecycle substrate activates at licence-day.
- Real employees beyond the statutory minimum. Sade's (AgentOps & Token Efficiency Engineer) HR-systems slice, Niko's CRM slice, and Yael's (Tax engineer) PAYE / EMP201 / IRP5 slice are all paused.
- Real insurance, auditor, and external counsel — required only at the licence-application and licence-day thresholds.

**Operational consequence:** during the build phase, Devon's operating focus is on substrate readiness, agent fleet health, and the controls needed for the pre-licence go-live gate — not on running a live bank. All cadence language is expressed in agent ticks (weekly delivery review, monthly resilience rehearsal, quarterly operating-model review), not wall-clock weeks, except for items tied to genuine external deadlines such as regulator filing dates.

---

## 3. Agent fleet structure

The canonical source for the fleet is `Team/_team-roster.json`. The roster defines 28 standing agents across two seat types.

**Engineering seats (18 agents):** build and operate the coded controls, projections, and platform components. Each engineering agent has a named governance seat it reports to; engineering agents are accountable for the system capability, not the regulatory outcome.

| Engineering agent | Primary governance seat |
|---|---|
| Atlas (Core banking platform architect) | Devon |
| Tomas (Operations & payments engineer) | Devon |
| Imani (Legal-as-code engineer) | Devon (interim; routes to GC when hired) |
| Sade (AgentOps & Token Efficiency Engineer) | Devon (interim) |
| PAX (Role researcher) | Devon |
| Nolan (Recruiter) | Devon |
| Niko (Sales/CRM engineer) | Devon |
| Kai (Trading systems engineer) | Saskia |
| Bea (Accounting & financial reporting engineer) | Camille |
| Mira (Compliance/RegTech engineer) | Zara |
| Rohan (Risk engineer) | Helena |
| Nadia (Independent-validation engineer) | Helena |
| Ravi (Treasury/ALM engineer) | Eitan |
| Vera (Internal audit engineer) | Thandiwe |
| Senna (Security engineer) | Rashida |
| Anya (Data/analytics engineer) | Devon |
| Yael (Tax engineer) | Camille |
| Noa (Intranet Product Owner & UI Architect) | Devon |

**Governance seats (10 agents):** hold named regulatory accountabilities and oversee the engineers' outputs. They do not build; they govern delivery, set appetite, and are accountable for named regulatory obligations. The ten governance seats are: Helena (Chief Risk Officer), Owen (Company Secretary), Zara (Chief Compliance Officer), Iris (Information Officer), Devon (Chief Operating Officer), Camille (Chief Financial Officer), Eitan (Treasurer), Saskia (Head of Global Markets), Thandiwe (Chief Audit Executive), and Rashida (Chief Information Security Officer). All governance seats and Scrooge report directly to the CEO.

**Agent cadences:** agents operate on a mix of event-triggered and scheduled ticks. Devon's bench runs a weekly delivery review, weekly Change Approval Board, monthly resilience rehearsal, and quarterly operating-model review. Engineering agents on the bench maintain continuous event-triggered responses (incidents, SLO burns, capacity breaches) with scheduled cadences for snapshot deliverables. Vera runs continuous-assurance recon pipelines on top of the event log; findings surface to Thandiwe and into the Owner Inbox.

---

## 4. Key operational workflows

Devon's governance scope covers five core workflows.

**Inbox hygiene.** The Owner Inbox (`Owner Inbox/`) and Team Inbox (`Team Inbox/`) are the pre-Phase-1 channels for deliverables and briefs respectively. Scrooge moves completed Team Inbox items to `Team Inbox/actioned/` after each run. Items with `decision-required: true` frontmatter are lifted automatically to the CEO's decisions dashboard. Devon's operational resilience snapshots and this operating-model document land in the Owner Inbox under the standard naming convention (`YYYY-MM-DD_<agent>_<description>.md`). Phase 1 of the Records Management Substrate (approved under `D-RMS-PHASE-1`) will introduce seven typed registers and a content-addressed document store; inbox hygiene transitions to RMS register management under that scheme.

**Decision routing.** Not all decisions surface to the CEO. Devon's in-scope decisions — CAB approvals, SLO target adjustments within Helena's (Chief Risk Officer, governance) appetite, resilience scenario approvals, DR/BC plan approvals, capacity-spend within Camille's (Chief Financial Officer, governance) envelope, incident triage — are taken autonomously by Devon and recorded as `AgentDecision` events. Decisions that cross appetite or spending thresholds, require regulatory notification, or involve material operating-model changes escalate via a typed `AgentEscalation` event to the named overseer (see Section 6). The CEO's daily load is the escalation queue, not the operational queue.

**Workstream tracking.** Engineering-bench workstreams are registered as `WorkstreamRegistered` events. Devon's delivery-review cadence tracks progress against the substrate roadmap — particularly the pre-licence go-live readiness gate milestones owned by Saskia (Head of Global Markets, governance), Rashida, and Devon jointly. Substrate gaps identified during agent runs are registered as roadmap items, not suppressed.

**Recon pipeline cadence.** Vera runs a suite of recon harnesses against the codebase and event log: `recon:prose-duplication`, `recon:mandate-coverage`, `recon:runtime-handler-sync`, and the citation gate (`bun run citation-gate`). Devon monitors the recon findings register for operations-flavoured findings and routes them to the relevant engineering seat with a disposition deadline. The weekly delivery review picks up any recon findings against Atlas, Tomas, Anya, Sade, Tomas, PAX, Nolan, Niko, Imani, and Noa.

**Cross-agent handoffs.** Key handoff boundaries Devon manages: Atlas (substrate state) → Devon (CAB and SLO decisions); Tomas (payments events) → Devon (incident triage and correspondent-interface operational oversight); Anya (projection events) → Devon (capacity and SLO burn awareness); Sade (agentops/token events) → Devon (bench-health and efficiency advisory); Senna (security substrate) → Devon (incident co-command on cyber events). Each handoff is formalised as a typed data contract; Anya's data-contract-evolution discipline governs schema changes.

---

## 5. Operational resilience

The AI-driven model relies on four architectural pillars for continuity.

**Stateless handlers and event-log replay.** Per Principle 1 (Events are the only source of truth), all state is derived from the append-only event log. No agent holds mutable in-memory state that cannot be reconstructed from a log replay. This means agent restarts are non-destructive: a handler that dies mid-run can be re-run from the last committed event without data loss, provided the scaffold-commit rule (commit and push within ~10 minutes of starting a deliverable) is observed. Three lost-work incidents in May 2026 traced to worktree-isolation violations are the primary cautionary data point.

**Worktree isolation.** Each agent dispatch runs in an isolated worktree. The main worktree (`/Users/marc/code/Bank`) is the integration branch; agents never work directly on it. This prevents concurrent writes colliding silently and prevents agents from committing to the wrong branch — two failure modes that have materialised in practice.

**launchd auto-restart (local).** The agent runtime is scheduled via launchd on the local macOS host. launchd catches up missed ticks on wake after lid-close; transient daemon failures are self-healing. This is a build-phase compromise: the production substrate is Azure-hosted (per Principle 3), and launchd is a local proxy for the scheduler until the Azure lift lands.

**CI gate as deployment control.** Every merge to main must pass `bun run ci` from `prototype/` — a full `bunx tsc --noEmit` across the project, Biome lint, and the recon/citation-gate suite. This is the primary change-control mechanism in the absence of a full CAB tooling stack. Partial typechecks are explicitly rejected; CI catches what local checks miss.

**Known substrate gaps (as of 2026-05-15):**

- **No DR environment.** There is no separate recovery environment. The event log is the recovery mechanism; a cold replay against a fresh environment is the DR posture. RTO/RPO definitions per service tier have not been authored. Devon + Atlas + Senna co-author at the next governance cycle.
- **No Azure lift.** All compute runs locally. The Azure migration is a single-coherent-phase lift (Principle 3); it has not started. SLAs relevant to Directive 3 of 2018 apply from the cloud-migration decision.
- **Resilience-test harness** not yet built. `ResilienceTestResult` event type is registered but has no producer. Owner: Tomas.
- **SLO observability projection** not yet specified. `SLOBudgetBurn` detection depends on this. Owner: Atlas.
- **Capacity-projection** not yet built. `CapacityBreach` detection depends on this. Owner: Anya and Atlas jointly.
- **Auto-generated CAB pack** is partial. CAB runs against manually assembled artefacts; the substrate gap is on Atlas's roadmap.

---

## 6. Governance touchpoints

**Within Devon's autonomous authority:**

- CAB approvals where the register-linked impact assessment is present and rollback plan is documented.
- SLO target adjustments within Helena's RAS operational-resilience appetite envelope.
- Resilience-scenario approvals against the bank's important business services (BCBS mapping).
- DR/BC plan approvals where recovery objectives sit within Helena's appetite.
- Capacity-spend approvals within Camille's CFO-set platform-spend cap.
- Triage and disposition of medium-severity operational incidents within RAS tolerance.
- Engineering hire prioritisation within the bench (Nolan and PAX in loop).

All of the above are recorded as typed `AgentDecision` events, not as markdown-only records.

**Escalations to the CEO (via Scrooge):**

| Decision | Trigger | Channel |
|---|---|---|
| Material outage or regulatory-reportable incident | PA/FSCA notification threshold; or beyond RAS tolerance | `AgentEscalation` → CEO + Helena + Rashida; Owen lights PA/FSCA path |
| Platform capital-spend above Camille's threshold | CFO-set platform-spend cap crossed | `AgentEscalation` → Camille → CEO |
| Operational-risk appetite breach | Tier-1 RAS line crossed | `AgentEscalation` → Helena → CEO, within 4h |
| Cloud / offshoring decision under Directive 3 of 2018 | New jurisdiction or authoritative-data move | `AgentEscalation` → CEO + Helena + Iris, pre-decision |
| Major engineering hire (governance-adjacent) | Mandate change for an engineering seat | `AgentEscalation` → CEO via Scrooge, pre-offer |

**Owner Inbox surfacing.** Devon's deliverables land in `Owner Inbox/` with the standard frontmatter convention. Items where `decision-required: true` are surfaced automatically to the CEO's decisions dashboard tile. The quarterly operating-model report (of which this document is the baseline) is a `decision-required: false` deliverable — it is for the CEO's awareness and for Devon's next-run comparison baseline, not for a formal approval decision.

---

## 7. Next scheduled review

Devon's next quarterly operating-model review. The review will compare this baseline against the then-current substrate state: progress on the DR environment, Azure lift readiness, resilience-test harness, SLO observability, and capacity-projection gaps listed above. Any operating-model changes driven by new CEO decisions, RAS updates, or material infrastructure changes between now and the next review will be incorporated as an interim amendment, recorded as an `AgentDecision` event.

Vera will run a combined-assurance contribution against this document at the next quarterly audit cycle.
