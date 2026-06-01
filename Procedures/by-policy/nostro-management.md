---
policy-parent: Sponsor-Bank Operating Policy v0.1 (STUB) · Payments Policy v0.1 (STUB) · Funding Strategy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-PAY-NM-01
title: Nostro account management — correspondent balance and settlement feed
author: Tomas (payments engineer) · Eitan (Treasurer)
date: 2026-05-16
owner: Tomas (payments engineer) · Eitan (Treasurer)
status: POPULATED
policy-cited: Sponsor-Bank Operating Policy v0.1 (STUB) · Payments Policy v0.1 (STUB) · Funding Strategy (planned)
system-capability: "@platform/payments/nostro (PLANNED)"
---

# Procedure — Nostro account management — correspondent balance and settlement feed

**Procedure ID:** PROC-PAY-NM-01
**Owner:** Tomas (payments engineer) · Eitan (Treasurer)
**Approval:** ALCO (nostro limits and intraday liquidity integration); BRC (under Sponsor-Bank Operating Policy v0.1 — STUB)
**Cadence:** Daily opening balance feed; continuous intraday monitoring; end-of-day reconciliation against correspondent bank statement; periodic nostro account maintenance
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Sponsor-Bank Operating Policy v0.1 §2 (Outbound payment-instruction relay); §3 (Nostro account operating rules); §5 (Limits and cut-offs).
- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Payments Policy v0.1 §5 (Reconciliation discipline); §3 (Indirect-participant posture).
- Funding Strategy (planned; Eitan, treasury & ALM engineer; to be authored under ALCO governance).

Obligation chain:
```
Regulation (Banks Act Reg 39 — LCR / intraday liquidity → BCBS Intraday Liquidity Monitoring Tools
  → SARB Guidance Note 2/2021 — Intraday Liquidity Management)
  → Policy (Sponsor-Bank Operating Policy v0.1 §3 — Nostro operating rules)
    → This procedure (PROC-PAY-NM-01 — nostro balance feed and reconciliation)
      → System capability (@platform/payments/nostro — PLANNED)
```

> **Named dependency:** PROC-RISK-ILF-01 (intraday-liquidity-funding.md) Step 1 depends on the opening nostro balance feed produced by this procedure. The feed must be available before PROC-RISK-ILF-01's first intraday run each business day.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| Banks Act 94/1990 s.78 | Operational risk management; nostro management failures (feed gaps, unreconciled balances) are operational risk events. |
| Banks Act Regulations, Reg 39 — Liquidity Coverage Ratio | LCR computation includes cash held at correspondent banks (nostro balances); accurate nostro data is a reporting prerequisite. |
| BCBS January 2013 — Monitoring Tools for Intraday Liquidity Management | Metric 1 (daily maximum intraday liquidity usage) requires real-time or near-real-time nostro visibility. |
| SARB Guidance Note 2/2021 — Intraday Liquidity Management | PA expects banks to monitor intraday liquidity positions, including correspondent-held balances, on an intraday basis. |
| Banks Act Regulations, Reg 28 (Reporting) | BA returns incorporate nostro balances; accurate reporting requires reconciled nostro data. |
| IFRS 7 (Financial Instruments: Disclosures) | Liquidity risk disclosures require accurate cash and liquidity data, including nostro balances. |
| POPIA s.19–22 (security of personal information) | Account data obtained from the correspondent is subject to POPIA information-security obligations. |

## 3. Purpose

Govern the acquisition, validation, intraday monitoring, and end-of-day reconciliation of the bank's nostro account balance(s) held at the correspondent bank. The bank's payments model is indirect-participant: all SAMOS, BankservAfrica, and cross-border flows are settled via the correspondent bank's balance sheet. The nostro account is the bank's principal settlement asset for outbound payments and the primary intraday liquidity position indicator.

This procedure has four sub-functions:
- **(a) Opening balance feed** — obtain the opening nostro balance each morning and feed it to PROC-RISK-ILF-01 Step 1.
- **(b) Intraday balance monitoring** — maintain a running projected nostro position from payment events; alert on threshold breaches.
- **(c) End-of-day reconciliation** — reconcile the bank's internal nostro ledger against the correspondent's end-of-day statement.
- **(d) Nostro account maintenance** — manage account-level changes (standing instructions, authorised signatories, operating limits) via the correspondent.

## 4. Trigger

