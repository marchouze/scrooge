---
procedureId: PROC-HR-PERF-01
title: Performance management cycle — human and agent roles
author: Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Performance Management Policy (planned)
system-capability: "@platform/hr/performance-management (PLANNED)"
---

# Procedure — Performance management cycle — human and agent roles

**Procedure ID:** PROC-HR-PERF-01
**Owner:** Sade (AgentOps & token efficiency engineer)
**Approval:** Helena (Chief Risk Officer, governance — executive performance sign-off); Marc (CEO — CEO self-assessment reviewed by board)
**Cadence:** Annual (both tracks); mid-year check-in (human track); periodic per-agent-run (agent track)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** Two distinct tracks operate under this procedure. The **agent-performance track** is active now in the build phase — Sade monitors agent token efficiency, task-completion rates, and deliverable quality; perf-feedback reports are already being produced (see the 2026-05-15 batch in Owner Inbox). The **human-employee track** is pre-drafted and activates at licence-day when human hires join.

## 1. Source policy

- Performance Management Policy (planned; Sade co-author).
- LRA s.185 — fair procedures apply where performance action leads to dismissal.
- LRA Schedule 8 §8–9 — incapacity/poor performance: counselling and opportunity to improve before dismissal.
- PA Directive 4 of 2018 — individual performance scorecards for material risk-takers feed the variable-pay calculation in PROC-HR-ARR-01.

```
Regulation (LRA Schedule 8 §8–9 + PA Directive 4/2018)
  → Performance Management Policy (planned)
    → PROC-HR-PERF-01 (this procedure)
      → @platform/hr/performance-management (PLANNED)
        → Performance scorecards · Agent perf-feedback reports · Variable-pay inputs
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-06` (LRA s.185 — Fair labour practice) | Dismissal or demotion for poor performance must follow a fair procedure: counselling, opportunity to improve, support. |
| `ORG-HR-07` (LRA Schedule 8 §8–9 — Poor performance) | The employer must: investigate the cause of poor performance; give the employee a reasonable opportunity to improve; consider alternatives to dismissal. |
| `ORG-HR-01` (PA Directive 4 of 2018 — Material risk-taker scorecards) | Material risk-takers must have documented individual performance scorecards; scorecards feed the variable-pay determination; risk-adjusted performance metrics must be included. |
| `ORG-HR-05` (EEA s.20 — EE plan) | Performance management must not discriminate on EEA grounds; performance management practices are part of the EE plan review. |

## 3. Purpose

1. Maintain a structured, fair, and auditable performance management cycle for all human employees, satisfying LRA Schedule 8 procedural requirements.
2. Maintain a continuous agent-performance monitoring cycle that tracks agent token efficiency, task-completion rates, deliverable quality, and substrate-gap incidence.
3. Produce individual performance scorecards for material risk-takers that feed the variable-pay calculation under PROC-HR-ARR-01.
4. Identify performance shortfalls early and provide structured support and improvement pathways before escalating to formal incapacity proceedings.
5. Produce typed event records and perf-feedback reports as the canonical performance audit trail.

## 4. Trigger

**Human track:**
- **Annual scheduler:** `AnnualPerformanceCycleInitiated { financialYear, cohort, initiatedAt }` — emitted in Q1 for annual performance reviews.
- **Mid-year check-in scheduler:** `MidYearPerformanceCheckInInitiated { financialYear, cohort, initiatedAt }` — emitted in Q3.
- **Performance concern:** `PerformanceConcernRaised { employeeId, concern, raisedBy, raisedAt }` — emitted by a manager when a performance shortfall is identified outside the annual cycle.

**Agent track:**
- **Post-run trigger:** `AgentRunCompleted { agentId, runId, deliverableType, completedAt }` — Sade computes per-run metrics and updates the rolling performance model.
- **Periodic review scheduler:** `AgentPerformancePeriodReviewInitiated { period, agentCohort, initiatedAt }` — periodic aggregate review (monthly or quarterly).

