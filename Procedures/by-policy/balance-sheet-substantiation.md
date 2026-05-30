---
id: PROC-FIN-BSS-01
policy-parent: FIN-BSS-01 — Balance Sheet Substantiation Policy v1.0 (APPROVED)
last-reviewed: 2026-05-12
status: POPULATED
---
# Procedure — Balance sheet substantiation

**Procedure ID:** PROC-FIN-BSS-01
**Owner:** Bea (Accounting & financial reporting engineer, engineering) · Camille (Chief Financial Officer)
**Approval:** Camille (CFO) — monthly operating approval; Board AC (Owen, interim) — annual framework approval
**Cadence:** Monthly — at close of each accounting period; also on-demand
**Version:** v1.0 — 2026-05-12
**Status:** POPULATED

---

## 1. Source policy

`Policies/balance-sheet-substantiation-policy-v1.md` — Balance Sheet Substantiation Policy (FIN-BSS-01 v1.0, APPROVED, D-BALANCE-SHEET-SUBSTANTIATION-POLICY-V1).

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
| **On-demand — CFO/CEO request** | Direct instruction from Camille (Chief Financial Officer) or CEO via Owner Inbox | Within 1 working day. |
| **On-demand — auditor query** | External-auditor working-paper request | Within 2 working days; actor set to `human:bea:ad-hoc-audit-query`. |

## 5. Steps

