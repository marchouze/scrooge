---
policy-parent: Payments Policy v0.1 (STUB) · Sponsor-Bank Operating Policy v0.1 (STUB)
last-reviewed: 2026-05-16
procedureId: PROC-PAY-SCO-01
title: Correspondent instruction cut-off discipline — NPS settlement windows
author: Tomas (payments engineer)
date: 2026-05-16
owner: Tomas (payments engineer)
status: POPULATED
policy-cited: Payments Policy v0.1 (STUB) · Sponsor-Bank Operating Policy v0.1 (STUB)
system-capability: "@platform/payments/calendar-engine (PLANNED)"
---

# Procedure — Correspondent instruction cut-off discipline — NPS settlement windows

**Procedure ID:** PROC-PAY-SCO-01
**Owner:** Tomas (payments engineer)
**Approval:** BRC (under Payments Policy v0.1 — STUB; Sponsor-Bank Operating Policy v0.1 — STUB)
**Cadence:** Continuous intraday (per-instruction cut-off check); daily opening rehearsal; updated whenever SARB NPSD publishes a SAMOS calendar change
**Version:** v0.1 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Payments Policy v0.1 §6 (Cut-off discipline); §3 (Indirect-participant posture).
- `Owner Inbox/2026-05-07_tomas_payments-policies-bundle-v0.md` § Sponsor-Bank Operating Policy v0.1 §5 (Limits and cut-offs).

Obligation chain:
```
Regulation (NPS Act 78/1998 → SARB NPSD NPS operating rules → NPS Rule Book)
  → Policy (Payments Policy v0.1 §6 — Cut-off discipline)
    → This procedure (PROC-PAY-SCO-01 — internal submission-discipline)
      → System capability (@platform/payments/calendar-engine — PLANNED)
```

> **Scope note:** The bank is an **indirect** NPS participant. It has no direct SAMOS membership. This procedure governs the bank's internal discipline for submitting payment instructions to the correspondent bank in time for the correspondent to settle in the correct SAMOS cycle. It does NOT govern SAMOS participation directly.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| National Payment System Act 78/1998 s.3–4 | Designates payment-system participants and their operating obligations; indirect participants rely on direct participants (the correspondent) for settlement. |
| SARB NPSD NPS Operating Rules (current version) | Defines NPS settlement windows, cut-off times, and settlement cycles. As an indirect participant, the bank's obligations flow through the correspondent, whose own SAMOS participation licence these rules govern. |
| Banks Act 94/1990 s.78 | Operational risk management — cut-off breaches are operational failures that must be captured and remediated. |
| Banks Act Regulations, Reg 26 (Operational Risk) | Quantification and governance of operational risk; cut-off breach is a Loss Event reportable per RCSA (PROC-RISK-RCSA-01). |
| SARB Guidance Note 2/2021 — Intraday Liquidity Management | Intraday NPS settlement windows affect intraday liquidity position; links to PROC-RISK-ILF-01. |

## 3. Purpose

Ensure that every payment instruction the bank must settle via SAMOS is submitted to the correspondent bank within the bank's **internal cut-off** (which precedes the correspondent's own SAMOS submission cut-off by a safety margin). This procedure is the cut-off leg of PROC-OPS-PS-01 (outbound-payment-sponsor-bank-channel.md, Step 6) and feeds the nostro management procedure (PROC-PAY-NM-01).

The NPS RTGS operates two principal settlement cycles (approximate times per SARB NPSD; live times published by the correspondent):

| Cycle | Approx. cut-off (SAST) | Purpose |
|---|---|---|
| Morning cycle | 06:00 | Overnight and early-morning net positions; treasury-driven flows |
| Afternoon cycle | 16:00 | Intraday and end-of-day flows; bulk of markets-settlement instructions |

