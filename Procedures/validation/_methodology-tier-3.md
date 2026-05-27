---
title: Validation methodology — Tier-3 (v0.1)
author: Nadia
date: 2026-05-27
version: 0.1
status: populated
decision-id: D-PRODUCT-CONSTRUCTION-SLICES-4-8
summary: Tier-3 validation methodology covering standard textbook models (FX forward IRP, DCF valuation, SA-CCR equivalent). Minimum-viable depth — conceptual soundness + documentation review REQUIRED; no independent re-implementation; benchmark/challenger optional; sample-audit monitoring; revalidation on material methodology change only. Approval expiry 12 months.
decision-required: false
maps-to-decision-id: D-PRODUCT-CONSTRUCTION-SLICES-4-8
tier: 3
inherits-from-policy: model-risk-policy
inherits-from-definitions: _tier-definitions-v0.1.md
last-published: 2026-05-27
owner: Nadia (Independent model-validation engineer)
published-as-event: ValidationMethodologyPublished
---

# Validation methodology — Tier-3 (v0.1)

> **Specification, not tutorial.** Read by Nadia at every Tier-3 review, by Vera as the recon input for the validation-cycle pipeline, by Helena as the BRC challenge reference. The two REQUIRED dimensions and the disposition framework below are the contract. Versioned forward; supersession is a typed `ValidationMethodologyPublished` event with the next version label.

**Authority chain (binds every section).** RAS § B7 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144), row 3 — operational analytics, customer-segmentation, non-decisioning models; SR 11-7 §V (validation — proportionate application) + §VI (documentation), *Guidance on Model Risk Management*, US Federal Reserve / OCC, 2011; SS 1/23 Principle 4 (model documentation and version control — proportionate), Bank of England PRA, 2023; BCBS *Corporate Governance Principles for Banks* (2015 rev. 2024) Principles 6 + 8 (proportionate second-line oversight). Citations not yet in `Regulations/_obligations-register.md` are flagged `[register: route to Mira]`.

**Proportionality principle.** Tier-3 validation is explicitly proportionate. Models in this tier have lower regulatory and commercial consequence than Tier-1 or Tier-2: their outputs are either human-reviewed before action (`_tier-definitions-v0.1.md` §2.3.A) or strictly informational (§2.3.B). The validation discipline reflects this — it is rigorous enough to confirm the model is sound and documented, but does not require the parallel-run, challenger, or full SR 11-7 §VI artefact set that Tier-1 demands.

---

## 1. Scope

### 1.1 Coverage

This methodology applies to every model classified as Tier-3 under RAS § B7 and `Procedures/validation/_tier-definitions-v0.1.md` §1.3. Tier-3 model examples at this bank:

- **FX forward pricing (IRP).** Interest-rate-parity based FX forward computation: `F = S × (1 + r_d)^T / (1 + r_f)^T`. Well-documented, industry-standard, no discretionary calibration. Used internally for forward-rate reference; output is informational (strictly), reviewed by a trader before any execution.
- **DCF valuation.** Discounted-cash-flow valuation of simple fixed-income instruments using a discount curve. Standard textbook approach; limited discretion in the discount-rate selection (pulled from the ZARONIA curve for ZAR-denominated instruments). Output reviewed by product control before any accounting entry.
- **SA-CCR equivalent / simplified CCR.** Standardised-approach counterparty-credit-risk calculation for non-IMM institutions, following BCBS Basel III SA-CCR (`[register: route to Mira — BCBS SA-CCR]`). Deterministic calculation from trade economics; no calibration required. Output consumed by the capital-estimation dashboard; reviewed before any capital-allocation decision.

The Tier-3 boundary: no Tier-1 criterion applies AND no Tier-2 criterion applies AND either all outputs are human-reviewed before action or outputs are strictly informational per `_tier-definitions-v0.1.md` §2.3.

### 1.2 Cadence

- **Pre-deployment.** Internal review by Nadia is sufficient (no full independent validation cycle). Conceptual-soundness review and documentation review (the two REQUIRED dimensions) must be completed before any `ModelValidationApproved` event.
- **12-month revalidation.** Full re-application of this methodology every 12 calendar months from the last `ModelValidationApproved`. Tier-3 revalidation is lighter than Tier-1/Tier-2 — the 12-month cadence compensates for the absence of continuous monitoring (no backtest harness at Tier-3).
- **On material methodology change.** See §5 (revalidation triggers).

---

## 2. Pre-validation requirements

The same preconditions apply as at Tier-2 (§2 of `_methodology-tier-2.md`), proportionately:

1. **`ModelSubmitted` must exist** for the model under review. If absent, Nadia returns the model to Rohan.
2. **`ModelTierClassified` must exist** with `tier: 3`. If Rohan submitted the model without a Nadia-issued tier classification (e.g. classified as Tier-3 inline in the `ModelSubmitted` payload), Nadia issues the `ModelTierClassified` event at the start of the review cycle to formalise the tier attribution.

At Tier-3 the tier-classification step is lighter (Nadia confirms the model satisfies §2.3.A or §2.3.B; no escalation to Helena unless the classification is genuinely ambiguous).

