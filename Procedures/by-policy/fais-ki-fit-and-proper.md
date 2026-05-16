---
procedureId: PROC-FAIS-KI-FAP-01
title: FAIS Key Individual fit-and-proper file
author: Sade (AgentOps engineer) · Zara (Chief Compliance Officer, governance) · Mira (regulatory intelligence engineer)
date: 2026-05-16
owner: Sade (AgentOps engineer) · Zara (Chief Compliance Officer, governance) · Saskia (Head of Global Markets, governance — named Key Individual at licence-day)
status: POPULATED
policy-cited: FAIS Policy v0.1 (STUB, FSP-conditional) · Fit-and-Proper Policy (planned)
system-capability: "@platform/officers/fais-ki-fit-and-proper (PLANNED)"
---

# Procedure — FAIS Key Individual fit-and-proper file

**Procedure ID:** PROC-FAIS-KI-FAP-01
**Owner:** Sade (AgentOps engineer) · Zara (Chief Compliance Officer, governance) · Saskia (Head of Global Markets, governance — named Key Individual at licence-day)
**Approval:** BRC (under FAIS Policy v0.1 — FSP-conditional) and the Fit-and-Proper Policy (planned)
**Cadence:** On-trigger when a candidate is named to the FAIS Key Individual seat; continuous monitoring thereafter; renewal per FSCA Determination of Fit and Proper Requirements 2017
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- FAIS Policy v0.1 (STUB, FSP-conditional) — `Owner Inbox/2026-05-07_niko_conduct-policies-bundle-v0.md` §5 (Rep / KI authorisation discipline).
- Fit-and-Proper Policy (planned; queued under `Procedures/_index.md` row "Fit-and-Proper Policy → fit-and-proper-attestation.md"; Sade + Zara co-author).
- Decision record: `D-FSP-LICENCE-NECESSITY` (CEO-approved) — resolved `confirm-A-no-research`; makes this procedure load-bearing for the Saskia (Head of Global Markets, governance) transition to named KI at licence-application gate.
- Saskia handover partner procedure: `Owner Inbox/2026-05-09_saskia_fais-ki-handover-note.md` (PR #45) — candidate-side handover; this procedure is the assessor-side process.

The obligation chain:

```
Regulation (FAIS Act s.8 + FSCA Determination of Fit and Proper Requirements 2017)
  → FAIS Policy v0.1 · Fit-and-Proper Policy (planned)
    → PROC-FAIS-KI-FAP-01 (this procedure)
      → @platform/officers/fais-ki-fit-and-proper (PLANNED)
        → FSP licence application bundle
```

**Build-phase posture:** The substrate is built now; live execution against a real human candidate fires at licence-application gate (Saskia's KI assignment) and at licence-day for the broader officer composition. Build-phase runs are table-top exercises against the Saskia-as-KI assignment — they produce draft artefacts but do not emit production `FaisKiFitAndProperFileApproved` events. Sade (AgentOps engineer) is reshaped to AgentOps during the build phase; the human-HR slice activates at licence-day.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CD-03` (FAIS Act s.8) | FSP licence applicants must designate Key Individual(s); KI must satisfy the five-dimension fit-and-proper test set by the FSCA Determination of Fit and Proper Requirements 2017. KI must be designated and fit-and-proper at the moment of FSP-licence application. |
| `ORG-GV-11` (FSCA Determination of Fit and Proper Requirements 2017) | Five dimensions: honesty and integrity; competence (qualifications, experience, regulatory examinations, CPD); operational ability; financial soundness; oversight. Each dimension requires structured evidence; FSCA can withdraw KI approval on fit-and-proper failure. |
| `ORG-CS1-002` (CS 1/2018 §4) | Fit-and-proper: senior management, controlling body, key individuals; procedure carries the same five-dimension test CS 1/2018 references. |
| `ORG-GV-11` (Banks Act + PA fit-and-proper standards) | Designated officers must meet fit-and-proper standards continuously; ongoing-monitoring covenant is binding. |
| `ORG-HR-11` (PA fit-and-proper standards for banks) | PA fit-and-proper requirements for bank directors and prescribed officers; the five-dimension framework here is the substrate every officer seat re-uses; FAIS-KI is the first instance. |
| `ORG-CD-04` (POPIA s.11–19) | Personal information collected during the fit-and-proper assessment is PII subject to POPIA; processed on contractual necessity and regulatory obligation bases; POPIA s.19–22 safeguards apply. |

## 3. Purpose

1. Assemble, verify, file, and continuously monitor the structured fit-and-proper file for the bank's FAIS Key Individual under the FSCA Determination of Fit and Proper Requirements 2017.
2. Produce a typed, citable evidence trail across the five Determination dimensions — honesty and integrity, competence, operational ability, financial soundness, oversight — for each named KI candidate.
3. Emit a composite `FaisKiFitAndProperFileApproved` event that is the event store's record-of-truth for the KI's fitness at the moment of FSP-licence application.
4. Maintain the five-dimension framework as reusable engineering substrate for every officer seat (CEO, CRO, CFO, COO, Treasurer, Head of Markets, CCO, CISO, CAE, GC, CHRO, CoSec, IO) — FAIS-KI is the first instance; the broader six-human officer composition runs at licence-day.
5. Enforce the ongoing-monitoring covenant so that any change in any dimension is detected and processed immediately, preventing the bank from operating under a lapsed or invalidated KI appointment.

## 4. Trigger

- **Primary (nomination):** `OfficerSeatAssignmentProposed { candidateId, seatType: 'FAIS_KEY_INDIVIDUAL', nominatedBy, nominatedAt }` — emitted when a candidate is nominated to the FAIS KI seat. (Substrate gap: event type planned — Atlas, Core banking platform architect, v1 follow-on.)
- **Build-phase entry point (current):** triggered by the Saskia-as-KI assignment under `D-FSP-LICENCE-NECESSITY`; Sade initiates the procedure manually; table-top exercise mode until licence-application gate.
- **Ongoing-monitoring trigger:** Any input event that affects one or more of the five dimensions — court judgment, regulatory action, NCR debt arrangement, insolvency event, qualification revocation, CPD points shortfall, change in reporting line. (Substrate gap: input-event taxonomy — Atlas + Sade.)
- **Annual CPD cycle:** FSCA mandates minimum CPD hours per KI category; trigger emitted by the annual CPD scheduler for each active KI.
- **Renewal trigger:** Per the FSCA Determination of Fit and Proper Requirements 2017 renewal interval (citation: TBC — Imani, legal-as-code engineer, + external counsel ratify at licence-application gate).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On `OfficerSeatAssignmentProposed { seatType: 'FAIS_KEY_INDIVIDUAL' }`: create the candidate's five-dimension assessment file; notify Zara (CCO) and Sade (AgentOps); begin evidence collection across all five dimensions in parallel | `system` | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | All five dimensions run in parallel; the composite approval step (step 12) waits for all five to complete. |
| 2 | **Dimension 1 — Honesty and integrity.** Run criminal-record check (SAPS clearance); civil-judgments declaration (sworn affidavit + court-records search); regulator-prior-action search (FSCA / PA / FIC enforcement registers); bankruptcy / insolvency search (CIPC + court records) | `agent` (Sade — background-check provider orchestration) + `human` (candidate — sworn declaration) | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | A hit on any of these searches triggers immediate escalation to Zara before the dimension can be marked complete. Results bound into a typed evidence object; sworn declaration is an ECTA-signed artefact. |
| 3 | Emit `BackgroundCheckCompleted { kiId, dimension: 'HonestyIntegrity', outcome: 'Clear' | 'Flagged', evidenceRef, completedAt }` | `system` | `@platform/event-store` | `evidenceRef` is the BLAKE3 hash of the evidence bundle in the document store. |
| 4 | **Dimension 2 — Competence.** Verify qualifications (academic + professional); verify work history and regulated-activity experience; confirm FAIS regulatory exam certificates (RE5 + RE1 where applicable); log CPD points for the rolling 12-month period; confirm sufficiency for the specific FSP-licence categories sought | `agent` (Sade — qualification-verification provider) + `service` (FSCA RE-results query) | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | FAIS RE5 is mandatory for KI; RE1 may be required depending on FSP licence category. CPD points feed is the ongoing-monitoring input for this dimension. |
| 5 | Emit `CompetenceAttestationFiled { kiId, dimension: 'Competence', qualificationsVerified, reExams, cpdPoints, experienceYears, evidenceRef, filedAt }` | `system` | `@platform/event-store` | |
| 6 | **Dimension 3 — Operational ability.** Map the KI's seat-specific responsibilities (for Saskia-as-KI: oversight of representatives, compliance with FAIS General Code, maintenance of FAIS records); conduct capacity assessment and time-allocation analysis; confirm operational independence (KI must be able to halt FSP regulated activities if compliance fails); cross-check against Saskia's parallel Head-of-Markets governance load for capacity / dual-mandate conflict | `agent` (Sade) + `human` (Zara — CCO governance) + `human` (Owen, Company Secretary, governance — operational-independence gate) | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | The dual-mandate conflict (KI seat + Head-of-Markets revenue accountability) is a structural conflict; a mitigation plan must be filed as an artefact before this dimension is marked complete. |
| 7 | Emit `OperationalAbilityAssessed { kiId, dimension: 'OperationalAbility', responsibilitiesMapped, capacityGate: 'Pass' | 'Fail', conflictMitigation, evidenceRef, assessedAt }` | `system` | `@platform/event-store` | |
| 8 | **Dimension 4 — Financial soundness.** Capture personal solvency declaration (assets / liabilities / contingent obligations — sworn statement); confirm no insolvency event in past 10 years (CIPC + court records); confirm no court-ordered debt arrangement (NCR debt review / administration / sequestration) | `agent` (Sade — service integration) + `human` (candidate — sworn declaration) | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | Cross-links with dimension 1 (steps 2–3) — same CIPC / court data feed. A hit triggers immediate escalation to Zara. |
| 9 | Emit `FinancialSoundnessAttested { kiId, dimension: 'FinancialSoundness', solvencyDeclaration, insolvencyCheck: 'Clear' | 'Flagged', debtArrangementCheck: 'Clear' | 'Flagged', evidenceRef, attestedAt }` | `system` | `@platform/event-store` | |
| 10 | **Dimension 5 — Oversight.** Confirm KI's reporting line to a level that can hold the KI accountable (for Saskia-as-KI: governance line into the Board / Interim Audit Forum via Owen, CoSec); capture conflict-of-interest disclosure (external roles, related-party exposures, dual-mandate conflicts — cross-links with `conflicts-declaration.md`); record the ongoing-monitoring covenant (candidate covenants to disclose any change within the prescribed interval) | `agent` (Sade) + `human` (Owen — governance escalation) + `human` (candidate — covenant signing, ECTA-compliant) | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | The covenant is a signed artefact; subsequent disclosures re-open the affected dimension(s) and restart the relevant sub-steps. |
| 11 | Emit `OversightStructureRecorded { kiId, dimension: 'Oversight', reportingLine, conflictDisclosures, covenantRef, recordedAt }` | `system` | `@platform/event-store` | |
| 12 | **Composite file approval.** Verify all five dimension events are in committed state and none has been retracted by an ongoing-monitoring re-open; Zara (CCO, governance) reviews and approves the composite file; Owen (Company Secretary, governance) ratifies for governance line (reporting-line and conflict-mitigation soundness) | `agent` (Sade — verification) + `human` (Zara — conduct-line approval) + `human` (Owen — governance-line ratification) | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | Both Zara and Owen must approve; neither can substitute for the other. |
| 13 | Emit `FaisKiFitAndProperFileApproved { kiId, compositeRef, dimensions: [all five evidenceRefs], approvedByCompliance: Zara, approvedByGovernance: Owen, approvedAt, validUntil }` | `system` | `@platform/event-store` | This is the canonical event that unlocks the FSP-licence application bundle. `validUntil` is set per the FSCA Determination renewal interval (citation: TBC). |
| 14 | **Publish to FAIS-KI register and FSP application bundle.** Sade writes the approved file to the FAIS-KI register; when the FSP-licence application fires, the file is included in the application bundle as the KI designation evidence | `system` | `@platform/officers/` (PLANNED) | The file is read-only after `FaisKiFitAndProperFileApproved`; any subsequent change requires a re-run of the affected dimension(s) and a new composite approval. |
| 15 | **Continuous monitoring.** Sade's monitoring substrate watches for input events that affect any of the five dimensions; on detection: emit `KiFitAndProperDimensionReopened { kiId, dimension, trigger, reopenedAt }`; invalidate the composite approval; notify Zara immediately; re-run affected dimension sub-steps | `agent` (Sade) | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | Composite invalidation means the KI's approved status is suspended; if not resolved within the escalation window (§9), the FSP's regulated activities must be halted. |
| 16 | **Annual CPD cycle.** Sade's CPD monitoring substrate checks that the KI has accumulated the FSCA-mandated minimum CPD hours for the rolling 12-month period; issues a reminder at 90 days before the annual deadline; triggers competence-dimension re-attest if CPD shortfall is confirmed | `agent` (Sade) | `@platform/officers/fais-ki-fit-and-proper` (PLANNED) | CPD shortfall is a dimension-2 (Competence) finding; it re-opens that dimension and requires Zara's remediation sign-off before the dimension event is re-committed. |

## 6. Reconciliation

- **Events produced:**
  - `BackgroundCheckCompleted { kiId, dimension, outcome, evidenceRef, completedAt }`
  - `CompetenceAttestationFiled { kiId, qualificationsVerified, reExams, cpdPoints, filedAt }`
  - `OperationalAbilityAssessed { kiId, capacityGate, conflictMitigation, assessedAt }`
  - `FinancialSoundnessAttested { kiId, solvencyDeclaration, insolvencyCheck, attestedAt }`
  - `OversightStructureRecorded { kiId, reportingLine, conflictDisclosures, covenantRef, recordedAt }`
  - `FaisKiFitAndProperFileApproved { kiId, compositeRef, dimensions, approvedAt, validUntil }` — composite
  - `KiFitAndProperDimensionReopened { kiId, dimension, trigger, reopenedAt }` — on ongoing-monitoring trigger
  - `KiFitAndProperFailed { kiId, dimension, finding, failedAt }` — on unresolvable finding
- **Reconciliation checks (Vera asserts):**
  - Every `OfficerSeatAssignmentProposed { seatType: 'FAIS_KEY_INDIVIDUAL' }` has all five dimension events and a `FaisKiFitAndProperFileApproved` before the FSP-licence application is lodged.
  - No `FaisKiFitAndProperFileApproved` event is accepted while any dimension has a `KiFitAndProperDimensionReopened` without a downstream re-committed dimension event.
  - Annual CPD check: every active KI has a CPD attestation within the FSCA-mandated window.
  - `FaisKiFitAndProperFileApproved.validUntil` not past for any active KI; expired files trigger immediate Zara notification.
- **Failure mode:** If `@platform/officers/fais-ki-fit-and-proper` is unavailable, Sade manages the five-dimension evidence collection manually using the FSCA Determination checklist; Zara and Owen review the manual output; all findings are entered into the event store manually with `ManualFitAndProperFlag { kiId, reason }`.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All five dimension events + composite event | Event log (`@platform/event-store`) | Permanent (Principle 1) | PII — POPIA s.19–22 safeguards; access restricted to Sade, Zara, Owen |
| Sworn declarations (civil judgments, personal solvency, conflict-of-interest, ongoing-monitoring covenant) | Document store (BLAKE3-addressed, ECTA-signed) | Per FSCA Determination renewal interval (TBC) | PII; legal privilege where counsel-prepared |
| Background-check / qualification-verification / RE-exam reports | Document store | Per FSCA Determination renewal interval (TBC) | PII; restricted access |
| FAIS RE5 / RE1 certificates | Document store | Permanent | PII; restricted access |
| CPD log (rolling 12-month) | Document store + CPD register projection | Current period + 5 years | PII; restricted |
| Conflict-of-interest disclosure and mitigation plan | Document store | Permanent (governance record) | Restricted |
| FAIS-KI register entry | `@platform/officers/` (PLANNED) | Permanent | Internal; restricted to governance + AgentOps |
| FSP-licence application KI bundle | Document store | Permanent (regulatory record) | Restricted — regulatory submission |

## 8. Manual steps

1. **FSCA Determination section-ref ratification:** All `[citation: TBC]` references in §2 and §5 must be ratified by Imani (legal-as-code engineer) + external counsel at the licence-application gate — counsel reads the FSCA Determination of Fit and Proper Requirements 2017 and confirms the section anchors for each dimension, the renewal interval, and the covenant-disclosure interval. Owner: Imani + external counsel. Timing: licence-application gate.
2. **Sworn declarations (steps 2, 8, 10):** Signed by the candidate; processed through the bank's ECTA-compliant e-signing pipeline (Imani's substrate — PLANNED). Until the e-signing pipeline is live, signed PDFs are obtained and stored in the document store; ECTA Schedule 1 does not exclude these from electronic form.
3. **Background-check and qualification-verification providers (steps 2, 4):** External service providers sourced and contracted by Sade (AgentOps); provider contracts are manual procurement steps; the API integration into `@platform/officers/fais-ki-fit-and-proper` is PLANNED.
4. **Zara's composite review (step 12):** Irreducible human governance act — conduct-line approval of fit-and-proper assessments cannot be agent-default until the regulator accepts agent-issued fit-and-proper attestations.
5. **Owen's governance ratification (step 12):** Irreducible human governance act — governance-line ratification of reporting line and conflict mitigation is a regulatory-judgment step.
6. **CPD monitoring service integration (step 16):** CPD provider feed into the monitoring substrate is PLANNED; until live, Sade tracks CPD manually using provider-issued CPD statements.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Background-check hit (criminal record, regulator action, insolvency) | Service-feed event; `BackgroundCheckCompleted { outcome: 'Flagged' }` | Zara (CCO) within 24h; candidate not advanced; CEO notified if hit affects an already-appointed officer |
| RE5 / RE1 exam not held or failed | `CompetenceAttestationFiled` — RE exam gap | Zara + Owen; candidate either pursues RE within the candidate-status window or is withdrawn |
| Operational-ability concern — dual-mandate KI seat conflict unresolved | Step 6 capacity gate fails | Owen + Zara; mitigation required or candidate withdrawn; no FSP application until resolved |
| Financial-soundness drift post-appointment (debt review, sequestration) | Ongoing-monitoring event triggers `KiFitAndProperDimensionReopened { dimension: 'FinancialSoundness' }` | Zara + Owen within 24h; FSP regulated activities halted until re-approved or KI replaced |
| CPD shortfall confirmed | CPD monitoring — points below FSCA minimum | Sade + Zara; KI has 90 days to complete shortfall CPD; dimension re-attest required before window closes |
| Composite approval `validUntil` lapsed | Vera scheduled invariant check | Zara (immediate); FSP regulated activities halted until renewed or KI replaced; FSCA notification may be required |
| FSCA withdraws KI approval | FSCA correspondence received | Zara + Owen + CEO immediately; FSP regulated activities halted; Owen files any required FSCA notifications; Nolan (talent acquisition) initiates KI replacement process |

## 10. Related procedures

- [`fais-advice-record-capture.md`](fais-advice-record-capture.md) (PROC-CRM-FA-01) — gates on the KI's active `FaisKiFitAndProperFileApproved` event; this procedure produces the gate that procedure relies on.
- [`conflicts-declaration.md`](conflicts-declaration.md) — KI conflict-of-interest disclosure (step 10) cross-links with the conflicts-declaration procedure; the conflicts register is the canonical source.
- [`client-categorisation.md`](client-categorisation.md) (PROC-MK-ODP-08) — the FAIS KI's oversight obligation includes governance of the categorisation regime; Saskia-as-KI is accountable for categorisation conduct.
- `fit-and-proper-attestation.md` (PLANNED) — broader fit-and-proper framework re-using the five-dimension substrate built here; Sade + Zara follow-on when the broader officer composition fires at licence-day.
- [`odp-authorisation-application.md`](odp-authorisation-application.md) (PROC-MK-ODP-01) — ODP-track authorisation; the same five-dimension framework applies to ODP-named individuals; PROC-FAIS-KI-FAP-01 is the template.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Sade (AgentOps engineer) | Initial STUB — five-dimension framework named; six typed events identified as substrate gaps for Atlas v1; FSCA Determination section refs marked `[citation: TBC]`; created under `D-FSP-LICENCE-NECESSITY`. |
| v0.2 | 2026-05-16 | Sade (AgentOps engineer) · Zara (Chief Compliance Officer, governance) · Mira (regulatory intelligence engineer) | STUB → POPULATED: full 12-section procedure; 16-step five-dimension workflow with typed events at each dimension; composite approval pathway; continuous monitoring and annual CPD cycle; full evidence / artefact table; named substrate gaps retained; §9 failure modes expanded; POPIA safeguards documented. |

## 12. Audit / assurance

- **Vera daily:** active KI composite-approval validity check — `FaisKiFitAndProperFileApproved.validUntil` not past; no open `KiFitAndProperDimensionReopened` without a downstream re-committed dimension event; flag to Zara immediately on any gap.
- **Vera monthly:** CPD points accumulation check for each active KI; RE exam currency check; conflict-of-interest disclosure currency check.
- **Vera annual:** dimension-event completeness audit for each active KI; `[citation: TBC]` section-ref currency check (have any been resolved or do new ones exist?); report to Thandiwe (CAE, governance) as part of the FAIS-compliance review.
- **Thandiwe (CAE, governance):** annual audit of the FAIS KI fit-and-proper framework; sample testing of evidence artefacts for each dimension; FSCA Determination alignment; opinion reported to Audit Committee; third-line-independent from Zara's second-line FAIS governance accountability.
- **FSCA supervisory:** FSCA may review the KI fit-and-proper file as part of the FSP licence application examination and any subsequent conduct supervision; the FAIS KI (Saskia at licence-day) bears personal accountability to FSCA; Zara manages the supervisory engagement; the `FaisKiFitAndProperFileApproved` event and the evidence bundle are the authoritative submissions.
