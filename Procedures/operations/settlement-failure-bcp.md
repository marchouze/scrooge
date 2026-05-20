---
procedureId: PROC-OPS-SFBCP-01
title: FX settlement failure BCP — Herstatt risk scenario (FX-spot focus)
author: Devon (Chief Operating Officer, governance) · Helena (Chief Risk Officer, governance) · Imani (Chief Legal Counsel, governance) · Saskia (Chief Markets Officer, governance) · Tomas (Operations & Payments Engineer)
date: 2026-05-20
owner: Devon (Chief Operating Officer, governance)
co-signs: Helena (Chief Risk Officer, governance) · Imani (Chief Legal Counsel, governance) · Saskia (Chief Markets Officer, governance) · Zara (Chief Compliance Officer, governance)
status: POPULATED
version: "0.3"
last-updated: "2026-05-20"
policy-cited: "Policies/trading-mandate-v1.md §6 · Policies/market-risk-policy-v1.md · Business Continuity Plan (planned)"
system-capability: "@platform/operations/settlement-monitor (PLANNED)"
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - Banks Act 94 Reg 39
  - SARB PA Guidance Note 5 of 2013
  - BCBS d226
  - ISDA 2002 Master Agreement
  - project_indirect_participant_posture
  - 2026-05-20_helena_fx-spot-only-market-risk-scope-review §6 G-8
---

# Procedure — FX settlement failure BCP — Herstatt risk scenario (FX-spot focus)

**Procedure ID:** PROC-OPS-SFBCP-01
**Owner:** Devon (Chief Operating Officer, governance)
**Co-signs:** Helena (Chief Risk Officer, governance) · Imani (Chief Legal Counsel, governance) · Saskia (Chief Markets Officer, governance) · Zara (Chief Compliance Officer, governance)
**Approval:** COO (Devon) — Business Continuity Plan (planned); CEO sign-off on cancel-and-rebook decisions above the ZAR 1m gross-fail threshold defined at §7
**Cadence:** Per-incident (triggered on FX settlement failure detection); annual BCP rehearsal
**Version:** v0.3 — 2026-05-20
**Status:** POPULATED

## 1. Source policy

This procedure is the operational implementation of:

- **`Policies/trading-mandate-v1.md` §6 — FX Settlement Risk Framework.** §6.3 enumerates six Herstatt-risk mitigation measures, one of which is the **settlement-failure incident protocol**: "If Standard Bank reports a settlement failure or delays on a USD/ZAR trade, Tomas immediately escalates to Helena and Devon. Incident is typed as a `FxSettlementFailed` event." This procedure is the scripted articulation of that escalation.
- **`Policies/market-risk-policy-v1.md`** — settlement risk treated as a market-risk-adjacent control (B-cluster RAS line B8a; market re-mark on the surviving leg of a Herstatt-active failure).
- **Business Continuity Plan (planned)** — Devon co-author; CEO approval at commencement; this procedure is the FX-spot-specific BCP chapter.
- **`Procedures/markets/pre-licence-go-live-gate.md` (PROC-MK-PLG-01) Step 3.f** — `GoLiveReadinessConfirmed` cannot fire until "BCP and settlement-failure procedure (PROC-OPS-SFBCP-01) tested". This procedure is the artefact whose existence and end-to-end test the gate awaits.
- **ISDA 2002 Master Agreement §6** — Events of Default and Termination Events; close-out netting is the primary legal remedy for counterparty settlement failure.

The obligation chain:

```
Regulation (Banks Act Reg 39 — settlement BCP; SARB PA GN 5/2013 — FX settlement risk;
            BCBS d226 — FX settlement risk supervisory guidance; ISDA 2002 — close-out netting)
  → Policies/trading-mandate-v1.md §6 — FX Settlement Risk Framework
  → PROC-OPS-SFBCP-01 (this procedure)
    → @platform/operations/settlement-monitor (PLANNED)
      → FxSettlementFailed / SettlementFailureClassified / SettlementFailureResolved events
```

**Herstatt risk definition.** The bank delivers one leg of an FX transaction (e.g. sells EUR; ZAR is debited from the ZAR nostro) but the counterparty fails to deliver the other leg (EUR is never received). Named after Bankhaus Herstatt, which failed in 1974 mid-settlement. Exposure = full notional of the undelivered leg. **In FX-spot the dominant axis is Herstatt risk** because bilateral T+2 settlement means the pay leg can be released before the receive leg lands — Helena's scope review (`2026-05-20_helena_fx-spot-only-market-risk-scope-review.md` §3) names settlement risk as the single largest residual exposure under the controlled-launch posture.

**Indirect-participant posture.** Per `project_indirect_participant_posture.md` the bank is an **indirect** CLS / SAMOS participant — it accesses settlement infrastructure via its named primary correspondent (Standard Bank) and reserve correspondents. The settlement-failure response runs through the correspondent's protocols and bilateral counterparty escalation. **The bank does not invoke CLS member-default cascades directly** — those run inside Standard Bank's CLS account. Our recovery levers are: (a) instructions to the correspondent (nostro hold, payment recall where in-flight); (b) bilateral counterparty notice (ISDA §6 path); (c) regulator notification.

