---
policy-parent: OTC Trading Policy · Counterparty Onboarding Policy · ISDA Master Agreement + Schedule + CSA
last-reviewed: 2026-05-16
procedureId: PROC-MK-ODP-07
title: OTC derivative dispute resolution
author: Imani (legal-as-code engineer) · Rohan (market risk quant engineer) · Tomas (operations engineer)
date: 2026-05-16
owner: Imani (legal-as-code engineer) · Saskia (Head of Global Markets, governance) · Zara (Chief Compliance Officer, governance)
status: POPULATED
policy-cited: OTC Trading Policy · Counterparty Onboarding Policy · ISDA Master Agreement + Schedule + CSA
system-capability: "@trading/dispute-comms · @risk/dispute-aggregation (PLANNED)"
---

# Procedure — OTC derivative dispute resolution

**Procedure ID:** PROC-MK-ODP-07
**Owner:** Imani (legal-as-code engineer) · Saskia (Head of Global Markets, governance) · Zara (Chief Compliance Officer, governance)
**Approval:** BRC
**Cadence:** Continuous (event-triggered); threshold escalation when amount > R5m or age > 5 business days
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- OTC Trading Policy (planned, markets bundle) — dispute-resolution obligations are incorporated into the policy framework.
- Counterparty Onboarding Policy — the ISDA Master Agreement (MA) + Schedule + CSA signed during onboarding sets the contractual dispute-resolution mechanism (the 2017 ISDA Variation Margin Protocol and the 2016 ISDA Credit Support Annex are the reference frameworks).
- ISDA 2002 Master Agreement, Section 6 and the applicable Confirmation — for disputes relating to material terms; the ISDA confirmation-by-silence protocol is a pre-dispute mitigation.
- ISDA 2016 Credit Support Annex (VM and IM as applicable) — for margin-related disputes; contains a dedicated dispute-resolution mechanism for VM calls (typically a 1-business-day resolution window).

The obligation chain:

```
Regulation (CS 3/2018 §5–6; JS 2/2020 §8 margin disputes)
  → OTC Trading Policy (planned) + ISDA MA / CSA
    → PROC-MK-ODP-07 (this procedure)
      → @trading/dispute-comms · @risk/dispute-aggregation (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CS3-004` (CS 3/2018 §6) | Dispute-resolution procedures must be in place before transaction commencement; the bank must demonstrate a documented, functioning dispute-resolution channel. |
| `ORG-CS3-003` (CS 3/2018 §5) | Portfolio reconciliation; reconciliation breaks of sufficient materiality are the primary source of disputes. |
| `ORG-JS2-006` (JS 2/2020 §8) | Margin-specific dispute-resolution procedures for VM calls; 1-business-day standard resolution window; senior escalation after threshold. |
| `ORG-GV-15` (ISDA 2002 MA §6) | Contractual dispute-resolution process; close-out-netting rights are triggered only after exhaustion of the dispute-resolution process or an Event of Default. |
| `ORG-PR-23` (Reg 39 — ILAAP) | Material unresolved disputes are a market risk / counterparty credit risk reporting item in ILAAP. |

## 3. Purpose

1. Detect OTC derivative disputes arising from portfolio reconciliation breaks, MTM valuation differences above materiality threshold, margin call disagreements, or material-terms discrepancies.
2. Provide a structured, ISDA-aligned resolution pathway that is fast for working-level disagreements and escalates quickly for material or prolonged disputes.
3. Maintain an immutable typed record (`DisputeOpened`, `DisputeResolved`) for every dispute so that the bank can demonstrate a functioning dispute-resolution process under CS 3/2018 §6.
4. Surface material and prolonged unresolved disputes to Helena (Chief Risk Officer, governance) and the BRC as counterparty credit risk signals.
5. Ensure that disputed VM calls are correctly handled without inadvertently triggering close-out-netting rights under the ISDA MA.

## 4. Trigger

