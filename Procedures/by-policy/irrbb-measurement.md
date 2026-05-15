---
procedureId: PROC-RISK-IRRBB-01
title: IRRBB measurement cycle
author: Helena (Chief Risk Officer, governance) · Eitan (treasury & ALM engineer) · Ravi (ALM quant engineer)
date: 2026-05-15
owner: Helena (Chief Risk Officer, governance) · Eitan (treasury & ALM engineer) · Ravi (ALM quant engineer)
status: POPULATED
policy-cited: IRRBB Policy · Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md §B6
system-capability: "@platform/alm/irrbb-engine (PLANNED)"
---

# Procedure — IRRBB measurement cycle

**Procedure ID:** PROC-RISK-IRRBB-01
**Owner:** Helena (Chief Risk Officer, governance) · Eitan (treasury & ALM engineer) · Ravi (ALM quant engineer)
**Approval:** BRC (limits + appetite); ALCO (monthly review)
**Cadence:** Monthly (full NII/EVE calculation + ALCO); daily (limit monitoring); annual (ILAAP chapter)
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- IRRBB Policy (planned; to be authored by Helena with Eitan input; pending at licence-day pre-go-live readiness gate).
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` §B6 — IRRBB appetite: EVE sensitivity limit; NII sensitivity limit; basis risk monitoring.
- `Owner Inbox/2026-05-07_rohan_risk-policies-bundle-v0.md` — IRRBB excerpt.
- Basel III / IRRBB Standards (BCBS April 2016, effective 2018) — industry-standard six shock scenarios and reporting metrics: EVE, NII, CSRBB (credit spread risk in the banking book).

The obligation chain:
```
Regulation (Banks Act Reg 39 / BCBS IRRBB Standards / PA IRRBB Directive)
  → IRRBB Policy
    → PROC-RISK-IRRBB-01 (this procedure)
      → @platform/alm/irrbb-engine (PLANNED)
```

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-11` (Banks Act s.73 / Reg 39 — interest rate risk) | Bank must measure, monitor, and control interest rate risk in the banking book; IRRBB limits must be approved by the Board. |
| `ORG-PR-22` (PA IRRBB Directive — implementing BCBS April 2016 Standards) | Six standardised shock scenarios (parallel up/down, steepener, flattener, short-rate up/down); EVE and NII sensitivity reporting; outlier test (EVE Δ > 15% of Tier 1 + Tier 2 capital); CSRBB monitoring. |
| `ORG-PR-23` (Regulations Relating to Banks — Reg 39 ILAAP) | IRRBB measurement feeds the ILAAP; Pillar 2 capital requirement for IRRBB must be assessed. |
| `ORG-PR-07` (BCBS Principles for Sound Management of Operational Risk Principle 9 — as proxy for ALCO governance) | Senior management must understand and actively manage IRRBB; ALCO is the primary governance forum. |

## 3. Purpose

Measure and monitor the bank's Interest Rate Risk in the Banking Book (IRRBB) — the risk that changes in interest rates adversely affect the bank's Net Interest Income (NII) or Economic Value of Equity (EVE). The cycle:

1. Produces monthly NII sensitivity and EVE sensitivity calculations under the six BCBS standardised shock scenarios.
2. Monitors daily limit utilisation against IRRBB appetite thresholds set in the RAS.
3. Identifies breaches and triggers an escalation pathway to ALCO and, where material, to BRC.
4. Provides the IRRBB chapter for the annual ILAAP.
5. Feeds the PA IRRBB outlier test (EVE Δ > 15% of Tier 1 + Tier 2 capital) for the annual Pillar 2 submission.

## 4. Trigger

**Daily limit monitoring:**
- `PositionSnapshotProduced { as_of_date, scope: "banking-book" }` — Eitan's ALM engine reads the banking book position snapshot and emits daily IRRBB limit utilisation metrics.