**RTO:** Nostro position clarified within 4 hours of failure detection; ISDA §6 close-out notice filed within 24 hours.
**RPO:** No trade or settlement data loss — the event log is immutable (Principle 1).

**Build-phase posture:** No live trades. BCP procedure is rehearsed annually against synthetic failure scenarios. Rehearsal produces a `BcpRehearsalCompleted` event with findings. **First live use** is gated by `PROC-MK-PLG-01` Step 3.f end-to-end test.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act 94 (Reg 39) | Banks must maintain documented BCP procedures for settlement failures and Herstatt-risk scenarios; procedures must be tested at least annually; material failures generate Reg 39 capital-cell entries (separate return generator, out of scope for this procedure). |
| SARB PA Guidance Note 5 of 2013 — FX Settlement Risk | Foreign exchange settlement-risk discipline; Herstatt-risk management; intraday-exposure measurement and reporting. Confirmed in-force under PA G1/2024 catalogue-reset. `[citation: TBC — precise §§ on intraday exposure measurement; Imani + external counsel ratify at the licence-application gate]`. |
| BCBS d226 — Supervisory Guidance for Managing Settlement Risk in FX (Feb 2013) | Seven-principle framework for FX settlement risk; specific guidance on bilateral PvP, intraday exposure, contingency planning. Read alongside PA GN 5/2013 per `Policies/trading-mandate-v1.md §6.1`. |
| ISDA 2002 Master Agreement §6 | Event of Default (including payment failure) triggers the non-defaulting party's right to designate an Early Termination Date and calculate the close-out amount under the agreed close-out netting methodology. |
| PA Joint Standard 2 of 2024 | Prudential Authority + FSCA cyber/operational resilience standard; settlement-failure incidents intersect with the IBS taxonomy — Imani's incident log records the IBS-impact assessment if applicable. |
| SARB FinSurv (regulatory notification) | Material settlement failures (above regulatory thresholds — Zara (Chief Compliance Officer, governance) maintains the current threshold table) must be reported to SARB FinSurv; FSCA notification required if conduct concerns arise. |
| POPIA s.19–22 | If settlement failure exposes client data, POPIA breach notification procedures apply (Iris (Information Officer, governance) routes to `popia-breach-notification.md`). |

## 3. Purpose

1. Define the bank's immediate response to FX settlement failure (Herstatt-risk scenario): **classification, detection, position freeze, counterparty notification, and funding hold**.
2. Distinguish the three failure-classification cases — *one-leg-delivered* (Herstatt-active), *neither-delivered* (mutual fail), *operational-delay* (both legs late but in-flight) — and prescribe the differentiated response chain for each.
3. Prescribe the escalation path from Tomas (first response) through Devon (COO) to Helena (CRO) and Marc (CEO) based on exposure size and classification.
4. Define the recovery pathway: ISDA §6 close-out netting claim (Imani), funding contingency (Devon + Bea), and cancel-and-rebook authority (Marc above ZAR 1m gross fail).
5. Establish a defined RTO (nostro clarified within 4 hours) and RPO (zero data loss via immutable event log).
6. Ensure regulatory notification obligations are met where the failure is material (Zara (CCO) routes SARB FinSurv / FSCA filings).

## 4. Trigger events

The procedure activates on detection of a settlement failure. Trigger events:

