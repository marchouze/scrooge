---
procedureId: PROC-MK-ODP-03
title: Variation Margin — daily calculation and exchange (per-counterparty)
author: Kai (Trading systems engineer, engineering) · Tomas (Operations engineer, engineering)
date: 2026-05-16
owner: Ravi (ALM quant engineer, engineering) · Eitan (Treasury and ALM engineer, governance) · Imani (Legal-as-code engineer, engineering) · Bea (Accounting and financial reporting engineer, engineering)
status: POPULATED
policy-cited: Policies/margin-policy-v1.md · Policies/collateral-management-policy-v1.md
system-capability: prototype/platform/treasury/margin-engine (DRAFTING)
---

# Procedure — Variation Margin (Daily, Per-Counterparty)

**Procedure ID:** PROC-MK-ODP-03
**Owner:** Ravi (ALM quant engineer, engineering) · Eitan (Treasury and ALM engineer, governance) · Imani (Legal-as-code engineer, engineering) · Bea (Accounting and financial reporting engineer, engineering)
**Approval:** ALCO (Margin Policy is ALCO-approved under the Risk Management Framework)
**Cadence:** Daily (per-counterparty, ZAR market calendar)
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

---

## 1. Source policy

- `Policies/margin-policy-v1.md` — Margin Policy (PLANNED, sub-policy of Risk Management Framework)
- `Policies/collateral-management-policy-v1.md` — Collateral Management Policy (PLANNED)

The obligation chain is:

```
Regulation (Joint Standard JS 2/2020 §4 + JN 2/2024)
  → Margin Policy + Collateral Management Policy
    → PROC-MK-ODP-03 (this procedure)
      → @treasury/margin-engine (DRAFTING)
      → @treasury/collateral-inventory (PLANNED)
```