| # | Action | Actor | System capability | Citation | Notes |
|---|---|---|---|---|---|
| 1 | **Enumerate active accounts** — load all accounts from `prototype/platform/accounting/_chart-of-accounts.md` with status `in-force` or `draft`. Draft accounts are included if they have any `SubLedgerPostingEmitted` events in the period. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/period-close` → `computeTrialBalance` (`PLANNED` — target: Close Engine M2) | IAS 1 §29–§31; Accounting Policies v0.1 §2, §3.4, §5 | Output: typed list of `{ accountId, currency, status }`. Zero-account result emits `SubstrateAlert { severity: "warn", finding: "no-active-accounts" }`. |
| 2 | **Compute trial balance as-of** — fold `SubLedgerPostingEmitted` events for all postings with `periodId` matching the closed period. Produces per-account, per-currency balance rows `{ leafAccountId, currency, amountMinor }`. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/period-close` → `computeTrialBalance` (`PLANNED`) | Principle 1; IFRS 9 §5.7.1; IAS 21 §28 | Double-entry identity check: for each currency, sum(debit rows) must equal sum(credit rows). Failure → immediate `AgentEscalation` to Camille before proceeding. |
| 3a | **Source-event trace (per account)** — for each account with a non-zero balance: replay the primary events that should have generated postings for that account in the period. Verify: (i) every `SubLedgerPostingEmitted` has a traceable `sourceEventId`; (ii) every primary event of the account's sourcing event types has a corresponding `SubLedgerPostingEmitted`; (iii) no unexplained residual balance. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/gl-subledger-recon` → `tracePostingToSourceEvent` (`POPULATED` — `prototype/platform/accounting/gl-subledger-recon.ts`) | Principle 1; posting-rule register at `prototype/platform/accounting/_posting-rules.md` | Account-type → source-event mapping: ACC-1100-001 (SARB cash) ← `BankAccountOpened` / settlement events; ACC-1100-002/003 (nostros) ← `FxSettlementConfirmed`; ACC-1100-004/005 (suspense) ← `FxTradeExecuted` / `FxSettlementConfirmed`; ACC-2100-001–004 (FX receivables/payables) ← `FxTradeExecuted` / `SubLedgerPostingEmitted` legs; ACC-2100-005/006 (FX P&L) ← `FxPositionRevalued` / `FxSettlementConfirmed`. |
| 3b | **Classification check (per account)** — verify each account's `ifrsClassification` field in the chart of accounts is `in-force` (not `superseded` or `under-review`) and matches the IFRS standard cited in the account's `citations` array. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/gl-subledger-recon` → `verifyIfrsClassification` (`POPULATED` — `prototype/platform/accounting/gl-subledger-recon.ts`) | IFRS 9 §4.1–§4.2; IFRS 9 §B5.4; IAS 1 §54 | Classification change during the period (e.g., reclassification event `IFRSClassificationAssigned` for the period) must be present if the balance changed classification mid-period. Missing reclassification event → P1 violation → exception kind `unexplained`. |
| 3c | **Aged-item check (per account)** — flag any balance outstanding longer than the account's clearance horizon: suspense (ACC-1100-004, ACC-1100-005) > 2 business days; trading receivables/payables (ACC-2100-001–004) > T+2 settlement date; nostros (ACC-1100-002, ACC-1100-003) > same-day per correspondent confirmation. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/gl-subledger-recon` → `checkAgedItems` (`POPULATED` — `prototype/platform/accounting/gl-subledger-recon.ts`) | Accounting Policies v0.1 §3.4; IFRS 9 §B3.1.3 (settlement suspense mechanics) | Aged items do not automatically become exceptions; they are flagged for Bea's triage at step 4. Expected clearance horizon is defined per account in the chart of accounts. |
| 3d | **Cross-leg / zero-balance assertion** — for accounts that must net to zero at period-end (ACC-1100-004 FX Settlement Suspense — ZAR; ACC-1100-005 FX Settlement Suspense — USD): assert `balance = 0`. Non-zero suspense at period-end → exception kind `timing-difference` if within 2 business days of settlement date; otherwise `unexplained`. | `system:bea:balance-sheet-substantiation` | `@platform/accounting/gl-subledger-recon` → `assertZeroBalance` (`POPULATED` — `prototype/platform/accounting/gl-subledger-recon.ts`) | Accounting Policies v0.1 §3.4; BA 300 Item 30 note | Both suspense accounts are declared `"Should net to zero at period-end"` in the chart of accounts. |
| 4 | **Exception triage** — for each account that failed any of steps 3a–3d, Bea classifies the exception: (a) `timing-difference` — expect to clear next business day (tolerated; Bea notes and monitors); (b) `substrate-gap` — posting engine not wired for this event type (document as a substrate gap; emit `SubstrateAlert`; do not escalate to Camille unless above materiality); (c) `unexplained` — genuine unresolvable item (escalate to Camille immediately via `AgentEscalation`). | `system:bea:balance-sheet-substantiation` (auto-classification for timing-difference and substrate-gap); `human:bea` (final classification for `unexplained` above materiality) | `@platform/accounting/gl-subledger-recon` → `triageException` (`POPULATED` — `prototype/platform/accounting/gl-subledger-recon.ts`) | IAS 1 §29–§31 (materiality); Companies Act §28 (true-and-fair) | Materiality threshold: CFO-approved per Accounting Policies v0.1; default build-phase threshold = ZAR 50,000 (nominal; to be calibrated at licence-day). |
| 5 | **Camille sign-off** — Camille (Chief Financial Officer) reviews the exception list and approves the substantiation run. For clean runs (zero exceptions above materiality): automated sign-off via `BalanceSheetSubstantiationApproved` event (approvalMode: `auto`). For any exception above materiality: Camille receives `AgentEscalation` event and must respond with explicit approval or escalation before `BalanceSheetSubstantiationCompleted` is emitted. | `system:bea:balance-sheet-substantiation` (auto-approve path); `human:camille` (human-in-loop path) | `@platform/accounting/period-close` → `requestSubstantiationSignOff` (`PLANNED`) | Companies Act §28–§30; Accounting Policies v0.1 §1 (CFO authority) | Human-in-loop step per Principle 6. Camille's approval is the typed `BalanceSheetSubstantiationApproved` event — not a chat confirmation. |
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

## 7. Exception handling

### 7.1 Classification and materiality

Each exception identified in step 4 is classified before any escalation decision is made:

| Exception kind | Definition | Default handling |
|---|---|---|
| `timing-difference` | Item expected to clear by next business day (e.g., nostro confirmation lag, T+1 settlement window) | Tolerated; Bea notes in working paper; monitors at next-day open |
| `substrate-gap` | Posting engine not yet wired for this event type; primary event present but no `SubLedgerPostingEmitted` generated | Documents as substrate gap (§12 Substrate gaps); emits `SubstrateAlert`; no CFO escalation unless above materiality |
| `unexplained` | Genuine unresolvable item — no traceable source event, Principle 1 violation, or IFRS misclassification | Immediate escalation to Camille (CFO); journal adjustment request initiated |

