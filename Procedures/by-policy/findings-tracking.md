---
procedureId: PROC-AUD-FT-01
title: Audit findings tracking and remediation follow-up
author: Vera (internal audit engineer) · Thandiwe (Chief Audit Executive, governance)
date: 2026-05-16
owner: Vera (internal audit engineer) · Thandiwe (Chief Audit Executive, governance)
status: POPULATED
policy-cited: Internal Audit Charter (planned)
system-capability: "@platform/audit/findings-engine (PLANNED)"
---

# Procedure — Audit findings tracking and remediation follow-up

**Procedure ID:** PROC-AUD-FT-01
**Owner:** Vera (internal audit engineer) · Thandiwe (Chief Audit Executive, governance)
**Approval:** Thandiwe (finding classification) · CEO (overdue P1 escalation) · Audit Forum (P1 persistent overdue)
**Cadence:** Continuous (automated finding generation); periodic (follow-up cadence per finding class); quarterly (Forum reporting)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Internal Audit Charter (planned; Thandiwe to author with Owen co-review; load-bearing at pre-licence go-live readiness gate).
- IIA Standards (IPPF) 2400-series — communicating results; IIA Standards 2500 — monitoring progress.

The obligation chain:

```
Regulation (Banks Act s.60 / PA Pillar 2 / IIA Standards 2500)
  → Internal Audit Charter
    → PROC-AUD-FT-01 (this procedure — findings tracking and remediation)
      → @platform/audit/findings-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-10` (Banks Act s.60 — risk management) | Board must receive timely information on material control deficiencies; findings tracking is the mechanism. |
| `ORG-PR-24` (PA Pillar 2 — SREP) | The PA's SREP assessment reviews outstanding internal audit findings and the speed of management remediation; persistent unresolved P1/P2 findings are a supervisory concern. |
| `ORG-CORP-05` (King IV — audit committee oversight) | The audit committee must satisfy itself that management remediates audit findings; findings tracking provides the evidence. |
| `ORG-FAIS-08` (FAIS s.17 — monitoring obligations) | Ongoing monitoring must identify and remediate control deficiencies; IA findings are inputs to the compliance monitoring programme. |

## 3. Purpose