- **Portfolio reconciliation break:** `ReconciliationBreakFound { nettingSetId, field, bankValue, counterpartyValue, breakAmount, severity: Major | Critical }` — emitted by the OTC portfolio reconciliation engine (PROC-MK-ODP-03); only `Major` and `Critical` breaks trigger this procedure.
- **Counterparty disputes VM call:** `MarginCallDisputed { callId, callAmount, counterpartyId, disputedAmount, disputeReason }` — emitted when a counterparty formally disputes a VM call; received via the confirmation-tracking channel (PROC-MK-ODP-06).
- **Confirmation discrepancy:** `ConfirmationDiscrepancyFound { tradeId, field, bankValue, counterpartyValue }` — emitted when a counterparty raises an objection to a dispatched confirmation per PROC-MK-ODP-06; if the discrepancy relates to a material term, this procedure governs resolution.
- **Manual escalation:** Tomas (operations engineer) or Kai (trading systems engineer) may manually open a dispute via the `openDispute` system call when a counterparty communicates a dispute through an out-of-band channel.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On trigger event: open dispute record; emit `DisputeOpened { disputeId, tradeId / nettingSetId, type: 'MTM' | 'MaterialTerms' | 'MarginCall' | 'ReconciliationBreak', bankValue, counterpartyValue, breakAmount, counterpartyId, openedAt }` | `system` | `@platform/event-store` | `disputeId` is a UUID; type classification drives the resolution pathway at step 2. `breakAmount` drives the escalation threshold at step 6. |
| 2 | Classify dispute and assign resolution lead: MTM / reconciliation break → Rohan (market risk quant engineer); material terms → Imani (legal-as-code engineer); margin call → Tomas (operations engineer) with Rohan support; compound dispute → Imani leads with Rohan and Tomas | `system` (auto-assign by type) | `@trading/dispute-comms` (PLANNED) | Assignment is coded from the `DisputeOpened.type` field; routing via `@platform/escalation`. |
| 3 | **Working-level resolution attempt — MTM dispute.** Rohan (market risk quant engineer) independently recalculates MTM using the bank's validated pricing library; compares to counterparty's submitted value; identifies source of difference (model, curve, data); communicates working-level result to counterparty's middle-office | `agent` (Rohan) | `@risk/dispute-aggregation` (PLANNED) + `@platform/markets/pricing-engine` (PLANNED) | Rohan uses the same pricing library as the Tomas-coordinated VM call workflow to ensure consistency. Independent recalc is the primary resolution tool for MTM disputes. |
| 4 | **Working-level resolution attempt — material terms dispute.** Imani (legal-as-code engineer) reviews the trade economic terms against the confirmation (PROC-MK-ODP-06 confirmed record) and the ISDA MA / Schedule / Confirmation; determines the legally valid value of the disputed term; communicates to counterparty's legal team | `agent` (Imani) | `@platform/legal/confirmation-validator` (PLANNED) | Where the dispute cannot be resolved by reference to the confirmation and ISDA MA alone, Imani invokes the ISDA 2017 Reconciliation and Dispute Resolution protocol; this may result in joint valuation by independent third-party pricing agent. |
| 5 | **Working-level resolution attempt — margin call dispute.** Tomas (operations engineer) reviews the VM call calculation: re-runs the EOD MTM, checks the threshold and MTA, verifies the calculation-agent role (bank or counterparty per the CSA), confirms the business-day convention; Rohan provides independent MTM if needed | `agent` (Tomas + Rohan) | `@trading/dispute-comms` (PLANNED) + `@risk/dispute-aggregation` (PLANNED) | The ISDA 2016 CSA gives a 1-business-day standard resolution window for VM disputes; Tomas must have a working-level resolution or escalation by end of that window. |
| 6 | **Escalation check.** After each working-level resolution attempt: if `breakAmount > R5m` OR if the dispute has been open for > 5 business days without resolution → escalate to Saskia (Head of Global Markets, governance); emit `DisputeEscalated { disputeId, escalationLevel: 'Senior', escalatedAt, reason }` | `system` (age-check scheduler) + `agent` (Tomas) | `@platform/escalation` (existing) | The scheduler runs every morning; disputes exceeding age threshold are auto-escalated. Amount threshold is triggered immediately on `DisputeOpened` if `breakAmount > R5m`. |
| 7 | **Senior resolution (Saskia).** Saskia (Head of Global Markets, governance) engages the counterparty's equivalent senior at MD / head-of-trading level; negotiates an agreed value or settlement; documents the proposed settlement terms | `human` (Saskia) | (manual; structured as typed event on conclusion) | Saskia may propose to split the MTM difference, apply a haircut, or accept the counterparty's value where Rohan's recalc is within a documented tolerance. Settlement terms are subject to step 8 approval. |
| 8 | **Settlement approval.** Saskia proposes settlement terms; if adjustment to the bank's books is required: Saskia submits for Helena (Chief Risk Officer, governance) approval where the P&L impact > R1m; Helena's approval is captured as `DisputeSettlementApproved { disputeId, approvedBy, adjustmentAmount, approvedAt }` | `agent` (Saskia) + `human` (Helena — P&L impact > R1m) | `@platform/event-store` | Below the R1m threshold Saskia may approve independently under the Delegation of Authority framework; above, Helena's approval is mandatory. BRC is informed of all disputes > R5m at the next scheduled meeting. |
| 9 | **Resolution — accounting and event.** Apply the agreed adjustment to the OMS trade record and the risk system; emit `DisputeResolved { disputeId, outcome: 'Agreed' | 'Conceded' | 'Withdrawn' | 'Escalated_External', agreedValue, adjustmentAmount, resolvedAt, resolvedBy }` | `system` | `@platform/event-store` + `@trading/oms` (PLANNED) | Accounting adjustment is an MTM restatement; Camille (CFO, governance) is notified if the adjustment is material (> R500k). |
| 10 | **External escalation (unresolved after senior engagement).** If dispute remains unresolved after Saskia's senior engagement for > 10 business days or counterparty threatens formal legal action → Helena (CRO, governance) reviews with Imani; decision to invoke ISDA formal dispute mechanism or refer to external counsel; emit `DisputeExternallyEscalated { disputeId, escalatedAt, mechanism }` | `human` (Helena + Imani) | (manual; event emitted on decision) | External escalation is a BRC-notifiable event; Owen (Company Secretary, governance) is informed; external dispute-resolution costs are captured as a cost item. |
| 11 | **Post-resolution portfolio reconciliation check.** After `DisputeResolved`: trigger an ad-hoc portfolio reconciliation for the affected netting set to confirm that the agreed value is now reflected in both parties' records; emit `ReconciliationBreakResolved { nettingSetId, disputeId }` if the break is closed | `agent` (Tomas + Rohan) | `@risk/dispute-aggregation` (PLANNED) | This closes the reconciliation-break loop with PROC-MK-ODP-03 (portfolio reconciliation). |
| 12 | **Monthly dispute aging report.** Compile the open-dispute register for Helena's monthly risk report: dispute count by type, average age, total disputed amount, unresolved items, escalated items | `agent` (Rohan) | `@risk/dispute-aggregation` (PLANNED) | Helena presents the dispute aging report to BRC monthly. |

