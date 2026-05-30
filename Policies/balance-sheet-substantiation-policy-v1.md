---
policy-id: FIN-BSS-01
title: Balance Sheet Substantiation Policy
version: "1.0"
status: APPROVED
owner: Camille (CFO, governance)
implementation: Bea (Accounting & financial reporting engineer, engineering)
assurance: Vera (Internal audit / continuous-assurance engineer, engineering)
effective-from: 2026-05-30
next-review: "2027-05-30"
citations:
  - "Banks Act 94/1990: s90 (accounting records)"
  - "ORG-AC-13: BA returns — period-end balance substantiation"
  - "IAS 1: Presentation of Financial Statements §29–§31 (materiality)"
  - "IAS 1: §36–§37 (reporting frequency)"
  - "IFRS 9: §5.7.1 / §4.1 (FVTPL and amortised cost measurement)"
  - "IAS 21: §28 (monetary item retranslation)"
  - "Companies Act 71/2008: §§28–30 (financial statements — fair presentation)"
parent-policy: FIN-ACCT-01
implementing-procedure: PROC-FIN-BSS-01
decision-required: false
decision-id: D-BALANCE-SHEET-SUBSTANTIATION-POLICY-V1
riskTaxonomy:
  - "FIN-001"
  - "FIN-002"
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-05-30
summary: Establishes the Bank's requirements for period-end balance sheet substantiation — the control that every GL account balance is traceable without gaps to its underlying source events before regulatory submissions and financial statements are finalised.
---

# Balance Sheet Substantiation Policy

> **Policy** | FIN-BSS-01 v1.0 | Owner: Camille (CFO, governance) | Status: DRAFT | Effective: 2026-05-30

> **Obligations closed:** [`ORG-AC-13`](../Regulations/_obligations-register.md) — BA-return period-end balance substantiation.

> **Binding status:** LICENCE-BIND. Balance sheet substantiation obligations under Banks Act 94/1990 s.90 and IAS 1 apply from the date of licence grant. The build-phase substrate must be production-grade by licence-day.

---

## Purpose

This policy establishes the Bank's requirement that every non-zero General Ledger (GL) account balance at the close of each accounting period is **substantiated**: the balance must be traceable, without gaps, to the underlying source events that generated it through the `SubLedgerPostingEmitted` projection constituting the trial balance.

Substantiation is the control that links the financial statements and prudential returns to the event store (Principle 1). It is not optional — an unsubstantiated balance is a Principle 1 violation and blocks BA-return submission.

---

## Scope

### Entity scope

This policy applies to:

- **Hoz Bank Limited** — primary accounting entity; all GL accounts in the Bank's chart of accounts.
- **Hoz Group Limited** — consolidated accounts where applicable.

### Temporal scope

Substantiation is required at the close of **every accounting period** (monthly, quarterly, annual) and on demand per §4.

### Exclusions

This policy does **not** govern risk, liquidity, or regulatory-capital projections. Those fold primary trade and settlement events directly and must not route through the trial balance (PROC-PR-01 and the risk / liquidity projection layer).

---

## Policy statements

### 1. Completeness requirement

Every GL account with a non-zero balance at period-end must be substantiated before:

- Any BA-return (BA 100, BA 300, BA 325, BA 326) is submitted to the SARB; and
- Any financial statements (monthly management accounts, quarterly management accounts, annual financial statements) are finalised or distributed.

Substantiation is evidenced by the emission of a `BalanceSheetSubstantiationCompleted` event. No BA-return submission gate may open and no financial statements may be signed off without this event in the event store for the relevant period.

### 2. Source-event traceability

For every `SubLedgerPostingEmitted` event in a period:

- The posting must carry a non-null `sourceEventId` that resolves to a recognised primary event type;
- The primary event must be present in the event store; and
- Every primary event of an account's applicable event types must have generated a corresponding posting.

A posting without a traceable source event is a **Principle 1 violation** and constitutes an `unexplained` exception requiring immediate CFO escalation.

### 3. Double-entry integrity

The trial balance must satisfy the double-entry identity for each currency at every period-end:

