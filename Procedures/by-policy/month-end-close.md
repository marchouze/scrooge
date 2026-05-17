---
status: POPULATED
---
# Procedure — Month-End Close

**Procedure ID:** PROC-FIN-MC-01
**Owner:** Camille (Chief Financial Officer, governance) · Bea (Financial reporting engineer)
**Approval:** BRC
**Cadence:** Monthly (automated at 17:00 SAST on the last business day of each calendar month)
**Version:** v1.2 — 2026-05-17
**Status:** POPULATED
**Applies-at:** LICENCE-BIND

---

## 1. Source policy

- `Policies/regulatory-reporting-policy-v1.md` — Regulatory Reporting Policy v1 (period-close gates the BA return timeline).
- `Policies/accounting-policies-ifrs-v1.md` — Accounting Policies (IFRS) v1 (accrual basis; IFRS 9 ECL; IAS 1 period-end requirements).

## 2. Source regulation(s)

| Regulation | Section | Obligation |
|---|---|---|
| Banks Act 94 of 1990 | s90 | Accounting records: every bank must keep records of all financial transactions sufficient to explain the bank's financial position; records must support preparation of annual financial statements. |
| IAS 1 — Presentation of Financial Statements | All | Requires complete, consistent period-end financial statements; comparative periods; going-concern assessment; accrual basis of accounting. |
| IFRS 9 — Financial Instruments | All | Requires expected credit loss (ECL) staging, fair-value measurement, and hedging designations to be reflected in each reporting period's financial statements. |
| PA BA returns (Prudential Authority monthly reporting) | Various BA forms | Banks must submit BA returns (BA100, BA300, BA600, BA610 etc.) within prescribed timelines each month; period-close data feeds the returns. |

## 3. Purpose

Orchestrate the month-end accounting close: freeze the trading period; perform and attest the general ledger reconciliation; post accruals and provisions (including IFRS 9 ECL); produce a balanced trial balance; obtain CFO sign-off; emit the `PeriodClosed` event that gates downstream regulatory return generation (PROC-FIN-BA-01) and management reporting. This procedure ensures every accounting period is closed in a controlled, auditable sequence that satisfies Banks Act s90 records requirements and feeds the PA's monthly BA returns on time.

## 4. Trigger

