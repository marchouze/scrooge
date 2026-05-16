---
procedureId: PROC-HR-FP-01
title: Ongoing fit-and-proper attestation — non-FAIS-KI roles
author: Sade (AgentOps & token efficiency engineer) · Owen (Company Secretary, governance) · Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer) · Owen (Company Secretary, governance) · Helena (Chief Risk Officer, governance)
status: POPULATED
policy-cited: Fit-and-Proper Policy (planned)
system-capability: "@platform/officers/fit-and-proper-attestation (PLANNED)"
---

# Procedure — Ongoing fit-and-proper attestation — non-FAIS-KI roles

**Procedure ID:** PROC-HR-FP-01
**Owner:** Sade (AgentOps & token efficiency engineer) · Owen (Company Secretary, governance) · Helena (Chief Risk Officer, governance)
**Approval:** Board (director attestations); Helena (senior management attestations)
**Cadence:** Annual (all designated roles); on-trigger (adverse event detected)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** The FAIS Key Individual fit-and-proper procedure is PROC-FAIS-KI-FAP-01. This procedure covers all other senior roles: directors, prescribed officers, CEO, CRO, CFO, COO, CCO, CISO, CAE, CoSec, Information Officer, and any future GC/CHRO. Build-phase: procedure is pre-drafted; attestation cycle activates when human role-holders are appointed. Agent personas (Sade, Helena, Owen etc.) are standing autonomous agents, not human employees subject to personal F&P attestation; only their human statutory counterparts (at licence-day) are in scope.

## 1. Source policy

- Fit-and-Proper Policy (planned; Sade + Owen + Helena co-author).
- Banks Act 94 of 1990 s.60A — PA must be notified on prescribed events affecting suitability of directors, senior managers, and prescribed officers.
- Companies Act 71 of 2008 s.69 — director disqualification criteria.
- Cross-link: PROC-FAIS-KI-FAP-01 covers FAIS Key Individuals specifically; this procedure covers the broader officer population.

```
Regulation (Banks Act s.60A + PA fit-and-proper standards + Companies Act s.69)
  → Fit-and-Proper Policy (planned)
    → PROC-HR-FP-01 (this procedure)
      → @platform/officers/fit-and-proper-attestation (PLANNED)
        → Annual attestation records · PA notifications · Fit-and-proper register
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-11` (Banks Act s.60A — PA notification on prescribed events) | The bank must notify the PA if a director, senior manager, or prescribed officer ceases to be fit and proper; notification within prescribed period. PA may instruct removal. |
| `ORG-GV-02` (PA fit-and-proper standards for banks — Guidance Note 1 of 2015) | All directors and senior management must be and remain fit and proper: honesty and integrity; financial soundness; competence; absence of disqualifying circumstances. Ongoing monitoring covenant. |
| `ORG-GV-03` (Companies Act s.69 — Director disqualification) | A person is disqualified from acting as director if: declared delinquent; prohibited by court; insolvent; convicted of certain offences. Owen as CoSec must maintain the register. |
| `ORG-GV-01` (King IV Principle 9) | Governing body satisfies itself that each director is and remains fit and proper; annual attestation minimum. |
| `ORG-CD-04` (POPIA s.11–19) | Personal information collected during fit-and-proper assessment is PII; processed on regulatory-obligation basis; POPIA s.19–22 safeguards apply. |

## 3. Purpose

1. Maintain an up-to-date, auditable record of the fit-and-proper status of every director, prescribed officer, and senior manager.
2. Detect adverse events (conviction, insolvency, regulatory censure) that affect an individual's fit-and-proper standing and trigger mandatory PA notification.
3. Produce annual self-declarations across the four dimensions (honesty and integrity, financial soundness, competence, absence of disqualifying circumstances) in a typed, verifiable form.
4. Support Owen's (Company Secretary, governance) statutory obligation to maintain the directors' register and the fit-and-proper file required by the PA.
5. Ensure no role-holder continues in a designated seat once a fit-and-proper failure is detected without the requisite PA / board process.

## 4. Trigger

