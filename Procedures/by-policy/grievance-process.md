---
procedureId: PROC-HR-GRIEV-01
title: Grievance handling — human employees
author: Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Grievance Policy (planned)
system-capability: "@platform/hr/grievance (PLANNED)"
---

# Procedure — Grievance handling — human employees

**Procedure ID:** PROC-HR-GRIEV-01
**Owner:** Sade (AgentOps & token efficiency engineer)
**Approval:** Helena (Chief Risk Officer, governance — formal grievance sign-off); Marc (CEO — escalated grievances involving executive conduct)
**Cadence:** On-trigger (grievance submitted or detected)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** No human employees exist during the build phase. This procedure activates at licence-day when human hires join. LRA s.185 (right to fair labour practice) and BCEA protections apply from the date the first human employment contract is concluded. Agent personas are not employees and are not subject to this procedure.

## 1. Source policy

- Grievance Policy (planned; Sade co-author).
- LRA s.185 — right of employees not to be subjected to unfair labour practices, including unfair treatment.
- BCEA — minimum conditions governing workplace treatment.
- King IV Principle 17 — responsible corporate citizenship; fair treatment of stakeholders.

```
Regulation (LRA s.185 + BCEA + common law duty of fair treatment)
  → Grievance Policy (planned)
    → PROC-HR-GRIEV-01 (this procedure)
      → @platform/hr/grievance (PLANNED)
        → Grievance register · Outcome record · CCMA referral log
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-06` (LRA s.185 — Right to fair labour practice) | Every employee has the right not to be subjected to unfair labour practice; failure to address a grievance can constitute an unfair labour practice; CCMA referral right exists. |
| `ORG-HR-09` (LRA s.191 — CCMA referral) | An employee may refer an unfair labour practice grievance to CCMA within 90 days of the act or omission giving rise to the grievance. |
| `ORG-HR-08` (BCEA s.37 — Employment records) | Employer must retain records of grievances and outcomes. |
| `ORG-HR-05` (Employment Equity Act s.6 — Harassment) | EEA prohibits harassment in the workplace; a harassment grievance triggers this procedure and may also trigger a misconduct investigation under PROC-HR-DISC-01. |
| `ORG-CD-04` (POPIA s.11 — Personal information) | Grievance records are PII; processed on employment-relationship basis; POPIA s.19–22 safeguards apply. |

## 3. Purpose

1. Provide a structured, accessible grievance pathway for every human employee that satisfies LRA s.185 fair-labour-practice requirements.
2. Resolve grievances promptly at the lowest possible level through an informal-first approach.
3. Maintain an auditable grievance register that tracks all grievances, their investigation, and their outcomes.
4. Identify systemic workplace issues through trend analysis and route remediation through the appropriate governance channel.
5. Produce typed event records of every grievance step as the canonical audit trail for CCMA proceedings.

## 4. Trigger

