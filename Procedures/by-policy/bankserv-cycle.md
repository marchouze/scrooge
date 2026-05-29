---
policy-parent: Payments Policy v0.1 (STUB) · Sponsor-Bank Operating Policy v0.1 (STUB)
last-reviewed: 2026-05-16
procedureId: PROC-PAY-BSC-01
title: Correspondent instruction timing — BankservAfrica scheme cycles
author: Tomas (payments engineer)
date: 2026-05-16
owner: Tomas (payments engineer)
status: POPULATED
policy-cited: Payments Policy v0.1 (STUB) · Sponsor-Bank Operating Policy v0.1 (STUB)
system-capability: "@platform/payments/calendar-engine (PLANNED)"
---

# Procedure — Correspondent instruction timing — BankservAfrica scheme cycles

**Procedure ID:** PROC-PAY-BSC-01
**Owner:** Tomas (payments engineer)
**Approval:** BRC (under Payments Policy v0.1 — STUB; Sponsor-Bank Operating Policy v0.1 — STUB)
**Cadence:** Continuous intraday (per-instruction cycle check); daily opening schedule load; updated whenever PASA publishes scheme-rule amendments or BankservAfrica cycle changes
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Payments Policy v0.1 §6 (Cut-off discipline); §3 (Indirect-participant posture); §4 (ISO 20022 discipline).
- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Sponsor-Bank Operating Policy v0.1 §5 (Limits and cut-offs).

Obligation chain:
```
Regulation (NPS Act 78/1998 → PASA scheme rules → BankservAfrica operating rules)
  → Policy (Payments Policy v0.1 §6 — Cut-off discipline)
    → This procedure (PROC-PAY-BSC-01 — internal cycle-timing discipline)
      → System capability (@platform/payments/calendar-engine — PLANNED)
```

> **Scope note:** The bank is an **indirect** NPS participant. It accesses BankservAfrica schemes (EFT credit, EFT debit, RTC, PayShap) via the correspondent bank. This procedure governs the bank's **internal** submission timing — ensuring instructions reach the correspondent in time for the correspondent to submit to the correct BankservAfrica scheme cycle. It does NOT govern BankservAfrica participation directly.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| National Payment System Act 78/1998 s.3–4 | Designates payment-system participants; indirect participants rely on direct members for scheme access. The correspondent holds the BankservAfrica membership. |
| PASA (Payments Association of South Africa) scheme rules — EFT credit / EFT debit / RTC / PayShap (current versions) | Define cycle cut-off times, same-day settlement windows, and scheme-specific processing rules. |
| SARB NPSD Directives (current) | Payment system oversight; indirect participants must ensure scheme compliance is honoured through their direct-member correspondent. |
| Banks Act 94/1990 s.78 | Operational risk management; missed scheme cycles are operational failures. |
| Banks Act Regulations, Reg 26 (Operational Risk) | Cycle-miss events are Loss Events captured via PROC-RISK-RCSA-01. |

## 3. Purpose

Ensure every bank-originated payment instruction that routes via a BankservAfrica scheme reaches the correspondent bank within the bank's internal cut-off — giving the correspondent sufficient processing time to submit to the correct BankservAfrica scheme cycle.

The bank uses four BankservAfrica scheme families (via correspondent):

| Scheme | Mechanism | Typical cycle frequency | Typical value date |
|---|---|---|---|
| EFT credit (ACH) | Batch — multi-cycle | Multiple daily intraday batches | T+1 (standard) / same-day batches |
| EFT debit (ACH) | Batch — multi-cycle | Multiple daily intraday batches | T+1 |
| RTC (Real-Time Clearing) | Near-real-time | Continuous (24/7) | T+0 |
| PayShap | Real-time (ISO 20022 pacs.008 + pacs.002) | Continuous (24/7) | T+0 |

Cut-off times and cycle windows are scheme-specific and subject to PASA rule amendments. The authoritative source is the correspondent's published timetable (stored in `_sponsor-bank-operating-model.md`).

## 4. Trigger

