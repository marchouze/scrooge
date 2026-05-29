---
policy-parent: Skills Development Policy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-HR-WSP-01
title: Workplace Skills Plan and Annual Training Report cycle — Skills Development Act
author: Sade (AgentOps & token efficiency engineer)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer)
status: POPULATED
policy-cited: Skills Development Policy (planned)
system-capability: "@platform/hr/skills-development (PLANNED)"
---

# Procedure — Workplace Skills Plan and Annual Training Report cycle — Skills Development Act

**Procedure ID:** PROC-HR-WSP-01
**Owner:** Sade (AgentOps & token efficiency engineer)
**Approval:** Marc (CEO — WSP and ATR sign-off as Skills Development Facilitator or designated responsible person)
**Cadence:** Annual (WSP due 30 April; ATR due 30 April of the following year); SDL levy cycle
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** Skills Development Act 97 of 1998 and the FASSET SETA obligations bind levy-paying employers. SDL obligations commence when payroll exceeds the SDL levy threshold (1% of annual payroll). During the build phase the bank has no payroll; this procedure is pre-drafted and activates when payroll and SDL obligations begin (at or after licence-day). Build-phase: table-top exercise; FASSET registration to be completed at payroll commencement.

## 1. Source policy

- Skills Development Policy (planned; Sade co-author).
- Skills Development Act 97 of 1998 — WSP and ATR submission obligations.
- Skills Development Levies Act 9 of 1999 — SDL levy (1% of payroll); mandatory grant mechanism.
- FASSET SETA — Finance and Accounting Services Sector Training Authority; the bank's applicable SETA.
- FASSET Grant Regulations — mandatory grant (20% levy refund) and discretionary grants.

```
Regulation (SDA s.10 + SDLA + FASSET Grant Regulations)
  → Skills Development Policy (planned)
    → PROC-HR-WSP-01 (this procedure)
      → @platform/hr/skills-development (PLANNED)
        → WSP submission · ATR submission · FASSET grant claim
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-16` (SDA s.10 — Skills Development Facilitator) | Levy-paying employers must appoint a Skills Development Facilitator (SDF); SDF is responsible for WSP and ATR submissions to the relevant SETA. |
| `ORG-HR-17` (SDLA s.3 — SDL levy) | Employers with an annual payroll > R500,000 must pay SDL at 1% of payroll monthly via SARS; non-payment attracts interest and penalties. |
| `ORG-HR-18` (FASSET Grant Regulations — Mandatory grant) | Employers who submit a compliant WSP and ATR on time are entitled to receive 20% of the SDL levy paid back as a mandatory grant. |
| `ORG-HR-19` (FASSET Grant Regulations — Discretionary grant) | FASSET may award additional discretionary grants for aligned training programmes; application is separate from WSP/ATR submission. |
| `ORG-HR-20` (SDA s.10(1)(a) — WSP content) | WSP must include: employer profile; occupational categories of employees; training needs analysis; planned training interventions; numerical targets by designated group. |

## 3. Purpose

1. Register the bank with FASSET as a levy-paying employer and appoint a Skills Development Facilitator.
2. Compile and submit a compliant Workplace Skills Plan (WSP) to FASSET by 30 April each year.
3. Compile and submit the Annual Training Report (ATR) by 30 April of the following year, reporting on actual training delivered against the WSP.
4. Claim the mandatory grant (20% SDL refund) from FASSET on time.
5. Identify and apply for FASSET discretionary grants for qualifying training programmes.

## 4. Trigger

- **SDL obligation commencement:** `SDLObligationCommenced { payrollStartDate, annualPayrollEstimate, commencedAt }` — emitted when payroll commences and the SDL threshold is crossed; triggers FASSET registration and first WSP cycle.
- **Annual WSP scheduler:** `WSPCycleInitiated { reportingYear, wspdDeadline: '30 April', initiatedAt }` — emitted in January each year (to allow sufficient preparation time).
- **Annual ATR scheduler:** `ATRCycleInitiated { reportingYear, atrdDeadline: '30 April', initiatedAt }` — emitted in January for the ATR of the prior training year.

## 5. Steps

### Phase 1 — FASSET Registration (first-time, on SDL commencement)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| R1 | On `SDLObligationCommenced`: register the bank with FASSET online; obtain FASSET employer number; appoint a Skills Development Facilitator (SDF) — Marc or a designated qualified SDF | `agent` (Sade) + `human` (Marc — CEO, SDF designation) | `@platform/hr/skills-development` (PLANNED) | SDF must meet FASSET SDF qualifications or experience requirements. Marc may act as SDF for the first year; Sade supports. |
| R2 | Emit `FASSETRegistrationCompleted { fassetEmployerNumber, sdfName, registeredAt }` | `system` | `@platform/event-store` | |

