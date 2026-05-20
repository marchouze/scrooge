---
procedureId: PROC-RISK-BACKTEST-01
title: FRTB back-testing governance — daily HPL/RTPL exception count and zone management
author: Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-20
owner: Helena (Chief Risk Officer, governance) · Rohan (Market risk quantitative engineer, engineering)
status: POPULATED
policy-cited: market-risk-policy-v1
parent-policy: Policies/market-risk-policy-v1.md
citationOwner: Mira (Regulatory intelligence engineer, compliance)
version: v1 — 2026-05-20
last-updated: 2026-05-20
system-capability: "@platform/risk-engine/backtest (PLANNED)"
change-log:
  - v1 — 2026-05-20 — Rohan + Helena — Initial POPULATED procedure per `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20` (Market Risk Policy v1 §8.2; CEO authorisation 2026-05-20).
---

# Procedure — FRTB back-testing governance

**Procedure ID:** PROC-RISK-BACKTEST-01
**Owner:** Helena (Chief Risk Officer, governance) — governance · Rohan (Market risk quantitative engineer, engineering) — daily run
**Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) approves the back-testing framework; PA model-approval is the gating constraint for IMA desk back-testing relevance (per Market Risk Policy v1 §4.2).
**Cadence:** Daily (every business day) — HPL/RTPL/VaR computation and 250-day rolling exception count; weekly Helena review; monthly Market Risk Committee report.
**Version:** v1 — 2026-05-20
**Status:** POPULATED

---

## 1. Source policy

- `Policies/market-risk-policy-v1.md` — Market Risk Policy v1, §4.3 (Back-Testing), §1 (Critical-zone breach taxonomy), §4.2 (IMA Eligibility — back-testing as precondition), §6 (Market Risk Committee — zone transition reporting), §8.1 (Substrate dependencies — back-testing harness).

The obligation chain (Principle 2):

```
Regulation (BCBS FRTB Jan 2019, back-testing chapter; ORG-PR-58)
  → Policy (Market Risk Policy v1 §4.3)
    → PROC-RISK-BACKTEST-01 (this procedure)
      → @platform/risk-engine/backtest (PLANNED)
      → @platform/events/backtesting-outcome-recorded (PLANNED)
```

