---
procedureId: PROC-MK-PLG-01
title: Pre-licence go-live readiness gate
author: Saskia (Chief Markets Officer, governance) · Rashida (Chief Compliance Officer, governance) · Devon (Chief Operating Officer, governance)
date: 2026-05-16
owner: Saskia (Chief Markets Officer, governance) · Rashida (Chief Compliance Officer, governance) · Devon (Chief Operating Officer, governance)
status: POPULATED
version: "0.1"
last-updated: "2026-05-16"
policy-cited: D-MARKETS-SCHEMA-FOUNDATION
system-capability: "@platform/governance/go-live-gate (PLANNED)"
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - Banks Act 94 of 1990 s11
  - D-RMS-PHASE-1
---

# Procedure — Pre-licence go-live readiness gate

**Procedure ID:** PROC-MK-PLG-01
**Owner:** Saskia (Chief Markets Officer, governance) · Rashida (Chief Compliance Officer, governance) · Devon (Chief Operating Officer, governance)
**Approval:** CEO (D-MARKETS-SCHEMA-FOUNDATION); SARB determines final licence grant
**Cadence:** Milestone-driven (single instance per product go-live, preceded by an iterative readiness-build phase)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- D-MARKETS-SCHEMA-FOUNDATION (CEO-approved) — establishes the markets schema foundation and defines the pre-licence readiness gate as a required condition before commencement of trading.
- Banks Act 94 of 1990 s.11 — a banking licence must be obtained before conducting banking business; conducting banking business without a licence is a criminal offence.

The obligation chain:

```
Regulation (Banks Act 94 s.11 — licence required before banking business)
  → D-MARKETS-SCHEMA-FOUNDATION (CEO decision — go-live readiness gate)
    → PROC-MK-PLG-01 (this procedure — readiness gate sign-off)
      → @platform/governance/go-live-gate (PLANNED)
        → GoLiveReadinessConfirmed event (or gate remains open)
```

**Build-phase posture:** This procedure is the terminal gate in the build phase. Until `GoLiveReadinessConfirmed` is emitted, the bank may not commence any regulated activity. The gate is iteratively built during the entire build phase; conditions are checked and resolved as they are completed.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act 94 s.11 | No person may conduct banking business in SA without a licence granted by the Registrar of Banks; licence application to SARB is a pre-condition to commencement. |
| Banks Act 94 s.13 | The SARB Registrar must be satisfied that the applicant meets minimum capital, governance, risk management, and IT requirements before granting a licence. |
| FSCA FSP licence (FAIS Act s.7) | FSP licence required to provide financial services; must be in place before any FX spot or bond transaction is executed with or for clients. |
| PA Guidance Note 2/2024 | Prudential Authority expectations for governance, risk management frameworks, and capital adequacy to be demonstrated at licence application. |
| Banks Act 94 Reg 39 | Trading mandates, credit limits, and counterparty approval lists must be formalised and operational before commencement of trading. |

## 3. Purpose

1. Provide a structured, multi-condition readiness gate that the bank must pass before applying for a SARB banking licence and before commencing any regulated trading activity.
2. Ensure that all 5 NPA product-readiness conditions, 6 operational-readiness conditions, and required regulatory approvals are formally satisfied and evidenced by terminal events before the gate is declared open.
3. Require explicit sign-off from the co-chairs (Devon and Rashida) and the CEO before `GoLiveReadinessConfirmed` is emitted.
4. Provide an audit-quality record of how each readiness condition was met, linked to the underlying evidence events.

## 4. Trigger

