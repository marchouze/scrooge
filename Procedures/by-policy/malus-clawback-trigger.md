---
policy-parent: Remuneration Policy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-HR-MC-01
title: Malus and clawback trigger assessment
author: Sade (AgentOps & token efficiency engineer) · Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Sade (AgentOps & token efficiency engineer) · Helena (Chief Risk Officer, governance)
status: POPULATED
policy-cited: Remuneration Policy (planned)
system-capability: "@platform/hr/malus-clawback (PLANNED)"
---

# Procedure — Malus and clawback trigger assessment

**Procedure ID:** PROC-HR-MC-01
**Owner:** Sade (AgentOps & token efficiency engineer) · Helena (Chief Risk Officer, governance)
**Approval:** RemCo (malus/clawback determination); Board (final sign-off for executive roles); PA notification if applicable
**Cadence:** On-trigger (event-driven); no fixed interval
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

> **Build-phase note:** No human employees with variable pay exist during the build phase; the trigger events below are not yet live. This procedure is pre-drafted so the substrate is production-grade before commencement-of-trading. All references to human employees activate at licence-day when the first material risk-taker is hired.

## 1. Source policy

- Remuneration Policy (planned; Sade + Helena co-author).
- PA Directive 4 of 2018 on Remuneration — malus and clawback are mandatory provisions for variable remuneration of material risk-takers.
- Cross-link: PROC-HR-ARR-01 (Annual remuneration review) — material risk-taker list is produced there; malus/clawback provisions are set during that cycle.

```
Regulation (PA Directive 4/2018 §§ on malus and clawback)
  → Remuneration Policy (planned)
    → PROC-HR-MC-01 (this procedure)
      → @platform/hr/malus-clawback (PLANNED)
        → RemCo determination · Board resolution · PA notification (if applicable)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-HR-01` (PA Directive 4 of 2018 — Remuneration) | Variable remuneration for material risk-takers must be subject to malus (in-vesting reduction) and clawback (post-vesting recovery) where a risk event, misconduct finding, or financial restatement occurs. The bank must maintain a written malus/clawback policy and document every assessment. |
| `ORG-HR-02` (Banks Act s.60) | Board is accountable for remuneration governance, including malus/clawback determinations for executive directors and prescribed officers. |
| `ORG-GV-01` (King IV Principle 14) | Governing body oversees remuneration; malus and clawback provisions must be disclosed in the remuneration report. |
| `ORG-RM-01` (Banks Act s.73 — Risk management) | Risk events that trigger malus must be recorded in the bank's risk-management framework; Helena as CRO is the custodian of the trigger determination. |

## 3. Purpose

1. Detect trigger events (risk breach, misconduct finding, financial restatement) that may require malus or clawback of variable remuneration for material risk-takers.
2. Conduct a structured, documented assessment of whether and to what extent malus or clawback applies.
3. Obtain RemCo and (for executive roles) board approval for the determination.
4. Notify the PA where required under PA Directive 4 of 2018.
5. Maintain a typed event record of every malus/clawback assessment as the canonical audit trail.

## 4. Trigger

