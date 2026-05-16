---
procedureId: PROC-AUD-CAM-01
title: Combined assurance map — annual refresh
author: Vera (internal audit engineer) · Owen (Company Secretary, governance)
date: 2026-05-16
owner: Vera (internal audit engineer) · Owen (Company Secretary, governance)
status: POPULATED
policy-cited: Combined Assurance Policy (planned)
system-capability: "@platform/audit/combined-assurance-map (PLANNED)"
---

# Procedure — Combined assurance map — annual refresh

**Procedure ID:** PROC-AUD-CAM-01
**Owner:** Vera (internal audit engineer) · Owen (Company Secretary, governance)
**Approval:** Interim Audit Forum (annual map approval) · CEO (endorsement)
**Cadence:** Annual (Q3 — refresh cycle; Q4 — Forum approval); informed by PROC-AUD-APC-01 audit plan
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Combined Assurance Policy (planned; Vera + Owen to co-author; load-bearing at pre-licence go-live readiness gate).
- King IV Report on Corporate Governance — Principle 15: the governing body should ensure that assurance services and functions enable an effective control environment.
- IIA Standards 2050 — coordination and reliance.

The obligation chain:

```
Regulation (Banks Act s.60 / King IV Principle 15 / IIA Standards 2050 / PA SREP)
  → Combined Assurance Policy
    → PROC-AUD-CAM-01 (this procedure — combined assurance map annual refresh)
      → @platform/audit/combined-assurance-map (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-10` (Banks Act s.60 — risk management) | Board is responsible for the overall system of internal controls; combined assurance is the mechanism for the board to satisfy itself that assurance is adequate. |
| `ORG-CORP-05` (King IV Principle 15 — combined assurance) | The governing body must ensure that assurance services enable an effective control environment; combined assurance is the structured approach. |
| `ORG-PR-24` (PA Pillar 2 / SREP) | The PA's SREP assessment includes a review of the combined assurance framework; gaps in assurance coverage are supervisory concerns. |
| `ORG-FAIS-08` (FAIS s.17) | The combined assurance map must cover FAIS compliance as a monitored domain. |

## 3. Purpose