- **Scheduled:** Automated scheduler fires at 17:00 SAST on the last business day of each calendar month. The scheduler emits `PeriodCloseInitiated` to begin the sequence.
- **Manual override:** Camille (Chief Financial Officer, governance) may initiate an early close or a re-open-and-reclose cycle (e.g., following a material error discovered post-close) by emitting `PeriodCloseInitiated` with `trigger_type: 'manual'` and a documented reason.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| MC1 | Emit `PeriodCloseInitiated { period, trigger_type, initiated_at, initiated_by }` event. Set period status to `CLOSING` in the GL. No new trade events may post to this period after this step. | `system` | `prototype/platform/accounting/period-close-handler.ts` → `openPeriod` (✓ wired) | The `period` field is the ISO 8601 year-month (e.g., `2026-05`). All in-flight trade events with `value_date` ≤ last day of period must complete posting before this event is emitted. |
| MC2 | Pre-close check — trade events: query the event store for any trade events with `value_date` within the closing period that have not yet posted to the GL. If any are outstanding, hold the close and alert Bea. | `system` | `prototype/platform/accounting/unposted-trades-check.ts` → `checkUnpostedTrades` (✓ wired) | SLA: all trade events must be posted within 2 hours of period-close initiation. If unresolved after 2 hours, Camille decides whether to proceed (with documented exception) or delay. |
| MC3 | Pre-close check — suspense accounts: query all suspense accounts for non-zero balances. Each suspense balance must have a documented clearing instruction before the GL is frozen. | Bea (agent) | `prototype/platform/accounting/suspense-report.ts` → `generateSuspenseReport` (✓ wired) | Suspense accounts with balances older than 3 business days are a pre-existing finding; they must be cleared or formally approved as period-end carryovers by Camille before close proceeds. |
| MC4 | Freeze the accounting period: set period status to `FROZEN` in the GL. No further postings to the closing period are permitted after this step (system-enforced). | `system` | `prototype/platform/accounting/period-close-handler.ts` → period freeze via `closePeriod` (✓ wired) | The freeze is system-enforced; any attempt to post to a `FROZEN` period returns an error and emits a `PostingBlockedFrozenPeriod` event for Vera's review. |
| MC5 | Run GL reconciliation: cross-reference all sub-ledger balances (loans, securities, derivatives, deposits) against their GL control accounts. Produce a reconciliation report listing any breaks. | `system` + Bea (agent) | `prototype/platform/accounting/gl-subledger-recon.ts` → `tracePostingToSourceEvent` + `assertZeroBalance` (✓ wired) | Each sub-ledger control account must reconcile to zero variance. Breaks > ZAR 10,000 require Bea to investigate and post a correcting journal before proceeding. |
| MC6 | Emit `GLReconciliationRun { period, run_at, breaks_found, breaks_value, breaks_resolved, recon_report_ref }` event. | `system` | `@platform/event-store` ✓ | `recon_report_ref` is a content-addressed reference to the reconciliation report in the document store. Unresolved breaks must be zero before the next step. |
| MC7 | Post period-end accruals: accrue interest income and expense, fees, and any other time-based items not yet posted via the standard trade-event pipeline. | Bea (agent) | `@platform/gl/accruals-engine` (`PLANNED`) | Accruals are calculated from the last posted event date to period-end. Each accrual journal carries a `JournalPosted` event with `journal_type: 'accrual'` and a reference to the underlying calculation. |
| MC8 | Post provisions: update the IFRS 9 ECL provision (from the latest `ECLStageProjectionRefreshed` output per PROC-ECL-SP-01) and any specific provisions approved by Helena (Chief Risk Officer, governance). | Bea (agent) + Helena (agent, Chief Risk Officer governance) | `@platform/gl/provisions-engine` (`PLANNED`) | The ECL projection must have been run within the current period. If the ECL run is stale (> 5 business days old), Bea re-triggers PROC-ECL-SP-01 before posting provisions. |
| MC9 | Emit `AccrualsPosted { period, accruals_count, accruals_total_dr, accruals_total_cr, provisions_total, posted_at }` event. | `system` | `@platform/event-store` ✓ | `accruals_total_dr` must equal `accruals_total_cr` (double-entry integrity). Any imbalance halts the close and alerts Bea immediately. |
| MC10 | Produce trial balance: extract all GL account balances for the closing period; verify debits = credits in aggregate. | `system` | `prototype/platform/accounting/period-close.ts` → `computeTrialBalance` (✓ wired) | The trial balance is produced in both ZAR (functional currency) and each active foreign currency. Reporting-currency translation is applied per the FX rates at period-end (sourced from the market-data feed). |
| MC11 | Emit `TrialBalanceProduced { period, total_debits, total_credits, balance_check_passed, produced_at, trial_balance_ref }` event. | `system` | `@platform/event-store` ✓ | `balance_check_passed` must be `true` before sign-off. `trial_balance_ref` is a content-addressed reference to the trial balance document. |
| MC12 | CFO sign-off: Camille reviews the trial balance, the reconciliation report, and the accruals/provisions summary. If satisfied, Camille approves the close by emitting (or countersigning) the `PeriodClosed` event. If not satisfied, Camille raises a re-open request with documented reason. | Camille (governance, Chief Financial Officer) | `@platform/gl/cfo-signoff` (`PLANNED`) | CFO sign-off is a human-in-the-loop step at licence-day. During the build phase, Camille (agent) performs the review autonomously per the agent-spec sign-off criteria. The sign-off is recorded as a typed event — not a manual stamp on a document. |
| MC13 | Emit `PeriodClosed { period, closed_at, closed_by, trial_balance_ref, recon_report_ref, total_debits, total_credits }` event. Set period status to `CLOSED` in the GL. | `system` | `prototype/platform/accounting/period-close-handler.ts` → `closePeriod` (✓ wired) + `@platform/event-store` ✓ | This event is the gate event: no downstream regulatory return or management account may be produced for the period unless a `PeriodClosed` event exists for it. |
| MC14 | Trigger BA return generation: emit `BAReturnGenerationTriggered { period, trigger_event_id }` to kick off PROC-FIN-BA-01. | `system` | `prototype/platform/accounting/ba-return-trigger.ts` → `triggerBAReturnGeneration` (✓ wired) | PROC-FIN-BA-01 consumes the `PeriodClosed` event and the trial balance reference to populate the BA return forms. The PA submission deadline is 20 calendar days after month-end. |
| MC15 | Archive ledger snapshot: create a content-addressed, immutable snapshot of the complete GL state for the closed period and store it in the document archive. | `system` | `@platform/gl/snapshot-archive` (`PLANNED`) | The archived snapshot supports future regulatory inspection, audit, and restatement without requiring replay of the full event log. Retention: 7 years minimum (Banks Act s90). |