---

## 3. Validation dimensions

Tier-3 validation applies five dimensions. Dimensions 1 and 2 are REQUIRED. Dimensions 3–4 are optional (not required; encouraged where feasible). Dimension 5 (findings register) applies throughout.

### 3.1 Conceptual soundness review (REQUIRED)

Nadia reviews the model's theoretical foundation:

- **Theory matches textbook.** For well-established standard models (IRP, DCF, SA-CCR), Nadia confirms the implementation follows the standard theoretical framework without undocumented departures. Reference: the primary textbook or regulatory specification for the model class (e.g. BCBS Basel III §10 for SA-CCR `[register: route to Mira — BCBS SA-CCR]`; standard IRP formula for FX forward).
- **Calculation logic.** Nadia traces through the calculation logic for a sample of inputs (a small set of representative test cases, not a systematic sensitivity analysis) to confirm the logic is correctly coded.
- **Inputs and outputs.** All inputs are identified and plausible for the model's stated purpose; outputs are in expected ranges for the test cases.

This review is primarily a code-read and spec-read, not a full independent reimplementation. It may be completed in a single session for straightforward textbook models. If Nadia cannot confirm conceptual soundness from the documentation and a code-read alone (e.g. because the model spec is incomplete or the code is opaque), the model is escalated to dimension 3.5 (findings register) with a `blocking` finding.

### 3.2 Documentation review (REQUIRED)

Nadia confirms the model is documented to the minimum standard:

- **Methodology documented.** The model-spec file (`prototype/platform/risk/model-specs/<modelId>-spec.md`) exists and records: purpose; theoretical framework; key assumptions; inputs and outputs with data types and units; version; owner.
- **Inputs and outputs clear.** Data types, units, and value ranges are documented for every input and output.
- **Version control.** The spec version matches the `ModelSubmitted` payload version.

A missing documentation file is a `blocking` finding. Incomplete documentation (missing fields) triggers a `medium` finding per field. Documentation review at Tier-3 does not require the full SR 11-7 §VI artefact set — it requires the model-spec template to be populated.

### 3.3 Sensitivity analysis (optional)

No independent sensitivity analysis is required at Tier-3. Where Nadia judges that the model's output is sensitive to a particular input (e.g. the DCF model's output is sensitive to the discount rate), a lightweight sanity-check perturbation (manual, not systematic) may be performed and noted in the validation report. This is at Nadia's discretion; it does not trigger a finding if omitted.

### 3.4 Benchmark / challenger (optional)

No benchmark or challenger is required at Tier-3. Where a simple benchmark is trivially available (e.g. for an IRP forward, a direct quotient from the market-quoted forward point), Nadia may compare it to the model output as a sanity check. This is at Nadia's discretion; it does not trigger a finding if omitted.

### 3.5 Findings register

All issues identified during the review are raised as `ValidationFindingRaised` events:

| Severity | Definition at Tier-3 | Approval impact |
|---|---|---|
| `blocking` | The finding, if unresolved, means the model output cannot be relied upon for its stated informational purpose. Examples: missing methodology spec; conceptual-soundness failure (model does not follow the textbook it claims to follow); calculation logic error that produces wrong outputs. | **Blocks approval.** Registry invariant enforced. |
| `medium` | Documentation gap; incomplete methodology spec field; minor deviation from the textbook that is explainable and bounded. | **Non-blocking.** Recorded; remediation tracked. |
| `low` | Advisory observation. | **Non-blocking.** Recorded for completeness. |

`high` findings are rare at Tier-3 (the model class has lower commercial consequence by definition). If Nadia identifies a finding that rises to `high` severity at a Tier-3 model, she considers whether the finding implies the model should be reclassified to Tier-2 and escalates to Helena if so.

---

## 4. Disposition

### 4.1 Disposition authority

Nadia holds sole disposition authority at Tier-3. Same disposition events as Tier-1 and Tier-2:

| Disposition | Trigger | Output event |
|---|---|---|
| `approve` | Both REQUIRED dimensions satisfied; no open blocking findings. | `ModelValidationApproved` |
| `withhold` | Any blocking finding open at the conclusion of the review; or inability to confirm conceptual soundness. | `ModelValidationWithheld` |
| `restrict-to-validated-envelope` | Model is sound only for a restricted input range (rare at Tier-3; if triggered, the restriction is documented and the envelope is the input set for which the textbook formula applies cleanly). | `ModelValidationApproved` with `envelope` field; `ProductionUseBoundary` schema (S7-Targeted slice 5) attached. |

### 4.2 Approval expiry

Tier-3 approvals expire **12 months** from the `asOf` date of the `ModelValidationApproved` event. The 12-month window reflects the absence of continuous monitoring at Tier-3 (no backtest harness); the shorter window compensates by ensuring a more frequent review cadence than Tier-2. At the annual revalidation, Nadia reviews only the two REQUIRED dimensions unless the model has changed (in which case, full re-application).

### 4.3 Escalation

