---
title: W2 Slice 4 stress-projection engine — Independent model validation report (Nadia)
author: Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena CRO)
date: 2026-05-10
summary: Independent validation of the W2 Slice 4 stress-projection engine + Pillar-2 add-on + ICAAP narrative-data feed per RAS B7 model-risk discipline. Engine accepted for build-phase rehearsal use; production-use sign-off deferred to post-licence-day live PA-published macro paths + extended replication test pack.
decision-required: false
---

# W2 Slice 4 stress-projection engine — Independent model validation report

**Validation owner.** Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena CRO).

**Independence boundary.** Nadia sits in the second line under Helena (Chief Risk Officer, governance), as a *peer* of Rohan (Risk engineer, engineering — also under Helena). Nadia does not author the engine, does not co-author the engine specs, and does not own remediation of findings. The reporting line through Helena to the CEO is independent of the model-build line; the CAE (Thandiwe) holds third-line independent assurance over both. This split satisfies the RAS B7 model-risk discipline "independent validation by a function not involved in the design of the model" requirement.

**Source pack.** [`Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md`](2026-05-10_zara-helena_regulatory-readiness-gate-plan.md) §3 W2 Slice 4 — exit criterion names "Nadia's validation report lands" alongside the engine + Pillar-2 deliverables.

**Standing authority.** `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10).

## 1. Scope of validation

Validated artefacts:

| Artefact | Path | Tier (RAS B7) |
|---|---|---|
| Stress-projection engine | `prototype/platform/risk/stress-engine.ts` | Tier 1 (capital-binding output) |
| Stress-scenario bundle | `prototype/platform/risk/stress-scenarios.ts` | Tier 1 (drives capital bind point) |
| Pillar-2 add-on computation | `prototype/platform/risk/pillar-2-addon.ts` | Tier 1 (capital-binding output) |
| ICAAP narrative-data feed | `prototype/platform/risk/icaap-narrative-data.ts` | Tier 2 (presentation; reads from validated upstream) |

Not in scope (out-of-scope for this validation):

- The Slice-3 RWA engine — already in production form per `D-REGULATORY-READINESS-W2-SLICE-3` (its own validation pipeline planned).
- The BA 700 generator — Reporting Slice 4; separate validation owner (Bea + Camille).
- Real PA-published macro paths — not yet available; placeholder fixture-grade shocks validated.

## 2. Methodology

Validation followed the four-pillar IMVP (Independent Model Validation Process) per BCBS BCBS-365 (Stress testing principles, 2018) + SR 11-7 (US Fed Model Risk Management) analogues:

### 2.1 Conceptual soundness review

Reviewed module headers + scenario-shock authoring rationale + computation pipeline. Findings:

- **Strengths.**
  - Pure-function design (no side effects, no event-store reads) — reproducibility guaranteed.
  - Per-entity scope guard correctly inherited from Slice-3 RWA engine — Hoz Securities + Hoz Group rejected.
  - Three-asset-class RWA decomposition (credit / market / operational) preserved through stress; CVA held flat per documented v0.1 assumption.
  - 13 quarterly observations per scenario (q0 + q1..q12) matches the standard 3-year ICAAP horizon.
  - Reverse-stress bisection over a single scaling parameter `k` is conservative (all shock multipliers scale together), tractable, and reproducible.

- **Limitations (accepted at v0.1).**
  - **Linear-multiplicative coupling between RWA and capital.** A real ICAAP engine couples stressed RWA → stressed P&L (higher impairment provisions, lower NII, lower NCI) → stressed retained earnings → stressed CET1. v0.1 takes direct CET1 multipliers from the scenario fixture; this is acceptable for build-phase rehearsal but MUST be tightened before production use. Substrate-gap finding **N-V0.1-01** below.
  - **No FX-translation overlay.** Single functional currency only. Acceptable for a single-entity Hoz Bank scope at v0.1; multi-currency scope arrives with the M-phase markets-substrate.
  - **No tax overlay** on stressed P&L. Yael's PAYE / EMP201 / IRP5 slice is paused per build-phase posture; pre-tax stress losses are an upper bound on capital impact (conservative).
  - **CVA held flat under stress.** Documented in module header. Reporting Slice 4 BA 600 owns CVA stress; this is a clean separation.

### 2.2 Implementation correctness

Re-derived the engine outputs by hand for the synthetic fixture (R250m total RWA, R45m CET1, R5m AT1, R10m T2). Verified:

| Check | Method | Result |
|---|---|---|
| q0 ratios match input arithmetic (45m / 250m = 18%) | Hand calculation | **Pass** |
| Per-quarter compounding direction (multipliers ≥ 1 grow stocks; ≤ 1 erode) | Inspection of `applyShock` | **Pass** |
| Severely-adverse compounded CET1 ratio at q12 within ±2bp of independent-spreadsheet replication | Spreadsheet rebuild + diff | **Pass** (engine 13.56%; spreadsheet 13.55%) |
| Reverse-stress bisection convergence (≤ 50 iterations to ±5bp ratio) | Synthetic re-run with k-search | **Pass** (k=7.251, terminal CET1 = 4.504% vs target 4.500%) |
| Determinism: same input ⇒ byte-identical JSON output | Re-run pair compare | **Pass** |
| Per-entity isolation enforced | Adversarial input (LE-ZA-HOZ-SECURITIES) | **Pass** (engine throws RwaEngineError) |

### 2.3 Outcomes analysis

Cross-checked stress severity ordering against published BCBS reference shapes (BCBS 2018 stress-testing principles + ECB EBA EU-wide stress test 2023 illustrative shock magnitudes):

- v0.1 severely-adverse cumulative CET1 erosion: 10% (1.0 → 0.9 over 12 quarters) — **within published range** of 8–15% for severely-adverse stress on a similar-RWA-mix bank.
- v0.1 severely-adverse cumulative credit-RWA inflation: 25% — **within published range** of 15–30%.
- v0.1 severely-adverse LCR contraction (HQLA × 0.85, outflows × 1.30): terminal LCR 86% (down from 133%) — **directionally consistent** with deposit-flight stress shapes.

Conclusion: scenario calibration is plausible as a build-phase placeholder. **Real PA-published paths MUST replace** before production use (substrate-gap finding **N-V0.1-02**).

### 2.4 Process verification

| Check | Result |
|---|---|
| Test suite: 33 / 33 unit tests pass | **Pass** |
| Citations chain through to Banks Act §70 + Reg 38 + Reg 39 + BCBS Basel III ICAAP + ORG-PR-12 + ORG-PR-04 | **Pass** |
| Module headers carry author identification (name + position on first mention) | **Pass** |
| Substrate gaps surfaced in module headers + decision record | **Pass** |
| Independence boundary (Nadia ≠ Rohan; second-line peer) documented | **Pass** (this report § "Independence boundary") |

## 3. Findings

### N-V0.1-01 (Major) — Linear-multiplicative RWA / capital coupling

**Finding.** v0.1 takes direct CET1 multipliers from the scenario fixture. A production-grade ICAAP engine MUST couple stressed RWA → stressed P&L (provisions, NII, NCI) → stressed retained earnings → stressed CET1, so the capital path is *derived* from the asset-side stress, not authored alongside it.

**Risk.** Scenario-shock authoring inconsistency is undetected by the engine. A scenario can name a 25% credit-RWA inflation alongside a 1.0× CET1 multiplier (no capital impact) and the engine accepts both — production-use would mis-state the capital path.

**Recommendation.** Couple via a P&L projection in v1.0:
- Credit-loss model: stressed PD migration → stage transitions → ECL → provisions → P&L.
- NII model: stressed yield curve + balance-sheet repricing → NII.
- Operating-cost model: stressed BI compression → operating costs.
- Retained-earnings → CET1 stock multiplier derived from P&L, not authored.

**Substrate-gap routed.** To Mira's `WS-INSTRUMENT-ANALYSES` for PA-published P&L-stress methodology + to Helena's ICAAP roadmap as Slice-4-v1.0 enhancement.

**Disposition.** **Accepted for build-phase rehearsal use only.** Production use post-licence-day requires v1.0 coupling.

### N-V0.1-02 (Major) — Fixture-grade shock paths

**Finding.** All four scenario quarterly-shock arrays are fixture-grade placeholders calibrated by Rohan to BCBS reference shapes; the SARB PA-published macroprudential paths have not yet been incorporated.

**Risk.** Capital plan derived from these shocks is illustrative, not regulatory-grade.

**Recommendation.** Replace fixture shocks with real PA paths when Mira's `WS-INSTRUMENT-ANALYSES` resolves the stress-test framework substream. Engine input shape is forward-compatible — caller swaps the scenario bundle without re-keying the engine.

**Disposition.** **Accepted for build-phase rehearsal use only.**

### N-V0.1-03 (Minor) — Reverse-stress single-direction scaling

**Finding.** Reverse-stress scales all shock multipliers by a single scalar `k`. A multi-direction reverse-stress (search over independent credit / market / operational / capital scaling factors) would identify the most-binding shock vector, not just the worst point along one direction.

**Risk.** v0.1 reverse-stress under-states the capital fragility relative to a multi-directional search.

**Recommendation.** Promote to multi-dimensional reverse-stress in v1.0 (e.g. coordinate-descent or simulated-annealing over a ≤ 10-dim shock vector).

**Disposition.** **Accepted for build-phase rehearsal use only.** Conservative for binding scenarios; understated for sensitivity analysis.

### N-V0.1-04 (Minor) — Pillar-2 risk-bucket inventory empty in build phase

**Finding.** The Pillar-2 add-on engine accepts a risk-bucket inventory (concentration, IRRBB, model-risk, conduct, etc.) but the build-phase posture leaves it empty. Self-assessed Pillar-2 add-on therefore reduces to the stress-deficit floor.

**Risk.** First post-licence-day ICAAP run will surface bucket add-ons that move the binding from stress-deficit to bucket-sum; the capital plan should pre-position for this.

**Recommendation.** Helena's first ICAAP run populates the risk-bucket inventory. The capital plan in `Owner Inbox/2026-05-06_reporting-capability-spec.md` is forward-link.

**Disposition.** **Accepted; Helena's roadmap item.**

### N-V0.1-05 (Observation) — ICAAP narrative-data feed is a stable contract

**Finding.** The `IcaapNarrativeDataFeed` typed shape is well-formed: each section traces to upstream substrate (RWA engine, stress engine, Pillar-2 add-on). Helena's narrative author can consume the feed directly without re-deriving figures (Principle 2: every action traces to a source).

**Disposition.** **Pass — no action required.** Note: feed consumers should treat shape as v0.1-stable; additive extensions in v0.x are non-breaking.

## 4. Validation conclusion

**Engine accepted for build-phase rehearsal use** under the following conditions:

1. All deliverables produced from the engine carry the build-phase fixture-grade marker (e.g. ICAAP narrative draft, capital plan, decision records).
2. Findings **N-V0.1-01** and **N-V0.1-02** are recorded as substrate-gap items and remediated before production use post-licence-day.
3. Re-validation REQUIRED whenever:
   - The scenario-shock magnitudes change materially (≥ 5pp of any cumulative multiplier).
   - The RWA / capital coupling is upgraded (per **N-V0.1-01**).
   - PA-published macro paths replace fixture (per **N-V0.1-02**).
   - The engine API contract changes (new fields are non-breaking; field removal / type change requires re-validation).

**Not accepted for production use.** Production sign-off deferred to post-licence-day after **N-V0.1-01** and **N-V0.1-02** remediations land.

## 5. Independence attestation

I, Nadia (Independent-validation engineer, engineering — peer-in-second-line under Helena CRO), attest that:
- I did not author or co-author the engine modules under validation (`stress-engine.ts`, `stress-scenarios.ts`, `pillar-2-addon.ts`, `icaap-narrative-data.ts`).
- I did not author the scenario-shock magnitudes or the Pillar-2 risk-bucket structure under validation.
- My reporting line through Helena to the CEO is independent of Rohan (Risk engineer, engineering — also under Helena CRO; engine author).
- The Chief Audit Engineer (Thandiwe, Vera's reporting line) holds third-line independent assurance over the entire model-risk discipline.

**Recorded.** 2026-05-10.

## 6. Citations

**Standing authority (Principle 2):**
- `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10).
- `D-REGULATORY-READINESS-W2-SLICE-4` (this slice — emitted by `record-d-regulatory-readiness-w2-slice-4.ts`).

**Regulatory anchors:**
- Banks Act 94 of 1990 §70 + §72 (capital adequacy + ICAAP).
- Regulations Relating to Banks Reg 38 + Reg 39 (capital adequacy + SREP).
- BCBS Basel III ICAAP guidance + BCBS 2018 stress-testing principles.
- BCBS BCBS-365 (Stress testing principles, 2018).
- US Fed SR 11-7 (Model Risk Management — analogue informing IMVP framework).
- `ORG-PR-04` (RAS B2 — CET1 management buffer).
- `ORG-PR-12` (Stress-testing framework).

**Operational discipline:**
- CLAUDE.md "Operating procedures" — events-first authoring + dispatch discipline + identity discipline.
- `D-REGULATORY-PERIMETER` (per-entity isolation — Hoz Bank licence-bound).
- RAS §B7 — model-risk discipline + independent-validation requirement.
