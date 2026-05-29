---
policy-parent: Internal Audit Charter (planned)
last-reviewed: 2026-05-16
procedureId: PROC-AUD-APC-01
title: Internal audit plan — annual risk-based planning cycle
author: Vera (internal audit engineer) · Thandiwe (Chief Audit Executive, governance)
date: 2026-05-16
owner: Vera (internal audit engineer) · Thandiwe (Chief Audit Executive, governance)
status: POPULATED
policy-cited: Internal Audit Charter (planned)
system-capability: "@platform/audit/plan-engine (PLANNED)"
---

# Procedure — Internal audit plan — annual risk-based planning cycle

**Procedure ID:** PROC-AUD-APC-01
**Owner:** Vera (internal audit engineer) · Thandiwe (Chief Audit Executive, governance)
**Approval:** Interim Audit Forum (Owen chairs) · CEO (endorsement)
**Cadence:** Annual (Q3 — plan cycle opens; Q4 — Forum approval); quarterly (plan progress reporting)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Internal Audit Charter (planned; Thandiwe to author with Owen co-review; load-bearing at pre-licence go-live readiness gate).
- IIA Standards (International Professional Practices Framework) — risk-based audit planning is a core IIA requirement.
- Banks Act s.60 / PA Pillar 2 Guidance — the internal audit function must operate under an approved audit charter; the audit plan must be risk-based.

The obligation chain:

```
Regulation (Banks Act s.60 / PA Pillar 2 / IIA Standards — IPPF)
  → Internal Audit Charter
    → PROC-AUD-APC-01 (this procedure — annual audit plan cycle)
      → @platform/audit/plan-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-10` (Banks Act s.60 — risk management) | Board is responsible for risk management; internal audit provides the third-line opinion on the adequacy of the risk and control framework. |
| `ORG-PR-24` (PA Pillar 2 / ICAAP) | The PA's SREP assessment includes a review of the internal audit function's scope, independence, and the audit plan's risk-based adequacy. |
| `ORG-CORP-05` (King IV — governing body oversight) | The governing body must ensure internal audit is effective; the audit committee (interim: Audit Forum) must approve the audit plan. |
| `ORG-FAIS-08` (FAIS s.17 — monitoring and compliance function) | Internal audit provides third-line monitoring; the audit plan must cover material FAIS compliance risks. |

## 3. Purpose

