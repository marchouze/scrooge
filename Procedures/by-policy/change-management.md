---
status: POPULATED
---
# Procedure — Change management (production change approval & deployment)

**Procedure ID:** PROC-CY-02
**Owner:** Devon (COO) · Atlas (platform engineering) · Senna (security gate)
**Approval:** BRC
**Cadence:** Continuous (per change); high-risk changes flagged to BRC
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §8 — Change Management Policy.
`Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §1 — Information Security Policy (Secure SDLC).
`Owner Inbox/2026-05-06_core-policies-risk.md` §6 — Operational Resilience Policy (impact tolerances).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-17` (BCBS Operational Risk) | Operational-risk identification, measurement, control framework. |
| `ORG-PR-18` (BCBS Operational Resilience) | IBS impact tolerances respected through change. |
| `ORG-CY-01` (Joint Standard 2 of 2024) | Cybersecurity framework with named accountability. |
| `ORG-CY-03` (Joint Standard 2 of 2024) | Threat modelling and controls catalogue. |
| Internal | RAS B6 cyber severity overlap — material changes can introduce risk. |

## 3. Purpose

Every production change is made deliberately, traceably, reversibly. Change classes (standard / normal / emergency) carry different gates; high-risk changes (RAS-impacting, regulatory-reporting-impacting, IBS-impacting) require BRC awareness; reversibility is a design property.

## 4. Trigger

A `ChangeProposed` event from the engineering workflow:

- New build / merge to a deployable branch.
- Configuration change to production.
- Operator-initiated emergency change (e.g., to contain an incident).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Classify change: **Standard** (pre-authorised within DoA) / **Normal** (full review) / **Emergency** (post-hoc review within 24h) | `system` (rule-based) + `human` (override) | `@platform/change/classifier` (`PLANNED`) | Class is a typed event. |
| 2 | Risk assessment: identifies RAS-impacting / regulatory-reporting-impacting / IBS-impacting attributes | `system` (analyser) + `human` (proposer) | `@platform/change/risk-assessor` (`PLANNED`) | Event: `ChangeRiskAssessed`. High-risk → BRC awareness required. |
| 3 | Security gate: threat model and Secure-SDLC artefacts (SAST / DAST / SBOM / signed-build) | `system` (CI gate) + `human` (Senna for high-risk) | `@platform/change/security-gate` + CI ✓ | Event: `SecurityGatePassed`. Failure blocks promotion. |
| 4 | Reconciliation gate: GL ↔ event-derived ↔ sub-ledger projection reconciles to zero (Capital ratio, ECL, etc.) | `system` (CI gate) | `@platform/change/recon-harness` (`PLANNED`) | Event: `ReconGatePassed`. Failure blocks promotion. |
| 5 | Reversibility check: has a documented rollback plan; data migrations are reversible or accept registered risk | `system` + `human` (Atlas / Devon) | `@platform/change/reversibility` (`PLANNED`) | Irreversible changes are tracked exceptions. |
| 6 | Approval per DoA: standard auto-approves; normal needs reviewer + approver; high-risk needs Devon (or named delegate) | `system` (DoA gate) | `@platform/change/doa` (`PLANNED`) | Cryptographic approval signatures. |
| 7 | Pre-deployment communication for IBS-impacting changes (operations, customers, regulators) | `human` (Devon / Tomas / Niko) | `@platform/notification` (`PLANNED`) | Event: `ChangePreNotified`. |
| 8 | Deployment with progressive rollout (canary → percentage → full) | `system` | `@platform/deploy/progressive` (`PLANNED`) | Each stage is a typed event. |
| 9 | Post-deployment verification: synthetic tests, KPI checks, error budgets | `system` | `@platform/observe/post-deploy-checks` (`PLANNED`) | Event: `PostDeploymentVerified`. |
| 10 | Auto-rollback on verification failure (where reversible); paged human IC otherwise | `system` + `human` (IC) | `@platform/deploy/rollback` (`PLANNED`) | Rollback is itself a change event with cause. |
| 11 | Emergency-change post-hoc review within 24h | `human` (Devon-led, with Senna) | `@platform/change/post-hoc-review` (`PLANNED`) | Event: `EmergencyPostHocReviewed`. Lessons feed standard-change automation. |