- **Per-instruction:** every outbound payment instruction processed via PROC-OPS-PS-01 that targets a BankservAfrica scheme triggers a scheme-cycle check. The calendar engine is called at PROC-OPS-PS-01 Step 6.
- **Daily opening:** at system start each business day, the calendar engine loads the day's BankservAfrica scheme cycle schedule from the correspondent's published timetable.
- **Scheme-rule amendment:** when PASA publishes a scheme-rule change affecting cycle timing, the calendar engine configuration is updated within one business day; Tomas (payments engineer) validates and records a `SchemeCalendarUpdated` event.
- **Real-time scheme (RTC / PayShap):** cycle check is effectively continuous; the main gate is scheme availability (not batch cut-off). Scheme availability is monitored via the correspondent's connectivity status feed.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Load daily scheme schedule.** At system start, read the correspondent's published BankservAfrica scheme timetable. Parse cycle cut-offs and batch windows for EFT credit, EFT debit, RTC, and PayShap. Confirm no PASA emergency amendment is outstanding. | system | `@platform/payments/calendar-engine` (PLANNED — build-phase: static config from `_sponsor-bank-operating-model.md`) | If PASA amendment pending and not yet reflected, alert Tomas (payments engineer) before accepting scheme instructions. |
| 2 | **Resolve scheme from instruction.** On `SettlementInstructionReceived`, determine the target BankservAfrica scheme. Resolution priority: (a) explicit `scheme` field on instruction; (b) inference from beneficiary account type and bank; (c) urgency flag (RTC / PayShap for urgent same-day domestic). Record `SchemeResolved { paymentId, scheme, resolvedBy }`. | system | `@platform/payments/instruction-validator`; `@platform/payments/calendar-engine` | If scheme cannot be resolved, reject with `PaymentRejected { reason: "unresolvable-scheme" }` and alert Tomas (payments engineer). |
| 3 | **Compute bank-internal cut-off per scheme.** For batch schemes (EFT credit / EFT debit): subtract correspondent processing buffer from the next available scheme batch cut-off. For real-time schemes (RTC / PayShap): check scheme availability status; if available, proceed immediately; if degraded, hold and alert. | system | `@platform/payments/calendar-engine` | Build-phase processing buffer: 45 minutes for batch; 0 for real-time (real-time schemes are submitted on receipt if available). Production: from correspondent operating-contract SLA (Imani, legal & contracts engineer). |
| 4 | **Batch scheme — cut-off check.** For EFT credit / debit instructions, compare current time against the bank-internal cut-off for the next available batch window. Three outcomes: (a) within window — proceed to Step 6; (b) approaching cut-off (within 15-minute warning) — emit `SchemeCutOffWarning` and fast-track; (c) past internal cut-off — defer to next batch window; emit `SchemeCutOffDeferred`. | system + Tomas (payments engineer) | `@platform/payments/calendar-engine`; `@platform/events/alert-dispatcher` (PLANNED) | Deferred EFT credit / debit: update `settlementDate` accordingly; notify originator. Multiple batch windows per day mean same-day recovery is often possible. |
| 5 | **Real-time scheme — availability check.** For RTC / PayShap instructions, query the scheme availability status from the correspondent's connectivity feed. If `available`: proceed immediately to Step 6. If `degraded` or `unavailable`: hold instruction; emit `SchemeUnavailable { paymentId, scheme, reason }`; alert Tomas (payments engineer). Evaluate fallback to EFT credit if urgency permits. | system + Tomas (payments engineer) | `@platform/payments/<scheme>-connector`; `@platform/payments/calendar-engine` | Fallback from RTC/PayShap to EFT credit requires originator approval (value-date change). Kai (markets systems engineer) notified if trade-linked. |
| 6 | **Dispatch to correspondent.** Instructions confirmed within the scheme-cycle window are handed off to PROC-OPS-PS-01 Step 7. Record `SchemeCycleCheckPassed { paymentId, scheme, cycle, dispatchTime }`. | system | `@platform/payments/sponsor-channel-envelope` (PLANNED) | `SchemeCycleCheckPassed` is consumed by the nostro management procedure (PROC-PAY-NM-01) for intraday balance projection. |
| 7 | **Batch cycle close reconciliation.** After each EFT batch cycle closes, confirm all `SchemeCycleCheckPassed` instructions for that cycle received correspondent acknowledgement. Instructions with no ACK within 30 minutes of cycle close are a cycle-miss finding. Emit `SchemeCycleClose { scheme, cycle, passedCount, ackedCount, cycleMissCount }`. | system | `@platform/payments/reconciliation` (PROC-PAY-RBH-01) | Cycle misses escalated per §7; recorded as operational-risk loss events. |
| 8 | **Daily scheme report.** Produce a `DailySchemeReport` summarising: instructions per scheme per cycle; deferred; fast-tracks; cycle misses; scheme unavailability events. Consumed by ALCO reporting and Vera audit trail. | system | `@platform/payments/calendar-engine` | Automated; no manual step in steady state. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Tomas (payments engineer) | Owns calendar engine scheme configuration; validates PASA scheme-rule updates; decides fast-track or deferral; manages scheme-unavailability fallback decisions; escalates cycle misses. |
| Devon (COO, governance) | Receives escalation for material cycle misses or scheme outages affecting Important Business Services; approves communications to counterparties. |
| Eitan (Treasurer) | Notified of deferred treasury-originated flows; updates intraday liquidity position (PROC-RISK-ILF-01). |
| Kai (markets systems engineer) | Notified of deferred or failed trade-settlement-linked instructions; manages counterparty value-date co-ordination. |
| Imani (legal & contracts engineer) | Custodian of the correspondent operating contract; source of scheme-processing buffer SLA values. |
| Helena (Chief Risk Officer, governance) | Receives cycle-miss operational-risk findings; approves material RCSA updates. |

