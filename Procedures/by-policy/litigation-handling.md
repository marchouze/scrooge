---
procedureId: PROC-LEG-LH-01
title: Litigation and dispute management
author: Imani (legal-as-code engineer) · Owen (Company Secretary, governance)
date: 2026-05-16
owner: Imani (legal-as-code engineer) · Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Litigation Policy (planned) · Owner Inbox/2026-05-06_core-policies-governance.md
system-capability: "@domains/legal/litigation-register (PLANNED)"
---

# Procedure — Litigation and dispute management

**Procedure ID:** PROC-LEG-LH-01
**Owner:** Imani (legal-as-code engineer) · Owen (Company Secretary, governance)
**Approval:** CEO (external counsel instruction above threshold) · CEO (settlement > R500k) · Board (settlement above board-reservation threshold)
**Cadence:** On-trigger (per litigation or dispute event)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Litigation Policy (planned; Imani + Owen to author; load-bearing at pre-licence go-live readiness gate).
- `Owner Inbox/2026-05-06_core-policies-governance.md` — governance and legal risk framework.
- Uniform Rules of Court — governs SA High Court and Magistrates Court litigation procedure.

The obligation chain:

```
Regulation (Uniform Rules of Court / Banks Act s.64 / FMCA / POPIA s.14)
  → Litigation Policy
    → PROC-LEG-LH-01 (this procedure — litigation and dispute management)
      → @domains/legal/litigation-register (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CORP-03` (Uniform Rules of Court, Rules 17–35 — pleadings and discovery) | Pleadings must be filed within prescribed time limits; discovery obligations arise from the moment litigation is reasonably anticipated; failure to comply has adverse cost and procedural consequences. |
| `ORG-PR-07` (Banks Act s.64 — material events reporting) | Material litigation (above a threshold) must be reported to the PA; the bank must cooperate with any PA-initiated legal proceedings. |
| `ORG-PRIV-05` (POPIA s.14 — purpose limitation) | Legal hold on records relevant to litigation is a lawful basis for retention beyond the normal period (cross-reference: `legal-hold.md` PROC-RMS-LH-01). |
| `ORG-MKT-01` (FMCA — civil and criminal enforcement) | The FSCA may institute civil or criminal proceedings; the bank must manage any FSCA-related litigation with appropriate urgency. |

## 3. Purpose