## 6. Reconciliation

- **Events produced:**
  - `PeriodCloseInitiated { period, trigger_type, initiated_at, initiated_by }` — opens the close sequence.
  - `GLReconciliationRun { period, run_at, breaks_found, breaks_value, breaks_resolved, recon_report_ref }` — attests GL-to-sub-ledger reconciliation.
  - `AccrualsPosted { period, accruals_count, accruals_total_dr, accruals_total_cr, provisions_total, posted_at }` — attests accruals and provisions posting.
  - `TrialBalanceProduced { period, total_debits, total_credits, balance_check_passed, produced_at, trial_balance_ref }` — trial balance extracted and verified.
  - `PeriodClosed { period, closed_at, closed_by, trial_balance_ref, recon_report_ref, total_debits, total_credits }` — period is closed; gates downstream processes.

- **Reconciliation invariants:**
  1. `PeriodClosed` may only be emitted after `TrialBalanceProduced` with `balance_check_passed: true` for the same period.
  2. `TrialBalanceProduced.total_debits` must equal `TrialBalanceProduced.total_credits` (double-entry invariant; a non-zero variance halts the close).
  3. `GLReconciliationRun.breaks_resolved` must equal `GLReconciliationRun.breaks_found` before `TrialBalanceProduced` is emitted (no open reconciliation breaks at close).
  4. `AccrualsPosted.accruals_total_dr` must equal `AccrualsPosted.accruals_total_cr` (accrual journals are balanced).
  5. `PeriodClosed` must precede any `BAReturnGenerationTriggered` event for the same period — no BA return may be generated without a closed period.
  6. No new `JournalPosted` event with `period` equal to the closed period may be emitted after `PeriodClosed` (system-enforced freeze; violations surface as `PostingBlockedFrozenPeriod` events and are Vera findings).

- **Failure mode:** If the trial balance fails (debits ≠ credits), the close is halted at MC11 and Bea must investigate and correct before Camille can sign off. If CFO sign-off is withheld (MC12), the period remains in `FROZEN` state pending re-open — Camille documents the reason and a re-open cycle begins. Any `PostingBlockedFrozenPeriod` event after `PeriodClosed` is escalated to Vera as a potential control failure.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Period-close events (all five typed events above) | Event log | Permanent (Principle 1) | Internal |
| Trial balance (per period) | `@platform/gl/snapshot-archive` (content-addressed) | 7 years | Internal |
| GL reconciliation report (per period) | `@platform/gl/snapshot-archive` (content-addressed) | 7 years | Internal |
| GL ledger snapshot (per period) | `@platform/gl/snapshot-archive` (immutable binary) | 7 years | Internal |
| Accruals and provisions working papers | Document store (RMS document register post-Phase-1) | 7 years | Internal |
| CFO sign-off record | `PeriodClosed` event `closed_by` field + `@platform/gl/cfo-signoff` log | 7 years | Internal |
| ECL projection used (IFRS 9) | Reference via `ECLStageProjectionRefreshed` event ID | 7 years | Internal |

## 8. Manual steps

- **MC12 (CFO sign-off):** At licence-day, Camille (human CFO) reviews the trial balance and reconciliation report and provides formal sign-off. This is a human-in-the-loop step — the `PeriodClosed` event must carry `closed_by: camille@[bank-domain]`. During the build phase, Camille (agent) performs the review per the agent-spec criteria; the sign-off is still recorded as a typed event.
- **MC3 (suspense account clearing):** Where suspense balances require a business decision on clearing treatment, Bea escalates to Camille. The disposition decision is recorded as a journal-posting rationale attached to the `JournalPosted` event.
- **MC8 (specific provisions):** Helena (Chief Risk Officer, governance) must approve any specific credit provisions not captured by the ECL model. Helena's approval is recorded in the provisions working paper and referenced in `AccrualsPosted`.

## 9. Failure modes and escalation