## 5. Steps

### Track A — Human-employee performance cycle

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| A1 | Receive `AnnualPerformanceCycleInitiated`; issue KPI-setting templates to all employees and their line managers; KPIs must be SMART (specific, measurable, achievable, relevant, time-bound) and aligned to the employee's role mandate | `agent` (Sade) | `@platform/hr/performance-management` (PLANNED) | KPI-setting is collaborative; employee and line manager agree the objectives. Disagreements escalate to Helena. |
| A2 | Employees and line managers complete and submit signed KPI scorecards within 15 business days | `human` (each employee + line manager) | `@platform/hr/performance-management` (PLANNED) | Human step — KPI agreement is a bilateral act. Scorecards are stored as POPIA-compliant, BLAKE3-hashed artefacts. |
| A3 | Emit `KPIScorecardsSet { financialYear, employeeId, scorecard, setAt }` | `system` | `@platform/event-store` | |
| A4 | **Mid-year check-in.** Sade issues mid-year progress check-in template; line managers meet with each employee; document progress and any adjustments to KPIs | `human` (Line manager) · `agent` (Sade — coordination) | `@platform/hr/performance-management` (PLANNED) | Mid-year is a progress check, not a formal rating; KPI targets may be adjusted if circumstances have materially changed. |
| A5 | **Annual rating.** At year-end, line manager completes performance rating (1–5 scale or equivalent); employee provides self-assessment; Helena (CRO) moderates executive ratings; Helena or Marc moderates line-manager's own rating | `human` (Line manager · Helena · Marc) | `@platform/hr/performance-management` (PLANNED) | Human step — rating calibration is a human judgement process. Moderation panels ensure consistency across cohorts. |
| A6 | Emit `PerformanceRatingFinalised { financialYear, employeeId, finalRating, moderatedBy, finalisedAt }` | `system` | `@platform/event-store` | Rating feeds PROC-HR-ARR-01 (variable pay for material risk-takers). |
| A7 | **Performance concern pathway.** If `PerformanceConcernRaised`: Sade opens a performance improvement file; line manager counsels the employee; SMART improvement plan issued with 60-day target; follow-up at 30 and 60 days | `agent` (Sade) · `human` (Line manager) | `@platform/hr/performance-management` (PLANNED) | LRA Schedule 8 §8–9 requires support and opportunity to improve before dismissal. Counselling sessions documented. |
| A8 | Emit `PerformanceImprovementPlanIssued { employeeId, planId, targets, reviewDates, issuedAt }` | `system` | `@platform/event-store` | |
| A9 | **Incapacity hearing (if improvement not achieved).** If the employee does not meet improvement targets after the full improvement period: Helena recommends a formal incapacity hearing; hearing follows the same procedural requirements as PROC-HR-DISC-01 (independent presiding officer, right to representation, right of appeal) | `human` (Helena — CRO · Presiding officer) | Cross-procedure: PROC-HR-DISC-01 (procedural template) | Human step. The outcome may include: extended improvement period, demotion, or dismissal for incapacity. |

