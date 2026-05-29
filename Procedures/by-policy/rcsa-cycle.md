---
policy-parent: Policies/operational-risk-policy-v1.md · Policies/risk-management-framework-v1.md
last-reviewed: 2026-05-15
procedureId: PROC-RISK-RCSA-01
title: Risk and Control Self-Assessment (RCSA) Cycle
author: Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance)
date: 2026-05-15
owner: Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance)
status: POPULATED
policy-cited: Policies/operational-risk-policy-v1.md · Policies/risk-management-framework-v1.md
system-capability: "@platform/risk/rcsa-engine (PLANNED)"
---

# Procedure — RCSA Cycle (Risk and Control Self-Assessment)

**Procedure ID:** PROC-RISK-RCSA-01
**Owner:** Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance)
**Approval:** BRC (Board Risk Committee)
**Cadence:** Annual (full cycle, Q3 initiation → Q4 BRC approval); ad-hoc on material change
**Version:** v0.2 — 2026-05-15
**Status:** POPULATED

---

## 1. Source policy

- `Policies/operational-risk-policy-v1.md` — Operational Risk Policy (primary)
- `Policies/risk-management-framework-v1.md` — Risk Management Framework (co-source; sets appetite thresholds and escalation paths)

The obligation chain is:

```
Regulation (Banks Act Reg 39 / BCBS PSMOR 12 principles)
  → Operational Risk Policy
    → PROC-RISK-RCSA-01 (this procedure)
      → @platform/risk/rcsa-engine (PLANNED)
```

---

## 2. Source regulation(s)

| ID | Requirement |
|---|---|
| `ORG-PR-17` | Operational risk identification, measurement, monitoring, and control framework — bank must have a comprehensive programme covering all material operational risk exposures across all business lines. |
| `ORG-PR-24` | Documented operational-risk-management framework per Regulation 39 (Regulations Relating to Banks) and the BCBS Principles for Sound Management of Operational Risk (PSMOR); framework must be reviewed at least annually. |
| `ORG-PR-39` | Comply with the 12 BCBS PSMOR principles, in particular: Principle 2 (governance and oversight), Principle 3 (risk management environment), and Principle 7 (risk identification and assessment through processes such as the RCSA). |

---

## 3. Purpose

The Risk and Control Self-Assessment (RCSA) is the bank's primary bottom-up tool for identifying, assessing, and managing operational risks across all business lines and support functions. The RCSA cycle:

1. Surfaces inherent and residual operational risks from first-line function heads.
2. Provides an independent second-line quality challenge (Helena's team).
3. Produces a rated risk register that feeds the ICAAP operational-risk capital chapter.
4. Identifies control weaknesses requiring remediation, tracked as action plans with named owners.
5. Explicitly includes AI-agent operational risks (model drift, prompt injection, autonomous decision errors, data lineage failures) as a named risk category — reflecting the bank's autonomous-by-default operating model (Principle 6).
6. Reports residual risks above appetite to the Board Risk Committee.

---

## 4. Trigger

**Annual trigger — calendar:**
- Q3 (1 July): `RCSACycleOpened { period: "YYYY-RCSA", initiated_by: helena }` emitted; scope-of-functions notification sent to all first-line heads.
- Q4 (target: 30 November): `RCSACycleCompleted { period, brc_approved_date }` emitted; report tabled at BRC.

**Ad-hoc triggers — event-driven:**

| Trigger event | Description |
|---|---|
| `ProductApproved { productId }` | RCSA addendum required for the new product's risk domain before launch. |
| `MaterialSystemChangeDeployed { system_id, change_type }` | RCSA addendum for the system's operational risk profile. |
| `OperationalLossEventRecorded { severity: High \| Critical }` | Unplanned RCSA review of the affected risk domain within 30 days. |
| `AgentRuntimeAnomalyDetected { severity: Critical }` | Immediate RCSA review of the AI-agent risk category; Helena chairs within 5 business days. |

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Emit `RCSACycleOpened { period, scope_functions, initiated_by: helena }`; distribute scope pack to all in-scope function heads | `system` (Helena-triggered) | `@platform/event-store` ✓ + `@platform/risk/rcsa-engine` (`PLANNED`) | In-scope functions: trading (Saskia), payments (Tomas), compliance (Zara), finance (Camille / Bea), technology (Atlas / Rashida), agent-runtime operations (Atlas / Devon), legal (Imani), treasury (Eitan), risk (Helena). |
| 2 | Each function head identifies operational risks in their domain using the bank's risk taxonomy (RT-OR sub-codes from `Regulations/_risk-taxonomy.md`) | `human` (function heads — first line) | `@platform/risk/rcsa-intake` (`PLANNED`) | Risks are entered into the RCSA intake tool; each risk is assigned a domain tag, a risk taxonomy code (RT-OR-xxx), and a preliminary inherent rating (likelihood × impact on 1–5 scale). |
| 3 | System emits `RCSARiskIdentified { risk_id, domain, taxonomy_code, description, inherent_likelihood, inherent_impact, inherent_rating }` for each submitted risk | `system` | `@platform/event-store` ✓ | Inherent rating = inherent likelihood × inherent impact; scale: 1 (Very Low) to 25 (Very High). |
| 4 | For each identified risk, the first line rates the existing controls for effectiveness: **Strong** (control reliably prevents / detects), **Adequate** (control mostly effective with minor gaps), **Weak** (control exists but has significant gaps), **Absent** (no control) | `human` (function heads — first line) | `@platform/risk/rcsa-engine` (`PLANNED`) | Control ratings are the first line's self-assessment; they are subject to independent second-line challenge in Step 5. |
| 5 | Helena's second-line team independently reviews each control rating; challenges ratings where evidence does not support the first-line view; resolves disagreements with function head; escalates unresolved disagreements to CRO | `human` (Helena's team — second line) | `@platform/risk/rcsa-engine` (`PLANNED`) | Second-line review is a hard requirement per PSMOR Principle 7. CRO (Helena) has final authority on the agreed control rating where disagreement persists. |
| 6 | System emits `RCSAControlAssessed { risk_id, control_id, control_description, first_line_rating, second_line_rating, agreed_rating, challenged: true/false }` | `system` | `@platform/event-store` ✓ | All challenges and resolutions are recorded; the audit trail is immutable. |
| 7 | Residual risk rating calculated: inherent rating adjusted for agreed control effectiveness. Residual risk = inherent rating × control-effectiveness multiplier (Strong: 0.25; Adequate: 0.50; Weak: 0.75; Absent: 1.00) | `system` | `@platform/risk/rcsa-engine` (`PLANNED`) | The multiplier schedule is defined in the Operational Risk Policy and reflected in the risk taxonomy. |
| 8 | Emit `RCSARiskRated { risk_id, inherent_rating, control_effectiveness, residual_rating, above_appetite: true/false }` | `system` | `@platform/event-store` ✓ | Above-appetite threshold: residual rating ≥ 12 (High or Critical on the 25-point scale) per RAS. All above-appetite risks are escalated to BRC. |
| 9 | **AI-agent risk category (mandatory).** All AI-agent operational risks are assessed as a named group: model drift (outputs deviating from expected without code change), prompt injection (adversarial inputs causing unintended actions), autonomous decision errors (agent acts outside its mandate), data lineage failures (event-store corruption or recon breaks), harness failures (agent-runtime deploy failures). Controls reviewed: human oversight triggers, recon harnesses, citation gates, worktree isolation, push-retry loops. | `human` (Helena + Atlas — joint) | `@platform/risk/rcsa-engine` (`PLANNED`) | This category is mandated by Principle 6 (autonomous-by-default). Atlas provides the technical evidence base; Helena holds the risk governance accountability. |
| 10 | For each risk with Weak or Absent controls: agree a remediation action plan — named owner, agreed action, due date, expected control rating post-remediation | `human` (function head — owner; Helena — governance) | `@platform/risk/rcsa-engine` (`PLANNED`) | Action plans are binding commitments; overdue action plans are a BRC-reported Key Risk Indicator (KRI). |
| 11 | Emit `RCSAActionPlanCreated { risk_id, action_id, owner, action_description, due_date, expected_post_remediation_rating }` for each agreed action plan | `system` | `@platform/event-store` ✓ | Action plan tracking is continuous; the RCSA engine monitors due dates and emits `RCSAActionPlanOverdue` if not closed by the due date. |
| 12 | Helena compiles the RCSA report: top-10 operational risks by residual rating, control status, action plan summary, above-appetite risks, AI-agent risk category summary, ICAAP input chapter | `human` (Helena) | `@platform/reporting/rcsa-report-generator` (`PLANNED`) | The ICAAP input chapter is a mandatory output — it provides the operational-risk capital estimate for the internal capital adequacy assessment. |
| 13 | BRC reviews and approves the RCSA report; BRC may direct additional remediation for above-appetite risks | `human` (BRC — chaired by Owen (Company Secretary, governance)) | Governance record (minutes) | BRC approval is the control event that closes the annual cycle. |
| 14 | Emit `RCSACycleCompleted { period, brc_approved_date, total_risks_identified, above_appetite_count, action_plans_open }` | `system` | `@platform/event-store` ✓ | This event triggers the Vera coverage-recon check (Step 15). |
| 15 | Vera runs a coverage recon: all in-scope functions must have submitted risk assessments; any gap is a P2 finding reported to Helena and BRC | `system` (Vera) | `@platform/recon/rcsa-coverage` (`PLANNED`) | Coverage check: `∀ function ∈ scope_functions → ∃ RCSARiskIdentified(domain = function)`. |