- **Risk event detected:** `RiskBreachDetected { breachId, severity, impactedRoles, detectedAt }` — emitted by Helena's risk-monitoring harness when a threshold breach attributable to a material risk-taker is confirmed.
- **Misconduct finding:** `MisconductFindingIssued { employeeId, findingType, findingDate }` — emitted at the conclusion of a disciplinary process under PROC-HR-DISC-01 where the outcome is a misconduct finding affecting a material risk-taker.
- **Financial restatement:** `FinancialRestatementInitiated { period, restatementScope, initiatedAt }` — emitted when the CFO initiates a restatement of audited financial statements; malus/clawback assessment is mandatory for all material risk-takers whose variable pay related to the restated period.
- **Manual trigger:** Helena or Sade may initiate an ad hoc assessment if circumstances warrant even where no typed event has been emitted.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive trigger event; open a malus/clawback assessment file; notify Helena (CRO), Sade, and Zara (CCO, governance) | `system` | `@platform/hr/malus-clawback` (PLANNED) | Each trigger event generates one assessment file; multiple concurrent trigger events can produce concurrent assessment files for the same individual. |
| 2 | **Identify affected material risk-takers.** Cross-reference the trigger event against the material risk-taker list (produced under PROC-HR-ARR-01); identify all individuals whose variable pay is subject to malus or clawback as a result of this trigger | `agent` (Sade) | `@platform/hr/malus-clawback` (PLANNED) | Material risk-taker list is maintained in the remuneration register; Sade retrieves the current list. |
| 3 | Emit `MalusClawbackAssessmentOpened { assessmentId, triggerId, triggerType, affectedEmployees, openedAt }` | `system` | `@platform/event-store` | |
| 4 | **Quantify the variable pay at risk.** For each affected individual: identify the vesting tranches in scope (unvested = malus; vested but within clawback window = clawback); compute the maximum amount that could be reduced or recovered under the Remuneration Policy formula | `agent` (Sade) | `@platform/hr/malus-clawback` (PLANNED) | Clawback window duration is set in the Remuneration Policy (typically 7 years for material risk-takers under PA Directive 4/2018). |
| 5 | **Causal assessment.** Helena (CRO) determines whether the trigger event was causally linked to the conduct or decisions of the affected individual(s); documents the causal chain; engages Imani (legal-as-code engineer) to review legal basis for recovery if clawback is proposed | `human` (Helena — CRO, governance) · `agent` (Imani — legal-as-code engineer, legal review) | `@platform/risk/event-investigation` (PLANNED) | Human step — causal determination requires professional judgement; Helena's determination is the basis for the RemCo recommendation. |
| 6 | **Draft RemCo recommendation.** Sade compiles the RemCo recommendation pack: trigger event summary, affected individuals, amounts at risk, causal assessment, proposed malus/clawback quantum, legal basis | `agent` (Sade) | `@platform/hr/malus-clawback` (PLANNED) | Pack circulated to RemCo members at least 3 business days before the RemCo meeting. |
| 7 | **RemCo determination.** Helena (RemCo chair) convenes RemCo; reviews and approves or modifies the proposed malus/clawback determination; records the formal determination | `human` (Helena — RemCo chair) | `@platform/governance/committee-management` (PLANNED) | Human step — RemCo determination is a board-delegated function under PA Directive 4/2018. Any modification to the proposed quantum must be documented with rationale. |
| 8 | Emit `RemCoMalusClawbackDetermined { assessmentId, determination: 'Malus' | 'Clawback' | 'NoAction', quantum, rationale, remcoMinutesRef, determinedAt }` | `system` | `@platform/event-store` | |
| 9 | **Board approval (executive roles).** If the affected individual is an executive director or prescribed officer: Helena presents the RemCo determination to the board; board resolves to approve | `human` (Helena · Marc — CEO, interim board chair) | `@platform/governance/committee-management` (PLANNED) | Human step — Banks Act s.60. Board resolution is binding for executive remuneration decisions. |
| 10 | Emit `BoardMalusClawbackApproved { assessmentId, boardResolutionRef, approvedAt }` (if executive role) | `system` | `@platform/event-store` | |
| 11 | **Notify the affected individual.** Sade issues formal written notice to the affected individual setting out: the determination, the basis, the amount to be reduced or recovered, and the timeline for recovery | `agent` (Sade) + `human` (Helena — sign-off on executive notices) | `@platform/hr/malus-clawback` (PLANNED) | LRA s.185 — the individual must be given the opportunity to respond before a final clawback demand is issued. |
| 12 | **Individual response period.** Afford the affected individual 10 business days to respond to the notice; Sade and Helena review any response and determine if the determination should be varied | `human` (Helena — CRO, response review) | — | Human step — procedural fairness requirement (LRA Schedule 8). Any variation requires a second RemCo determination. |
| 13 | **Execute the malus/clawback.** Sade coordinates with Yael (tax and regulatory reporting engineer) to execute the pay reduction (malus) or recovery demand (clawback); Yael adjusts the PAYE calculation accordingly | `agent` (Sade · Yael — tax and regulatory reporting engineer) | `@platform/hr/payroll` (PLANNED) | Clawback recovery may be by direct repayment, offset against future entitlements, or legal action (last resort — Imani handles). |
| 14 | Emit `MalusClawbackExecuted { assessmentId, executionDate, method, amountExecuted }` | `system` | `@platform/event-store` | |
| 15 | **PA notification.** Zara prepares PA notification if the trigger event or the malus/clawback quantum meets the materiality threshold under PA Directive 4/2018; submits via PA RECON portal | `agent` (Zara — CCO) + `human` (Helena — sign-off) | `@platform/compliance/pa-reporting` (PLANNED) | Materiality threshold defined in the Remuneration Policy. |
| 16 | Close the assessment file; update the remuneration register and the malus/clawback log | `agent` (Sade) | `@platform/hr/malus-clawback` (PLANNED) | |
| 17 | Emit `MalusClawbackAssessmentClosed { assessmentId, closedAt, outcome }` | `system` | `@platform/event-store` | |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Sade (AgentOps & token efficiency engineer) | Process orchestration; quantification; RemCo pack; individual notification; payroll coordination |
| Helena (Chief Risk Officer, governance) | Causal assessment; RemCo determination; board presentation; PA notification sign-off |
| Zara (Chief Compliance Officer, governance) | Regulatory compliance review; PA notification preparation |
| Imani (legal-as-code engineer) | Legal basis review for clawback; recovery action if required |
| Yael (tax and regulatory reporting engineer) | PAYE adjustment on executed malus/clawback |
| Marc (CEO — interim board chair) | Board approval for executive roles |

