---
policy-parent: Payments Policy v0.1 (STUB)
last-reviewed: 2026-05-16
procedureId: PROC-PAY-RBH-01
title: Payment reconciliation break identification and resolution
author: Tomas (payments engineer) · Bea (financial-reporting engineer)
date: 2026-05-16
owner: Tomas (payments engineer) · Bea (financial-reporting engineer)
status: POPULATED
policy-cited: Payments Policy v0.1 (STUB)
system-capability: "@platform/payments/reconciliation (PLANNED)"
---

# Procedure — Payment reconciliation break identification and resolution

**Procedure ID:** PROC-PAY-RBH-01
**Owner:** Tomas (payments engineer) · Bea (financial-reporting engineer)
**Approval:** BRC (under Payments Policy v0.1 — STUB)
**Cadence:** Continuous (per `PaymentSettled` event); intraday sweep (every 30 minutes); end-of-day full reconciliation run
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Payments Policy v0.1 §5 (Reconciliation discipline); §3 (Indirect-participant posture).
- `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md` § Accounting Policies (IFRS) v0.1 §3 (Recognition and double-entry discipline).

Obligation chain:
```
Regulation (Banks Act 94/1990 s.78 + Reg 26 operational risk → SARB Guidance Note — settlement risk)
  → Policy (Payments Policy v0.1 §5 — Reconciliation discipline)
    → This procedure (PROC-PAY-RBH-01 — three-way recon break handling)
      → System capability (@platform/payments/reconciliation — PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act 94/1990 s.78 | Operational risk management — unresolved reconciliation breaks represent operational risk exposures that must be identified, classified, and remediated. |
| Banks Act Regulations, Reg 26 (Operational Risk) | Quantification and governance; material breaks are Loss Events captured via PROC-RISK-RCSA-01. |
| Banks Act Regulations, Reg 28 (Reporting) | Accurate reporting requires the ledger to reconcile to settlement activity. |
| SARB Guidance — settlement risk management | Settlement risk obligations require that mismatches between payment events and ledger postings are identified and resolved within defined timeframes. |
| IFRS 9 (IAS 32 / IFRS 7) | Financial instruments must be recognised and measured accurately; unposted or mis-posted settlement amounts are a financial-reporting risk. |
| National Payment System Act 78/1998 | Indirect participant obligations; settlement certainty expectations flow through the correspondent. |

## 3. Purpose

Identify, classify, and resolve breaks in the three-way reconciliation between:

1. **Trade leg** — the settlement instruction as recorded by Kai (markets systems engineer) and event-sourced into the trade event log (`SettlementInstructionReceived`).
2. **Payment leg** — the payment lifecycle as managed by Tomas (payments engineer) (`PaymentInitiated` → `PaymentSettled` or `PaymentFailed`).
3. **Ledger leg** — the accounting entries posted by Bea (financial-reporting engineer) via posting rules (`JournalEntryPosted` from `PR-CASHIN-001` and sibling rules, per PROC-FIN-AC-01).

A reconciliation break exists when the three legs do not agree on amount, currency, settlement date, or completion status within the tolerances and timeframes defined in this procedure.

## 4. Trigger

- **Primary trigger:** `PaymentSettled { paymentId, settlementTime, sponsorAck }` event (emitted by PROC-OPS-PS-01 Step 8). Each settled payment triggers an immediate three-way check.
- **Intraday sweep:** every 30 minutes, a sweep across all `PaymentInitiated` events with no corresponding `PaymentSettled` or `PaymentFailed` within SLA detects pending-leg breaks.
- **End-of-day full run:** at end of business day, a full three-way reconciliation is performed across all payment events, ledger entries, and trade records for the business date.
- **Break re-check:** when a `ReconciliationBreakResolved` event is emitted, the reconciliation engine re-checks the affected payment chain to confirm resolution.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Consume `PaymentSettled` event.** On receipt, the reconciliation engine reads: `paymentId`, `amount`, `currency`, `settlementTime`, `sponsorAck`, and the linked `SettlementInstructionReceived` (via `paymentId` join key). | system | `@platform/payments/reconciliation` (PLANNED) | The join is on `paymentId`; UETR is the secondary join key for cross-domain traces. |
| 2 | **Trade-leg check.** Retrieve the originating `SettlementInstructionReceived` event. Assert: (a) `amount` and `currency` match the payment leg exactly; (b) `valueDate` matches `settlementTime` (allowing for same-day settlement: `settlementTime` is on or before close of `valueDate`); (c) `originatingEntityId` is consistent. If any assertion fails → emit `ReconciliationBreak` with `leg: "trade"`. | system | `@platform/payments/reconciliation` | Build-phase: synthetic `SettlementInstructionReceived` events; live events from Kai's trade-booking handlers at licence-day. |
| 3 | **Payment-leg check.** Verify the full payment lifecycle chain is intact: `SettlementInstructionReceived` → `PaymentInitiated` → `PaymentSettled`. Assert: (a) each event in the chain shares the same `paymentId`; (b) `PaymentInitiated.amount` == `PaymentSettled.amount`; (c) no `PaymentFailed` event exists for the same `paymentId` (double-outcome is a break). If chain is incomplete or inconsistent → emit `ReconciliationBreak` with `leg: "payment"`. | system | `@platform/payments/reconciliation` | A `PaymentFailed` event followed by a retry cycle is normal; the break check allows for a single active retry chain. Duplicate completions are always a break. |
| 4 | **Ledger-leg check.** Retrieve the `JournalEntryPosted` event corresponding to this `PaymentSettled` (linked via Bea's posting-rule registry, PROC-FIN-AC-01). Assert: (a) debit and credit amounts match `PaymentSettled.amount`; (b) currency matches; (c) `postingDate` is on or before the close of `settlementTime.date`; (d) a matching posting rule exists in Bea's registry for this payment type. If no `JournalEntryPosted` found within 60 minutes of `PaymentSettled`, or amounts mismatch → emit `ReconciliationBreak` with `leg: "ledger"`. | system | `@platform/payments/reconciliation`; `@platform/accounting/posting-rule-registry` (PROC-FIN-AC-01) | Cross-domain check: Tomas's system queries Bea's posting-rule registry. If the posting rule itself is missing, that is a PROC-FIN-AC-01 finding (escalate to Bea). |
| 5 | **Nostro-leg check (supplemental).** For RTGS / correspondent-settled payments, additionally verify that the `PaymentSettled.amount` is consistent with the nostro balance movement recorded in PROC-PAY-NM-01. Discrepancy between payment leg and nostro feed is a `nostro` break. | system | `@platform/payments/reconciliation`; `@platform/payments/nostro` (PROC-PAY-NM-01) | Nostro check runs on the intraday sweep and end-of-day run; not on every per-event check (latency). |
| 6 | **Classify break severity.** On `ReconciliationBreak` emission, classify by severity: **Timing** (amounts agree; timing outside tolerance — self-correcting window ≤ 4 hours); **Amount** (amounts differ by any value — escalate within 30 minutes regardless of size); **Nostro** (payment leg shows settled; nostro feed does not reflect — escalate within 1 hour). | system | `@platform/payments/reconciliation` | Severity classification drives SLA and escalation path (§7). |
| 7 | **Tomas investigates.** Tomas (payments engineer) reviews the `ReconciliationBreak` event, the linked event chain, and the correspondent bank statement (if nostro break). Determines root cause: (a) processing delay (timing); (b) amount discrepancy (data integrity); (c) nostro feed lag (feed); (d) posting-rule miss (PROC-FIN-AC-01). | Tomas (payments engineer) + Bea (financial-reporting engineer) [if ledger break] | `@platform/payments/reconciliation`; `@platform/event-store` | Bea is co-owner: any ledger-leg break is jointly investigated. Tomas owns the payment and nostro leg; Bea owns the ledger leg. |
| 8 | **Resolve break.** For timing breaks: monitor for self-correction within the 4-hour window; if not resolved, escalate. For amount breaks: identify source of discrepancy; initiate correction (`PaymentAmountCorrection` event or correcting `JournalEntryPosted` as appropriate); notify Devon (COO, governance). For nostro breaks: reconcile against correspondent bank statement; if persistent, initiate nostro query via PROC-PAY-NM-01. | Tomas (payments engineer) + Bea (financial-reporting engineer) | `@platform/payments/reconciliation`; `@platform/accounting/posting-rule-registry` | Correcting journal entries require Bea's authorisation and are subject to Bea's month-end close controls (PROC-FIN-MC-01 — planned). |
| 9 | **Emit `ReconciliationBreakResolved`.** On confirmed resolution, emit `ReconciliationBreakResolved { breakId, paymentId, legResolved, resolutionMethod, resolvedAt }`. Trigger re-check (Step 1 for the affected payment). | system + Tomas (payments engineer) | `@platform/payments/reconciliation` | If re-check passes cleanly, the break is fully closed. If re-check surfaces a new break, re-enter the procedure at Step 6. |
| 10 | **End-of-day full reconciliation.** Produce a `DailyReconciliationReport { date, totalSettlements, breaksIdentified, breaksResolved, breaksOutstanding }`. Outstanding breaks carry over to the next business day with escalation per §7. | system | `@platform/payments/reconciliation` | Automated. Outstanding end-of-day breaks are a finding for Vera's planned payments-recon pipeline. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Tomas (payments engineer) | Primary owner of the reconciliation engine; investigates and resolves payment-leg and nostro-leg breaks; escalates amount and nostro breaks. |
| Bea (financial-reporting engineer) | Co-owner; investigates and resolves ledger-leg breaks; authorises correcting journal entries; owns posting-rule registry (PROC-FIN-AC-01). |
| Kai (markets systems engineer) | Provides trade-leg event data; notified if a trade-leg break is detected; co-ordinates with counterparties if settlement instruction is erroneous. |
| Devon (COO, governance) | Receives escalation for amount breaks and outstanding end-of-day breaks; approves corrective actions for material breaks. |
| Helena (Chief Risk Officer, governance) | Receives material break findings as operational-risk events; approves RCSA update. |
| Camille (CFO, governance) | Notified of any break that affects BA-return or IFRS financial-statement figures. |

## 7. Escalation

| Break severity | SLA | Escalation path |
|---|---|---|
| Timing break — auto-corrects | ≤ 4 hours (self-correcting window) | Alert Tomas; monitor; escalate if not resolved within 4 hours |
| Timing break — not resolved within 4 hours | Escalate within 30 minutes of window expiry | Tomas → Devon (COO) + Bea |
| Amount break (any value) | Escalate within 30 minutes of detection | Tomas + Bea → Devon (COO) + Camille (CFO) + Helena (CRO) |
| Nostro break — unresolved within 1 hour | Escalate at 1 hour | Tomas → Devon (COO) + Eitan (Treasurer) |
| End-of-day outstanding break | Report at EoD; escalate if unresolved by 09:00 next day | Tomas + Bea → Devon (COO) + Helena (CRO) |
| Systemic pattern (3+ breaks in one day, same leg) | Same-day | Tomas + Bea → Devon (COO) + Helena (CRO) + Camille (CFO) |
| Correcting journal entry required (material) | Pre-posting approval | Bea → Camille (CFO) sign-off before posting |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/payments/reconciliation` | PLANNED | Three-way reconciliation engine; break detection, classification, and resolution tracking. |
| `@platform/accounting/posting-rule-registry` | PLANNED (part of PROC-FIN-AC-01 substrate) | Bea's posting-rule registry; queried for ledger-leg check. |
| `@platform/payments/nostro` | PLANNED | Nostro balance feed; consumed for nostro-leg check. |
| `@platform/event-store` | In place | Source of truth for all event chains (Principle 1). |
| `@platform/events/alert-dispatcher` | PLANNED | Delivers `ReconciliationBreak` alerts to Tomas + Bea in real time. |