**Materiality threshold:** CFO-approved; default build-phase threshold = ZAR 50,000 per individual variance. Substrate-gap and timing-difference exceptions below ZAR 50,000 aggregate per period do not trigger formal escalation but are included in the exception log within `BalanceSheetSubstantiationCompleted`.

### 7.2 Journal adjustment request

If a line item cannot be substantiated due to a missing, misposted, or misclassified entry:

1. **Open a journal adjustment request** — Bea emits a `JournalAdjustmentRequested { accountId, amount, currency, reason, periodId, requestedBy: "system:bea:balance-sheet-substantiation" }` event. This event is the canonical record of the unresolved item; it must be emitted before any corrective posting is made.
2. **Notify Camille within 1 business day** — `AgentEscalation` event to Camille with severity `"warn"` (below materiality) or `"critical"` (at or above ZAR 50,000 unexplained variance). The notification must include: account code, currency, variance amount, exception kind, and the chain of events consulted.
3. **Hold the period close** — the `BalanceSheetSubstantiationCompleted` event must not be emitted with `exceptionsOpen` containing unresolved `unexplained` items, unless Camille grants a documented exception (see §7.3).
4. **Resolve or escalate to external auditor** — if the unexplained variance exceeds ZAR 50,000 and cannot be resolved within the next business day after Camille notification, Bea escalates to the external auditor (once appointed at licence-day; in the build phase, escalation is to Marc as CEO). Escalation is a typed `AgentEscalation { severity: "critical", finding: "material-unexplained-variance-auditor-required", amount, accountId }` event.

### 7.3 Documented exception — Camille override

Camille may grant a documented exception allowing `BalanceSheetSubstantiationCompleted` to be emitted with an open `unexplained` item, only where:
- The variance is below materiality threshold; **or**
- The item has a clear resolution path (confirmed posting to follow within 2 business days); **and**
- The exception is explicitly noted in the `BalanceSheetSubstantiationCompleted` payload under `cfoExceptionGranted: true` with `cfoExceptionReason`.

The `BalanceSheetSubstantiationApproved` event in human-in-loop mode must carry `exceptionGranted: true` in its payload when this applies. Vera asserts the exception is subsequently resolved — an unresolved CFO-exception item older than 5 business days is a Wave-4 recon finding.

## 8. Reporting / MI

### 8.1 Month-end substantiation report

At the conclusion of each monthly substantiation run, Bea produces a substantiation report and files it in `Owner Inbox/`:

**Filename:** `YYYY-MM-DD_bea_balance-sheet-substantiation-<periodId>.md`

**Report content:**
- Period covered; total accounts substantiated; count of exceptions by kind (`timing-difference` / `substrate-gap` / `unexplained`)
- Per-account summary table: account code, currency, balance (minor units), substantiation result, exception kind (if any), resolution status
- Double-entry check result (step 2)
- CFO sign-off mode (`auto` or `human-in-loop`) and exception grants (if any)
- Reference to `BalanceSheetSubstantiationCompleted` event ID (canonical artefact per Principle 1; the report is a render, not the source of truth)

**Delivery:** Report is available to Camille (CFO) immediately on completion. Camille's `BalanceSheetSubstantiationApproved` event is the formal sign-off; the report is the supporting working paper.

### 8.2 Audit Committee pack contribution

Owen (Company Secretary, governance) compiles the AC pack. Bea's substantiation output feeds the AC pack via a standard MI cell:

- **Monthly MI to Camille:** full substantiation report (§8.1 above).
- **Quarterly AC pack summary (via Owen secretariat):** one-line substantiation status per closed period in the quarter; exception count by kind; any open `unexplained` items still unresolved; trend of substrate-gap exceptions (indicator of engineering debt).
- **Annual Board AC framework review:** full substantiation methodology review; Vera's independent-testing results (§12); changes to materiality thresholds or substantiation scope since prior annual review.

Owen's AC pack assembly procedure (`Procedures/by-policy/ac-pack-assembly.md` — PLANNED) will consume the substantiation status via the dashboard finance tile (see §8.3).

### 8.3 Dashboard finance tile

The `BalanceSheetSubstantiationCompleted` event feeds the dashboard's finance tile via a projection. The tile shows:
- Last substantiation run: period, date, clean/exceptions
- Open `unexplained` exceptions (if any) — with days-outstanding counter
- Substrate-gap exception trend (rolling 3-period)
- Next scheduled substantiation: derived from the accounting period calendar