Produce an annual combined assurance map that coordinates and consolidates assurance from all three lines: (1) management controls (first-line — Helena, Devon, Senna, Saskia, and other management agents as process owners); (2) compliance and risk oversight (second-line — Zara, Helena operating in risk-oversight mode); (3) internal audit (third-line — Vera automated pipelines; Thandiwe human engagements); and external audit (once appointed). The map identifies coverage gaps and enables Vera and Thandiwe to make reliance decisions.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| Annual scheduler (agent tick, 1 August): refresh cycle opens | Full refresh — Steps 1–7 |
| Material new risk or control failure identified mid-year | Out-of-cycle partial refresh — Steps 1–4 for affected domains |
| Audit Forum directive for combined assurance coverage assessment | Targeted refresh — Steps 1–4 for specified domains |
| External audit appointment (licence-day) | External audit integration — Steps 5–6 updated |

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Assurance universe definition.** Vera defines the assurance universe: all risk categories, processes, and systems that require assurance coverage. Sourced from: (a) Helena's risk universe (from PROC-GOV-RMF-01 Step 1); (b) the audit universe (from PROC-AUD-APC-01 Step 2); (c) regulatory-mandatory assurance areas (FAIS, AML, capital adequacy, cyber). Emit `AssuranceUniverseDefined { year, domains[], mandatoryAreas[], totalDomains }`. | `agent` (Vera) | `@platform/audit/combined-assurance-map` (`PLANNED`) | The assurance universe is broader than the audit universe — it includes all domains where any line of defence provides assurance, not just those subject to internal audit. |
| 2 | **First-line assurance inventory.** Vera surveys first-line management agents to inventory existing management controls and self-assessment activities: (a) automated controls and reconciliations (Vera's recon pipelines as first-line; Devon's IaC controls; Senna's security monitoring); (b) management self-assessments (Helena's RCSA — PROC-RISK-RCSA-01); (c) key controls in procedures. Emit `FirstLineAssuranceInventoried { year, domains[], controlsPerDomain, selfAssessmentActivities[] }`. | `agent` (Vera) + management agents | `@platform/audit/combined-assurance-map` (`PLANNED`) | First-line assurance includes both the controls themselves and the evidence that they operated (control effectiveness). |
| 3 | **Second-line assurance inventory.** Vera surveys second-line oversight agents: (a) Zara (Chief Compliance Officer, governance) — compliance monitoring programme coverage; (b) Helena (CRO, governance) — risk oversight reviews (model validation PROC-RSK-MV-01, stress testing PROC-RISK-ST-01, etc.); (c) Vera's advisory recon pipelines (where they operate in second-line mode). Emit `SecondLineAssuranceInventoried { year, domains[], complianceMonitoringCoverage[], riskOversightCoverage[] }`. | `agent` (Vera) + `agent` (Zara) + `agent` (Helena) | `@platform/audit/combined-assurance-map` (`PLANNED`) | Second-line assurance is distinct from first-line management: second-line provides independent oversight of first-line controls without operating them. |
| 4 | **Third-line assurance inventory.** Vera inventories third-line (internal audit) coverage: (a) automated recon pipeline runs and findings; (b) human engagement engagements from the prior year audit plan (PROC-AUD-APC-01); (c) Thandiwe's professional opinions. Emit `ThirdLineAssuranceInventoried { year, pipelinesRun[], engagementsCompleted[], findingsByDomain[] }`. | `agent` (Vera) | `@platform/audit/combined-assurance-map` (`PLANNED`) | The third-line inventory is derived from the findings-tracking register (PROC-AUD-FT-01). |
| 5 | **Coverage gap analysis.** Vera compares the assurance universe against the three-line inventories: for each domain, identify: (a) adequately covered (at least two lines providing current assurance); (b) partially covered (only one line, or assurance is stale > 12 months); (c) gap (no assurance from any line in the current year). Emit `CoverageGapAnalysisCompleted { year, adequatelyCovered, partiallyCovered, gaps[], highRiskGaps[] }`. | `agent` (Vera) | `@platform/audit/combined-assurance-map` (`PLANNED`) | High-risk gaps (gap in a domain rated H or M by Helena's risk universe) are mandatory-remediation items; they must be allocated to a line of defence before the map is submitted for Forum approval. |
| 6 | **Reliance decisions.** Thandiwe assesses where third-line internal audit can rely on first or second-line assurance, reducing the audit work required (IIA Standards 2050): (a) reliance on first-line: where first-line controls are strong and evidence is auditable; (b) reliance on second-line: where second-line monitoring is rigorous and independently operated; (c) no reliance: high-risk areas where third-line must provide independent assurance regardless. Emit `RelianceDecisionsMade { year, relianceOnFirst[], relianceOnSecond[], noReliance[], thandiweJudgement }`. | `human` (Thandiwe — IIA Standards 2050 professional judgment) | `@platform/audit/combined-assurance-map` (`PLANNED`) | Reliance decisions directly inform the next year's audit plan (fed into PROC-AUD-APC-01 Step 3 resource allocation). |
| 7 | **Map compilation and Forum approval.** Vera compiles the combined assurance map: (a) assurance universe table with three-line coverage per domain; (b) coverage gap register with remediation owners; (c) reliance decisions; (d) recommendations for improving assurance coverage. Owen tables the map at the Interim Audit Forum (per PROC-GOV-BP-01). Forum approves; directives for gap remediation recorded. Emit `CombinedAssuranceMapApproved { year, meetingId, gapCount, highRiskGapCount, forumDirectives[] }`. | `agent` (Vera — compile) + `agent` (Owen — table) + Interim Audit Forum | `@platform/governance/board-portal` (`PLANNED`) + `@platform/audit/combined-assurance-map` (`PLANNED`) | The combined assurance map is submitted to the Forum alongside the annual audit plan (PROC-AUD-APC-01 Step 6) for integrated governance review. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Vera (internal audit engineer) | Assurance universe definition; three-line inventory; gap analysis; map compilation; ongoing monitoring |
| Thandiwe (Chief Audit Executive, governance) | Reliance decisions (IIA Standards 2050); Forum-facing accountability; professional opinion |
| Owen (Company Secretary, governance) | Forum paper preparation; governance co-ownership of the map |
| Helena (Chief Risk Officer, governance) | Risk universe input; second-line oversight inventory |
| Zara (Chief Compliance Officer, governance) | Compliance monitoring programme input (second-line) |
| Interim Audit Forum | Annual map approval; gap remediation directives |

## 7. Escalation

| Scenario | Escalation path |
|---|---|
| High-risk domain with no assurance coverage from any line | Vera + Thandiwe immediately; Forum notified; remediation owner assigned within 5 business days |
| First-line refuses to provide assurance inventory information | Thandiwe + CEO; structural independence concern; Forum notified |
| External audit (post-licence) disagrees with reliance decisions | Thandiwe + external audit partner; reconcile differences; Forum adjudicates if unresolved |
| Combined assurance map not approved by Forum before year-end | Interim map in effect; Vera continues operating on prior year's reliance decisions; Thandiwe flags to Forum |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/audit/combined-assurance-map` | PLANNED | Assurance universe management, three-line inventory, gap analysis, map rendering |
| `@platform/audit/findings-engine` | PLANNED | Third-line inventory source (findings by domain) |
| `@platform/governance/board-portal` | PLANNED | Forum paper distribution |
| `@platform/rms/document-store` | PLANNED | Map archive |

## 9. Quality controls

- Vera recon: `CombinedAssuranceMapApproved` event present for each year by 30 November.
- Vera recon: no high-risk domain with zero assurance coverage in the approved map.
- Vera recon: every `CoverageGapAnalysisCompleted` high-risk gap has a remediation owner within 10 business days.
- Thandiwe: annual confirmation that reliance decisions comply with IIA Standards 2050.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `AssuranceUniverseDefined`, `FirstLineAssuranceInventoried`, `SecondLineAssuranceInventoried`, `ThirdLineAssuranceInventoried`, `CoverageGapAnalysisCompleted`, `RelianceDecisionsMade`, `CombinedAssuranceMapApproved` events | Event log (P1) | 7 years | Restricted |
| Combined assurance map (all versions) | RMS document store | 7 years | Restricted |
| Forum approval minutes | RMS document store | Permanent | Restricted |
| Coverage gap register and remediation records | RMS document store | 7 years | Internal |

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Vera + Owen | Initial draft — PLANNED -> POPULATED; full 11-section procedure; three-line assurance inventory; gap analysis; IIA Standards 2050 reliance decisions; Forum approval gate. |

## 12. Audit / assurance

- **Thandiwe (CAE, governance):** professional opinion on combined assurance adequacy submitted to Forum annually; reliance decisions are Thandiwe's IIA-Standards-2050 responsibility.
- **PA (SREP):** reviews combined assurance framework adequacy; gaps in assurance coverage are supervisory concerns requiring remediation plans.
- **External audit (post-licence):** once appointed, external auditor is the fourth line; their coverage is incorporated into the map; reliance decisions are extended to cover external audit work.
