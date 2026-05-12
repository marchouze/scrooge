# Procedure — Balance sheet substantiation

**Procedure ID:** PROC-FIN-BSS-01
**Owner:** Bea (Accounting & financial reporting engineer, engineering) · Camille (CFO, finance — sign-off)
**Approval:** Camille (CFO) — monthly operating approval; Board AC (Owen, interim) — annual framework approval
**Cadence:** Monthly — at close of each accounting period; also on-demand
**Version:** v1.0 — 2026-05-12
**Status:** DRAFT

---

## 1. Source policy

`Owner Inbox/2026-05-06_core-policies-finance.md` — Accounting Policies (IFRS) v0.1 (STUB).

Section references:
- §2 Cash and equivalents — substantiation of ACC-1100-xxx accounts.
- §3.4 Suspense accounts — must clear within 2 business days; zero-balance assertion at period-end.
- §5 FVTPL trading instruments — substantiation of ACC-2100-xxx accounts.

## 2. Source regulation(s)

| Citation | Instrument | Requirement |
|---|---|---|
| `ORG-AC-13` | Banks Act Regulations — BA returns | Period-end balances underpinning BA 100 / BA 300 / BA 325 / BA 326 submissions must be substantiated. |
| IAS 1 §29–§31 | IAS 1 — Presentation of Financial Statements | Materiality; omission or misstatement of items is material if it could influence economic decisions. Going-concern assessment. |
| IAS 1 §36–§37 | IAS 1 | Reporting frequency — at least annually; interim periods use same materiality principles. |
| Companies Act 71 of 2008 §§28–30 | Companies Act | Annual financial statements must fairly present; directors (or equivalent responsible officers) must sign. |
| IFRS 9 §5.7.1 / §4.1 | IFRS 9 | FVTPL measurement; amortised cost — balances must reflect correct measurement basis at period-end. |
| IAS 21 §28 | IAS 21 | Monetary items retranslated at closing rate; exchange differences recognised in P&L. Nostro and FX accounts require retranslation at period-end. |

## 3. Purpose

At the close of each accounting period, every GL account with a non-zero balance must be **substantiated**: its balance must be traceable — without gaps — to the underlying source events that generated it, via the `SubLedgerPostingEmitted` projection that constitutes the trial balance. This procedure establishes the standard operating sequence for that substantiation, documents the escalation path for unresolvable items, and emits the typed completion event (`BalanceSheetSubstantiationCompleted`) that downstream consumers (Vera, BA-return submission gate, audit working-paper generator) depend on.

The procedure enforces Principle 1 (events are the only source of truth) at the accounting layer: balance = `fold(SubLedgerPostingEmitted for period)`, substantiation = proof that every posting traces to a primary event and every primary event that should have generated a posting did so.

This procedure does **not** cover risk, liquidity, or regulatory-capital projections — those fold primary trade/settlement events directly and must not route through the trial balance (enforced by PROC-PR-01 and the risk/liquidity projection layer).

## 4. Trigger

| Trigger kind | Source | Response SLA |
|---|---|---|
| **Scheduled — period-close** | `AccountingPeriodClosed` event arrives in event store | Substantiation procedure must complete within 2 agent ticks of the close event; `BalanceSheetSubstantiationCompleted` emitted before next BA-return submission gate opens. |
| **Scheduled — scheduler tick** | Monthly scheduler wake-up at period-end + 1 working day (fallback if `AccountingPeriodClosed` not yet emitted) | Same SLA as above; also emits a `SubstrateAlert` if `AccountingPeriodClosed` is absent — Vera finding. |
| **On-demand — CFO/CEO request** | Direct instruction from Camille (CFO, finance) or CEO via Owner Inbox | Within 1 working day. |
| **On-demand — auditor query** | External-auditor working-paper request | Within 2 working days; actor set to `human:bea:ad-hoc-audit-query`. |

## 5. Steps

