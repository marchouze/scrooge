---
procedureId: PROC-HR-DISC-01
title: Disciplinary process — human employees
author: Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Disciplinary Policy (planned)
system-capability: "@platform/hr/disciplinary (PLANNED)"
---

# Procedure — Disciplinary process — human employees

**Procedure ID:** PROC-HR-DISC-01
**Owner:** Sade (AgentOps & token efficiency engineer)
**Approval:** Helena (Chief Risk Officer, governance — for executive-role sanctions); Marc (CEO — for prescribed-officer sanctions)
**Cadence:** On-trigger (alleged misconduct detected or reported)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** No human employees exist during the build phase. This procedure is pre-drafted and activates at licence-day when human hires join. LRA Schedule 8 (Code of Good Practice: Dismissal) requirements are binding from the date the first human employment contract is concluded. Agent personas are not employees and are not subject to this procedure.

## 1. Source policy

- Disciplinary Policy (planned; Sade co-author).
- LRA Schedule 8 (Code of Good Practice: Dismissal) — fair reason and fair procedure requirements for all disciplinary action including dismissal.
- BCEA s.37 — employer obligation to keep records of disciplinary action.

```
Regulation (LRA s.185–186 + Schedule 8 + BCEA)
  → Disciplinary Policy (planned)
    → PROC-HR-DISC-01 (this procedure)
      → @platform/hr/disciplinary (PLANNED)
        → Disciplinary records · Sanction record · CCMA referral log
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-06` (LRA s.185 — Right not to be unfairly dismissed) | An employee may not be dismissed unless there is a fair reason and a fair procedure is followed. |
| `ORG-HR-07` (LRA Schedule 8 — Code of Good Practice: Dismissal) | Code prescribes: notification of charges; right to be heard; right to representation (fellow employee or union rep); reasoned decision; right of appeal. |
| `ORG-HR-08` (BCEA s.37 — Employment records) | Employer must keep records of disciplinary action for prescribed period. |
| `ORG-HR-09` (LRA s.191 — CCMA referral) | Employee may refer unfair dismissal or unfair labour practice to CCMA within 30 days. |
| `ORG-HR-10` (Banks Act s.60A — PA notification) | Dismissal or resignation of a director, senior manager, or prescribed officer in circumstances relating to dishonesty or misconduct must be notified to the PA. |

## 3. Purpose

1. Provide a structured, procedurally fair disciplinary pathway that satisfies LRA Schedule 8 requirements for all human employees.
2. Ensure every disciplinary action is proportionate to the conduct, documented, and consistent with precedent.
3. Produce typed event records of each disciplinary step as the canonical audit trail for CCMA proceedings and PA notification.
4. Where a material risk-taker is involved, cross-link to PROC-HR-MC-01 (malus/clawback) and PROC-HR-FP-01 (fit-and-proper).

## 4. Trigger