## 7. Escalation

| Trigger | Escalation path |
|---|---|
| Individual disputes determination | Imani reviews legal basis; if unresolved, external counsel engaged; CCMA referral possible |
| Clawback not recovered within 30 days | Imani initiates formal demand; litigation as last resort |
| PA queries post-notification | Zara coordinates response within 15 business days; Helena and Marc informed |
| Trigger event affects >3 material risk-takers simultaneously | Marc (CEO) and the interim board convene within 5 business days |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/hr/malus-clawback` | PLANNED | Assessment workflow; quantification; notification |
| `@platform/risk/event-investigation` | PLANNED | Causal chain investigation support |
| `@platform/governance/committee-management` | PLANNED | RemCo and board meeting management |
| `@platform/hr/payroll` | PLANNED | Payroll adjustment execution |
| `@platform/compliance/pa-reporting` | PLANNED | PA notification submission |
| `@platform/event-store` | Live | Event emission |

## 9. Quality controls

- Every trigger event is reviewed within 5 business days of receipt.
- Causal assessment documented by Helena before RemCo determination.
- Individual response period (10 business days) always afforded before execution.
- PA notification submitted within prescribed timeline if triggered.
- Malus/clawback log reviewed quarterly by Helena for completeness.

## 10. Evidence / audit trail

| Artefact | Event type | Retention |
|---|---|---|
| Assessment file (trigger, causal chain, quantum) | `MalusClawbackAssessmentOpened` | 7 years |
| RemCo determination record | `RemCoMalusClawbackDetermined` | 7 years |
| Board resolution (executive roles) | `BoardMalusClawbackApproved` | 7 years |
| Individual notification and response | `MalusClawbackExecuted` | 7 years |
| Execution record (payroll adjustment) | `MalusClawbackExecuted` | 7 years |
| PA notification (if submitted) | — | 7 years |
| Assessment closure record | `MalusClawbackAssessmentClosed` | 7 years |
