---
policy-parent: Policies/margin-policy-v1.md · Policies/im-methodology-policy-v1.md
last-reviewed: 2026-05-16
procedureId: PROC-MK-ODP-04
title: Initial Margin — SIMM-aligned calculation, exchange, and segregation (phased)
author: Kai (Trading systems engineer, engineering) · Tomas (Operations engineer, engineering)
date: 2026-05-16
owner: Ravi (ALM quant engineer, engineering) · Rohan (Market risk quant engineer, engineering) · Eitan (Treasurer) · Imani (Legal-as-code engineer, engineering)
status: POPULATED
policy-cited: Policies/margin-policy-v1.md · Policies/im-methodology-policy-v1.md
system-capability: prototype/platform/risk/im-simm (PLANNED)
---

# Procedure — Initial Margin (SIMM-Aligned, Phased, Per-Counterparty)

**Procedure ID:** PROC-MK-ODP-04
**Owner:** Ravi (ALM quant engineer, engineering) · Rohan (Market risk quant engineer, engineering) · Eitan (Treasurer) · Imani (Legal-as-code engineer, engineering)
**Approval:** ALCO + BRC (Margin Policy + IM Methodology Policy)
**Cadence:** Per-trade IM at execution; daily IM recompute on MTM change; quarterly group-notional reassessment
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

---

## 1. Source policy

- `Policies/margin-policy-v1.md` — Margin Policy (PLANNED, sub-policy of Risk Management Framework)
- `Policies/im-methodology-policy-v1.md` — IM Methodology Policy (PLANNED)

The obligation chain is:

```
Regulation (Joint Standard JS 2/2020 §5 + BCBS-IOSCO UMR Phase 6)
  → Margin Policy + IM Methodology Policy
    → PROC-MK-ODP-04 (this procedure)
      → @risk/im-simm (PLANNED)
      → @treasury/collateral-segregation (PLANNED)
```

