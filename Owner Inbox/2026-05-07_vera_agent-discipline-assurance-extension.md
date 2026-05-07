---
title: Agent-discipline assurance — extension to the continuous-controls programme
author: Vera
date: 2026-05-07
summary: Wave-4 pipelines #10–#15 specified, extending Vera's CCM programme to test Principle-7 agent-discipline. #10–#13 implementable today; #14–#15 gated on Atlas's runtime substrate.
decision-required: false
---

# Agent-discipline assurance — extension to the continuous-controls programme

**Author:** Vera (Internal audit / continuous-assurance engineer)
**Functional manager:** Thandiwe (CAE)
**Coordinators:** Owen (CoSec, IAF chair), Atlas (platform / runtime substrate), Anya (data substrate), Senna + Rashida (agent identity & zero-trust), Mira (obligations register), Scrooge (Chief of Staff, fleet coordinator).
**Date:** 2026-05-07
**For:** Marc (CEO)
**Authority:** Principle 7 (Autonomous by default; humans oversee the residual), added to CLAUDE.md on 2026-05-07. Builds on `Owner Inbox/2026-05-06_continuous-controls-programme.md`.
**Status:** **Programme extension designed; wave-4 pipelines specified; #10–#13 implementable today against current artefacts; #14–#15 gated on Atlas's runtime substrate (Step 2 deliverable).**

> **Derivation note (Principle 6 — downward).** This extension is a query over the persona library (`/Team/`), the procedures library (`/Procedures/`), the obligations register (`/Regulations/_obligations-register.md`), and (once it exists) the agent-runtime event stream. It is not authored independently of those.

---

## 1. Why this extension exists

Principle 7 makes explicit doctrine of what was previously implicit: every persona is a **standing autonomous agent**, the default actor in every procedure step is an agent, and human involvement is the **residual** — registered with a Principle-2 citation, not the default.

The existing CCM programme tests that procedures exist, that they're cited, and that they resolve to mandate-bearing personas. It does **not yet** test that those personas are agent-shaped, that procedure steps default to agents, or that the bank's "autonomy claim" is empirically defensible.

That is the gap this extension closes. The third line cannot sign a quarterly opinion that says "the bank operates autonomously" without machine-asserted evidence that it does.

## 2. What changes in the existing programme

Two existing pipelines tighten:

- **Pipeline #3 — Mandate-ownership integrity.** Today asserts every populated procedure resolves to a mandate-bearing persona. **Tightens** to: every populated procedure resolves to a mandate-bearing **agent** (i.e. a persona with an agent-spec, see #10 below). Persona files that remain character-sheets after the upgrade pass produce findings.
- **Pipeline #5 — Orphan-capability detection (planned, second wave).** Scope **extends** from "every procedure step names a system capability" to "every procedure step names an **agent** (or a Principle-2-cited human)". This is now the same pipeline as #11 below; rather than duplicate, we redefine #5 to fold in the agent-actor check.

Existing pipelines #1, #2, #4, #6, #7, #8, #9 are unaffected.

## 3. Wave-4 pipelines (new)