Back-testing is the FRTB-mandated diagnostic that compares the model-implied 1-day VaR against actual P&L outcomes; a high exception count (the model under-predicts losses) is the canonical signal of model failure, and the FRTB SA-fallback regime is automatic on Red-zone entry. This procedure governs the daily run, the zone classification, the escalation pathways, and the remediation timelines.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-58` | Back-testing of internal models per FRTB; 250-day rolling exception count; SA-fallback floor on Red-zone entry. |
| `ORG-PR-56` | IMA desk approval pre-conditions include back-testing performance — Green or Amber zone for the preceding 250 trading days; this procedure produces the demonstrating evidence. |
| BCBS FRTB (January 2019) — back-testing chapter (zone thresholds: 0–4 Green, 5–9 Amber with scaling add-on, 10+ Red — exact paragraphs and the scaling table `[citation: TBC — precise paragraph indices; Imani (Legal-as-code engineer, engineering) + external counsel ratify]`). | Daily comparison of actual 1-day loss vs 1-day 99% VaR from the model; HPL and RTPL series; zone-based capital add-on or SA fallback. |
| PA Directive D/2025 | FRTB implementation timeline; back-testing requirement from first IMA-approved desk forward `[citation: TBC]`. |
| PA notification obligation on Red-zone entry post-IMA approval | `[citation: TBC — confirmation pending Imani's regulatory-text walk; Market Risk Policy v1 §8.3 #5]` |

---

## 3. Purpose

For each desk in the IMA-candidate or IMA-approved population, run a daily back-test of the model-implied 1-day 99% VaR against the day's actual P&L outcomes, compute the 250-day rolling exception count, classify the desk into Green / Amber / Red zone per the BCBS FRTB thresholds, emit the canonical event, and trigger the policy-mandated escalation when the zone deteriorates. The procedure is the operational realisation of Market Risk Policy v1 §4.3.

Two P&L series are tested: **HPL** (Hypothetical P&L) — the P&L the position would have shown if the prior day's risk sensitivities had been applied to today's market move, holding the position constant; and **RTPL** (Risk-Theoretical P&L) — the P&L the IMA model implies given its risk factors. Back-testing exceptions are counted against HPL (the regulatory back-test) and against RTPL (an internal diagnostic) — divergence between the two streams is itself a PLA-test signal (see PROC-RISK-PLA-01).

Back-testing applies at the **desk level**, not the bank level. The Bank may have desks in different zones simultaneously; capital is reverted to SA only for the affected desk(s), not the whole trading book.

---

## 4. Trigger

- **Daily** (every business day at 18:00 SAST, after end-of-day P&L close): scheduled trigger. Runs after the FRTB SA capital computation (PROC-RISK-FRTB-SA-01) and after the end-of-day position freeze; consumes the day's HPL, RTPL, and the prior-day VaR estimate.
- **Re-run** on `MarketDataCorrected` or `TradeAmended` for a prior business day: the back-test for that day is re-computed; an amended `BacktestingOutcomeAmended` event supersedes the original; the rolling 250-day count is recomputed forward.
- **Pre-IMA submission** (ad-hoc, per Helena's instruction): the engine produces a back-testing pack covering the preceding 250 trading days for the candidate desk, signed off by Nadia (Independent-validation engineer, engineering), to evidence eligibility under `ORG-PR-56`.
- **PA request** (any time): an out-of-cycle back-testing pack for a specified desk and period.

---

## 5. Steps

Default actor is the back-testing engine agent (`@platform/risk-engine/backtest`) unless a step is explicitly marked as a human-approval step.

### 5.1 Inputs (Steps 1–3)

**Step 1 — HPL computation.**

For each desk, the engine retrieves the prior business day's positions and risk sensitivities (delta, vega, curvature per risk factor — same population as fed into PROC-RISK-FRTB-SA-01 Step 4). The engine applies the actual market move from prior-day close to today's close to those prior-day sensitivities, holding the position constant (no intraday trading is included in HPL — that is the definition of "hypothetical"). The output is `hpl_d` for each desk d.

**Step 2 — RTPL computation.**

For each desk, the engine consumes the IMA model's reported P&L for the day. The RTPL is the IMA model's risk-factor-based attribution: the model decomposes the day's P&L into contributions per risk factor in the IMA perimeter; the sum is RTPL. The RTPL therefore excludes contributions from risk factors *not* in the IMA model (those would land in NMRF / SES — see Market Risk Policy v1 §4.5). The output is `rtpl_d` for each desk.

**Step 3 — VaR retrieval (prior-day estimate).**

The engine retrieves the model's prior-day 1-day 99% VaR estimate for each desk — i.e. the VaR estimate computed at the close of business day d-1 that purported to bound today's losses with 99% confidence. The VaR estimate carries the `MarketRiskMeasureComputed` event reference (per PROC-RISK-MRM-01).

### 5.2 Exception detection (Steps 4–6)

**Step 4 — Exception flag.**

For each desk d, the engine flags an exception if `hpl_d < -var_99_1d(d-1)` — i.e. the day's hypothetical loss exceeded the prior day's 1-day 99% VaR estimate. The HPL-based exception is the regulatory back-test outcome.

The engine separately flags an RTPL exception if `rtpl_d < -var_99_1d(d-1)`. Divergence between HPL and RTPL exceptions is a model-completeness signal (the IMA model under-attributes the day's actual movement) and is fed to PROC-RISK-PLA-01 (PLA test) for the monthly assessment.

**Step 5 — 250-day rolling count update.**

The engine maintains a 250-trading-day rolling window per desk. On a new business day, the oldest day in the window drops off; today's exception flag (0 or 1) is added. The rolling count is `exceptionCount250d(d) = Σ exceptions over the 250-day window ending d`.

**Step 6 — Zone classification.**

Per BCBS FRTB `[citation: TBC]`:

- **Green:** `0 ≤ exceptionCount250d ≤ 4`. IMA capital applies without back-testing add-on.
- **Amber:** `5 ≤ exceptionCount250d ≤ 9`. IMA capital applies with a scaling multiplier add-on per the FRTB Amber-zone table `[citation: TBC]` (e.g. ×1.13 at 5 exceptions, ×1.17 at 6, ..., ×1.33 at 9 — the precise table is held in `Regulations/frtb-backtesting-zones.json` per Mira's regulatory intelligence pipeline).
- **Red:** `exceptionCount250d ≥ 10`. The desk reverts to SA capital per Market Risk Policy v1 §4.3 + FRTB SA-fallback rule; the SA-fallback floor is `max(1.5 × IMA ES, SA charge)` per FRTB `[citation: TBC]`. Red-zone entry is a Critical event under Market Risk Policy v1 §1.4.

A `zoneStateChanged` flag is set when today's zone differs from yesterday's; this drives the escalation steps.

### 5.3 Event emission (Step 7)

**Step 7 — Emit canonical events.**

The engine emits, per desk per day:

- `BacktestingOutcomeRecorded { deskId, date, hpl, rtpl, varEstimate, exceptionFlagHpl: boolean, exceptionFlagRtpl: boolean, exceptionCount250d, zone: green | amber | red, citations[] }` — the canonical daily back-test outcome.
- `BacktestingZoneEntered { deskId, date, fromZone, toZone, exceptionCount250d, citations[] }` — emitted only when `zoneStateChanged = true`. The event carries the prior zone, so the audit chain is intact.

Both events are tagged with the source-VaR `MarketRiskMeasureComputed` event reference and the source-HPL/RTPL P&L event reference.

### 5.4 Escalation (Steps 8–11)

**Step 8 — Green-zone steady state.**

If the zone remains Green and the exception count is stable (no new exceptions in the latest day), no manual action is required. The daily event is filed; Helena's daily report (per Market Risk Policy v1 §6.2) shows the zone status.

**Step 9 — Amber-zone entry or zone deterioration within Amber.**

On `BacktestingZoneEntered { toZone: amber }`, or on any new exception within the Amber zone:

1. Within 24 hours of event emission: Helena (Chief Risk Officer, governance) and Bea (Financial-reporting engineer, engineering — back-testing infrastructure peer to Rohan; consumes HPL feed) are notified by automated alert. Helena reviews; Rohan provides root-cause attribution (which risk factor drove the exception; was it a tail-fitting failure, a missing risk factor, a stale calibration, or a genuine large move beyond the 99th percentile).
2. Within 5 business days of zone entry (or zone deterioration to a higher Amber band): Rohan files a written attribution and remediation plan in the RMS document store; the plan is tabled at the next Market Risk Committee meeting (per Market Risk Policy v1 §6.1).
3. The Amber capital add-on per the FRTB scaling table is applied automatically by PROC-RISK-FRTB-SA-01 dual-run output (informational pre-IMA) or by the IMA capital computation (post-IMA approval). No manual intervention required for the capital application; manual intervention is in the remediation plan.
4. If the desk remains in Amber for two consecutive months, Helena tables a model-review motion at the BRC; Nadia (Independent-validation engineer, engineering) re-validates the IMA model (per PROC-RSK-MV-01).

**Step 10 — Red-zone entry (Critical event per Market Risk Policy v1 §1.4).**

On `BacktestingZoneEntered { toZone: red }`:

1. Within 24 hours: Helena, Camille (Chief Financial Officer, governance), and the CEO are notified by automated alert. The desk reverts to SA capital from the date of zone entry forward — automatic, no governance decision required (per FRTB rule).
2. PA notification: if the desk was IMA-approved (post-`ImaDeskApprovalGranted`), Owen (Company Secretary, governance) drafts a PA notification within 24 hours; Imani (Legal-as-code engineer, engineering) ratifies the legal obligation `[citation: TBC]`; Helena signs. The notification is sent within `[calibration: pending — typically 5 business days under FRTB / PA Directive D/2025; precise window TBC]`. If the desk was pre-IMA (not yet PA-approved), no PA notification is required; the back-testing failure becomes part of the IMA application pack at the next submission gate.
3. The Market Risk Committee convenes within 24 hours of Red-zone entry per the Critical-event branch of Market Risk Policy v1 §1.4. Helena chairs; Rohan presents root-cause attribution; Nadia re-validates. Outcome: a remediation plan and a target zone-recovery horizon, filed as `BacktestingRedRemediationPlanFiled { deskId, planSummary, targetRecoveryDate, citations[] }` event within 5 business days.
4. The desk remains on SA capital until the rolling 250-day window clears the Red-zone threshold (i.e. `exceptionCount250d ≤ 9` again) — at which point the desk transitions back to Amber; transition to Green requires further improvement to ≤ 4 exceptions over the rolling window.

**Step 11 — Zone improvement.**

On any `BacktestingZoneEntered` where `toZone` is more favourable than `fromZone` (Red→Amber, Amber→Green, Red→Green):

1. The capital basis re-evaluates per FRTB (Red→Amber: desk may resume IMA capital with the Amber-zone scaling add-on, subject to PA confirmation if PA was notified on the Red-zone entry; Amber→Green: scaling add-on falls away).
2. Helena reports the improvement at the next Market Risk Committee meeting; the remediation plan close-out is filed as `BacktestingRedRemediationPlanClosed { deskId, planEventId, recoveryDate, citations[] }`.

---

## 6. Outputs (events)

**Emitted by this procedure:**

- `BacktestingOutcomeRecorded { deskId, date, hpl, rtpl, varEstimate, exceptionFlagHpl, exceptionFlagRtpl, exceptionCount250d, zone, citations[] }` — daily, per desk.
- `BacktestingZoneEntered { deskId, date, fromZone, toZone, exceptionCount250d, citations[] }` — issued only on zone change.
- `BacktestingOutcomeAmended { deskId, date, originalEventId, amendedHpl, amendedRtpl, amendedExceptionCount250d, reason, citations[] }` — issued on re-run after `MarketDataCorrected` or `TradeAmended` for a prior business day.
- `BacktestingRedRemediationPlanFiled { deskId, planSummary, targetRecoveryDate, citations[] }` — filed within 5 business days of Red-zone entry.
- `BacktestingRedRemediationPlanClosed { deskId, planEventId, recoveryDate, citations[] }` — filed on zone improvement out of Red.

**Consumed by this procedure (read dependencies):**

- `MarketRiskMeasureComputed` (per PROC-RISK-MRM-01) — daily VaR estimate.
- `PnlDeskComputed` (per the GL / finance posting chain) — daily HPL and RTPL inputs.
- `ImaDeskApprovalGranted` / `ImaDeskApprovalRevoked` — whether the desk is in the IMA-approved or pre-IMA population (governs the PA-notification branch of Step 10).
- `MarketDataCorrected` / `TradeAmended` — re-run triggers.

---

## 7. Controls / approvers

| Control | Frequency | Owner |
|---|---|---|
| Daily completeness check: `BacktestingOutcomeRecorded` event present for every IMA-candidate / IMA-approved desk per business day | Daily | Rohan (first line); Vera (third line) via `recon:backtesting-daily-completeness` (PLANNED) |
| Exception attribution review (root cause: tail-fitting failure / missing risk factor / stale calibration / genuine large move) | On each exception | Rohan |
| 250-day rolling window correctness — no dropped days, no double-counts | Daily | Rohan; Vera quarterly via `recon:backtesting-window-integrity` (PLANNED) |
| Amber-zone remediation plan filed within 5 business days of zone entry | Per Amber entry | Helena (CRO) |
| Red-zone PA notification filed within `[calibration: pending]` business days for IMA-approved desks | Per Red entry on IMA-approved desk | Helena (CRO); Owen (Company Secretary, governance) drafts; Imani ratifies legal obligation |
| Independent validation of back-testing engine | Annual + ad-hoc on methodology change | Nadia (Independent-validation engineer, engineering) per PROC-RSK-MV-01 |
| Monthly Market Risk Committee zone review | Monthly | Helena (chair); Rohan (technical secretary) |
| Pre-IMA submission back-testing pack | Per IMA submission | Rohan compiles; Nadia signs off; Helena approves |

---

## 8. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| **No `BacktestingOutcomeRecorded` event by 09:00 next business day for any IMA-candidate / approved desk** | Rohan investigates immediately; Helena notified by 10:00; Vera opens incident if cause is process-level | 4h to first event; 24h to remediation |
| **Amber-zone entry (`BacktestingZoneEntered { toZone: amber }`)** | Helena notified within 24h; Rohan files attribution + remediation plan within 5bd; tabled at next MRC | 24h notification; 5bd plan |
| **Red-zone entry on pre-IMA desk** | Helena + Camille + CEO notified within 24h; desk continues on SA (no transition needed); root-cause and remediation per Step 10; no PA notification | 24h notification; 5bd plan |
| **Red-zone entry on IMA-approved desk (Critical event)** | Helena + Camille + CEO notified within 24h; desk reverts to SA from entry date (automatic); PA notification drafted by Owen within 24h, sent within `[calibration: pending]`bd; MRC convenes within 24h | 24h notification + MRC; 5bd plan |
| **Same desk Red→Red transition (no improvement after 250d)** | Helena escalates to BRC; possible withdrawal of the IMA model for re-engineering; Nadia re-validates | 5bd to BRC tabling |
| **Sustained Amber across two consecutive months** | Helena tables model-review motion at BRC; Nadia re-validates per PROC-RSK-MV-01 | Next BRC meeting |
| **`BacktestingOutcomeAmended` materially changes the zone for a prior day** | The amended event supersedes; if the amendment moves the desk into Red retroactively, the SA-fallback applies from the prior date forward (capital recomputation); Camille assesses BA-325 restatement | Same business day |

---

## 9. Substrate dependencies

| Capability | Status | Description |
|---|---|---|
| `@platform/risk-engine/backtest` | PLANNED | Back-testing engine: consumes HPL, RTPL, VaR; computes exception flag; maintains 250-day rolling window; classifies zone; emits events |
| `@platform/risk-engine/var` | PLANNED | 1-day 99% VaR engine — prior-day estimate consumed by back-testing |
| `@platform/risk-engine/pnl-attribution` | PLANNED | RTPL computation: IMA model risk-factor attribution of daily P&L |
| `@platform/risk-engine/hpl-engine` | PLANNED | HPL computation: apply today's market move to prior-day sensitivities holding position constant |
| `@platform/events/backtesting` | PLANNED | Typed event schema: `BacktestingOutcomeRecorded`, `BacktestingZoneEntered`, `BacktestingOutcomeAmended`, `BacktestingRedRemediationPlanFiled`, `BacktestingRedRemediationPlanClosed` |
| `@platform/recon/backtesting-completeness` | PLANNED | Daily completeness recon; 250-day window integrity check |
| `@platform/notifications/alert` | PLANNED | Helena / Camille / CEO automated alerts on Amber and Red zone entries |
| `@platform/pa-submission/red-zone-notification` | PLANNED | PA notification packaging for Red-zone IMA-approved desk events |

---

## 10. Citations

- **Policy:** `Policies/market-risk-policy-v1.md` §4.3 (Back-Testing), §1.4 (Critical-zone breach), §4.2 (IMA Eligibility), §6.1 (Market Risk Committee), §6.2 (Reporting), §8.1 (Substrate dependencies).
- **Regulation:** `ORG-PR-58`, `ORG-PR-56`; BCBS *Minimum capital requirements for market risk* (January 2019) — back-testing chapter `[citation: TBC]`; PA D/2025 `[citation: TBC]`.
- **Related procedures:** `PROC-RISK-FRTB-SA-01` (`frtb-sa-capital-computation.md`) — SA capital applies on Red-zone entry; `PROC-RISK-PLA-01` (`pla-test-governance.md`) — RTPL divergence is a PLA test signal; `PROC-RISK-MRM-01` (`market-risk-monitoring.md`) — VaR estimate consumer; `PROC-RSK-MV-01` (`model-validation.md`) — Nadia's annual + ad-hoc validation; `PROC-FIN-BA-01` (`ba-return-generation.md`) — capital basis for BA-325 / BA-326 reflects the zone.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1 | 2026-05-20 | Rohan (Market risk quantitative engineer, engineering) + Helena (Chief Risk Officer, governance) — via Scrooge dispatch `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20` | Initial POPULATED procedure. Authors the daily back-testing governance per Market Risk Policy v1 §4.3 and §8.2. Eleven sections per agent-spec template. Specifies HPL/RTPL/VaR comparison; 250-day rolling exception count; Green (0–4) / Amber (5–9, scaling add-on) / Red (≥10, SA-fallback) zones; Amber 24h notification + 5bd remediation; Red 24h notification + MRC convene + PA notification (IMA-approved desks only) + 5bd remediation; zone-improvement reversion. Identity discipline per CLAUDE.md. Citation gaps `[citation: TBC]` per Principle 2. Calibration parameters (PA notification window) marked `[calibration: pending]` per the brief's no-invented-numerics rule. |