Govern the lifecycle of every audit finding from initial issuance by Vera's recon pipelines or human engagement to formal closure. The procedure covers: (a) finding classification (P1–P4); (b) management response and remediation owner assignment; (c) target date setting; (d) Vera's automated follow-up cadence; (e) overdue finding escalation to Thandiwe and the Audit Forum; (f) finding closure attestation.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Vera recon pipeline run producing a finding (automated) | Finding issuance — Steps 1–4 |
| Vera human engagement producing a finding | Finding issuance — Steps 1–4 |
| Target remediation date approached or passed | Follow-up — Step 5 |
| Quarterly Audit Forum meeting | Forum reporting — Step 6 |
| Management notifies remediation complete | Closure assessment — Steps 7–8 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Finding issuance.** When a recon pipeline or engagement identifies a control deficiency: Vera drafts the finding with: (a) finding description; (b) root cause analysis; (c) risk impact; (d) recommendation; (e) proposed classification (P1-P4). Emit `AuditFindingDrafted { findingId, source, title, description, rootCause, riskImpact, recommendation, proposedClass }`. | `agent` (Vera) | `@platform/audit/findings-engine` (`PLANNED`) | Finding sources: overnight-recon, codebase-quality-review, fsca-reg-to-policy-recon, procedure-rmf-alignment, combined-assurance-map, human engagements. |
| 2 | **Finding classification.** Thandiwe reviews and confirms: (a) **P1 Critical** — immediate threat to safety and soundness, regulatory breach, or material misstatement risk; (b) **P2 High** — significant control weakness requiring urgent attention; (c) **P3 Medium** — control gap with moderate risk; (d) **P4 Low** — improvement opportunity. Emit `AuditFindingClassified { findingId, class, classifiedBy, classifiedAt, classificationRationale }`. | `human` (Thandiwe — professional judgment) | `@platform/audit/findings-engine` (`PLANNED`) | Thandiwe's classification is the load-bearing professional judgment act. For automated pipeline findings: Thandiwe reviews a daily summary and confirms or adjusts. |
| 3 | **Management response.** Vera formally issues the classified finding to the responsible management owner. Management must respond within 5 business days: (a) acceptance or rejection; (b) root cause assessment; (c) proposed remediation action; (d) proposed completion date; (e) interim mitigant (if P1/P2 and full remediation takes > 30 days). Emit `ManagementResponseReceived { findingId, accepted, remediationAction, targetDate, interimMitigant?, managementOwner }`. | `agent` (management owner) | `@platform/audit/findings-engine` (`PLANNED`) | Rejected findings are escalated to Thandiwe + CEO; if still disagreed: Audit Forum adjudicates. |
| 4 | **Target date and owner registration.** Vera registers the agreed remediation target date and owner. For P1: CEO automatically notified. For P2: domain head notified. Emit `FindingTargetRegistered { findingId, targetDate, managementOwner, ceoNotified }`. | `system` (Vera) | `@platform/audit/findings-engine` (`PLANNED`) | Target dates: P1 — within 30 days; P2 — within 60 days; P3 — within 90 days; P4 — within 180 days. Extensions require Thandiwe approval (P1/P2) or Vera approval (P3/P4). |
| 5 | **Automated follow-up cadence.** Vera automatically follows up: (a) P1: weekly reminder + Thandiwe notified if no progress; (b) P2: bi-weekly reminder; (c) P3: monthly reminder; (d) P4: quarterly reminder. At each follow-up: management provides a progress update. Emit `FindingFollowUpCompleted { findingId, followUpDate, progressUpdate, reclassificationRequired }`. | `system` (Vera) | `@platform/audit/findings-engine` (`PLANNED`) | If a P3/P4 finding is not progressing and risk has increased: Vera recommends reclassification to Thandiwe. |
| 6 | **Overdue finding escalation.** If target date is passed without closure: (a) P1 overdue: Vera notifies Thandiwe + CEO immediately; if still overdue after 15 days: Audit Forum notified; (b) P2 overdue: Vera notifies Thandiwe; if overdue 30 days: CEO notified; (c) P3/P4 overdue: flagged in quarterly Forum report. Emit `FindingEscalated { findingId, escalationLevel, escalatedTo[], escalatedAt }`. | `system` (Vera) + `human` (Thandiwe) | `@platform/audit/findings-engine` (`PLANNED`) + `@platform/escalation` (existing) | Persistent P1 findings (> 45 days overdue) are reported as a regulatory risk to the PA if the PA has previously identified the same area as a supervisory concern. |
| 7 | **Closure request.** When management believes remediation is complete: management submits a closure request with evidence of remediation and self-attestation that the control now operates effectively. Emit `FindingClosureRequested { findingId, evidence[], attestationText, requestedAt }`. | `agent` (management owner) | `@platform/audit/findings-engine` (`PLANNED`) | Evidence is content-addressed in the RMS document store. The closure request is a management assertion; Step 8 is the independent verification. |
| 8 | **Closure verification and attestation.** Vera independently verifies: (a) for recon-pipeline findings: re-runs the pipeline to confirm the finding no longer fires; (b) for human engagement findings: reviews evidence; (c) Thandiwe attests closure for P1/P2. Emit `AuditFindingClosed { findingId, closedAt, closedBy, verificationMethod, thandiweAttestation? }`. | `agent` (Vera) + `human` (Thandiwe — P1/P2 closure attestation) | `@platform/audit/findings-engine` (`PLANNED`) | If verification fails: finding remains open; management notified; target date reassessed. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Vera (internal audit engineer) | Finding issuance; automated follow-up; overdue escalation; closure verification; quarterly Forum reporting |
| Thandiwe (Chief Audit Executive, governance) | Finding classification; P1/P2 closure attestation; Forum-facing accountability; management disagreement adjudication |
| Management owners (varies by domain) | Management response within 5 business days; remediation execution; closure request |
| CEO | P1 overdue notification; Audit Forum escalation awareness |
| Interim Audit Forum | Quarterly findings review; persistent overdue P1/P2 oversight |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Management rejects a finding | Thandiwe + CEO; if unresolved — Audit Forum adjudicates; Vera logs all positions |
| P1 finding overdue > 15 days | Vera + Thandiwe to Audit Forum; CEO informed; consider PA notification |
| P1 finding relates to ongoing regulatory breach | Thandiwe + CEO + Helena (CRO, governance) immediately; PA notification assessment |
| Management submits false closure evidence | Thandiwe + CEO; serious misconduct; BRC notified |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/audit/findings-engine` | PLANNED | Finding lifecycle management, follow-up scheduling, escalation routing, closure tracking |
| All Vera recon pipelines | live (multiple) | Automated finding sources; re-run for closure verification |
| `@platform/escalation` | existing | Overdue escalation delivery |
| `@platform/rms/document-store` | PLANNED | Closure evidence archive |

## 9. Quality controls

- Vera recon: every open finding has an `AuditFindingClassified` event with `classifiedBy: Thandiwe` attribution.
- Vera recon: every P1 finding has a `FindingTargetRegistered` with `ceoNotified: true`.
- Vera recon: every `FindingClosureRequested` has an `AuditFindingClosed` or rejection within 10 business days.
- Thandiwe: quarterly review of findings register; IIA Standards 2500 compliance confirmation.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `AuditFindingDrafted`, `AuditFindingClassified`, `ManagementResponseReceived`, `FindingTargetRegistered`, `FindingFollowUpCompleted`, `FindingEscalated`, `FindingClosureRequested`, `AuditFindingClosed` events | Event log (P1) | 7 years | Restricted |
| Findings register (projection) | RMS register | 7 years | Restricted |
| Closure evidence packages | RMS document store | 7 years | Internal |
| Quarterly Forum findings reports | RMS document store | 7 years | Restricted |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Vera + Thandiwe | Initial draft — PLANNED -> POPULATED; full 11-section procedure; P1-P4 classification; automated follow-up cadence; overdue escalation; Thandiwe P1/P2 closure attestation. |

## 12. Audit / assurance

- **Thandiwe (CAE, governance):** owns findings tracking quality; quarterly confirms register is complete; IIA Standards 2500 compliance.
- **PA (SREP):** reviews outstanding findings and remediation timelines; persistent high-risk findings are supervisory concerns.
- **Combined assurance map (PROC-AUD-CAM-01):** audit findings are an input to the annual combined assurance map cycle.