| # | Pipeline | Status | What it asserts |
|---|---|---|---|
| 10 | **Agent-spec integrity** (`platform/recon/agent-spec.ts`) | **Implementable today** | Every `/Team/<name>.md` is shaped as an agent operating spec — declares `triggers`, `decisions in-scope`, `decisions that escalate` (with criteria + target overseer), `outputs`, `cadence`, `capabilities called`, `procedures owned`. Character-sheet personas are findings until upgraded under Step 1 of the Principle-7 rollout. |
| 11 | **Procedure-actor discipline** (`platform/recon/procedure-actor.ts`) | **Implementable today** | Every step in every populated procedure (a) names a typed actor, (b) where the actor is `human` or `service`-with-human-fallback, carries a Principle-2 citation in the step's Notes column or in §8 (Manual steps) of the procedure. No-citation human-default steps are **fail**-severity findings. *(Subsumes the old scope of #5; #5 is now this pipeline.)* |
| 12 | **Mandate ↔ agent reconciliation** (`platform/recon/mandate-agent.ts`) | **Implementable today** | The set of agents derivable from `/Team/*.md` agent-specs reconciles bidirectionally to the set of procedure-owners in `Procedures/_index.md`. An agent with no procedures is a "what does this agent actually do?" finding; a procedure with an owner that isn't an agent (yet) is a "this procedure has no autonomous owner" finding. |
| 13 | **Substrate-gap inventory** (`platform/recon/substrate-gap.ts`) | **Implementable today** | Maintains the register of capabilities the autonomous-agent runtime requires that do not yet exist: scheduler, event-trigger bus, agent identity & permissioning, escalation channel, oversight UI. Until the runtime lands, every Scrooge-coordinated agent run appends a gap entry naming the substrate it had to simulate. The pipeline asserts the inventory is non-empty *and being worked* (gap entries have owners and target dates) — **not** that it is empty. Closing the inventory is the runtime project's exit criterion. |
| 14 | **Escalation-channel discipline** (`platform/recon/escalation-channel.ts`) | **Planned — gated on runtime** | Once the runtime is live, every human-overseer interaction is an `AgentEscalation` event carrying: decision, options considered, blocking constraint, deadline, target overseer. Decisions reaching Marc through any other path (chat, email, side-channel) are findings. Bridges to Iris's POPIA breach-notification discipline (the channel must also be lawful-basis-aware). |
| 15 | **Out-of-scope agent decision detection** (`platform/recon/agent-scope.ts`) | **Planned — gated on runtime** | Once agents are live and emit `AgentDecision` events, every decision is checked against the issuing agent's `decisionsInScope` set declared in its operating spec. Out-of-scope decisions are **fail**-severity findings — they indicate either a spec gap (the agent is doing real work that isn't named) or a scope breach (the agent is acting beyond its mandate). Both are reportable. |

## 4. Sequencing

- **This week.** #10, #11, #12, #13 implementable today against current artefacts. The Wave-1 pipelines (#3, #4) shipped on 2026-05-06; Wave-4 follows the same uniform contract (`ReconResult` / `ReconViolation` / pure `run()` function with a CLI entry-point).
- **Co-timed with Atlas's runtime spec (Step 2 of the Principle-7 rollout).** #14 and #15 are specified now so the runtime substrate is built with the audit hooks in mind — `AgentEscalation` and `AgentDecision` are typed events from day one, not retrofitted.
- **Co-timed with the persona-upgrade pass (Step 1).** #10 turns red until each `/Team/` file lands as an agent spec. That redness is the audit signal that drives the upgrade pass — not a defect.
- **Co-timed with the procedure audit (Step 3).** #11 is the same logic the Step-3 audit applies; once the audit completes the first sweep, #11 should run green continuously thereafter, with new procedures gated on the same check pre-merge.

## 5. New procedure to be authored

A new procedure is added to the procedures library to bind this extension to the policy / regulation chain:

- **`Procedures/by-policy/agent-discipline-attestation.md`** — quarterly attestation by Vera (functionally to Thandiwe; tabled at the IAF) that the agent fleet is operating per spec. **Trigger:** quarter-end + on-demand on a fail-severity finding from #10–#15. **Reconciliation:** the attestation is generated, not assembled, from the wave-4 pipelines' `ReconResult` stream. **Source policy:** Internal Audit Charter (D6, in flight under Thandiwe), to which Owen adds an "agent-discipline" sub-clause; **source regulation:** IIA IPPF (independence + scope), BCBS 223 (internal audit function in banks — scope must cover the bank's actual operating model, which is now AI-run by doctrine), King IV (governance of technology in §4.6). I have flagged the policy-text addition to Owen for the next IAF reading.

This procedure is added to `Procedures/_index.md` under **Audit** as `PLANNED`, owner: future CAE (Vera). Owen owns the index update.

## 6. Combined-assurance interface