| # | Action | Actor | System capability | Citation | Notes |
|---|---|---|---|---|---|
| 1 | **Enumerate active accounts** — load all accounts from `prototype/platform/accounting/_chart-of-accounts.md` with status `in-force` or `draft`. Draft accounts are included if they have any `SubLedgerPostingEmitted` events in the period. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/period-close` → `computeTrialBalance` (`PLANNED` — target: Close Engine M2) | IAS 1 §29–§31; Accounting Policies v0.1 §2, §3.4, §5 | Output: typed list of `{ accountId, currency, status }`. Zero-account result emits `SubstrateAlert { severity: "warn", finding: "no-active-accounts" }`. |
| 2 | **Compute trial balance as-of** — fold `SubLedgerPostingEmitted` events for all postings with `periodId` matching the closed period. Produces per-account, per-currency balance rows `{ leafAccountId, currency, amountMinor }`. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/period-close` → `computeTrialBalance` (`PLANNED`) | Principle 1; IFRS 9 §5.7.1; IAS 21 §28 | Double-entry identity check: for each currency, sum(debit rows) must equal sum(credit rows). Failure → immediate `AgentEscalation` to Camille before proceeding. |
| 3a | **Source-event trace (per account)** — for each account with a non-zero balance: replay the primary events that should have generated postings for that account in the period. Verify: (i) every `SubLedgerPostingEmitted` has a traceable `sourceEventId`; (ii) every primary event of the account's sourcing event types has a corresponding `SubLedgerPostingEmitted`; (iii) no unexplained residual balance. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/period-close` → `tracePostingToSourceEvent` (`PLANNED`) | Principle 1; posting-rule register at `prototype/platform/accounting/_posting-rules.md` | Account-type → source-event mapping: ACC-1100-001 (SARB cash) ← `BankAccountOpened` / settlement events; ACC-1100-002/003 (nostros) ← `FxSettlementConfirmed`; ACC-1100-004/005 (suspense) ← `FxTradeExecuted` / `FxSettlementConfirmed`; ACC-2100-001–004 (FX receivables/payables) ← `FxTradeExecuted` / `SubLedgerPostingEmitted` legs; ACC-2100-005/006 (FX P&L) ← `FxPositionRevalued` / `FxSettlementConfirmed`. |
| 3b | **Classification check (per account)** — verify each account's `ifrsClassification` field in the chart of accounts is `in-force` (not `superseded` or `under-review`) and matches the IFRS standard cited in the account's `citations` array. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/period-close` → `verifyIfrsClassification` (`PLANNED`) | IFRS 9 §4.1–§4.2; IFRS 9 §B5.4; IAS 1 §54 | Classification change during the period (e.g., reclassification event `IFRSClassificationAssigned` for the period) must be present if the balance changed classification mid-period. Missing reclassification event → P1 violation → exception kind `unexplained`. |
| 3c | **Aged-item check (per account)** — flag any balance outstanding longer than the account's clearance horizon: suspense (ACC-1100-004, ACC-1100-005) > 2 business days; trading receivables/payables (ACC-2100-001–004) > T+2 settlement date; nostros (ACC-1100-002, ACC-1100-003) > same-day per correspondent confirmation. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/period-close` → `checkAgedItems` (`PLANNED`) | Accounting Policies v0.1 §3.4; IFRS 9 §B3.1.3 (settlement suspense mechanics) | Aged items do not automatically become exceptions; they are flagged for Bea's triage at step 4. Expected clearance horizon is defined per account in the chart of accounts. |
| 3d | **Cross-leg / zero-balance assertion** — for accounts that must net to zero at period-end (ACC-1100-004 FX Settlement Suspense — ZAR; ACC-1100-005 FX Settlement Suspense — USD): assert `balance = 0`. Non-zero suspense at period-end → exception kind `timing-difference` if within 2 business days of settlement date; otherwise `unexplained`. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/period-close` → `assertZeroBalance` (`PLANNED`) | Accounting Policies v0.1 §3.4; BA 300 Item 30 note | Both suspense accounts are declared `"Should net to zero at period-end"` in the chart of accounts. |
| 4 | **Exception triage** — for each account that failed any of steps 3a–3d, Bea classifies the exception: (a) `timing-difference` — expect to clear next business day (tolerated; Bea notes and monitors); (b) `substrate-gap` — posting engine not wired for this event type (document as a substrate gap; emit `SubstrateAlert`; do not escalate to Camille unless above materiality); (c) `unexplained` — genuine unresolvable item (escalate to Camille immediately via `AgentEscalation`). | `system:bea:balance-sheet-substantiation` (auto-classification for timing-difference and substrate-gap); `human:bea` (final classification for `unexplained` above materiality) | `@platform/accounting/period-close` → `triageException` (`PLANNED`) | IAS 1 §29–§31 (materiality); Companies Act §28 (true-and-fair) | Materiality threshold: CFO-approved per Accounting Policies v0.1; default build-phase threshold = ZAR 50,000 (nominal; to be calibrated at licence-day). |
| 5 | **Camille sign-off** — Camille (CFO, finance) reviews the exception list and approves the substantiation run. For clean runs (zero exceptions above materiality): automated sign-off via `BalanceSheetSubstantiationApproved` event (approvalMode: `auto`). For any exception above materiality: Camille receives `AgentEscalation` event and must respond with explicit approval or escalation before `BalanceSheetSubstantiationCompleted` is emitted. | `system:bea:balance-sheet-substantiation` (auto-approve path); `human:camille` (human-in-loop path) | `@platform/accounting/period-close` → `requestSubstantiationSignOff` (`PLANNED`) | Companies Act §28–§30; Accounting Policies v0.1 §1 (CFO authority) | Human-in-loop step per Principle 6. Camille's approval is the typed `BalanceSheetSubstantiationApproved` event — not a chat confirmation. |
| 6 | **Emit completion event** — `BalanceSheetSubstantiationCompleted { periodId, entity, asOf, accountsSubstantiated, accountsWithExceptions, exceptionsOpen, approvedBy, approvalMode }`. This is the canonical record of the substantiation run. | `system:bea:balance-sheet-substantiation` | `@platform/event-store` (emit) | Principle 1; `ORG-AC-13` | Downstream consumers: Vera (audit completeness recon), BA-return submission gate (must see zero unresolved exceptions before BA-return is submitted), audit working-paper generator. |

## 6. Reconciliation

**Events produced:**
- `BalanceSheetSubstantiationCompleted` — primary completion event; schema in `prototype/platform/event-store/event-types/accounting.ts`.
- `AgentEscalation` — emitted for every unexplained exception and for double-entry failures (step 2).
- `SubstrateAlert` — emitted for substrate-gap exceptions and for missing `AccountingPeriodClosed` event.
- `BalanceSheetSubstantiationApproved` — CFO approval event (auto or human-in-loop) (`PLANNED` — same file, to be added in Close Engine M2).

**Reconciliation assertion (Vera-enforced):**
- Every `AccountingPeriodClosed` event must be followed within 2 agent ticks by a `BalanceSheetSubstantiationCompleted` event for the same `periodId` and `entity`.
- `exceptionsOpen` in the `BalanceSheetSubstantiationCompleted` payload must contain zero items with `exceptionKind: "unexplained"` — any open `unexplained` item means the substantiation is not complete.
- `timing-difference` and `substrate-gap` exceptions are permitted in the completion event but must be trended (Vera wave-4 recon candidate).

**Failure mode — completion event absent:**
If `BalanceSheetSubstantiationCompleted` is not emitted within 2 agent ticks of `AccountingPeriodClosed`, Vera raises a finding: `BSS-MISSING { periodId, entity, ticksElapsed }`. The finding blocks BA-return submission.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `BalanceSheetSubstantiationCompleted` event | Event store | Permanent (event log is append-only) | Financial / regulatory |
| Per-account trace working paper | Owner Inbox — `YYYY-MM-DD_bea_balance-sheet-substantiation-<periodId>.md` | 5 years (Companies Act §24 + Banks Act records obligation) | Financial |
| Exception log (embedded in completion event payload) | Event store (payload) + working paper | Same as working paper | Financial |
| `AgentEscalation` events | Event store | Permanent | Financial / escalation |
| `SubstrateAlert` events (substrate-gap exceptions) | Event store | Permanent | Engineering / audit |

## 8. Manual steps

The following steps involve human discretion in the current build phase. Each is justified; automation target is noted.

| Step | Manual action | Justification | Automation target |
|---|---|---|---|
| 4 (exception triage) | Bea classifies `unexplained` exceptions above materiality | Requires professional judgment (CA(SA) background) for items that do not fit algorithmic patterns | Close Engine M2 — rule-based auto-triage for known patterns; residual to Bea |
| 5 (Camille sign-off) | Camille (CFO) reviews and approves substantiation for runs with exceptions above materiality | Companies Act §28–§30 — CFO sign-off is a governance requirement, not an automation gap | Partial: auto-approve for clean runs is already in the design; human-in-loop is permanent for material exceptions |

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Posting engine not wired for event type — balance present in source event stream but absent from trial balance | Step 3a: source event present, no matching `SubLedgerPostingEmitted` | Classify as `substrate-gap`; emit `SubstrateAlert { severity: "warn", finding: "missing-posting-rule", accountId, sourceEventType }`; document as substrate gap in Bea §16; route to Atlas (substrate) + Anya (projections) for next sprint |
| `SubLedgerPostingEmitted` event present but no traceable source event | Step 3a: `SubLedgerPostingEmitted.sourceEventId` resolves to null or a non-matching event type | Principle 1 violation — classify as `unexplained`; escalate to Camille immediately; emit `AgentEscalation { severity: "critical", finding: "p1-violation-untraced-posting", accountId, postingEventId }` |
| Double-entry imbalance in trial balance | Step 2: debit total ≠ credit total for any currency | Emit `AgentEscalation { severity: "critical", finding: "trial-balance-imbalance", currency }` to Camille; halt substantiation run until resolved |
| Suspense account non-zero at period-end, beyond 2 business days | Step 3d: balance ≠ 0 and aged > 2bd | Exception kind `unexplained`; escalate to Tomas (Operations & payments engineer) + Camille; same-day resolution required |
| `BalanceSheetSubstantiationCompleted` not emitted within 2 agent ticks | Vera recon polling | Vera raises finding `BSS-MISSING`; notifies Camille and Bea; blocks BA-return submission gate |
| Nostro balance not confirmed by correspondent within same business day | Step 3c aged-item check | Exception kind `timing-difference` if 1 day; `unexplained` if > 1 day — escalate to Tomas for correspondent reconciliation |
| IFRS classification superseded mid-period without reclassification event | Step 3b: `ifrsClassification` changed but no `IFRSClassificationAssigned` event in period | Classify as P1 violation (`unexplained`); escalate to Camille; do not proceed to sign-off until reclassification event emitted and substantiated |

## 10. Related procedures

- `Procedures/by-policy/posting-rule-publication.md` (PROC-FIN-AC-01) — upstream: new posting rules must be published and registered before they appear in substantiation traces.
- `Procedures/by-policy/month-end-close.md` (PLANNED) — orchestrator: balance sheet substantiation is a named step within the broader month-end close orchestration.
- `Procedures/by-policy/capital-ratio-monitoring.md` (PROC-PR-01) — parallel: capital and liquidity projections fold primary events independently; they must not be sourced from the trial balance; reconciliation between the two projections is a Vera recon check.
- `Procedures/by-policy/ba-return-generation.md` (PLANNED) — downstream: BA-return generation is gated on a clean `BalanceSheetSubstantiationCompleted` event for the period.
- `Procedures/by-policy/ecl-stage-projection-refresh.md` — intersects at IFRS 9 staging; ECL outputs feed impairment provisions that appear in the trial balance.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-12 | Bea (Accounting & financial reporting engineer, engineering) | Initial draft — procedure authored per dispatch from Scrooge (Chief of Staff), covering all active GL accounts (ACC-1100-001–005 + ACC-2100-001–006), six-step substantiation sequence, and typed completion event `BalanceSheetSubstantiationCompleted`. |

## 12. Audit / assurance

**Vera assurance assertions (planned — Wave-4 recon pipeline):**

1. **Completeness:** Every `AccountingPeriodClosed` event for entity `LE-ZA-HOZ-BANK` has a matching `BalanceSheetSubstantiationCompleted` within 2 agent ticks. Query: `count(AccountingPeriodClosed) = count(BalanceSheetSubstantiationCompleted grouped by periodId)`.
2. **Exception-free close:** No `BalanceSheetSubstantiationCompleted` event emitted with `exceptionsOpen` containing an `exceptionKind: "unexplained"` item that also has no subsequent `AgentEscalationDecided` resolution event.
3. **Sign-off attribution:** Every `BalanceSheetSubstantiationCompleted` with `approvalMode: "human-in-loop"` has a corresponding `BalanceSheetSubstantiationApproved` event with actor matching Camille's agent ID.
4. **Source-trace coverage:** For every `SubLedgerPostingEmitted` event, a `tracePostingToSourceEvent` result (from step 3a) is recorded in the working-paper artefact and references a non-null, non-phantom `sourceEventId`.

**Independent testing cadence:** Vera samples 20% of posted accounts per quarter, independently replaying source events to verify working-paper accuracy. Findings feed the Vera findings-tracking procedure (planned).
