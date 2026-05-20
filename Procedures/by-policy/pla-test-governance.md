---
procedureId: PROC-RISK-PLA-01
title: FRTB Profit & Loss Attribution (PLA) test governance — monthly Spearman correlation and variance ratio
author: Rohan (Market risk quantitative engineer, engineering)
date: 2026-05-20
owner: Helena (Chief Risk Officer, governance) · Rohan (Market risk quantitative engineer, engineering)
status: POPULATED
policy-cited: market-risk-policy-v1
parent-policy: Policies/market-risk-policy-v1.md
citationOwner: Mira (Regulatory intelligence engineer, compliance)
version: v1 — 2026-05-20
last-updated: 2026-05-20
system-capability: "@platform/risk-engine/pla-test (PLANNED)"
change-log:
  - v1 — 2026-05-20 — Rohan + Helena — Initial POPULATED procedure per `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20` (Market Risk Policy v1 §8.2; CEO authorisation 2026-05-20).
---

# Procedure — FRTB PLA test governance

**Procedure ID:** PROC-RISK-PLA-01
**Owner:** Helena (Chief Risk Officer, governance) — governance · Rohan (Market risk quantitative engineer, engineering) — monthly run
**Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) approves the PLA framework election; PA approval governs the IMA desk election for which the PLA test is a precondition (per Market Risk Policy v1 §4.2).
**Cadence:** Monthly (first business day of each calendar month) — per IMA-candidate or IMA-approved desk, the Spearman correlation and variance ratio of RTPL vs HPL over the preceding 12-month window. Quarterly Market Risk Committee review.
**Version:** v1 — 2026-05-20
**Status:** POPULATED

---

## 1. Source policy

- `Policies/market-risk-policy-v1.md` — Market Risk Policy v1, §4.4 (PLA Test), §4.2 (IMA Eligibility and Desk Approval — PLA as precondition), §6.1 (Market Risk Committee — monthly PLA results), §8.1 (Substrate dependencies — PLA test infrastructure).

The obligation chain (Principle 2):

```
Regulation (BCBS FRTB Jan 2019, PLA chapter; ORG-PR-57)
  → Policy (Market Risk Policy v1 §4.4)
    → PROC-RISK-PLA-01 (this procedure)
      → @platform/risk-engine/pla-test (PLANNED)
      → @platform/events/pla-test-result-recorded (PLANNED)
```

The Profit & Loss Attribution test is the FRTB-mandated diagnostic that asks: does the IMA model adequately capture the drivers of the desk's actual P&L? A model that under-captures risk factors will produce an RTPL series (the IMA model's risk-factor decomposition of P&L) that diverges materially from the HPL series (full-revaluation hypothetical P&L). The PLA test quantifies that divergence via two statistics computed over a rolling 12-month window: the Spearman rank correlation of (RTPL, HPL), and the variance ratio var(RTPL − HPL) / var(HPL). Failure of either statistic reverts the desk to SA capital for that risk class.

