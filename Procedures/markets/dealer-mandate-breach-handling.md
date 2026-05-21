---
procedureId: PROC-MK-MBH-01
title: Dealer mandate limit breach detection, triage, and resolution
author: Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance)
status: POPULATED
version: "0.1"
last-updated: "2026-05-16"
policy-cited: TRADING-MANDATE-V1
system-capability: "@platform/markets/mandate-registry (PLANNED)"
citations:
  - TRADING-MANDATE-V1
  - Banks Act Regulation 39
  - D-MARKETS-SCHEMA-FOUNDATION
---

# Procedure — Dealer mandate limit breach detection, triage, and resolution

**Procedure ID:** PROC-MK-MBH-01
**Owner:** Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance) · Rohan (Market Risk Quant Engineer)
**Approval:** BRC (TRADING-MANDATE-V1)
**Cadence:** Continuous intraday monitoring; breach response per-event; structural review per breach-pattern
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- TRADING-MANDATE-V1 — defines dealer limit categories, breach materiality thresholds, and required response timelines.
- Banks Act Regulation 39 — breaches of written trading authority are reportable events; material breaches may require SARB notification at commencement of trading.

The obligation chain:

```
Regulation (Banks Act Reg 39 — trading authority discipline)
  → TRADING-MANDATE-V1 (breach materiality + response framework)
    → PROC-MK-MBH-01 (this procedure)
      → @platform/markets/mandate-registry + @platform/risk/breach-monitor (PLANNED)
        → DealerMandateBreachDetected / DealerMandateBreachResolved events
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act Regulation 39 | Trading authority is non-delegable beyond the written mandate; any trade executed outside mandate scope is a regulatory breach. |
| TRADING-MANDATE-V1 | Internal framework classifying breaches as technical (intraday market move), operational (system/process error), or wilful (deliberate overstep); prescribing Level-1 (Saskia) and Level-2 (Helena) triage and response timelines. |

## 3. Purpose

1. Detect dealer mandate limit breaches in real time via automated intraday monitoring (Anya's data pipeline).
2. Triage each breach rapidly: Level-1 (Saskia) within 30 minutes; Level-2 (Helena) within 15 minutes for material breaches.
3. Suspend trading where required to prevent further exposure accumulation.
4. Determine root cause (market move, operational error, structural limit mismatch, or wilful overstep) and apply the appropriate corrective action.
5. Engage Rohan for limit recalibration where the breach reveals a structural mismatch between the calibrated limit and current market conditions.
6. Maintain an immutable breach log that supports regulatory reporting obligations at commencement of trading.

## 4. Trigger

- **Automated breach alert:** `DealerMandateBreachDetected { dealerId, mandateId, breachType: 'Notional' | 'Tenor' | 'Product', actualValue, limitValue, breachPct, detectedAt }` — emitted by `@platform/risk/breach-monitor` when a trade execution or mark-to-market revaluation causes a dealer's position to exceed any mandate limit.
- **Post-trade reconciliation breach:** `ReconciliationBreachFlagged { dealerId, tradeId, mandateId, details }` — emitted during EOD reconciliation if a breach was not caught intraday.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | `@platform/risk/breach-monitor` runs continuous intraday position monitoring against the active mandate registry; on limit breach: emit `DealerMandateBreachDetected` and send immediate alert to Anya (Data Engineer) + Saskia | `agent` (Anya — Data Engineer) | `@platform/risk/breach-monitor` (PLANNED) | Monitoring frequency: real-time for notional breaches on live trades; 5-minute cycle for portfolio-level aggregates. No lag tolerance — missed alert is a Vera critical finding. |
| 2 | **Level-1 triage (Saskia):** Saskia reviews the breach within 30 minutes; classifies the breach as: (a) technical — intraday market move causing mark-to-market breach; (b) operational — system or process error; (c) structural — limit too tight for current market; (d) wilful — dealer deliberately exceeded mandate | `human` (Saskia — Chief Markets Officer, governance) | `@platform/markets/mandate-registry` (PLANNED) | Saskia must emit `BreachTriageRecorded { breachId, classification, saskiaJudgement, triageCompletedAt }` within 30 minutes. If Saskia is unavailable: auto-escalation to Helena. |
| 3 | If classification is **technical or operational**: Saskia determines whether trade needs to be unwound; for operational breaches caused by system error, Anya investigates the root cause before any unwinding | `human` (Saskia) + `agent` (Anya) | `@platform/markets/mandate-registry` (PLANNED) | Technical breaches caused by market moves do not automatically require unwinding; Saskia exercises judgment and documents rationale. |
| 4 | **Level-2 escalation (Helena):** For material breaches (breach > 10 % of mandate limit, or product-scope breach of any size), Saskia escalates to Helena within 15 minutes of detecting the breach; Helena reviews the risk implications | `human` (Helena — Chief Risk Officer, governance) | None — risk judgment | Helena must emit `MaterialBreachReviewRecorded { breachId, helenaJudgement, tradeSupensionRequired, reviewCompletedAt }` within 15 minutes of escalation. |
| 5 | **Trade suspension:** If Helena (or Saskia for non-material breaches) determines suspension is required: emit `DealerTradingSuspended { dealerId, mandateId, reason, suspendedAt, suspendedBy }`; `@platform/markets/mandate-registry` blocks all new trades by this dealer until suspension is lifted | `human` (Helena or Saskia) + `agent` | `@platform/markets/mandate-registry` (PLANNED) | Suspension is immediate and unconditional. Open orders in the order management system are cancelled. Partially-executed orders are reviewed by Saskia. |
| 6 | **Root-cause analysis:** Anya (Data Engineer) produces a root-cause note within 4 hours for operational and structural breaches; wilful breaches trigger an immediate HR/conduct process (Sade engaged) and regulatory breach notification assessment (Mira + Owen) | `agent` (Anya) + `human` (Sade, Mira, Owen as applicable) | `@platform/risk/breach-monitor` (PLANNED) | Root-cause note is stored in doc store (BLAKE3-addressed) and referenced by hash in the `BreachRootCauseRecorded` event. |
| 7 | **Corrective action:** Based on root-cause classification: (a) technical — no structural change; (b) operational — Anya patches the system error; (c) structural — Rohan recalibrates limits (step 8); (d) wilful — mandate revoked immediately (PROC-MK-MDI-01 revocation path) | `agent`/`human` as applicable | Various | Corrective action must be documented as a `BreachCorrectiveActionRecorded` event within 24 hours of root-cause. |
| 8 | **Rohan recalibration (structural breaches):** Rohan re-runs the quantitative limit calibration against current market conditions; produces updated limit-calibration note; Helena reviews and approves; Saskia amends the mandate (PROC-MK-MDI-01 amendment path) | `agent` (Rohan — Market Risk Quant Engineer) + `human` (Helena) | `@platform/risk/var-engine` (PLANNED) | Recalibration must complete within 2 business days of structural-breach classification. Dealer remains suspended until new mandate is issued. |
| 9 | **Resolution:** When corrective action is complete and trading suspension (if any) is lifted: emit `DealerMandateBreachResolved { breachId, dealerId, mandateId, resolution, rootCause, correctiveAction, resolvedAt, resolvedBy: Saskia }` | `human` (Saskia) | `@platform/event-store` | Resolution event closes the breach in the breach registry. Vera asserts that all `DealerMandateBreachDetected` events have a downstream `DealerMandateBreachResolved` within 5 business days. |
| 10 | **Regulatory notification (material wilful breaches):** If the breach is classified wilful and exposure exceeded R10m or 10 % of the dealer's notional limit: Mira (Compliance / RegTech Engineer) prepares regulatory notification for SARB; Owen (Company Secretary, governance) co-reviews; notification filed via FinSurv channel | `human` (Mira + Owen) | `@regulatory/sarb-finsurv` (PLANNED) | Regulatory notification is a licence-day obligation; during build phase, the notification workflow is rehearsed but not submitted to SARB. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Anya (Data Engineer) | Intraday breach monitoring; breach alert emission; root-cause analysis for operational breaches |
| Saskia (Head of Global Markets) | Level-1 triage; trade suspension decisions for non-material breaches; resolution event emission |
| Helena (Chief Risk Officer, governance) | Level-2 review for material breaches; RAS implications; trade suspension authorisation |
| Rohan (Market Risk Quant Engineer) | Structural-breach limit recalibration |
| Mira (Compliance / RegTech Engineer) | Regulatory notification assessment and filing |
| Owen (Company Secretary, governance) | Co-review of regulatory notifications |
| Sade (AgentOps Engineer) | HR/conduct process for wilful breaches |
| Vera (internal audit engineer, governance) | Daily assertion that all `DealerMandateBreachDetected` events are resolved within 5 business days |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Material breach (> 10 % of limit) | Helena Level-2 review | Within 15 minutes of detection |
| Product-scope breach | Helena Level-2 review + immediate suspension | Immediate |
| Wilful breach classification | Helena + Sade (conduct) + Mira (regulatory) + CEO if > R50m | Immediate |
| Unresolved breach > 5 business days | Vera finding → Helena → CEO | Day 6 |
| Breach monitoring system offline > 15 minutes | Anya + Devon (COO) emergency response | 15 minutes |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/risk/breach-monitor` | PLANNED | Intraday limit monitoring, breach alert emission |
| `@platform/markets/mandate-registry` | PLANNED | Active-mandate query, suspension enforcement |
| `@platform/risk/var-engine` | PLANNED | Limit recalibration |
| `@platform/event-store` | Live | Breach events, resolution records |
| `@regulatory/sarb-finsurv` | PLANNED | Regulatory breach notification |

