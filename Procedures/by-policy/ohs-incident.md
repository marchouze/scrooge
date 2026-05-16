---
procedureId: PROC-HR-OHS-01
title: Occupational Health and Safety incident reporting and investigation
author: Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Health & Safety Policy (planned)
system-capability: "@platform/hr/ohs-management (PLANNED)"
---

# Procedure — Occupational Health and Safety incident reporting and investigation

**Procedure ID:** PROC-HR-OHS-01
**Owner:** Sade (AgentOps & token efficiency engineer)
**Approval:** Marc (CEO — as employer representative under the OHS Act); Helena (Chief Risk Officer, governance — risk sign-off on serious incidents)
**Cadence:** On-trigger (incident occurs); OHS committee review quarterly (if workforce ≥20)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** The OHS Act 85 of 1993 applies to all employers with employees. During the build phase the bank has no human employees and no physical office requiring OHS compliance; this procedure activates at licence-day (or when a physical office is established). The OHS committee obligation (workforce ≥20) activates much later, if ever, given the bank's AI-driven operating model. Build-phase: procedure is pre-drafted; OHS risk assessment for the physical office (if any) is the first activation task.

## 1. Source policy

- Health & Safety Policy (planned; Sade co-author).
- OHS Act 85 of 1993 — general duty of care; incident reporting; OHS representative and committee requirements.
- OHS Act s.24 — mandatory reporting of certain incidents to the DoL Inspector within 7 days.
- Compensation for Occupational Injuries and Diseases Act 130 of 1993 (COIDA) — employer registration; injury-on-duty claims.

```
Regulation (OHS Act 85/1993 + COIDA 130/1993)
  → Health & Safety Policy (planned)
    → PROC-HR-OHS-01 (this procedure)
      → @platform/hr/ohs-management (PLANNED)
        → Incident register · DoL notification · COIDA claim · Corrective-action log
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-21` (OHS Act s.8 — General duty of care) | Every employer must provide and maintain a working environment that is safe and without risks to health; general duty extends to all persons on the premises. |
| `ORG-HR-22` (OHS Act s.24 — Reporting of incidents) | Reportable incidents (death, serious injury, dangerous occurrence, occupational disease) must be reported to the DoL Inspector within 7 days; employer must investigate and submit the findings. |
| `ORG-HR-23` (OHS Act s.17 — OHS committee) | Employers with more than 20 employees must establish an OHS committee; committee must meet at least quarterly; minutes kept. |
| `ORG-HR-24` (OHS Act s.16 — Assignment of duties) | Employer must appoint a competent person to assist in OHS compliance; this person is responsible for day-to-day OHS management. |
| `ORG-HR-25` (COIDA s.80 — Employer registration) | Every employer of employees must register with the Compensation Commissioner (Rand Mutual or COID Commissioner); pay annual return; process injury-on-duty claims. |
| `ORG-HR-26` (OHS Act s.14 — Employee duty) | Employees must take reasonable care for their own safety and that of others; report unsafe conditions. |

## 3. Purpose

1. Ensure every workplace incident is reported, investigated, and recorded in a structured, auditable manner.
2. Meet the mandatory 7-day DoL notification requirement for reportable incidents under OHS Act s.24.
3. Identify root causes of incidents and implement corrective actions to prevent recurrence.
4. Process COIDA injury-on-duty claims promptly and accurately.
5. Maintain the OHS incident register and the OHS committee records required for a DoL inspection.

## 4. Trigger

