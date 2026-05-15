# Procedure — Stress test cycle

**Procedure ID:** PROC-RISK-ST-01
**Owner:** Helena (Chief Risk Officer, governance) · Camille (Chief Financial Officer, governance)
**Approval:** Board (stress testing is a Board-level governance item per ICAAP/ILAAP)
**Cadence:** Annual (baseline + adverse scenario full cycle); quarterly (sensitivity parameter update); ad-hoc (reverse stress test on trigger)
**Version:** v0.1 — 2026-05-13
**Status:** POPULATED

## 1. Source policy

`Policies/market-risk-policy-v1.md` — Market Risk Policy (market risk stress inputs).
`Policies/credit-risk-policy-v1.md` — Credit Risk Policy (credit stress inputs).
`Policies/operational-risk-policy-v1.md` — Operational Risk Policy (op-risk stress inputs).
`Policies/capital-management-policy-v1.md` — Capital Management Policy (ICAAP capital adequacy conclusion).
`Policies/liquidity-risk-management-policy-v1.md` — Liquidity Risk Management Policy (ILAAP liquidity stress).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-PR-12` | Conduct integrated stress testing covering capital and liquidity simultaneously; include reverse stress tests calibrated to key vulnerabilities. |
| `ORG-PR-13` | Annual ICAAP submission to PA; stress test results are the primary ICAAP capital-adequacy input. |
| `ORG-PR-14` | Annual ILAAP submission to PA; liquidity stress results are the primary ILAAP input. |
| `ORG-PR-30` | Maintain a documented Recovery Plan; stress test results feed recovery-trigger calibration. |

## 3. Purpose

Produce an integrated, annually-refreshed stress test that demonstrates the bank's capital and liquidity resilience under baseline, adverse, and reverse-stress scenarios; provide the documented evidence base for the ICAAP and ILAAP PA submissions; and feed recovery-trigger thresholds into the Recovery Plan. The procedure covers five risk types (market, credit, operational, liquidity, capital) and produces a single integrated P&L and capital/liquidity path for Board approval.

## 4. Trigger

- **Annual** (Q1 of each calendar year, or as directed by the Board): full stress test cycle — all three scenario types, all five risk types, integrated output, Board approval, PA submission.
- **Quarterly** (after the annual cycle): sensitivity parameter update — refresh macro-economic assumptions without re-running full scenarios; results reported to BRC.
- **Ad-hoc**: reverse stress test triggered by any of: capital ratio falling within 200bps of regulatory minimum; LCR falling below 120%; PA request; Board decision; occurrence of a severe market event.
- **PA request** (any time): Helena co-ordinates an out-of-cycle scenario run and submits results within the PA-specified timeframe.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Open stress test cycle; emit `StressTestCycleOpened { vintage, scenario_types, risk_types }` | `system` (scheduled) + `Helena` | `@platform/event-store` ✓ | Vintage = calendar year (or ad-hoc date-stamp). Helena confirms scope before execution begins. |
| 2 | Calibrate baseline scenario: use the bank's central economic forecast; validate against consensus macro data | `Helena` + `Rohan` | `@platform/stress-test/scenario-calibration` (`PLANNED`) | Baseline validates business-model viability under expected conditions; no PA minimum severity requirement. |
| 3 | Calibrate adverse scenario: plausible but severe macroeconomic shock aligned to PA guidance (SA recession, EM contagion, rate spike, credit spread widening); document calibration rationale | `Helena` + `Rohan` | `@platform/stress-test/scenario-calibration` (`PLANNED`) | Severity calibrated to be at least as severe as PA's published stress benchmark. Rationale document filed in RMS. |
| 4 | Define reverse stress test: work backwards from capital-exhaustion or liquidity-crisis outcome; identify the combination of shocks that causes it; document threshold assumptions | `Helena` | `@platform/stress-test/reverse-stress` (`PLANNED`) | Mandatory per ORG-PR-12. Results feed Recovery Plan trigger calibration (ORG-PR-30). |
| 5 | Run market risk stress for each scenario: apply instantaneous shocks to risk factors (parallel rate shift, credit spread widening, equity crash, FX devaluation); compute P&L impact and stressed VaR/ES; emit `StressScenarioRun { scenario_type, risk_type: market_risk }` | `system` | `@platform/stress-test/market-risk-module` (`PLANNED`) | Shock magnitudes drawn from adverse scenario calibration (Step 3). Inputs from `@platform/risk-engine` (PROC-RISK-MRM-01). |
| 6 | Run credit stress for each scenario: model PD/LGD migration under each scenario; compute ECL step-up; translate into P&L and capital impact; emit `StressScenarioRun { scenario_type, risk_type: credit_risk }` | `system` | `@platform/stress-test/credit-risk-module` (`PLANNED`) | PD/LGD migration matrices calibrated by Rohan; ECL computation per IFRS 9 ECL Policy. |
| 7 | Run operational risk stress for each scenario: model elevated op-loss frequency under adverse scenario (system outages, cyber event, key-person loss, third-party failure); emit `StressScenarioRun { scenario_type, risk_type: operational_risk }` | `system` + `Helena` | `@platform/stress-test/op-risk-module` (`PLANNED`) | Frequency and severity assumptions drawn from the RCSA and op-risk loss database. |
| 8 | Run liquidity stress for each scenario: project LCR and NSFR paths; model outflow assumptions (institutional depositor behaviour, margin call triggers, secured funding market closure); identify liquidity trough; emit `StressScenarioRun { scenario_type, risk_type: liquidity }` | `system` | `@platform/stress-test/liquidity-module` (`PLANNED`) | ILAAP primary input. Assumptions aligned with SARB Directive 11/2014 outflow rates for institutional counterparties. |
| 9 | Run capital stress (ICAAP primary input): project CET1 ratio path over 3 years under each scenario; identify capital trough; assess buffer adequacy against combined buffer requirement and Pillar 2A add-on (where notified) | `system` | `@platform/stress-test/capital-module` (`PLANNED`) | ICAAP capital-adequacy conclusion is derived from the capital trough relative to combined buffer requirement. |
| 10 | Integrate outputs: combine five risk-type results into a single integrated stress P&L and capital/liquidity path for each scenario | `system` | `@platform/stress-test/integration` (`PLANNED`) | Integration avoids double-counting (e.g. credit losses feeding both P&L and capital simultaneously). Helena reviews integration methodology. |
| 11 | BRC challenge session: Helena presents scenario calibration, integrated outputs, and capital/liquidity troughs; BRC challenges assumptions; material changes trigger re-run | `Helena` + `Camille` + BRC | `@platform/event-store` ✓ (record minutes as document event) | BRC must formally accept the outputs before Board submission. Emit `StressTestResultsReviewed { approved_by: helena, brc_sign_off: true }`. |
| 12 | Board approval: Helena and Camille present to Board; Board approves the ICAAP/ILAAP narrative and authorises PA submission | `Helena` + `Camille` + Board | `@platform/event-store` ✓ | Board resolution recorded as typed event. Emit `ICAAPreviewSubmissionAuthorised { authorised_by: board, date }`. |
| 13 | Recovery Plan update: feed reverse-stress trigger thresholds into the Recovery Plan; Devon confirms operational resilience triggers align | `Helena` + `Devon` | `@platform/recovery-plan/trigger-update` (`PLANNED`) | Per ORG-PR-30; Recovery Plan held in RMS Document register. |
| 14 | ICAAP submission to PA: package narrative, stress results, capital-adequacy conclusion, recovery-plan update; submit electronically | `Helena` + `Owen` | `@platform/pa-submission/icaap` (`PLANNED`) | Emit `ICAAPSubmitted { pa_reference, submission_date, vintage }`. Owen (Company Secretary, governance) co-ordinates receipt acknowledgement. |
| 15 | ILAAP submission to PA: package liquidity stress results, LCR/NSFR projections, outflow assumptions, liquidity-adequacy conclusion | `Helena` + `Camille` + `Owen` | `@platform/pa-submission/ilaap` (`PLANNED`) | Emit `ILAAPSubmitted { pa_reference, submission_date, vintage }`. |
| 16 | PA SREP response processing: receive PA Supervisory Review and Evaluation Process (SREP) outcome; where a Pillar 2A add-on is notified, update capital plan; re-run capital stress with updated Pillar 2A assumption | `Helena` + `Camille` | `@platform/event-store` ✓ | PA may also request additional sensitivity analyses; Helena co-ordinates within the PA-specified timeframe. |
| 17 | Quarterly sensitivity update (between annual cycles): refresh macro assumptions; re-run capital and liquidity stress modules only; report delta to BRC | `Rohan` + `Helena` | `@platform/stress-test/sensitivity-update` (`PLANNED`) | Full Board re-approval not required for quarterly sensitivity updates unless results materially breach management thresholds. |

## 6. Reconciliation

- **Events produced:**
  - `StressTestCycleOpened { vintage, cycle_type: annual | quarterly | ad_hoc, scenario_types, risk_types }` — cycle inception.
  - `StressScenarioRun { vintage, scenario_type: baseline | adverse | reverse, risk_type, trough_value, trough_date, status: pass | breach }` — per scenario × risk-type combination; expected count = 3 scenario types × 5 risk types = 15 per annual cycle.
  - `StressTestResultsReviewed { vintage, approved_by: helena, brc_sign_off, board_approval_pending }` — BRC sign-off.
  - `ICAAPreviewSubmissionAuthorised { vintage, authorised_by: board, date }` — Board authorisation.
  - `ICAAPSubmitted { vintage, pa_reference, submission_date }` — PA receipt.
  - `ILAAPSubmitted { vintage, pa_reference, submission_date }` — PA receipt.
  - `StressTestCycleClosed { vintage, outcome }` — cycle completion.
- **Invariants:**
  - Every annual vintage must produce exactly 15 `StressScenarioRun` events (3 × 5) before `StressTestResultsReviewed` can be emitted.
  - `ICAAPSubmitted` must be preceded by `ICAAPreviewSubmissionAuthorised` with `authorised_by: board`.
  - `ILAAPSubmitted` must be preceded by a Board-approved ILAAP narrative document event.
  - Every reverse stress test result must produce a corresponding Recovery Plan trigger-update event before the cycle is closed.
- **Failure mode:** Scenario module unavailable at cycle start → cycle held open; Helena notified immediately; PA informed if the delay risks the annual submission deadline.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `StressScenarioRun` events (all vintages) | Event log | 10 years (PA inspection / ICAAP history) | Restricted |
| Scenario calibration rationale documents | RMS Document register | 10 years | Restricted |
| BRC challenge-session minutes | RMS Document register | 10 years | Restricted |
| Board ICAAP/ILAAP approval resolution | RMS Document register | Permanent | Restricted |
| ICAAP submission package (narrative + stress tables) | `@platform/pa-submission/icaap` + RMS | 10 years | Critical |
| ILAAP submission package | `@platform/pa-submission/ilaap` + RMS | 10 years | Critical |
| PA SREP outcome correspondence | RMS Correspondence register | Permanent | Critical |
| Recovery Plan trigger-update records | RMS Document register | 10 years | Critical |
| Quarterly sensitivity-update BRC reports | RMS Document register | 7 years | Restricted |

## 8. Manual steps

- **Step 2–4** — Scenario calibration and reverse stress test design: Helena and Rohan must exercise professional judgement in setting shock parameters. The platform records calibration inputs and rationale as typed events; it does not substitute for the methodology judgement.
- **Step 11** — BRC challenge: board-level governance step; the committee's challenge and any requested re-runs are matters of independent oversight. Outcomes recorded as signed document events.
- **Step 12** — Board approval: the Board's approval of the ICAAP/ILAAP narrative is a human governance decision. Recorded as a board-resolution event.
- **Step 13** — Recovery Plan trigger calibration: Devon's operational resilience review of trigger thresholds requires contextual judgement about plausible recovery actions. Outcome documented before cycle closure.
- **Step 16** — PA SREP processing: Helena interprets the SREP outcome and determines whether the Pillar 2A add-on requires a capital plan amendment. This is regulatory dialogue and requires human legal/regulatory judgement.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Annual cycle not opened by Q1 deadline | No `StressTestCycleOpened` event by scheduled date | Helena → CEO immediately; Board informed; PA deadline risk assessed |
| Scenario module failure mid-cycle | Missing `StressScenarioRun` events after trigger | Rohan + Atlas; Helena assesses manual fallback for PA deadline |
| Capital trough below combined buffer requirement in adverse scenario | `StressScenarioRun { status: breach }` for capital module | Helena → Camille → CEO → Board; capital plan revision initiated; PA pre-notification assessed |
| Liquidity trough below LCR 100% in adverse scenario | Liquidity `StressScenarioRun { status: breach }` | Helena → Eitan → Camille → CEO; contingency funding plan activated |
| BRC rejects scenario calibration | No `StressTestResultsReviewed { brc_sign_off: true }` after BRC session | Helena re-calibrates and schedules second BRC session; timeline risk assessed for PA deadline |
| PA submission missed (annual deadline) | No `ICAAPSubmitted` / `ILAAPSubmitted` by PA-published deadline | Helena → CEO → Owen → PA formal communication; remediation plan and revised timeline agreed |
| SREP Pillar 2A add-on received | `StressTestCycleClosed` followed by PA letter event | Camille updates capital plan; Helena re-runs capital stress with new Pillar 2A; BRC informed within 5 business days |
| Reverse stress test reveals previously unidentified vulnerability | `StressScenarioRun { scenario_type: reverse, status: critical }` | Helena → CEO → Board immediately; Recovery Plan triggers reviewed and revised before cycle closure |

## 10. Related procedures

- `market-risk-monitoring.md` (PROC-RISK-MRM-01) — daily VaR/ES metrics feed market risk stress calibration.
- `capital-ratio-monitoring.md` — capital ratio monitoring provides the baseline capital position that stress testing projects forward.
- `ecl-stage-projection-refresh.md` — IFRS 9 ECL methodology and staging probabilities feed credit stress inputs.
- `model-validation.md` — stress models (scenario calibration, credit migration matrices, liquidity outflow models) are subject to independent model-risk validation.
- `rcsa-cycle.md` (PLANNED) — op-risk loss database and RCSA outputs feed operational risk stress severity assumptions.
- `intraday-liquidity-funding.md` (PLANNED) — liquidity stress outflow assumptions must be consistent with intraday-liquidity management limits.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Helena + Camille (via Scrooge dispatch) | Initial populated stub. Three scenario types; five risk types; integrated output; ICAAP/ILAAP submission path; Recovery Plan trigger feed. |
| v0.2 | 2026-05-15 | Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance) + Rohan (Market risk quantitative engineer, engineering) | Promoted to POPULATED — §12 Audit/assurance added; all 12 sections complete. |

## 12. Audit / assurance

- **Vera annual-cycle recon:** confirms that a `StressTestCycleOpened` event exists for every calendar year vintage and that the cycle reaches `StressTestCycleClosed` within the annual submission deadline. Missing vintages are findings escalated to Helena and the Board.
- **Vera scenario-count invariant:** asserts that every annual cycle produces exactly 15 `StressScenarioRun` events (3 scenario types × 5 risk types) before `StressTestResultsReviewed` is emitted; any shortfall blocks cycle closure.
- **Vera ICAAP/ILAAP submission gate:** confirms that `ICAAPSubmitted` and `ILAAPSubmitted` events carry a valid PA reference and are preceded by Board-authorisation events; absence of either is a critical finding.
- **Vera Recovery Plan trigger check:** confirms that every reverse-stress-scenario result triggers a Recovery Plan trigger-update event before the cycle closes; missing update is a finding.
- **BRC quarterly review:** BRC reviews sensitivity-update outputs and the status of the current annual cycle. Helena presents; Camille presents the capital-adequacy conclusion.
- **Board annual review:** Board approves the ICAAP/ILAAP narrative and the stress-test programme at the annual governance cycle. Board resolution is the primary assurance record.
- **PA SREP:** the PA reviews the ICAAP and ILAAP submissions through the Supervisory Review and Evaluation Process; any Pillar 2A add-on or required remediation is a regulatory-assurance outcome. Helena manages the SREP dialogue.
- **Independent model validation:** stress-test models (scenario calibration, credit migration matrices, liquidity outflow models) are subject to annual independent validation by Nadia (model validation engineer, engineering) per `model-validation.md`.
