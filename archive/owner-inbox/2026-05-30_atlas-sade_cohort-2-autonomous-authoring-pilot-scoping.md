---
title: "Cohort-2 Autonomous-Authoring Pilot — Scoping / Design Brief"
author: "Atlas (Core banking platform architect) + Sade (AgentOps & Token Efficiency Engineer)"
date: 2026-05-30
workstream: WS-AGENT-AUTONOMY-COHORT-2
decision: D-AGENT-AUTONOMY-COHORT-2-PILOT
status: scoping-design
kind: design-brief
supersedes: []
---

# Cohort-2 Autonomous-Authoring Pilot — Scoping / Design Brief

> **This is a scoping / design brief, not a build.** The only code committed in
> this run is this document plus its `RecordFiled` emission. No `platform/` or
> `runtime/` code is changed. Each part below decomposes into an
> independently-shippable follow-on listed in §7.

## 0. Context and thesis

Cohort-1 goal-loops (Atlas, Vera, Owen, Bea) already derive goals autonomously
and emit the full planning-trace event path (`AgentGoalEvaluated` →
`AgentGoalSelected` / `AgentGoalDeferred`) through
`LocalAgentGoalLoopRunner.runWithGoal` (`prototype/platform/agent-runtime/goal-loop.ts:170`).
But cohort-1 carries a hard constraint, stated verbatim in two places:

- The `GoalDeriver` type comment — *"cohort-1 implementations use a rule engine
  (no LLM calls)"* (`prototype/platform/agent-runtime/goal-loop.ts:102-103`).
- Vera's deriver header — *"no LLM calls — cohort constraint per spec §3.4
  'MUST NOT — LLM cost-cap'"* (`prototype/runtime/agents/vera-goal-loop.ts:11-13`).

Cohort-2 lifts exactly that constraint, for **one agent, on her lowest-blast-radius
surface**: it lets the goal-loop's "action warranted" branch call the existing
Anthropic wrapper `generateNarrative` (`prototype/runtime/claude.ts:409`) to
author a *net-new* deliverable, and land it via the existing RMS `RecordFiled`
flow. Everything else (validation gates, shadow-mode, event-store sync, metering)
is reused unchanged.

**Why Vera (Internal audit / continuous-assurance engineer) is the first agent.**
Vera's output *is* the recon safety-net. Her cohort-2 deliverable — a recon-finding
narrative or assurance note — is the same surface that the ~100 recon gates under
`prototype/platform/recon/` already police. If an autonomous Vera narrative is
wrong, the recon set she herself runs (`calc-no-silent-zero.ts`,
`expected-event-watchdog.ts`, `decision-record-event-symmetry.ts`) catches it on
the next overnight pass. Blast radius is bounded by the very mechanism we are
piloting. No money moves; no customer-facing artefact is touched; the worst
failure mode is a narrative that a downstream recon flags as a finding — which is
the system working.

---

## 1. Goal-loop → `claude.ts` authoring path for Vera (the pilot handler)

*(scaffold — expanded below)*

## 2. Three guardrails (each independently shippable)

*(scaffold — expanded below)*

## 3. Async-approval model

*(scaffold — expanded below)*

## 4. Shadow-soak gate

*(scaffold — expanded below)*

## 5. Azure / M8 boundary

*(scaffold — expanded below)*

## 6. Substrate gap surfaced by this run

*(scaffold — expanded below)*

## 7. Independently-shippable follow-on decisions

*(scaffold — expanded below)*