### Track B — Agent-performance monitoring cycle

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| B1 | On `AgentRunCompleted`: compute per-run metrics — token spend, task-completion flag, deliverable quality score (based on Vera advisory recon findings, CI gate outcome, citation-gate outcome), substrate-gap incidence | `agent` (Sade) | `@platform/hr/performance-management` (PLANNED) · `@platform/telemetry/cost-attribution` (PLANNED) | Metrics are computed automatically; no human review required per run. |
| B2 | Emit `AgentRunMetricsRecorded { agentId, runId, tokenSpend, taskCompleted, qualityScore, substrateGapsFound, recordedAt }` | `system` | `@platform/event-store` | |
| B3 | **Periodic aggregate review.** On `AgentPerformancePeriodReviewInitiated`: Sade aggregates per-run metrics for each agent; computes period metrics — average token efficiency, task-completion rate, cumulative substrate gaps, deliverable-quality trend; benchmarks against period targets | `agent` (Sade) | `@platform/hr/performance-management` (PLANNED) | Period review produces the perf-feedback report (e.g. the 2026-05-15 Owner Inbox batch for Sade's own run reporting). |
| B4 | Emit `AgentPerformancePeriodReviewCompleted { period, agentId, metrics, benchmarkComparison, reportRef, completedAt }` | `system` | `@platform/event-store` | `reportRef` is the BLAKE3 hash of the perf-feedback report in the document store. |
| B5 | **Escalation (sustained underperformance).** If an agent's task-completion rate or quality score is below threshold for two consecutive periods: Sade escalates to Marc (CEO) and Helena; substrate gap is filed; remediation plan drafted (prompt improvement, model upgrade, or substrate fix) | `agent` (Sade) + `human` (Marc — CEO · Helena — CRO) | — | Agent underperformance is a substrate issue, not a misconduct issue; remediation is technical and operational. |
| B6 | **Owner Inbox delivery.** Perf-feedback report saved to `Owner Inbox/YYYY-MM-DD_sade_agent-performance-{period}.md`; summary surfaced to dashboard | `agent` (Sade) | `@platform/hr/performance-management` (PLANNED) | Follows the events-first authoring rule; event emitted first, markdown is the render. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Both tracks: cycle orchestration; KPI issuance; agent metrics; perf-feedback reports |
| Line managers (human track) | KPI agreement; mid-year check-in; annual rating; performance counselling |
| Helena (Chief Risk Officer, governance) | Rating moderation for executive cohort; incapacity hearing oversight; agent escalation review |
| Marc (CEO) | Board review of CEO performance; agent underperformance escalation sign-off |
| Yael (tax and regulatory reporting engineer) | Variable-pay PAYE impact when scorecard ratings are finalised |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| Employee disputes performance rating | Helena mediates; if unresolved, refer to internal grievance via PROC-HR-GRIEV-01 |
| Improvement plan fails at 60 days | Helena recommends incapacity hearing; PROC-HR-DISC-01 procedural template applied |
| Agent underperformance for two consecutive periods | Marc and Helena review; substrate remediation plan; roadmap item filed |
| LRA referral (constructive dismissal claim arising from PIP) | Imani coordinates CCMA response |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/performance-management` | PLANNED | Both tracks: scorecard management; metrics computation |
| `@platform/telemetry/cost-attribution` | PLANNED | Agent token-spend attribution |
| `@platform/event-store` | Live | Event emission |
| Cross-procedure: PROC-HR-ARR-01 | POPULATED | Scorecard ratings feed variable-pay calculation |
| Cross-procedure: PROC-HR-DISC-01 | POPULATED | Procedural template for incapacity hearings |
| Cross-procedure: PROC-HR-GRIEV-01 | POPULATED | Rating-dispute pathway |

## 9. Quality controls

- KPI scorecards completed and signed within 15 business days of cycle opening.
- Annual ratings moderated by an independent calibration panel.
- Agent metrics computed automatically on every run; period review monthly minimum.
- Performance improvement plans include specific, measurable targets and documented support commitments.
- Perf-feedback reports published to Owner Inbox within 5 business days of period-end.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| KPI scorecards (human) | `KPIScorecardsSet` | 5 years post-tenure |
| Final performance ratings | `PerformanceRatingFinalised` | 5 years post-tenure |
| Performance improvement plan | `PerformanceImprovementPlanIssued` | 5 years post-tenure |
| Incapacity hearing record (if applicable) | (via PROC-HR-DISC-01) | 5 years post-tenure |
| Agent run metrics | `AgentRunMetricsRecorded` | 3 years |
| Agent period review report | `AgentPerformancePeriodReviewCompleted` | 3 years |