> sum(debit rows) = sum(credit rows)

A trial-balance imbalance in any currency immediately halts the substantiation run and requires CFO notification before any further steps proceed.

### 4. IFRS classification currency

Every account's `ifrsClassification` must be `in-force` at period-end. A classification change during the period requires a corresponding `IFRSClassificationAssigned` event. An absent reclassification event where a mid-period classification change occurred is a Principle 1 violation classified as `unexplained`.

### 5. Suspense account zero-balance assertion

Accounts designated as clearing or suspense accounts (currently ACC-1100-004 and ACC-1100-005) must carry a zero balance at period-end. A non-zero suspense balance at period-end:

- Within 2 business days of the relevant settlement date: classified as `timing-difference` (tolerated, monitored).
- Beyond 2 business days: classified as `unexplained`, requiring immediate CFO escalation and Tomas (Operations & payments engineer, engineering) notification.

### 6. Materiality and exception classification

Exceptions identified during substantiation are classified as:

| Exception kind | Definition | Handling |
|---|---|---|
| `timing-difference` | Expected to clear by next business day (e.g. nostro confirmation lag, T+1 settlement window) | Tolerated; Bea notes and monitors; included in completion event payload |
| `substrate-gap` | Posting engine not yet wired for this event type; primary event present but no posting generated | `SubstrateAlert` emitted; substrate gap registered; CFO escalation only if aggregate below-threshold items are trending upward or individual item is above materiality |
| `unexplained` | Unresolvable item — no traceable source event, Principle 1 violation, or IFRS misclassification | Immediate CFO escalation; `JournalAdjustmentRequested` event emitted; substantiation run held open until resolved or CFO documented-exception granted |

**Materiality threshold:** ZAR 50,000 per individual variance (default build-phase threshold; calibrated to business scale at licence-day and reviewed annually by Camille (CFO, governance)). Below-threshold substrate-gap and timing-difference items do not require formal CFO escalation but must be included in the exception log within `BalanceSheetSubstantiationCompleted`.

### 7. CFO sign-off

Every substantiation run requires CFO (Camille, governance) sign-off before `BalanceSheetSubstantiationCompleted` is emitted:

- **Clean run (zero exceptions above materiality):** automated sign-off via `BalanceSheetSubstantiationApproved { approvalMode: "auto" }`.
- **Run with exceptions above materiality:** Camille receives an `AgentEscalation` event and must explicitly approve or escalate before the completion event is emitted. Approval is the typed `BalanceSheetSubstantiationApproved` event — not a chat confirmation.

CFO sign-off is a Companies Act §28–§30 governance requirement; it cannot be automated away for material exceptions.

### 8. Documented exceptions

Camille may grant a documented exception permitting the completion event to carry an open `unexplained` item only where:

- The variance is below the materiality threshold; **or**
- The item has a confirmed resolution path (corrective posting to follow within 2 business days);

**and** the exception is explicitly noted in the completion event payload (`cfoExceptionGranted: true`, `cfoExceptionReason` populated).

An unresolved CFO-exception item older than 5 business days is a Vera recon finding.

### 9. Evidence and retention

The canonical substantiation record is the `BalanceSheetSubstantiationCompleted` event in the event store. The working-paper report filed by Bea is a derived render; it does not supersede the event. All finance-domain events are subject to retention class `RETENTION_BANKS_ACT_S90_5Y` (Banks Act s.90 — five years from end of financial year).

---

## Roles and responsibilities

| Role | Holder | Responsibility |
|---|---|---|
| Policy owner | Camille (CFO, governance) | Policy decisions; materiality threshold; CFO sign-off; escalation arbiter |
| Implementation | Bea (Accounting & financial reporting engineer, engineering) | Executing the substantiation run; exception triage; working-paper production; `JournalAdjustmentRequested` authoring |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering) | Recon harnesses asserting completeness, exception-free close, and sign-off attribution; Wave-4 recon pipeline |
| Operations | Tomas (Operations & payments engineer, engineering) | Resolution of aged nostro items and suspense balances; correspondent reconciliation |
| Company Secretary | Owen (Company Secretary, governance) | AC pack contribution; annual Board AC framework review scheduling |
| External auditor | Registered auditor (appointed at licence-day) | ISA 700 audit opinion; independent substantiation-methodology review |