- **Misconduct report:** `MisconductReportReceived { reportId, reportedBy, employeeId, allegation, receivedAt }` — emitted when a manager, colleague, agent monitor, or external party reports an alleged misconduct.
- **Agent detection:** Sade's monitoring harness may detect a potential misconduct pattern (e.g. policy breach, access violation logged by PROC-IS-AP-01) and emit the report event automatically.
- **Regulatory referral:** A PA, FSCA, or CCMA referral that identifies employee conduct issues triggers this procedure.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `MisconductReportReceived` event; open disciplinary file; notify the employee's line manager and Helena (CRO, governance) | `system` | `@platform/hr/disciplinary` (PLANNED) | All disciplinary files are assigned a unique case ID at creation. |
| 2 | **Preliminary investigation.** Sade conducts a preliminary fact-gather: collect evidence (emails, access logs, witness statements); assess whether the allegation is prima facie sustainable; determine the appropriate charge category (minor misconduct → warning; serious misconduct → formal hearing; gross misconduct → summary dismissal consideration) | `agent` (Sade) | `@platform/hr/disciplinary` (PLANNED) | Preliminary investigation is not a hearing; the employee is not yet formally charged. Evidence gathered is stored as POPIA-compliant artefacts. |
| 3 | Emit `PreliminaryInvestigationCompleted { caseId, allegation, evidenceSummary, chargeCategory, completedAt }` | `system` | `@platform/event-store` | |
| 4 | **Suspension consideration (gross misconduct).** If the allegation is of gross misconduct and the employee's continued presence creates a material risk: Helena (CRO) recommends precautionary suspension; Marc (CEO) approves for prescribed officers; Helena approves for other employees | `human` (Helena — CRO · Marc — CEO for prescribed officers) | — | Human step — suspension must be on full pay (LRA Schedule 8 §4); it is precautionary, not punitive. Notice of suspension is issued in writing. |
| 5 | **Notice of hearing.** Sade issues the employee a written notice of disciplinary hearing: date, time, place, charges in clear language, right to representation (fellow employee or union representative), right to respond | `agent` (Sade) | `@platform/hr/disciplinary` (PLANNED) | Minimum notice: 5 business days before the hearing (unless mutually agreed otherwise or emergency). |
| 6 | Emit `DisciplinaryHearingNoticeIssued { caseId, employeeId, charges, hearingDate, noticeIssuedAt }` | `system` | `@platform/event-store` | |
| 7 | **Disciplinary hearing.** A human presiding officer (independent of the line manager) chairs the hearing; the employee presents their case; the presiding officer evaluates evidence and determines: (a) guilty or not guilty on each charge; (b) appropriate sanction if guilty | `human` (Presiding officer — independent, appointed by Marc or Helena) · `human` (employee + representative) | — | Human step — LRA Schedule 8 requires the hearing to be conducted by the employer (human presiding officer). Agent observers may attend and log proceedings; they do not decide. |
| 8 | Emit `DisciplinaryHearingConducted { caseId, presidingOfficerId, outcome: 'Guilty' | 'NotGuilty', chargesDecided, hearingDate }` | `system` | `@platform/event-store` | |
| 9 | **Sanction determination.** Presiding officer determines the sanction (verbal warning, written warning, final written warning, demotion, dismissal) proportionate to the misconduct, consistent with the bank's sanction schedule, and consistent with previous sanctions for similar conduct | `human` (Presiding officer) | — | Human step — sanction is a judicial-type decision; must be consistent, proportionate, and documented with full reasons. |
| 10 | Emit `DisciplinarySanctionIssued { caseId, employeeId, sanction, reasons, sanctionDate }` | `system` | `@platform/event-store` | |
| 11 | **Notification to employee.** Sade issues a written notice of outcome and sanction; for dismissal, the notice includes: effective date, last day of work, final pay entitlement, right of appeal, right to refer to CCMA within 30 days | `agent` (Sade) | `@platform/hr/disciplinary` (PLANNED) | Dismissal notice must be in writing (LRA Schedule 8 §11). |
| 12 | **Internal appeal (if lodged).** Employee may appeal within 5 business days; Helena (CRO) or Marc (CEO) appoints a more senior independent presiding officer; appeal hearing conducted on same procedural basis | `human` (Appeal presiding officer) · `agent` (Sade — coordination) | `@platform/hr/disciplinary` (PLANNED) | Appeal outcome may confirm, vary, or set aside the original sanction. Appeal is the final internal step. |
| 13 | Emit `DisciplinaryAppealOutcome { caseId, appealDate, appealOutcome: 'Confirmed' | 'Varied' | 'SetAside', variedSanction }` (if appeal lodged) | `system` | `@platform/event-store` | |
| 14 | **PA notification (misconduct dismissal / resignation).** If the employee is a director, senior manager, or prescribed officer dismissed or resigned in circumstances of dishonesty or misconduct: Owen (Company Secretary, governance) prepares the PA notification; Helena signs off; Owen submits | `agent` (Owen — CoSec) + `human` (Helena — sign-off) | `@platform/compliance/pa-reporting` (PLANNED) | Human sign-off — Banks Act s.60A. Notification deadline confirmed against current PA guidance. |
| 15 | **Material risk-taker cross-link.** If the employee is a material risk-taker and the sanction is dismissal for conduct linked to a risk event: trigger PROC-HR-MC-01 | `agent` (Sade — trigger) | Cross-procedure: PROC-HR-MC-01 | Emit `MisconductFindingIssued` to activate the malus/clawback assessment. |
| 16 | Close disciplinary file; update disciplinary register; notify Yael (tax and regulatory reporting engineer) if final-pay calculation is affected | `agent` (Sade) | `@platform/hr/disciplinary` (PLANNED) | |
| 17 | Emit `DisciplinaryCaseClosed { caseId, closedAt, finalOutcome }` | `system` | `@platform/event-store` | |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Case management; evidence collection; notice issuance; cross-procedure triggers |
| Helena (Chief Risk Officer, governance) | Suspension approval; appeal presiding officer appointment; PA notification sign-off |
| Marc (CEO) | Prescribed-officer suspension and sanction approval; appeal presiding officer for senior cases |
| Owen (Company Secretary, governance) | PA notification submission |
| Imani (legal-as-code engineer) | LRA / CCMA advice; litigation support if required |
| Yael (tax and regulatory reporting engineer) | Final-pay calculation on dismissal |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| Employee refers to CCMA (unfair dismissal / unfair labour practice) | Imani coordinates CCMA response; external counsel if necessary |
| PA queries dismissal notification | Zara (CCO) coordinates response; Helena and Marc informed |
| Misconduct involves a director or prescribed officer | Marc and Helena convene; Imani engaged; board notified |
| Multiple employees involved in same incident | Separate files opened per employee; hearings may be consolidated with consent |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/disciplinary` | PLANNED | Case management; notice generation; hearing records |
| `@platform/compliance/pa-reporting` | PLANNED | PA notification for misconduct dismissals |
| `@platform/event-store` | Live | Event emission |
| Cross-procedure: PROC-HR-MC-01 | POPULATED | Malus/clawback trigger on material risk-taker misconduct |

## 9. Quality controls

- Notice of hearing issued minimum 5 business days before hearing.
- Presiding officer is independent of the employee's direct line.
- All evidence stored as POPIA-compliant, BLAKE3-hashed artefacts.
- Sanction schedule applied consistently; precedent review before every sanction.
- PA notification submitted within prescribed period for qualifying dismissals.
- CCMA referral window (30 days) tracked per case.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Misconduct report | `MisconductReportReceived` | 5 years post-case closure |
| Investigation summary | `PreliminaryInvestigationCompleted` | 5 years post-case closure |
| Notice of hearing | `DisciplinaryHearingNoticeIssued` | 5 years post-case closure |
| Hearing record (minutes / recording) | `DisciplinaryHearingConducted` | 5 years post-case closure |
| Sanction notice (with reasons) | `DisciplinarySanctionIssued` | 5 years post-case closure |
| Appeal outcome (if applicable) | `DisciplinaryAppealOutcome` | 5 years post-case closure |
| PA notification (if submitted) | — | 7 years |
| CCMA referral and outcome (if applicable) | `DisciplinaryCaseClosed` | 7 years |