| Failure | Escalation path | SLA |
|---|---|---|
| Unposted trade events at MC2 (> 2 hours after initiation) | Bea investigates; Camille decides proceed-with-exception or delay; Atlas if platform fault | 2 hours to Camille decision |
| Suspense account balance unresolved at MC3 | Bea escalates to Camille; Camille approves carryover or orders clearing | Same-day resolution |
| GL reconciliation break > ZAR 10,000 at MC5 | Bea investigates and posts correcting journal; Camille notified; Vera finding if systemic | 4 hours to resolution |
| Trial balance debits ≠ credits at MC10 | Close halted; Bea investigates; Camille informed; Atlas if platform fault | 4 hours to resolution |
| ECL projection stale (> 5 business days) at MC8 | Bea re-triggers PROC-ECL-SP-01; close delayed until fresh ECL available | 1 business day |
| CFO sign-off withheld at MC12 | Camille documents reason; re-open cycle initiated; EXCO informed if material | Next business day re-open |
| BA return deadline at risk (< 5 days to PA deadline) | Camille escalates to Owen (Company Secretary, governance) and Mira (Regulatory intelligence engineer, compliance); PA notified if submission will be late | Immediate — PA notification within 24 hours of delay determination |
| `PeriodClosed` emitted but BA return generation fails at MC14 | Bea + Atlas investigate; close is valid; BA return generation retried | 4 hours to retry |
| Posting to frozen period detected (`PostingBlockedFrozenPeriod`) | Vera finding raised automatically; Senna + Devon investigate if security-relevant; Atlas if platform fault | Immediate alert; 1 business day resolution |

## 10. Related procedures

- `PROC-FIN-BA-01` (`ba-return-generation.md`) — triggered by `PeriodClosed`; consumes trial balance to populate and submit PA BA returns.
- `PROC-FIN-BSS-01` (`balance-sheet-substantiation.md`) — monthly per-account source-event trace; a named step within the close (runs in parallel with GL reconciliation).
- `PROC-ACC-IFRS10-01` (`ifrs10-consolidation-cycle.md`) — group consolidation triggered by `PeriodClosed` for the group consolidation perimeter.
- `PROC-ECL-SP-01` (`ecl-stage-projection-refresh.md`) — IFRS 9 ECL projection that feeds MC8 provisions.
- `change-management.md` — any accruals-engine or GL configuration changes during the period require prior change-management approval.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-13 | Atlas (Core banking platform architect, engineering) | Initial stub; all 9 sections populated; 15-step close sequence; 5 typed events; double-entry and GL-freeze invariants specified; IFRS 9 ECL and CFO sign-off steps included. |
| v1.1 | 2026-05-15 | Camille (Chief Financial Officer, governance) + Bea (Financial reporting engineer) | Reformatted to 12-section template; §12 Audit/assurance added; promoted to POPULATED. |
| v1.2 | 2026-05-17 | Bea (Accounting & financial reporting engineer, engineering) | Wired MC1/MC4/MC13 → period-close-handler.ts; MC5 → gl-subledger-recon.ts; MC10 → period-close.ts; built MC2 (unposted-trades-check.ts), MC3 (suspense-report.ts), MC14 (ba-return-trigger.ts); 8 steps PLANNED→wired. |

## 12. Audit / assurance

- **Monthly post-close recon (Vera):** verifies a `PeriodClosed` event exists for each closed month; verifies that `TrialBalanceProduced.total_debits` equals `TrialBalanceProduced.total_credits` in the event payload; verifies that `BAReturnGenerationTriggered` follows within 2 business days of `PeriodClosed`. Any deviation is a Vera finding routed to Camille and Bea.
- **Frozen-period posting checks (Vera, weekly):** Vera scans the event log for any `PostingBlockedFrozenPeriod` events; each occurrence is an automatic finding escalated to Senna (Chief Information Security Officer, governance) and Devon (Chief Operating Officer, governance) if potentially security-relevant, and to Atlas if a platform defect. Finding remains open until root cause is documented and recurrence controls are confirmed.
- **BRC monthly close-quality dashboard:** BRC receives a dashboard showing: (a) close duration in hours (time from `PeriodCloseInitiated` to `PeriodClosed`); (b) number of reconciliation breaks found and resolved; (c) accruals total balance; (d) any manually overridden exceptions from MC2 or MC3. Dashboard is derived from event projections; Bea owns the projection query.
- **Annual audit (Vera + external auditor):** tests a sample of closed periods; traces the `PeriodClosed` event back to `GLReconciliationRun` (with `breaks_resolved` = `breaks_found`) and `AccrualsPosted`; verifies CFO sign-off events are present with the correct `closed_by` actor; confirms the archived GL snapshot exists in the document store for each sampled period. External auditor has read-only access to the event log and document store for the relevant periods.
