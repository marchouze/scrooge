---
procedureId: PROC-OPS-SFBCP-01
title: FX settlement failure BCP — Herstatt risk scenario
author: Tomas (Operations & Payments Engineer) · Devon (Chief Operating Officer, governance) · Helena (Chief Risk Officer, governance)
date: 2026-05-16
owner: Tomas (Operations & Payments Engineer) · Devon (Chief Operating Officer, governance) · Helena (Chief Risk Officer, governance)
status: POPULATED
version: "0.1"
last-updated: "2026-05-16"
policy-cited: Business Continuity Plan (planned)
system-capability: "@platform/operations/settlement-monitor (PLANNED)"
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - Banks Act Regulation 39
  - ISDA 2002 Master Agreement
---

# Procedure — FX settlement failure BCP — Herstatt risk scenario

**Procedure ID:** PROC-OPS-SFBCP-01
**Owner:** Tomas (Operations & Payments Engineer) · Devon (Chief Operating Officer, governance) · Helena (Chief Risk Officer, governance)
**Approval:** COO (Devon) — Business Continuity Plan (planned); CEO sign-off for major incidents
**Cadence:** Per-incident (triggered on settlement failure detection); annual BCP test
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Business Continuity Plan (planned; Devon co-author; CEO approval required at commencement).
- ISDA 2002 Master Agreement — §6 defines Events of Default and Termination Events; close-out netting is the primary legal remedy for counterparty settlement failure.
- Banks Act Regulation 39 — banks must maintain documented BCP procedures for settlement failures; Herstatt risk is an explicit supervisory concern.

The obligation chain:

```
Regulation (Banks Act Reg 39 — settlement BCP; ISDA 2002 — close-out netting)
  → Business Continuity Plan (planned)
    → PROC-OPS-SFBCP-01 (this procedure)
      → @platform/operations/settlement-monitor (PLANNED)
        → SettlementFailureDetected / SettlementFailureResolved events
```

**Herstatt risk definition:** The bank delivers one leg of an FX transaction (e.g. sells EUR, ZAR is debited from nostro) but the counterparty fails to deliver the other leg (EUR is never received). Named after Bankhaus Herstatt, which failed in 1974 mid-settlement. Exposure = full notional of the undelivered leg.

**RTO:** Nostro position clarified within 4 hours of failure detection; legal close-out claim filed within 24 hours.
**RPO:** No trade data loss — the event log is immutable and provides a complete settlement history.

**Build-phase posture:** No live trades. BCP procedure is rehearsed annually against synthetic failure scenarios. Rehearsal produces a `BcpRehearsalCompleted` event with findings.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act 94 (Reg 39) | Banks must maintain documented BCP procedures for settlement failures and Herstatt risk scenarios; procedures must be tested annually. |
| ISDA 2002 Master Agreement §6 | Event of Default (including payment failure) triggers the non-defaulting party's right to designate an Early Termination Date and calculate the close-out amount under the agreed close-out netting methodology. |
| PA Guidance Note 2/2024 | Prudential Authority expects banks to have documented controls for principal settlement risk; CLS or equivalent PvP settlement is preferred; non-CLS banks must have compensating controls. |
| SARB FinSurv (regulatory notification) | Material settlement failures (above regulatory thresholds) must be reported to SARB FinSurv; FSCA notification required if conduct concerns arise. |
| POPIA s.19–22 | If settlement failure exposes client data, POPIA breach notification procedures apply. |

## 3. Purpose

1. Define the bank's immediate response to FX settlement failure (Herstatt risk scenario): detection, position freeze, counterparty notification, and funding hold.
2. Prescribe the escalation path from Tomas (first response) through Devon (COO) to Helena (CRO) and Marc (CEO) based on exposure size and duration.
3. Define the recovery pathway: ISDA §6 close-out netting claim (Imani) and Devon's funding contingency.
4. Establish a defined RTO (nostro clarified within 4 hours) and RPO (zero data loss via immutable event log).
5. Ensure regulatory notification obligations are met where the failure is material.

## 4. Trigger

