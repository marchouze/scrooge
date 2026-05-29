---
policy-parent: Risk Management Framework (planned) · Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md
last-reviewed: 2026-05-16
procedureId: PROC-GOV-RMF-01
title: Risk Management Framework governance — annual review and attestation
author: Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Helena (Chief Risk Officer, governance)
status: POPULATED
policy-cited: Risk Management Framework (planned) · Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md
system-capability: "@platform/risk/rmf-governance (PLANNED)"
---

# Procedure — Risk Management Framework governance — annual review and attestation

**Procedure ID:** PROC-GOV-RMF-01
**Owner:** Helena (Chief Risk Officer, governance)
**Approval:** Board Risk Committee (BRC) · CEO
**Cadence:** Annual (Q4 review; Q1 attestation submission); triggered on material regulatory change
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Risk Management Framework (planned; Helena to author; load-bearing at pre-licence go-live readiness gate).
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` — RAS that sits beneath the RMF; re-approval cycle governed by this procedure.
- BCBS Basel III Framework and BCBS Principles for the Sound Management of Operational Risk — the RMF must demonstrate alignment with BCBS principles at each annual review.

The obligation chain:

```
Regulation (Banks Act s.60A / Reg 39 / PA Pillar 2 Guidance / BCBS Principles)
  → Risk Management Framework (Policy)
    → Risk Appetite Statement (sub-policy)
      → PROC-GOV-RMF-01 (this procedure — annual review and attestation)
        → All risk-specific procedures (PROC-RISK-*, PROC-RSK-*)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-23` (Banks Act s.60A / Reg 39 — ICAAP) | Bank must have a robust ICAAP; the RMF is the overarching governance framework within which the ICAAP sits; PA assesses RMF adequacy during SREP. |
| `ORG-PR-24` (PA Pillar 2 Guidance — ICAAP / ILAAP) | RMF must be reviewed and attested annually; the CEO and Board must sign off the ICAAP, which incorporates the RMF attestation. |
| `ORG-PR-10` (Banks Act s.60 — risk management) | Board is responsible for the bank's risk management; the RMF is the instrument of that responsibility; annual review ensures the framework remains fit for purpose. |
| `ORG-PR-07` (Banks Act s.64 — reporting to PA) | Material changes to the risk management framework must be notified to the PA; the annual review identifies whether a material-change notification is required. |

## 3. Purpose

Ensure the Risk Management Framework remains current, adequate, and aligned with regulatory expectations. The procedure governs: (a) annual review of the RMF against the PA's supervisory expectations and BCBS principles; (b) re-approval of the Risk Appetite Statement (RAS); (c) board attestation confirming the framework's adequacy; (d) regulatory submission where the PA requires notification of material changes.

This procedure links and consolidates the individual risk procedure reviews: PROC-RISK-ILF-01, PROC-RISK-IRRBB-01, PROC-RISK-RCSA-01, PROC-RISK-MRM-01, PROC-RISK-CSA-01, PROC-RISK-ST-01, PROC-RSK-MV-01, PROC-RSK-ECL-02.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Annual scheduler (agent tick, 1 October): RMF review window opens | Full review cycle — Steps 1–9 |
| Material regulatory change (new PA directive, new BCBS principle, Banks Act amendment) | Out-of-cycle targeted review — Steps 1–4 and 8–9 |
| SREP / PA supervisory letter identifying RMF gap | Remediation review — Steps 1–4, 6, 8–9 |
| `CeoDecision` event relating to risk appetite or new risk category | Triggered RAS update — Steps 3–4, 8 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Open review cycle.** Emit `RMFReviewCycleOpened { year, reviewDate, triggerType }`. Helena assembles the review pack: current RMF text, current RAS, list of material risk events from the year, regulatory changes since last review, BCBS principle mapping. | `agent` (Helena) | `@platform/event-store` ✓ + `@platform/risk/rmf-governance` (`PLANNED`) | The review pack is document-addressed in the RMS document store; hash emitted in the opening event. |
| 2 | **BCBS principle alignment check.** For each of the applicable BCBS risk-management principles, assess whether the bank's framework and procedures satisfy the principle. Identify gaps. Emit `BCBSAlignmentAssessed { principlesReviewed, gapsIdentified[] }`. | `agent` (Helena) + `agent` (Vera — internal audit engineer, provides prior-year audit findings) | `@platform/risk/rmf-governance` (`PLANNED`) | Vera provides her audit plan findings (from `audit-plan-cycle.md`) as an input; any P1 or P2 findings relating to the risk framework are treated as mandatory-remediation items before attestation. |
| 3 | **RAS re-approval.** Review the RAS against the year's risk metrics, emerging risk environment, and any regulatory or strategic changes. Propose updated risk appetite metrics, tolerance bands, and floor/ceiling levels. Helena recommends; CEO approves via `CeoDecision`; BRC ratifies. | `agent` (Helena) + `human` (CEO — approve) + BRC | `@platform/risk/rmf-governance` (`PLANNED`) + `@platform/decisions/ceo-decision` ✓ | Event: `RASUpdated { year, updatedMetrics[], approvedBy, approvedAt, ceoDecisionRef }`. The RAS cannot be re-attested without this event. |
| 4 | **RMF text update.** Incorporate RAS changes, regulatory changes, new risk categories, and BCBS gap-remediation into the RMF text. Produce a clean version with a tracked-change summary. | `agent` (Helena) | `@platform/rms/document-store` (`PLANNED`) | The updated RMF text is content-addressed; document hash emitted in `RMFDraftFinalised { year, documentHash, changesSummary }`. |
| 5 | **Risk procedure linkage review.** Confirm that all risk-specific procedures (ILF-01, IRRBB-01, RCSA-01, MRM-01, CSA-01, ST-01, MV-01, ECL-02) remain current and consistent with the updated RMF. Flag any procedure that requires update as a Vera finding. | `agent` (Vera) | `@platform/recon/procedure-rmf-alignment` (`PLANNED`) | Vera runs the procedure-RMF alignment recon and emits a finding for each misaligned procedure. Helena reviews; misaligned procedures must be updated before attestation. |
| 6 | **Board/Interim Audit Forum review.** Owen (Company Secretary, governance) circulates the updated RMF and RAS to the Interim Audit Forum (per `procedures-board-papers.md` — PROC-GOV-BP-01) at least 5 business days before the review meeting. The Audit Forum discusses; Thandiwe (Chief Audit Executive, governance) provides the internal audit opinion; members raise queries. | `agent` (Owen) + `human` (Thandiwe — audit opinion) | `@platform/governance/board-portal` (`PLANNED`) | Event: `RMFBoardReviewCirculated { year, meetingDate, documentHash, distributionList }`. |
| 7 | **CEO attestation.** CEO signs and emits the `RMFCeoAttestation { year, attestedBy, attestedAt, declarationText, documentHash }` event confirming the RMF adequately captures all material risks, the RAS is calibrated appropriately, and internal controls are proportionate. | `human` (CEO — irreducible governance act) | `@platform/decisions/ceo-decision` ✓ | This attestation is the load-bearing artefact for the PA's SREP review. It cannot be delegated below CEO level. |
| 8 | **Regulatory submission assessment.** Helena assesses whether any change in the RMF constitutes a material change requiring PA notification under Banks Act s.64. If yes: prepare and submit the notification (per PROC-OPS-D3-01 or direct PA channel). Emit `RMFPANotificationDecision { required: boolean, notificationRef?, submittedAt? }`. | `agent` (Helena) + `human` (CEO — approve notification if required) | `@platform/regulatory/pa-notifications` (`PLANNED`) | Materiality criteria: new risk category; appetite metric changed by > 20%; structural change to three-lines model; governance structure change. |
| 9 | **Close and archive.** Emit `RMFReviewCycleClosed { year, version, ceoAttestationRef, pasNotificationRef?, nextReviewDue }`. Archive the completed review pack in the RMS document store. Update the RMF version register. | `system` | `@platform/rms/document-store` (`PLANNED`) | The `nextReviewDue` field is set to 1 October of the following year; Vera monitors for overdue cycles. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Helena (Chief Risk Officer, governance) | Owns the annual review; produces the updated RMF and RAS; completes Steps 1–4, 8 |
| CEO | Approves updated RAS (Step 3); provides final attestation (Step 7); approves PA notification if required (Step 8) |
| BRC / Interim Audit Forum | Reviews and ratifies updated RMF and RAS (Step 6) |
| Thandiwe (Chief Audit Executive, governance) | Provides internal audit opinion on RMF adequacy (Step 6) |
| Owen (Company Secretary, governance) | Circulates board papers (Step 6); co-archives the completed cycle |
| Vera (internal audit engineer) | Provides prior-year findings as input (Step 2); runs procedure-RMF alignment recon (Step 5); monitors cycle completion |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| BCBS alignment gap that cannot be remediated before attestation | Helena → CEO → BRC; attestation deferred; PA notified if material |
| RAS metric disagreement between Helena and CEO | Helena documents dissent; CEO's decision is final; dissent logged in `RMFReviewCycleClosed` event |
| RMF review cycle not completed by 31 January (year + 1) | Vera flags overdue; Helena + CEO; BRC informed; PA notification if SREP deadline at risk |
| PA identifies material RMF gap during SREP | Helena + CEO + BRC within 5 business days; remediation plan submitted to PA within 30 days |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/risk/rmf-governance` | PLANNED | Annual review workflow, RAS versioning, procedure linkage tracking |
| `@platform/rms/document-store` | PLANNED | Content-addressed document store for RMF text and review packs |
| `@platform/recon/procedure-rmf-alignment` | PLANNED | Vera recon: confirms all risk procedures cite current RMF version |
| `@platform/governance/board-portal` | PLANNED | Board paper distribution and acknowledgement tracking |
| `@platform/event-store` | ✓ live | All `RMF*` events persist here |