**Monthly full calculation (ALCO cadence):**
- Monthly scheduler: first working day of each month — `IRRBBMeasurementCycleStarted { period: "YYYY-MM" }` — full NII/EVE calculation under six shock scenarios.
- ALCO review target: by the 10th working day of each month.

**Annual ILAAP / PA reporting:**
- Annual scheduler (Q3) — IRRBB chapter prepared for ILAAP and PA IRRBB outlier test; Helena signs.

**Ad-hoc — limit breach:**
- `IRRBBLimitBreached { metric, limit, actual, severity }` — triggers immediate escalation pathway regardless of cadence.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Read banking book position snapshot: all fixed-rate and floating-rate assets and liabilities, off-balance-sheet items (derivatives used for hedging), repricing buckets, embedded optionality assumptions (prepayment, non-maturity deposits) | `agent` (Eitan) | `@platform/alm/irrbb-engine` (`PLANNED`) + `@platform/event-store` ✓ (position read) | Embedded optionality assumptions are modelled by Ravi; subject to model validation (PROC-RSK-MV-01). NMD (non-maturity deposit) model is a Tier 1 model under the model-risk framework. |
| 2 | Apply the six BCBS standardised shock scenarios per the PA IRRBB Directive: (1) parallel up; (2) parallel down; (3) steepener (long rates up, short rates down); (4) flattener (long rates down, short rates up); (5) short rates up; (6) short rates down — using the prescribed shock magnitudes for the ZAR curve | `system` (Ravi's ALM quant engine) | `@platform/alm/irrbb-engine` (`PLANNED`) | Shock magnitudes are PA-prescribed per the IRRBB Directive; Ravi is responsible for ensuring the engine applies the correct vectors. Helena validates the methodology annually. |
| 3 | Calculate EVE sensitivity for each scenario: change in economic value of equity under the shock relative to the base case; record EVE Δ per scenario and the worst-case EVE Δ | `system` | `@platform/alm/irrbb-engine` (`PLANNED`) | EVE = PV(assets) − PV(liabilities); EVE Δ = shocked EVE − base EVE. The PA outlier test fires if worst-case EVE Δ > 15% of (Tier 1 + Tier 2 capital). |
| 4 | Calculate NII sensitivity for each scenario over a 1-year and 2-year horizon: change in net interest income under the shock relative to the base case | `system` | `@platform/alm/irrbb-engine` (`PLANNED`) | NII sensitivity uses the bank's internal NII model; embedded optionality assumptions (especially NMDs) are Ravi's Tier 1 model domain. |
| 5 | Emit `IRRBBMeasurementCompleted { period, scenario_results: [ { scenario, eve_delta, eve_delta_pct_capital, nii_delta_1y, nii_delta_2y } ], worst_case_eve_delta, outlier_test_breach: true/false }` | `system` | `@platform/event-store` ✓ | Emitted monthly (full) and daily (limit metrics only). |
| 6 | **Daily limit check.** Compare EVE Δ (worst-case scenario) and NII Δ against RAS B6 appetite thresholds. Emit `IRRBBLimitChecked { as_of_date, metric, limit, actual, utilisation_pct, breach: true/false }` | `system` | `@platform/alm/irrbb-engine` (`PLANNED`) | Limits: EVE sensitivity limit (as % of capital); NII sensitivity limit (as % of projected NII); basis risk monitoring (spread vs benchmark). |
| 7 | **If limit breach detected:** emit `IRRBBLimitBreached { metric, limit, actual, severity: Minor | Major | Critical, as_of_date }`; route to ALCO (standard) or immediate escalation to Helena + BRC (Critical) | `system` | `@platform/event-store` ✓ + `@platform/escalation` (existing) | Minor = 90–100% utilisation. Major = 100–120%. Critical = > 120% or PA outlier test breach. |
| 8 | **Monthly ALCO pack preparation.** Eitan compiles the IRRBB section of the ALCO pack: NII/EVE scenario table, limit utilisation trend, interest rate outlook, hedging position summary, recommended actions | `agent` (Eitan, with Ravi analytics) | `@platform/reporting/alco-pack` (`PLANNED`) | The ALCO pack is a managed-document artefact; it references the `IRRBBMeasurementCompleted` event IDs as its data source. |
| 9 | **ALCO review.** Helena chairs; reviews IRRBB position, limit utilisation, and hedging recommendations; approves or directs remediation; Helena signs the ALCO record | `human` (Helena — ALCO chair) | Governance record (ALCO minutes) | ALCO decisions are governance events; material decisions (e.g., approve new hedge trade, change RAS limit) produce a typed `ALCODecision` event. |
| 10 | **If remediation directed:** Eitan executes approved hedging or position adjustment; emits `IRRBBRemediationExecuted { remediation_type, trade_ref, expected_eve_delta_impact }` | `agent` (Eitan) | `@platform/alm/irrbb-engine` (`PLANNED`) | Hedge trades are executed via the standard trading workflow; the IRRBB engine re-runs the metrics post-execution to verify effectiveness. |
| 11 | **Annual ILAAP IRRBB chapter.** Ravi and Eitan produce the IRRBB narrative for the ILAAP; includes: methodology, model validation status, scenario results, limit utilisation trend, Pillar 2 capital assessment for IRRBB, PA outlier test result; Helena signs | `agent` (Ravi + Eitan) + `human` (Helena — sign) | `@platform/reporting/ilaap-chapters` (`PLANNED`) | The ILAAP is the primary Pillar 2 submission; the PA reviews the IRRBB chapter as part of the SREP. Helena's signature is the load-bearing governance act. |

## 6. Reconciliation

- **Events produced:**
  - `IRRBBMeasurementCycleStarted { period }` — monthly
  - `IRRBBMeasurementCompleted { period, scenario_results, outlier_test_breach }` — monthly
  - `IRRBBLimitChecked { as_of_date, metric, limit, actual, breach }` — daily
  - `IRRBBLimitBreached { metric, actual, severity }` — on breach
  - `IRRBBRemediationExecuted { remediation_type, trade_ref }` — on directed remediation
- **Reconciliation checks:**
  - Every month has an `IRRBBMeasurementCompleted` event (Vera invariant; missing event = Vera finding).
  - Every `IRRBBLimitBreached` event traces to either an `IRRBBRemediationExecuted` or an `ALCODecision` accepting the breach with Helena's documented rationale.
  - The PA outlier test: if `outlier_test_breach: true` in any `IRRBBMeasurementCompleted`, a supervisory notification event is emitted within 5 business days.
  - Model validation: the NMD model and NII model in use must have a current `ValidationCycleSigned` (PROC-RSK-MV-01) — Vera cross-domain check.
- **Failure mode:** ALM engine unavailable on the monthly cycle day → Eitan falls back to manual calculation using the prior-month position + interpolated shocks; emits `IRRBBMeasurementManual { period, reason, validated_by: helena }`. Manual calculation must be validated by Helena before ALCO pack publication.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| All `IRRBB*` events | Event log | Permanent (P1) | Restricted |
| Monthly ALCO pack (IRRBB section) | Document store (BLAKE3-addressed) | 7 years | Confidential |
| ALCO minutes (IRRBB agenda item) | Governance record + document store | 7 years | Confidential |
| Annual ILAAP IRRBB chapter | Document store | Permanent (ILAAP retention) | Confidential |
| Scenario calculation workbooks (methodology evidence) | Document store | 7 years | Restricted |
| PA outlier test notification (where applicable) | Document store + PA submission record | 7 years | Confidential |

## 8. Manual steps

- **Step 1 — Embedded optionality assumptions:** Until the NMD model and prepayment model are fully automated, Ravi must manually review and confirm the behavioural assumptions each quarter. Manual review is recorded as a signed attestation event.
- **Step 8 — ALCO pack compilation:** Eitan interprets the NII/EVE scenario results and makes a hedging recommendation. This requires ALM expertise and interest-rate-market judgement that is not fully automatable.
- **Step 9 — ALCO review and approval:** Helena's ALCO chairmanship and any material decisions (hedge approval, RAS limit change) are irreducibly human governance steps.
- **Step 11 — ILAAP IRRBB chapter:** The Pillar 2 capital assessment narrative for IRRBB requires Helena's professional judgement and CRO signature. Not automatable.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Monthly IRRBB calculation not completed | Vera monthly invariant check | Eitan + Helena; manual fallback calculation; ALCO pack delayed |
| EVE Δ > 15% of Tier 1 + Tier 2 capital (PA outlier test) | `outlier_test_breach: true` in `IRRBBMeasurementCompleted` | Helena + BRC within 5 business days; PA notification; Pillar 2 capital add-on discussion |
| NMD model not validated per PROC-RSK-MV-01 | Vera Wave-4 model-validation recon | Helena + Nadia; IRRBB measurement suspended until model validated (or accepted with documented risk) |
| Major limit breach with no ALCO-approved remediation | `IRRBBLimitBreached { severity: Major }` + no `IRRBBRemediationExecuted` within 5 days | Helena escalates to BRC; directed remediation with timeframe |
| Critical limit breach | `IRRBBLimitBreached { severity: Critical }` | Immediate Helena + BRC + CEO; emergency ALCO session; PA notification may be required |
| ALM engine data feed failure (stale positions) | Eitan's daily data quality check | Atlas + Eitan; fallback to prior-day positions with flagged `IRRBBMeasurementManual`; Helena notified |
| ILAAP IRRBB chapter not submitted in time | Helena's ILAAP schedule | Camille (CFO, governance) + Helena; escalate to CEO; PA deadline management |

## 10. Related procedures

- [`capital-ratio-monitoring.md`](capital-ratio-monitoring.md) — IRRBB Pillar 2 capital charge feeds the capital-adequacy calculation; EVE Δ is an input to ICAAP capital assessment.
- [`stress-test-cycle.md`](stress-test-cycle.md) (PROC-RISK-ST-01) — IRRBB stress scenarios are a subset of the broader stress-testing programme; severe-but-plausible interest-rate scenarios are co-developed with the IRRBB cycle.
- [`model-validation.md`](model-validation.md) (PROC-RSK-MV-01) — NMD model and NII model are Tier 1 models requiring annual validation; production-eligibility gate applies.
- [`intraday-liquidity-funding.md`](intraday-liquidity-funding.md) (PROC-RISK-ILF-01) — banking-book liquidity and IRRBB are co-managed in ALCO; intraday liquidity positions interact with interest rate exposures.
- `hedge-designation-test.md` (PLANNED) — IRRBB-driven hedges require hedge-accounting documentation under IFRS 9 §6.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Helena + Eitan + Ravi | Initial draft — PLANNED → POPULATED; full 12-section procedure; BCBS six-scenario framework; PA outlier test; ALCO governance path. |

## 12. Audit / assurance

- **Vera monthly:** verify that `IRRBBMeasurementCompleted` event exists for each month; verify all limit breaches have a disposition event within 5 days; cross-domain check that the NMD/NII models have a current `ValidationCycleSigned`.
- **Vera annual:** review a sample of IRRBB scenario calculations against independent recalculation; verify PA outlier test results are consistent with the event log; report to AC.
- **Thandiwe (CAE, governance):** annual internal audit of the IRRBB cycle methodology and governance trail; opinion on adequacy of the Pillar 2 capital assessment for IRRBB.
- **PA SREP:** the PA reviews the ILAAP IRRBB chapter as part of the SREP; any adverse findings trigger a supervisory engagement managed by Helena and Camden (once appointed as Head of Regulatory Affairs).