- **Annual scheduler:** `AnnualFitAndProperCycleInitiated { financialYear, roleCohort, initiatedAt }` — emitted in Q1 of each financial year for all designated roles.
- **Adverse event — on-trigger:** `FitAndProperAdverseEventDetected { roleHolderId, eventType, detectedAt }` — emitted when Sade's monitoring harness or Owen's registry scan detects a potentially disqualifying event (court judgment, regulatory action, insolvency filing, criminal charge).
- **New appointment:** `OfficerSeatAssignmentProposed { seatType, candidateId, nominatedAt }` — initial F&P assessment before appointment is confirmed.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive trigger; open F&P assessment file for the cohort / individual; notify Owen and Helena | `system` | `@platform/officers/fit-and-proper-attestation` (PLANNED) | Annual cycle opens files for all designated roles in one batch; on-trigger opens a single file for the affected individual. |
| 2 | **Issue self-declaration.** Send each role-holder a structured self-declaration form covering: (a) honesty and integrity — no criminal convictions, no regulatory sanctions, no adverse court orders; (b) financial soundness — no insolvency, no debt administration; (c) competence — qualifications and experience remain current; (d) absence of disqualifying circumstances under Companies Act s.69 | `agent` (Sade) | `@platform/officers/fit-and-proper-attestation` (PLANNED) | Form must be ECTA-compliant (electronic signature accepted). Deadline: 15 business days from issue date. |
| 3 | **Third-party verification.** Sade runs automated checks against: CIPC director-disqualification register; PA / FSCA enforcement register; credit bureau (financial soundness); court-judgment register | `agent` (Sade) | `@platform/officers/fit-and-proper-attestation` (PLANNED) | Automated checks run in parallel with the self-declaration step. Results are matched against the self-declaration for consistency. |
| 4 | Emit `FitAndProperSelfDeclarationReceived { roleHolderId, declarationDate, dimensionsCompleted, selfDeclarationRef }` and `FitAndProperVerificationCompleted { roleHolderId, verificationDate, allClear: boolean, discrepancies, verificationRef }` | `system` | `@platform/event-store` | |
| 5 | **Discrepancy review.** If any discrepancy between self-declaration and third-party verification: Helena (CRO) reviews; engages the role-holder for explanation; determines if the discrepancy is material | `human` (Helena — CRO, governance) | — | Human step — materiality determination requires professional judgement. Discrepancy is flagged immediately to Owen (CoSec) for register annotation. |
| 6 | **Annual attestation sign-off.** For directors: Owen presents the consolidated F&P attestation pack to the board for noting; directors attest annually to their own F&P status. For senior management: Helena sign-offs | `human` (Owen — CoSec, governance · Helena — CRO, governance · each director) | `@platform/governance/committee-management` (PLANNED) | Human step — board attestation is a statutory requirement. Board minutes record the attestation. |
| 7 | Emit `FitAndProperAttestationApproved { roleHolderId, attestationDate, dimensions: ['HonestyIntegrity', 'FinancialSoundness', 'Competence', 'NoDisqualification'], boardRef | helenaSignOffRef }` | `system` | `@platform/event-store` | |
| 8 | **Adverse-event path (on-trigger).** If `FitAndProperAdverseEventDetected`: Helena determines urgency; if the individual must be suspended from duties pending investigation, Helena recommends and Marc (CEO) approves suspension | `human` (Helena — CRO · Marc — CEO) | — | Human step — suspension from a statutory seat is a significant executive/governance act. PA notification is the parallel track (step 9). |
| 9 | **PA notification (s.60A).** If an adverse event indicates the role-holder may no longer be fit and proper: Owen prepares the PA notification; Zara (CCO, governance) reviews; Helena signs off; Owen submits via PA RECON portal within the prescribed period | `agent` (Owen — CoSec, notification prep) + `human` (Helena — sign-off · Zara — compliance review) | `@platform/compliance/pa-reporting` (PLANNED) | Human sign-off on PA notification — Banks Act s.60A. Prescribed notification period must be confirmed against current PA guidance; default assumption is 5 business days. |
| 10 | Emit `PAFitAndProperNotificationSubmitted { roleHolderId, notificationDate, paRef, submittedAt }` | `system` | `@platform/event-store` | |
| 11 | **Register update.** Owen updates the fit-and-proper register and the directors' register; annotates any ongoing F&P findings | `agent` (Owen — CoSec, register maintenance) | `@platform/officers/fit-and-proper-attestation` (PLANNED) | Register is the canonical source for current F&P status of all designated roles. |
| 12 | Close the assessment file; emit cycle-closure event | `agent` (Sade) | `@platform/officers/fit-and-proper-attestation` (PLANNED) | |
| 13 | Emit `FitAndProperCycleClosed { cohort | roleHolderId, closedAt, nextCycleDue, openFindings }` | `system` | `@platform/event-store` | `openFindings` lists any unresolved adverse events or PA-in-progress items. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Cycle orchestration; self-declaration issuance; third-party verification; discrepancy flagging |
| Owen (Company Secretary, governance) | Directors' register; PA notification submission; board pack preparation |
| Helena (Chief Risk Officer, governance) | Discrepancy review; materiality determination; senior-management sign-off; suspension recommendation |
| Zara (Chief Compliance Officer, governance) | PA notification compliance review |
| Marc (CEO) | Suspension approval (adverse-event path); board-chair role in attestation |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| Role-holder fails to return self-declaration within 15 days | Sade escalates to Helena and Owen; reminder issued; if no response within 5 further days, board notified |
| Material discrepancy identified | Helena convenes within 2 business days; suspension considered; PA notification prepared |
| PA instructs removal of a role-holder | Board convenes within 5 business days; Imani (legal-as-code engineer) advises on transition |
| Multiple role-holders simultaneously affected | Marc convenes emergency board meeting; external counsel engaged via Imani |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/officers/fit-and-proper-attestation` | PLANNED | Assessment workflow; self-declaration; verification |
| `@platform/compliance/pa-reporting` | PLANNED | PA notification submission |
| `@platform/governance/committee-management` | PLANNED | Board attestation pack; meeting records |
| `@platform/event-store` | Live | Event emission |

## 9. Quality controls

- Annual cycle initiated within first 10 business days of Q1.
- Third-party verification completed within 10 business days of cycle opening.
- No role-holder may act in a designated seat with an unresolved material adverse finding for more than 5 business days.
- PA notification submitted within prescribed period (default: 5 business days of adverse event confirmation).
- Fit-and-proper register reviewed by Owen quarterly for staleness.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Self-declaration (ECTA-signed) | `FitAndProperSelfDeclarationReceived` | 7 years post-tenure |
| Third-party verification report | `FitAndProperVerificationCompleted` | 7 years post-tenure |
| Board attestation minutes | `FitAndProperAttestationApproved` | 7 years post-tenure |
| PA notification (if submitted) | `PAFitAndProperNotificationSubmitted` | 7 years post-tenure |
| Fit-and-proper register | Ongoing | Permanent |
| Adverse-event investigation record | `FitAndProperAdverseEventDetected` | 7 years post-tenure |