## 6. Reconciliation

- **Events produced:**
  - `DisputeOpened { disputeId, tradeId / nettingSetId, type, bankValue, counterpartyValue, breakAmount, counterpartyId, openedAt }`
  - `DisputeEscalated { disputeId, escalationLevel, escalatedAt, reason }`
  - `DisputeSettlementApproved { disputeId, approvedBy, adjustmentAmount, approvedAt }`
  - `DisputeResolved { disputeId, outcome, agreedValue, adjustmentAmount, resolvedAt, resolvedBy }`
  - `DisputeExternallyEscalated { disputeId, escalatedAt, mechanism }`
  - `ReconciliationBreakResolved { nettingSetId, disputeId }` — on post-resolution reconciliation confirmation
- **Reconciliation checks (Vera asserts):**
  - Every `ReconciliationBreakFound { severity: Major | Critical }` has a downstream `DisputeOpened` within 1 business day.
  - Every `MarginCallDisputed` has a downstream `DisputeOpened` on the same business day.
  - Every `DisputeOpened` with `breakAmount > R5m` or age > 5 BD has a `DisputeEscalated` event.
  - Every `DisputeOpened` has a downstream `DisputeResolved` or `DisputeExternallyEscalated`; disputes with no resolution event after 30 calendar days are Vera critical findings.
  - Every `DisputeResolved` with an adjustment traces to a corresponding OMS trade record update.
- **Failure mode:** If the dispute-comms system is unavailable, Tomas and Imani manage the dispute via secure email and phone; all communications are summarised in a manual note that is digitised and referenced from the dispute events. Manual handling is flagged as `DisputeManualResolution { disputeId, reason }`.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All `Dispute*` events | Event log (`@platform/event-store`) | Permanent (Principle 1) | Confidential — counterparty commercial data + potential legal privilege |
| Independent recalc workbooks (Rohan) | Document store (BLAKE3-addressed) | 7 years | Confidential |
| ISDA protocol invocation records | Document store | 7 years + pending litigation | Legal privilege; Imani manages access |
| Senior resolution correspondence (Saskia) | Document store | 7 years | Confidential |
| External counsel instructions and opinions | Document store | Permanent (litigation risk) | Legal privilege; Owen + Imani manage access |
| Monthly dispute aging report | Document store + risk register projection | 7 years | Internal — restricted to governance + risk |