- **Daily opening:** system start each business day — load the opening nostro balance from the correspondent's balance feed or statement.
- **Per `PaymentInitiated` event:** update the projected outbound position (projected balance = opening balance − sum of `PaymentInitiated.amount` not yet settled).
- **Per `PaymentSettled` event:** confirm actual outflow; update confirmed balance; reconcile against projection.
- **Per `CutOffCheckPassed` / `SchemeCycleCheckPassed` event:** consume intraday dispatch events from PROC-PAY-SCO-01 and PROC-PAY-BSC-01 to update projected balance.
- **End-of-day:** after the NPS RTGS afternoon cycle and BankservAfrica final batch close — run full reconciliation against correspondent statement.
- **Alert threshold:** when projected nostro balance falls below the intraday minimum threshold (set by ALCO under the Funding Strategy), emit `NostroAlertThresholdBreached`.
- **Maintenance trigger:** when account details, authorised signatories, or operating limits require amendment — managed by Tomas with Imani (legal & contracts engineer) for operating contract updates.

## 5. Steps

### Sub-function A — Opening balance feed

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| A1 | **Retrieve opening balance.** At system start, query the correspondent's balance API (or parse the MT940 / camt.052 statement received from the correspondent). Parse: `openingBalance`, `currency`, `valueDate`, `accountRef`. | system | `@platform/payments/nostro` (PLANNED — build-phase: synthetic balance from `_sponsor-bank-operating-model.md`) | If the feed is unavailable at system start, Tomas (payments engineer) is alerted immediately; PROC-RISK-ILF-01 Step 1 is blocked until the feed arrives. |
| A2 | **Validate opening balance.** Assert: `currency == ZAR` (or designated nostro currency); `valueDate == today`; balance is ≥ 0; balance is within the ALCO-approved nostro operating range (lower: intraday minimum; upper: excess-balance ceiling per Funding Strategy). | system | `@platform/payments/nostro` | Out-of-range balance alerts Eitan (Treasurer) and Tomas (payments engineer). |
| A3 | **Emit `NostroOpeningBalance` event.** Record: `{ accountRef, openingBalance, currency, valueDate, sourceStatement }`. This event is the named input for PROC-RISK-ILF-01 Step 1. | system | `@platform/payments/nostro`; `@platform/event-store` | PROC-RISK-ILF-01 consumes this event as its Step 1 trigger. Emit before 07:00 SAST target. |

### Sub-function B — Intraday balance monitoring

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| B1 | **Update projected balance on `PaymentInitiated`.** On each `PaymentInitiated` event, subtract the payment amount from the running projected nostro balance. Emit `NostroProjectedUpdate { paymentId, projectedBalance, direction: "debit" }`. | system | `@platform/payments/nostro` | Projected balance may differ from confirmed balance (payments initiated but not yet settled). |
| B2 | **Confirm balance on `PaymentSettled`.** On `PaymentSettled`, record the confirmed outflow. Reconcile projected vs confirmed balance. If they diverge by more than the tolerance (default: ZAR 1 000), emit `NostroProjectionVariance`. | system | `@platform/payments/nostro` | Projection variance > ZAR 50 000 is alerted to Tomas. Persistent variance is a PROC-PAY-RBH-01 finding. |
| B3 | **Monitor intraday threshold.** Continuously compare the confirmed nostro balance (opening balance minus confirmed outflows plus confirmed inflows, per inbound credit entries from the correspondent) against the ALCO-approved intraday minimum threshold. If balance falls below threshold, emit `NostroAlertThresholdBreached { balance, threshold, margin }` and alert Eitan (Treasurer). | system | `@platform/payments/nostro`; `@platform/events/alert-dispatcher` (PLANNED) | Eitan assesses funding options: correspondent intraday credit facility, repo, or treasury flow adjustment. Escalation per PROC-RISK-ILF-01 if liquidity position is stressed. |
| B4 | **Intraday position report.** Every 30 minutes, emit `NostroIntradaySnapshot { time, openingBalance, confirmedOutflows, projectedOutflows, inflows, confirmedBalance, projectedBalance }`. Consumed by Eitan's ALCO reporting and PROC-RISK-ILF-01's BCBS monitoring metrics. | system | `@platform/payments/nostro` | Automated snapshot; no manual step. |

