---
procedureId: PROC-HR-ARR-01
title: Annual remuneration review cycle — variable pay and benchmarking
author: Sade (AgentOps & token efficiency engineer) · Helena (Chief Risk Officer, governance — RemCo chair)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer) · Helena (Chief Risk Officer, governance — RemCo chair)
status: POPULATED
policy-cited: Remuneration Policy (planned)
system-capability: "@platform/hr/remuneration-review (PLANNED)"
---

# Procedure — Annual remuneration review cycle — variable pay and benchmarking

**Procedure ID:** PROC-HR-ARR-01
**Owner:** Sade (AgentOps & token efficiency engineer) · Helena (Chief Risk Officer, governance — RemCo chair)
**Approval:** RemCo (variable pay); Board (executive remuneration); PA notification if material
**Cadence:** Annual (Q4 of each financial year); agent-cost review active in build-phase; human-remuneration track activates at licence-day
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** The bank operates with the statutory minimum of human employees during the build phase. The human-remuneration track (variable pay, benchmarking against market salary surveys) is pre-drafted and activates at licence-day when human hires join. The agent-cost review track (Anthropic API token spend, agent efficiency benchmarking) is active now and runs on the same annual cadence.

## 1. Source policy

- Remuneration Policy (planned; Sade + Helena co-author; queued under `Procedures/_index.md`).
- PA Directive 4 of 2018 on Remuneration — governance framework for remuneration policy, variable pay, malus, and clawback for material risk-takers.
- Banks Act 94 of 1990 s.60 — board accountability for remuneration governance.
- The obligation chain:

```
Regulation (Banks Act s.60 + PA Directive 4/2018)
  → Remuneration Policy (planned)
    → PROC-HR-ARR-01 (this procedure)
      → @platform/hr/remuneration-review (PLANNED)
        → RemCo sign-off record · Board resolution · PA notification (if material)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-01` (PA Directive 4 of 2018 — Remuneration) | Banks must have a written remuneration policy; RemCo must review at least annually; board must approve executive remuneration; variable pay must be subject to malus and clawback for material risk-takers. |
| `ORG-HR-02` (Banks Act s.60) | Board is accountable for remuneration governance; board must approve the remuneration of executive directors and prescribed officers. |
| `ORG-GV-01` (King IV Principle 14) | Governing body oversees remuneration; RemCo is the delegated oversight body; remuneration must be fair, responsible, and transparent. |
| `ORG-HR-03` (BCEA s.9 — Minimum wages) | Any human employee remuneration must at minimum comply with the Basic Conditions of Employment Act; minimum wage and sectoral determination requirements apply. |
| `ORG-HR-04` (Income Tax Act s.7B — Variable remuneration) | Variable pay is subject to employees' tax withholding at the date of receipt; the PAYE cycle intersects with the remuneration review output. |

## 3. Purpose

1. Execute the annual cycle for reviewing and setting remuneration for all roles (human and agent) on a structured, auditable basis.
2. Benchmark human-employee total cost against market salary surveys (financial-services sector) to maintain competitiveness while preserving capital efficiency.
3. Benchmark agent operating costs (Anthropic API token spend, infrastructure cost per agent-run) against prior-period actuals and efficiency targets.
4. Produce a RemCo-reviewed and board-approved remuneration outcome record that feeds the variable-pay payment cycle and the PA notification pathway (if material changes are made).
5. Maintain a typed event record of every remuneration decision as the audit trail for the PA and for internal governance.

## 4. Trigger