## 7. Escalation

| Condition | Escalation path | SLA |
|---|---|---|
| Scheme-cycle miss (passed check, no ACK) | Tomas → Devon (COO) → operational-risk loss-event (PROC-RISK-RCSA-01) | Within 2 hours of cycle close |
| RTC / PayShap unavailable > 30 minutes | Tomas → Devon (COO) + Eitan (treasury) — assess fallback and counterparty impact | Immediate |
| Unresolvable scheme on instruction | Tomas — review instruction; reject or manually classify | Within 15 minutes |
| Three or more deferred instructions in one cycle | Tomas → Devon (COO) + Helena (CRO) | Same business day |
| PASA scheme-rule amendment with less than 1-hour notice | Tomas → Devon (COO) + Eitan (treasury) | Immediate |
| Calendar engine failure | Atlas (infrastructure engineer) + Tomas — halt BankservAfrica dispatch until resolved | Immediate |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/payments/calendar-engine` | PLANNED | Scheme cycle windows, bank-internal cut-offs, batch schedule; driven by correspondent timetable. |
| `@platform/payments/instruction-validator` | PLANNED | Scheme resolution from instruction fields. |
| `@platform/payments/<scheme>-connector` | PLANNED (per scheme) | EFT-credit-connector, EFT-debit-connector, RTC-connector, PayShap-connector; all synthetic-only in build phase. |
| `@platform/payments/sponsor-channel-envelope` | PLANNED | Wraps dispatched instructions with correspondent-channel correlation headers. |
| `@platform/payments/reconciliation` | PLANNED | Consumes `SchemeCycleClose` events for cycle-miss detection. |
| `@platform/events/alert-dispatcher` | PLANNED | Delivers `SchemeCutOffWarning` and `SchemeUnavailable` alerts to Tomas. |

## 9. Quality controls

- **Daily schedule validation:** calendar engine asserts all four scheme windows are loaded before the first instruction is accepted.
- **Buffer floor:** correspondent processing buffer must be ≥ 20 minutes for batch schemes; if the operating contract specifies less, Imani (legal & contracts engineer) and Devon (COO, governance) are notified for renegotiation.
- **Cycle-miss KRI:** cycle-miss rate > 0% in any calendar month is a Red KRI; reported to ALCO and BRC.
- **Real-time availability SLA:** RTC / PayShap availability must be ≥ 99.5% on a rolling 30-day basis (from correspondent SLA); breaches below 99% are escalated to Devon and Helena.

## 10. Evidence / audit trail

| Artefact | Event | Retention | Sensitivity |
|---|---|---|---|
| Daily scheme schedule load | `SchemeCalendarLoaded { date, scheme, cycleWindows }` | Indefinite (Principle 1) | Internal |
| Scheme resolution per instruction | `SchemeResolved` | Indefinite | Internal |
| Per-instruction cycle check | `SchemeCycleCheckPassed` or `SchemeCutOffDeferred` or `SchemeCutOffWarning` or `SchemeUnavailable` | Indefinite | Internal |
| Batch cycle close summary | `SchemeCycleClose` | Indefinite | Internal |
| Daily scheme report | `DailySchemeReport` | Indefinite | Internal |
| Cycle-miss loss event | `OperationalLossEvent` (PROC-RISK-RCSA-01) | Per RCSA retention schedule | Internal |
| Scheme-rule update change record | `SchemeCalendarUpdated` | Indefinite | Internal |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Tomas (via Scrooge) | Initial population. Four BankservAfrica scheme families; batch vs real-time cycle discipline; indirect-participant posture; calendar engine as PLANNED capability. Cross-references PROC-OPS-PS-01 Step 6, PROC-PAY-NM-01, and PROC-PAY-RBH-01. |
