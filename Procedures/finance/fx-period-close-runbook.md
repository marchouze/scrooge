---
procedureId: PROC-FIN-FXPC-01
title: FX spot end-of-day and period-close runbook
author: Bea (Financial-Reporting Engineer) · Anya (Data Engineer)
date: 2026-05-16
owner: Bea (Financial-Reporting Engineer) · Anya (Data Engineer)
status: POPULATED
version: "0.2"
last-updated: "2026-05-18"
policy-cited: Financial Reporting Policy (planned)
system-capability: "@platform/finance/fx-subledger (PLANNED)"
citations:
  - IAS 21
  - IFRS 9
  - D-MARKETS-SCHEMA-FOUNDATION
---

# Procedure — FX spot end-of-day and period-close runbook

**Procedure ID:** PROC-FIN-FXPC-01
**Owner:** Bea (Financial-Reporting Engineer) · Anya (Data Engineer)
**Approval:** CFO (Bea) — Financial Reporting Policy (planned)
**Cadence:** Daily (EOD at 16:30 SAST); period-end (monthly, quarterly, annual)
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Financial Reporting Policy (planned; Bea co-author; CFO approval required at commencement).
- IAS 21 — The Effects of Changes in Foreign Exchange Rates — requires FX positions to be revalued at closing rates at each reporting date.
- IFRS 9 §4.1.4 — financial instruments held at fair value through profit or loss (FVTPL) must be marked to market daily; FX spot positions are classified FVTPL.

The obligation chain:

```
Regulation (IAS 21 — closing-rate method; IFRS 9 §4.1.4 — FVTPL daily marking)
  → Financial Reporting Policy (planned)
    → PROC-FIN-FXPC-01 (this procedure)
      → @platform/finance/fx-subledger (PLANNED)
        → FxPositionRevalued events + trial balance snapshot
```

**Build-phase posture:** No live trades. EOD runbook is built and tested with synthetic positions during the build phase to confirm the full revaluation chain works end-to-end before commencement of trading.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| IAS 21.23 | At each reporting date, foreign currency monetary items shall be translated using the closing rate. |
| IAS 21.28 | Exchange differences arising on the settlement or translation of monetary items are recognised in profit or loss. |
| IFRS 9 §4.1.4 | Financial instruments classified as FVTPL are measured at fair value at each reporting date; changes in fair value are recognised immediately in profit or loss. |
| IFRS 9 §5.7.1 | Gains and losses on FVTPL financial instruments are recognised in profit or loss in the period in which they arise. |
| Banks Act 94 (BA returns) | Daily positions must feed into the BA 325 (market risk) and BA 700 (balance sheet) returns; subledger must be current at COB each day. |

## System event chain (automated)

The following runs automatically via Bea's GL posting engine before manual steps begin:

1. Rate feed → `FxPositionRevalued` emitted per open trade (rate source: FX sim in build phase; WM-Fix / Bloomberg BFIX in production)
2. `bea-gl-posting-engine` processes `FxPositionRevalued` → PR-FX-002 → `SubLedgerPostingEmitted`
3. `computeTrialBalance` reads `SubLedgerPostingEmitted` → trial balance updated (unrealised P&L per currency pair)
4. Period-close projection aggregates all `SubLedgerPostingEmitted` events → current GL state

Manual runbook steps begin after step 4 completes.