## 9. Quality controls

- **Break-rate KRI:** total daily breaks > 0.5% of daily settled payments is a Red KRI; reported to BRC.
- **Amount-break tolerance:** zero tolerance — any amount break, regardless of size, is escalated within 30 minutes.
- **Resolution SLA compliance:** 100% of timing breaks resolved within 4 hours; 100% of amount breaks acknowledged within 30 minutes. Compliance reported in `DailyReconciliationReport`.
- **End-of-day clean state:** the bank targets zero outstanding breaks at end of each business day. Persistent breaks are BRC-reported findings.

## 10. Evidence / audit trail

| Artefact | Event | Retention | Sensitivity |
|---|---|---|---|
| Per-payment three-way check | `ReconciliationCheckPassed` or `ReconciliationBreak` | Indefinite (Principle 1) | Internal |
| Break classification and investigation | `ReconciliationBreak { breakId, severity, leg, paymentId }` | Indefinite | Internal |
| Break resolution | `ReconciliationBreakResolved` | Indefinite | Internal |
| Correcting journal entry | `JournalEntryPosted { correcting: true }` | Indefinite | Internal |
| Daily reconciliation report | `DailyReconciliationReport` | Indefinite | Internal |
| Operational-risk loss event (material breaks) | `OperationalLossEvent` (PROC-RISK-RCSA-01) | Per RCSA retention | Internal |

## Related procedures

- `Procedures/by-policy/outbound-payment-sponsor-bank-channel.md` (PROC-OPS-PS-01) — emits `PaymentSettled` events that are the primary trigger.
- `Procedures/by-policy/posting-rule-publication.md` (PROC-FIN-AC-01) — owns the posting-rule registry queried in Step 4.
- `Procedures/by-policy/nostro-management.md` (PROC-PAY-NM-01) — nostro-leg data consumed in Step 5; nostro query initiated here when nostro break is detected.
- `Procedures/by-policy/rcsa-cycle.md` (PROC-RISK-RCSA-01) — receives material break findings as operational-risk loss events.

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Tomas + Bea (via Scrooge) | Initial population. Three-way reconciliation (trade / payment / ledger); supplemental nostro-leg check; four break severities; joint Tomas + Bea ownership. Cross-references PROC-OPS-PS-01, PROC-FIN-AC-01, PROC-PAY-NM-01. |
