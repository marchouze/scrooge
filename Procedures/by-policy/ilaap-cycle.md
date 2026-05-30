---
policy-parent: liquidity-risk-management-policy-v1
last-reviewed: 2026-05-30
procedureId: PROC-RISK-ILAAP-01
title: ILAAP cycle — internal liquidity adequacy assessment
author: Eitan (Treasurer) · Helena (Chief Risk Officer, governance — sign-off) · Camille (Chief Financial Officer, governance — Pillar 2)
date: 2026-05-30
owner: Eitan (Treasurer) · Helena (Chief Risk Officer, governance — sign-off) · Camille (Chief Financial Officer, governance — Pillar 2)
status: POPULATED
policy-cited: liquidity-risk-management-policy-v1
system-capability: "@platform/ilaap (LIVE — atlas:ilaap-run handler)"
---

# Procedure — ILAAP cycle (internal liquidity adequacy assessment process)

**Procedure ID:** PROC-RISK-ILAAP-01
**Owner:** Eitan (Treasurer) · Helena (Chief Risk Officer, governance — sign-off) · Camille (Chief Financial Officer, governance — Pillar 2 capital)
**Approval:** Helena (Chief Risk Officer, governance — sign-off); CEO / Board (ILAAP submission); ALCO (interim review)
**Cadence:** Quarterly (stress run + interim review); annual (full ILAAP submission to the PA)
**Version:** v0.1 — 2026-05-30
**Status:** POPULATED

## 1. Source policy

- `liquidity-risk-management-policy-v1` — the Liquidity Risk Management Policy mandates an ILAAP; this procedure is its execution.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B5 — the liquidity appetite and survival-horizon thresholds the ILAAP tests against.

The obligation chain:
```
Regulation (Banks Act Reg 39 — ILAAP; BCBS liquidity standards; PA liquidity directives)
  → Liquidity Risk Management Policy (liquidity-risk-management-policy-v1)
    → PROC-RISK-ILAAP-01 (this procedure)
      → @platform/ilaap (LIVE — atlas:ilaap-run)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-23` (Regulations Relating to Banks — Reg 39 ILAAP) | The bank must run an Internal Liquidity Adequacy Assessment Process: identify, measure, and stress liquidity risk; assess the adequacy of its liquidity buffer under stress; document and submit to the PA. |
| `ORG-PR-07` (BCBS Principles for Sound Management) | The ILAAP must be governed by senior management and the Board; stress scenarios must be severe but plausible. |
| `ORG-PR-08` (Reg 26/27 — LCR/NSFR) | The ILAAP must reconcile to the regulatory liquidity ratios and assess survival under idiosyncratic and market-wide stress. |

## 3. Purpose

Run the Internal Liquidity Adequacy Assessment Process: stress the bank's liquidity position under four severe-but-plausible scenarios, measure the survival horizon, assess buffer adequacy, feed the Pillar 2 liquidity capital assessment, and produce the ILAAP submission. The run is generated from live positions; in the build phase positions are zero and the run emits a `no-positions` baseline that populates once trades land.

## 4. Trigger

**Quarterly (standing):**
- Quarterly scheduler — `atlas:ilaap-run` runs the four scenarios and emits the scenario + summary events.

**Annual (submission):**
- Annual scheduler — full ILAAP narrative assembled from the quarterly runs; Helena (CRO) signs; submitted to the PA.

**Ad-hoc:**
- A material liquidity-position change or an ALCO direction can trigger an off-cycle ILAAP run.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Read the base liquidity position: HQLA stock, 30-day net outflow, funding profile, behavioural assumptions | `system` (`atlas:ilaap-run`) | `@platform/ilaap` (LIVE) + `@platform/event-store` | Base inputs derive from the LCR/NSFR projections and the collateral inventory; `baseHQLAZar` and `baseNetOutflow30dZar` are recorded on the run. |
| 2 | Run the four stress scenarios: (1) idiosyncratic (name-specific run), (2) market-wide, (3) combined, (4) reverse-stress (solve for the shock that exhausts the buffer) | `system` | `@platform/ilaap` (LIVE) | Emit `ILAAPScenarioRun { runPrefix, scenario, survivalDays, ... }` per scenario (4 per run). |
| 3 | Compute the worst-case survival horizon and overall status across the four scenarios | `system` | `@platform/ilaap` (LIVE) | Emit `ILAAPSummaryCompleted { runPrefix, worstCaseSurvivalDays, worstCaseScenario, overallStatus }`. `overallStatus: no-positions` in the build phase is expected. |
| 4 | Emit the ICAAP/ILAAP linkage input for the Pillar 2 capital assessment | `system` | `@platform/event-store` | Emit `IcaapIlaapInputReady` — Camille (CFO) consumes this for the Pillar 2 liquidity capital add-on assessment. |
| 5 | Interim review: Eitan (Treasurer) and Helena (Chief Risk Officer, governance) review the scenario results, survival horizon, and buffer adequacy at the quarterly ALCO | `agent` (Eitan + Helena) | `@platform/alco` | Results tabled via the ALCO pack (PROC-ALM-ALCO-01). |
| 6 | Annual ILAAP narrative: Eitan and Helena produce the ILAAP document — methodology, scenario results, survival horizon, buffer adequacy, Pillar 2 assessment, management actions; Helena signs | `agent` (Eitan) + `human` (Helena — sign) | Document store | Helena's CRO signature is the load-bearing governance act; submitted to the PA. |
| 7 | If any scenario breaches the survival-horizon threshold, raise the risk and escalate | `system`/`agent` | `@platform/escalation` | Emit `SubstrateAlert` / `RiskRaised` and an `AgentEscalation` per §9. |

