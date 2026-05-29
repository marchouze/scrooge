---
policy-parent: >
last-reviewed: 2026-05-22
procedureId: PROC-SWIFT-CSP-01
title: SWIFT Customer Security Programme (CSP) attestation
author: Senna (Security & Infrastructure engineer) · Tomas (Payments & settlement engineer)
date: 2026-05-22
owner: Senna (Security & Infrastructure engineer) · Tomas (Payments & settlement engineer)
status: POPULATED
policy-cited: >
  Policies/information-security-it-governance-policy-v1.md ·
  Policies/secure-sdlc-policy-v1.md ·
  Payments Policy v0.1 (STUB) ·
  Sponsor-Bank Operating Policy v0.1 (STUB)
system-capability: "@platform/security/swift-csp-controls (PLANNED) · @platform/payments/swift-infrastructure (PLANNED)"
---

# Procedure — SWIFT Customer Security Programme (CSP) attestation

**Procedure ID:** PROC-SWIFT-CSP-01  
**Owner:** Senna (Security & Infrastructure engineer) · Tomas (Payments & settlement engineer, payments)  
**Approval:** Rashida (Chief Information Security Officer, governance) — CISO sign-off · Devon (Chief Operating Officer, governance) — operational readiness · CEO — annual attestation  
**Cadence:** Annual (first cycle triggered by BIC issuance); re-attestation by 31 December each year; out-of-cycle on material infrastructure change or SWIFT-mandated interim assessment  
**Version:** v1.0 — 2026-05-22  
**Status:** POPULATED

> **Build-phase posture.** SWIFT CSP attestation binds from the moment the bank is allocated a BIC and connects to the SWIFT network. That event is a pre-licence milestone. This procedure must be production-grade by the pre-licence go-live readiness gate (`PROC-MK-PLG-01`). The attestation cycle does not run during the build phase — but the controls inventory and gap-remediation framework established here ARE load-bearing build-phase work.

## 1. Source policy

- `Policies/information-security-it-governance-policy-v1.md` — governs all IT security controls, including SWIFT-specific hardening requirements.
- `Policies/secure-sdlc-policy-v1.md` — secure software development lifecycle requirements applicable to SWIFT-connected components.
- Payments Policy v0.1 (STUB) — payments infrastructure governance; SWIFT connectivity is a core dependency.
- Sponsor-Bank Operating Policy v0.1 (STUB) — sponsor-bank operating arrangements include SWIFT messaging through the correspondent bank channel; CSP compliance is a condition of correspondent-bank access.

The obligation chain:

