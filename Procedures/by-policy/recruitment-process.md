---
policy-parent: Recruitment & Selection Policy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-HR-REC-01
title: Recruitment and selection — human roles at licence-day threshold
author: Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Recruitment & Selection Policy (planned)
system-capability: "@platform/hr/recruitment (PLANNED)"
---

# Procedure — Recruitment and selection — human roles at licence-day threshold

**Procedure ID:** PROC-HR-REC-01
**Owner:** Sade (AgentOps & token efficiency engineer)
**Approval:** Marc (CEO — statutory role appointments); Board (director appointments)
**Cadence:** On-trigger (licence-day threshold event, or when a regulated role must be filled)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** The bank is AI-driven (Principle 6 — autonomous by default); human employees are the minimum the law requires. This procedure activates when a regulated role must be filled — e.g. CEO, MLRO / FIC Compliance Officer, Information Officer, directors, FAIS Key Individuals, company secretary. Build-phase: procedure is pre-drafted and table-top exercises are in scope; no live hiring occurs until the licence-day threshold is reached.

## 1. Source policy

- Recruitment & Selection Policy (planned; Sade co-author).
- Banks Act 94 of 1990 — prescribed officer and director appointment requirements; PA fit-and-proper gate.
- Employment Equity Act 55 of 1998 — fair recruitment and non-discrimination in selection.
- FAIS Act 37 of 2002 — Key Individual and Representative designation requirements.

```
Regulation (Banks Act + EA + FAIS Act + LRA)
  → Recruitment & Selection Policy (planned)
    → PROC-HR-REC-01 (this procedure)
      → @platform/hr/recruitment (PLANNED)
        → Appointment records · PA/FSCA notifications · Onboarding triggers
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-11` (Banks Act s.60A — PA notification) | Director and prescribed officer appointments must meet PA fit-and-proper standards; PA must be notified. |
| `ORG-HR-02` (Banks Act s.60 — Board approval) | Board must approve appointment of executive directors and prescribed officers. |
| `ORG-HR-05` (Employment Equity Act s.6 — Non-discrimination) | No unfair discrimination in recruitment on any EEA ground; reasonable accommodation obligation. |
| `ORG-HR-06` (LRA s.213 — Fair labour practice) | Recruitment and selection must comply with fair labour practices; unfair discrimination in pre-employment is a prohibited act. |
| `ORG-CD-03` (FAIS Act s.8 — Key Individual designation) | FSP must designate Key Individual(s); KI must be fit and proper per the FSCA Determination of Fit and Proper Requirements 2017. |
| `ORG-CD-04` (POPIA s.11 — Personal information in recruitment) | Candidate personal information processed only for recruitment purposes; limited to what is necessary; candidates must be informed of processing. |
| `ORG-IS-01` (POPIA s.19–22 — Information security) | Candidate CVs and assessment records are PII subject to POPIA security safeguards. |

## 3. Purpose

1. Provide a structured, auditable recruitment pathway for every human role that the law requires the bank to fill.
2. Ensure fit-and-proper pre-screening is completed before any candidate is offered a regulated role.
3. Comply with PA/FSCA notification requirements for director and Key Individual appointments.
4. Ensure EEA non-discrimination compliance in every selection decision.
5. Trigger access-provisioning (PROC-IS-AP-01) and fit-and-proper attestation (PROC-HR-FP-01 or PROC-FAIS-KI-FAP-01) on appointment confirmation.

## 4. Trigger