The Margin Policy mandates IM calculation and exchange for in-scope counterparty pairs using the ISDA SIMM (Standard Initial Margin Model) methodology or a conservative schedule-based fallback. The IM Methodology Policy governs SIMM model governance (independent validation, sensitivity sourcing, backtesting). IM is always segregated at a third-party custodian and is not rehypothecatable. Phased applicability: the bank enters scope when its group average aggregate notional (GAANE) exceeds the applicable JS 2/2020 phase-in threshold (Phase 6 threshold: approximately ZAR 100bn, or EUR 8bn equivalent).

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-JS2-002` (JS 2/2020 §5) | Calculate and exchange IM for non-centrally cleared OTC derivatives where both counterparties are above the applicable GAANE threshold. Exchange is two-way. |
| `ORG-JS2-003` (JS 2/2020 §6) | Eligible IM collateral: ZAR cash; gold; South African Government Bonds (+ 2022 expansion). Haircuts per the JS 2/2020 schedule apply. |
| `ORG-JS2-005` (JS 2/2020 §3) | Board-approved policies and procedures for IM calculation, exchange, and segregation; SIMM or schedule methodology; independent model validation for SIMM. |
| `ORG-JS2-006` (JS 2/2020 §5(3)) | IM must be held in a segregated account at a third-party custodian; not rehypothecatable; account structure per ISDA Standard Credit Support Annex (SCSA) or equivalent. |
| `ORG-JN2-2024` (JN 2/2024) | IM information reporting to PA Umoja portal: submit daily aggregate IM positions per counterparty, effective 1 April 2025. |

---

## 3. Purpose

The purpose of this procedure is to:

1. Determine, via a quarterly group-notional reassessment, whether each OTC derivative counterparty pair is in scope for bilateral IM under the JS 2/2020 phase-in thresholds.
2. Calculate IM for each in-scope counterparty using the ISDA SIMM methodology (or the schedule-based fallback where SIMM is not mutually agreed), based on risk sensitivities sourced from Rohan's (Market risk quant engineer, engineering) risk engine.
3. Reconcile the IM amount with the counterparty before posting or receiving, resolving any disputes within the 5-business-day window.
4. Post or receive IM in eligible collateral, segregated at a third-party custodian under an ISDA SCSA, in a manner that is not rehypothecatable.
5. Recompute IM daily as the portfolio's risk profile changes, and exchange the difference (IM delta) if it exceeds the MTA.
6. Report daily aggregate IM positions to the PA Umoja portal per JN 2/2024.

---

## 4. Trigger

- **`OtcTradeExecuted { tradeId, counterpartyLei, productClassification, notional, currency, maturity }`** — for in-scope counterparty pairs, triggers per-trade IM calculation at execution.
- **Daily `MarketClose { date }` event** — triggers the daily IM recompute for each in-scope netting set; only the IM delta (change since last exchange) is called if it exceeds the MTA.
- **Quarterly `QuarterEndCloseCompleted { period }` event** — triggers the group-notional reassessment to determine which counterparty pairs remain in or enter scope for the next quarter.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Quarterly group-notional reassessment: aggregate the GAANE (group average aggregate notional) for the bank and each counterparty; determine in-scope status for next quarter | `agent` (Rohan) | `@risk/im-scope` (PLANNED) | GAANE computed over March/April/May preceding the 1 September in-scope determination date, or at the start of each quarter if using a simplified method. Result: a list of in-scope counterparty LEIs for the next quarter. |
| 2 | Emit `IMScopeAssessed { quarter, inScopeCounterparties: [Lei, ...], bankGAANE, assessedAt }` | `system` | `@platform/event-store` | Counterparties newly in scope receive a written notification via Imani (Legal-as-code engineer, engineering). Counterparties exiting scope: IM is returned. |
| 3 | For each in-scope counterparty and each new trade (`OtcTradeExecuted`): compute SIMM IM using risk sensitivities sourced from Rohan's risk engine (delta, vega, curvature by risk class: IR, FX, EQ, CRQ, CRNQ, CM) | `agent` (Rohan) | `@risk/im-simm` (PLANNED) | SIMM methodology per ISDA SIMM v2.7 (or current published version). Where SIMM is not mutually agreed with the counterparty, use the schedule-based fallback per JS 2/2020 Annex B. |
| 4 | Emit `InitialMarginCalculated { nettingSetId, counterpartyLei, im, methodology: SIMM\|schedule, sensitivities: [...], csa, asOf }` | `system` | `@platform/event-store` | Canonical IM calculation record. `sensitivities` is the BLAKE3-addressed sensitivity file used as input to SIMM. |
| 5 | Reconcile IM with counterparty: share SIMM sensitivities via ISDA Margin Arbitration or AcadiaSoft; compare counterparty's IM; if difference > 10% or > ZAR 5m, raise dispute | `agent` (Ravi) | `@settlement/im-comms` (PLANNED) | Reconciliation is bilateral and may take 1–5 BDs. Dispute window: 5 BDs per JS 2/2020 §5(2). |
| 6 | If IM dispute not resolved in 5 BDs: emit `IMDisputeEscalated { nettingSetId, counterpartyLei, bankIM, counterpartyIM, age }` and route to `otc-dispute-resolution.md` | `system` + `agent` (Imani) | `@platform/escalation` (PLANNED) | In the interim, the higher of the two IM amounts is posted pending resolution. Eitan (Treasurer) approves the interim posting. |
| 7 | Instruct third-party custodian to segregate posted IM in the agreed SCSA segregation account; receive custodian confirmation | `agent` (Ravi) | `@treasury/collateral-segregation` (PLANNED) | Segregation arrangements must be established at counterparty onboarding under PROC-MK-COBP-01. Tri-party custody: Clearstream, Euroclear, or local custodian as agreed. IM is not rehypothecatable. |
| 8 | Emit `InitialMarginPosted { nettingSetId, counterpartyLei, amount, currency, collateralType, custodian, segregationAccount, postedAt }` | `system` | `@platform/event-store` | For IM received from the counterparty: emit `InitialMarginReceived { ... }`. |
| 9 | Daily IM recompute (Step 3 repeated at `MarketClose`): calculate new SIMM IM; compute IM delta = new IM − last exchanged IM; if \|delta\| exceeds MTA (aggregate with VM), call or return the delta | `agent` (Rohan) + `system` | `@risk/im-simm` (PLANNED) + `@treasury/margin-engine` (DRAFTING) | Only the delta is exchanged daily, not the full IM. Full IM is reposted on trade execution or significant portfolio change. |
| 10 | Compile daily PA Umoja portal report: aggregate IM posted and received per counterparty; submit to PA portal | `agent` (Tomas) + `agent` (Anya) | `@regulatory/umoja-client` (PLANNED) | Per JN 2/2024, effective 1 April 2025. Filed together with the VM Umoja report (PROC-MK-ODP-03). |
| 11 | On trade termination for an in-scope counterparty: recompute post-termination IM for the remaining netting set; return excess IM to counterparty; update custodian segregation | `agent` (Ravi) | `@risk/im-simm` (PLANNED) + `@treasury/collateral-segregation` (PLANNED) | Residual IM after full portfolio termination = 0; full return of segregated collateral. Confirmed by custodian closure notice. |
| 12 | SIMM model annual independent validation: Helena's (Chief Risk Officer, governance) Tier 1 model-risk regime; validation covers sensitivity sourcing accuracy, SIMM calibration, and backtesting against observed MTM changes | `human` (Helena) + external model validator | — | Required by JS 2/2020 §5 and Helena's model-risk framework. Validation report filed in document store; findings addressed by Rohan within agreed remediation timeline. |

---

## 6. Reconciliation

### Events produced

| Event | Trigger | Key fields |
|---|---|---|
| `IMScopeAssessed` | Step 2 — quarterly | `quarter`, `inScopeCounterparties[]`, `bankGAANE`, `assessedAt` |
| `InitialMarginCalculated` | Step 4 — per trade and daily | `nettingSetId`, `counterpartyLei`, `im`, `methodology`, `sensitivities` (BLAKE3), `asOf` |
| `InitialMarginPosted` | Step 8 — IM posted to custodian | `nettingSetId`, `counterpartyLei`, `amount`, `currency`, `collateralType`, `custodian`, `segregationAccount`, `postedAt` |
| `InitialMarginReceived` | Step 8 — IM received from counterparty | Same fields; `direction: received` |
| `IMDisputeEscalated` | Step 6 — dispute > 5 BDs | `nettingSetId`, `counterpartyLei`, `bankIM`, `counterpartyIM`, `age` |

### Invariants (CI-tested)

1. **Segregation gate:** `∀ InitialMarginPosted(nettingSetId) → ∃ custodian_segregation_confirmation` within T+1. Ravi verifies custodian statements daily; Vera audits the link between `InitialMarginPosted` events and custodian confirmation documents.
2. **No rehypothecation:** IM posted by the bank must reside in a segregated custodian account that is not commingled with the counterparty's assets. Vera asserts no `CollateralRehypothecated` events exist.
3. **Scope gate:** no `InitialMarginPosted` or `InitialMarginReceived` event may exist for a counterparty not listed in the current `IMScopeAssessed.inScopeCounterparties`. If a counterparty exits scope, existing IM is returned.
4. **SIMM model validation currency:** Vera asserts that a current (< 12 months) model-validation report exists in the document store; if the annual validation is overdue, this is a P2 finding escalated to Helena.

### Failure mode

If the SIMM calculation engine fails to produce a daily recompute, Rohan (Market risk quant engineer, engineering) uses the prior-day IM as a placeholder; no delta call is issued on that day. A `SIMMCalculationFailed { nettingSetId, date, reason }` event is emitted and Eitan (Treasurer) is notified. If the failure persists for 2 consecutive days, Helena (Chief Risk Officer, governance) escalates to the BRC and the schedule-based fallback is activated.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `InitialMarginCalculated` events + SIMM sensitivity files (BLAKE3) | Event log + document store | 7 years | Restricted |
| `InitialMarginPosted` / `InitialMarginReceived` events | Event log | 7 years | Restricted |
| Custodian segregation confirmations | Document store (linked from events) | 7 years | Restricted |
| `IMScopeAssessed` quarterly assessments | Event log | 7 years | Restricted |
| SIMM model annual validation report | Document store | 7 years (plus current) | Confidential |
| IM dispute correspondence | Document store + event log | 7 years | Confidential |
| PA Umoja daily IM reports | Document store | 7 years | Restricted |

---

## 8. Manual steps

The following steps require human action or professional judgement in the current substrate:

1. **SIMM sensitivity sourcing review (Step 3):** Although Rohan's risk engine generates sensitivities automatically, Ravi (ALM quant engineer, engineering) reviews the sensitivity file for any new or unusual product types before submitting to SIMM. Novel product sensitivity sourcing is a professional-judgement step.
2. **IM reconciliation with counterparty (Step 5):** Sharing SIMM sensitivities with a counterparty via AcadiaSoft or bilateral exchange requires Ravi to manage the relationship and resolve discrepancies. Automated bilateral SIMM reconciliation via AcadiaSoft is a PLANNED substrate gap.
3. **Custodian segregation instruction (Step 7):** Instructions to the tri-party custodian for non-standard collateral types (gold, off-the-run SAGBs) require Ravi to communicate directly with the custodian's collateral-services desk. Automated custodian instruction is a PLANNED substrate gap.
4. **Annual SIMM validation (Step 12):** Independent model validation is a human-expert function requiring a qualified external model validator (engaged by Helena). It cannot be automated.
5. **Scope notification to counterparties (Step 2):** Written notification to counterparties newly entering scope requires Imani (Legal-as-code engineer, engineering) to issue formal notices and update the CSA/SCSA terms accordingly.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| SIMM engine fails for daily recompute | `SIMMCalculationFailed` event | Rohan immediately; prior-day IM as placeholder; if 2 consecutive days → Helena + BRC; schedule-based fallback activated |
| Counterparty fails to post IM within settlement window | `InitialMarginPosted` not received by T+2 | Ravi + Eitan immediately; SCSA default-notice provisions assessed; Imani + Helena consulted |
| IM dispute unresolved after 5 BDs | `IMDisputeEscalated` event | Eitan + Rohan + Imani; route to `otc-dispute-resolution.md`; higher amount posted in interim |
| Custodian confirms commingling of segregated IM | Custodian statement review | Eitan + Imani + Helena immediately; P1 finding; legal action considered; PA notified if material |
| Bank crosses phase-in threshold (GAANE > ZAR 100bn) | Quarterly `IMScopeAssessed` result | Eitan + Camille + Helena; IM framework activated within 30 days; counterparties notified |
| SIMM model validation overdue (> 12 months) | Vera model-validation-currency check | Helena + Rohan + Eitan; validation commissioned immediately; BRC notified |

---

## 10. Related procedures

- [`margin-vm.md`](margin-vm.md) — PROC-MK-ODP-03; VM and IM are jointly managed; MTA applies in aggregate to IM + VM; Umoja reporting covers both.
- [`portfolio-reconciliation.md`](portfolio-reconciliation.md) — PROC-MK-ODP-05; netting-set MTM underlying SIMM sensitivities must reconcile with counterparty portfolio values.
- `otc-dispute-resolution.md` — invoked at Step 6 when IM disputes exceed the 5-BD window.
- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) — SCSA / ISDA Credit Support Documentation and custodian arrangements are established at counterparty onboarding as a pre-condition for IM exchange.
- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — IM posted reduces HQLA; LCR monitoring tracks the liquidity impact. IM received is a regulatory capital deduction item under SA-CCR (BA 210).
- [`ba-return-generation.md`](ba-return-generation.md) — IM amounts feed the BA 210 CCR capital calculation.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Ravi (ALM quant engineer, engineering) | Initial STUB — 7-section skeleton; steps and build-phase posture documented. |
| v0.2 | 2026-05-16 | Kai (Trading systems engineer, engineering) · Tomas (Operations engineer, engineering) | STUB → POPULATED: full 12-section structure; YAML frontmatter added; steps expanded to 12 rows; events, invariants, evidence table, manual steps, failure modes, and audit sections added. |

---

## 12. Audit / assurance

- **Vera daily:** assert every in-scope netting set has a current `InitialMarginCalculated` event; assert each `InitialMarginPosted` is linked to a custodian segregation confirmation within T+1.
- **Vera quarterly:** verify `IMScopeAssessed` event exists for each quarter; confirm all counterparties listed as in-scope have active SCSA documentation in the document store.
- **Vera annual:** check SIMM model validation report is current (< 12 months); if overdue, P2 finding escalated to Helena (Chief Risk Officer, governance).
- **Thandiwe (Chief Audit Executive, governance) annual audit:** sample IM calculations against independent sensitivity inputs; verify segregation arrangements at custodian via third-party confirmation; review PA Umoja submission log for completeness; inspect dispute-resolution log.
- **Helena (Chief Risk Officer, governance) model-risk oversight:** SIMM model sits within the Tier 1 model-risk framework; annual independent validation is mandatory; validation findings are remediation-tracked through Helena's model-risk register.
- **PA supervisory examination:** PA may request IM position reports submitted to Umoja for any period; the event log + BLAKE3 sensitivity files support full reconstruction of every IM calculation.
