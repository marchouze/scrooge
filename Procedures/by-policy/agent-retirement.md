---
id: PROC-AGENTOPS-RETIREMENT-001
title: Agent Retirement
status: POPULATED
authority: COO + AgentOps
citations: [PRINCIPLE-6]
---

# Agent Retirement Procedure

**Procedure ID:** PROC-AGENTOPS-RETIREMENT-001
**Owner:** Sade (AgentOps) + Devon (COO)
**Approval:** COO + AgentOps jointly
**Cadence:** On-request; fires when an agent is decommissioned
**Version:** v0.1 — 2026-05-18

## Trigger
A running agent is decommissioned: mandate closed, replaced by a successor agent, or paused at licence-day.

## Authority
- Primary: COO (Devon, Chief Operations Officer) + AgentOps (Sade)
- Approval required from both seats before retirement is finalised

## Steps

1. **Record retirement decision** — COO and AgentOps jointly record the retirement rationale as a Decision event (authority: COO)
2. **Emit AgentRetired event** — Sade's retirement handler emits `AgentRetired` for the target agent URN
3. **Update team roster** — Set `buildPhaseStatus: "retired"` in `Team/_team-roster.json` for the agent
4. **Archive persona file** — Move the persona file from `Team/` to `archive/team/`

## Paused agents at build-phase boundary (licence-day candidates)

The following agents are currently in `paused` status and are candidates for formal retirement or activation at licence-day:
- Niko (client-lifecycle) — activates at licence-day
- Sade (human-HR slice) — activates at licence-day
- Imani (employment-contracts/disciplinary slice) — activates at licence-day

These are NOT retired yet; they will be activated or retired after the licence-day go/no-go gate.

## Outputs
- `AgentRetired` event in the event store
- Updated `Team/_team-roster.json`
- Archived persona file (if fully decommissioned)