The bank's internal cut-off must precede these by the correspondent's internal processing buffer (typically 30–60 minutes; read from the correspondent's operating timetable, stored in `_sponsor-bank-operating-model.md`).

## 4. Trigger

- **Per-instruction:** every outbound payment instruction processed via PROC-OPS-PS-01 triggers a cut-off check at Step 6 of that procedure. The cut-off engine is called inline.
- **Daily opening:** at system start each business day, the calendar engine loads the day's NPS settlement schedule (and any SARB NPSD emergency amendments) from the correspondent's published timetable feed.
- **Calendar update:** when a new SARB NPSD circular amends the NPS operating calendar, the calendar-engine configuration is updated within one business day; Tomas (payments engineer) validates the update and records a `CalendarConfigUpdated` event.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Load daily NPS settlement schedule.** At system start (or upon NPSD calendar-change notification), read the correspondent's published settlement timetable. Parse morning and afternoon cycle cut-off times into the calendar engine. Confirm no NPSD emergency amendment is outstanding. | system | `@platform/payments/calendar-engine` (PLANNED — today: static config from `_sponsor-bank-operating-model.md`) | If NPSD amendment is pending, alert Tomas (payments engineer) before proceeding; do not use stale times. |
| 2 | **Compute bank-internal cut-off.** For each SAMOS cycle, subtract the correspondent's processing buffer (read from `_sponsor-bank-operating-model.md`, field `processingBufferMinutes`). The result is the bank's hard internal cut-off. | system | `@platform/payments/calendar-engine` | Build-phase: processing buffer is 45 minutes (synthetic default). Production value comes from the correspondent's operating-contract SLA (Imani, sponsor-bank operating contract). |
| 3 | **Per-instruction cut-off check.** On each `SettlementInstructionReceived` event (from PROC-OPS-PS-01 Step 1), determine the target settlement cycle from the instruction's `valueDate`, `scheme`, and `urgency`. Compare current time against the bank-internal cut-off for that cycle. | system | `@platform/payments/calendar-engine` | Three outcomes: (a) within window — proceed; (b) approaching cut-off (within 15-minute warning threshold) — fast-track alert; (c) past internal cut-off — defer or escalate. |
| 4 | **Fast-track alert (approaching cut-off).** If the instruction arrives within the 15-minute warning window before the bank-internal cut-off, emit `CutOffWarning { paymentId, cycle, internalCutOff, margin }` and alert Tomas (payments engineer) for expedited processing. | system + Tomas (payments engineer) | `@platform/payments/calendar-engine`; `@platform/events/alert-dispatcher` (PLANNED) | Tomas assesses whether the instruction can be completed in time or must defer. Decision is logged as a `CutOffDecision` event. |
| 5 | **Post-internal-cut-off handling.** If the instruction arrives after the bank-internal cut-off for the target cycle: (a) for RTGS / urgent flows — escalate immediately to Devon (COO, governance) + Eitan (Treasurer); (b) for non-urgent bulk flows — defer to the next settlement cycle; update `valueDate` if operationally permissible; notify the originator. Emit `CutOffDeferred { paymentId, originalCycle, deferredCycle, reason }`. | Tomas (payments engineer) + Devon (COO, governance) [on escalation] | `@platform/payments/calendar-engine` | Value-date deferral requires originator approval for trade-linked flows; Kai (markets systems engineer) is notified if a trade settlement is affected. |
| 6 | **Dispatch to correspondent (within window).** For instructions confirmed within the internal cut-off, hand off to PROC-OPS-PS-01 Step 7 (sponsor dispatch). The calendar engine records `CutOffCheckPassed { paymentId, cycle, dispatchTime }`. | system | `@platform/payments/calendar-engine`; `@platform/payments/sponsor-channel-envelope` (PLANNED) | The `CutOffCheckPassed` event is consumed by the nostro management procedure (PROC-PAY-NM-01) for intraday balance projection. |
| 7 | **End-of-cycle reconciliation.** After each SAMOS cycle closes, confirm that all `CutOffCheckPassed` instructions for that cycle received a correspondent acknowledgement (`PaymentInitiated` event with sponsor-ACK). Any instruction that passed the cut-off check but has no sponsor-ACK is a cut-off breach finding. Emit `CutOffCycleClose { cycle, passedCount, ackedCount, breachCount }`. | system | `@platform/payments/reconciliation` (PROC-PAY-RBH-01) | Breaches are escalated per §7 and recorded as operational-risk loss events (PROC-RISK-RCSA-01). |
| 8 | **Daily report.** Produce a `DailyCutOffReport` summarising: instructions per cycle; deferred instructions; fast-tracks; breaches; calendar anomalies. Consumed by ALCO reporting and Vera's audit trail. | system | `@platform/payments/calendar-engine` | Automated; no manual step in steady state. |

## 6. Roles & responsibilities

| Role | Responsibility |
|---|---|
| Tomas (payments engineer) | Owns the calendar engine configuration; validates NPSD calendar updates; decides on fast-track or deferral in Steps 4–5; escalates breaches. |
| Devon (COO, governance) | Receives escalation for RTGS urgent post-cut-off instructions; approves emergency processing if operationally feasible; signs off on breach notifications. |
| Eitan (Treasurer) | Notified of deferred treasury-originated flows; updates intraday liquidity position (PROC-RISK-ILF-01). |
| Kai (markets systems engineer) | Notified of deferred trade-settlement instructions; co-ordinates with counterparties on value-date adjustment. |
| Imani (legal & contracts engineer) | Custodian of the sponsor-bank operating contract (processingBuffer SLA); Tomas reads the buffer value from Imani's clause library. |
| Helena (Chief Risk Officer, governance) | Receives cut-off breach events as operational-risk findings; approves RCSA update if breach is material. |

## 7. Escalation

| Condition | Escalation path | SLA |
|---|---|---|
| RTGS urgent instruction post internal cut-off | Tomas → Devon (COO) + Eitan (treasury) — within 5 minutes | Immediate |
| Three or more deferred instructions in one cycle | Tomas → Devon (COO) + Helena (CRO) — same business day | Same business day |
| settlement cycle breach (passed cut-off, no ACK) | Tomas → Devon (COO) → operational-risk loss-event record (PROC-RISK-RCSA-01) | Within 2 hours of cycle close |
| NPSD emergency calendar amendment with less than 1-hour notice | Tomas → Devon (COO) + Eitan (treasury) — decision on feasibility of running day | Immediate |
| Calendar engine failure (cannot load schedule) | Atlas (infrastructure engineer) + Tomas — halt outbound dispatch until resolved | Immediate |

## 8. System capabilities

| Capability | Status | Notes |
|---|---|---|
| `@platform/payments/calendar-engine` | PLANNED | Manages NPS settlement windows, bank-internal cut-offs, warning thresholds; driven by correspondent's published timetable. |
| `@platform/payments/sponsor-channel-envelope` | PLANNED | Wraps dispatched instructions with correspondent-channel correlation headers. |
| `@platform/payments/reconciliation` | PLANNED | Consumes `CutOffCycleClose` events for end-of-cycle breach detection. |
| `@platform/events/alert-dispatcher` | PLANNED | Delivers `CutOffWarning` alerts to Tomas in real time. |

Build-phase: calendar engine is a static-config module reading from `_sponsor-bank-operating-model.md`. Production: live timetable feed from correspondent API.

## 9. Quality controls

- **Daily schedule validation:** calendar engine asserts morning + afternoon cut-off times are loaded before the first instruction of the day is accepted.
- **Buffer floor:** processing buffer must be ≥ 20 minutes; if the correspondent's operating contract specifies less, Tomas escalates to Imani (legal & contracts engineer) + Devon (COO, governance) for renegotiation.
- **Breach-rate KRI:** cut-off breach rate > 0% in any calendar month is a Red KRI; reported to ALCO and BRC.
- **Calendar-update lag KRI:** NPSD calendar updates not reflected in the calendar engine within one business day are an operational-risk finding.

## 10. Evidence / audit trail

| Artefact | Event | Retention | Sensitivity |
|---|---|---|---|
| Daily NPS settlement schedule load | `CalendarLoaded { date, morningCutOff, afternoonCutOff, bufferMinutes }` | Indefinite (Principle 1) | Internal |
| Per-instruction cut-off check | `CutOffCheckPassed` or `CutOffDeferred` or `CutOffWarning` | Indefinite | Internal |
| End-of-cycle summary | `CutOffCycleClose` | Indefinite | Internal |
| Daily cut-off report | `DailyCutOffReport` | Indefinite | Internal |
| Breach escalation record | `OperationalLossEvent` (PROC-RISK-RCSA-01) | Per RCSA retention schedule | Internal |
| Calendar-update change record | `CalendarConfigUpdated` | Indefinite | Internal |

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-16 | Tomas (via Scrooge) | Initial population. Indirect-participant posture; internal cut-off discipline; two NPS settlement cycles; calendar engine as PLANNED capability. Cross-references PROC-OPS-PS-01 Step 6 and PROC-PAY-NM-01. |
| v0.2 | 2026-06-01 | Scrooge | Removed SAMOS branding throughout — bank is indirect NPS participant; 'SAMOS windows' → 'NPS settlement windows'; file renamed from samos-cut-off.md to correspondent-cut-off.md. |