## 9. Quality controls

- Every `DealerMandateBreachDetected` must have a `BreachTriageRecorded` within 30 minutes. Vera monitors this continuously.
- Every material breach must have a `MaterialBreachReviewRecorded` within 45 minutes. Helena's review latency is a Vera metric.
- All open breaches must be resolved within 5 business days. Overdue breaches are escalated to CEO.
- Breach-monitoring system availability is tracked; downtime > 15 minutes triggers an incident response.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `DealerMandateBreachDetected` | Event log | 7 years | Primary breach record |
| `BreachTriageRecorded` | Event log | 7 years | Level-1 triage evidence |
| `MaterialBreachReviewRecorded` | Event log | 7 years | Level-2 Helena review evidence |
| `DealerTradingSuspended` | Event log | 7 years | Suspension record |
| Root-cause note | Doc store (BLAKE3) | 7 years | Operational evidence |
| `DealerMandateBreachResolved` | Event log | 7 years | Resolution record |
| Regulatory notification (where applicable) | Regulatory correspondence store | 7 years | SARB submission |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — automated intraday monitoring, Level-1 Saskia triage, Level-2 Helena review, trade suspension, root-cause analysis, Rohan recalibration path, resolution events; wilful-breach regulatory notification; Banks Act Reg 39 compliance. |