## 6. Reconciliation

- **Events produced:**
  - `ChangeProposed`, `ChangeClassified`, `ChangeRiskAssessed`.
  - `SecurityGatePassed` / `SecurityGateFailed`.
  - `ReconGatePassed` / `ReconGateFailed`.
  - `ChangeApproved` (with approver identity), `ChangeRejected`.
  - `ChangePreNotified` (where applicable).
  - `DeploymentStarted`, `DeploymentStageAdvanced` (canary / pct / full), `DeploymentCompleted`.
  - `PostDeploymentVerified` / `PostDeploymentFailed`.
  - `RollbackTriggered`, `EmergencyPostHocReviewed`.
- **Reconciliation check:**
  - Every production deployment has the full chain of events: `ChangeProposed → ChangeApproved → DeploymentCompleted → PostDeploymentVerified` (or rollback).
  - No deployment without `SecurityGatePassed` and `ReconGatePassed` (CI-enforced).
  - Every emergency change has `EmergencyPostHocReviewed` within 24h.
  - High-risk changes have `ChangePreNotified` event before deployment; missing pre-notification is a procedural breach.
  - Rollbacks are themselves changes with full traceability.
- **Failure mode:** CI gate fails → deployment blocked; engineer gets explicit failure event with remediation hint. Rollback paths failing → IC paged; potential incident.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Change events | Event log | Permanent (P1) | High |
| Approval signatures | Event log (cryptographic) | Permanent | High |
| Security-gate artefacts (SAST/DAST/SBOM) | Artefact store + event log hash | 5 years | High |
| Rec-gate output | CI artefacts + event log | Permanent | High |
| Deployment manifests | IaC repo + event log hash | Permanent (versioned) | High |
| Post-deployment verification results | Event log + observability platform | 5 years | High |

## 8. Manual steps

- **Step 1** (classification override) — engineer's judgement; high-risk reclassification possible.
- **Step 2** (risk assessment) — supplementary human analysis for novel changes.
- **Step 5** (reversibility) — Atlas / Devon judgement on irreversibility; tracked exceptions.
- **Step 6** (approval) — human approval signatures for normal / high-risk.
- **Step 7** (pre-notification) — human-driven communications.
- **Step 11** (post-hoc review) — Devon-led; lessons captured.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Mis-classified standard change introduces risk | Post-deploy verification | Immediate rollback; reclassification; classifier retraining |
| Security gate bypassed | CI integrity event | Immediate freeze; Senna + Devon investigation |
| Recon gate bypassed | CI integrity event | Immediate freeze; Camille + Helena investigation; AC notified |
| Emergency change without 24h post-hoc review | Projection alert | Devon + Helena; AC at 48h |
| Rollback fails | Deployment health check | IC paged; potential incident; recovery plan invoked |
| Irreversible-change exception not registered | Vera audit | Devon + Helena; remediation event |

## 10. Related procedures

- `incident-response.md` — emergency changes often initiated under IR.
- `model-validation.md` (`PLANNED`) — model changes are a sub-class with stricter validation.
- `outsourcing-due-diligence.md` (`PLANNED`) — third-party-impacting changes.
- `pa-notification-directive-3.md` (`PLANNED`) — material outsourcing / cloud changes require PA notification.
- `dr-test-execution.md` (`PLANNED`) — recovery validation overlap.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Devon + Atlas + Senna | Initial draft, pre-board reviewed under Change Management + Information Security policies. |

## 12. Audit / assurance

- Vera samples production deployments monthly for procedural completeness.
- Annual independent review of CI-gate integrity (Senna + external).
- Continuous-controls projection: standard-change error rate, normal-change cycle time, emergency-change frequency reported to BRC monthly.