Thandiwe's combined-assurance map (her first-90-days §4) gains an **agent-discipline** column. Coverage feeds:

- **First line** — Atlas (runtime substrate self-checks: scheduler heartbeat, agent identity attestation, capability-call authorisation logs); each agent's own self-monitoring (cadence drift, output schema validity, decision-rate anomalies).
- **Second line** — Helena (model-risk governance over agent decisioning models), Zara (agent decisions in conduct/AML scope), Rashida (agent identity, key material, cyber-resilience of the runtime).
- **Third line** — this programme (#10–#15) and the quarterly attestation in §5.

The map regenerates from the pipeline event stream so coverage stays current, not a snapshot.

## 7. Conflicts register (Vera's own)

Two new entries:

- I am contributing to the **design** of the agent-runtime substrate (specifying what `AgentEscalation` and `AgentDecision` need to carry for #14–#15 to work). Atlas owns the build; I declare the design contribution and Thandiwe sources independent assurance over the runtime build itself (e.g. external review at first audit cycle).
- I am contributing to the **agent-spec template** that Step 1 will use across `/Team/`. Same posture: I helped shape the template; I do not author individual specs; Thandiwe sources independent assurance over the spec authorship.

## 8. What this does *not* do (yet)

- No automated detection of "agent inactivity" — an agent that should run on a 6-hour cadence but hasn't run in 24 hours. That's a runtime-substrate alert, not a third-line pipeline (Atlas's scope; we consume the alert stream).
- No automated detection of "agent capability creep" — an agent calling system capabilities not declared in its spec. Specifiable as a Wave-5 pipeline once #10 is mature; deferred so we don't try to audit a moving target.
- No external-auditor handoff for agent-discipline. Engagement-letter scoping (Thandiwe's first-90-days §5) will need to address whether the external auditor signs off on the agent fleet's controls or relies on the third line; deferred to Thandiwe.
- No regulator engagement on the autonomy posture. SARB PA's view of an AI-run bank is not a settled question; Mira and Zara coordinate engagement when the operating posture is licence-relevant. Out of scope for this document.

## 9. Architectural integrity (Principle 6)

This extension is itself a system capability:

- **Procedure binding:** `agent-discipline-attestation.md` (planned, §5 above); the wave-4 pipelines also bind to whichever procedure is being audited (e.g. #11 binds to every populated procedure as it tests their step tables).
- **Policy backing:** Internal Audit Charter (D6) with the agent-discipline sub-clause Owen will add; Operational Risk Policy (agents are operational); Model Risk Policy (agents that decide using models); Information Security Policy (agent identity + zero-trust).
- **Regulator instruments:** IIA IPPF; BCBS 223; King IV §4.6 (governance of technology and information); Banks Act 94 of 1990 (internal-audit expectations); PA / FSCA Joint Standard 1 of 2024 (cyber resilience — extends to agent-runtime resilience); POPIA s.71 (automated decisioning — Iris owns; Vera tests independence).
- **No orphan capability:** every wave-4 pipeline traces to a procedure (existing #11, #12 against the procedures library; new agent-discipline attestation for the rest) and ultimately to a regulator instrument.

## 10. Open items routed elsewhere

- **To Atlas (Step 2):** include `AgentEscalation` and `AgentDecision` typed events from day one of the runtime substrate. Schemas to be agreed with me before the substrate freezes.
- **To Owen (next IAF reading):** add the agent-discipline sub-clause to the Internal Audit Charter (D6) and add `agent-discipline-attestation.md` to `Procedures/_index.md` under Audit.
- **To Scrooge:** confirm the substrate-gap inventory format — this extension treats it as a pipeline-asserted register; Scrooge's coordination of in-session agent runs is its primary feeder until the runtime lands.
- **To Mira:** the `automated-decisioning` obligation cluster (POPIA s.71, Joint Standard 1 of 2024 model-risk-of-AI sections, BCBS principles on AI/ML) needs to be in the obligations register if it isn't already; the wave-4 pipelines will cite those URNs.

—Vera
