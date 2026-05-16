---
procedureId: PROC-MK-SFP-01
title: Soft franchise pipeline management — institutional relationship onboarding stage
author: Saskia (Chief Markets Officer, governance) · Niko (Client Lifecycle Manager) · Imani (Legal / Contracts Engineer)
date: 2026-05-16
owner: Saskia (Chief Markets Officer, governance) · Niko (Client Lifecycle Manager) · Imani (Legal / Contracts Engineer)
status: POPULATED
version: "0.1"
last-updated: "2026-05-16"
policy-cited: Client Onboarding Policy (planned)
system-capability: "@platform/crm/pipeline-tracker (PLANNED)"
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - FAIS Act GCC s4
  - FICA s21
---

# Procedure — Soft franchise pipeline management — institutional relationship onboarding stage

**Procedure ID:** PROC-MK-SFP-01
**Owner:** Saskia (Chief Markets Officer, governance) · Niko (Client Lifecycle Manager) · Imani (Legal / Contracts Engineer)
**Approval:** CEO (D-MARKETS-SCHEMA-FOUNDATION); BRC for policy formalisation at commencement of trading
**Cadence:** Continuous (pipeline entries per engagement); quarterly pipeline review by Saskia
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Client Onboarding Policy (planned; Niko co-author; BRC approval required at commencement of trading).
- FAIS Act GCC §4 — conduct due diligence on prospective counterparties.
- FICA s.21 — KYC obligations trigger at the point of establishing a business relationship, not just at execution.

The obligation chain:

```
Regulation (FAIS GCC §4 — counterparty conduct; FICA s.21 — business-relationship KYC trigger)
  → Client Onboarding Policy (planned)
    → PROC-MK-SFP-01 (this procedure — pre-mandate engagement stage)
      → PROC-MK-CIL-01 (formal inclusion on approved-counterparty list)
        → @platform/crm/pipeline-tracker (PLANNED)
```

**Build-phase posture:** No live clients. The pipeline is populated with target institutions during the build phase to validate the workflow and ensure readiness at commencement of trading. All pipeline entries during the build phase are rehearsal contacts.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| FAIS Act GCC §4 | FSP must assess counterparty capacity and suitability before establishing a trading relationship. |
| FICA s.21 | Once a business relationship is being established (not just at first transaction), KYC obligations are triggered; NDAs and engagement letters may constitute the trigger. |
| TCF Outcome 4 | Products offered to institutional clients must be appropriate for their investment mandate and risk profile. |
| Banks Act Regulation 39 | Formal counterparty relationships must be supported by documented due diligence before trading authority is granted. |

## 3. Purpose

1. Manage the bank's institutional relationship pipeline from initial engagement through to graduation to formal onboarding (PROC-MK-CIL-01 / PROC-MK-CO-01).
2. Ensure that pipeline contacts are tracked with typed pipeline-stage events, preventing informal relationship commitments that bypass the formal onboarding workflow.
3. Complete counterparty pre-qualification (Imani) early in the engagement so that legal blockers are identified before significant relationship investment.
4. Provide Saskia with a real-time pipeline view for franchise posture reporting (PROC-MK-FPR-01 quarterly review).
5. Ensure FICA KYC obligations are triggered at the correct point (NDA/engagement letter execution, not first trade).

## 4. Trigger