Produce an annual, risk-based internal audit plan that allocates Vera's automated recon pipelines and specialist audit engagements across the audit universe in proportion to assessed risk. The plan is approved by the Interim Audit Forum and reported quarterly. Vera's technical implementation is the audit execution vehicle; Thandiwe (CAE, governance) provides the professional judgment, independence assessment, and Forum-facing accountability.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Annual scheduler (agent tick, 1 July): plan cycle opens | Full plan cycle — Steps 1–7 |
| Material risk event (new risk category, regulatory change, control failure) | Out-of-cycle plan amendment — Steps 2–3, 6 |
| Board / Forum directive for specific audit | Ad-hoc engagement addition — Steps 3, 6 |
| Quarterly scheduler (end of each quarter) | Progress reporting — Step 7 |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Risk universe update.** Vera ingests the current risk universe from Helena's RMF annual review (PROC-GOV-RMF-01): all identified risk categories, their current risk ratings (inherent and residual), and the control environment assessment. Vera also ingests: prior-year audit findings (from `findings-tracking.md` PROC-AUD-FT-01), regulatory changes since the last plan, and management's own risk assessment (RCSA from PROC-RISK-RCSA-01). Emit `AuditRiskUniverseUpdated { year, riskCategories[], highRiskCount, regulatoryChanges[] }`. | `agent` (Vera) | `@platform/audit/plan-engine` (`PLANNED`) + `@platform/risk/rmf-governance` (`PLANNED`) | The risk universe is the complete inventory of auditable entities, processes, and systems. Vera maintains it as a structured dataset; it is the input to Step 2. |
| 2 | **Audit universe scoping.** From the risk universe, Vera derives the audit universe: all auditable units ranked by inherent risk (H/M/L), residual risk (after controls), prior audit coverage (last audit date), and regulatory mandates (units that must be audited regardless of risk score — e.g. FAIS, AML). Emit `AuditUniverseScopeSet { year, auditableUnits[], mandatoryAudits[], totalHighRisk }`. | `agent` (Vera) | `@platform/audit/plan-engine` (`PLANNED`) | Mandatory audits (regulatory floor): FAIS compliance (annually), AML/FIC (annually), cyber security (annually), capital adequacy (annually). High-risk units audited annually; medium-risk units on a 2-year cycle; low-risk units on a 3-year cycle. |
| 3 | **Resource allocation.** Vera maps available capacity to the audit universe: (a) Vera's automated recon pipelines (continuous — overnight-recon, codebase-quality-review, fsca-reg-to-policy-recon, procedure-rmf-alignment, etc.); (b) human specialist reviews (Thandiwe — where specialist professional judgment is required; external co-source where skills gap exists); (c) time budget per engagement. Emit `AuditResourcePlanDrafted { year, pipelines[], humanEngagements[], externalCoSource[], totalCoverageHours }`. | `agent` (Vera) + `human` (Thandiwe — resource judgment) | `@platform/audit/plan-engine` (`PLANNED`) | Thandiwe's professional judgment is applied in Step 3 to: (a) identify skill gaps requiring external co-source; (b) confirm automated recon pipeline coverage adequacy; (c) prioritise across competing high-risk items within capacity constraints. |
| 4 | **Draft plan compilation.** Vera compiles the draft annual audit plan: (a) engagement list (automated pipelines + human engagements); (b) risk justification for each engagement; (c) schedule (Q1–Q4 timing); (d) resource budget; (e) carryover from prior year (incomplete engagements); (f) outstanding high-risk items. Emit `AuditPlanDrafted { year, planHash, engagementCount, highRiskEngagementCount, carryovers }`. | `agent` (Vera) | `@platform/audit/plan-engine` (`PLANNED`) + `@platform/rms/document-store` (`PLANNED`) | The draft plan is content-addressed; Thandiwe reviews before Forum submission. |
| 5 | **Thandiwe review and sign-off.** Thandiwe reviews the draft plan for: (a) risk-based adequacy (IIA Standards 2010); (b) independence of planned engagements (no conflict with management assignments); (c) coverage of regulatory-mandatory areas; (d) resource realism. Thandiwe approves the plan for Forum submission. Emit `AuditPlanCAEApproved { year, approvedBy: "Thandiwe", approvedAt, modifications[] }`. | `human` (Thandiwe — load-bearing professional judgment; CAE independence) | `@platform/audit/plan-engine` (`PLANNED`) | Thandiwe's approval is the load-bearing independence gate. The CAE's approval of the plan is a direct obligation under IIA Standards 2010. Modifications are documented and rationale captured. |
| 6 | **Audit Forum approval.** Owen (Company Secretary, governance) tables the draft plan at the Interim Audit Forum (per `PROC-GOV-BP-01` — board paper process; submitted at least 5 business days before the meeting). The Forum discusses risk coverage, resource adequacy, and any directives for specific engagements. The Forum approves the plan. Emit `AuditPlanForumApproved { year, meetingId, approvedAt, forumDirectives[] }`. | `agent` (Owen — paper circulation) + Interim Audit Forum | `@platform/governance/board-portal` (`PLANNED`) | The Forum's approval is the governance gate for the plan. Any Forum directive for an additional engagement is added to the plan and resourced; Vera flags if the addition requires a trade-off against existing engagements. |
| 7 | **Quarterly progress reporting.** End of each quarter: Vera produces the audit plan progress report: (a) engagements completed vs planned; (b) findings issued (classified); (c) high-risk areas with no coverage in the period; (d) pipeline health metrics (overnight-recon pass rate, codebase-quality-review open items). Owen tables the report at the next Forum meeting. Emit `AuditPlanProgressReported { year, quarter, completed, inProgress, planned, overdue, pipelineMetrics }`. | `agent` (Vera) + `agent` (Owen — Forum tabling) | `@platform/audit/plan-engine` (`PLANNED`) | Overdue engagements (planned but not started 30 days past schedule) are highlighted to Thandiwe; material slippage reported to the Forum. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Vera (internal audit engineer) | Risk universe update; audit universe scoping; resource mapping; draft plan; automated pipeline execution; quarterly reporting |
| Thandiwe (Chief Audit Executive, governance) | Professional judgment; CAE plan approval (Step 5); Forum-facing accountability; independence assurance |
| Owen (Company Secretary, governance) | Forum paper preparation and circulation; Forum meeting management |
| Interim Audit Forum | Plan approval; Forum directives; quarterly progress review |
| Helena (Chief Risk Officer, governance) | RMF risk universe input (Step 1); informed of audit plan coverage of risk areas |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| High-risk area with insufficient audit coverage within resource budget | Thandiwe + Forum; options: external co-source, de-scope lower-risk items, formal coverage gap accepted with rationale |
| Audit plan not approved by Forum by 30 November | Thandiwe + CEO; interim plan in effect; approval at next Forum meeting |
| Material control failure identified mid-year requiring emergency engagement | Thandiwe directs Vera; Forum notified within 5 business days; plan amendment at next quarterly review |
| CAE independence threat (Thandiwe assigned conflicting responsibilities) | Thandiwe reports to Forum Chair (Owen); Forum resolves; documented in `AuditPlanCAEApproved` |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/audit/plan-engine` | PLANNED | Risk universe, audit universe, plan compilation, progress tracking |
| Vera's automated recon pipelines | ✓ live (multiple) | overnight-recon, codebase-quality-review, fsca-reg-to-policy-recon, etc. |
| `@platform/governance/board-portal` | PLANNED | Forum paper distribution |
| `@platform/rms/document-store` | PLANNED | Plan archive |

## 9. Quality controls

- Vera recon: `AuditPlanForumApproved` event present for each year by 30 November of the preceding year.
- Vera recon: all regulatory-mandatory audits appear in every annual plan.
- Vera recon: quarterly `AuditPlanProgressReported` event within 10 business days of quarter-end.
- Thandiwe: annual quality-assurance review of the audit planning process (IIA Standards 1300 — QA and improvement programme).

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `AuditRiskUniverseUpdated`, `AuditUniverseScopeSet`, `AuditResourcePlanDrafted`, `AuditPlanDrafted`, `AuditPlanCAEApproved`, `AuditPlanForumApproved`, `AuditPlanProgressReported` events | Event log (P1) | Permanent | Restricted |
| Annual audit plan (all versions) | RMS document store | Permanent | Restricted |
| Forum approval minutes | RMS document store | Permanent | Restricted |
| Quarterly progress reports | RMS document store | 7 years | Internal |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Vera + Thandiwe | Initial draft — PLANNED → POPULATED; full 11-section procedure; risk-based universe scoping; Vera/Thandiwe roles; Forum approval gate; quarterly progress reporting. |

## 12. Audit / assurance

- **Thandiwe (CAE, governance):** annual quality-assurance review of the internal audit function (IIA Standards 1300); opinion on audit plan adequacy submitted to Forum.
- **PA (SREP):** reviews the internal audit function including audit plan adequacy and CAE independence; supervisory findings are mandatory-remediation items.
- **External quality assessment (IIA Standards 1312):** at least every 5 years an external quality assessment of the IA function is required; Thandiwe coordinates.