- **Licence-day readiness gate:** `LicenceDayRoleVacancyIdentified { roleType, regulatoryBasis, identifiedAt }` — emitted when the pre-licence readiness checklist identifies a regulated role that must be filled before the licence application or at licence-day.
- **Vacancy arising in operation:** `HumanRoleVacancyArose { roleId, seatType, vacancyReason, arisenAt }` — emitted when an existing human role-holder departs or is removed.
- **Board or CEO resolution:** A board or CEO resolution to add a new human role triggers the vacancy event.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive vacancy trigger; open recruitment file; determine role scoping: (a) what is the regulatory requirement that mandates this hire? (b) which statute, which section? (c) what fit-and-proper criteria apply? | `agent` (Sade) | `@platform/hr/recruitment` (PLANNED) | Role scoping anchors the recruitment to its regulatory necessity — all downstream steps trace back to this. |
| 2 | Emit `RecruitmentFileOpened { vacancyId, roleType, regulatoryBasis, openedAt }` | `system` | `@platform/event-store` | |
| 3 | **Role-profile drafting.** Sade drafts the role profile: mandate, reporting line, fit-and-proper requirements, statutory qualifications (if any), EEA profiling note | `agent` (Sade) · `human` (Marc — CEO, approval for executive roles) | `@platform/hr/recruitment` (PLANNED) | Role profile is submitted to Marc (CEO) for approval before market publication for any statutory seat. |
| 4 | **Market sourcing.** Sade issues the role to the approved headhunter / talent pool; all candidate communications are POPIA-compliant (purpose limitation disclosed upfront) | `agent` (Sade) | `@platform/hr/recruitment` (PLANNED) | Headhunter engagement: contract must include POPIA operator obligations (POPIA s.21 — operator must process only on bank's instructions). |
| 5 | **Application screening.** Sade screens applications against mandatory requirements: regulatory qualifications, experience thresholds, FAIS RE exam certificates (for KI roles), fit-and-proper preliminary check (CIPC, credit bureau, SAPS clearance) | `agent` (Sade) | `@platform/hr/recruitment` (PLANNED) | Automated preliminary F&P checks run before any candidate is invited to interview. A preliminary adverse finding is flagged to Helena before proceeding. |
| 6 | **Interview and assessment.** Short-listed candidates attend structured interviews; competency assessments conducted; panel includes Marc (CEO) for executive roles | `human` (Marc — CEO, executive panel) · `agent` (Sade — coordination) | — | Human step — interview panel evaluation is a human judgement call. Interview notes are recorded and stored as POPIA-compliant recruitment artefacts. |
| 7 | **Selection decision.** Marc (CEO) makes the selection decision (executive roles); Sade coordinates for non-executive roles; all decisions documented with objective rationale; EEA non-discrimination attestation completed | `human` (Marc — CEO) + `agent` (Sade) | `@platform/hr/recruitment` (PLANNED) | Human step for executive roles — selection decision for a statutory seat carries regulatory significance. Rationale must be documented to defend against unfair discrimination claims. |
| 8 | Emit `CandidateSelectedForRole { vacancyId, candidateId, roleType, selectionDate, selectionRationale }` | `system` | `@platform/event-store` | |
| 9 | **Pre-appointment fit-and-proper assessment.** Trigger PROC-HR-FP-01 (non-FAIS-KI roles) or PROC-FAIS-KI-FAP-01 (FAIS Key Individual) for the selected candidate; appointment is conditional on F&P clearance | `agent` (Sade — trigger) | Cross-procedure: PROC-HR-FP-01 / PROC-FAIS-KI-FAP-01 | F&P clearance is a hard prerequisite; no offer letter may be issued until `FitAndProperAttestationApproved` event is emitted. |
| 10 | **Offer letter and employment contract.** Sade generates the offer letter and employment contract using Imani's (legal-as-code engineer) approved templates; Marc signs for executive roles | `agent` (Sade · Imani — legal-as-code engineer, template maintenance) + `human` (Marc — CEO, signature for executive roles) | `@platform/hr/recruitment` (PLANNED) | Contract must comply with BCEA minimum terms; include confidentiality, IP assignment, and remuneration policy clauses. |
| 11 | **PA/FSCA notification.** For director, prescribed officer, and FAIS KI appointments: Owen (Company Secretary, governance) prepares the PA notification; Helena (CRO, governance) signs off; Owen submits via PA RECON portal | `agent` (Owen — CoSec, notification prep) + `human` (Helena — sign-off) | `@platform/compliance/pa-reporting` (PLANNED) | Human sign-off — Banks Act s.60A / FAIS Act s.8. Submit within prescribed period of appointment confirmation. |
| 12 | Emit `OfficerAppointmentNotified { candidateId, roleType, notificationDate, paRef | fscaRef }` | `system` | `@platform/event-store` | |
| 13 | **Onboarding trigger.** On appointment confirmation: trigger PROC-IS-AP-01 (access provisioning) and the induction schedule | `agent` (Sade) | Cross-procedure: PROC-IS-AP-01 | Access provisioning must be role-scoped to least-privilege (Principle 4). |
| 14 | Close recruitment file; update the headcount register | `agent` (Sade) | `@platform/hr/recruitment` (PLANNED) | |
| 15 | Emit `RecruitmentFileClosed { vacancyId, closedAt, outcome: 'Appointed' | 'Withdrawn' | 'Deferred' }` | `system` | `@platform/event-store` | |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Process orchestration; role scoping; sourcing; screening; contract generation; onboarding trigger |
| Marc (CEO) | Executive role approval; selection decision; offer-letter signature |
| Helena (Chief Risk Officer, governance) | Pre-appointment F&P adverse-event review; PA notification sign-off |
| Owen (Company Secretary, governance) | PA/FSCA notification submission; directors' register update |
| Imani (legal-as-code engineer) | Employment contract templates; offer-letter legal review |
| Zara (Chief Compliance Officer, governance) | FAIS KI designation compliance; EEA non-discrimination compliance |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| Pre-appointment F&P adverse finding | Helena reviews; Helena and Marc decide whether to withdraw the selection |
| Candidate disputes selection decision (unfair discrimination claim) | Imani reviews; CCMA referral preparation |
| PA requests additional information pre-appointment | Zara coordinates response; Helena and Marc informed |
| No suitable candidate identified after 60 days | Marc and Helena review role scope; consider interim appointment or regulatory waiver |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/recruitment` | PLANNED | Recruitment workflow; candidate file; offer-letter generation |
| `@platform/compliance/pa-reporting` | PLANNED | PA/FSCA notification |
| `@platform/event-store` | Live | Event emission |
| Cross-procedure: PROC-HR-FP-01 / PROC-FAIS-KI-FAP-01 | POPULATED | F&P pre-appointment assessment |
| Cross-procedure: PROC-IS-AP-01 | POPULATED | Access provisioning at onboarding |

## 9. Quality controls

- F&P clearance obtained before any offer letter is issued.
- EEA non-discrimination attestation completed for every selection decision.
- POPIA processing-purpose notice provided to all candidates at first contact.
- PA notification submitted within prescribed period.
- All interview notes and selection rationale stored and retained for minimum 3 years post-recruitment (POPIA limitation / LRA evidence requirements).

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Vacancy file (regulatory basis, role profile) | `RecruitmentFileOpened` | 3 years post-closure |
| Candidate screening records | `CandidateSelectedForRole` | 3 years post-closure |
| Interview notes and selection rationale | `CandidateSelectedForRole` | 3 years post-closure |
| F&P clearance record | `FitAndProperAttestationApproved` | 7 years post-tenure |
| Offer letter and signed employment contract | `RecruitmentFileClosed` | 7 years post-tenure |
| PA/FSCA notification | `OfficerAppointmentNotified` | 7 years post-tenure |
