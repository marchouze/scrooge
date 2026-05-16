---
procedureId: PROC-HR-EE-01
title: Employment Equity annual report (EEA2/EEA4) — EE Act compliance
author: Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Employment Equity Policy (planned)
system-capability: "@platform/hr/employment-equity (PLANNED)"
---

# Procedure — Employment Equity annual report (EEA2/EEA4) — EE Act compliance

**Procedure ID:** PROC-HR-EE-01
**Owner:** Sade (AgentOps & token efficiency engineer)
**Approval:** Marc (CEO — EEA2/EEA4 sign-off as designated employer); Board (EE plan approval)
**Cadence:** Annual (15 January each year — statutory EEA2 deadline); EE plan review every 12 months
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** Employment Equity Act 55 of 1998 applies to designated employers — those with 50 or more employees or meeting a sectoral turnover threshold. During the build phase the bank is below the threshold (minimum human headcount). This procedure is pre-drafted and activates when the threshold is crossed (typically at or after licence-day when human hires are made). Build-phase: procedure runs as a table-top exercise to ensure the substrate is production-grade.

## 1. Source policy

- Employment Equity Policy (planned; Sade co-author).
- Employment Equity Act 55 of 1998 — designated employer obligations, EEA2/EEA4 reports, EE plan.
- EE Act s.21 — annual reporting obligation for designated employers.
- DoL Employment Equity online portal (https://www.labour.gov.za) — submission channel.

```
Regulation (EE Act s.21 + s.20 + EEA2/EEA4 regulations)
  → Employment Equity Policy (planned)
    → PROC-HR-EE-01 (this procedure)
      → @platform/hr/employment-equity (PLANNED)
        → EEA2 report · EEA4 report · DoL submission · Public display
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-05` (EEA s.21 — Annual EE reporting) | Designated employers must submit EEA2 (Employment Equity Report) and EEA4 (Income Differential Statement) annually to the DoL by 15 January. |
| `ORG-HR-12` (EEA s.20 — EE plan) | Designated employers must have an EE plan; plan must be reviewed and updated annually; plan must be made available to employees. |
| `ORG-HR-13` (EEA s.26 — Public display) | Employers must display the EEA2 report at the workplace; employees must be informed of EE progress annually. |
| `ORG-HR-14` (EEA s.27 — DoL inspection) | DoL may audit designated employers for EE compliance; employer must produce EE plan, EEA2, EEA4, and workforce analysis records. |
| `ORG-HR-15` (EEA s.6 — Non-discrimination) | Designated employer must take affirmative action measures; numerical targets must be set; progress reported in EEA2. |

## 3. Purpose

1. Compile an accurate workforce profile analysis disaggregated by designated group (race, gender, disability) and occupational level.
2. Prepare and submit the EEA2 (Employment Equity Report) and EEA4 (Income Differential Statement) to the DoL by the 15 January statutory deadline.
3. Review and update the EE plan annually to reflect current workforce demographics, affirmative action targets, and progress.
4. Display the EEA2 at the workplace and communicate EE progress to all employees.
5. Maintain the records required for a DoL compliance audit.

## 4. Trigger

- **Annual scheduler:** `EEAnnualReportCycleInitiated { reportingYear, initiatedAt }` — emitted in November each year (to allow sufficient time before the 15 January deadline).
- **Threshold-crossing event:** `DesignatedEmployerThresholdCrossed { employeeCount, thresholdDate }` — emitted when the headcount crosses the 50-employee threshold; triggers the first EEA2/EEA4 cycle and EE plan drafting.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive cycle trigger; open EE reporting file; notify Marc (CEO) of the reporting obligation and deadline | `agent` (Sade) | `@platform/hr/employment-equity` (PLANNED) | Reporting year is the 12-month period ending 30 September (statutory EEA2 reference period). |
| 2 | Emit `EEAnnualReportCycleOpened { reportingYear, deadline: '15 January', openedAt }` | `system` | `@platform/event-store` | |
| 3 | **Workforce profile analysis.** Sade compiles the workforce profile from HR records: headcount by occupational level, race, gender, disability, employment type (permanent, fixed-term, part-time); cross-checks against payroll data | `agent` (Sade) | `@platform/hr/employment-equity` (PLANNED) | Workforce profile is the foundation of both EEA2 and EEA4; accuracy is critical. Data is sourced from the HR information system; POPIA processing-purpose limitations apply. |
| 4 | **EE plan review.** Sade reviews the current EE plan against actual workforce demographics; updates numerical targets for each occupational level and designated group; identifies barriers to employment equity and proposed measures to address them | `agent` (Sade) · `human` (Marc — CEO, plan approval) | `@platform/hr/employment-equity` (PLANNED) | EE plan review must involve employee consultation (EEA s.16); consultation record is a required artefact. |
| 5 | **Employee consultation (EE plan review).** Sade coordinates consultation with employees or their representatives on the EE plan review; records consultation outcomes | `human` (Marc — CEO, chair of consultation) · `agent` (Sade — facilitation) | — | Human step — EEA s.16 requires meaningful consultation; consultation must be on the EE plan content, targets, and measures. |
| 6 | Emit `EEPlanReviewCompleted { reportingYear, updatedTargets, consultationRecordRef, reviewedAt }` | `system` | `@platform/event-store` | |
| 7 | **EEA2 preparation.** Sade compiles the EEA2 report using the DoL's prescribed form: Part A (business profile), Part B (workforce profile by occupational level and designated group), Part C (numerical goals — progress vs. targets), Part D (income differentials summary), Part E (affirmative action measures) | `agent` (Sade) | `@platform/hr/employment-equity` (PLANNED) | EEA2 must use the DoL's prescribed form exactly; deviations are grounds for non-acceptance. |
| 8 | **EEA4 preparation.** Sade compiles the EEA4 Income Differential Statement: median and mean remuneration by race, gender, and disability per occupational level; income differential ratio (highest to lowest paid); narrative explanation of differentials | `agent` (Sade · Yael — tax and regulatory reporting engineer, remuneration data) | `@platform/hr/employment-equity` (PLANNED) | EEA4 is a sensitive document; disclosure is to DoL only; internal handling under POPIA s.19–22. |
| 9 | Emit `EEA2DraftCompleted { reportingYear, draftRef, completedAt }` and `EEA4DraftCompleted { reportingYear, draftRef, completedAt }` | `system` | `@platform/event-store` | |
| 10 | **CEO sign-off.** Marc (CEO) as the designated employer's senior most responsible person reviews and signs the EEA2 and EEA4; certifies the accuracy of the data | `human` (Marc — CEO) | — | Human step — EEA s.21 requires the designated employer's senior person to sign the EEA2. No submission is valid without this signature. |
| 11 | **DoL submission.** Sade submits the signed EEA2 and EEA4 via the DoL Employment Equity online portal; retains submission confirmation and DoL reference number | `agent` (Sade) | `@platform/hr/employment-equity` (PLANNED) | Submission deadline: 15 January. Penalty for non-submission: EEA s.27 — DoL may impose compliance order and fines. |
| 12 | Emit `EEAnnualReportSubmitted { reportingYear, submissionDate, dolRef, submittedAt }` | `system` | `@platform/event-store` | |
| 13 | **Public display.** Sade publishes the EEA2 (excluding income data) in the workplace and on the intranet; issues a communication to all employees summarising EE progress | `agent` (Sade) | `@platform/hr/employment-equity` (PLANNED) | EEA s.26 — must be displayed in the workplace. Intranet display satisfies the requirement for a predominantly remote or AI-driven workforce. |
| 14 | Close reporting file; update the EE compliance register | `agent` (Sade) | `@platform/hr/employment-equity` (PLANNED) | |
| 15 | Emit `EEAnnualReportCycleClosed { reportingYear, closedAt, nextDeadline }` | `system` | `@platform/event-store` | |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Cycle orchestration; workforce analysis; EEA2/EEA4 compilation; DoL submission; public display |
| Marc (CEO) | EEA2/EEA4 sign-off; EE plan consultation chair; designated employer representative |
| Yael (tax and regulatory reporting engineer) | Remuneration data for EEA4 income differential statement |
| Zara (Chief Compliance Officer, governance) | EE Act compliance oversight; DoL inspection response |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| DoL online portal unavailable near deadline | Sade escalates to Marc immediately; paper submission fallback per DoL guidance |
| DoL issues compliance order | Zara coordinates response; Marc and Imani (legal-as-code engineer) engaged within 5 business days |
| Data discrepancy between HR and payroll records | Sade escalates to Yael and Marc; reconciliation required before submission |
| Threshold crossed unexpectedly mid-year | EE plan drafted within 3 months; first EEA2 due following January; Sade notifies Marc immediately |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/employment-equity` | PLANNED | EE report compilation; DoL portal integration; workforce analysis |
| `@platform/event-store` | Live | Event emission |

## 9. Quality controls

- EEA2 and EEA4 submitted by 15 January deadline each year.
- CEO signature obtained before any submission is made.
- EE plan reviewed and employee consultation conducted annually.
- EEA2 displayed in the workplace within 5 business days of submission.
- DoL confirmation receipt retained as BLAKE3-hashed artefact.
- EE compliance register reviewed by Zara quarterly.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Workforce profile analysis | `EEAnnualReportCycleOpened` | 5 years |
| EE plan (reviewed) | `EEPlanReviewCompleted` | 5 years |
| Consultation record | `EEPlanReviewCompleted` | 5 years |
| Signed EEA2 | `EEAnnualReportSubmitted` | 5 years |
| Signed EEA4 | `EEAnnualReportSubmitted` | 5 years |
| DoL submission confirmation | `EEAnnualReportSubmitted` | 5 years |
| Employee communication record | `EEAnnualReportCycleClosed` | 5 years |