The dashboard tile is a derived view (Principle 1 — never the canonical record). Status: `PLANNED` — wired to the Close Engine M2 milestone.

## 9. Change control

### 9.1 Approval authority

Camille (Chief Financial Officer) is the sole approval authority for changes to the substantiation methodology, materiality thresholds, exception-classification rules, and the set of accounts in scope. Changes that affect regulatory submissions (BA 100 / BA 300 / BA 325 / BA 326 scope) additionally require Board AC notification (via Owen's secretariat) before the effective date.

### 9.2 Change procedure

1. **Initiation:** Any team member (Bea, Vera, external auditor, Camille) may propose a change by filing a brief in `Team Inbox/` addressed to Camille, citing the specific section and proposed amendment.
2. **Review:** Camille reviews the proposal within 1 agent tick of receipt. For changes affecting regulatory-return scope, Helena (CRO, governance) is consulted.
3. **Approval event:** Camille approves by emitting (or instructing Scrooge to record) a `Decision` event referencing this procedure's ID (`PROC-FIN-BSS-01`) and the version being superseded.
4. **Effective date:** Changes take effect at the **close-of-month following approval**. The period in which approval is granted uses the previous methodology; the next full period uses the new methodology. This ensures no mid-period methodology change can obscure a period's result.
5. **Version bump:** A new version entry is added to §11 Change log with the author, approval date, effective date, and summary of changes.
6. **Downstream notification:** Vera is notified (via an event tag on the `Decision` record) so that any recon assertions that depend on the changed methodology are updated before the effective date.

### 9.3 Emergency amendments

If a regulatory amendment (e.g., SARB circular, IFRS amendment) requires an immediate change before the next period close, Camille may approve an emergency amendment effective immediately. The emergency amendment must be documented in the change log within 1 business day and notified to the Board AC (via Owen) within 5 business days.

## 10. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `BalanceSheetSubstantiationCompleted` event | Event store | Permanent (event log is append-only) | Financial / regulatory |
| Per-account trace working paper | Owner Inbox — `YYYY-MM-DD_bea_balance-sheet-substantiation-<periodId>.md` | 5 years (Companies Act §24 + Banks Act records obligation) | Financial |
| Exception log (embedded in completion event payload) | Event store (payload) + working paper | Same as working paper | Financial |
| `AgentEscalation` events | Event store | Permanent | Financial / escalation |
| `SubstrateAlert` events (substrate-gap exceptions) | Event store | Permanent | Engineering / audit |
| `JournalAdjustmentRequested` events | Event store | Permanent | Financial |
| Month-end substantiation report | Owner Inbox (§8.1) | 5 years | Financial |

## 11. Manual steps — detail

The following steps involve human discretion in the current build phase. Each is justified; automation target is noted.

| Step | Manual action | Justification | Automation target |
|---|---|---|---|
| 4 (exception triage) | Bea classifies `unexplained` exceptions above materiality | Requires professional judgment (CA(SA) background) for items that do not fit algorithmic patterns | Close Engine M2 — rule-based auto-triage for known patterns; residual to Bea |
| 5 (Camille sign-off) | Camille (CFO) reviews and approves substantiation for runs with exceptions above materiality | Companies Act §28–§30 — CFO sign-off is a governance requirement, not an automation gap | Partial: auto-approve for clean runs is already in the design; human-in-loop is permanent for material exceptions |
| 7.2 (external auditor escalation) | Bea escalates material unexplained variances to external auditor | Statutory audit independence; auditor must independently verify material items | Post-licence-day; build-phase fallback = Marc as CEO |

## 12. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Posting engine not wired for event type — balance present in source event stream but absent from trial balance | Step 3a: source event present, no matching `SubLedgerPostingEmitted` | Classify as `substrate-gap`; emit `SubstrateAlert { severity: "warn", finding: "missing-posting-rule", accountId, sourceEventType }`; document as substrate gap in Bea §16; route to Atlas (substrate) + Anya (projections) for next sprint |
| `SubLedgerPostingEmitted` event present but no traceable source event | Step 3a: `SubLedgerPostingEmitted.sourceEventId` resolves to null or a non-matching event type | Principle 1 violation — classify as `unexplained`; escalate to Camille immediately; emit `AgentEscalation { severity: "critical", finding: "p1-violation-untraced-posting", accountId, postingEventId }` |
| Double-entry imbalance in trial balance | Step 2: debit total ≠ credit total for any currency | Emit `AgentEscalation { severity: "critical", finding: "trial-balance-imbalance", currency }` to Camille; halt substantiation run until resolved |
| Suspense account non-zero at period-end, beyond 2 business days | Step 3d: balance ≠ 0 and aged > 2bd | Exception kind `unexplained`; escalate to Tomas (Operations & payments engineer) + Camille; same-day resolution required |
| `BalanceSheetSubstantiationCompleted` not emitted within 2 agent ticks | Vera recon polling | Vera raises finding `BSS-MISSING`; notifies Camille and Bea; blocks BA-return submission gate |
| Nostro balance not confirmed by correspondent within same business day | Step 3c aged-item check | Exception kind `timing-difference` if 1 day; `unexplained` if > 1 day — escalate to Tomas for correspondent reconciliation |
| IFRS classification superseded mid-period without reclassification event | Step 3b: `ifrsClassification` changed but no `IFRSClassificationAssigned` event in period | Classify as P1 violation (`unexplained`); escalate to Camille; do not proceed to sign-off until reclassification event emitted and substantiated |

## 13. Related procedures

- `Procedures/by-policy/posting-rule-publication.md` (PROC-FIN-AC-01) — upstream: new posting rules must be published and registered before they appear in substantiation traces.
- `Procedures/by-policy/month-end-close.md` (PLANNED) — orchestrator: balance sheet substantiation is a named step within the broader month-end close orchestration.
- `Procedures/by-policy/capital-ratio-monitoring.md` (PROC-PR-01) — parallel: capital and liquidity projections fold primary events independently; they must not be sourced from the trial balance; reconciliation between the two projections is a Vera recon check.
- `Procedures/by-policy/ba-return-generation.md` (PLANNED) — downstream: BA-return generation is gated on a clean `BalanceSheetSubstantiationCompleted` event for the period.
- `Procedures/by-policy/ecl-stage-projection-refresh.md` — intersects at IFRS 9 staging; ECL outputs feed impairment provisions that appear in the trial balance.

## 14. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-12 | Bea (Accounting & financial reporting engineer, engineering) | Initial draft — procedure authored per dispatch from Scrooge (Chief of Staff), covering all active GL accounts (ACC-1100-001–005 + ACC-2100-001–006), six-step substantiation sequence, and typed completion event `BalanceSheetSubstantiationCompleted`. |
| v1.1 | 2026-05-17 | Bea (Accounting & financial reporting engineer, engineering) | Promoted DRAFT → POPULATED. Added §7 Exception handling (journal adjustment request, R50,000 materiality threshold, auditor escalation, CFO documented-exception gate), §8 Reporting/MI (month-end report, AC pack contribution, dashboard finance tile), §9 Change control (Camille approval authority, effective-date rule, emergency amendment path). Renumbered subsequent sections. |

## 15. Audit / assurance

**Vera assurance assertions (planned — Wave-4 recon pipeline):**

1. **Completeness:** Every `AccountingPeriodClosed` event for entity `LE-ZA-HOZ-BANK` has a matching `BalanceSheetSubstantiationCompleted` within 2 agent ticks. Query: `count(AccountingPeriodClosed) = count(BalanceSheetSubstantiationCompleted grouped by periodId)`.
2. **Exception-free close:** No `BalanceSheetSubstantiationCompleted` event emitted with `exceptionsOpen` containing an `exceptionKind: "unexplained"` item that also has no subsequent `AgentEscalationDecided` resolution event.
3. **Sign-off attribution:** Every `BalanceSheetSubstantiationCompleted` with `approvalMode: "human-in-loop"` has a corresponding `BalanceSheetSubstantiationApproved` event with actor matching Camille's agent ID.
4. **Source-trace coverage:** For every `SubLedgerPostingEmitted` event, a `tracePostingToSourceEvent` result (from step 3a) is recorded in the working-paper artefact and references a non-null, non-phantom `sourceEventId`.

**Independent testing cadence:** Vera samples 20% of posted accounts per quarter, independently replaying source events to verify working-paper accuracy. Findings feed the Vera findings-tracking procedure (planned).