- **Correspondent flag:** `SettlementFailureDetected { failureId, tradeId, counterpartyId, failedLeg: { currency, amount, expectedSettlementDate }, nostroBalance, correspondentRef, detectedAt }` — emitted when the correspondent bank reports that the expected payment has not been received by the settlement cut-off.
- **Nostro monitoring alert:** `NostroShortfallDetected { nostroId, currency, expectedCredit, actualBalance, shortfallAmount, detectedAt }` — emitted by Tomas's nostro monitor when an expected credit does not arrive.
- **Annual BCP test:** `BcpRehearsalTriggered { scenario: 'HerstattRisk', testDate }`.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Failure detection:** Correspondent bank reports delivery failure via SWIFT MT195 (query) or MT199 (free-format); Tomas (Operations & Payments Engineer) receives the alert; reconciliation engine emits `ReconciliationBreak { kind: 'nostro' }` (per PROC-FIN-FXSR-01); Tomas confirms the failure by cross-checking the nostro statement | `human` (Tomas — Operations & Payments Engineer) | `@platform/operations/settlement-monitor` (PLANNED) | SWIFT MT195 receipt triggers the immediate response. Tomas has 15 minutes from receipt to confirm the failure and initiate step 2. No delay is acceptable — Herstatt exposure is uncapped until the position is frozen. |
| 2 | **Position freeze:** Tomas immediately freezes all open positions with the failing counterparty: (a) no new trades may be submitted for this counterparty (mandate-registry flag); (b) all pending settlement instructions to this counterparty are placed on hold; emit `CounterpartyPositionFrozen { failureId, counterpartyId, frozenAt, frozenBy: Tomas }` | `human` (Tomas) | `@platform/markets/counterparty-registry` (PLANNED) | Position freeze is immediate and unconditional. Tomas does not wait for Devon's authorisation to freeze — this is a standing Tomas authority under the BCP. |
| 3 | **Nostro funding hold:** Tomas instructs the correspondent bank to hold the nostro funding for the failing leg — do not release ZAR or FCY until the Herstatt position is resolved; correspondent confirmation reference recorded in `NostroFundingHeld { failureId, nostroId, heldAmount, currency, correspondentRef, heldAt }` | `human` (Tomas) | `@platform/operations/swift-gateway` (PLANNED) | Nostro funding hold prevents the bank from suffering a double loss: delivering the sold leg while the bought leg is not received. |
| 4 | **Counterparty notification:** Tomas (with Imani's assistance if time permits) sends formal notice to the counterparty: (a) identifies the undelivered leg by tradeId and settlement date; (b) demands delivery within 2 hours; (c) reserves the right to declare an Event of Default under ISDA 2002 §6 if delivery is not made | `human` (Tomas + Imani — Legal / Contracts Engineer) | `@platform/legal/isda-registry` (PLANNED) | Notification is sent via SWIFT MT199 or email (per ISDA notice provisions); Imani reviews the notice content for ISDA §6 compliance. |
| 5 | **Devon (COO) notified immediately:** Tomas notifies Devon (COO) of the settlement failure within 15 minutes of detection; Devon reviews the exposure assessment and activates the BCP incident log; Devon assumes incident command | `human` (Devon — Chief Operating Officer, governance) | `@platform/governance/incident-log` (PLANNED) | Devon's incident command includes: daily briefings, coordination between Tomas/Helena/Imani/Mira/Owen, and CEO updates. Incident log event: `IncidentActivated { incidentId, failureId, activatedBy: Devon, activatedAt }`. |
| 6 | **Helena (CRO) notified within 15 minutes:** Devon notifies Helena (CRO) within 15 minutes of detection; Helena assesses: (a) exposure quantum (full notional of undelivered leg); (b) impact on the bank's capital ratios; (c) whether the RAS threshold is breached; (d) portfolio correlation effects | `human` (Helena — Chief Risk Officer, governance) | None — risk judgment | Helena emits `SettlementFailureRiskAssessment { failureId, exposureZar, capitalImpact, rasBreached: boolean, correlationRisk, assessedAt }`. |
| 7 | **Marc (CEO) notified if > R50m exposure:** If the undelivered leg exposure exceeds R50m (or if Helena determines RAS is breached regardless of amount): Devon notifies Marc (CEO) immediately; Marc may authorise emergency capital actions or counterparty relationship decisions | `human` (Devon → Marc — CEO) | `@platform/decisions` | CEO notification is mandatory at the R50m threshold. Marc's decisions in this context are logged via `recordDecision` with `category: 'SettlementBCP'`. |
| 8 | **ISDA close-out netting claim (Imani):** If the counterparty fails to deliver within 2 hours of formal notice: Imani (Legal / Contracts Engineer) prepares a notice of Event of Default under ISDA 2002 §6; designates an Early Termination Date; calculates the close-out amount using the agreed Loss or Market Quotation methodology; files the close-out claim | `agent` (Imani — Legal / Contracts Engineer) | `@platform/legal/isda-registry` (PLANNED) | ISDA close-out is the primary legal remedy. Imani must file the formal §6 notice within 24 hours of the counterparty's payment failure (per RTO). Close-out event: `IsdaCloseOutNoticeIssued { failureId, counterpartyId, terminationDate, closeOutAmount, issuedBy: Imani, issuedAt }`. |
| 9 | **Devon funding contingency:** If nostro funding is required to cover the bank's side of the settlement while the claim is pursued: Devon activates the liquidity contingency plan — draws on the bank's liquidity buffer or interbank line with the correspondent bank; ensures the bank's obligations to other counterparties are not impacted | `human` (Devon) | `@platform/finance/liquidity-monitor` (PLANNED) | Liquidity contingency draw requires Devon + Bea (CFO) joint authorisation for amounts > R10m. Marc is informed of any draw > R50m. |
| 10 | **Regulatory notification:** If the settlement failure is material (exposure > R10m or counterparty default is a public event): Mira (Compliance / RegTech Engineer) prepares SARB FinSurv notification; Owen (Company Secretary, governance) co-reviews; notification filed within 24 hours | `human` (Mira + Owen) | `@regulatory/sarb-finsurv` (PLANNED) | Regulatory notification threshold and format are per current SARB FinSurv guidance. Mira maintains the threshold table. FSCA notification is also assessed if the failure involves client positions. |
| 11 | **Close-out and resolution:** Once the close-out amount is agreed (or the counterparty delivers): emit `SettlementFailureResolved { failureId, resolution: 'Delivered' | 'CloseOutSettled' | 'CloseOutDisputed', finalExposureZar, resolvedAt, resolvedBy: Devon }`; position freeze lifted; nostro funding released; incident log closed | `human` (Devon) | `@platform/event-store` | `SettlementFailureResolved` closes the BCP incident. Any close-out dispute triggers Imani's legal proceedings (separate track). |
| 12 | **Post-incident review:** Within 5 business days of resolution: Devon chairs a post-incident review; Tomas documents root cause; Helena documents risk lessons; Mira documents regulatory reporting compliance; findings documented in `PostIncidentReviewCompleted { failureId, rootCause, lessonsLearned, procedureChanges, reviewedAt }` | `human` (Devon + Tomas + Helena + Mira) | `@platform/governance/incident-log` (PLANNED) | Post-incident review output is an input to the annual BCP test design. Material procedure changes are Decision events. |
| 13 | **Annual BCP rehearsal:** On `BcpRehearsalTriggered`: Devon co-ordinates a full rehearsal of this procedure against a synthetic failure scenario; rehearsal must complete all steps 1–11 in simulation; findings documented; `BcpRehearsalCompleted { scenario, findingsCount, procedureChangesRequired, completedAt }` emitted | `human` (Devon + Tomas + Helena + Imani) | Various | Annual rehearsal is a Banks Act Reg 39 BCP requirement. Rehearsal must be completed within 30 days of `BcpRehearsalTriggered`. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Tomas (Operations & Payments Engineer) | First response; position freeze; nostro hold; counterparty notification; correspondent liaison |
| Devon (Chief Operating Officer, governance) | Incident command from step 5; CEO escalation; funding contingency; resolution event |
| Helena (Chief Risk Officer, governance) | Risk assessment; RAS breach determination; capital impact; CEO escalation trigger |
| Imani (Legal / Contracts Engineer) | ISDA §6 close-out notice; close-out calculation; legal proceedings if disputed |
| Mira (Compliance / RegTech Engineer) | Regulatory notification assessment; SARB FinSurv filing |
| Owen (Company Secretary, governance) | Co-review of regulatory notifications |
| Bea (Financial-Reporting Engineer) | GL entries for close-out; liquidity draw authorisation (joint with Devon) |
| Marc (CEO) | Notification and decision at > R50m exposure |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Counterparty fails to deliver within 2 hours | Imani ISDA §6 notice | 2 hours from formal notice |
| Exposure > R50m | Devon → Marc (CEO) | Immediate |
| RAS breach (regardless of amount) | Helena → Devon → Marc | Immediate |
| Nostro funding required > R10m | Devon + Bea joint authorisation | Before draw |
| Regulatory notification required | Mira + Owen → Rashida | Within 24 hours |
| Close-out disputed by counterparty | Imani legal proceedings; Helena + Devon strategy | Per dispute timeline |
| Annual BCP rehearsal not completed in time | Devon → Marc; Vera finding | Day 31 |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/operations/settlement-monitor` | PLANNED | Nostro monitoring; failure detection; settlement-window tracking |
| `@platform/operations/swift-gateway` | PLANNED | SWIFT MT195/199 messaging; nostro statement |
| `@platform/markets/counterparty-registry` | PLANNED | Position freeze enforcement |
| `@platform/legal/isda-registry` | PLANNED | ISDA §6 notice preparation; close-out calculation |
| `@platform/governance/incident-log` | PLANNED | BCP incident tracking; post-incident review |
| `@platform/finance/liquidity-monitor` | PLANNED | Liquidity buffer monitoring; contingency draw |
| `@regulatory/sarb-finsurv` | PLANNED | Material-failure regulatory notification |
| `@platform/event-store` | Live | Immutable settlement failure event log; RPO = zero |

## 9. Quality controls

- **RTO:** Nostro position clarified within 4 hours of `SettlementFailureDetected`. Devon monitors RTO compliance; breach is a CEO-notified incident.
- **RPO:** All settlement events are in the immutable event log. No trade data loss is acceptable. Vera asserts RPO daily.
- Position freeze must be in place within 15 minutes of failure detection. Vera asserts this timing invariant.
- ISDA close-out notice must be filed within 24 hours of counterparty payment failure (per RTO).
- Annual BCP rehearsal must complete within 30 days of `BcpRehearsalTriggered`.
- Every `SettlementFailureDetected` must have a downstream `SettlementFailureResolved`. Vera asserts this invariant.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `SettlementFailureDetected` | Event log | Permanent | Primary failure record |
| `CounterpartyPositionFrozen` | Event log | Permanent | Freeze record |
| `NostroFundingHeld` | Event log | Permanent | Funding hold record |
| `SettlementFailureRiskAssessment` | Event log | Permanent | Helena CRO risk assessment |
| `IsdaCloseOutNoticeIssued` | Event log | Permanent | Legal close-out record |
| `SettlementFailureResolved` | Event log | Permanent | Resolution record |
| Regulatory notification | Doc store (BLAKE3) + event log | 7 years | SARB FinSurv filing |
| `PostIncidentReviewCompleted` | Event log | 7 years | Post-incident learning record |
| `BcpRehearsalCompleted` | Event log | 7 years | Annual rehearsal record |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — Herstatt risk scenario; 13-step BCP; position freeze, nostro hold, counterparty notification, Devon incident command, Helena CRO assessment, CEO escalation > R50m, Imani ISDA §6 close-out, Devon funding contingency, Mira regulatory notification, resolution event; RTO 4h / RPO zero; annual rehearsal; ISDA 2002 + Banks Act Reg 39 sourcing. |