- **Annual scheduler:** `AnnualRemunerationReviewInitiated { financialYear, initiatedAt }` — emitted by the annual scheduler in Q4 of each financial year.
- **Build-phase entry:** Sade (AgentOps & token efficiency engineer) initiates the agent-cost review sub-track manually; human-remuneration sub-track runs as a table-top exercise.
- **Out-of-cycle trigger:** `MaterialRemunerationChangeProposed { proposedBy, rationale, impactedRoles }` — emitted when an out-of-cycle pay change is proposed (e.g. market-retention risk for a critical human hire at licence-day).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `AnnualRemunerationReviewInitiated` event; open the review file for the financial year; notify Helena (CRO, RemCo chair) and Sade | `system` | `@platform/hr/remuneration-review` (PLANNED) | Review file is the structured workspace for the cycle; all artefacts attach to it. |
| 2 | **Agent-cost benchmarking (active build-phase).** Sade collects Anthropic API token spend for the financial year (per agent, per run-type); computes cost-per-deliverable and cost-per-event-emitted metrics; benchmarks against prior-period actuals and board-approved efficiency targets | `agent` (Sade — AgentOps & token efficiency engineer) | `@platform/hr/remuneration-review` (PLANNED) · `@platform/telemetry/cost-attribution` (PLANNED) | Output: agent-efficiency benchmarking report; substrate gap if cost-attribution telemetry is not yet live. |
| 3 | Emit `AgentCostBenchmarkCompleted { financialYear, totalTokenSpend, costPerDeliverable, efficiencyVariance, reportRef, completedAt }` | `system` | `@platform/event-store` | `reportRef` is the BLAKE3 hash of the benchmarking report in the document store. |
| 4 | **Human-remuneration benchmarking (licence-day track).** Sade sources market salary survey data for financial-services sector (e.g. PwC Remchannel, Deloitte FinancialServices survey); maps each human role to the appropriate market benchmark; identifies any roles below P50 or above P75 of market range | `agent` (Sade) | `@platform/hr/remuneration-review` (PLANNED) | Build-phase: table-top exercise using published survey data; no live employees. Activates at licence-day. |
| 5 | **Variable pay calculation.** For each human employee: retrieve the pre-agreed individual performance scorecard outcome (from PROC-HR-PERF-01); apply the variable-pay formula under the Remuneration Policy; compute the recommended bonus/incentive amount; flag any material risk-taker roles for malus/clawback linkage (cross-link to PROC-HR-MC-01) | `agent` (Sade) | `@platform/hr/remuneration-review` (PLANNED) | Material risk-taker designation must be documented; malus/clawback linkage is a hard dependency. Build-phase: no live variable-pay payments; outputs are planned figures for board review. |
| 6 | Compile the RemCo pack: (a) agent-cost benchmarking report, (b) human-remuneration benchmarking summary, (c) proposed variable-pay schedule by role, (d) material risk-taker list with malus/clawback provisions, (e) any proposed changes to the Remuneration Policy | `agent` (Sade) | `@platform/hr/remuneration-review` (PLANNED) | RemCo pack must be circulated to RemCo members at least 5 business days before the RemCo meeting. |
| 7 | **RemCo review.** Helena (CRO, RemCo chair) convenes RemCo; reviews and challenges the remuneration proposals; approves or refers back for revision | `human` (Helena — RemCo chair) | `@platform/governance/committee-management` (PLANNED) | Human step — PA Directive 4/2018 requires RemCo to be composed of independent non-executive directors; at build-phase, Helena acts as interim RemCo; board-level RemCo constitutes at licence-day. |
| 8 | Emit `RemCoRemunerationApproved { financialYear, approvalDate, variablePayScheduleRef, policyChanges, remcoMinutesRef }` or `RemCoRemunerationReferred { financialYear, referralReason, referredAt }` | `system` | `@platform/event-store` | On `Referred`: return to step 5 with RemCo feedback; repeat until approved. |
| 9 | **Board approval (executive remuneration).** For any executive (CEO, CRO, CFO, COO, Head of Markets) remuneration change: Helena presents the RemCo recommendation to the board; board resolves to approve or refer | `human` (Helena · Marc CEO as interim board — interim arrangement until board constituted) | `@platform/governance/committee-management` (PLANNED) | Human step — Banks Act s.60 and King IV. Board resolution is the binding approval for executive remuneration. |
| 10 | Emit `BoardRemunerationApproved { financialYear, approvalDate, executiveRoles, boardResolutionRef }` | `system` | `@platform/event-store` | |
| 11 | **PA notification (material changes).** If the Remuneration Policy changes materially (new deferral arrangements, revised malus triggers, changes to the material risk-taker population): Zara (Chief Compliance Officer, governance) prepares the PA notification; submits via the PA's RECON portal | `agent` (Zara — CCO, governance — notification preparation) + `human` (Helena — sign-off) | `@platform/compliance/pa-reporting` (PLANNED) | PA Directive 4/2018 — material remuneration changes must be notified to the PA. Threshold for "material" is defined in the Remuneration Policy. |
| 12 | Emit `PARemunerationNotificationSubmitted { financialYear, submissionDate, changeDescription, paRef }` (if notification was required) | `system` | `@platform/event-store` | |
| 13 | Archive the review file; update the remuneration register; notify Sade to action any approved changes to human payroll or agent cost-allocation targets | `agent` (Sade) | `@platform/hr/remuneration-review` (PLANNED) | Payroll changes feed Yael (tax and regulatory reporting engineer) for PAYE recalculation. |
| 14 | Emit `AnnualRemunerationReviewClosed { financialYear, closedAt, nextReviewDue }` | `system` | `@platform/event-store` | |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Process orchestration; agent-cost benchmarking; human-benchmarking data collection; variable-pay calculations; RemCo pack compilation; payroll change actioning |
| Helena (Chief Risk Officer, governance — RemCo chair) | RemCo review and approval; board presentation; PA notification sign-off |
| Zara (Chief Compliance Officer, governance) | PA notification preparation; regulatory compliance check on the Remuneration Policy |
| Yael (tax and regulatory reporting engineer) | PAYE impact assessment on approved variable-pay outcomes |
| Marc (CEO — interim board chair) | Board approval of executive remuneration (interim arrangement) |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| RemCo refers remuneration proposals back | Sade revises proposals; re-circulates; second RemCo review |
| Variable pay for a material risk-taker triggers malus/clawback eligibility | Cross-link to PROC-HR-MC-01 immediately; Helena notified |
| PA queries or requests further information post-notification | Zara coordinates response within 15 business days; Helena and Marc informed |
| Agent cost exceeds board-approved efficiency threshold by >20% | Immediate report to Helena and Marc; Sade proposes remediation plan |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/remuneration-review` | PLANNED | Core review-cycle workflow; RemCo pack generation |
| `@platform/telemetry/cost-attribution` | PLANNED | Agent token-spend attribution by role and run-type |
| `@platform/governance/committee-management` | PLANNED | RemCo and board meeting management; resolution records |
| `@platform/compliance/pa-reporting` | PLANNED | PA notification submission and tracking |
| `@platform/event-store` | Live | Event emission for all typed events |

## 9. Quality controls

- RemCo pack circulated at least 5 business days before RemCo meeting.
- All variable-pay calculations reviewed for arithmetic accuracy by Sade before submission to RemCo.
- Material risk-taker list cross-checked against PA Directive 4/2018 criteria each cycle.
- PA notification submitted within the prescribed timeline if triggered.
- All RemCo and board resolutions stored as BLAKE3-hashed artefacts in the document store.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Agent-cost benchmarking report | `AgentCostBenchmarkCompleted` | 7 years |
| Human-remuneration benchmarking summary | `AnnualRemunerationReviewInitiated` | 7 years |
| Variable-pay schedule (approved) | `RemCoRemunerationApproved` | 7 years |
| RemCo minutes | `RemCoRemunerationApproved` | 7 years |
| Board resolution (executive remuneration) | `BoardRemunerationApproved` | 7 years |
| PA notification (if submitted) | `PARemunerationNotificationSubmitted` | 7 years |
| Review closure record | `AnnualRemunerationReviewClosed` | 7 years |