```
Regulation (SWIFT CSP 2025 mandatory controls framework / Banks Act Reg 24(3)(g) /
            Joint Standard 2 of 2024 §5 / SARB Directive 1/2023)
  → Information Security & IT Governance Policy v1
      → Secure SDLC Policy v1
          → PROC-SWIFT-CSP-01 (this procedure — annual CSP attestation)
              → @platform/security/swift-csp-controls (PLANNED)
              → @platform/payments/swift-infrastructure (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| SWIFT CSP 2025 mandatory controls framework | Defines the mandatory and advisory controls that all SWIFT users must attest against annually. Mandatory controls are binary (compliant / non-compliant / not-applicable); advisory controls carry a best-practice recommendation. Non-compliance with any mandatory control at attestation deadline results in notification of the SWIFT local officer and may restrict network access. |
| Banks Act 94 of 1990, Reg 24(3)(g) — IT security controls | Requires registered banks to maintain and attest to IT security controls commensurate with the institution's risk profile; SWIFT infrastructure is a named high-risk technology category. |
| PA / FSCA Joint Standard 2 of 2024 §5 (technical controls) | Requires regulated institutions to maintain documented, tested, and independently verified technical controls for all critical financial-messaging infrastructure; SWIFT connectivity is explicitly in scope. CSP attestation is an acceptable demonstration of §5 compliance for SWIFT-specific controls. |
| SARB Directive 1/2023 on SWIFT CSP compliance | Directs all SARB-supervised institutions that are SWIFT users to complete the annual CSP self-attestation and submit evidence of compliance to the SARB on request; non-compliant mandatory controls must be reported to the SARB within 30 days of identification. |

## 3. Purpose

To operationalise the bank's annual SWIFT Customer Security Programme (CSP) attestation cycle: inventorying all in-scope SWIFT infrastructure; assessing compliance against the current mandatory controls baseline; collecting and vaulting per-control evidence; remediating any non-compliant mandatory controls before the attestation deadline; obtaining independent assessment sign-off; submitting the completed attestation via the KYC-SA portal; and maintaining a gap register for advisory controls. The procedure protects the bank's SWIFT infrastructure from cyber threats aligned to SWIFT's threat intelligence, and preserves the bank's eligibility to remain on the SWIFT network. Failure to complete a timely, accurate attestation risks SWIFT suspension — a licence-day existential risk.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| BIC issuance event (first cycle: pre-licence milestone) | Full preparatory cycle — Steps 1–4; first formal attestation in Q4 of the year BIC is issued |
| Annual scheduler (agent tick, 1 October): annual attestation cycle opens | Full annual cycle — Steps 1–9 |
| `SwiftInfrastructureChanged { changeType, affectedComponents[], cspControlsImpacted[] }` | Out-of-cycle impact assessment — Steps 1–3 only; mandatory control re-assessment if CSP controls affected |
| SWIFT circular or advisory mandating interim assessment | Out-of-cycle assessment — full Steps 1–9 on compressed timeline set by SWIFT advisory |
| Vera finding: `SwiftCspAttestationSubmitted` missing for prior year within 13-month window | Escalated catch-up — immediate escalation to Senna + Rashida + CEO |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **In-scope system inventory.** Senna enumerates all SWIFT-connected and SWIFT-adjacent systems: SWIFT messaging interfaces, operator workstations, jump servers, HSM holding SWIFT credentials, firewall zones protecting SWIFT components, monitoring/SIEM agents, and correspondent-bank connectivity points. Each system is assigned a control owner (Senna for platform components; Tomas for messaging application components). Emit `SwiftCspAttestationInitiated { year, scopeInventoryDate, systemsInScope[], controlOwnersAssigned }`. | `agent` (Senna) + `agent` (Tomas) | `@platform/security/swift-csp-controls` (`PLANNED`) + `@platform/infosec/asset-inventory` (`PLANNED`) | Cross-reference `PROC-IS-AP-01` (access provisioning) for the SWIFT-operator access sub-register. The inventory must include all components within the SWIFT secure zone boundary as defined by SWIFT CSCF. |
| 2 | **Gap assessment against current mandatory controls baseline.** Senna maps the current SWIFT CSCF (Customer Security Controls Framework) mandatory control set to the bank's control inventory. For each mandatory control: (a) confirm whether the bank is subject to the control (applicability); (b) if applicable, assess whether the control is currently in place (compliant), partially in place (partial — treated as non-compliant for attestation purposes), or not in place (non-compliant). Advisory controls are assessed simultaneously for best-practice tracking. Emit `SwiftCspControlAssessed { controlId, controlName, controlType: mandatory|advisory, result: compliant|non-compliant|not-applicable, evidenceRef, assessedBy, asOf }` for each control. | `agent` (Senna) | `@platform/security/swift-csp-controls` (`PLANNED`) | The CSCF mandatory controls cover five security objectives: restrict Internet access, minimise attack surface, secure your environment, detect and respond, share and learn. New controls introduced in the 2025 baseline must be assessed against the current-year's mandatory status (SWIFT publishes the baseline update in Q1 each year). |
| 3 | **Evidence collection.** For each mandatory control assessed as compliant or not-applicable, Senna collects the required evidence artefacts: configuration screenshots, audit log extracts, firewall rule exports, patch reports, access review records, penetration test findings, and independent-assessment sign-offs as required by the control. Evidence is content-addressed in the RMS document store. Evidence for advisory controls is collected where available. | `agent` (Senna) | `@platform/rms/document-store` (`PLANNED`) | Evidence must be current (dated within 12 months of the attestation, unless the control is inherently point-in-time). SWIFT may audit evidence artefacts on request; insufficient evidence for a mandatory control is treated as non-compliant. |
| 4 | **Gap remediation planning.** For any mandatory control assessed as non-compliant, Senna produces a remediation plan within 30 days of identification: root cause, proposed remediation action, owner, target completion date. Plans are approved by Rashida (Chief Information Security Officer, governance). Where a mandatory control cannot be fully remediated before the 31 December attestation deadline, Senna notifies the SWIFT local officer per the SARB Directive 1/2023 obligation and escalates to CEO. Emit `SwiftCspGapRemediationStarted { controlId, remediationPlan, owner, targetDate, approvedBy }`. | `agent` (Senna) + `human` (Rashida — remediation plan approval) | `@platform/security/swift-csp-controls` (`PLANNED`) | Advisory control gaps are logged in the gap register but do not require a formal remediation plan for attestation purposes. Advisory gap handling is Senna's discretion with CISO oversight. |
| 5 | **Remediation execution and re-assessment.** Senna and Tomas (Payments & settlement engineer) execute the remediation actions per the approved plans. On completion of each remediation, the affected control is re-assessed (Step 2 logic) and new evidence collected (Step 3 logic). Emit `SwiftCspGapRemediationCompleted { controlId, remediationActionsCompleted[], reAssessmentResult: compliant|non-compliant, evidenceRef, completedAt }`. | `agent` (Senna) + `agent` (Tomas) | `@platform/security/swift-csp-controls` (`PLANNED`) | If remediation is not completed by 15 November, Senna escalates to CEO and Board Audit Committee via Owen (Company Secretary, governance) to allow time for risk-acceptance or notification decisions before the 31 December deadline. |
| 6 | **Independent assessment.** For Mandatory Controls attestation, Senna engages Thandiwe (Chief Audit Executive, governance) or an approved external assessor to independently validate the evidence package and control-assessment conclusions. The independent assessor reviews the `SwiftCspControlAssessed` events and underlying evidence artefacts, and signs off that the evidence is sufficient and conclusions are reasonable. This sign-off is a human action (SWIFT CSP requirement: attesting user is responsible for independent assessment). | `human` (Thandiwe — CAE sign-off, or approved external assessor) + `agent` (Senna — evidence presentation) | `@platform/rms/document-store` (`PLANNED`) | An external assessor is required if Thandiwe (CAE, governance) has a conflict of interest or if the CSP annual update specifies an independent-third-party assessment for the current year. Devon (Chief Operating Officer, governance) confirms assessor independence. The independent assessment sign-off is content-addressed in the RMS document store. |
| 7 | **Attestation package compilation.** Senna compiles the formal attestation package: (a) in-scope system inventory (Step 1); (b) per-control assessment results (Step 2, all mandatory controls); (c) evidence vault index (Step 3); (d) gap remediation status (Steps 4–5, all non-compliant mandatory controls); (e) independent assessment sign-off (Step 6); (f) advisory control gap register. The attestation package is content-addressed in the RMS document store and reviewed by Rashida (Chief Information Security Officer, governance) before submission. | `agent` (Senna) | `@platform/rms/document-store` (`PLANNED`) | All mandatory controls must show `result: compliant` or `result: not-applicable` at submission. Any mandatory control still showing `result: non-compliant` at compilation requires escalation to CEO before submission proceeds. |
| 8 | **KYC-SA portal submission.** Tomas (Payments & settlement engineer) logs into the SWIFT KYC-SA portal and submits the completed self-attestation, uploading the attestation package and confirming compliance status for each mandatory control. Tomas records the SWIFT attestation reference number. This is a human action (SWIFT requires a named human to be the attesting party; KYC-SA portal does not expose a programmatic API). Emit `SwiftCspAttestationSubmitted { year, referenceNo, submittedAt, mandatoryControlsCompliant: boolean, nonCompliantControls[], submittedBy }`. | `human` (Tomas — KYC-SA portal submission; irreducible SWIFT requirement) | KYC-SA portal (SWIFT-operated; no bank-side API at present) | Owen (Company Secretary, governance) archives the KYC-SA submission confirmation and the attestation reference number in the RMS document store. Rashida (Chief Information Security Officer, governance) receives the submission confirmation. |
| 9 | **Post-attestation gap tracking.** Senna maintains the advisory-control gap register through to the next attestation cycle. For any mandatory control that was not fully remediated (and where SWIFT local officer was notified), Senna tracks remediation progress to completion and emits `SwiftCspGapRemediationCompleted` on closure. The gap register is reviewed quarterly by Rashida (Chief Information Security Officer, governance) and reported to the Interim Audit Forum. | `agent` (Senna) | `@platform/security/swift-csp-controls` (`PLANNED`) | Gap tracking is continuous; it is not limited to the annual attestation window. Any new mandatory control gap identified outside the attestation cycle triggers immediate Steps 4–5 and, if not remediable within 30 days, SWIFT local officer notification + SARB notification per Directive 1/2023. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Senna (Security & Infrastructure engineer) | Procedure owner; system inventory; control assessment; evidence collection; gap remediation planning and execution; attestation package compilation; gap tracking |
| Tomas (Payments & settlement engineer) | Co-owner; SWIFT messaging application scope; remediation co-execution for messaging components; KYC-SA portal submission (human attestation act) |
| Rashida (Chief Information Security Officer, governance) | CISO oversight; remediation plan approval; attestation package review; SWIFT local officer notification co-signer; quarterly gap report recipient |
| Thandiwe (Chief Audit Executive, governance) | Independent assessment sign-off (or external assessor coordinator) |
| Devon (Chief Operating Officer, governance) | Operational readiness; assessor independence confirmation |
| Owen (Company Secretary, governance) | Archive KYC-SA submission confirmation; escalation pathway to Board AC |
| CEO | Risk acceptance for unresolved mandatory controls (if any); annual attestation awareness |

## 7. Reconciliation

Typed events produced by this procedure:

- `SwiftCspAttestationInitiated { year, scopeInventoryDate, systemsInScope[], controlOwnersAssigned }` — Step 1 on each cycle open.
- `SwiftCspControlAssessed { controlId, controlName, controlType: mandatory|advisory, result: compliant|non-compliant|not-applicable, evidenceRef, assessedBy, asOf }` — Step 2 per control.
- `SwiftCspGapRemediationStarted { controlId, remediationPlan, owner, targetDate, approvedBy }` — Step 4 per non-compliant mandatory control.
- `SwiftCspGapRemediationCompleted { controlId, remediationActionsCompleted[], reAssessmentResult: compliant|non-compliant, evidenceRef, completedAt }` — Step 5 / Step 9 on remediation close.
- `SwiftCspAttestationSubmitted { year, referenceNo, submittedAt, mandatoryControlsCompliant: boolean, nonCompliantControls[], submittedBy }` — Step 8 on KYC-SA portal submission.

**Vera recon checks:**

1. Every calendar year (after BIC issuance) must have a `SwiftCspAttestationSubmitted` event with `submittedAt` no later than 31 December of that year.
2. `SwiftCspAttestationSubmitted` must appear within 13 months of the prior year's submission date (catches missed-deadline drift).
3. Every `SwiftCspGapRemediationStarted` with `targetDate` in the past must have a matching `SwiftCspGapRemediationCompleted` or an active escalation event.
4. Every mandatory control in the current CSCF baseline must have a `SwiftCspControlAssessed` event in the current attestation cycle before `SwiftCspAttestationSubmitted` is permitted to be emitted.
5. `SwiftCspAttestationSubmitted { mandatoryControlsCompliant: false }` triggers an immediate Vera P1 finding and escalation to Senna + Rashida + CEO.

## 8. Exception handling

| Scenario | Handling |
|---|---|
| Mandatory control non-compliant at gap assessment | Remediation plan within 30 days (Step 4); remediation by 15 November; if not resolved, SWIFT local officer notification + CEO escalation |
| Mandatory control still non-compliant at attestation deadline | SWIFT local officer notification; SARB notification per Directive 1/2023; CEO + Board AC notification via Owen; formal risk acceptance by CEO (mandatory controls only — risk acceptance is not substitutive for remediation; it documents the bank's position pending resolution) |
| Advisory control non-compliant | Logged in gap register; prioritised by Senna with CISO review; no formal attestation consequence but tracked as an improvement item; CEO is not required to risk-accept advisory gaps |
| SWIFT suspends or restricts network access | Immediate escalation: Tomas + Senna + Rashida + Devon + CEO; incident classified as P1 under `PROC-IS-CIC-01`; BCP activation pathway per `PROC-OR-CMA-01`; SWIFT local officer direct engagement |
| Independent assessor unavailable before attestation deadline | Devon identifies alternative approved external assessor; if no assessor can be confirmed, escalate to CEO + Board AC via Owen at least 60 days before deadline |

## 9. Reporting and MI

- **Dashboard:** SWIFT CSP compliance status tile on the bank's operations dashboard — shows current cycle status (not started / in progress / assessed / submitted), number of mandatory controls assessed, number compliant / non-compliant / not-applicable, and days to attestation deadline. Populated from `SwiftCspControlAssessed` and `SwiftCspAttestationSubmitted` events.
- **Gap register:** maintained by Senna; shows all mandatory and advisory control gaps with remediation status, owner, and target date. Reviewed quarterly by Rashida (Chief Information Security Officer, governance).
- **Quarterly CISO report:** Rashida (Chief Information Security Officer, governance) includes SWIFT CSP status (controls assessed, gaps open, remediation progress) in the quarterly security report to the Interim Audit Forum.
- **Annual Board AC notification:** Owen (Company Secretary, governance) notifies the Board Audit Committee of the completed attestation (reference number, compliance status) and any unresolved gaps within 30 days of submission. For the build phase, notification goes to the Interim Audit Forum.

## 10. Change control

Senna is the approval authority for this procedure. Material changes require Rashida (Chief Information Security Officer, governance) co-approval. Changes are version-incremented and the Change log (Section 17) updated.

Triggers for mandatory procedure review (within 60 days of trigger):

- SWIFT publishes an updated CSCF baseline (annual Q1 update) — review mandatory controls delta.
- PA / FSCA Joint Standard 2 of 2024 is superseded or materially amended.
- SARB Directive 1/2023 is updated or a new SWIFT-specific directive is issued.
- A SWIFT security advisory materially changes the attestation requirements.
- A P1 cyber incident (`PROC-IS-CIC-01`) affects SWIFT-connected components.

## 11. Evidence and artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| KYC-SA portal attestation certificate (per year) | RMS document store | 10 years | Restricted |
| Per-control evidence vault (screenshots, logs, configs, reports) | RMS document store | 7 years | Restricted |
| Gap-remediation log (mandatory + advisory controls) | RMS document store + gap register projection | 7 years | Confidential |
| Independent assessment sign-off (Thandiwe or external) | RMS document store | 10 years | Restricted |
| All CSP events (`SwiftCspAttestationInitiated` / `SwiftCspControlAssessed` / `SwiftCspGapRemediationStarted` / `SwiftCspGapRemediationCompleted` / `SwiftCspAttestationSubmitted`) | Event log (Principle 1) | Indefinite | Restricted |
| SWIFT local officer notification (where applicable) | RMS document store + Owner Inbox (RMS Phase 3) | 10 years | Restricted |

## 12. Manual steps

The following steps are irreducibly human actions and are not automate-able under current SWIFT and regulatory requirements:

1. **KYC-SA portal submission (Step 8):** SWIFT requires a named human to log into the KYC-SA portal and submit the attestation. There is no bank-managed API integration for KYC-SA portal submission. The attesting individual is Tomas (Payments & settlement engineer). A second-factor authentication and named-user login are SWIFT requirements.
2. **Independent assessment sign-off (Step 6):** Thandiwe (Chief Audit Executive, governance) or an approved external assessor must personally review the evidence package and sign off in writing. This is a SWIFT CSP requirement for the Mandatory Controls attestation; no automated sign-off pathway exists.
3. **Mandatory control remediation plan approval (Step 4):** Rashida (Chief Information Security Officer, governance) must personally review and approve remediation plans for non-compliant mandatory controls. Agent-assisted drafting is permitted; approval is human.
4. **SWIFT local officer notification (where applicable):** Where a mandatory control cannot be remediated by the attestation deadline, written notification to the SWIFT local officer is a human-authored, human-signed act per SARB Directive 1/2023.

## 13. Failure modes

| Failure mode | Detection | Consequence |
|---|---|---|
| Missed attestation deadline (31 December) | Vera recon: `SwiftCspAttestationSubmitted` absent by 1 January | SWIFT network access restriction; SARB notification obligation; Vera P1 finding; CEO + Board AC escalation |
| Non-compliant mandatory control submitted in attestation | `SwiftCspAttestationSubmitted { mandatoryControlsCompliant: false }` | SWIFT notifies SWIFT local officer; possible network access restriction; 30-day mandatory remediation window under SARB Directive 1/2023; CEO escalation |
| Evidence insufficient for mandatory control | Independent assessor finding at Step 6 | Re-assessment and evidence collection required; risk of delayed submission; Senna + Rashida remediation |
| KYC-SA portal outage at submission window | Tomas reports portal unavailable | Engage SWIFT support; document submission attempt; if portal unavailable at deadline, document in writing to SWIFT local officer; CEO aware |
| Independent assessor not available before deadline | Devon monitoring from Step 6 trigger | 60-day advance identification of alternative; if unresolvable, CEO + Board AC via Owen; documented risk item |

## 14. Escalation

| Scenario | Path | Timeline |
|---|---|---|
| Non-compliant mandatory control not remediated within 30 days of identification | Senna → Rashida (Chief Information Security Officer, governance) → CEO + Board AC via Owen (Company Secretary, governance) | Day 31 from identification |
| Mandatory control non-compliant at attestation deadline | Senna → Rashida → CEO → SWIFT local officer (written notification) → SARB notification per Directive 1/2023 | Same day as attestation submission with non-compliant status |
| SWIFT network suspension | P1 incident (`PROC-IS-CIC-01`); Devon (Chief Operating Officer, governance) + Rashida + CEO; BCP activation pathway | Immediate |
| Vera recon finding: missing annual attestation | Vera → Thandiwe (Chief Audit Executive, governance) → Senna → Rashida → CEO | Raised at next Vera recon run |

## 15. Cross-references

- [`Procedures/by-policy/cy-change-gate.md`](cy-change-gate.md) — change management for SWIFT-connected infrastructure; changes triggering out-of-cycle CSP assessment are routed through this procedure.
- [`Procedures/by-policy/cy-asset-inventory-governance.md`](cy-asset-inventory-governance.md) — asset inventory governance for SWIFT-scope systems.
- [`Procedures/by-policy/cy-incident-response-playbook.md`](cy-incident-response-playbook.md) — incident response playbook; P1 SWIFT incidents follow this procedure.
- [`Procedures/by-policy/incident-response.md`](incident-response.md) — parent IR command procedure (SWIFT-affecting incidents classified via `PROC-IS-CIC-01`).
- [`Procedures/by-policy/cyber-incident-classification.md`](cyber-incident-classification.md) — PROC-IS-CIC-01; classifies incidents affecting SWIFT-connected components.
- [`Procedures/by-policy/crisis-management-activation.md`](crisis-management-activation.md) — PROC-OR-CMA-01; BCP activation on SWIFT suspension or P1 SWIFT incident.
- [`Procedures/by-policy/patch-cadence.md`](patch-cadence.md) — PROC-IS-PC-01; SWIFT component patching subject to CSP mandatory patch-cadence controls.
- [`Procedures/by-policy/access-provisioning.md`](access-provisioning.md) — PROC-IS-AP-01; SWIFT operator access provisioning and access review.
- [`Procedures/by-policy/key-rotation.md`](key-rotation.md) — PROC-IS-KR-01; SWIFT credential and key rotation aligned to CSP controls.
- [`Procedures/by-policy/pre-licence-go-live-gate.md`](../markets/pre-licence-go-live-gate.md) — PROC-MK-PLG-01; BIC issuance is a named pre-licence milestone; this procedure's first-cycle trigger is that event.

## 16. Substrate gaps

All system-capability references in this procedure are currently **PLANNED**. The following substrate components must be built before the first live attestation cycle (BIC issuance milestone):

| Capability | Status | Description |
|---|---|---|
| `@platform/security/swift-csp-controls` | PLANNED | Per-control assessment workflow; evidence attachment; gap register; attestation package compiler; CSP event emitters |
| `@platform/payments/swift-infrastructure` | PLANNED | SWIFT messaging interface; SWIFT secure zone boundary definition; SWIFT operator access sub-register |
| `@platform/infosec/asset-inventory` (SWIFT scope) | PLANNED | Asset inventory scoped to SWIFT-connected and SWIFT-adjacent components; feeds Step 1 system enumeration |
| `@platform/rms/document-store` | PLANNED | Evidence vault; attestation package archival; per-artefact content addressing |
| KYC-SA portal API integration | PLANNED | Currently not available — SWIFT does not expose a bank-managed submission API. Manual submission (Step 8) remains the only pathway until SWIFT provides an API. This gap is a substrate constraint, not a design choice. |
| Dashboard SWIFT CSP tile | PLANNED | Projection from `SwiftCspControlAssessed` + `SwiftCspAttestationSubmitted` events; compliance status + gap count + days-to-deadline |

All substrate gaps are tracked on the engineering roadmap (WS-A platform substrate bundle).

## 17. Audit and assurance

- **Vera (ongoing):** `recon:swift-csp-attestation-coverage` pipeline (PLANNED) asserts: (1) annual `SwiftCspAttestationSubmitted` within deadline; (2) all mandatory controls have a current-year `SwiftCspControlAssessed` event before submission; (3) all open `SwiftCspGapRemediationStarted` events with past target dates have either a `SwiftCspGapRemediationCompleted` event or an active escalation. Violations are P1 findings to Senna + Rashida + Thandiwe (Chief Audit Executive, governance).
- **Thandiwe (CAE, governance):** reviews SWIFT CSP attestation as part of annual IT audit scope; assesses control-assessment methodology, evidence adequacy, and gap-remediation completeness; opines to the Interim Audit Forum / Board Audit Committee.
- **Rashida (CISO, governance):** quarterly gap-register review; CISO sign-off on attestation package before KYC-SA submission.
- **PA / SARB (supervisory):** SARB may request attestation evidence under Directive 1/2023 or Banks Act powers; Devon (Chief Operating Officer, governance) co-ordinates the regulatory response.

## 18. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-22 | Senna (Security & Infrastructure engineer) · Tomas (Payments & settlement engineer) | Initial POPULATED procedure — full 18-section procedure; annual CSP attestation cycle; five typed events; manual steps identified; all system capabilities PLANNED; Vera recon assertions defined; SARB Directive 1/2023 and SWIFT CSCF 2025 aligned. |