### Phase 2 — Workplace Skills Plan (WSP) Cycle

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| W1 | Receive `WSPCycleInitiated`; conduct a training needs analysis (TNA): identify skills gaps by occupational level, role, and strategic priority; cross-reference with the EE plan targets (PROC-HR-EE-01) | `agent` (Sade) | `@platform/hr/skills-development` (PLANNED) | TNA must involve line-manager input and employee consultation. Results are the foundation of the WSP. |
| W2 | Compile the WSP on FASSET's prescribed template: employer profile; current workforce profile; TNA summary; planned training interventions (course, provider, number of employees, cost, timeline); numerical targets by designated group | `agent` (Sade) | `@platform/hr/skills-development` (PLANNED) | WSP must use FASSET's current prescribed template; check FASSET website annually for template updates. |
| W3 | Emit `WSPDraftCompleted { reportingYear, draftRef, completedAt }` | `system` | `@platform/event-store` | |
| W4 | **CEO sign-off.** Marc (CEO / SDF) reviews and signs the WSP | `human` (Marc — CEO) | — | Human step — FASSET requires sign-off by the employer's responsible person. |
| W5 | **FASSET submission.** Sade submits the signed WSP via the FASSET online submission portal by 30 April; retains submission confirmation and FASSET reference number | `agent` (Sade) | `@platform/hr/skills-development` (PLANNED) | Late submission = forfeiture of the mandatory grant for that year. |
| W6 | Emit `WSPSubmitted { reportingYear, submissionDate, fassetRef, submittedAt }` | `system` | `@platform/event-store` | |
| W7 | **Discretionary grant application (optional).** Sade reviews FASSET's discretionary grant criteria; applies for qualifying training programmes via the FASSET portal | `agent` (Sade) | `@platform/hr/skills-development` (PLANNED) | Discretionary grants are awarded at FASSET's discretion; submission timeline varies by grant window. |

### Phase 3 — Annual Training Report (ATR) Cycle

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| A1 | Receive `ATRCycleInitiated`; compile the ATR on FASSET's prescribed template: actual training interventions delivered vs. WSP plan; beneficiary details by designated group; SDL levy paid; mandatory grant claimed | `agent` (Sade · Yael — tax and regulatory reporting engineer, SDL levy data) | `@platform/hr/skills-development` (PLANNED) | ATR must be submitted simultaneously with the new year's WSP by 30 April. Yael provides SDL levy payment data from the PAYE/SDL monthly submissions. |
| A2 | Emit `ATRDraftCompleted { reportingYear, draftRef, completedAt }` | `system` | `@platform/event-store` | |
| A3 | **CEO sign-off on ATR.** Marc (CEO / SDF) reviews and signs the ATR | `human` (Marc — CEO) | — | Human step — same sign-off obligation as WSP. |
| A4 | **FASSET submission (ATR + new WSP).** Sade submits both the ATR for the prior year and the WSP for the new year simultaneously | `agent` (Sade) | `@platform/hr/skills-development` (PLANNED) | FASSET evaluates both submissions together; non-submission of ATR disqualifies the mandatory grant even if WSP is submitted. |
| A5 | Emit `ATRSubmitted { reportingYear, submissionDate, fassetRef, submittedAt }` | `system` | `@platform/event-store` | |
| A6 | **Mandatory grant claim.** FASSET pays the mandatory grant (20% of SDL levy) into the bank's registered account within 3 months of compliant WSP/ATR receipt; Sade reconciles receipt against the expected grant | `agent` (Sade · Yael — reconciliation) | `@platform/hr/skills-development` (PLANNED) | If grant not received within 3 months, Sade escalates to FASSET; dispute resolution via FASSET queries portal. |
| A7 | Emit `MandatoryGrantReceived { reportingYear, grantAmount, receivedAt }` | `system` | `@platform/event-store` | |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | SDA cycle orchestration; TNA; WSP/ATR compilation; FASSET submission; grant reconciliation |
| Marc (CEO / SDF) | WSP and ATR sign-off; SDF functions; employee consultation chair |
| Yael (tax and regulatory reporting engineer) | SDL levy payment data; grant-receipt reconciliation |
| Zara (Chief Compliance Officer, governance) | SDA/SDLA compliance oversight |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| FASSET online portal unavailable near deadline | Sade escalates to Marc; FASSET helpdesk contacted; alternative submission method requested |
| Mandatory grant not received within 3 months | Sade raises query with FASSET; Zara monitors; Imani (legal-as-code engineer) engaged if dispute unresolved |
| SDL levy payment discrepancy | Yael investigates; corrected EMP201 submitted; SARS penalty mitigation if applicable |
| FASSET audit / compliance review | Zara coordinates; all WSP, ATR, TNA, training records provided within prescribed period |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/skills-development` | PLANNED | WSP/ATR workflow; FASSET portal integration; grant tracking |
| `@platform/event-store` | Live | Event emission |

## 9. Quality controls

- WSP submitted by 30 April annually; ATR submitted simultaneously.
- TNA conducted with line-manager and employee input each cycle.
- CEO sign-off obtained before any FASSET submission.
- Mandatory grant reconciled within 30 days of expected receipt date.
- FASSET registration and SDF appointment kept current.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Training needs analysis | `WSPCycleInitiated` | 5 years |
| Signed WSP | `WSPSubmitted` | 5 years |
| FASSET WSP submission confirmation | `WSPSubmitted` | 5 years |
| Signed ATR | `ATRSubmitted` | 5 years |
| FASSET ATR submission confirmation | `ATRSubmitted` | 5 years |
| Mandatory grant receipt | `MandatoryGrantReceived` | 5 years |
| Training records (beneficiary evidence) | `ATRDraftCompleted` | 5 years |