Where a finding at Tier-3 implies the model should be reclassified to a higher tier, Nadia escalates to Helena per `_tier-definitions-v0.1.md` §3.4 before issuing a disposition. No other Tier-3 specific escalation triggers; general escalation channels per `_methodology-tier-1.md` §7 apply mutatis mutandis.

---

## 5. Revalidation triggers

A Tier-3 model is revalidated on:

1. **Material methodology change.** Any change to the model's theoretical framework or calculation logic — even in a "standard textbook" model. For example: if the IRP forward formula is modified to incorporate a credit spread adjustment, the change triggers revalidation. Nadia determines materiality; the bar is lower than at Tier-2 because Tier-3 models are expected to remain stable (any departure from the standard textbook approach is inherently material).
2. **Approaching expiry.** Nadia initiates revalidation at least 15 calendar days before the approval's `expiryDate` (shorter lead time than Tier-2 because the review is lighter).
3. **`MethodologyChangeRequested`** — formal notification from Rohan (same trigger as Tier-2; full revalidation required even at Tier-3 when formally requested).

`ModelDriftDetected` is not a standard Tier-3 monitoring event (no continuous backtest at Tier-3). If Rohan emits a `ModelDriftDetected` for a Tier-3 model, Nadia treats it as equivalent to a material methodology change and revalidates.

---

## Procedure-pair binding

This methodology is the substance half of the validation procedure-pair for Tier-3 models (per `Procedures/validation/_index.md`):

- **Cycle** — `Procedures/by-policy/model-validation.md` (`STUB`, owner Helena). The cycle's step for Tier-3 validation-testing calls into this file.
- **Substance** — this methodology defines what "run the Tier-3 review" means: which dimensions are applied; minimum documentation required; disposition authorities.

Until Helena's cycle procedure lands, this methodology runs inline at each Tier-3 review.

---

## Substrate dependencies

| Dependency | Status | Owner | Blocks |
|---|---|---|---|
| `ValidationMethodologyPublished` event type | **Typed** per `prototype/platform/event-store/event-types/model-risk.ts` | Atlas | Methodology publication event |
| `ModelSubmitted`, `ModelTierClassified`, `ModelValidationApproved`, `ModelValidationWithheld`, `ValidationFindingRaised`, `ValidationFindingClosed` | **Typed** per `prototype/platform/event-store/event-types/model-risk.ts` | Atlas | Disposition events |
| `LocalModelRegistry` | **Implemented** per `prototype/platform/model-registry/registry.ts` | Nadia + Rohan | Registry operations |
| Model-spec template | **Landed** per PR #20 (`prototype/platform/risk/model-specs/_template.md`) | Nadia + Rohan | "Model spec read" step (dimension 3.1) |
| BCBS SA-CCR specification | `[register: route to Mira — BCBS SA-CCR]` | Mira | Conceptual-soundness reference for SA-CCR equivalent model |
| Vera continuous-controls integration (sample-audit) | Planned (Wave-4 #11) | Vera | Auto-detection of stale annual reviews |

---

## Authority

Full citation chain:

- **RAS § B7** — `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144. Row 3: Tier-3 model classes; on-material-change revalidation posture. Cited via `ORG-PR-21`.
- **SR 11-7 §V (proportionate application) + §VI (documentation)** — *Guidance on Model Risk Management*, US Federal Reserve / OCC, 2011. Referenced via `ORG-PR-21`.
- **SS 1/23 Principle 4** — proportionate documentation and version control. `[register: route to Mira — SS 1/23]`
- **BCBS *Corporate Governance Principles for Banks*** (2015 rev. 2024) Principles 6 + 8. Referenced via `ORG-GV-10` and `ORG-GV-18`.
- **`_tier-definitions-v0.1.md` §1.3** — Tier-3 definition (operational analytics; customer-segmentation; non-decisioning; standard textbook models; §2.3 human-reviewed or informational criteria).
- **D-PRODUCT-CONSTRUCTION-SLICES-4-8** — CEO session-delegation 2026-05-26; authorises the model-validation sign-offs produced by the seed that references this methodology.
- **CLAUDE.md Principle 2** — single-graph discipline; this methodology is the substance node between RAS §B7 (policy layer) and the typed model-risk events (system capability layer).
- **CLAUDE.md Principle 6** — autonomous by default. The default actor at every review step is `agent:nadia`.

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-27 | Nadia (via Scrooge) | Initial Tier-3 methodology authored as Slice F of validation-methodology library v0. Two REQUIRED dimensions (conceptual soundness + documentation review); sensitivity analysis and benchmark/challenger optional; no independent re-implementation required. Approval expiry 12 months (annual; shorter than Tier-2 biennial to compensate for no continuous monitoring). Revalidation on material methodology change only (not on drift). Pre-validation preconditions: ModelSubmitted + ModelTierClassified must exist. Tier-3 examples: FX forward IRP, DCF valuation, SA-CCR equivalent. Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8; RAS §B7; SR 11-7; SS 1/23 Principle 4; BCBS CG-Principles 6+8. |

—Nadia