The PLA test is a **per-risk-class, per-desk** test. A desk may pass PLA for some risk classes and fail for others; SA-fallback applies only to the failing risk class on that desk — the rest of the desk's IMA application persists. The risk class taxonomy is identical to PROC-RISK-FRTB-SA-01 Step 3.

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-57` | PLA test for IMA desk approval and ongoing eligibility — per BCBS FRTB. |
| `ORG-PR-56` | IMA desk approval pre-conditions include PLA test pass for the preceding period — this procedure produces the demonstrating evidence. |
| BCBS FRTB (January 2019) — PLA chapter (Spearman correlation pass ≥ 0.80, variance ratio pass ≤ 0.20; Amber zone correlation 0.70–0.80 and/or variance ratio 0.20–0.30; Fail correlation < 0.70 or variance ratio > 0.30 — exact paragraphs and thresholds `[citation: TBC — precise paragraph indices; Imani (Legal-as-code engineer, engineering) + external counsel ratify]`). | Test definition; thresholds; per-risk-class application; consequence of fail (SA-fallback for the failing risk class). |
| PA Directive D/2025 | FRTB implementation timeline; PLA test required for IMA from PA approval forward `[citation: TBC]`. |
| PA notification obligation on PLA fail post-IMA approval | `[citation: TBC — confirmation pending; Market Risk Policy v1 §4.4 references consecutive quarterly PLA failure may require PA notification]` |

---

## 3. Purpose

For each IMA-candidate or IMA-approved desk, and for each risk class on that desk, compute the monthly PLA test statistics — Spearman correlation and variance ratio of the daily (RTPL, HPL) series over the preceding 12 months — classify each (desk, risk class) into Green / Amber / Red, emit the canonical event, and trigger the policy-mandated escalation when an Amber / Red result arises. The procedure is the operational realisation of Market Risk Policy v1 §4.4.

The PLA test complements back-testing (PROC-RISK-BACKTEST-01): back-testing detects model failure as exception counts (the model under-predicts losses); PLA detects model incompleteness as RTPL/HPL divergence (the model misses material risk factors, even if it does not under-predict aggregate VaR). A desk may pass back-testing and fail PLA — i.e. the model gets the aggregate distribution roughly right but for the wrong reasons. Both tests are required for IMA continuation.

---

## 4. Trigger

- **Monthly** (first business day of each calendar month, at 08:00 SAST): scheduled trigger. The engine computes the PLA test statistics over the trailing 12-month window for each (desk, risk class) in the IMA-candidate or IMA-approved population.
- **Pre-IMA submission** (ad-hoc, per Helena's instruction): the engine produces a PLA pack covering the trailing 12 months for the candidate desk and risk class, signed off by Nadia (Independent-validation engineer, engineering).
- **Re-run** on `MarketDataCorrected` or `TradeAmended` affecting a prior business day within the 12-month window: the PLA test re-runs; an amended `PlaTestResultAmended` event supersedes the original.
- **PA request** (any time): an out-of-cycle PLA pack for a specified desk and risk class.

---

## 5. Steps

Default actor is the PLA test engine agent (`@platform/risk-engine/pla-test`) unless a step is explicitly marked as a human-approval step.

### 5.1 Inputs (Steps 1–2)

**Step 1 — RTPL and HPL series retrieval.**

For each (desk, risk class) in the IMA-candidate or IMA-approved population, the engine retrieves the daily HPL and RTPL series for the trailing 250 trading days (~12 months) — sourced from PROC-RISK-BACKTEST-01 Steps 1–2 (back-testing also computes HPL and RTPL). The RTPL is decomposed by risk class — the IMA model's risk-factor attribution per day, grouped by risk class — so a per-risk-class PLA can be computed.

Days for which HPL or RTPL is missing (e.g. due to a data outage that was subsequently corrected) are excluded from the test; the engine reports the number of usable observations alongside the test result. Fewer than 200 usable observations in the 250-day window invalidates the month's test (per BCBS FRTB minimum observation count `[citation: TBC]`); the engine emits a `PlaTestResultRecorded { status: invalid, reason: insufficient_observations }` and the desk's PLA status defaults to its prior month's outcome until the observation deficit clears.

**Step 2 — Risk-class scope.**

For each desk, the engine identifies the active risk classes — only risk classes with non-zero sensitivity exposure in the trailing 12 months are tested. A desk with no FX positions does not produce an FX-class PLA result. The active risk class population per desk is derived from PROC-RISK-FRTB-SA-01 Step 3 mapping.

### 5.2 Test statistic computation (Steps 3–5)

**Step 3 — Spearman correlation.**

For each (desk, risk class), the engine computes the Spearman rank correlation `ρ_s(RTPL_class, HPL_class)` over the 12-month window. Spearman is a rank-based correlation — it measures monotonic relationship and is robust to outliers. The FRTB choice of Spearman over Pearson is deliberate: P&L distributions have fat tails, and Pearson is sensitive to a small number of large observations that may dominate the metric.

**Step 4 — Variance ratio.**

For each (desk, risk class), the engine computes the variance ratio `V_r = var(RTPL_class − HPL_class) / var(HPL_class)`. The interpretation: if the IMA model perfectly captures the risk-class drivers, `RTPL_class ≈ HPL_class` for the risk class, so `var(RTPL − HPL) ≈ 0` and `V_r ≈ 0`. As the model omits risk factors, the residual `(RTPL − HPL)` widens; the ratio grows.

**Step 5 — Zone classification.**

Per BCBS FRTB `[citation: TBC]`:

- **Green:** `ρ_s ≥ 0.80` AND `V_r ≤ 0.20`. The desk-risk-class passes; IMA capital applies without PLA add-on.
- **Amber:** `0.70 ≤ ρ_s < 0.80` OR `0.20 < V_r ≤ 0.30` (and not in Red). IMA continues with a PLA surcharge per Market Risk Policy v1 §4.4 `[citation: TBC — Amber surcharge formula]`. The surcharge is held in `Regulations/frtb-pla-surcharge.json` per Mira's regulatory intelligence pipeline.
- **Red (Fail):** `ρ_s < 0.70` OR `V_r > 0.30`. The desk-risk-class reverts to SA capital for that risk class from the next business day forward; the rest of the desk's IMA application persists for non-failing risk classes.

A `zoneStateChanged` flag is set when this month's zone differs from the prior month's; this drives the escalation steps.

### 5.3 Event emission (Step 6)

**Step 6 — Emit canonical events.**

The engine emits, per (desk, risk class) per month:

- `PlaTestResultRecorded { deskId, riskClass, month, observationCount, spearmanCorrelation, varianceRatio, passFail: pass | amber | fail | invalid, zone: green | amber | red | invalid, reason?, citations[] }` — the canonical monthly PLA outcome.
- `PlaZoneTransition { deskId, riskClass, month, fromZone, toZone, citations[] }` — emitted only when `zoneStateChanged = true`.
- `PlaTestResultAmended { deskId, riskClass, month, originalEventId, amendedSpearmanCorrelation, amendedVarianceRatio, amendedZone, reason, citations[] }` — issued on re-run after a prior-month data correction.

---

## 6. Outputs (events)

**Emitted by this procedure:**

- `PlaTestResultRecorded { deskId, riskClass, month, observationCount, spearmanCorrelation, varianceRatio, passFail, zone, reason?, citations[] }` — monthly, per (desk, risk class).
- `PlaZoneTransition { deskId, riskClass, month, fromZone, toZone, citations[] }` — on zone change.
- `PlaTestResultAmended { ... }` — on re-run after correction.
- `PlaRemediationPlanFiled { deskId, riskClass, planSummary, targetRecoveryDate, citations[] }` — filed within 10 business days of Amber or Red zone entry.
- `PlaRemediationPlanClosed { deskId, riskClass, planEventId, recoveryMonth, citations[] }` — filed on zone improvement out of Amber / Red.

**Consumed by this procedure (read dependencies):**

- HPL series — from PROC-RISK-BACKTEST-01 Step 1 (or from `@platform/risk-engine/hpl-engine` directly).
- RTPL series (risk-class-decomposed) — from `@platform/risk-engine/pnl-attribution`.
- `ImaDeskApprovalGranted` / `ImaDeskApprovalRevoked` — population scope.
- `MarketDataCorrected` / `TradeAmended` for prior 12-month days — re-run triggers.

### 5.4 Escalation (Steps 7–9)

**Step 7 — Green-zone steady state.**

If all (desk, risk class) pairs are in Green for the month, no manual action is required. The monthly event population is filed; Helena's monthly Market Risk Committee report shows the green status per Market Risk Policy v1 §6.1 standing agenda item 3.

**Step 8 — Amber-zone entry.**

On `PlaZoneTransition { toZone: amber }` for any (desk, risk class):

1. Within 5 business days of the event: Rohan files a written attribution and remediation plan in the RMS document store; the plan identifies which risk factor(s) the model is missing or mis-attributing, and proposes a model extension or recalibration. A `PlaRemediationPlanFiled` event is emitted.
2. The Amber surcharge per `[citation: TBC]` is applied automatically to that (desk, risk class) from the next business day forward; no manual intervention required for the capital application.
3. The remediation plan is tabled at the next Market Risk Committee meeting; Helena confirms the targetRecoveryDate.
4. If the (desk, risk class) remains in Amber for **two consecutive months**, Helena tables a model-review motion at the BRC; Nadia (Independent-validation engineer, engineering) re-validates per PROC-RSK-MV-01.

**Step 9 — Red-zone entry (Fail).**

On `PlaZoneTransition { toZone: red }` for any (desk, risk class):

1. Within 24 hours: Helena (Chief Risk Officer, governance), Camille (Chief Financial Officer, governance), and the CEO are notified by automated alert. The (desk, risk class) reverts to SA capital from the next business day forward — automatic, no governance decision required (per FRTB rule).
2. PA notification: if the desk-risk-class was IMA-approved, Owen (Company Secretary, governance) drafts a PA notification within `[calibration: pending — typically tied to Red-zone-equivalent obligation; precise PA-notification trigger for PLA fail TBC per Market Risk Policy v1 §4.4]`; Imani (Legal-as-code engineer, engineering) ratifies the legal obligation `[citation: TBC]`; Helena signs. **Note:** Market Risk Policy v1 §4.4 specifies that *consecutive quarterly* PLA failure triggers a model review by Nadia and *may* require PA notification — Imani's ratification confirms whether the notification trigger is consecutive-quarterly or single-month for the IMA-approved population.
3. The Market Risk Committee reviews the failure at the next scheduled meeting (or convenes ad-hoc within 10 business days, at Helena's discretion); Helena chairs; Rohan presents root-cause attribution; Nadia re-validates.
4. The (desk, risk class) remains on SA capital until the monthly PLA test moves it back to Amber or Green; transition into Green requires sustained Green-zone passing for a period to be defined in the remediation plan.

### 5.5 Consecutive failure (Step 10)

**Step 10 — Consecutive quarterly failure.**

If the same (desk, risk class) is in Red zone for two consecutive quarterly cycles (i.e. months M, M+3 both show Red), Market Risk Policy v1 §4.4 mandates a model review by Nadia and, if applicable, a PA notification per Imani's ratification. The model review outcome is one of: (i) recalibration that brings the model back to Green/Amber within a defined horizon; (ii) model retirement — the (desk, risk class) becomes a permanent SA-capital position; (iii) restriction of the IMA scope to exclude the failing risk class on that desk, formalised as an `ImaDeskScopeRestricted { deskId, restrictedRiskClass, effectiveDate, citations[] }` event.

---

## 7. Controls / approvers

| Control | Frequency | Owner |
|---|---|---|
| Monthly completeness check: `PlaTestResultRecorded` event for every (IMA-candidate / approved desk, active risk class) in the population | Monthly | Rohan (first line); Vera (third line) via `recon:pla-monthly-completeness` (PLANNED) |
| Observation count ≥ 200 over the 12-month window | Monthly | Rohan |
| Amber-zone remediation plan filed within 10 business days of zone entry | Per Amber entry | Helena (CRO) |
| Red-zone (Fail) PA notification per Imani's ratification | Per Red entry on IMA-approved population | Helena (CRO); Owen drafts; Imani ratifies legal obligation |
| Consecutive-quarterly-failure model review | Per consecutive fail | Nadia (Independent-validation engineer, engineering) per PROC-RSK-MV-01 |
| Monthly Market Risk Committee PLA review | Monthly | Helena (chair); Rohan (technical secretary) |
| Pre-IMA submission PLA pack | Per IMA submission | Rohan compiles; Nadia signs off; Helena approves |

---

## 8. Escalation

| Condition | Action | Timeframe |
|---|---|---|
| **No `PlaTestResultRecorded` event by 5 business days into the month for any (IMA-candidate / approved desk, active risk class)** | Rohan investigates; Helena notified; Vera opens incident if cause is process-level | 5bd to first event; 10bd to remediation |
| **Insufficient observations (< 200 days in window)** | `PlaTestResultRecorded { status: invalid }`; desk-risk-class defaults to prior month's zone; root-cause investigation by Rohan; remediation in next month | Next monthly cycle |
| **Amber-zone entry on pre-IMA (desk, risk class)** | Rohan files remediation plan within 10bd; tabled at next MRC; Amber surcharge does not apply (no IMA capital) — Amber here is a development signal | 10bd plan |
| **Amber-zone entry on IMA-approved (desk, risk class)** | Same as pre-IMA + Amber surcharge applies to capital from next business day | 10bd plan |
| **Red-zone (Fail) on pre-IMA (desk, risk class)** | Rohan files remediation; tabled at next MRC; no PA notification; failure becomes part of IMA application pack at next submission | 10bd plan |
| **Red-zone (Fail) on IMA-approved (desk, risk class) — Critical event per Market Risk Policy v1 §4.4** | Helena + Camille + CEO notified within 24h; (desk, risk class) reverts to SA from next business day; PA notification per Imani's ratification; MRC reviews within 10bd | 24h notification; 10bd MRC; PA per Imani |
| **Consecutive quarterly failure (same (desk, risk class) Red in two consecutive quarters)** | Nadia re-validates model; outcome is recalibration / retirement / scope restriction; PA notification per Imani | 30bd from second Red |
| **`PlaTestResultAmended` materially changes the zone for a prior month** | The amended event supersedes; if amendment moves (desk, risk class) into Red retroactively, SA-fallback applies from the next business day after amendment (capital recomputation forward, not retroactive) | Same business day of amendment |

---

## 9. Substrate dependencies

| Capability | Status | Description |
|---|---|---|
| `@platform/risk-engine/pla-test` | PLANNED | PLA test engine: computes Spearman correlation and variance ratio over 12-month window per (desk, risk class); classifies zone; emits events |
| `@platform/risk-engine/pnl-attribution` | PLANNED | RTPL computation with risk-class decomposition — required for per-risk-class PLA |
| `@platform/risk-engine/hpl-engine` | PLANNED | HPL computation (shared with PROC-RISK-BACKTEST-01) |
| `@platform/events/pla-test` | PLANNED | Typed event schema: `PlaTestResultRecorded`, `PlaZoneTransition`, `PlaTestResultAmended`, `PlaRemediationPlanFiled`, `PlaRemediationPlanClosed`, `ImaDeskScopeRestricted` |
| `@platform/recon/pla-completeness` | PLANNED | Monthly completeness recon |
| `@platform/notifications/alert` | PLANNED | Helena / Camille / CEO alerts on Amber and Red zone entries |
| `@platform/pa-submission/pla-fail-notification` | PLANNED | PA notification packaging for Red-zone IMA-approved (desk, risk class) events |

---

## 10. Citations

- **Policy:** `Policies/market-risk-policy-v1.md` §4.4 (PLA Test), §4.2 (IMA Eligibility and Desk Approval), §6.1 (Market Risk Committee — monthly PLA results), §6.2 (Reporting), §8.1 (Substrate dependencies — PLA test infrastructure).
- **Regulation:** `ORG-PR-57`, `ORG-PR-56`; BCBS *Minimum capital requirements for market risk* (January 2019) — PLA chapter `[citation: TBC]`; PA D/2025 `[citation: TBC]`.
- **Related procedures:** `PROC-RISK-FRTB-SA-01` (`frtb-sa-capital-computation.md`) — SA capital applies for any (desk, risk class) failing PLA; `PROC-RISK-BACKTEST-01` (`backtesting-governance.md`) — back-testing detects model failure via exception count; PLA detects model incompleteness via RTPL/HPL divergence — both required for IMA; `PROC-RISK-MRM-01` (`market-risk-monitoring.md`) — VaR and ES feed; `PROC-RSK-MV-01` (`model-validation.md`) — Nadia's annual + consecutive-failure validation; `PROC-FIN-BA-01` (`ba-return-generation.md`) — capital basis for BA-325 / BA-326 reflects PLA outcome per risk class.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1 | 2026-05-20 | Rohan (Market risk quantitative engineer, engineering) + Helena (Chief Risk Officer, governance) — via Scrooge dispatch `brief:rohan:draft-four-market-risk-procedures-policy-v1-8-2:2026-05-20` | Initial POPULATED procedure. Authors the monthly PLA test governance per Market Risk Policy v1 §4.4 and §8.2. Eleven sections per agent-spec template. Specifies Spearman correlation and variance ratio statistics over 12-month rolling window per (desk, risk class); Green (ρ_s ≥ 0.80 AND V_r ≤ 0.20) / Amber (0.70 ≤ ρ_s < 0.80 OR 0.20 < V_r ≤ 0.30) / Red (ρ_s < 0.70 OR V_r > 0.30); SA-fallback per risk class on Red entry; 10bd remediation plan; consecutive-quarterly-failure model review by Nadia per Market Risk Policy v1 §4.4. Identity discipline per CLAUDE.md. Citation gaps `[citation: TBC]` per Principle 2. Calibration parameters (Amber surcharge, PA notification trigger) marked `[citation: TBC]` per the brief's no-invented-numerics rule. |