### Sub-function C — End-of-day reconciliation

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| C1 | **Obtain correspondent end-of-day statement.** After the final NPS RTGS settlement cycle and BankservAfrica batch close, retrieve the correspondent's end-of-day balance statement (MT940 or camt.053). Parse: closing balance, all debit and credit entries for the business date, reference identifiers. | system | `@platform/payments/nostro` | Target receipt: within 30 minutes of the correspondent's statement generation time (per operating contract SLA). |
| C2 | **Reconcile statement entries to payment events.** For each debit entry on the statement: match to a `PaymentSettled` event by payment reference / UETR. For each credit entry: match to an inbound payment event (or treasury inflow). Flag unmatched entries as `NostroUnmatchedEntry { direction, amount, statementRef }`. | system | `@platform/payments/nostro`; `@platform/event-store` | Unmatched debit = potential unknown payment — escalate immediately. Unmatched credit = potential inbound not yet booked — escalate to Bea (financial-reporting engineer) for posting. |
| C3 | **Reconcile closing balance.** Assert: correspondent closing balance = opening balance − total confirmed outflows + total confirmed inflows (per bank's own event log). Tolerance: zero (any difference is a break). If break detected, emit `NostroReconciliationBreak` and escalate per §7. | system + Tomas (payments engineer) | `@platform/payments/nostro` | `NostroReconciliationBreak` is also consumed by PROC-PAY-RBH-01 as a nostro-leg break. |
| C4 | **Emit `NostroEoDReconciliationComplete`.** On clean reconciliation, record: `{ date, openingBalance, closingBalance, totalOutflows, totalInflows, entryCount, matchedCount, unmatchedCount }`. Feed to PROC-RISK-ILF-01 and Bea's month-end close (PROC-FIN-MC-01 — planned). | system | `@platform/payments/nostro`; `@platform/event-store` | If unmatched entries remain outstanding, the event is emitted with `status: "partial"` and the outstanding items are listed. Full clean-up must occur before next business day's opening. |

### Sub-function D — Nostro account maintenance

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| D1 | **Trigger:** operational need — limit amendment, signatory change, account-structure update. | Tomas (payments engineer) + Eitan (Treasurer) | n/a | Changes require ALCO pre-approval (limit changes) or BRC approval (structural changes). |
| D2 | **Draft change instruction.** Tomas documents the required change; Imani (legal & contracts engineer) confirms the change is within the scope of the correspondent operating contract or raises a contract amendment. | Tomas (payments engineer) + Imani (legal & contracts engineer) | `@platform/legal/clause-library` (Imani's substrate — PLANNED) | If contract amendment is required, it flows through Imani's contracting process. |
| D3 | **ALCO or BRC approval.** Obtain the required governance approval. Record the approval as a `CeoDecision` or ALCO-minute artefact. | Eitan (Treasurer) [ALCO], Devon (COO, governance) [BRC] | `@platform/decisions/record` | Limit changes: ALCO. Structural or contractual changes: BRC. |
| D4 | **Submit change to correspondent.** Tomas submits the approved change instruction to the correspondent. Record `NostroAccountMaintenanceSubmitted { changeType, correspondentRef, approvedBy }`. | Tomas (payments engineer) | n/a — external correspondent channel | |
| D5 | **Confirm and update internal records.** On correspondent confirmation, update the nostro account profile in `_sponsor-bank-operating-model.md` and emit `NostroAccountMaintenanceConfirmed`. | Tomas (payments engineer) | `@platform/payments/nostro` | Imani updates the clause-library record if the contract was amended. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Tomas (payments engineer) | Primary owner of the nostro balance feed, intraday monitoring engine, and EoD reconciliation; manages correspondent channel for account maintenance; escalates threshold breaches and reconciliation breaks. |
| Eitan (Treasurer) | Co-owner; consumes opening balance and intraday snapshots for PROC-RISK-ILF-01 and ALCO reporting; assesses funding responses to threshold breaches; approves limit changes at ALCO. |
| Bea (financial-reporting engineer) | Receives unmatched credit entries from C2 for accounting posting; co-owner of PROC-PAY-RBH-01 for nostro-leg breaks. |
| Imani (legal & contracts engineer) | Custodian of the correspondent operating contract; reviews and co-ordinates nostro account maintenance change requests. |
| Devon (COO, governance) | Receives escalation for nostro reconciliation breaks and structural account changes; BRC approver for structural changes. |
| Helena (Chief Risk Officer, governance) | Receives material nostro breaks as operational-risk findings; RCSA integration via PROC-RISK-RCSA-01. |
| Camille (CFO, governance) | Notified if nostro balance affects LCR computation or BA-return figures. |

## 7. Escalation

| Condition | Escalation path | SLA |
|---|---|---|
| Opening balance feed unavailable at system start | Tomas → Atlas (infrastructure engineer) + Eitan (treasury) — PROC-RISK-ILF-01 Step 1 blocked | Immediate (< 5 min) |
| Opening balance out of ALCO-approved range | Tomas + Eitan → ALCO chair (Devon, COO) | Within 30 minutes |
| Intraday balance breaches minimum threshold | Eitan → ALCO chair; fund via correspondent credit facility or repo | Within 15 minutes |
| Projection variance > ZAR 50 000 | Tomas alert; investigate; escalate to Bea (financial-reporting engineer) if ledger-leg | Within 1 hour |
| EoD unmatched debit (unknown payment) | Tomas → Devon (COO) + Camille (CFO) + Helena (CRO) | Immediate |
| EoD unmatched credit > ZAR 10 000 | Tomas → Bea (financial-reporting engineer) for posting | Before next business day open |
| `NostroReconciliationBreak` (balance mismatch) | Tomas + Eitan → Devon (COO) + Camille (CFO) + Helena (CRO) — operational loss event | Within 2 hours of detection |
| Correspondent statement not received within 60 min of expected time | Tomas → correspondent bank operations desk; alert Devon (COO) | Within 60 min of SLA miss |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/payments/nostro` | PLANNED | Opening balance feed parser; intraday projection engine; EoD reconciliation; account maintenance records. |
| `@platform/event-store` | In place | All nostro events are first-class typed events (Principle 1). |
| `@platform/events/alert-dispatcher` | PLANNED | Delivers threshold-breach and break alerts to Tomas and Eitan. |
| `@platform/payments/reconciliation` | PLANNED | Consumes nostro events for PROC-PAY-RBH-01 nostro-leg checks. |
| `@platform/legal/clause-library` | PLANNED (Imani-owned) | Correspondent operating contract; nostro account-maintenance clause. |
| `@platform/alm/intraday-liquidity-engine` | PLANNED (PROC-RISK-ILF-01 substrate) | Consumes `NostroOpeningBalance` and `NostroIntradaySnapshot` events. |

Build-phase: nostro substrate reads synthetic balances from `_sponsor-bank-operating-model.md`. Production: live MT940 / camt.052 / camt.053 feed from correspondent.

## 9. Quality controls

- **Opening balance SLA:** `NostroOpeningBalance` event emitted by 07:00 SAST; PROC-RISK-ILF-01 Step 1 is blocked until it arrives.
- **EoD reconciliation clean-state target:** zero unmatched entries and zero balance breaks at end-of-day, every business day. Persistent unmatched entries are reported to BRC.
- **Threshold review cadence:** ALCO reviews the intraday minimum threshold and excess-balance ceiling at each quarterly session (or more frequently if the payments book grows materially).
- **Statement receipt SLA KRI:** correspondent statement not received within 60 minutes of expected time is a Red KRI; reported to BRC.
- **Nostro break KRI:** any `NostroReconciliationBreak` in a calendar month is a Red KRI.

## 10. Evidence / audit trail

| Artefact | Event | Retention | Sensitivity |
|---|---|---|---|
| Opening balance feed | `NostroOpeningBalance` | Indefinite (Principle 1) | Internal — confidential |
| Intraday snapshots | `NostroIntradaySnapshot` | Indefinite | Internal — confidential |
| Projection updates | `NostroProjectedUpdate` | Indefinite | Internal |
| Threshold breach | `NostroAlertThresholdBreached` | Indefinite | Internal |
| EoD reconciliation complete | `NostroEoDReconciliationComplete` | Indefinite | Internal — confidential |
| Unmatched entries | `NostroUnmatchedEntry` | Indefinite | Internal — confidential |
| Break events | `NostroReconciliationBreak` | Indefinite | Internal — confidential |
| Account maintenance record | `NostroAccountMaintenanceSubmitted` / `NostroAccountMaintenanceConfirmed` | Indefinite | Internal — confidential |
| Operational loss event (material breaks) | `OperationalLossEvent` (PROC-RISK-RCSA-01) | Per RCSA retention | Internal |

## Related procedures

- `Procedures/by-policy/intraday-liquidity-funding.md` (PROC-RISK-ILF-01) — named dependency: Step 1 consumes `NostroOpeningBalance` event. Intraday snapshots feed the BCBS monitoring metrics.
- `Procedures/by-policy/outbound-payment-sponsor-bank-channel.md` (PROC-OPS-PS-01) — `PaymentInitiated` and `PaymentSettled` events drive intraday balance updates (sub-function B).
- `Procedures/by-policy/reconciliation-break-handling.md` (PROC-PAY-RBH-01) — `NostroReconciliationBreak` is consumed as a nostro-leg break; PROC-PAY-RBH-01 Step 5 queries this procedure's nostro feed.
- `Procedures/by-policy/correspondent-cut-off.md` (PROC-PAY-SCO-01) — `CutOffCheckPassed` events update projected nostro balance.
- `Procedures/by-policy/bankserv-cycle.md` (PROC-PAY-BSC-01) — `SchemeCycleCheckPassed` events update projected nostro balance.

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Tomas + Eitan (via Scrooge) | Initial population. Four sub-functions: opening balance feed, intraday monitoring, EoD reconciliation, account maintenance. Named dependency from PROC-RISK-ILF-01 Step 1. Indirect-participant posture; correspondent-statement-based. |