- **New pipeline entry:** `FranchisePipelineEntryCreated { entryId, institutionName, lei (if known), proposedProducts, engagementStage: 'Initial', enteredBy: Saskia, enteredAt }`.
- **Stage progression:** `FranchisePipelineStageAdvanced { entryId, fromStage, toStage, advancedBy, advancedAt }`.
- **Graduation trigger:** `FranchisePipelineGraduated { entryId, institutionName, graduatedAt }` — triggers PROC-MK-CIL-01.
- **Pipeline exit:** `FranchisePipelineExited { entryId, institutionName, reason: 'Declined' | 'Competitor' | 'Regulatory' | 'Strategic', exitedAt }`.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Pipeline entry:** Saskia (Chief Markets Officer, governance) identifies a target institutional client; creates a pipeline entry via `FranchisePipelineEntryCreated`; assigns proposed product scope and initial engagement owner | `human` (Saskia — Chief Markets Officer, governance) | `@platform/crm/pipeline-tracker` (PLANNED) | Entry fields: institution name, LEI (if known), proposed products (FX spot, OTC IRS, JSE bonds), strategic rationale, estimated annual volume. |
| 2 | **Initial NDA/NIP execution:** Saskia or Niko sends a Non-Disclosure Agreement (NDA) or Non-Indication Protocol (NIP) to the institution; Imani reviews the NDA template for legal adequacy; NDA execution triggers FICA business-relationship KYC | `human` (Saskia / Niko) + `agent` (Imani — Legal / Contracts Engineer) | `@platform/legal/isda-registry` (PLANNED) | NDA template is maintained by Imani. Any institution-specific changes require Imani's approval. NDA execution event: `NdaExecuted { entryId, institutionName, ndaRef, executedAt }`. |
| 3 | **FICA KYC trigger notification:** On `NdaExecuted`, Zara (MLRO, governance) is notified that a new business relationship is being established; Zara initiates KYC pre-screening (simplified at this stage, full KYC at PROC-MK-CIL-01 step 2) | `agent` (Zara — MLRO, governance, system-assisted) | `@platform/compliance/kyc-engine` (PLANNED) | Pre-screening at this stage: basic identity verification + top-level sanctions check. Full EDD deferred to formal inclusion. |
| 4 | **Counterparty pre-qualification (Imani):** Imani assesses: (a) legal capacity to enter FX spot transactions (entity type, constitutional documents); (b) jurisdiction of incorporation and netting enforceability; (c) any known legal disputes or regulatory orders that would preclude a trading relationship | `agent` (Imani — Legal / Contracts Engineer) | `@platform/legal/isda-registry` (PLANNED) | Pre-qualification note stored in doc store. Pre-qualification event: `CounterpartyPreQualified { entryId, legalCapacityAssessed: true, nettingEnforceability, isdaFeasibility, completedAt }`. Blockers flagged here save significant relationship investment. |
| 5 | **Pipeline stage tracking:** Niko manages stage progression through defined stages: Initial → NDA Signed → Pre-Qualified → Credit Reviewed → ISDA In Progress → Ready to Graduate; each progression emits `FranchisePipelineStageAdvanced` | `agent` (Niko — Client Lifecycle Manager) | `@platform/crm/pipeline-tracker` (PLANNED) | Pipeline stages are ordinal; back-progression is allowed (with a note) if blockers are identified. Each stage has a maximum idle time before Niko escalates to Saskia. |
| 6 | **Quarterly pipeline review:** Saskia reviews the full pipeline: active entries by stage, stalled entries, attrition rate; output is a pipeline health note (input to PROC-MK-FPR-01); entries stalled > 60 days are either progressed or exited | `human` (Saskia) | `@platform/crm/pipeline-tracker` (PLANNED) | Quarterly review event: `FranchisePipelineReviewed { quarter, year, activeEntries, stalledEntries, exitedThisQuarter, reviewedAt }`. |
| 7 | **Graduation to formal onboarding:** When an institution is ready (NDA signed, pre-qualified, credit interest confirmed): Saskia emits `FranchisePipelineGraduated`; this automatically triggers the formal inclusion workflow (PROC-MK-CIL-01) with the pre-qualification note and NDA reference as inputs | `human` (Saskia) | `@platform/crm/pipeline-tracker` (PLANNED) | Graduation does not guarantee inclusion; PROC-MK-CIL-01 may still block on KYC, credit, or legal grounds. The pipeline record is retained as a relationship-history artefact. |
| 8 | **Pipeline exit:** If an institution declines, chooses a competitor, or fails pre-qualification: Saskia emits `FranchisePipelineExited { entryId, reason, exitedAt }`; Niko archives the pipeline record; the institution may be re-entered in future if circumstances change | `human` (Saskia / Niko) | `@platform/crm/pipeline-tracker` (PLANNED) | Exit reason is used for franchise posture analysis (PROC-MK-FPR-01); competitive-loss exits are analysed for strategic response. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Saskia (Chief Markets Officer, governance) | Pipeline entry creation; graduation decision; exit decision; quarterly review |
| Niko (Client Lifecycle Manager) | Stage tracking; NDA/NIP dispatch; stale-entry escalation to Saskia |
| Imani (Legal / Contracts Engineer) | NDA template maintenance; counterparty pre-qualification (legal capacity, netting enforceability) |
| Zara (MLRO, governance) | FICA KYC trigger management; pre-screening at NDA stage |
| Vera (internal audit engineer, governance) | Asserts that all graduated entries have a `CounterpartyPreQualified` event; flags stale entries |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Pre-qualification blocker (legal capacity failure) | Imani documents; Saskia decides whether to exit or pursue alternative structure | Within 2 business days |
| FICA KYC pre-screening flag | Zara + Helena; pipeline entry paused pending EDD result | Immediate |
| Pipeline entry stalled > 60 days | Niko → Saskia for progress-or-exit decision | Day 61 |
| Institution demands non-standard NDA | Imani reviews; material deviations escalated to Helena + CEO | Per Imani timeline |
| Competitive intelligence (institution choosing competitor) | Saskia franchise posture review; input to PROC-MK-FPR-01 | Next quarterly review |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/crm/pipeline-tracker` | PLANNED | Pipeline entry, stage tracking, graduation workflow |
| `@platform/legal/isda-registry` | PLANNED | NDA execution tracking; pre-qualification note storage |
| `@platform/compliance/kyc-engine` | PLANNED | FICA KYC pre-screening at NDA stage |
| `@platform/event-store` | Live | All pipeline events |

## 9. Quality controls

- Every graduated entry must have a `CounterpartyPreQualified` event. Missing pre-qualification before graduation is a Vera finding.
- Every `NdaExecuted` must trigger a `KycPreScreeningInitiated` event within 1 business day. Vera monitors this.
- Pipeline entries stalled > 60 days are flagged in Saskia's quarterly review dashboard.
- Quarterly review must produce `FranchisePipelineReviewed` within 10 business days of quarter end.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `FranchisePipelineEntryCreated` | Event log | 7 years | Relationship initiation record |
| `NdaExecuted` | Event log | 7 years | FICA business-relationship trigger |
| `CounterpartyPreQualified` | Event log | 7 years | Legal pre-qualification evidence |
| `FranchisePipelineStageAdvanced` | Event log | 7 years | Stage progression history |
| `FranchisePipelineGraduated` | Event log | 7 years | Graduation record; links to PROC-MK-CIL-01 |
| `FranchisePipelineExited` | Event log | 7 years | Exit analysis record |
| `FranchisePipelineReviewed` | Event log | 7 years | Quarterly review record |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — pipeline entry, NDA/NIP, FICA KYC trigger, Imani pre-qualification, stage tracking, quarterly review, graduation to PROC-MK-CIL-01; FAIS GCC §4 + FICA s.21 sourcing; build-phase rehearsal posture. |