## 6. Reconciliation

- **Events produced:** `ILAAPScenarioRun` (×4 per run); `ILAAPSummaryCompleted` (×1 per run); `IcaapIlaapInputReady` (×1 per run); `RiskRaised` / `AgentEscalation` (on breach).
- **Reconciliation checks:**
  - Every quarter has an `ILAAPSummaryCompleted` event (missing run = Vera finding).
  - Every `ILAAPSummaryCompleted` is preceded by exactly four `ILAAPScenarioRun` events sharing its `runPrefix`.
  - The ILAAP base inputs reconcile to the prevailing `LCRComputed` / `NSFRComputed` projections for the same as-of date.
  - Every breach (`overallStatus` below threshold) has an `AgentEscalation` with a disposition.
- **Failure mode:** ILAAP engine produces `no-positions` once trades exist (a stale baseline) → Atlas + Eitan investigate the position feed; `SubstrateAlert` raised.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ILAAPScenarioRun` / `ILAAPSummaryCompleted` events | Event log | Permanent (P1) | Restricted |
| `IcaapIlaapInputReady` event | Event log | Permanent (P1) | Restricted |
| Annual ILAAP document | Document store | Permanent (ILAAP retention) | Confidential |
| PA submission record | Document store + PA submission record | 7 years | Confidential |

## 8. Manual steps

- **Step 6 — ILAAP narrative and CRO sign-off:** the Pillar 2 liquidity assessment narrative and Helena's signature are irreducibly human governance acts.
- **Step 5 — Interim review:** the Treasurer/CRO judgement on buffer adequacy under stress is judgemental.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Quarterly ILAAP run not completed | Vera quarterly invariant (no `ILAAPSummaryCompleted`) | Eitan + Atlas; manual fallback run; review delayed |
| Worst-case survival horizon below threshold | `ILAAPSummaryCompleted` rollup | `AgentEscalation` → Helena + Camille + CEO; emergency ALCO; management actions |
| Fewer than four `ILAAPScenarioRun` per summary | Reconciliation check | Atlas + Eitan; rerun before the ALCO review |
| Stale `no-positions` once trades exist | `SubstrateAlert` | Atlas + Eitan; position-feed investigation |
| ILAAP not submitted to PA in time | Helena's annual schedule | Camille + Helena → CEO; PA deadline management |

## 10. Related procedures

- [`intraday-liquidity-funding.md`](intraday-liquidity-funding.md) (PROC-RISK-ILF-01) — intraday liquidity feeds ILAAP base inputs.
- [`liquidity-limit-management.md`](liquidity-limit-management.md) (PROC-RISK-LLM-01) — LCR/NSFR ratios reconcile to the ILAAP base.
- [`irrbb-measurement.md`](irrbb-measurement.md) (PROC-RISK-IRRBB-01) — the IRRBB chapter is part of the ILAAP/Pillar 2 assessment.
- [`alco-cycle.md`](alco-cycle.md) (PROC-ALM-ALCO-01) — the ILAAP summary feeds the ALCO pack; ALCO governs the ILAAP narrative.
- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — the Pillar 2 liquidity add-on feeds capital adequacy.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-30 | Eitan + Helena + Camille (via Scrooge) | Initial authoring — closes the PROC-RISK-ILAAP-01 procedure gap; first ILAAP run executed 2026-05-30 (4 `ILAAPScenarioRun` + `ILAAPSummaryCompleted` + `IcaapIlaapInputReady`). Authority: D-TREASURER-PROC-COMPLETION-2026-05-30. |

## 12. Audit / assurance

- **Vera quarterly:** verify an `ILAAPSummaryCompleted` exists per quarter with four backing `ILAAPScenarioRun` events; verify base inputs reconcile to LCR/NSFR.
- **PA SREP:** the PA reviews the annual ILAAP as part of the SREP; adverse findings trigger a Helena-managed supervisory engagement.
- **Thandiwe (Chief Audit Executive, governance):** annual internal audit of the ILAAP methodology and governance trail; opinion to the Interim Audit Forum.