## 8. Manual steps

1. **Independent MTM recalculation (step 3):** Rohan's independent recalc requires running the pricing engine against the counterparty-provided curve snapshot; this step is semi-automated but requires Rohan's judgment on model selection for exotic / structured products.
2. **Material terms legal assessment (step 4):** Imani's ISDA MA / Confirmation legal review requires human legal judgment; cannot be fully automated until the legal-clause library has adequate coverage of bespoke term patterns.
3. **Senior counterparty engagement (step 7):** Saskia's MD-level engagement is irreducibly human; structured as a typed event on conclusion.
4. **Helena's settlement approval (step 8) for P&L impact > R1m:** Human governance approval step per the Delegation of Authority framework.
5. **External escalation decision (step 10):** The decision to invoke formal ISDA dispute mechanism or external litigation requires Helena and Imani's judgment; not automatable.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Working-level resolution fails within 1 BD (VM dispute) | Age check at end of business day T+1; no `DisputeResolved` | Tomas → Saskia immediately; risk of ISDA close-out rights |
| Dispute amount > R5m unresolved at open | `DisputeOpened.breakAmount > R5m` | Saskia immediate; Helena same day; BRC notification queued |
| Counterparty threatens close-out / default notice | Out-of-band communication | Imani + Helena immediately; external counsel engaged; BRC emergency meeting |
| Independent recalc confirms bank's value is wrong | Rohan's recalc result materially differs from bank records | Camille (CFO) + Helena; OMS correction; P&L restatement per IFRS 9 fair-value hierarchy |
| ISDA protocol invocation fails (counterparty non-responsive) | > 10 BD without counterparty engagement | Helena + Imani; external counsel; BRC + Owen |
| Dispute aging report missing (monthly) | Vera monthly check | Rohan; escalate to Saskia |

## 10. Related procedures

- [`otc-confirmation.md`](otc-confirmation.md) (PROC-MK-ODP-06) — confirmation discrepancies are one of the primary dispute triggers; resolved disputes must close the open PROC-MK-ODP-06 SLA-breach item.
- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) (PROC-MK-ODP-02) — the ISDA MA / CSA dispute-resolution mechanism (step 4 + 7 + 10) is established during counterparty onboarding.
- [`margin-im.md`](margin-im.md) (PROC-MK-ODP-05) — disputed VM calls are the most time-sensitive dispute type; 1-BD resolution window under ISDA 2016 CSA.
- [`client-categorisation.md`](client-categorisation.md) (PROC-MK-ODP-08) — counterparty category determines whether conduct-protection obligations apply in the dispute resolution (e.g., best-interest obligations for professional clients).
- [`conflicts-declaration.md`](conflicts-declaration.md) — where the bank is the calculation agent for a disputed VM call, the conflict of interest must be declared and managed.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Imani (legal-as-code engineer) · Saskia (Head of Global Markets, governance) · Zara (Chief Compliance Officer, governance) | Initial STUB |
| v0.2 | 2026-05-16 | Imani (legal-as-code engineer) · Rohan (market risk quant engineer) · Tomas (operations engineer) | STUB → POPULATED: full 12-section procedure; ISDA-aligned three-pathway resolution (MTM / material terms / margin call); threshold escalation (R5m / 5 BD); senior resolution and settlement approval; external escalation; post-resolution reconciliation loop; full event schema. |

## 12. Audit / assurance

- **Vera daily:** open-dispute register completeness — every `ReconciliationBreakFound (Major/Critical)` and `MarginCallDisputed` has a downstream `DisputeOpened`; every open dispute has a disposition event or is flagged as outstanding.
- **Vera monthly:** dispute aging report reconciliation — Rohan's monthly report total must match the sum of `DisputeOpened` minus `DisputeResolved` events for the period; escalation-chain disposition checked.
- **Thandiwe (CAE, governance):** annual audit of the dispute-resolution framework; sample testing of independent recalculations; ISDA protocol invocation records; CS 3/2018 §6 alignment; opinion reported to Audit Committee.
- **PA / FSCA supervisory:** CS 3/2018 §6 dispute-resolution procedures are subject to PA conduct examination; material unresolved disputes may require supervisory notification; Helena manages the supervisory engagement.