## 9. Quality controls

- Vera recon: every year by 1 February has an `RMFReviewCycleClosed` event for the preceding year.
- Vera recon: every `RMFReviewCycleClosed` has a preceding `RMFCeoAttestation` and `RASUpdated`.
- Vera recon: every risk-specific procedure cites the current RMF version (updated if the RMF text changes substantively).
- Vera recon: `RASUpdated` always predates `RMFCeoAttestation`.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `RMFReviewCycleOpened`, `BCBSAlignmentAssessed`, `RASUpdated`, `RMFDraftFinalised`, `RMFBoardReviewCirculated`, `RMFCeoAttestation`, `RMFPANotificationDecision`, `RMFReviewCycleClosed` events | Event log (P1) | Permanent | Confidential |
| RMF text (all versions) | RMS document store (content-addressed) | Permanent | Restricted |
| RAS (all versions) | RMS document store | Permanent | Restricted |
| BCBS principle mapping | RMS document store | 7 years | Internal |
| CEO attestation signed document | RMS document store | Permanent | Restricted |
| PA notification correspondence | RMS document store | Permanent | Restricted |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Helena | Initial draft — PLANNED → POPULATED; full 11-section procedure; BCBS alignment check; RAS re-approval; CEO attestation; PA notification assessment. |

## 12. Audit / assurance

- **Vera (annual):** procedure-RMF alignment recon (Step 5); overdue-cycle detection; attestation-event completeness.
- **Thandiwe (CAE, governance):** provides the third-line audit opinion on RMF adequacy as an input to each annual cycle; the opinion is independent of Helena's first-line assessment.
- **PA (SREP):** reviews the RMF, RAS, and CEO attestation during the annual SREP; supervisory findings are treated as mandatory-remediation items.