---

## 6. Reconciliation

### Events produced

| Event | Trigger | Key fields |
|---|---|---|
| `RCSACycleOpened` | Step 1 | `period`, `scope_functions`, `initiated_by` |
| `RCSARiskIdentified` | Step 3 — one per risk | `risk_id`, `domain`, `taxonomy_code`, `inherent_rating` |
| `RCSAControlAssessed` | Step 6 — one per control per risk | `risk_id`, `control_id`, `agreed_rating`, `challenged` |
| `RCSARiskRated` | Step 8 — one per risk | `risk_id`, `residual_rating`, `above_appetite` |
| `RCSAActionPlanCreated` | Step 11 — one per action plan | `risk_id`, `action_id`, `owner`, `due_date` |
| `RCSAActionPlanOverdue` | Continuous monitoring | `action_id`, `days_overdue` |
| `RCSACycleCompleted` | Step 14 | `period`, `brc_approved_date`, `above_appetite_count` |

### Invariants (CI-tested)

1. **Coverage completeness:** `∀ function ∈ scope_functions → ∃ RCSARiskIdentified(domain = function)` before `RCSACycleCompleted` is emitted. Vera asserts this nightly from `RCSACycleOpened` until completion.
2. **Control assessment completeness:** `∀ RCSARiskIdentified(risk_id) → ∃ RCSAControlAssessed(risk_id)` before `RCSARiskRated`.
3. **Rating completeness:** `∀ RCSAControlAssessed(risk_id) → ∃ RCSARiskRated(risk_id)` before `RCSACycleCompleted`.
4. **Action plan coverage:** `∀ RCSARiskRated(risk_id, agreed_control_rating ∈ {Weak, Absent}) → ∃ RCSAActionPlanCreated(risk_id)`. No weak/absent control may go unremediated without a formal action plan.
5. **BRC approval:** `∀ RCSACycleCompleted → brc_approved_date IS NOT NULL`. A cycle cannot be closed without BRC approval.
6. **AI-agent category mandatory:** `∃ RCSARiskIdentified(domain = 'agent-runtime-operations')` in every cycle. Vera asserts this as a named invariant.

### Failure mode

If a function head fails to submit by the Q3 intake deadline, Vera emits `RCSACoverageGap { function, cycle }`. Helena escalates to the function head's governance lead. If unresolved within 10 business days, BRC is notified. The cycle cannot be completed with coverage gaps.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All `RCSA*` events | Event log | Permanent (P1) | Restricted |
| RCSA report (full cycle) | Document store (BLAKE3-addressed) | 7 years post-cycle | Confidential |
| BRC minutes (RCSA agenda item) | Document store | 7 years | Confidential |
| Action plan tracking register (derived from events) | RCSA engine projection | Live view; events permanent | Restricted |
| ICAAP input chapter | Document store | 7 years + period of ICAAP | Confidential |
| AI-agent risk category evidence (Atlas attestation, recon results) | Document store | 7 years | Restricted |