- **Incident report:** `OHSIncidentReported { incidentId, reportedBy, incidentType, incidentDate, reportedAt }` — emitted when any person (employee, contractor, visitor) reports a workplace incident.
- **Agent detection:** Sade's monitoring harness may detect an incident report submitted via the OHS portal and automatically open the procedure.
- **Near-miss report:** A near-miss (no injury but a significant hazard realised) triggers a reduced-scope investigation (steps 1–6, 10–12) without the COIDA or DoL paths.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive incident report; open incident file; categorise the incident: (a) minor / first-aid only, (b) medical treatment, (c) reportable (OHS Act s.24 — death, serious injury, dangerous occurrence, occupational disease), (d) near-miss | `agent` (Sade) | `@platform/hr/ohs-management` (PLANNED) | Categorisation determines the response speed and the DoL notification requirement. If there is any doubt about whether an incident is reportable, default to treating it as reportable. |
| 2 | Emit `OHSIncidentCategorised { incidentId, category, incidentDate, categorisedAt }` | `system` | `@platform/event-store` | |
| 3 | **First-aid / immediate response.** For minor incidents: first-aider attends; medical treatment provided if required; scene made safe | `human` (First-aider — designated under OHS Act s.16) | — | Human step — first-aid response is immediate; agent logs the response actions taken. |
| 4 | **Scene preservation (serious / reportable incidents).** For reportable incidents: Sade instructs that the scene is preserved as far as practicable; Marc (CEO) is notified immediately; Helena (CRO) notified | `agent` (Sade) + `human` (Marc — CEO notification) | `@platform/hr/ohs-management` (PLANNED) | OHS Act s.24 — employer must preserve the scene until the Inspector has inspected it or authorised disturbance (whichever is earlier). |
| 5 | Emit `OHSScenePreservationInitiated { incidentId, preservedAt }` (for reportable incidents) | `system` | `@platform/event-store` | |
| 6 | **DoL notification (reportable incidents — within 7 days).** Sade prepares the DoL notification using the prescribed W.CL.1 form; Marc (CEO) signs; Sade submits to the relevant DoL Inspector by electronic transmission | `agent` (Sade — form preparation) + `human` (Marc — CEO, signature) | `@platform/hr/ohs-management` (PLANNED) | Human step — OHS Act s.24 requires the employer to report; employer is Marc as CEO. Deadline: 7 calendar days from the date of the incident. W.CL.1 form available from the DoL. |
| 7 | Emit `OHSDoLNotificationSubmitted { incidentId, notificationDate, dolRef, submittedAt }` | `system` | `@platform/event-store` | |
| 8 | **COIDA claim (injury-on-duty).** If an employee sustains an injury or occupational disease: Sade prepares the COIDA claim (W.CL.2 — employer report, W.CL.3 — medical report from treating doctor) and submits to the Compensation Commissioner or Rand Mutual within prescribed period | `agent` (Sade) + `human` (treating physician — W.CL.3) | `@platform/hr/ohs-management` (PLANNED) | Treating physician provides W.CL.3; employer provides W.CL.2. COIDA claim must be submitted within 12 months of incident. Yael (tax and regulatory reporting engineer) is notified to suspend PAYE on any COIDA compensation payments. |
| 9 | Emit `COIDAClaimSubmitted { incidentId, claimDate, claimType, submittedAt }` | `system` | `@platform/event-store` | |
| 10 | **Incident investigation.** Sade appoints an investigating officer (independent of the immediate cause of the incident); investigation covers: what happened, why it happened (root cause analysis), what controls failed, what corrective actions are required | `agent` (Sade — investigation orchestration) + `human` (Investigating officer — OHS competent person) | `@platform/hr/ohs-management` (PLANNED) | Human step — OHS Act s.8 — investigation requires a competent person; agent supports with data collection and document management. |
| 11 | Emit `OHSIncidentInvestigationCompleted { incidentId, rootCauses, controlsFailedList, investigatedAt, reportRef }` | `system` | `@platform/event-store` | |
| 12 | **Corrective action plan.** Based on investigation findings: Sade drafts the corrective action plan; Helena reviews and approves; actions are assigned to responsible parties with deadlines; Sade monitors completion | `agent` (Sade) + `human` (Helena — approval) | `@platform/hr/ohs-management` (PLANNED) | Corrective actions must address root causes, not just symptoms. Unresolved corrective actions are escalated to Marc. |
| 13 | Emit `OHSCorrectiveActionPlanApproved { incidentId, actionsCount, targetCompletionDate, approvedAt }` | `system` | `@platform/event-store` | |
| 14 | **OHS committee review (if workforce ≥20).** Sade presents a summary of incidents, investigations, and corrective action progress at the quarterly OHS committee meeting; committee minutes recorded | `agent` (Sade — presentation prep) + `human` (OHS committee members — chaired by OHS representative) | `@platform/hr/ohs-management` (PLANNED) | Human step — OHS committee is a statutory body; minutes are required for DoL inspection. This step is dormant until the workforce ≥20 threshold is reached. |
| 15 | Close incident file once all corrective actions are verified as complete; update the OHS incident register | `agent` (Sade) | `@platform/hr/ohs-management` (PLANNED) | |
| 16 | Emit `OHSIncidentClosed { incidentId, closedAt, correctiveActionsVerified }` | `system` | `@platform/event-store` | |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Incident management; categorisation; DoL notification preparation; COIDA claim; investigation coordination; corrective-action tracking |
| Marc (CEO) | DoL notification sign-off; employer representative; scene preservation authority |
| Helena (Chief Risk Officer, governance) | Corrective-action plan approval; serious-incident risk assessment |
| Designated first-aider / OHS competent person | Immediate response; investigation |
| Treating physician | W.CL.3 medical report (COIDA claims) |
| Yael (tax and regulatory reporting engineer) | COIDA compensation PAYE treatment |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| Fatality or catastrophic incident | Marc and Helena convene immediately; Imani (legal-as-code engineer) engaged; DoL Inspector notification within 24 hours (by telephone) in addition to the 7-day written notification |
| DoL Inspector issues improvement notice or prohibition notice | Zara (CCO) coordinates response; Helena and Marc briefed immediately; compliance within notice period |
| COIDA claim disputed | Imani coordinates Compensation Commissioner appeal; specialist occupational health attorney if required |
| Corrective action overdue by >30 days | Helena escalates to Marc; independent OHS audit if pattern of overdue actions |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/ohs-management` | PLANNED | Incident workflow; DoL form generation; COIDA claim; corrective-action tracker |
| `@platform/event-store` | Live | Event emission |

## 9. Quality controls

- All incidents recorded on the day they occur or are reported.
- DoL notification submitted within 7 calendar days for reportable incidents.
- COIDA claim submitted within 12 months of incident (best practice: within 30 days).
- Root-cause analysis completed within 15 business days of investigation opening.
- Corrective actions tracked to completion; overdue actions escalated within 5 business days.
- OHS incident register reviewed by Helena quarterly.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Incident report | `OHSIncidentReported` | 3 years post-closure |
| DoL notification (W.CL.1) | `OHSDoLNotificationSubmitted` | 5 years |
| COIDA claim forms (W.CL.2, W.CL.3) | `COIDAClaimSubmitted` | 5 years post-claim closure |
| Investigation report | `OHSIncidentInvestigationCompleted` | 3 years post-closure |
| Corrective action plan and completion records | `OHSCorrectiveActionPlanApproved` | 3 years post-closure |
| OHS committee minutes (if applicable) | `OHSIncidentClosed` | 3 years |
| OHS incident register | Ongoing | Permanent |