- **Gate activation:** `GoLiveGateActivated { gateId, products: ['FxSpot', 'OtcIRS', 'JseBonds'], activatedBy: Devon, activatedAt }` — emitted when the bank formally enters the licence-application preparation phase.
- **Condition update:** `GoLiveConditionUpdated { gateId, conditionId, status: 'Open' | 'InProgress' | 'Satisfied', evidence, updatedAt }` — emitted as each condition is worked through.
- **Final gate call:** `GoLiveReadinessAssessed { gateId, allConditionsSatisfied: boolean, assessedBy: [Devon, Rashida], assessedAt }`.
- **Gate cleared:** `GoLiveReadinessConfirmed { gateId, confirmedBy: CEO, confirmedAt }`.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Devon (COO) activates the go-live gate by emitting `GoLiveGateActivated`; the gate dashboard surfaces all conditions in `Open` status; Devon and Rashida are assigned as co-chairs | `human` (Devon — Chief Operating Officer, governance) | `@platform/governance/go-live-gate` (PLANNED) | Gate activation is a CEO-approved milestone; it marks the formal start of the licence-application preparation phase. |
| 2 | **NPA product-readiness conditions (5 gates):** For each product (FX Spot, OTC Vanilla IRS, JSE Government Bonds, JSE Corporate Bonds, Structured Notes): (a) product schema defined and approved; (b) pricing model validated; (c) risk limits set; (d) conduct obligations mapped; (e) front-to-back system capability confirmed. Each sub-condition satisfied emits `GoLiveConditionUpdated { conditionId: 'NPA-{product}-{subCondition}', status: 'Satisfied', evidence }` | `agent` + `human` (Saskia co-signs each NPA gate) | `@platform/governance/go-live-gate` (PLANNED) | NPA conditions are product-specific. Each product requires Saskia (markets), Helena (risk), and Rashida (compliance) sign-off before the NPA condition for that product is marked Satisfied. |
| 3 | **Operational-readiness conditions (6 conditions):** (a) Trading system operational and tested; (b) Settlement connectivity with correspondent bank confirmed; (c) Regulatory reporting pipelines live and tested (FinSurv, SARB returns); (d) Mandate and counterparty registries populated and validated; (e) Conduct gate (PROC-MK-PCG-01) tested end-to-end; (f) BCP and settlement-failure procedure (PROC-OPS-SFBCP-01) tested. Each condition satisfied emits `GoLiveConditionUpdated { conditionId: 'OPS-{condition}', status: 'Satisfied', evidence }` | `agent` + `human` (Devon co-signs each OPS condition) | `@platform/governance/go-live-gate` (PLANNED) | Operational conditions require Devon (COO) sign-off. System conditions require the relevant engineer to emit a test-completion event as evidence. |
| 4 | **Regulatory approvals:** (a) SARB banking licence application submitted and approval received; (b) FSCA FSP licence in place; (c) POPIA Information Officer registered; (d) Key individuals (GC, MLRO) appointed and FSCA-approved; (e) Auditor appointed and engagement letter signed. Each approval received emits `RegulatoryApprovalReceived { approvalId, authority, approvalType, receivedAt, evidence }` | `human` (Devon + Rashida + Owen co-track) | `@platform/governance/go-live-gate` (PLANNED) | Regulatory approvals are external; they cannot be self-certified. Devon tracks outstanding approvals against the SARB licence timeline. |
| 5 | **Readiness assessment:** Devon and Rashida jointly review the gate dashboard; confirm all conditions are in `Satisfied` status; all `RegulatoryApprovalReceived` events are present; emit `GoLiveReadinessAssessed { gateId, allConditionsSatisfied: true, assessedBy: [Devon, Rashida], assessedAt }` | `human` (Devon + Rashida) | `@platform/governance/go-live-gate` (PLANNED) | Assessment requires both Devon and Rashida to emit their sign-off events. Quorum is 2/2. A single co-chair cannot unilaterally confirm readiness. |
| 6 | **CEO confirmation:** Marc (CEO) reviews the `GoLiveReadinessAssessed` event and the underlying condition evidence; if satisfied: emits `GoLiveReadinessConfirmed { gateId, confirmedBy: CEO, confirmedAt }` via `recordDecision`; this is the terminal event that authorises commencement of trading | `human` (Marc — CEO) | `@platform/decisions` | `GoLiveReadinessConfirmed` is a D-class decision event recorded via `recordDecision`. It is the single point of CEO authorisation for commencement of trading. |
| 7 | **Post-gate activation:** On `GoLiveReadinessConfirmed`: Rashida initiates the commencement-of-trading regulatory notifications (SARB, FSCA); Devon activates production trading infrastructure; Saskia opens the trading desk to live counterparties; Niko commences live client onboarding | `human` (Rashida, Devon, Saskia, Niko) | Various | The gate event is immutable; any subsequent suspension of trading requires a separate `TradingSuspended` event with CEO sign-off. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Devon (Chief Operating Officer, governance) | Gate co-chair; operational-readiness conditions sign-off; gate activation and activation |
| Rashida (Chief Compliance Officer, governance) | Gate co-chair; NPA compliance sign-off; regulatory approvals tracking |
| Saskia (Chief Markets Officer, governance) | NPA product-readiness conditions sign-off; desk activation on confirmation |
| Helena (Chief Risk Officer, governance) | NPA risk-limit conditions sign-off |
| Owen (Company Secretary, governance) | Regulatory approval documentation; SARB/FSCA correspondence |
| Marc (CEO) | Final `GoLiveReadinessConfirmed` sign-off |
| Vera (internal audit engineer, governance) | Independent verification that all conditions are evidenced before assessment event |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| NPA condition blocked (system capability not ready) | Devon + relevant engineer + CEO for scope decision | Per blocker timeline |
| Regulatory approval delayed | Owen + Devon + Marc strategic decision on timeline | Per SARB/FSCA timeline |
| One co-chair cannot agree on readiness | Marc (CEO) adjudicates | Immediate |
| Condition evidence disputed by Vera | Devon + Rashida review; condition remains Open until dispute resolved | Before assessment |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/governance/go-live-gate` | PLANNED | Condition tracking; gate dashboard; sign-off workflow |
| `@platform/decisions` | Live | `GoLiveReadinessConfirmed` decision event via `recordDecision` |
| `@platform/event-store` | Live | All gate condition and approval events |

## 9. Quality controls

- The gate cannot be confirmed unless all 11 conditions (5 NPA + 6 OPS) are in `Satisfied` status and all required `RegulatoryApprovalReceived` events are present. Vera independently verifies the condition set before `GoLiveReadinessAssessed` is emitted.
- `GoLiveReadinessConfirmed` requires both co-chair assessment events and CEO confirmation. Any missing event blocks the gate.
- Once confirmed, the gate is immutable. No condition can be retrospectively changed.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `GoLiveGateActivated` | Event log | Permanent | Gate initiation record |
| `GoLiveConditionUpdated` (per condition) | Event log | Permanent | Condition sign-off evidence |
| `RegulatoryApprovalReceived` | Event log | Permanent | Regulatory approval record |
| `GoLiveReadinessAssessed` | Event log | Permanent | Co-chair assessment record |
| `GoLiveReadinessConfirmed` | Event log | Permanent | CEO authorisation for commencement |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — gate activation, 5 NPA product conditions, 6 OPS conditions, regulatory approvals, Devon/Rashida co-chair assessment, CEO GoLiveReadinessConfirmed event; Banks Act 94 s.11 compliance; terminal build-phase gate. |