Govern the bank's response to litigation and disputes in which the bank is a party — both offensive (bank as plaintiff or applicant) and defensive (bank as defendant or respondent). The procedure covers: (a) litigation trigger identification and legal hold activation; (b) external counsel instruction; (c) pleadings and discovery management; (d) settlement authority matrix; (e) judgment registration and enforcement; (f) post-litigation lessons-learned.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `LitigationThreatIdentified { matterId, party, claim, estimatedExposure }` (Imani or Owen) | Defensive litigation — Steps 1–8 |
| `LitigationCommencementDecision { matterId, target, claim, basis }` (CEO or delegated authority) | Offensive litigation — Steps 1–8 |
| `SummonsDraftReceived { matterId, court, returnDate }` | Defensive — immediately Steps 1–3; then 4–8 |
| `RegulatoryDisputeNoticeReceived { matterId, regulator, matterType }` | Regulatory dispute — Steps 1–3; CEO notified immediately; Steps 4–8 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Litigation trigger assessment and legal hold.** Imani and Owen assess the trigger: nature of the claim, parties, quantum (if known), urgency. Immediately activate a legal hold per `PROC-RMS-LH-01` (`legal-hold.md`). Emit `LitigationMatterOpened { matterId, type: "offensive" | "defensive", parties[], claimSummary, estimatedExposure, holdId }`. | `agent` (Imani) + `agent` (Owen) | `@domains/legal/litigation-register` (`PLANNED`) + `@platform/rms/legal-hold-engine` (`PLANNED`) | The legal hold is activated before any other step. For summonses with a short return date: the hold is activated within 1 hour of receipt; Imani reviews the summons and calculates the prescription/return date. |
| 2 | **CEO notification.** Owen notifies the CEO within 4 hours of opening any litigation matter: (a) nature of the claim; (b) estimated exposure (quantum at risk); (c) recommended external counsel (if required); (d) proposed litigation strategy (defend / settle / counter-claim / offensive). Emit `CEOLitigationBriefed { matterId, briefedAt, recommendedStrategy }`. | `agent` (Owen) | `@domains/legal/litigation-register` (`PLANNED`) | For regulatory litigation (FSCA, PA, NPA): CEO also informs the Board (Owen circulates a board note per `PROC-GOV-BP-01`); Helena (CRO, governance) is informed if the matter has regulatory risk implications. |
| 3 | **External counsel instruction.** If the matter warrants external counsel: Imani identifies the recommended counsel (pre-approved panel where available); CEO approves instruction for spend above the Imani-delegation threshold (per `delegation-of-authority.md`); Owen issues the instruction letter. Emit `ExternalCounselInstructed { matterId, counselFirm, instructedAt, scopeRef, estimatedFees, ceoApprovalRef? }`. | `agent` (Imani) + `human` (CEO — high-value approval) + `agent` (Owen) | `@domains/legal/litigation-register` (`PLANNED`) | Imani-delegation threshold: up to R100k total estimated fees without CEO approval. CEO approval required for R100k–R1m. Board approval required above R1m (per delegation matrix). |
| 4 | **Pleadings management.** Imani (with external counsel) manages the pleadings lifecycle: (a) filing deadlines tracked in the litigation register; (b) each pleading is reviewed by Imani before filing; (c) discovery requests compiled and executed per Uniform Rules Rule 35; (d) opposing discovery assessed. Emit `PleadingFiled { matterId, pleadingType, filedAt, filingRef }` for each filed document. | `agent` (Imani) + external counsel | `@domains/legal/litigation-register` (`PLANNED`) + `@platform/rms/document-store` (`PLANNED`) | Every pleading is content-addressed and archived in the RMS document store. Vera monitors filing deadlines; overdue filings are a P1 finding (prescription and peremption risk). |
| 5 | **Discovery and evidence management.** Imani compiles and produces the bank's discovery (documents falling within the legal hold scope). External counsel reviews for privilege. Opposing discovery is assessed for materiality and cross-referenced with the bank's positions. Emit `DiscoveryCompleted { matterId, documentCount, privilegeClaimsCount }`. | `agent` (Imani) + external counsel | `@platform/rms/legal-hold-engine` (`PLANNED`) + `@platform/rms/document-store` (`PLANNED`) | The legal hold (Step 1) ensures all discoverable documents are preserved. Imani cross-references the hold inventory with the discovery obligation. |
| 6 | **Settlement assessment.** If a settlement opportunity arises (either party initiates): Imani assesses the settlement terms against: (a) litigation risk (probability of success); (b) estimated costs to trial; (c) precedent impact; (d) regulatory reporting implications. Imani recommends; authority matrix governs approval. Emit `SettlementAssessmentCompleted { matterId, recommendedAmount, riskAssessment, approvalRequired: "Imani" | "CEO" | "Board" }`. | `agent` (Imani) | `@domains/legal/litigation-register` (`PLANNED`) | Settlement authority matrix: Imani approves up to R50,000; CEO approves up to R500,000; Board approves above R500,000 (per delegation matrix). |
| 7 | **Settlement execution or judgment registration.** If settled: Owen executes the settlement agreement (per `contract-execution.md` PROC-LEG-CE-01); Imani records the settlement; Owen registers any payment obligation. Emit `MatterSettled { matterId, settledAt, amount, termsRef }`. If judgment: Imani registers the judgment; enforcement steps if the bank is the plaintiff. Emit `JudgmentRegistered { matterId, court, date, outcome, enforcementRequired: boolean }`. | `agent` (Imani) + `agent` (Owen) | `@domains/legal/litigation-register` (`PLANNED`) | Any judgment against the bank is reported to the PA if it meets the materiality threshold (Banks Act s.64). Helena (CRO, governance) is informed of adverse judgments. |
| 8 | **Post-litigation lessons-learned and matter close.** Within 30 days of matter resolution: Imani produces a lessons-learned note: root cause, how the litigation arose, whether better controls would have prevented it, recommended policy or procedure updates. Owen archives the note. Legal hold is released (per `legal-hold.md` Step 8). Emit `LitigationMatterClosed { matterId, closedAt, outcome, lessonsLearnedRef, holdReleaseRef }`. | `agent` (Imani) + `agent` (Owen) | `@domains/legal/litigation-register` (`PLANNED`) | Lessons-learned are routed to the relevant procedure owner (e.g. if litigation arose from a contract dispute → Imani reviews `contract-execution.md`; if from a regulatory breach → Zara / Helena). |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Imani (legal-as-code engineer) | Litigation management; pleadings; discovery; settlement assessment; external counsel oversight; lessons-learned |
| Owen (Company Secretary, governance) | CEO and board notification; external counsel instruction; settlement execution; matter archiving |
| CEO | External counsel approval (above threshold); settlement approval (up to R500k); board notification |
| Board | Settlement approval above R500k; material litigation oversight |
| Helena (Chief Risk Officer, governance) | Informed of material adverse judgments; regulatory risk overlay |
| Vera (internal audit engineer) | Filing-deadline monitoring; hold integrity during litigation |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| Summons received with return date < 10 business days | Imani + Owen immediately; CEO notified within 2 hours; external counsel instructed within 1 business day |
| Adverse judgment materially affecting capital adequacy | Helena + CEO + BRC within 4 hours; PA notification within 1 business day |
| PA or FSCA as opposing party | CEO + BRC immediately; external counsel with regulatory experience; board note within 5 business days |
| Filing deadline missed | Vera P1 finding; Imani + Owen + CEO; condonation application if applicable |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@domains/legal/litigation-register` | PLANNED | Matter register, pleadings timeline, settlement tracking, counsel fee tracking |
| `@platform/rms/legal-hold-engine` | PLANNED | Legal hold (activated in Step 1) |
| `@platform/rms/document-store` | PLANNED | Pleadings and evidence archive |

## 9. Quality controls

- Vera recon: every open matter has a current filing-deadline checklist with no overdue items.
- Vera recon: every `ExternalCounselInstructed` above Imani-delegation threshold has a `ceoApprovalRef`.
- Vera recon: every settlement above R50k has an approval at the correct authority level.
- Imani: monthly review of all open matters; status update to Owen; quarterly briefing to CEO.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `LitigationMatterOpened`, `CEOLitigationBriefed`, `ExternalCounselInstructed`, `PleadingFiled`, `DiscoveryCompleted`, `SettlementAssessmentCompleted`, `MatterSettled`, `JudgmentRegistered`, `LitigationMatterClosed` events | Event log (P1) | Permanent (litigation records) | Legal-confidential |
| Pleadings and court documents | RMS document store | Permanent | Legal-confidential |
| Settlement agreements | RMS document store (executed per `PROC-LEG-CE-01`) | Permanent | Legal-confidential |
| External counsel fee records | RMS document store | 7 years | Confidential |
| Lessons-learned notes | RMS document store | 7 years | Internal |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Imani + Owen | Initial draft — PLANNED → POPULATED; full 11-section procedure; legal hold integration; settlement authority matrix; filing-deadline monitoring; lessons-learned. |

## 12. Audit / assurance

- **Vera (ongoing):** filing-deadline monitoring; settlement authority compliance; hold integrity during active matters.
- **Thandiwe (CAE, governance):** annual legal risk audit; sample testing of matter management and settlement approvals; opinion to BRC.
- **PA (SREP):** may request litigation register as part of operational and legal risk assessment.