The Margin Policy mandates daily VM calculation and exchange for every non-centrally cleared OTC derivative counterparty. Zero threshold (MTA of ZAR 0) applies for bank-to-bank counterparties, consistent with ISDA standard CSA terms. Eligible collateral is defined in the Collateral Management Policy per JS 2/2020 §6: ZAR cash, gold, and South African Government Bonds (SAGBs). Eitan (Treasury and ALM engineer, governance) holds ALCO accountability for margin governance.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-JS2-001` (JS 2/2020 §4) | Calculate and exchange VM daily, per-counterparty, against the change in MTM since the last exchange. Applicable to all non-centrally cleared OTC derivatives above the clearing threshold. |
| `ORG-JS2-003` (JS 2/2020 §6) | Eligible collateral for VM: ZAR cash; gold; South African Government Bonds (+ 2022 expansion to include qualifying corporate bonds and equities subject to haircuts). |
| `ORG-JS2-004` (JS 2/2020 §7) | Minimum Transfer Amount (MTA): aggregate IM + VM ≤ ZAR 5 million per counterparty. Calls below the MTA are not required but MTA does not extinguish the obligation to call once exceeded. |
| `ORG-JN2-2024` (JN 2/2024) | Margin information reporting to PA Umoja portal, effective 1 April 2025: submit daily aggregate VM and IM positions per counterparty. |
| `ORG-JS2-005` (JS 2/2020 §3) | Board-approved policies and procedures for margin management, with documented escalation path for disputes. |

---

## 3. Purpose

The purpose of this procedure is to:

1. Compute the daily VM call or return for each non-centrally cleared OTC derivative counterparty based on the change in MTM of the netting-set since the last VM exchange.
2. Issue margin calls to counterparties (or receive calls from counterparties) in accordance with the terms of the relevant ISDA Credit Support Annex (CSA) before the daily CSA settlement deadline.
3. Move eligible collateral (ZAR cash, SAGBs, or gold) via the correspondent bank channel within the CSA-specified settlement timeframe.
4. Record the VM exchange as a collateral movement event and account for it correctly in Bea's (Accounting and financial reporting engineer, engineering) sub-ledger as a collateral deposit or return (not P&L unless a close-out occurs).
5. Report daily aggregate VM positions to the PA Umoja portal per JN 2/2024.
6. Detect and escalate VM disputes within 1 business day, routing to the OTC dispute-resolution procedure where agreement cannot be reached.

---

## 4. Trigger

- **Daily calendar trigger:** ZAR market-calendar close (approximately 17:00 SAST); the margin engine begins MTM aggregation when `MarketClose { date }` event is emitted.
- **`MTMComputed { tradeId, nettingSetId, counterpartyLei, mtm, currency, asOf }` events** — emitted by Rohan's (Market risk quant engineer, engineering) risk engine for each trade and aggregated by netting set. VM calculation begins when all MTM events for a given netting set are received.
- **`MarginCallReceived { counterpartyLei, amount, currency, callDate, csa }` events** — emitted when a counterparty sends a margin call to the bank; triggers the internal validation and response workflow.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `MarketClose` trigger; query `MTMComputed` events for each active netting set; aggregate MTM per CSA netting set | `system` | `@risk/mtm` | OIS discounting using ZARONIA (ZAR Overnight Index Average). MTM is signed: positive = bank in-the-money; negative = bank out-of-the-money. |
| 2 | Compute VM = (current netting-set MTM) − (prior-day netting-set MTM); deduct outstanding VM already posted; net against MTA | `system` | `@treasury/margin-engine` (DRAFTING) | Zero threshold applies for bank-to-bank counterparties. If \|VM\| < ZAR 5m MTA (aggregate IM+VM), no call is issued; if ≥ MTA, call is issued for the full VM amount. |
| 3 | Emit `VariationMarginCalculated { nettingSetId, counterpartyLei, vm, direction: call\|return, mtmCurrent, mtmPrior, csa, asOf }` | `system` | `@platform/event-store` | Canonical calculation record. Retained for Vera reconciliation and PA Umoja reporting. |
| 4 | Issue VM call or return notice to counterparty via ISDA-aligned margin call communication (Swift MT 527 or equivalent agreed format) | `agent` (Tomas) | `@settlement/margin-comms` (PLANNED) | Deadline: by 10:00 SAST on the next business day (T+1), per standard ISDA CSA settlement cycle. Counterparty has until 17:00 T+1 to respond and settle. |
| 5 | Emit `VariationMarginCallSent { nettingSetId, counterpartyLei, amount, currency, deadline }` | `system` | `@platform/event-store` | Audit trail of call issuance. |
| 6 | Receive counterparty confirmation or dispute; if dispute, emit `VariationMarginDisputeRaised { nettingSetId, counterpartyLei, bankMTM, counterpartyMTM, differenceAbs }` and route to `otc-dispute-resolution.md` | `agent` (Tomas) | `@settlement/margin-comms` (PLANNED) | Dispute window: 1 business day. If not resolved within 1 BD, escalate to Eitan (Treasury and ALM engineer, governance) + Rohan (Market risk quant engineer, engineering). |
| 7 | Instruct correspondent bank to effect collateral movement (ZAR cash transfer or SAGB delivery vs. payment) | `agent` (Tomas) | `@settlement/correspondent-bank-channel` (PLANNED) | Collateral movement is settled via correspondent bank; Tomas triggers SWIFT MT 202 or equivalent. Settlement confirmation received same day (T+1). |
| 8 | Receive settlement confirmation from correspondent bank; emit `VariationMarginSettled { nettingSetId, counterpartyLei, amount, currency, collateralType, settledAt }` | `system` | `@platform/event-store` | Canonical settlement proof. Triggers Bea's sub-ledger posting. |
| 9 | Bea posts VM movement to the collateral sub-ledger as a collateral deposit (if posting) or collateral return (if receiving); post reversing entry when collateral is returned on trade termination | `agent` (Bea) | `@accounting/sub-ledger` | VM posted collateral is not P&L; classified as "collateral posted" or "collateral received" on the balance sheet. Hedge-accounting boundary: VM cash does not qualify as hedge effectiveness evidence. |
| 10 | Run end-of-day collateral inventory reconciliation: `VariationMarginCalculated` totals vs. `VariationMarginSettled` totals per counterparty; flag any unsettled calls | `system` | `@treasury/collateral-inventory` (PLANNED) | Unsettled VM calls > T+1 are a breach of the CSA; escalated immediately to Eitan + Helena (Chief Risk Officer, governance). |
| 11 | Compile daily PA Umoja portal report: aggregate VM posted and received per counterparty; submit to PA portal | `agent` (Tomas) + `agent` (Anya) | `@regulatory/umoja-client` (PLANNED) | Per JN 2/2024, effective 1 April 2025. Filed as part of the daily margin information return. |

---

## 6. Reconciliation

### Events produced

| Event | Trigger | Key fields |
|---|---|---|
| `VariationMarginCalculated` | Step 3 — daily per netting set | `nettingSetId`, `counterpartyLei`, `vm`, `direction`, `mtmCurrent`, `mtmPrior`, `csa`, `asOf` |
| `VariationMarginCallSent` | Step 5 — call notice issued | `nettingSetId`, `counterpartyLei`, `amount`, `currency`, `deadline` |
| `VariationMarginDisputeRaised` | Step 6 — counterparty dispute | `nettingSetId`, `counterpartyLei`, `bankMTM`, `counterpartyMTM`, `differenceAbs` |
| `VariationMarginSettled` | Step 8 — settlement confirmed | `nettingSetId`, `counterpartyLei`, `amount`, `currency`, `collateralType`, `settledAt` |

### Invariants (CI-tested)

1. **Settlement completeness:** `∀ VariationMarginCallSent(nettingSetId, date) → ∃ VariationMarginSettled(nettingSetId, date) OR VariationMarginDisputeRaised` within T+1. Vera asserts nightly.
2. **Calculation completeness:** for every active netting set on every market-open day, a `VariationMarginCalculated` event must exist. Missing calculations are a P2 finding.
3. **Accounting trace:** every `VariationMarginSettled` must be matched by a sub-ledger posting entry within the same business day. Bea's sub-ledger reconciliation confirms this.
4. **MTA enforcement:** no `VariationMarginCallSent` may be issued for a VM amount below the ZAR 5m MTA threshold (aggregate IM+VM). Enforced by the margin engine; Vera audits.

### Failure mode

If the margin engine fails to complete the VM calculation by 08:00 on T+1, Ravi (ALM quant engineer, engineering) is alerted and runs the calculation manually using the previous day's MTM positions as a fallback. The fallback is recorded via a `VariationMarginCalculatedManual { nettingSetId, fallbackBasis }` event. Eitan (Treasury and ALM engineer, governance) approves the fallback calculation before any call is issued.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `VariationMarginCalculated` events | Event log | 7 years | Restricted |
| `VariationMarginCallSent` events + margin call communications | Event log + document store | 7 years | Restricted |
| `VariationMarginSettled` events | Event log | 7 years | Restricted |
| Correspondent bank SWIFT confirmations | Document store (linked from `VariationMarginSettled`) | 7 years | Restricted |
| Collateral sub-ledger entries (Bea) | Event log (`SubLedgerPosted`) + accounting system | 7 years | Restricted |
| PA Umoja daily margin report | Document store | 7 years | Restricted |
| `VariationMarginDisputeRaised` events + resolution correspondence | Event log + document store | 7 years | Confidential |

---

## 8. Manual steps

The following steps require human action or professional judgement in the current substrate:

1. **Counterparty communication for disputes (Step 6):** When a counterparty disputes the VM call, Tomas (Operations engineer, engineering) must communicate directly with the counterparty's operations team. Automated dispute-resolution messaging is a PLANNED substrate gap; current implementation routes through Tomas.
2. **Fallback calculation approval (failure mode):** If the margin engine fails, Eitan (Treasury and ALM engineer, governance) must manually review and approve the fallback VM calculation before any call is issued. This is a governance control step that cannot be automated.
3. **Correspondent bank instruction for non-standard collateral (Step 7):** SAGB delivery-vs.-payment and gold movements require Tomas to co-ordinate with the correspondent bank's collateral-services desk. Automated SAGB-DvP instruction is a PLANNED substrate gap.
4. **PA Umoja portal submission (Step 11):** Until the `@regulatory/umoja-client` is live, Tomas and Anya prepare the Umoja report manually from the `VariationMarginCalculated` event log and upload via the PA portal web interface.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Margin engine fails to complete calculation by 08:00 T+1 | Engine health monitor; `MarginCalculationFailed` event | Ravi immediately; fallback calculation; Eitan approves; if still delayed by 10:00 → Helena notified |
| Counterparty fails to settle VM by 17:00 T+1 | `VariationMarginSettled` not received by deadline monitor | Tomas + Eitan immediately; ISDA CSA default-notice provisions assessed; Helena + Imani consulted |
| VM dispute unresolved after 1 BD | `VariationMarginDisputeRaised` age > 1 BD | Eitan + Rohan + Imani; route to `otc-dispute-resolution.md`; Zara (Chief Compliance Officer, governance) informed |
| Correspondent bank settlement failure | Missing SWIFT confirmation | Tomas + correspondent bank OPS immediately; Eitan informed; backup settlement channel activated |
| MTA threshold aggregate breached unexpectedly | Margin engine MTA check | Ravi + Eitan; confirm calculation; call issued if correct; model gap investigated if incorrect |
| PA Umoja portal unavailable | Submission health check | Tomas + Anya; retry 3x; if unavailable by end-of-day, Zara assesses regulatory notification requirement |

---

## 10. Related procedures

- [`margin-im.md`](margin-im.md) — PROC-MK-ODP-04; IM is calculated and exchanged alongside VM; the MTA applies in aggregate to IM + VM.
- [`portfolio-reconciliation.md`](portfolio-reconciliation.md) — PROC-MK-ODP-05; the MTM figures underlying VM must reconcile with counterparty portfolio reconciliation values.
- `otc-dispute-resolution.md` — dispute-resolution procedure invoked at Step 6 when a VM dispute cannot be resolved within 1 BD.
- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) — CSA terms (threshold, MTA, eligible collateral) are recorded at counterparty onboarding; margin engine reads these terms per-counterparty.
- [`balance-sheet-substantiation.md`](balance-sheet-substantiation.md) — VM posted and received are balance-sheet items; Bea's monthly substantiation covers collateral accounts.
- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — VM posted reduces the bank's HQLA buffer; LCR monitoring procedure tracks the liquidity impact.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Ravi (ALM quant engineer, engineering) | Initial STUB — 7-section skeleton; steps and build-phase posture documented. |
| v0.2 | 2026-05-16 | Kai (Trading systems engineer, engineering) · Tomas (Operations engineer, engineering) | STUB → POPULATED: full 12-section structure; YAML frontmatter added; steps expanded to 11 rows; events, invariants, evidence table, manual steps, failure modes, and audit sections added. |

---

## 12. Audit / assurance

- **Vera nightly:** assert every active netting set has a `VariationMarginCalculated` event for the day; assert every `VariationMarginCallSent` has a corresponding `VariationMarginSettled` or open `VariationMarginDisputeRaised` within T+1; any gap is a P2 finding escalated to Eitan.
- **Vera monthly:** produce a margin-exchange summary for ALCO — count of VM calls issued and received, total collateral moved, dispute count and resolution times.
- **Vera monthly:** reconcile `VariationMarginSettled` totals against Bea's collateral sub-ledger entries; discrepancies are a P2 finding.
- **Thandiwe (Chief Audit Executive, governance) annual audit:** sample VM calculations against independent MTM source; verify CSA terms are applied correctly; review PA Umoja submission log for completeness; inspect dispute-resolution log.
- **PA supervisory examination:** PA may request daily margin-information reports submitted to Umoja for any period. The event log supports point-in-time reconstruction. Helena (Chief Risk Officer, governance) holds the formal model-validation record for the MTM pricing curves underlying VM calculations.
