---
status: POPULATED
---
# Procedure — Market risk monitoring

**Procedure ID:** PROC-RISK-MRM-01
**Owner:** Helena (Chief Risk Officer, governance) · Rohan (Market risk quantitative engineer, engineering)
**Approval:** BRC
**Cadence:** Daily (limit monitoring); real-time (breach alert); monthly (MRC report)
**Version:** v0.1 — 2026-05-13
**Status:** POPULATED

## 1. Source policy

`Policies/market-risk-policy-v1.md` — Market Risk Policy (primary).
Trading Mandate (B5 — RAS refinement; CEO-approved in-force).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-19` | Measure trading-book market risk per FRTB; hold capital under SA or IMA as applicable. |
| `ORG-PR-20` | No proprietary risk-taking outside warehoused franchise hedge positions; daily attestation required. |
| `ORG-PR-33` | Implement FRTB + revised CVA framework per PA timeline (1 July 2025). |
| `ORG-PR-56` | IMA trading-desk approval by PA; ongoing model performance monitoring (back-testing + PLA). |

## 3. Purpose

Ensure that the bank's trading-book market risk exposures are measured daily, compared against Board Risk Committee (BRC)-approved limits, and that breaches are detected, frozen, escalated, and remediated in a controlled and documented manner. Provide the BRC and Market Risk Committee with timely, event-sourced metrics that satisfy FRTB Pillar 1 capital requirements and PA supervisory reporting obligations.

## 4. Trigger

- **Daily** (T+0, after market close): automated scheduling at end-of-day triggers the full risk calculation cycle.
- **Real-time** (intraday, on `TradeBooked` or `PositionUpdated`): delta-VaR update to detect potential limit approaches before market close.
- **Monthly** (first business day): Market Risk Committee report generation.
- **Annual**: PLA test cycle for all IMA-approved desks.
- **Ad-hoc**: re-run triggered by PA request, model change, or data-quality incident.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | At market close, extract end-of-day positions, market data (rates, curves, spreads, FX, equity prices) and trade economics | `system` | `@platform/market-data/eod-snapshot` (`PLANNED`) | Snapshot timestamped; version hash stored for recon. |
| 2 | Compute VaR (99%, 1-day, historical simulation, trailing 250 trading days) by desk and portfolio | `system` | `@platform/risk-engine/var` (`PLANNED`) | FRTB IMA basis for approved desks; SA basis for all desks as fallback. |
| 3 | Compute Expected Shortfall (97.5%, 10-day, FRTB SA) by risk class: general interest rate, equity, FX, credit spread, commodity | `system` | `@platform/risk-engine/expected-shortfall` (`PLANNED`) | ES is the primary Pillar 1 capital metric under FRTB SA. |
| 4 | Compute sensitivity-based measures: delta, vega, curvature per FRTB SA methodology | `system` | `@platform/risk-engine/sensitivities` (`PLANNED`) | Used for SA capital bucket aggregation. |
| 5 | Compute CVA sensitivity measures for OTC derivative book | `system` | `@platform/risk-engine/cva-sensitivities` (`PLANNED`) | Revised CVA per ORG-PR-33 (FRTB-CVA SA or BA-CVA). |
| 6 | Compare all computed metrics against RAS limits MR-1 through MR-5; classify each as green / amber / red | `system` | `@platform/risk-engine/limit-comparator` (`PLANNED`) | Amber = metric within 90–100% of limit; red = metric > limit. |
| 7 | Green zone: all metrics within limits → emit `MarketRiskMetricsCalculated { status: within_limits }` | `system` | `@platform/event-store` ✓ | Report surfaced in weekly MRC dashboard; no escalation required. |
| 8 | Amber zone: metric within 90% of limit → emit `MarketRiskLimitWarning`; notify desk head and CRO | `system` + `Rohan` | `@platform/event-store` ✓ + `@platform/notifications/alert` (`PLANNED`) | Desk head must provide management action plan within 2 business days. |
| 9 | Red zone / breach: metric exceeds limit → emit `MarketRiskLimitBreached`; apply automatic position freeze (block new risk-increasing trades); escalate to CRO within 15 minutes | `system` | `@platform/risk-engine/position-freeze` (`PLANNED`) + `@platform/event-store` ✓ | Position freeze is enforced at the order-management layer; exemptions require signed CRO event. |
| 10 | CRO escalation: Helena reviews breach, assesses cause, initiates remediation plan | `Helena` | `@platform/risk-engine/breach-management` (`PLANNED`) | BRC notification within 24 hours of breach; remediation plan within 48 hours. |
| 11 | No-prop-trading daily attestation: verify all positions have qualifying client-facilitation or hedge origin | `system` | `@platform/risk-engine/trade-origin-check` (`PLANNED`) | Any position without a qualifying trade origin flagged as potential prop violation → immediate CRO review (ORG-PR-20). |
| 12 | Prop trading violation detected: emit `PropTradingViolationFlagged`; CRO reviews within 1 hour; position unwound or reclassified | `Helena` | `@platform/event-store` ✓ | Unresolved violations escalate to BRC same day. |
| 13 | Back-testing (FRTB IMA desks): daily comparison of 1-day VaR vs. actual P&L; record exception if actual loss exceeds VaR | `system` | `@platform/risk-engine/backtest` (`PLANNED`) | Trailing 250-day exception count: green (0–4), amber (5–9), red (≥10). |
| 14 | Back-testing red zone (≥10 exceptions): emit `BackTestingExceptionRecorded { zone: red }`; notify PA; assess IMA withdrawal | `Helena` + `Rohan` | `@platform/event-store` ✓ | PA notification required under ORG-PR-56; IMA withdrawal reverts desk to SA capital treatment. |
| 15 | PLA test (monthly for IMA desks): compute Spearman correlation and variance ratio between risk-theoretical P&L and hypothetical P&L per desk | `system` | `@platform/risk-engine/pla-test` (`PLANNED`) | Desks failing PLA test revert to SA capital treatment; emit `PLATestResultRecorded { outcome: fail | pass }`. |
| 16 | Aggregate metrics, exceptions, and test results into monthly MRC report; Helena signs off | `system` + `Helena` | `@platform/reporting/mrc-report` (`PLANNED`) | Report filed as document event in RMS; distributed to BRC and MRC. |

## 6. Reconciliation

- **Events produced:**
  - `MarketRiskMetricsCalculated { calculation_date, desk_id, var_99_1d, es_975_10d, sensitivity_measures, status: within_limits | warning | breach }` — per daily calculation cycle.
  - `MarketRiskLimitWarning { metric, value, limit, pct_utilised, desk_id }` — amber-zone trigger.
  - `MarketRiskLimitBreached { metric, value, limit, desk_id, position_freeze: true }` — red-zone trigger; position freeze recorded.
  - `BackTestingExceptionRecorded { date, desk_id, var, actual_pnl, trailing_exception_count, zone }` — per back-testing run where actual loss exceeds VaR.
  - `PLATestResultRecorded { month, desk_id, spearman_corr, variance_ratio, outcome }` — monthly per IMA desk.
  - `PropTradingViolationFlagged { position_id, trade_origin, flagged_by: system | Helena, resolution }` — per violation detected.
- **Invariants:**
  - Every `TradeBooked` on an IMA desk must be followed by a `MarketRiskMetricsCalculated` event on the same business day.
  - No `MarketRiskLimitBreached` event may be followed by a `TradeBooked` on the same desk with `risk_direction: increasing` until a `BreachRemediated` event is emitted.
  - Every month, each IMA desk must produce exactly one `PLATestResultRecorded` event.
- **Failure mode:** Risk engine unavailable at market close → no `MarketRiskMetricsCalculated` event is produced → BRC incident opened automatically; all desks treated as if in amber zone until metrics are available.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `MarketRiskMetricsCalculated` events | Event log | 7 years (Banks Act / PA inspection) | High |
| `MarketRiskLimitBreached` events + position-freeze records | Event log | Permanent (regulatory) | Critical |
| Back-testing exception log (trailing 250-day window) | Event log projection | 3 years (FRTB IMA requirement) | High |
| PLA test workpapers | Event log + document store | 3 years | High |
| Monthly MRC report | RMS Document register | 7 years | Restricted |
| Market data snapshots (P&L attribution) | `@platform/market-data/eod-snapshot` | 5 years | High |
| Prop-trading attestation records | Event log | 7 years | High |

## 8. Manual steps

- **Step 10** — CRO breach review and remediation-plan authoring: Helena's professional judgement determines root cause and appropriate remediation. The platform records the output as a signed event; it does not substitute for the judgement.
- **Step 12** — Prop-trading violation review: Helena determines whether the flagged position represents a true prop violation or a misclassified hedge. Outcome recorded as a typed resolution event.
- **Step 14** — IMA withdrawal assessment: Helena and Rohan jointly determine whether the back-testing red zone is attributable to model failure or market stress; PA notification is triggered by the system but the narrative is authored by Helena.
- **Step 16** — Monthly MRC report sign-off: Helena signs off the report; the sign-off is a typed approval event.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Risk engine calculation failure at market close | Missing `MarketRiskMetricsCalculated` event for any desk after cut-off | Rohan + Atlas immediately; BRC incident opened; desks in amber until resolved |
| Market data feed latency or corruption | Hash mismatch on EOD snapshot; P&L attribution inconsistency | Rohan + data-provider SLA escalation; calculation held until data validated |
| Position freeze not enforced after breach | Vera recon: `TradeBooked` on frozen desk after `MarketRiskLimitBreached` | Helena + Saskia immediately; potential regulatory incident |
| Back-testing red zone (≥10 exceptions) | `BackTestingExceptionRecorded { zone: red }` | Helena + PA notification under ORG-PR-56; IMA withdrawal assessment within 5 business days |
| PLA test failure (desk reverts to SA) | `PLATestResultRecorded { outcome: fail }` | Rohan roots cause; Helena informs BRC; SA capital charge applied from next reporting date |
| Prop-trading violation unresolved > 1 hour | `PropTradingViolationFlagged` with no `PropTradingViolationResolved` within SLA | Helena → BRC same day; potential PA notification |
| Amber warning unresolved > 2 business days | `MarketRiskLimitWarning` with no management-action event | Helena escalates to BRC; desk head formally required to present remediation |

## 10. Related procedures

- `stress-test-cycle.md` — market risk stress inputs feed the integrated stress test.
- `model-validation.md` — VaR and ES models are subject to independent model-risk validation; IMA approval requires passing model validation gate.
- `capital-ratio-monitoring.md` — FRTB capital outputs feed CET1 calculation.
- `ecl-stage-projection-refresh.md` — credit spread risk inputs cross-reference ECL staging.
- `new-product-due-diligence.md` — new products must demonstrate that risk-engine coverage exists before launch.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Helena + Rohan (via Scrooge dispatch) | Initial populated stub. FRTB SA + IMA; back-testing; PLA; prop-trading check; breach escalation. |
| v0.2 | 2026-05-15 | Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering) | Promoted to POPULATED — all 12 sections verified complete. |

## 12. Audit / assurance

- **Vera daily recon:** checks that every trading desk has produced a `MarketRiskMetricsCalculated` event for the prior business day; any missing event is surfaced as a Vera finding to Helena and Rohan by 09:00 SAST.
- **Vera breach-closure recon:** confirms that every `MarketRiskLimitBreached` event has a downstream `BreachRemediated` event within the SLA; unresolved breaches older than 48 hours are escalated to BRC.
- **Vera back-testing exception recon:** tracks the trailing 250-day exception count per desk and alerts when any desk enters amber (5+) or red (10+) zone; PA notification trigger for red zone is automated.
- **Vera PLA recon:** confirms that every IMA desk produces exactly one `PLATestResultRecorded` event per month; missing events are findings.
- **BRC monthly dashboard:** Helena presents risk metrics, breach history, back-testing exception counts, and PLA results. BRC may request ad-hoc re-runs or additional sensitivity analyses.
- **Annual model validation:** VaR, ES, and PLA models are independently validated by Nadia (model validation engineer, engineering) per `model-validation.md`; IMA approval by the PA requires a clean validation opinion.
- **PA SREP / supervisory visit:** all `MarketRiskMetricsCalculated`, `MarketRiskLimitBreached`, and back-testing exception records are available for PA inspection; retrieval SLA < 5 business days.