---

## Cadence and triggers

| Trigger | Source | SLA |
|---|---|---|
| **Scheduled — period-close** | `AccountingPeriodClosed` event in event store | `BalanceSheetSubstantiationCompleted` emitted within 2 agent ticks of close event; before next BA-return submission gate opens |
| **Scheduled — scheduler fallback** | Monthly scheduler tick at period-end + 1 working day (if `AccountingPeriodClosed` absent) | Same SLA; emit `SubstrateAlert` for missing `AccountingPeriodClosed` event |
| **On-demand — CFO / CEO** | Direct instruction from Camille (CFO, governance) or CEO | Within 1 working day |
| **On-demand — auditor query** | External-auditor working-paper request | Within 2 working days |

---

## Controls and monitoring

### Vera recon assertions

| Recon | Assertion | Cadence |
|---|---|---|
| `recon:bss-completeness` | Every `AccountingPeriodClosed` has a matching `BalanceSheetSubstantiationCompleted` within 2 agent ticks | Continuous |
| `recon:bss-exception-free-close` | No completion event carries an open `unexplained` item without a matching `AgentEscalationDecided` resolution event | Continuous |
| `recon:bss-cfo-sign-off-attribution` | Every human-in-loop completion event has a corresponding `BalanceSheetSubstantiationApproved` attributed to Camille | Continuous |
| `recon:bss-substrate-gap-trend` | Substrate-gap exception count per period is not trending upward over 3 consecutive periods | Quarterly |
| `recon:bss-documented-exception-staleness` | No CFO-exception item in a completion event is more than 5 business days unresolved | Daily |

### BA-return submission gate

No BA-return submission gate may proceed without a `BalanceSheetSubstantiationCompleted` event for the relevant period carrying `exceptionsOpen` with zero `unexplained` items (or a CFO documented-exception grant for any open item). This gate is enforced at the system level in the BA-return submission workflow (PROC-FIN-BA-01).

### Dashboard finance tile

The `BalanceSheetSubstantiationCompleted` event feeds the dashboard finance tile: last substantiation run status, open unexplained exceptions (with days-outstanding counter), substrate-gap trend (rolling 3-period), and next scheduled run. Status: PLANNED — Close Engine M2 milestone.

---

## Escalation pathway

| Trigger | Escalation | Timeline |
|---|---|---|
| Double-entry imbalance in trial balance | Bea → Camille (CFO) `AgentEscalation { severity: "critical" }` | Immediately; halt run |
| `unexplained` exception at or above ZAR 50,000 | Bea → Camille; `JournalAdjustmentRequested` emitted | Same agent tick |
| Unexplained variance unresolved for > 1 business day after CFO notification | Bea escalates to external auditor (post-licence); build-phase fallback = Marc (CEO) | Next business day |
| `BalanceSheetSubstantiationCompleted` not emitted within 2 ticks of period close | Vera raises `BSS-MISSING` finding; notifies Camille and Bea; blocks BA-return gate | Automated |
| Non-zero suspense balance > 2 business days | Bea → Tomas (Operations & payments) + Camille | Same-day resolution required |
| P1 violation (untraced posting) | Bea → Camille `AgentEscalation { severity: "critical", finding: "p1-violation-untraced-posting" }` | Immediately |

---

## Change control

### Approval authority

Camille (CFO, governance) is the sole approval authority for changes to the materiality threshold, exception-classification rules, account scope, and sign-off methodology. Changes affecting regulatory-return scope (BA 100 / BA 300 / BA 325 / BA 326) additionally require Board Audit Committee notification before the effective date.

### Change procedure