---

## 8. Manual steps

The following steps involve human judgement and cannot be fully automated:

- **Step 2 — Risk identification (function heads):** Each function head brings domain expertise to identify risks not visible from quantitative data alone. The intake tool prompts with the risk taxonomy but does not constrain to taxonomy; novel risks may be added.
- **Step 5 — Second-line challenge (Helena's team):** The quality and credibility of the RCSA depends on genuine independent challenge. Where first-line ratings are optimistic, second-line must evidence the challenge in writing.
- **Step 9 — AI-agent risk assessment (Helena + Atlas joint):** Model drift and prompt-injection risk require joint assessment by the technical expert (Atlas) and the risk governance owner (Helena). Neither can complete this alone.
- **Step 12 — RCSA report compilation (Helena):** The narrative synthesis, prioritisation, and ICAAP chapter require CRO-level judgement about which risks dominate and how to present them to BRC.
- **Step 13 — BRC review and approval:** BRC may direct additional remediation. This is a governance judgement call that cannot be automated.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Function head fails to submit risks by intake deadline | Vera `RCSACoverageGap` event | Helena → function governance lead; BRC if unresolved in 10 days |
| First-line control ratings systematically optimistic (challenge reveals wide gaps) | Second-line challenge rate > 30% | Helena reports pattern to BRC; root cause investigation |
| AI-agent risk category missing from RCSA | Vera invariant check on `RCSACycleCompleted` | P1 finding; Helena + Atlas immediate remediation |
| Action plan overdue > 30 days | `RCSAActionPlanOverdue` event | BRC-reported KRI; Helena escalates to action plan owner's governance lead |
| Residual risk above appetite with no action plan | Vera invariant check | P1 finding; Helena must either create action plan or obtain BRC acceptance of residual risk |
| `OperationalLossEventRecorded { severity: Critical }` without RCSA addendum within 30 days | Event correlation check | Helena + Devon; if missed: BRC disclosure; Vera P2 finding |
| RCSA engine unavailable during intake | Health check; Vera monitoring | Atlas remediation; Helena extends intake deadline; manual workaround with structured templates |
| ICAAP chapter not submitted to ICAAP process | Cross-procedure dependency check | Camille + Helena; ICAAP timeline at risk; CEO notified |

---

## 10. Related procedures

- `stress-test-cycle.md` (PLANNED) — RCSA residual risks feed the operational risk stress scenario.
- `ba-return-generation.md` (PROC-FIN-BA-01) — operational loss events from RCSA feed the Risk Return (D4/2022).
- [`incident-response.md`](incident-response.md) — major incidents trigger ad-hoc RCSA review.
- `model-validation.md` — model risk controls are assessed within the RCSA AI-agent category.
- [`agent-runtime-deploy.md`](agent-runtime-deploy.md) — agent-runtime controls are evidence inputs for Step 9.
- `audit-plan-cycle.md` (PLANNED) — Vera's internal audit plan derives from RCSA above-appetite risks.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Helena + Devon | Initial STUB — full 9-section skeleton; AI-agent risk category explicitly mandated; all invariants documented; system capabilities marked PLANNED pending Atlas build. |
| v0.2 | 2026-05-15 | Helena + Devon | Promoted STUB → POPULATED; added YAML frontmatter; no content changes. |

---

## 12. Audit / assurance

- Vera continuous: coverage invariant checks from `RCSACycleOpened` until `RCSACycleCompleted`; action plan overdue monitoring year-round.
- Vera annual: compare agreed control ratings against independent evidence (transaction monitoring alerts, incident log, recon break frequency); deviations reported to Audit Committee.
- BRC quarterly: action plan status KRI; above-appetite risk count trend; AI-agent risk category summary.
- External: ICAAP process incorporates the RCSA output; PA review of ICAAP includes RCSA methodology assessment.