**Policy authority:** [`Policies/accounting-policies-ifrs-v1.md`](../../Policies/accounting-policies-ifrs-v1.md) §3.1C (rate hierarchy); §3.1B (derecognition on `FxSettlementConfirmed`).  
**Posting rules:** PR-FX-002 (daily MTM revaluation); PR-FX-003 (settlement / derecognition).  
**System capability:** `@platform/finance/bea-gl-posting-engine` (live — Slice 2 / PR #550); `computeTrialBalance` (live).

## 3. Purpose

1. Execute the end-of-day revaluation of all FX spot positions at the closing rate (IAS 21 closing-rate method) each business day at 16:30 SAST.
2. Emit typed `FxPositionRevalued` events for every open FX spot position, creating an immutable revaluation record.
3. Update the `fxSubLedgerProjection` so that the balance sheet and P&L reflect current market values.
4. Run the IFRS 9 classifier to confirm FVTPL designation for each position is maintained.
5. Generate a trial balance snapshot at COB for Bea's review and any required correcting-entry processing.
6. Support monthly, quarterly, and annual period-close by providing complete, reconciled FX subledger data to the consolidation process.

## 4. Trigger

- **Daily EOD:** `EodRevaluationTriggered { date, time: '16:30 SAST', currency: 'ZAR', triggerSource: 'scheduler' }` — emitted by the scheduler at 16:30 SAST on each business day.
- **Period-end:** `PeriodEndRevaluationTriggered { period: 'Month' | 'Quarter' | 'Year', periodEndDate }` — emitted at the close of each reporting period.
- **Manual trigger:** `ManualRevaluationRequested { reason, requestedBy: Bea, requestedAt }` — for ad-hoc revaluations.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **16:30 SAST — EOD revaluation trigger fires:** Anya (Data Engineer) monitors the scheduler; confirms the trigger fires within 2 minutes of 16:30; if the trigger is missed, Anya initiates manual trigger immediately | `agent` (Anya — Data Engineer) | `@platform/scheduler` | Trigger-lateness threshold: 2 minutes. Trigger missed > 10 minutes is an incident; Anya notifies Devon (COO) and Bea. |
| 2 | **Closing-rate fetch:** Anya's pipeline fetches the official SARB daily closing rate for each currency pair with open FX positions; rate source is SARB daily fixing or Bloomberg Reference Rate; rate is stored as `ClosingRateFetched { date, currencyPair, closingRate, rateSource, fetchedAt }` | `agent` (Anya) | `@platform/market-data/rate-feed` (PLANNED) | SARB daily fixing is the primary rate source (IAS 21). Bloomberg Reference Rate is the fallback. If no rate is available: Bea is notified; revaluation is deferred until rate is confirmed. |
| 3 | **FX position revaluation:** For each open FX spot position, the subledger engine computes: (a) position notional in foreign currency; (b) closing rate × notional = ZAR equivalent; (c) prior day ZAR equivalent; (d) daily P&L = (closing rate − prior rate) × notional; emits `FxPositionRevalued { positionId, tradeId, currencyPair, notionalFcy, closingRate, zarEquivalent, dailyPnlZar, revaluedAt }` for each position | `agent` (Anya) | `@platform/finance/fx-subledger` (PLANNED) | One `FxPositionRevalued` event per open position per day. Positions opened same-day are revalued at EOD closing rate vs. execution rate. |
| 4 | **fxSubLedgerProjection update:** The `fxSubLedgerProjection` ingests the `FxPositionRevalued` events and updates: (a) FX assets/liabilities at closing rate; (b) accumulated translation reserve (IAS 21.28); (c) daily P&L — FVTPL (IFRS 9 §5.7.1) | `agent` | `@platform/finance/fx-subledger` (PLANNED) | Projection must be updated within 5 minutes of the last `FxPositionRevalued` event for the day. Lateness is monitored by Anya. |
| 5 | **IFRS 9 classifier run:** The IFRS 9 classifier checks each FX spot position against the business model test (trading book → FVTPL) and the SPPI test (FX spot: pass for standard spot contracts); confirms FVTPL designation; emits `Ifrs9ClassificationConfirmed { positionId, classification: 'FVTPL', sppiPass: true, businessModelTest: 'TradingBook', confirmedAt }` | `agent` | `@platform/finance/ifrs9-classifier` (PLANNED) | IFRS 9 classifier runs after each revaluation cycle. Any position that fails the SPPI test is flagged for Bea's review; potential reclassification to fair value through OCI (FVOCI) if eligible. |
| 6 | **Trial balance snapshot:** After all `FxPositionRevalued` events are processed, the system generates a trial balance snapshot: FX assets, FX liabilities, daily FX P&L, translation reserve, net FX position; snapshot stored in doc store (BLAKE3-addressed) | `agent` | `@platform/finance/fx-subledger` (PLANNED) | Snapshot event: `TrialBalanceSnapshotGenerated { date, fxAssets, fxLiabilities, dailyPnlZar, translationReserve, netFxPosition, snapshotHash, generatedAt }`. |
| 7 | **Bea reviews FVTPL journal entries:** Bea (Financial-Reporting Engineer) reviews the trial balance snapshot; assesses whether any FVTPL P&L entries require manual journal corrections (e.g. late trades, trade amendments, rate errors); approves or flags corrections | `human` (Bea — Financial-Reporting Engineer) | `@platform/finance/gl-journal` (PLANNED) | Bea's review must complete within 30 minutes of trial balance generation. Corrections must be documented in a `JournalCorrectionApproved { correctionId, reason, approvedBy: Bea, approvedAt }` event. |
| 8 | **Correcting entries:** If corrections are required: Bea emits `CorrectingJournalEntry { entryId, correctionId, debit, credit, amount, correctionReason, enteredBy: Bea, enteredAt }`; `fxSubLedgerProjection` is updated; a revised trial balance snapshot is generated | `human` (Bea) | `@platform/finance/gl-journal` (PLANNED) | Correcting entries are documented and immutable. No silent overwriting of positions. |
| 9 | **EOD cycle closure:** Bea confirms the EOD cycle is complete by emitting `EodRevaluationCompleted { date, positionsRevalued, correctingEntriesCount, netFxPositionZar, completedAt, completedBy: Bea }`; this is the terminal event for the daily cycle | `human` (Bea) | `@platform/event-store` | EOD cycle must be completed by 18:00 SAST. Late completion is notified to Devon (COO). |
| 10 | **Period-close (monthly/quarterly/annual):** On `PeriodEndRevaluationTriggered`: repeat the daily revaluation using the period-end closing rate; generate a period-end trial balance; Bea runs additional period-close checks: (a) accrued interest on FX-denominated instruments; (b) IAS 21 translation reserve movement; (c) IFRS 9 expected-credit-loss (ECL) estimate; (d) disclosure note preparation | `human` (Bea) + `agent` (Anya) | `@platform/finance/fx-subledger` (PLANNED) | Period-close subledger must be completed before the consolidation timetable deadline. Timetable is set by the CFO (Bea) at each period start. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Anya (Data Engineer) | Scheduler monitoring; closing-rate fetch; revaluation engine execution; subledger projection update; IFRS 9 classifier run; trial balance generation |
| Bea (Financial-Reporting Engineer) | FVTPL journal entry review; correcting entries; EOD cycle sign-off; period-close checks |
| Devon (COO) | Escalation recipient for EOD lateness; incident response |
| Vera (internal audit engineer, governance) | Daily assertion that every open FX position has a `FxPositionRevalued` event at EOD; period-close completeness check |

## 7. Escalation

| Trigger | Escalation path | Timing |
|---|---|---|
| EOD trigger missed > 10 minutes | Anya → Bea → Devon; manual trigger initiated | 10 minutes |
| Closing rate unavailable | Anya → Bea; revaluation deferred; Bea approves fallback rate | Per Bea's judgment |
| IFRS 9 classifier flags reclassification | Bea review; potential CFO escalation | Within 1 business day |
| EOD cycle not completed by 18:00 | Bea → Devon → Marc if > 21:00 | 18:00 |
| Material correcting entry (> R1m) | Bea → Devon (COO); documented as a significant error event | Before EOD sign-off |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/finance/fx-subledger` | PLANNED | Position revaluation, trial balance, period-close |
| `@platform/market-data/rate-feed` | PLANNED | SARB daily closing rate; Bloomberg fallback |
| `@platform/finance/ifrs9-classifier` | PLANNED | FVTPL classification confirmation |
| `@platform/finance/gl-journal` | PLANNED | Correcting journal entries |
| `@platform/scheduler` | PLANNED | EOD trigger at 16:30 SAST |
| `@platform/event-store` | Live | All revaluation and close events |

## 9. Quality controls

- Every open FX position must have a `FxPositionRevalued` event each business day. Vera asserts this by comparing open positions at COB to the day's `FxPositionRevalued` events.
- Every `FxPositionRevalued` event must reference a valid `ClosingRateFetched` event for that day and currency pair.
- `EodRevaluationCompleted` must be emitted by 18:00 SAST. Lateness is a Vera finding.
- Period-close must be completed within the CFO-set timetable. Overdue period-close is a Vera finding.

## 10. Evidence / audit trail

| Artefact | Location | Retention | Notes |
|---|---|---|---|
| `ClosingRateFetched` | Event log | 7 years | Rate source record |
| `FxPositionRevalued` | Event log | 7 years | Per-position revaluation record |
| `Ifrs9ClassificationConfirmed` | Event log | 7 years | IFRS 9 designation evidence |
| `TrialBalanceSnapshotGenerated` | Event log + doc store | 7 years | Daily balance sheet snapshot |
| `JournalCorrectionApproved` | Event log | 7 years | Correcting entry audit trail |
| `EodRevaluationCompleted` | Event log | 7 years | Daily cycle sign-off |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Devon (Chief Operating Officer, governance) | Initial POPULATED — 16:30 SAST EOD trigger, closing-rate fetch, position revaluation, fxSubLedgerProjection, IFRS 9 classifier, trial balance, Bea FVTPL review, correcting entries, EOD sign-off, period-close; IAS 21 + IFRS 9 §4.1.4 sourcing. |
| v0.2 | 2026-05-18 | Owen (Company Secretary, governance) | Added "System event chain (automated)" section: four-step automated sequence (rate feed → FxPositionRevalued → bea-gl-posting-engine → PR-FX-002 → SubLedgerPostingEmitted → computeTrialBalance → GL state) that precedes manual steps. Cross-referenced accounting policy §3.1B/§3.1C and posting rules PR-FX-002/PR-FX-003. Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN. |