1. Any team member may propose a change by filing a brief addressed to Camille citing the specific section and proposed amendment.
2. Camille reviews within 1 agent tick; consults Helena (CRO, governance) for changes affecting regulatory-return scope.
3. Approval is recorded as a `Decision` event referencing `FIN-BSS-01` and the version being superseded.
4. Changes take effect at the **close-of-month following approval** — no mid-period methodology change.
5. Version bump; Vera notified via event tag on the `Decision` record.

**Emergency amendments** (required by a regulatory amendment before the next period close) may be approved by Camille effective immediately, documented in the change log within 1 business day, and notified to the Board AC within 5 business days.

---

## Relationship to other policies and procedures

| Document | Relationship |
|---|---|
| [`Policies/accounting-policies-ifrs-v1.md`](accounting-policies-ifrs-v1.md) (FIN-ACCT-01) | Parent policy — IFRS classification, measurement, and materiality framework |
| [`Procedures/by-policy/balance-sheet-substantiation.md`](../Procedures/by-policy/balance-sheet-substantiation.md) (PROC-FIN-BSS-01) | Implementing procedure — step-by-step operating sequence for each substantiation run |
| [`Procedures/by-policy/month-end-close.md`](../Procedures/by-policy/month-end-close.md) (PROC-FIN-MC-01) | Orchestrator — substantiation is a named step in the month-end close sequence |
| [`Procedures/by-policy/ba-return-generation.md`](../Procedures/by-policy/ba-return-generation.md) (PROC-FIN-BA-01) | Downstream — BA-return submission gated on `BalanceSheetSubstantiationCompleted` |
| [`Policies/financial-reporting-policy-v1.md`](financial-reporting-policy-v1.md) | Parallel — financial-reporting policy governs the broader reporting chain; substantiation is an input control |
| [`Policies/reconciliation-break-management-policy-v1.md`](reconciliation-break-management-policy-v1.md) | Parallel — reconciliation-break policy covers cross-system breaks; substantiation covers the event-store-to-GL link |

---

## Authority and citations

**Statutory instruments:**

- Banks Act 94/1990 s.90 — accounting records; s.90(5) — external auditor approval by PA.
- Companies Act 71 of 2008 §§28–30 — financial statements must fairly present; responsible officers must sign.
- IAS 1 §29–§31 — materiality; §36–§37 — reporting frequency.
- IFRS 9 §5.7.1 / §4.1 — FVTPL and amortised-cost measurement basis.
- IAS 21 §28 — monetary item retranslation at closing rate; nostro and FX accounts.
- **ORG-AC-13** (Banks Act Regulations — BA returns) — period-end balances underpinning BA 100 / BA 300 / BA 325 / BA 326 must be substantiated.

**Internal canonical sources:**

- [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — ORG-AC-13 and related obligation rows.
- [`Team/_team-roster.json`](../Team/_team-roster.json) — canonical agent names and reporting lines.
- [`Policies/accounting-policies-ifrs-v1.md`](accounting-policies-ifrs-v1.md) — IFRS classification, materiality, and ECL framework (FIN-ACCT-01).
- [`Procedures/by-policy/balance-sheet-substantiation.md`](../Procedures/by-policy/balance-sheet-substantiation.md) — implementing procedure (PROC-FIN-BSS-01).
- **D-RMS-PHASE-1** (CEO-approved 2026-05-09) — event-type registration; `RETENTION_BANKS_ACT_S90_5Y` retention class.
- **CLAUDE.md** — "Operating procedures" (events-first authoring; dispatch discipline); Architectural Principles 1, 2, 6.

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-30 | Bea (Accounting & financial reporting engineer, engineering) | Initial standalone policy drafted from PROC-FIN-BSS-01 (v1.1) and FIN-ACCT-01 (v1.3). Establishes nine policy statements (completeness, source-event traceability, double-entry integrity, IFRS classification currency, suspense zero-balance assertion, materiality and exception classification, CFO sign-off, documented exceptions, evidence and retention); roles and responsibilities; Vera recon assertions; BA-return gate; escalation pathway; change control. Status DRAFT — requires CEO decision to approve (decision-required: true). |

---

*Bea (Accounting & financial reporting engineer, engineering) on behalf of Camille (CFO, governance)*
