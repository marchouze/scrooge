---
policy-id: reconciliation-break-management-policy
title: Reconciliation and Break Management Policy v1
version: "1"
status: COMMENCEMENT-BIND
owner: Devon (Chief Operating Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Banks Act 94 of 1990 s.73 (accurate books and records)
  - Regulations Relating to Banks 2012 (as amended) reg.39 (internal controls)
  - ISDA OTC portfolio reconciliation standards (ISDA 2012 Margin Survey; ISDA 2013 Portfolio Reconciliation, Dispute Resolution and Disclosure Protocol)
  - Regulations Relating to Banks 2012 (as amended) reg.32 (CCR — portfolio reconciliation reduces disputes)
author: Tomas (Operations & payments engineer, engineering) + Bea (Accounting & financial reporting engineer, engineering)
date: 2026-05-22
summary: Reconciliation and Break Management Policy covering five reconciliation scopes (position, nostro, GL, margin, OTC portfolio), a three-tier break classification (P1 cash >ZAR 100k/>USD 10k, P2 position any size, P3 static), aging thresholds with same-day/T+3/T+5 resolution deadlines, escalation matrix, root-cause analysis for aged breaks, and reconciliation dashboard. Typed events ReconciliationBreakIdentified, ReconciliationBreakResolved. COMMENCEMENT-BIND. Closes OTC-derivative obligations ORG-CS3-003 (portfolio reconciliation), ORG-ODP-COND-007 (written portfolio-reconciliation arrangements), and ORG-ODP-COND-009 (portfolio-compression analysis).
decision-required: false
riskTaxonomy:
  - RT-OR
---

# Reconciliation and Break Management Policy v1

> **Authors.** Tomas (Operations & payments engineer, engineering) — lead; Bea (Accounting & financial reporting engineer, engineering) — co-author.
> **Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10). Implements Banks Act 94 of 1990 s.73 accurate books-and-records obligations and the internal control requirements of Regulations Relating to Banks reg.39. Aligns with ISDA portfolio reconciliation standards for OTC derivatives. The reconciliation framework integrates with the Nostro and Correspondent Banking Policy (nostro reconciliation), the GL posting engine (Bea's domain), and the Margin Policy (margin reconciliation).
> **Obligations closed.** Banks Act s.73 (books and records accurate and up to date); Regulations Relating to Banks reg.39 (internal controls — reconciliation as detective control); ISDA portfolio reconciliation obligations for active OTC counterparties.
> **Status.** COMMENCEMENT-BIND. The reconciliation framework is operationally required from the first client transaction. Build-phase substrate (reconciliation harness, break tracker, GL reconciliation projection) is under construction per `D-REGULATORY-READINESS-GATE-PLAN`.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Reconciliation and Break Management — Overarching

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual policy review; reconciliations are daily operational cadence · **Citation:** Banks Act 94 of 1990 s.73 + Regulations Relating to Banks reg.39 + ISDA OTC portfolio reconciliation standards + Regulations Relating to Banks reg.32

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") reconciles its internal records against external sources and how it identifies, classifies, escalates, and resolves reconciliation breaks. Reconciliation is the Bank's primary detective control for operational errors, system failures, and fraud — it is the mechanism by which the event log is validated against external reference points. A well-functioning reconciliation framework ensures that the Bank's books and records are accurate, that settlement positions are correct, and that regulatory reporting is based on validated data.

The policy establishes five reconciliation scopes: (1) position reconciliation — internal vs STRATE/custodian; (2) nostro reconciliation — internal vs SWIFT statements (per Nostro and Correspondent Banking Policy); (3) GL reconciliation — sub-ledger vs general ledger; (4) margin reconciliation — internal vs CSA statements; and (5) OTC portfolio reconciliation per ISDA threshold.

A "reconciliation break" is any identified difference between the Bank's internal record and the corresponding external reference that cannot be explained by a known timing difference or cannot be resolved by Tomas's investigation within the same business day. Every break is a typed event; every break resolution is a typed event. No break is closed without a resolution event and a root cause.

### Principles

- **Every reconciliation produces a typed event.** Every completed reconciliation cycle — whether it produces breaks or not — results in a `ReconciliationCompleted` or `ReconciliationBreakIdentified` event (Principle 1). A reconciliation that was "done" but not evidenced by an event has not happened for control purposes.
- **Break classification drives escalation.** Breaks are classified immediately on identification per the three-tier taxonomy in §2. Classification determines the escalation path and resolution deadline. Under-classification of breaks is a Vera finding.
- **Root cause is mandatory for aged breaks.** Any break that passes its resolution deadline without resolution requires a formal root-cause analysis (RCA) filed by Tomas to the operational risk register. The RCA identifies the control failure that caused the break to age, not just the resolution of the specific break instance.
- **Reconciliation dashboard is live.** Bea maintains the reconciliation dashboard as a real-time projection over reconciliation events. Devon reviews the dashboard daily (number of open breaks by classification; oldest break age; break resolution rate). The dashboard is a render of events, not a stored state (Principle 1).
- **Independent preparation and review.** Reconciliations are prepared by Tomas; breaks above P1 threshold are independently reviewed by Bea before escalation. No reconciliation may be signed off by the same person who prepared it for P1 breaks.

### Roles

Devon (Chief Operating Officer, governance) is the policy owner and the ultimate escalation point for unresolved P1 breaks. Devon reviews the daily reconciliation dashboard and chairs the break management review for P1 items.

Tomas (Operations & payments engineer, engineering) prepares all daily reconciliations (position, nostro, margin, OTC portfolio). Tomas identifies breaks, classifies them, performs first-level investigation, and escalates per this policy. Tomas owns the break tracker.

Bea (Accounting & financial reporting engineer, engineering) prepares the GL reconciliation (sub-ledger vs GL) and independently reviews P1 breaks identified by Tomas. Bea owns the reconciliation dashboard projection and the GL reconciliation projection. Bea's `ReconciliationBreakIdentified` events are the canonical record for the operations-risk register.

Helena (Chief Risk Officer, governance) receives the daily operational risk event feed including all P1 break events. Persistent P1 breaks are included in Helena's operational risk report to ALCO and the BRC.

Vera (internal audit engineer — reports functionally to Thandiwe (Chief Audit Executive, governance)) audits the reconciliation framework quarterly, including: break population completeness; aging distribution; RCA quality; dashboard accuracy.

---

## 2. Reconciliation Scope and Break Classification

**Owner:** Tomas (Operations & payments engineer, engineering) · **Approval:** COO for scope changes; break classification thresholds reviewed annually · **Cadence:** Reconciliation cadence varies by scope — see §3 · **Citation:** Banks Act 94 of 1990 s.73 + Regulations Relating to Banks reg.39

### 2.1 Reconciliation Scopes

| Scope | Description | External reference | Cadence |
|---|---|---|---|
| Position reconciliation | Internal securities position (event-log derived) vs STRATE/custodian holding statement | STRATE statement / custodian daily report | Daily |
| Nostro reconciliation | Internal nostro balance (event-log derived) vs SWIFT MT940 statement | SWIFT MT940/MT950 from correspondent bank | Daily (same-day close) |
| GL reconciliation | Sub-ledger postings vs general ledger trial balance | Internal GL trial balance | Daily (T+0 vs T-1 close) |
| Margin reconciliation | Internal margin balance per CSA vs counterparty margin statement | Counterparty margin call / statement | Daily for active CSAs |
| OTC portfolio reconciliation | Internal OTC derivative position record vs counterparty position record | Counterparty portfolio reconciliation report (MarkitWIRE or bilateral) | Daily for active; weekly for dormant |

### 2.2 Break Classification

**P1 — Cash break (highest priority):** Any unidentified cash difference above ZAR 100,000 or USD 10,000 equivalent in any reconciliation scope. P1 breaks include: unidentified nostro debits or credits above threshold; GL cash posting differences above threshold; margin call discrepancies above threshold. P1 breaks are an immediate operational risk event.

**P2 — Position break:** Any unidentified difference in securities position, OTC derivative notional, or quantity (any size — there is no minimum threshold for a position break). A securities position difference of any amount may have downstream capital, settlement, and regulatory reporting implications. P2 breaks include: STRATE holding statement differences; OTC portfolio reconciliation discrepancies; margin eligible collateral differences.

**P3 — Static data mismatch:** Any discrepancy in static data fields (security identifiers, counterparty details, trade reference numbers, account numbers) that causes a reconciliation difference but does not itself result in a P1 or P2 break. P3 breaks are lower priority but must be resolved to prevent future P1/P2 breaks.

### 2.3 Break Identification — Typed Event

On identification of any break, Tomas emits:

```
ReconciliationBreakIdentified {
  breakId,
  scope,          // position | nostro | gl | margin | otc-portfolio
  classification, // P1 | P2 | P3
  amount,         // ZAR equivalent (null for P3 static breaks)
  currency,
  description,
  identifiedAt,
  identifiedBy
}
```

This event is the canonical record of the break. No break exists for control purposes without this event.

---

## 3. Aging Thresholds and Resolution Deadlines

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO · **Cadence:** Monitored daily via the reconciliation dashboard · **Citation:** Regulations Relating to Banks reg.39 (internal controls)

| Classification | Resolution deadline | Beyond deadline |
|---|---|---|
| P1 — Cash break | Same business day (by 17:00 on day of identification) | Devon + CFO notified immediately; RCA required within 1 business day of resolution |
| P2 — Position break | T+3 (three business days from identification) | Devon notified; RCA required within 1 business day of resolution |
| P3 — Static data mismatch | T+5 (five business days from identification) | Operations lead (Tomas) completes RCA; Devon informed |

A break is "resolved" when:
1. The cause has been determined.
2. The underlying error has been corrected in the event log and the affected downstream records.
3. The external reference and internal record agree.
4. A `ReconciliationBreakResolved { breakId, resolvedAt, resolution, rootCause }` event has been emitted.

A break may not be closed without a `ReconciliationBreakResolved` event. Marking a break as resolved without resolution in the event log is a Principle 1 violation.

---

## 4. Escalation Matrix

**Owner:** Devon (Chief Operating Officer, governance) · **Approval:** COO for escalation matrix changes · **Cadence:** Applied on every P1/P2 break · **Citation:** Regulations Relating to Banks reg.39

| Classification | Escalation on identification | Escalation at deadline + 0 | Escalation at deadline + 1 |
|---|---|---|---|
| P1 | Tomas + Bea (review) + Devon (notify) + Helena (operational risk event) | COO + CFO (if cash; Camille) | CEO; consider PA notification (Zara's assessment) |
| P2 | Tomas + Bea (review) + Devon (T+1 report) | Devon | Devon + Helena |
| P3 | Tomas | Tomas + Operations lead | Devon (if persistent) |

For P1 breaks involving nostro cash differences, Eitan (Treasurer, governance) is notified immediately alongside Devon — a P1 nostro break may indicate a funding or fraud event.

For P1 breaks involving margin discrepancies, Helena is notified alongside Devon — a margin break affects CCR capital measurement.

---

## 5. Root-Cause Analysis

**Owner:** Tomas (Operations & payments engineer, engineering) — preparation; Devon (COO) — review and sign-off · **Approval:** COO for RCA closure · **Cadence:** Required for all breaks resolved beyond deadline; all P1 breaks regardless of resolution speed · **Citation:** Regulations Relating to Banks reg.39

An RCA must address:
1. **What broke?** Which reconciliation scope, which specific account or position, what amount.
2. **Why did it break?** Root cause categories: (a) system error (event log error, GL posting error); (b) human error (manual input error); (c) external error (correspondent bank error, STRATE error, counterparty error); (d) process gap (missing control or step in the procedure); (e) timing / cutoff misalignment (genuine timing difference that was not flagged correctly).
3. **What was the impact?** Any downstream consequence — settlement fail, margin shortfall, capital misstatement, regulatory reporting error.
4. **What was done to resolve?** Step-by-step.
5. **What control improvement is needed?** Preventive: process change, system change, additional automated check. Detective: enhanced monitoring, lower break threshold.

RCAs are filed by Tomas to the operational risk register (Helena's domain) as a `OperationalRiskEventRecorded` event with the RCA attached. Vera reviews the RCA quality at the quarterly audit.

---

## 6. Reconciliation Dashboard

**Owner:** Bea (Accounting & financial reporting engineer, engineering) · **Approval:** COO for dashboard design changes · **Cadence:** Live projection; reviewed daily by Devon · **Citation:** Principle 1 (events are the only source of truth)

Bea maintains the reconciliation dashboard as a projection over the event log. The dashboard provides Devon with:
- Number of open breaks by classification (P1 / P2 / P3).
- Oldest open break age (in business days).
- Break resolution rate (breaks closed within deadline / total breaks, rolling 30 days).
- Break population by reconciliation scope.
- Trend: new breaks per day vs. resolved breaks per day (rolling 7 days).

The dashboard is a read-only projection; it cannot be edited. Every change in state on the dashboard reflects an event in the event log. A dashboard item that does not correspond to a `ReconciliationBreakIdentified` or `ReconciliationBreakResolved` event is a Principle 1 violation reportable to Vera.

---

## 7. Typed Events

This policy generates and consumes the following typed events (Principle 1):

| Event type | Trigger | Owner |
|---|---|---|
| `ReconciliationBreakIdentified` | Break identified in any reconciliation scope | Tomas |
| `ReconciliationBreakResolved` | Break resolved; root cause documented | Tomas |

---

## 8. Substrate Dependencies and Gaps

- **Position reconciliation feed (Tomas + Atlas).** Automated STRATE/custodian statement ingestion and position comparison against event-log-derived internal position. Currently manual; automation is a roadmap item.
- **GL reconciliation projection (Bea).** Daily sub-ledger vs GL comparison produced by Bea's accounting engine. Discharge exit signal: `ReconciliationBreakIdentified` event auto-generated for GL differences above P1 threshold.
- **Margin reconciliation (Tomas).** CSA statement ingestion and margin balance comparison. Gap: electronic CSA statement delivery from counterparties — bilateral agreed process required at commencement of trading.
- **Reconciliation dashboard (Bea + Anya).** Live projection in the bank's intranet dashboard. Discharge exit signal: dashboard renders from event log; no stored state.

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Tomas (Operations & payments engineer, engineering) + Bea (Accounting & financial reporting engineer, engineering) | Initial policy authored. Six operative sections: (1) Overarching — five scopes, events-first principle, break classification, dashboard; (2) Scope and Classification — five scopes, P1/P2/P3 taxonomy, typed event on identification; (3) Aging Thresholds — same-day (P1), T+3 (P2), T+5 (P3); (4) Escalation Matrix — by classification and age; (5) Root-Cause Analysis — mandatory for P1 and aged breaks; (6) Reconciliation Dashboard. |
