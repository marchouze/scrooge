---
title: Validation methodology — Tier-1 (v0.1)
author: Nadia
date: 2026-05-09
summary: Tier-1 validation methodology covering regulatory capital RWA, IFRS 9 ECL, and AML monitoring core models. Annual revalidation. Specifies the seven validation dimensions (independent re-implementation, parallel-run cadence, benchmark / challenger expectations, sensitivity analysis, edge-case coverage, documentation standards, sign-off authority); the per-class test catalogue consumed by the backtest harness (S7-Targeted item #4); and the build-phase posture (synthetic positions; no `ModelValidationApproved` until first real-position consumption).
decision-required: false
maps-to-decision-id: D-S7-TARGETED-3-5-OPEN-QUESTIONS
version: 0.1
tier: 1
inherits-from-policy: model-risk-policy
last-published: 2026-05-09
owner: Nadia (Independent model-validation engineer)
published-as-event: ValidationMethodologyPublished
---

# Validation methodology — Tier-1 (v0.1)

> **Specification, not tutorial.** Read by Nadia at every Tier-1 validation, by Vera as the recon input for the validation-cycle pipeline, by Helena as the BRC challenge reference, by Rohan as the input requirement at submission. The seven dimensions and the test catalogue below are the contract. Versioned forward; supersession is a typed `ValidationMethodologyPublished` event with the next version label.

**Authority chain (binds every section).** RAS § B7 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144); SR 11-7 §V (validation) + §VI (documentation), *Guidance on Model Risk Management*, US Federal Reserve / OCC, 2011; SS 1/23 Principle 4 (model documentation and version control), Bank of England PRA, 2023; BCBS *Corporate Governance Principles for Banks* (2015 rev. 2024) Principles 6 + 8; Banks Act 94 of 1990 § 70(2A)(b) (risk-management process and audit). Per-section additional citations as marked. Citations not yet in `Regulations/_obligations-register.md` are flagged `[register: route to Mira]` per `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §5.5; Mira's S3 follow-on covers gap-closure.

**Published-as-event.** `ValidationMethodologyPublished` is typed per Atlas's PR #21. The event is **not** emitted on this commit; it emits at first model-validation run that this methodology version governs (consistent with sub-decision A.2 of `D-S7-TARGETED-3-5-OPEN-QUESTIONS` — no validation-decision events until first real-position consumption). Until then, the methodology is the canonical Markdown artefact at this path; recon (Wave-4 #11, planned) asserts conformity at audit time.

---

## Scope

### Coverage

This methodology applies to every model classified as Tier-1 under RAS § B7. The Tier-1 model classes:

- **Regulatory capital RWA models.** Capital-RWA computations under SARB Regulations Relating to Banks (Reg 39 — IRB / IMM / IMA approval pathway; Banks Act § 70(2A)(b)) where the bank elects internal models; the standardised-approach computation engines where their outputs feed BA-return cells (BCBS d457 *Minimum capital requirements for market risk* / FRTB sensitivities) `[register: route to Mira — BCBS d457]`.
- **IFRS 9 ECL models.** Stage classification, PD / LGD / EAD components, and lifetime / 12-month ECL computation where the output enters audited financial statements (`ORG-AC-02`; IFRS 9 §5.5) and BA-return Provision lines.
- **AML monitoring core models.** Transaction-monitoring rule-engines, scenario-based models, and any ML-assisted alert-generation engine whose output drives `STRFiled` / `CTRFiled` decisions (`ORG-FC-07` / `ORG-FC-09`; FIC Act ss.21–28; FATF Recommendation 10 via `ORG-FC-02`).

A model is in scope if **any** of the three RAS § B7 regulatory-consequence rules applies (regulatory submission · capital / liquidity computation · AML / financial-crime decisioning). Boundary cases — climate-stress-scenario engines; counterparty rating models; LLM-assisted advisory tooling — escalate to Helena per `Team/Nadia.md` §10 ("Novel model class outside existing tier definitions") rather than collapsing into Tier-2 by default.

### Cadence

- **Pre-deployment.** Independent validation before any `ModelValidationApproved` event.
- **Annual revalidation.** Full re-application of this methodology every 12 calendar months from the last `ModelValidationApproved` per model.
- **Continuous monitoring.** Backtest harness runs per the test catalogue (§ Specific test catalogue); breaches dispositioned by Nadia within 10 working days (`BacktestBreachDisposed` event) per `Team/Nadia.md` §9.
- **Trigger-driven re-runs.** `MethodologyChangeRequested` (Rohan), `ModelDriftDetected` (Rohan's monitoring), and `RiskPolicyChange` events affecting RAS § B7 each trigger a partial revalidation within the SLA in `Team/Nadia.md` §7.

---

## The seven dimensions

Each dimension below is a binding requirement at Tier-1. A model that fails to satisfy any dimension cannot receive `approve`; the disposition is `withhold` or `restrict-to-validated-envelope`.

### 1. Independent re-implementation cadence

| Tier-1 model class | Independent re-implementation required? | Justification |
|---|---|---|
| Capital RWA (internal-models electing Reg 39 IRB / IMM / IMA) | **Required**, per validation cycle | Reg 39 + BCBS *RCAP* expectations on internal-models capital approval require an independent challenger. SR 11-7 §V.1 (effective challenge) is structurally weak without a parallel implementation when a single internal model drives a regulatory capital ratio. |
| IFRS 9 ECL (lifetime / 12-month, PD / LGD / EAD, staging) | **Required**, per validation cycle | IFRS 9 §5.5 + SARB Directive 5/2017 on ECL (the bank's IFRS 9 expectations directive) `[register: route to Mira — Directive 5/2017]` + Joint Guidance Note 11/2018 `[register: route to Mira — JGN 11/2018]`. The output enters audited financials and BA-return Provision lines; conceptual-soundness review alone is insufficient. |
| AML monitoring core (rule-engine, scenario-engine, ML-assisted alert generation) | **Conceptual-soundness review** + **scenario-based independent challenger** (not full re-implementation) | FATF Recommendation 10 and FIC Act ss.21–28 are framework obligations that do not prescribe re-implementation; the scenario-based challenger (Nadia constructs a parallel scenario library and runs it through the candidate engine) achieves effective challenge proportionate to the discipline's nature. Full re-implementation only triggers on `ModelDriftDetected` involving rule-yield divergence > 20% across two consecutive cycles. |

Re-implementation is run in Nadia's pipeline, against the event store, with independent data extraction. It is not run inside Rohan's development environment (`Team/Nadia.md` §15 — data and code segregation).

### 2. Parallel-run cadence

| Tier-1 model class | Parallel-run frequency | Divergence disposition |
|---|---|---|
| Capital RWA | Daily (challenger output run alongside production output during validation cycle; weekly during steady-state monitoring) | Divergence > 5% on the regulatory-capital-impact metric for two consecutive runs → `BacktestBreachDisposed` (`tolerate` / `remediate-by-deadline` / `withdraw-validation`). Single-run divergence > 10% → immediate `BacktestBreachDisposed` with disposition decision within 5 working days. |
| IFRS 9 ECL | Monthly (aligned to financial close) | Divergence > 10% on stage-by-stage provision totals or > 5% on aggregate provision → `BacktestBreachDisposed`. Stage-migration count divergence > 15% → finding raised. |
| AML monitoring core | Continuous comparison of alert sets, weekly aggregation | Alert-set Jaccard similarity < 0.85 → `BacktestBreachDisposed`. Aggregate alert-rate divergence > 25% on the rolling 30-day window → finding raised. |

Dispositions emit the typed `BacktestBreachDisposed` event (PR #21).

### 3. Benchmark / challenger expectations

A **benchmark** is a well-known industry baseline (e.g. standardised-approach RWA computation as benchmark to internal-models RWA; vintage analysis as benchmark to PD curves; rule-of-thumb staging-stability ratios as benchmark to ECL stage-migrations). A **challenger** is an independent reformulation by Nadia of the same problem (e.g. a Monte-Carlo IRB challenger to the candidate's analytic IRB; an alternative LGD specification; an alternative AML-scenario library).

| Tier-1 model class | Benchmark required | Challenger required | Justification |
|---|---|---|---|
| Capital RWA | Yes — standardised-approach computation per Reg 39 | Yes — independent reformulation per validation cycle | Reg 39's RCAP-aligned expectation that internal-models output is contextualised against the standardised-approach floor. SR 11-7 §V.1 effective-challenge posture. |
| IFRS 9 ECL | Yes — vintage analysis on the historical loss data; static-pool benchmark for PD | Yes — independent specification of either PD, LGD, or staging methodology (rotating per cycle so all three are challenged within three years) | IFRS 9 §5.5 + SS 1/23 Principle 4 (model documentation and version control) require both. Rotation prevents the validator's own challenger becoming a fixed point. |
| AML monitoring core | Yes — peer-bank rule-yield benchmarks where published; FATF *Mutual Evaluation Report* baselines | Yes — independent scenario library (Nadia constructs alternative scenario specifications and runs them through the candidate engine) | FATF Recommendation 10 contextualisation; FIC ss.21–28 risk-based-approach expectation that the chosen scenario set is justified, not assumed. |

Benchmark and challenger results are reported in the validation report (§ Documentation standards). A benchmark-only validation (no challenger) is `withhold` at Tier-1 — both are required.

### 4. Sensitivity analysis

The candidate model must be perturbation-stable across the input dimensions material to its output. Tier-1 perturbation envelopes:

| Tier-1 model class | Input dimension | Perturbation envelope | Pass / restrict / withhold thresholds |
|---|---|---|---|
| Capital RWA | Risk-factor curves (rates, FX, credit spreads, equity, vol surfaces) | ± 300 bp parallel; ± 150 bp twist; ± 50% vol-surface multiplier | **Pass** if RWA sensitivity is monotonic and within ± 20% of benchmark; **restrict** if sensitivity is monotonic but envelope-bounded; **withhold** if non-monotonic or > 50% deviation. |
| Capital RWA | Correlation parameters (regulatory floors per Reg 39) | Stress within Reg 39-permitted range | **Pass** if RWA result remains within Reg 39 floor; **withhold** if breaches floor. |
| IFRS 9 ECL | PD inputs | ± 30% multiplicative; macroeconomic-scenario weight ± 20 percentage points | **Pass** if stage-migration counts move monotonically; **restrict** if non-monotonic in tail scenarios only; **withhold** if non-monotonic in central scenario. |
| IFRS 9 ECL | LGD inputs | ± 30% multiplicative; collateral-haircut ± 20 percentage points | **Pass** if provision deltas track LGD changes within ± 25%; **withhold** otherwise. |
| AML monitoring core | Threshold parameters | ± 25% on every threshold | **Pass** if alert-rate elasticity < 3.0 (alert volume changes less than 3× the threshold change); **restrict** if elasticity 3.0 – 5.0 with documented threshold-floor; **withhold** if > 5.0 (over-tuned). |

Perturbation runs are part of the validation cycle, not optional supplementary work.

### 5. Edge-case coverage

The minimum scenario set Tier-1 validation must cover, sourced and defined per class:

| Tier-1 model class | Scenario source | Minimum coverage | "Edge" definition |
|---|---|---|---|
| Capital RWA | Helena's ICAAP scenario library (planned per `Team/Nadia.md` §16) + SARB FSD severe scenarios `[register: route to Mira — SARB FSD severe-scenario register]` + BCBS *RCAP*-style cross-jurisdiction pressure | ≥ 8 scenarios spanning historical SA crises (2008 GFC; 2020 COVID; 2023 grey-listing window), forward-looking macroeconomic scenarios from the ICAAP library, and the SARB severe-but-plausible set | Inputs ≥ 99th-percentile of the historical observation window or any input outside the validated envelope (§ 6) |
| IFRS 9 ECL | Vintage cohorts (each origination quarter as a cohort); macroeconomic-scenario library; idiosyncratic-shock scenarios | All vintages with ≥ 50 obligors; the 3 macro scenarios used in financial reporting; at least 5 idiosyncratic scenarios per portfolio segment | Cohorts where stage migration > 25% within a single reporting period; any scenario producing a stage-3 count > 2× steady-state |
| AML monitoring core | Typology library (FATF and FIC GN-published typologies); historical alert population; synthetic adversarial scenarios (Nadia constructs) | Every typology in the FIC GN-7-aligned set; the historical false-positive set; ≥ 10 synthetic adversarial scenarios per typology | Transactions where the rule-engine's confidence is borderline (within 10% of threshold); typologies producing < 5 historical alerts (under-fitted regions) |

The validation report enumerates which scenarios were run and the disposition for each.

### 6. Documentation standards

The Tier-1 validation report satisfies the SR 11-7 §VI artefact set in full. Required sections:

- **Model spec read** — confirmation that every required field of `prototype/platform/risk/model-specs/_template.md` (the contract Rohan submits) is populated; `[citation: route to Mira]` flags resolved at the obligations-register level (per `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §3.4).
- **Conceptual-soundness review** — Nadia's read on the seven submission dimensions; SR 11-7 §V.1 (effective challenge).
- **Independent re-implementation report** — challenger-model construction, calibration, and divergence summary.
- **Parallel-run report** — divergence histograms, breach instances, dispositions.
- **Benchmark report** — benchmark construction; deviation analysis vs. candidate.
- **Challenger report** — challenger-model fit, deviation analysis vs. candidate, robustness summary.
- **Sensitivity report** — perturbation envelope coverage; pass / restrict / withhold determinations per input dimension.
- **Edge-case coverage report** — scenario-by-scenario disposition.
- **BCBS 239 conformance** — confirmation that risk-data-aggregation preconditions are met (`Team/Nadia.md` §4); cites Anya's data-contracts catalogue.
- **Findings register at point-in-time** — every `ValidationFindingRaised` open against the model with severity, owner, deadline.
- **Disposition** — `approve` / `withhold` / `restrict-to-validated-envelope` with envelope content (consumed by `ProductionUseBoundary` schema, S7-Targeted slice 5).
- **References** — full citation chain.