- **Employee submission:** `GrievanceSubmitted { grievanceId, submittedBy, subject, submittedAt }` — emitted when an employee submits a formal written grievance via the bank's grievance portal or directly to Sade.
- **Informal escalation:** Where an employee raises a matter informally with their manager and it is not resolved, the manager notifies Sade and the matter is treated as a formal grievance.
- **Harassment report:** A harassment complaint under EEA s.6 automatically triggers this procedure alongside a potential misconduct investigation under PROC-HR-DISC-01.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive grievance; open grievance file; acknowledge receipt to the employee within 2 business days; notify the employee's line manager (unless the grievance is against the line manager — in that case notify Helena directly) | `agent` (Sade) | `@platform/hr/grievance` (PLANNED) | Acknowledgement must confirm: the grievance ID, the timeline for informal resolution, and the employee's right to representation. |
| 2 | Emit `GrievanceAcknowledged { grievanceId, submittedBy, acknowledgedAt, assignedTo }` | `system` | `@platform/event-store` | |
| 3 | **Informal resolution attempt.** The line manager meets with the aggrieved employee; attempts to resolve the matter through direct discussion; outcome is recorded by Sade | `human` (Line manager — employee's direct manager) · `agent` (Sade — record keeping) | `@platform/hr/grievance` (PLANNED) | Timeline: informal resolution attempt must be completed within 5 business days of acknowledgement. |
| 4 | Emit `GrievanceInformalResolutionOutcome { grievanceId, outcome: 'Resolved' | 'Unresolved', outcomeDate, notes }` | `system` | `@platform/event-store` | If resolved: proceed to step 12 (close). If unresolved: proceed to step 5 (formal investigation). |
| 5 | **Formal grievance investigation.** If informal resolution fails: Sade appoints an independent investigating officer (independent of the line manager and the subject of the grievance); investigating officer conducts interviews, reviews evidence, and prepares a findings report | `agent` (Sade — appointment) · `human` (Investigating officer — independent appointee) | `@platform/hr/grievance` (PLANNED) | Investigation must be completed within 15 business days of escalation to formal track. Investigating officer has access to all relevant records subject to POPIA processing limitations. |
| 6 | Emit `GrievanceFormalInvestigationOpened { grievanceId, investigatingOfficerId, openedAt, targetCompletionDate }` | `system` | `@platform/event-store` | |
| 7 | **Investigating officer findings.** Investigating officer submits a written findings report to Sade and Helena; report includes: facts found, credibility assessments, conclusion, recommended outcome | `human` (Investigating officer) | — | Human step — findings report is a professional judgement document. It is disclosed to both parties (subject to any confidentiality constraints). |
| 8 | **Outcome determination.** Helena (CRO, governance) or, for grievances involving executive conduct, Marc (CEO), reviews the findings report and determines the outcome; issues a written outcome notice to the employee | `human` (Helena — CRO · Marc — CEO for executive conduct) | — | Human step — outcome determination is a governance decision. Outcome notice must include: the finding, the reasons, the outcome, and the right to appeal / CCMA referral. |
| 9 | Emit `GrievanceFormalOutcomeDetermined { grievanceId, outcome, determinedBy, outcomeDate, outcomeNoticeRef }` | `system` | `@platform/event-store` | |
| 10 | **Employee response period.** Employee has 5 business days to indicate whether they accept the outcome; if they reject, they may: (a) appeal internally, or (b) refer to CCMA (LRA s.191 — within 90 days) | `human` (Employee) | — | No system action required during this period; Sade monitors the deadline. |
| 11 | **Internal appeal (if lodged within 5 business days).** Marc (CEO) or a designated more-senior independent officer reviews the findings and outcome; appeal decision is final for internal purposes | `human` (Marc — CEO · senior independent officer) | `@platform/hr/grievance` (PLANNED) | Appeal decision must be issued within 10 business days. Outcome is communicated in writing; CCMA referral right is re-stated. |
| 12 | Emit `GrievanceAppealOutcome { grievanceId, appealDate, appealOutcome, appealDecisionRef }` (if appeal lodged) | `system` | `@platform/event-store` | |
| 13 | **Misconduct cross-link.** If the grievance investigation reveals that the subject of the grievance committed misconduct (e.g. harassment, bullying): Sade triggers PROC-HR-DISC-01 against the subject | `agent` (Sade — trigger) | Cross-procedure: PROC-HR-DISC-01 | Grievance and disciplinary tracks run in parallel; findings in one do not automatically bind the other but may be cross-referenced. |
| 14 | Close grievance file; update the grievance register; conduct trend analysis on a quarterly basis | `agent` (Sade) | `@platform/hr/grievance` (PLANNED) | Quarterly trend analysis: identify systemic issues; route remediation recommendations to Helena and Marc. |
| 15 | Emit `GrievanceCaseClosed { grievanceId, closedAt, finalOutcome }` | `system` | `@platform/event-store` | |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Case management; acknowledgement; investigation coordination; register maintenance; trend analysis |
| Line manager | Informal resolution attempt |
| Helena (Chief Risk Officer, governance) | Formal outcome determination; appeal oversight |
| Marc (CEO) | Outcome determination for grievances involving executive conduct; final appeal |
| Imani (legal-as-code engineer) | CCMA referral preparation and response |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| Employee refers to CCMA (unfair labour practice) | Imani coordinates CCMA response within referral window; external counsel if necessary |
| Grievance alleges executive misconduct | Marc recuses; Helena leads investigation; board notified if the grievance concerns a director |
| Harassment grievance | Parallel PROC-HR-DISC-01 investigation triggered; EEA Code of Good Practice on Sexual Harassment applies |
| Informal resolution not completed within 5 days | Sade escalates to Helena; formal track opened automatically |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/grievance` | PLANNED | Case management; notice generation; register |
| `@platform/event-store` | Live | Event emission |
| Cross-procedure: PROC-HR-DISC-01 | POPULATED | Misconduct investigation if grievance reveals conduct issue |

## 9. Quality controls

- Acknowledgement within 2 business days of submission.
- Informal resolution attempted within 5 business days.
- Formal investigation completed within 15 business days of escalation.
- CCMA referral window (90 days) tracked per case.
- Grievance register reviewed quarterly for trends; systemic issues reported to Helena.
- All grievance records stored as POPIA-compliant, BLAKE3-hashed artefacts.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Grievance submission | `GrievanceSubmitted` | 5 years post-case closure |
| Acknowledgement record | `GrievanceAcknowledged` | 5 years post-case closure |
| Informal resolution record | `GrievanceInformalResolutionOutcome` | 5 years post-case closure |
| Investigation report | `GrievanceFormalOutcomeDetermined` | 5 years post-case closure |
| Outcome notice | `GrievanceFormalOutcomeDetermined` | 5 years post-case closure |
| Appeal outcome (if applicable) | `GrievanceAppealOutcome` | 5 years post-case closure |
| CCMA referral and outcome (if applicable) | `GrievanceCaseClosed` | 7 years |
