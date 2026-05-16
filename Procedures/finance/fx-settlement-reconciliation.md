---
procedureId: PROC-FIN-FXSR-01
title: FX spot three-way settlement reconciliation
author: Tomas (Operations & Payments Engineer) · Bea (Financial-Reporting Engineer)
date: 2026-05-16
owner: Tomas (Operations & Payments Engineer) · Bea (Financial-Reporting Engineer)
status: POPULATED
version: "0.1"
last-updated: "2026-05-16"
policy-cited: Settlement and Reconciliation Policy (planned)
system-capability: "@platform/operations/reconciliation-engine (PLANNED)"
citations:
  - D-MARKETS-SCHEMA-FOUNDATION
  - IFRS 9
  - Banks Act Regulation 39
---

# Procedure — FX spot three-way settlement reconciliation

**Procedure ID:** PROC-FIN-FXSR-01
**Owner:** Tomas (Operations & Payments Engineer) · Bea (Financial-Reporting Engineer)
**Approval:** COO (Devon) — Settlement and Reconciliation Policy (planned)
**Cadence:** Per-settlement (triggered by `FxSettlementConfirmed`); daily COB summary report
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Settlement and Reconciliation Policy (planned; Tomas + Bea co-authors; Devon/COO approval required at commencement).
- IFRS 9 §5.3 — derecognition of financial assets requires confirmed settlement; subledger must reflect settlement accurately.

The obligation chain:

```
Regulation (IFRS 9 §5.3 — derecognition on settlement; Banks Act — settlement integrity)
  → Settlement and Reconciliation Policy (planned)
    → PROC-FIN-FXSR-01 (this procedure)
      → @platform/operations/reconciliation-engine (PLANNED)
        → ReconciliationBreak / DailyReconciliationReport events
```

**Break tolerance:** Zero on amount. Timing breaks (correspondent bank processing delay) self-correct within 4 hours before escalation.

**Build-phase posture:** Reconciliation engine is tested with synthetic settlement confirmations during the build phase to confirm the three-way matching logic works correctly.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| IFRS 9 §5.3.2 | A financial asset is derecognised when the contractual rights to the cash flows expire or the asset is transferred; settlement confirmation is the trigger for derecognition in FX spot. |
| IFRS 7.25 | Disclosures on financial instrument fair values require that settlement differences are tracked and resolved. |
| Banks Act (general) | Settlement integrity is a prudential requirement; unresolved breaks must be reported to management and remediated. |
| SARB FinSurv | Settled FX trades must be reflected accurately in FinSurv reports; breaks that affect reported settlement volumes must be corrected before submission. |

## 3. Purpose

1. Perform a three-way reconciliation for every FX spot settlement: (a) trade leg — `FxTradeExecuted` event; (b) payment leg — `FxSettlementConfirmed` event from correspondent bank; (c) GL — `fxSubLedgerProjection` entry.
2. Detect any breaks between the three legs within 30 minutes of settlement confirmation.
3. Emit `ReconciliationBreak` events for every mismatch to create an immutable break log.
4. Tomas investigates and resolves breaks; Bea applies correcting GL entries if required.
5. Produce a `DailyReconciliationReport` event at COB summarising the day's settlement activity, breaks, and resolutions.
6. Support accurate FinSurv reporting (PROC-FIN-FXFS-01) by ensuring the settled-trade record is correct before submission.

## 4. Trigger