Reports survive an SARB Prudential Authority on-site inspection. The standard for "survives" is: a PA reviewer following the citation chain reaches a register row, a published methodology, or a typed event — never prose-only.

### 7. Sign-off authority

Nadia's Tier-1 dispositions, per `Team/Nadia.md` §9:

| Disposition | Authority | Output event |
|---|---|---|
| `approve` | Nadia | `ModelValidationApproved` |
| `withhold` | Nadia | `ModelValidationWithheld` |
| `restrict-to-validated-envelope` | Nadia | `ModelValidationApproved` with `envelope` field; `ProductionUseBoundary` schema attached |

Escalation triggers (per `Team/Nadia.md` §10):

- **Methodology disagreement with Rohan** that cannot be resolved by evidence → `AgentEscalation` to Helena → CEO; deadline 5 working days.
- **Model owner contests `restrict-to-validated-envelope`** → `AgentEscalation` to Helena (and Thandiwe if independence-affecting); 5 working days.
- **Novel model class outside RAS § B7 tier definitions** → `AgentEscalation` to Helena (BRC route; CEO interim) pre-classification.
- **Material model-risk failure in production** (post-approval withdrawal of sign-off; the bind activates at first real-position consumption per sub-decision A.2) → sealed `AgentEscalation` to Helena + Camille + Thandiwe → CEO, with PA notification path lit if regulatory submission affected; 24 hours.
- **Methodology-version change that materially shifts validation rigour** → `AgentEscalation` to Helena (BRC route; CEO interim) pre-publication. This methodology v0.1 itself is not such a change (initial publication); future v0.2 → v0.3 transitions are.
- **Independence-affecting event** (Helena or Rohan attempts to gate Nadia's access to data, code, or registers) → sealed `AgentEscalation` to Thandiwe (CAE) pre-decision.
- **BCBS 239 conformance failure** (data-quality preconditions not met) → `AgentEscalation` to Helena + Anya within 2 working days.

Decisions outside this set are Wave-4 #15 findings (out-of-scope agent decision; `Team/Nadia.md` §9 last paragraph).

---

## Specific test catalogue

The backtest harness (S7-Targeted item #4; Rohan-led, in flight in parallel) consumes this catalogue as its Tier-1 specification. Each row names the comparison metric the harness computes against the candidate's production output.

### Capital RWA

| Test | Metric | Citation |
|---|---|---|
| RWA-attribution stability under regime change | Per-risk-factor RWA contribution decomposition; quarter-on-quarter delta on contribution shares; pass if decomposition shift < 15% absent a documented model change | Reg 39 (SARB Regulations Relating to Banks); BCBS d457 *Minimum capital requirements for market risk* `[register: route to Mira — BCBS d457]` |
| Standardised-approach floor adherence | Internal-models RWA / standardised-approach RWA ratio; pass if ≥ 72.5% per BCBS Basel III floor, allowing any SARB-elected variant `[register: route to Mira — Basel III output floor adoption status]` | Reg 39; BCBS Basel III |
| Parallel-run divergence (challenger vs. production) | Daily RWA delta; pass per § Parallel-run cadence thresholds | SR 11-7 §V.1 effective challenge |

### IFRS 9 ECL

| Test | Metric | Citation |
|---|---|---|
| Staging-stability test | χ² goodness-of-fit on stage-distribution change vs. expected per macroeconomic scenario; pass if p > 0.05 against the central scenario | IFRS 9 §5.5; SARB Directive 5/2017 `[register: route to Mira]`; Joint Guidance Note 11/2018 `[register: route to Mira]` |
| Migration-matrix stability | Frobenius-norm distance between consecutive period transition matrices; pass if distance < 0.10 absent a documented macro-scenario shift | IFRS 9 §5.5; SS 1/23 Principle 4 `[register: route to Mira — SS 1/23]` |
| PD back-testing where data permits | Hosmer-Lemeshow goodness-of-fit on observed-vs-predicted default rates per rating bucket; pass if p > 0.05 across buckets with ≥ 50 obligors | IFRS 9 §5.5; SR 11-7 §V.4 outcome analysis |
| LGD back-testing | Mean-absolute-deviation between predicted LGD and realised loss given default (where realised data exists); pass if MAD < 15% on the rolling 12-quarter window | IFRS 9 §5.5; SR 11-7 §V.4 |
| Stage-migration alert | Period-on-period absolute count delta on Stage-1 → Stage-2 migrations; > 25% deviation triggers `ValidationFindingRaised` | IFRS 9 §5.5 (significant increase in credit risk) |

PD / LGD back-testing is data-permitting at Tier-1; in the build phase (no real positions per sub-decision A.2), back-tests run against synthetic positions and are reported as methodology rehearsal evidence rather than as binding outcomes.

### AML monitoring core

| Test | Metric | Citation |
|---|---|---|
| Rule-yield stability | Per-rule alert count, week-on-week; coefficient of variation < 0.30 absent typology-population change | FIC Act ss.21–28 (`ORG-FC-01` / `ORG-FC-02` / `ORG-FC-09`); FATF Recommendation 10 |
| Alert-rate envelope | Aggregate alert-rate per 1,000 transactions, rolling 30-day; pass if within ± 25% of historical baseline | FIC GN 7 (`ORG-FC-03` / `ORG-FC-06`); FATF Recommendation 1 risk-based approach |
| False-positive rate calibration | FPR per rule; pass if median FPR remains within ± 25% of baseline; per-rule FPR > 95% triggers a finding (rule is over-triggering and dominating triage) | FIC Act ss.21–28; FATF Mutual Evaluation Reports (`ORG-FC-21`) |
| Scenario-coverage integrity | Coverage of FATF + FIC GN 7-aligned typologies; pass if every typology in the published register has at least one rule covering it (or a documented exclusion with `[citation: route to Mira]`) | FATF Recommendation 1; FIC GN 7 |

Tipping-off discipline (`ORG-FC-10`; FIC Act s.29(3)) constrains the validation environment itself: validation reports for AML monitoring core do not enumerate STR-investigation-set members; they reference the cryptographic enforcement of MLRO investigation-set boundaries (`Team/Mira.md` posture).

---

## Build-phase posture

Per sub-decision A.2 of `D-S7-TARGETED-3-5-OPEN-QUESTIONS` (CEO-approved 2026-05-08): in the build phase, this methodology runs against **synthetic positions** only. No `ModelValidationApproved`, `ModelValidationWithheld`, or `BacktestBreachDisposed` events emit until first real-position consumption (post-licence-day for capital RWA and IFRS 9 ECL; pre-licence for any synthetic-position pricing or VaR usage that supports build-phase ICAAP rehearsal — at which point the synthetic / real boundary is clarified per consumer).

**What this means operationally.**

- Validation runs proceed methodology-only against synthetic positions. The seven dimensions are exercised in full; the test catalogue runs.
- Validation reports are authored as `Owner Inbox/` deliverables with full citation chains so SARB Prudential Authority pre-application engagement has rehearsal evidence (the role brief's posture: *"substantively closing the gap before SARB Prudential Authority dialogue is a defensible posture"* — `Owner Inbox/2026-05-09_pax_independent-validation-role-brief.md`).
- `ValidationFindingRaised` events emit against synthetic-position findings as advisory; closure follows the same discipline (`ValidationFindingClosed`).
- The first `ValidationMethodologyPublished` event for this v0.1 methodology emits at first model-validation run that this version governs — not on this commit. The published-methodology hash is the byte-content of this file at that moment.

The build-phase posture is reviewed at the pre-licence go-live readiness gate (Saskia + Rashida + Devon co-owned). Methodology rehearsal posture exits at first real-position consumption; the cadence and citation chain remain unchanged.

---

## Procedure-pair binding

This methodology is one half of the procedure-pair (per `Procedures/validation/_index.md`):

- **Cycle** — `Procedures/by-policy/model-validation.md` (`PLANNED`, owner Helena per `Procedures/_index.md` line 27). The cycle moves a candidate model from `ModelSubmitted` through tier-classification (`ModelTierClassified`), validation-testing, and disposition. The cycle's step-level instruction at the validation-testing step is "**run the validation per the tier methodology**" — i.e. the cycle calls into this file.
- **Substance** — this methodology defines what "run the validation" *means* at Tier-1: which of the seven dimensions are exercised, in what order, against what test catalogue, with what disposition authorities.

Until Helena's cycle procedure lands (Slice D of the validation-methodology library v0), the cycle's intent is carried inline within this methodology: when invoked by the cycle (or, in the build phase, by Nadia directly on synthetic-position rehearsal), the methodology runs the seven dimensions in the order listed, produces the documented artefacts in § 6, and emits the disposition event in § 7. When Slice D lands, the cycle becomes the canonical orchestrator and these inline references collapse to typed cycle steps.

---

## Substrate dependencies

| Dependency | Status | Owner | Blocks |
|---|---|---|---|
| Typed events `ValidationMethodologyPublished`, `BacktestBreachDisposed`, `ModelDriftDetected`, `ProductionUseRequested`, `MethodologyChangeRequested` | **Typed on the bus** per Atlas PR #21 | Atlas | Methodology version publication (event emits at first model-validation run, not on this commit) |
| Typed events `ModelValidationApproved`, `ModelValidationWithheld`, `ValidationFindingRaised`, `ValidationFindingClosed`, `ModelTierClassified`, `ModelSubmitted` | **Typed on the bus** per `prototype/platform/event-store/event-types.ts` | Atlas | Disposition events |
| Model-spec template (Rohan submission contract) | **Landed** per PR #20 (`prototype/platform/risk/model-specs/_template.md`) | Nadia + Rohan (co-authored) | "Model spec read" section of the validation report |
| Backtest harness | In flight (S7-Targeted item #4) | Rohan + Atlas | Specific test catalogue execution at scale |
| `ProductionUseBoundary` schema (typed envelope) | Planned (S7-Targeted slice 5) | Atlas + Nadia + Kai | `restrict-to-validated-envelope` disposition's typed envelope field; pre-trade gateway envelope enforcement |
| Vera continuous-controls integration (`@platform/recon/*` validation-cycle pipeline) | Planned (Wave-4 #11) | Vera | Auto-detection of stale revalidation cycles, missing per-tier methodology pages, missing per-model validation reports |
| Helena's cycle procedure `Procedures/by-policy/model-validation.md` | Planned (Slice D of validation-methodology library v0) | Helena | Canonical cycle orchestration; methodology runs inline-from-self until cycle lands |
| Model Risk Policy (codified tier-classification rules) | Planned (`Owner Inbox/2026-05-06_policy-register.md` lists `PLANNED`) | Helena | Novel-model-class classification; methodology defers to RAS § B7 examples until policy lands |
| Obligations-register entries flagged `[register: route to Mira]` above (BCBS d457; Basel III output floor adoption; SARB Directive 5/2017; Joint Guidance Note 11/2018; SS 1/23; SARB FSD severe-scenario register) | Pending Mira's S3 follow-on registration | Mira | Citation-chain closure at the obligations-register level; methodology drafting proceeds with placeholders per `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §5.5 (no invented citations; placeholders resolve before the methodology is `ValidationMethodologyPublished`) |

---

## Authority

Full citation chain (binds every section unless a section names additional citations):

- **RAS § B7** — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144. Tier-1 model classes; annual revalidation; binding tier definitions in the build phase. Cited via `ORG-PR-21` (`Regulations/_obligations-register.md`).
- **SR 11-7 §V (validation) + §VI (documentation)** — *Guidance on Model Risk Management*, US Federal Reserve / OCC, 2011. Effective challenge; conceptual-soundness review; outcome analysis; documentation artefact set. Referenced via `ORG-PR-21` (RAS B7 / SR 11-7 idiom; in force).
- **SS 1/23 Principle 4** — *Model Risk Management Principles for Banks*, Bank of England PRA, 2023. Model documentation and version control. `[register: route to Mira — SS 1/23]`
- **BCBS *Corporate Governance Principles for Banks*** (2015 rev. 2024) Principles 6 (board-approved risk-management framework) + 8 (effective second line). Referenced via `ORG-GV-10` and `ORG-GV-18`.
- **Banks Act 94 of 1990 § 70(2A)(b)** — risk-management process and audit. `[register: route to Mira — Banks Act § 70(2A)(b) sub-clause]`
- **SARB Regulations Relating to Banks Reg 39** — internal-models capital approval pathway (IRB / IMM / IMA). `[register: route to Mira — Reg 39 explicit row]`
- **BCBS d457** — *Minimum capital requirements for market risk* (FRTB). `[register: route to Mira — BCBS d457]`
- **IFRS 9 §5.5** — expected credit losses. Cited via `ORG-AC-02`.
- **SARB Directive 5/2017** + **Joint Guidance Note 11/2018** — IFRS 9 expectations directives. `[register: route to Mira]`
- **FIC Act 38/2001 ss.21–28** — risk-based-approach CDD; CTR / STR / PAR. Cited via `ORG-FC-01` (RMCP), `ORG-FC-02` (CDD), `ORG-FC-07` (CTR), `ORG-FC-09` (STR).
- **FATF Recommendation 10** — CDD risk-based approach. Cited via `ORG-FC-02`.
- **FATF Recommendation 1** — risk-based approach. Cited via `ORG-FC-06`.
- **FIC GN 7** — risk-based approach guidance. Cited via `ORG-FC-03` / `ORG-FC-06`.
- **FATF Mutual Evaluation Reports (SA)** — grey-listing remediation context. Cited via `ORG-FC-21`.
- **CLAUDE.md Principle 2** — every action traces to a source. Placeholders flagged `[register: route to Mira]` above resolve before methodology publication; no invented citations.
- **CLAUDE.md Principle 2** — single-graph discipline. Procedure-pair binding (cycle ↔ methodology) and the typed-event hand-offs realise the upward chain Reg → Policy → Procedure → System Capability.
- **CLAUDE.md Principle 6** — autonomous by default. The default actor at every step of this methodology is `agent:nadia`; human-in-the-loop steps are limited to the named escalation channels (§ 7).

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Nadia (via Scrooge) | Initial Tier-1 methodology authored as Slice C of validation-methodology library v0 (sub-decision A of `D-S7-TARGETED-3-5-OPEN-QUESTIONS`). Seven dimensions specified; per-class test catalogue named (capital RWA · IFRS 9 ECL · AML monitoring core); build-phase posture set (synthetic positions; no `ModelValidationApproved` until first real-position consumption); procedure-pair partner reference recorded (`Procedures/by-policy/model-validation.md` — Helena, planned). Substrate dependencies inventoried; obligations-register placeholders flagged for Mira S3 follow-on. First `ValidationMethodologyPublished` event emits at first model-validation run governed by this version, not on this commit. |

—Nadia