| Event | Status | Purpose |
|---|---|---|
| `FxSettlementInstructed` | **PLANNED — substrate gap** (see §6) | Pre-cutoff instruction sent to correspondent. The event log of `FxSettlementInstructed`s drives the expected-receipt list against which detection runs. |
| `FxSettlementFailed` | **PLANNED — substrate gap** (see §6; flagged in Helena's scope review §6 G-8 sub-gap and `Policies/trading-mandate-v1.md §6.3` settlement-failure incident protocol row) | Emitted when the correspondent reports the expected payment has not been received by the settlement cut-off + tolerance. Carries: `failureId`, `tradeId`, `counterpartyId`, `correspondentId`, `failedLeg`, `nostroBalance`, `correspondentRef`, `detectedAt`, `classification` (preliminary). |
| `FxSettlementConfirmed` | **LIVE** (`prototype/platform/event-store/event-types/fx-accounting.ts`) | Successful settlement — closes the expected-receipt entry. Detection runs only over open (instructed-but-unconfirmed) entries. |
| `MissedExpectedReceipt` | **PLANNED — substrate gap** (see §6) | Pay leg delivered, receive leg not landed by cutoff + tolerance. Generic version of `FxSettlementFailed` for the early-warning class; classification step (§5 step 2) determines whether to escalate to a typed `FxSettlementFailed` event. |
| `BcpRehearsalTriggered` | **PLANNED** | Annual BCP test scheduler. Carries `{ scenario: 'HerstattActive' \| 'MutualFail' \| 'OperationalDelay', testDate }`. |

Until `FxSettlementFailed` and `MissedExpectedReceipt` are added to the event-store schema (separate brief — Atlas (Core banking platform architect)), the substrate cannot emit typed events for failures. **During build-phase the procedure operates against synthetic test events**; first-live use is blocked at `PROC-MK-PLG-01` Step 3.f.

## 5. Steps

Default actor is `agent` (Principle 6). `human` actors are named where the law or the policy requires human accountability (Devon's classification co-sign; CEO sign-off above threshold).

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Detection.** Automated check against the correspondent settlement feed at cut-off + 30 min for each open `FxSettlementInstructed` event with no matching `FxSettlementConfirmed`. Emits `MissedExpectedReceipt { instructionId, tradeId, counterpartyId, expectedLeg, detectedAt, toleranceMinutes }` for each unmatched instruction. | `agent` (settlement-monitoring substrate) | `@platform/operations/settlement-monitor` (PLANNED) | Detection cadence is per-currency-pair value-date cut-off — USD market 16:00 ET; EUR market 15:00 CET; GBP market 16:00 BST; ZAR cycles per SARB SAMOS windows. Tolerance ≤ 30 min; Helena sets per-pair tolerance in the limit register. No delay is acceptable beyond tolerance — Herstatt exposure is uncapped until the position is frozen. |
| 2 | **Classification.** Within 15 min of detection, classify the failure as one of: (a) **Herstatt-active** — pay leg delivered, receive leg failed (highest severity; full undelivered notional at risk); (b) **Mutual fail** — neither leg has settled (no principal at risk; counterparty fault diagnosis only); (c) **Operational delay** — both legs in-flight, one provisionally late but expected to land. Emit `SettlementFailureClassified { failureId, classification, classifiedAt, classifiedBy }`. Herstatt-active classifications **require Devon (COO) co-sign** — Devon's positive classification authority. | `agent` + `human` (Devon co-signs Herstatt-active classification) | `@platform/operations/settlement-monitor` (PLANNED) | Herstatt-active is the highest-severity classification — drives the rest of the chain. Operational-delay classifications do not freeze the counterparty; they re-arm detection at cut-off + tolerance + 1 hour. Mutual-fail proceeds to step 5 but skips step 3 (no nostro funding to hold). |
| 3 | **Nostro funding hold (Herstatt-active only).** Tomas (Operations & Payments Engineer) instructs the correspondent bank to hold any not-yet-released nostro funding for the failing leg — do not release counter-currency until the position is resolved. Where the pay leg has already debited (the Herstatt-active root case), attempt a SWIFT MT192 payment-recall request to the correspondent; record the recall reference. Emit `NostroFundingHeld { failureId, nostroId, heldAmount, currency, correspondentRef, heldAt }`. | `human` (Tomas — Operations & Payments Engineer) | `@platform/operations/swift-gateway` (PLANNED) | MT192 recall success is best-effort and unlikely once funds have entered the receive-side correspondent's books; treated as recovery, not control. The nostro funding hold prevents the bank from delivering both legs of a future trade with the same failing counterparty (compounded Herstatt). |
| 4 | **Position freeze.** Tomas (with Saskia — Chief Markets Officer — informed) freezes all open positions and instruction flows with the failing counterparty: (a) no new trades may be submitted (mandate-registry counterparty flag set to `frozen`); (b) all pending settlement instructions to this counterparty are placed on hold; (c) the dealing desk is alerted (Saskia's surveillance feed). Emit `CounterpartyPositionFrozen { failureId, counterpartyId, frozenAt, frozenBy }`. | `human` (Tomas + Saskia) | `@platform/markets/counterparty-registry` (PLANNED) | Position freeze is immediate and unconditional — Tomas has standing authority under the BCP. Saskia is informed and may add desk-side context (e.g. the counterparty's voice-of-desk communications today). |
| 5 | **Counterparty escalation.** Outbound formal notice to counterparty operations and dealing desk: (a) identifies the undelivered leg by `tradeId` and settlement date; (b) demands confirmation of leg status and delivery within 2 hours of notice; (c) reserves the right to declare an Event of Default under ISDA 2002 §6 if delivery is not made. Sent by Tomas via SWIFT MT199 with Saskia (or her named delegate) executing the dealing-desk voice channel. Inbound responses are captured by emitting a `CorrespondenceLogged` event per inbound (per `PROC-FIN-CORR-01` if live, otherwise as a free-form correspondence record). Imani (Chief Legal Counsel, governance) reviews notice content for ISDA §6 compliance time-permitting. | `human` (Tomas + Saskia + Imani review) | `@platform/legal/isda-registry` (PLANNED) + correspondent SWIFT channel | Notification is sent via SWIFT MT199 or email (per ISDA notice provisions). Document inbound responses — they form the evidentiary basis for the close-out claim. The 2-hour demand window is the policy default; Imani can extend if there is a force-majeure indication from the counterparty. |
| 6 | **Devon (COO) incident command.** Tomas notifies Devon within 15 min of detection; Devon reviews the exposure assessment and activates the BCP incident log; Devon assumes incident command from this point. Emit `IncidentActivated { incidentId, failureId, activatedBy: Devon, activatedAt, incidentClass: 'FX-SettlementFailure' }`. | `human` (Devon — Chief Operating Officer, governance) | `@platform/governance/incident-log` (PLANNED) | Devon's incident command includes: daily situation briefings, coordination across Tomas/Helena/Imani/Saskia/Zara/Bea, and CEO updates. Devon is also the named CMT chair under `PROC-OR-CMA-01` and assesses whether the failure constitutes a crisis-management activation trigger (it does at higher exposure levels — see §7). |
| 7 | **Helena (CRO) risk re-mark.** Devon notifies Helena within 15 min of detection; Helena assesses: (a) exposure quantum (full notional of undelivered leg for Herstatt-active); (b) market re-mark on the surviving leg (the receive-leg currency moved against us since trade date — Helena computes mark-to-market loss on top of the principal at risk); (c) impact on bank's capital ratios (Reg 39 settlement-risk capital cell); (d) whether the B-cluster RAS lines L-B8a-1 to L-B8a-5 are breached; (e) portfolio correlation effects across counterparties sharing the failing correspondent. Helena's PR #634 controlled-launch compensating control fires here for B-cluster concentration. Emit `SettlementFailureRiskAssessment { failureId, exposureZar, markToMarketLossZar, capitalImpactBps, rasBreached, correlationRisk, assessedAt }`. | `human` (Helena — Chief Risk Officer, governance) | `@platform/risk/var-engine` + risk judgment | The market re-mark step is what makes settlement risk *market-risk-adjacent* (not pure credit) — the bank's loss in a Herstatt-active failure has two components: principal (full notional) + market move (FX rate drift since trade date). Helena's PR #634 controlled-launch concentration control re-evaluates whether the surviving FX-spot positions on adjacent counterparties remain inside the B-cluster envelope after this failure removes one node from the netting set. |
| 8 | **Credit re-classification (Imani-led).** Imani (Chief Legal Counsel, governance) re-evaluates: (a) ISDA netting-set membership of the failing counterparty — does this failure trigger cross-default under any other Master Agreement with the same group? (b) the netting set's SA-CCR replacement-cost path — Rohan (Market risk quantitative engineer) is consulted if the netting set has live derivatives in addition to FX-spot. Emit `CounterpartyCreditReclassified { failureId, counterpartyId, oldRating, newRating, cascadeMatched, reclassifiedAt }` if rating shift required. | `human` (Imani + Rohan consult) | `@platform/legal/netting-set-registry` + `@platform/risk/sa-ccr-engine` | Cross-default cascade is the most dangerous downstream — a Herstatt-active failure with a major counterparty can trigger ISDA cross-default with the same group across other Master Agreements. Imani's check here is the bank's defence against being caught in another counterparty's cascade. |
| 9 | **CEO notification (Devon → Marc).** If any of: (a) exposure > ZAR 50m; (b) Helena flags RAS breach regardless of amount; (c) cross-default cascade detected by Imani: Devon notifies Marc (CEO) immediately. Marc may authorise emergency capital actions, counterparty relationship decisions, or invoke the recovery plan. Marc's decisions are logged via `recordDecision` with `category: 'SettlementBCP'`. | `human` (Devon → Marc — CEO) | `@platform/decisions` | CEO notification is mandatory at the R50m threshold. At ≥ ZAR 1m gross fail, the cancel-and-rebook authority threshold of step 12 also applies. |
| 10 | **ISDA §6 close-out notice (Imani).** If counterparty fails to deliver within 2 hours of the formal notice of step 5: Imani prepares the §6 Event of Default notice; designates an Early Termination Date; calculates the close-out amount under the agreed methodology (Loss or Market Quotation per the Master Agreement Schedule); files the close-out claim. Emit `IsdaCloseOutNoticeIssued { failureId, counterpartyId, terminationDate, closeOutAmount, methodology, issuedBy: Imani, issuedAt }`. | `agent` (Imani — Chief Legal Counsel, governance) | `@platform/legal/isda-registry` (PLANNED) | ISDA close-out is the primary legal remedy. The §6 notice must be filed within 24 hours of the counterparty's payment failure (per RTO). Disputed close-out triggers Imani's litigation track (separate, out of scope for this procedure). |
| 11 | **Devon funding contingency.** If nostro funding is required to cover the bank's side of the settlement while the claim is pursued: Devon activates the liquidity contingency plan — draws on the bank's liquidity buffer or interbank line with the correspondent; ensures the bank's obligations to other counterparties are not impacted. Joint authorisation Devon + Bea (Financial-reporting engineer) required for draws > ZAR 10m; Marc informed for draws > ZAR 50m. Emit `LiquidityContingencyDrawn { failureId, amountZar, source, drawnAt }`. | `human` (Devon + Bea joint auth) | `@platform/finance/liquidity-monitor` (PLANNED) | The contingency draw is bounded by the liquidity buffer's `EncumberedAmount` budget — Eitan (Treasury & ALM engineer) maintains the buffer's available headroom under the LCR/NSFR framework. |
| 12 | **Cancel-and-rebook decision (Marc above ZAR 1m gross fail).** Where the failed leg gross-notional exceeds **ZAR 1m**, and the counterparty has not delivered within the 2-hour formal-notice window of step 5, Marc (CEO) decides whether to: (a) cancel the trade and re-book with an alternate counterparty (preserves trading position; recovery via close-out claim); (b) hold and proceed with ISDA §6 close-out only; (c) bilateral commercial settlement (mutual cancellation, no §6). Marc's decision is recorded via `recordDecision` with `category: 'SettlementBCP'`, `authority: 'CEO'`. **Below ZAR 1m gross fail, Devon decides** under the standing BCP authority. | `human` (Marc CEO above ZAR 1m; Devon below) | `@platform/decisions` | The ZAR 1m threshold is a starting recommendation set in this initial version; Helena and Devon may calibrate at the pre-licence go-live readiness gate. Above the threshold, the trade re-book may involve significant market-move slippage (the FX market has moved during the 2-hour notice window) — Marc judges this against the close-out remedy alone. |
| 13 | **Regulatory notification (Zara).** If the settlement failure is material (Zara — Chief Compliance Officer, governance — maintains the current SARB FinSurv threshold table; default = exposure > ZAR 10m OR counterparty default is a public event OR PA-reportable IBS-impacted): Zara prepares the SARB FinSurv notification and the FSCA notification if conduct concerns arise; Owen (Company Secretary, governance) co-reviews; notification filed within 24 hours. POPIA breach notification (Iris — Information Officer, governance) fires only if client data is exposed. Emit `RegulatoryNotificationFiled { failureId, regulator, filedAt, filedBy: Zara }`. | `human` (Zara + Owen co-review) | `@regulatory/sarb-finsurv` + `@regulatory/fsca` (PLANNED) | Zara owns the regulatory-notification pathway; she escalates to PA prudential-supervision relationship if the exposure threatens capital ratios. FSCA is notified only if there is a conduct or market-conduct concern (e.g. counterparty failure is the public event-side of a market-abuse investigation). |
| 14 | **Recovery — delayed-settle vs cancel-and-rebook (Tomas).** Tomas drives the operational recovery per Marc/Devon's step-12 decision: (a) delayed-settle — Tomas works with the counterparty's operations to settle the trade on a later value date once the failure is resolved; (b) cancel-and-rebook — Tomas books the cancellation, books the replacement trade with the alternate counterparty (Saskia approves the alternate), updates the netting sets. Emit `SettlementFailureRecoveryAttempted { failureId, recoveryPath, attemptedAt }` and `SettlementFailureResolved { failureId, resolution: 'Delivered' \| 'CloseOutSettled' \| 'CancelledAndRebooked' \| 'CloseOutDisputed', finalExposureZar, resolvedAt, resolvedBy: Devon }`. Position freeze lifted; nostro funding released; incident log closed. | `human` (Tomas operational; Devon sign-off on `SettlementFailureResolved`) | `@platform/event-store` | `SettlementFailureResolved` is the canonical close event for the BCP incident. Any disputed close-out remains open under Imani's litigation track; the BCP incident is resolved but the legal claim is tracked separately. |
| 15 | **Post-incident review.** Within 5 business days of resolution: Devon chairs the post-incident review; Tomas documents root cause; Helena documents risk lessons; Zara documents regulatory-reporting compliance; Imani documents legal/contract lessons. Findings emitted as `PostIncidentReviewCompleted { failureId, rootCause, lessonsLearned, procedureChanges, reviewedAt }`. Material procedure changes are filed as Decision events. | `human` (Devon + Tomas + Helena + Zara + Imani) | `@platform/governance/incident-log` (PLANNED) | Post-incident review feeds: (a) annual BCP rehearsal design (next year's scenario), (b) Helena's quarterly market-risk report, (c) Owen's CAB pack if procedure changes proposed, (d) Vera (internal audit engineer, governance) substrate's post-incident review register. |
| 16 | **Annual BCP rehearsal.** On `BcpRehearsalTriggered { scenario }`: Devon co-ordinates a full rehearsal of this procedure against the synthetic scenario; rehearsal must complete steps 1–14 in simulation; findings documented; emit `BcpRehearsalCompleted { scenario, findingsCount, procedureChangesRequired, completedAt }`. **The first BCP rehearsal is the artefact that lights green on `PROC-MK-PLG-01` Step 3.f.** | `human` (Devon + Tomas + Helena + Imani + Saskia + Zara) | Various (rehearsal stitches together all listed PLANNED capabilities in synthetic mode) | Annual rehearsal is a Banks Act Reg 39 BCP requirement. Rehearsal must be completed within 30 days of `BcpRehearsalTriggered`. The first rehearsal cycles all three classification scenarios (Herstatt-active, mutual-fail, operational-delay) — required by `PROC-MK-PLG-01` end-to-end test gate. |

## 6. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Devon (Chief Operating Officer, governance) — **owner** | Procedure owner; classification co-sign for Herstatt-active; incident command from step 6; resolution event; CEO escalation; funding contingency; post-incident review chair |
| Helena (Chief Risk Officer, governance) — **co-sign** | Risk assessment (step 7); RAS B8a breach determination; capital-impact estimate; controlled-launch compensating control invocation (PR #634); CEO escalation trigger |
| Imani (Chief Legal Counsel, governance) — **co-sign** | ISDA §6 close-out notice (step 10); credit re-classification (step 8) including cross-default cascade check; legal proceedings if disputed |
| Saskia (Chief Markets Officer, governance) — **co-sign** | Desk-side counterparty escalation (step 5 voice channel); approval of alternate counterparty in cancel-and-rebook (step 14); surveillance-feed alert |
| Zara (Chief Compliance Officer, governance) — **co-sign** | Regulatory-notification pathway (step 13); SARB FinSurv / FSCA / PA prudential filings; threshold-table maintenance |
| Tomas (Operations & Payments Engineer) | First response; detection (step 1) handling; nostro funding hold (step 3); position freeze (step 4); counterparty SWIFT MT199 notice (step 5); operational recovery (step 14) |
| Bea (Financial-reporting engineer) | GL entries for close-out; liquidity-contingency draw joint auth with Devon (step 11) |
| Owen (Company Secretary, governance) | Co-review of regulatory notifications (step 13); CAB pack entry for procedure changes |
| Iris (Information Officer, governance) | POPIA breach pathway only if client data exposed (out of mainline; routes via `popia-breach-notification.md`) |
| Marc (CEO) | Notification + decision at > ZAR 50m exposure; cancel-and-rebook authority above ZAR 1m gross fail (step 12); emergency capital / recovery-plan invocation |
| Vera (internal audit engineer, governance) | Independent post-hoc audit of incident handling against this procedure; recon pipeline (see §9) |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| `MissedExpectedReceipt` emitted | Settlement-monitor → Tomas | Immediate (auto-alert) |
| Herstatt-active classification | Tomas → Devon (co-sign required); Helena + Saskia + Imani notified | Within 15 min of detection |
| Counterparty fails to deliver within 2 h of formal notice (step 5) | Tomas → Imani; ISDA §6 notice (step 10) | At 2 h from notice |
| Exposure > ZAR 50m | Devon → Marc (CEO) | Immediate |
| Cross-default cascade detected (step 8) | Imani → Devon → Marc | Immediate |
| RAS B8a breach (regardless of amount) | Helena → Devon → Marc | Immediate |
| Cancel-and-rebook decision required > ZAR 1m gross fail | Devon → Marc (CEO authority) | Within step-12 window |
| Nostro funding required > ZAR 10m | Devon + Bea joint authorisation | Before draw |
| Nostro funding required > ZAR 50m | Devon + Bea + Marc | Before draw |
| Regulatory notification material (Zara threshold) | Zara + Owen → SARB FinSurv (and FSCA if conduct) | Within 24 hours |
| Client data exposed | Iris → POPIA breach pathway (`popia-breach-notification.md`) | Per POPIA s.22 timing |
| Close-out disputed by counterparty | Imani litigation; Helena + Devon strategy | Per dispute timeline |
| Annual BCP rehearsal not completed in time | Devon → Marc; Vera finding raised | Day 31 |
| Pre-licence go-live gate not closing on Step 3.f | Devon → Marc; readiness-gate Decision card | Pre-licence window |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/operations/settlement-monitor` | **PLANNED — substrate gap** | Nostro monitoring; expected-receipt list against open `FxSettlementInstructed`s; failure detection; settlement-window tracking. Owner: Tomas; Atlas + Anya (Platform & data engineer) for the schema + subscriber wiring. **Separate engineering brief required.** |
| `FxSettlementInstructed` event type | **PLANNED — substrate gap** | Not currently in `prototype/platform/event-store/event-types/fx-accounting.ts`. Required as the input to detection (step 1). |
| `FxSettlementFailed` event type | **PLANNED — substrate gap** (Helena scope review §6 G-8 sub-gap; trading-mandate §6.3 settlement-failure protocol row) | Not currently in `prototype/platform/event-store/event-types/fx-accounting.ts`. The procedure references this event throughout; the recon pipeline cannot assert the control until the event exists. **Separate substrate brief (Atlas — Core banking platform architect).** Out of scope for this procedure-authoring brief. |
| `FxSettlementConfirmed` event type | **LIVE** | At `prototype/platform/event-store/event-types/fx-accounting.ts`. Drives detection (step 1) — open `FxSettlementInstructed`s without a matching `FxSettlementConfirmed` after cut-off + tolerance trigger the procedure. |
| `MissedExpectedReceipt` event type | **PLANNED — substrate gap** | The early-warning event before formal classification to `FxSettlementFailed`. |
| `SettlementFailureClassified` event type | **PLANNED — substrate gap** | Required for step 2 classification record. |
| `@platform/operations/swift-gateway` | **PLANNED** | SWIFT MT195 query, MT192 recall, MT199 free-format notice; nostro statement ingest. |
| `@platform/markets/counterparty-registry` | **PLANNED** | Position freeze enforcement (step 4); counterparty `frozen` flag. |
| `@platform/legal/isda-registry` | **PLANNED** | ISDA §6 notice preparation; close-out calculation; netting-set cross-default check (step 8). |
| `@platform/legal/netting-set-registry` | **PARTIAL** | Netting-set register exists per `D-CREDIT-LIMIT-ENGINE-BUILD`. SA-CCR replacement-cost path lives in `@platform/risk/sa-ccr-engine`. Cross-default cascade check (step 8) is a query against both. |
| `@platform/governance/incident-log` | **PLANNED** | BCP incident activation (step 6); post-incident review register (step 15). |
| `@platform/finance/liquidity-monitor` | **PLANNED** | Liquidity-buffer monitoring; contingency-draw authorisation gate (step 11). |
| `@platform/risk/var-engine` | **LIVE** | Helena uses for the market re-mark on the surviving leg (step 7). |
| `@platform/risk/sa-ccr-engine` | **LIVE** (per PR #624) | Imani's credit re-classification check (step 8) for derivative netting sets. |
| `@regulatory/sarb-finsurv` | **PLANNED** | Zara material-failure regulatory notification (step 13). |
| `@regulatory/fsca` | **PLANNED** | Zara FSCA notification (step 13) if conduct concerns arise. |
| `@platform/decisions` | **LIVE** | Marc's cancel-and-rebook decisions (step 12); `recordDecision` framework. |
| `@platform/event-store` | **LIVE** | Immutable settlement-failure event log; RPO = zero. |

**Substrate gap inventory (flagged for separate briefs):**

1. **`FxSettlementFailed` event type** — Atlas owns; out of scope per this brief; required before first live use of this procedure.
2. **`FxSettlementInstructed` event type** — Atlas owns; required to populate the open-instruction list against which detection runs.
3. **`MissedExpectedReceipt` event type** — Atlas owns; early-warning class.
4. **`SettlementFailureClassified` event type** — Atlas owns; carries the classification record.
5. **`@platform/operations/settlement-monitor` subscriber** — Tomas + Atlas + Anya own; subscribes to instruction + confirmed feeds; emits the missed-receipt and failed events.
6. **Banks Act Reg 39 settlement-risk return generator** — Bea + Camille (Chief Financial Officer, governance) own; populates the Reg 39 capital cell from `SettlementFailureRiskAssessment` events. Out of scope per this brief.
7. **End-to-end test of this procedure** — Devon owns; required to satisfy `PROC-MK-PLG-01` Step 3.f. Separate readiness-gate item.

## 9. Quality controls

- **RTO compliance.** Nostro position clarified within 4 hours of detection. Devon monitors per-incident; breach is a CEO-notified incident. Vera (internal audit engineer, governance) recon pipeline `recon:settlement-failure-rto` asserts the 4-hour bound across all `FxSettlementFailed → SettlementFailureResolved` pairs.
- **RPO compliance.** All settlement events in the immutable event log. Vera asserts daily that no `FxSettlementInstructed` is missing a matched `FxSettlementConfirmed` OR `FxSettlementFailed` after value-date + cut-off + 24 h.
- **Position-freeze timing.** Position freeze must be in place within 15 minutes of detection. Vera asserts the `CounterpartyPositionFrozen.frozenAt − MissedExpectedReceipt.detectedAt` invariant ≤ 15 min for Herstatt-active classifications.
- **ISDA §6 notice timing.** Close-out notice must be filed within 24 hours of counterparty payment failure (per RTO). Vera asserts `IsdaCloseOutNoticeIssued.issuedAt − MissedExpectedReceipt.detectedAt` ≤ 24 h where a §6 notice was issued.
- **Resolution invariant.** Every `FxSettlementFailed` must have a downstream `SettlementFailureResolved`. Vera asserts this invariant continuously.
- **Annual rehearsal.** Vera asserts that `BcpRehearsalCompleted` events exist at the required annual cadence (per Banks Act Reg 39) and that each rehearsal exercised all three classifications.
- **Classification-co-sign invariant.** Every `SettlementFailureClassified` with `classification: 'HerstattActive'` must be co-signed by Devon (carries `classifiedBy: 'devon'` or a `coSignedBy` field containing Devon). Vera asserts this invariant.
- **Threshold-decision invariant.** Every cancel-and-rebook above ZAR 1m gross fail must have a corresponding `recordDecision` with `authority: 'CEO'`. Vera asserts this invariant.

**Vera recon pathway.** The recon pipelines listed above (`recon:settlement-failure-rto`, `recon:settlement-failure-resolution-pairing`, `recon:settlement-failure-classification-cosign`) are flagged as a **substrate gap** for Vera Wave-4 once the underlying events land. Until then, Vera audits via post-incident-review documents and the rehearsal records.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `FxSettlementInstructed` | Event log (planned) | Permanent | Detection input. |
| `MissedExpectedReceipt` | Event log (planned) | Permanent | Early-warning record. |
| `SettlementFailureClassified` | Event log (planned) | Permanent | Classification + Devon co-sign for Herstatt-active. |
| `FxSettlementFailed` | Event log (planned) | Permanent | Primary failure record. |
| `CounterpartyPositionFrozen` | Event log (planned) | Permanent | Step 4 freeze record. |
| `NostroFundingHeld` | Event log (planned) | Permanent | Step 3 funding hold record. |
| `IncidentActivated` | Event log (planned) | Permanent | Devon BCP incident command activation. |
| `SettlementFailureRiskAssessment` | Event log (planned) | Permanent | Helena (CRO) risk assessment + market re-mark. |
| `CounterpartyCreditReclassified` | Event log (planned) | Permanent | Imani's credit re-classification + cross-default check. |
| `IsdaCloseOutNoticeIssued` | Event log (planned) | Permanent | Legal close-out record. |
| `LiquidityContingencyDrawn` | Event log (planned) | Permanent | Devon + Bea funding draw. |
| `recordDecision { category: 'SettlementBCP', authority: 'CEO' }` | Decisions register | Permanent | Marc's cancel-and-rebook decisions above ZAR 1m. |
| `RegulatoryNotificationFiled` | Event log + doc store (BLAKE3) | 7 years | SARB FinSurv / FSCA / PA filings (Zara + Owen co-review). |
| `SettlementFailureRecoveryAttempted` | Event log (planned) | Permanent | Step 14 recovery attempt record. |
| `SettlementFailureResolved` | Event log (planned) | Permanent | Resolution record — closes the incident. |
| `CorrespondenceLogged` (counterparty inbound) | Event log (PROC-FIN-CORR-01 planned) + RMS document register | 7 years | Inbound notice responses; evidentiary basis for close-out. |
| `PostIncidentReviewCompleted` | Event log (planned) | 7 years | Post-incident learning record. |
| `BcpRehearsalCompleted` | Event log (planned) | 7 years | Annual rehearsal record. |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Tomas + Devon + Helena | Initial POPULATED — generic 13-step BCP; position freeze, nostro hold, counterparty notification, Devon incident command, Helena CRO assessment, CEO escalation > R50m, Imani ISDA §6 close-out, Devon funding contingency, Mira regulatory notification, resolution event; RTO 4h / RPO zero; annual rehearsal; ISDA 2002 + Banks Act Reg 39 sourcing. |
| v0.2 | 2026-05-20 | Devon + Helena + Imani + Saskia + Rashida (per `brief:devon:g-8-close-fx-settlement-failure-procedure-proc-o:2026-05-20`) | **G-8 close (Helena scope review §6) — FX-spot-focused refinement.** Added: (a) three-class classification scheme (Herstatt-active / mutual-fail / operational-delay) with Devon co-sign on Herstatt-active; (b) Saskia + Rashida as named co-signers; (c) FX-typed event names (`FxSettlementInstructed`, `FxSettlementFailed`, `MissedExpectedReceipt`, `SettlementFailureClassified`) flagged as substrate gaps in §8; (d) ZAR 1m gross-fail cancel-and-rebook threshold for CEO authority; (e) market re-mark step (Herstatt failures are market-risk-adjacent, not pure credit); (f) cross-default cascade check (Imani step 8); (g) Helena PR #634 controlled-launch compensating control invocation; (h) explicit indirect-CLS posture per `project_indirect_participant_posture`; (i) BCBS d226 + SARB PA GN 5/2013 citations; (j) link to `PROC-MK-PLG-01` Step 3.f as first-live-use gate. Switched from prior Mira/Owen-only regulatory pathway to Rashida-led with Owen co-review. |
| v0.3 | 2026-05-20 | Owen (Company Secretary, governance) | **CCO seat reconciliation.** Per `Team/_team-roster.json` canonical roster, the CCO seat (Chief Compliance Officer, governance) is held by **Zara**, not Rashida (who holds the CISO seat). Replaced "Rashida" with "Zara" wherever the reference is to the CCO authority for SARB FinSurv / FSCA / PA prudential filings, the regulatory-notification pathway (step 13), the threshold table, the post-incident review compliance-reporting documentation, the BCP-rehearsal co-sign, and the regulatory-platform notes (steps 13, 15, 16 and the §7/§8/§10/§11 tables). The v0.2 change-log entry retains "Rashida" as the historical author of record per Principle 1 (event/authorship history is immutable). |