- **Per settlement:** `FxSettlementConfirmed { settlementId, tradeId, counterpartyId, buyLeg: { currency, amount, settledAt }, sellLeg: { currency, amount, settledAt }, correspondentRef, confirmedAt }` — emitted by Tomas's correspondent interface when settlement is confirmed.
- **Daily COB report:** `CobReportDue { date, reportType: 'FxSettlementReconciliation' }` — emitted by scheduler at COB each business day.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Receive settlement confirmation:** On `FxSettlementConfirmed`: reconciliation engine retrieves the corresponding `FxTradeExecuted { tradeId }` event (leg 1 — trade leg) and the current `fxSubLedgerProjection` entry for this tradeId (leg 3 — GL leg) | `agent` | `@platform/operations/reconciliation-engine` (PLANNED) | If no `FxTradeExecuted` event exists for the tradeId in `FxSettlementConfirmed`: immediate `ReconciliationBreak { kind: 'NoTradeRecord' }` emitted and Tomas alerted. |
| 2 | **Three-way match:** Compare the three legs for each currency in the FX trade: (a) trade leg — agreed buy and sell amounts from `FxTradeExecuted`; (b) payment leg — settled amounts from `FxSettlementConfirmed`; (c) GL leg — subledger carry amount for this trade; all three must match within zero tolerance on amount | `agent` | `@platform/operations/reconciliation-engine` (PLANNED) | Zero tolerance on amount. Timing differences (settlement confirmed on T+2 but subledger updated on T+1) are treated as timing breaks pending 4-hour self-correction. |
| 3 | **No break — clean pass:** If all three legs match: emit `ReconciliationPassed { settlementId, tradeId, matchedAt }` | `agent` | `@platform/event-store` | No further action required. `ReconciliationPassed` closes the reconciliation for this settlement. |
| 4 | **Break detected:** If any leg mismatch is found: emit `ReconciliationBreak { breakId, settlementId, tradeId, breakKind: 'AmountMismatch' | 'TimingBreak' | 'NoTradeRecord' | 'GlEntryMissing', leg1Amount, leg2Amount, leg3Amount, detectedAt }` | `agent` | `@platform/event-store` | `ReconciliationBreak` is immediately surfaced on Tomas's operations dashboard. Multiple breaks for the same trade are stacked under a single `breakId`. |
| 5 | **Tomas investigates:** Tomas (Operations & Payments Engineer) investigates the break: reviews correspondent bank SWIFT MT202/MT103 messages; checks trade confirmation vs. settlement instruction; identifies root cause: (a) correspondent delay; (b) SWIFT routing error; (c) trade capture error; (d) GL subledger lag | `human` (Tomas — Operations & Payments Engineer) | `@platform/operations/swift-gateway` (PLANNED) | Tomas must emit `ReconciliationBreakInvestigated { breakId, rootCause, investigatedAt }` within 1 hour of break detection. |
| 6 | **Timing break auto-resolution:** For `breakKind: 'TimingBreak'`: reconciliation engine polls for the expected leg update every 30 minutes; if the missing leg arrives within 4 hours: `ReconciliationBreak` is automatically resolved as `ReconciliationBreakResolved { breakId, resolution: 'TimingSelfCorrected', resolvedAt }` | `agent` | `@platform/operations/reconciliation-engine` (PLANNED) | Timing breaks that do not self-correct within 4 hours are escalated to Tomas for manual investigation (step 5). |
| 7 | **GL correcting entry (Bea):** If the break is a GL entry error (subledger amount incorrect): Tomas raises a correcting-entry request to Bea; Bea reviews and, if approved, emits `CorrectingJournalEntry { entryId, tradeId, correctionReason, amount, approvedBy: Bea, enteredAt }` | `human` (Bea — Financial-Reporting Engineer) | `@platform/finance/gl-journal` (PLANNED) | GL correcting entries require Bea's explicit approval. Tomas cannot directly modify the GL; all corrections route through Bea. |
| 8 | **Break resolution:** Once root cause is addressed and all three legs match: Tomas emits `ReconciliationBreakResolved { breakId, tradeId, resolution, correctingEntryId (if applicable), resolvedBy: Tomas, resolvedAt }` | `human` (Tomas) | `@platform/event-store` | All breaks must be resolved within 4 business hours for timing breaks; within 2 business days for other breaks. Overdue breaks are escalated (step 9). |
| 9 | **Escalation for persistent breaks:** Breaks not resolved within the tolerance window: Tomas → Devon (COO) → Helena (CRO) if exposure-impacting → Bea for potential period-close impact | `human` (Tomas → Devon → Helena → Bea as applicable) | None | Devon is notified of any break open > 4 hours. Helena is notified if the break involves a position > R5m. |
| 10 | **Daily reconciliation report:** At COB, on `CobReportDue`: reconciliation engine generates `DailyReconciliationReport { date, settlementsProcessed, reconciliationsPassed, breaksDetected, breaksResolved, breaksOutstanding, netExposureBreaksZar, reportGeneratedAt }`; Tomas reviews and confirms | `agent` (Tomas confirms) | `@platform/operations/reconciliation-engine` (PLANNED) | Daily report is an input to PROC-FIN-FXFS-01 (FinSurv submission) and to Bea's EOD runbook (PROC-FIN-FXPC-01). Outstanding breaks are highlighted. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Tomas (Operations & Payments Engineer) | Correspondent connectivity; break investigation; break resolution event emission; daily report review |
| Bea (Financial-Reporting Engineer) | GL correcting entry review and approval; period-close impact assessment |
| Anya (Data Engineer) | Reconciliation engine operation; timing-break polling; break detection monitoring |
| Devon (COO) | Escalation recipient for breaks > 4 hours |
| Helena (CRO) | Escalation recipient for exposure-impacting breaks > R5m |
| Vera (internal audit engineer, governance) | Daily assertion that every `FxSettlementConfirmed` has a downstream `ReconciliationPassed` or `ReconciliationBreakResolved` |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| Break not resolved in 4 business hours | Tomas → Devon (COO) | 4 hours |
| Break with exposure > R5m | Devon → Helena (CRO) → Marc if > R50m | Immediate |
| Correspondent bank SWIFT message missing | Tomas contacts correspondent bank; Devon informed | Immediate |
| GL correcting entry > R1m | Bea → Devon | Before entry |
| Outstanding breaks at period-close | Bea + Tomas + Devon; resolved before period-close sign-off | Per period-close timetable |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/operations/reconciliation-engine` | PLANNED | Three-way match; break detection; timing-break polling; daily report |
| `@platform/operations/swift-gateway` | PLANNED | SWIFT MT202/MT103 message interface; correspondent confirmations |
| `@platform/finance/gl-journal` | PLANNED | GL correcting entries |
| `@platform/event-store` | Live | All reconciliation events |

## 9. Quality controls

- Every `FxSettlementConfirmed` must produce either a `ReconciliationPassed` or a `ReconciliationBreak` within 30 minutes. Vera asserts this invariant daily.
- Zero-tolerance on amount breaks: no break on settlement amount is acceptable without a `ReconciliationBreakResolved` event.
- `DailyReconciliationReport` must be emitted by COB each business day. Missing report is a Vera finding.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `FxSettlementConfirmed` | Event log | 7 years | Settlement leg record |
| `ReconciliationPassed` | Event log | 7 years | Clean-pass record |
| `ReconciliationBreak` | Event log | 7 years | Break detection record |
| `ReconciliationBreakInvestigated` | Event log | 7 years | Root-cause investigation trail |
| `ReconciliationBreakResolved` | Event log | 7 years | Break resolution record |
| `CorrectingJournalEntry` | Event log | 7 years | GL correction audit trail |
| `DailyReconciliationReport` | Event log | 7 years | COB summary |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — FxSettlementConfirmed trigger, three-way trade/payment/GL match, ReconciliationBreak events, Tomas investigation, Bea GL corrections, timing-break 4h self-correction, daily COB report; zero-amount-break tolerance; IFRS 9 derecognition sourcing. |
