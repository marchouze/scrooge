# Model-Registry Scope-Closure Plan

> **Governance document** | Author: Helena (Chief Risk Officer, governance) | Owner-policy: RISK-MRP-01 (Model Risk Policy v1) | Date: 2026-05-29
> **Authority:** D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation, 2026-05-29). Backing brief: `brief:helena:model-registry-scope-closure-slice-1-inventory-t:2026-05-29`.
> **Status:** Slice 1 of N — inventory + Tier-1 RWA governed. Remaining slices sequenced below.

This document is a *render* of a `RecordFiled` event in the Documents register (Principle 1 — events are the only source of truth). The markdown is never the canonical artefact; the event is. Identity discipline per CLAUDE.md — every agent reference pairs name + position on first mention.

---

## 1. The gap this plan closes

`Policies/model-risk-policy-v1.md` (RISK-MRP-01) §1.1 and §5 declare roughly fifteen model classes in scope — market-risk VaR/SVaR/Expected Shortfall; credit PD/LGD/EAD; the full IFRS 9 ECL suite (staging, PD, LGD, EAD, macroeconomic overlay, ECL engine); capital/RWA models; ICAAP/ILAAP stress models; derivative and bond pricing engines; and BA-return computation logic where it involves model-based estimation.

The operative model registry, by contrast, holds only **three pricing models** (`model:sagb-dcf-v1`, `model:zaronia-ois-irspv-v1`, `model:fx-forward-irp-v1`) plus the three regulatory-metric calc models seeded under the Trusted-Figures Program (`model:lcr-ba325-v1`, `model:nsfr-ba325-v1`, `model:capital-cet1-ba700-v1`). `prototype/platform/model-registry/calculation-binding.ts` `CALC_BINDINGS` governs only LCR, NSFR and CET1.

**The acute weakness:** RWA (`model:rwa-sa-v1`) is referenced as an *input* to the CET1 binding's `inputContract` (`rwaMinor`, "expectedFrom: RWA engine (model:rwa-sa-v1)") but is **not itself a governed figure** — there was no `rwa` calcKey, no registered model, no approval. Under D-TRUSTED-FIGURES-PROGRAM-V1, `recon:calc-model-binding` requires every *surfaced* figure to trace to a registered + approved model. RWA is the direct denominator of every capital ratio the bank reports; deriving it from an ungoverned engine is a live control weakness. ECL, IRRBB, VaR and CVA are entirely absent from the registry — a coherence gap between the stated policy scope and the executable substrate.

This plan establishes the authoritative inventory of every policy-declared model class, records its current registry status, assigns each a target build slice and owning governance seat, and lands the first slice (Tier-1 RWA) in code.

---

## 2. Authoritative model-class inventory

Every model class named in RISK-MRP-01 §1.1 / §5. Columns: **Registered?** = a `ModelSubmitted` event exists in the registry; **Bound?** = a `CALC_BINDINGS` entry surfaces the figure under `recon:calc-model-binding`; **Tier** = SR 11-7 / RISK-MRP-01 §2 tier; **Owning seat** = methodology-accountable governance seat per the decision-authority routing table (CRO for RWA / risk; CFO for liquidity / capital-ratio calibration); **Target slice** = build sequencing.

| Model class | Example modelId | Registered? | Bound in CALC_BINDINGS? | Tier | Owning governance seat | Target build slice |
|---|---|---|---|---|---|---|
| Liquidity Coverage Ratio | `model:lcr-ba325-v1` | Y | Y (`lcr`) | 1 | Camille (CFO) | ✅ Trusted-Figures (landed) |
| Net Stable Funding Ratio | `model:nsfr-ba325-v1` | Y | Y (`nsfr`) | 1 | Camille (CFO) | ✅ Trusted-Figures (landed) |
| CET1 capital ratio | `model:capital-cet1-ba700-v1` | Y | Y (`capital-cet1`) | 1 | Camille (CFO) | ✅ Trusted-Figures (landed) |
| **Risk-Weighted Assets (standardised)** | **`model:rwa-sa-v1`** | **Y** | **Y (`rwa`)** | **1** | **Helena (CRO)** | **✅ Slice 1 (this PR)** |
| SAGB DCF bond pricing | `model:sagb-dcf-v1` | Y | N (NPA-attested, not a surfaced regulatory figure) | 3 | Helena (CRO) | ✅ Product-construction (landed) |
| ZARONIA OIS / IRS PV | `model:zaronia-ois-irspv-v1` | Y | N (NPA-attested) | 2 | Helena (CRO) | ✅ Product-construction (landed) |
| FX-forward IRP pricing | `model:fx-forward-irp-v1` | Y | N (NPA-attested) | 3 | Helena (CRO) | ✅ Product-construction (landed) |
| IFRS 9 ECL — staging (SICR) | `model:ifrs9-staging-v1` (planned) | N | N | 1 | Helena (CRO), Camille (CFO) confirms accounting | Slice 2 — ECL suite |
| IFRS 9 ECL — PD | `model:ifrs9-pd-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 2 — ECL suite |
| IFRS 9 ECL — LGD | `model:ifrs9-lgd-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 2 — ECL suite |
| IFRS 9 ECL — EAD | `model:ifrs9-ead-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 2 — ECL suite |
| IFRS 9 ECL — macro overlay | `model:ifrs9-macro-overlay-v1` (planned) | N | N | 1 | Helena (CRO), Camille (CFO) confirms | Slice 2 — ECL suite |
| IFRS 9 ECL — computation engine | `model:ifrs9-ecl-engine-v1` (planned) | N | N | 1 | Helena (CRO), Camille (CFO) confirms | Slice 2 — ECL suite |
| IRRBB — Economic Value of Equity (EVE) | `model:irrbb-eve-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 3 — IRRBB |
| IRRBB — Net Interest Income (NII) | `model:irrbb-nii-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 3 — IRRBB |
| Market risk — VaR | `model:var-hs-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 4 — market-risk VaR suite |
| Market risk — Stressed VaR (SVaR) | `model:svar-hs-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 4 — market-risk VaR suite |
| Market risk — Expected Shortfall (ES) | `model:es-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 4 — market-risk VaR suite |
| Credit Valuation Adjustment (CVA) | `model:cva-v1` (planned) | N | N | 1 | Helena (CRO) | Slice 5 — CVA |
| Operational-risk capital (BIA / TSA / SMA-BIC) | folded into `model:rwa-sa-v1` (OPE25 component) | Y (within RWA) | Y (within `rwa`) | 1 | Helena (CRO) | ✅ Slice 1 (within RWA) |
| ICAAP Pillar-2A self-assessment | `model:icaap-p2a-v1` (planned) | N | N | 1 | Helena (CRO) | Deferred — ICAAP rehearsal |

---

## 3. Explicitly NOT models (prescribed inputs — no bank assumption)

Per RISK-MRP-01 §1.2 (out of scope: pure aggregations with no statistical assumption) and the modelling principle that a *regulator-prescribed constant* is not a bank model, the following are **intentionally excluded** from the model registry. They are inputs the engines consume, not methodologies the bank owns, calibrates, or validates:

- **SA standardised risk-weight tables** (CRE20 / Reg 38 risk-weights by counterparty type, rating bucket, LTV bucket). Prescribed by the regulator; the RWA engine looks them up, it does not estimate them.
- **BA 325 HQLA haircuts** (Level-1 / Level-2A / Level-2B haircut percentages and caps). Prescribed; the LCR engine applies them.
- **SA-CCR supervisory factors** (asset-class supervisory factors and correlation parameters for counterparty-credit-risk EAD). Prescribed by BCBS/PA; consumed, not modelled.
- **BCBS OPE25 BIC marginal coefficients** (0.12 / 0.15 / 0.18 piecewise thresholds). Prescribed; the operational-RWA component applies them.

These appear in the substrate as constants / lookup tables (e.g. `standardisedRiskWeight`, `computeBic`), governed by the financial-constants coverage gate, not by the model registry. Their *application* is governed (it is part of `model:rwa-sa-v1`); the constants themselves are not separate models.

---

## 4. What Slice 1 lands (this PR)

1. **`model:rwa-sa-v1` registered, tier-classified Tier-1, independently validated and approved.** Added to `prototype/seeds/models/calc-model-seed.ts` following the existing idempotent register → classify-tier → approve-validation sequence. Rohan (Risk systems engineer, engineering) submits as first line; Nadia (Independent-validation engineer) classifies the tier and approves as second line. `checkModelApproved("rwa")` now returns ok.
2. **`rwa` binding added to `CALC_BINDINGS`** in `prototype/platform/model-registry/calculation-binding.ts`: figure "Risk-Weighted Assets", `model:rwa-sa-v1` v1.0.0, owning agent "Helena (Chief Risk Officer)", output unit `ZAR-minor`, input contract = the three RWA engine components (credit / market / operational RWA, all required) + CVA passthrough (optional, BA 600 owns), citations `[D-TRUSTED-FIGURES-PROGRAM-V1, D-MODEL-REGISTRY-SCOPE-CLOSURE-V1, BANKS-ACT-94-1990, BA-700]`.
3. **`recon:calc-model-binding` stays green** — RWA is now a fourth bound figure tracing to an approved model. **`recon:model-risk-gap-inventory`** (product-keyed, non-blocking) is unaffected.

**Tier rationale for RWA (RISK-MRP-01 §2):** RWA is the direct denominator of every regulatory capital ratio (CET1, Tier-1, total capital) and feeds the BA 700 statutory capital-adequacy return to the Prudential Authority. A misstated RWA misstates every capital ratio and the RAS capital limits derived from them. This is the highest-consequence capital figure the bank computes — unambiguously Tier-1, requiring full independent validation.

---

## 5. Remaining-slice roadmap

| Slice | Scope | Owning seat | Sequencing note |
|---|---|---|---|
| **Slice 2 — IFRS 9 ECL suite** | staging (SICR), PD, LGD, EAD, macroeconomic overlay, ECL computation engine | Helena (CRO), with Camille (CFO) confirming accounting treatment | Largest slice; governed by RISK-MRP-01 §5. Activates with credit-portfolio commencement; build-phase rehearsal acceptable. Each sub-model registered + validated separately; the ECL engine binds as a surfaced figure. |
| **Slice 3 — IRRBB** | Economic Value of Equity (EVE), Net Interest Income (NII) sensitivity | Helena (CRO) | Behavioural-assumption-heavy; Tier-1. Feeds BA 330 / ICAAP IRRBB. |
| **Slice 4 — Market-risk VaR suite** | VaR, Stressed VaR (SVaR), Expected Shortfall (ES) | Helena (CRO) | Tier-1. Pre-FRTB market RWA already inside `model:rwa-sa-v1`; this slice adds the internal-measure VaR family for RAS MR limits + ICAAP. |
| **Slice 5 — CVA** | Credit Valuation Adjustment | Helena (CRO) | Tier-1. Currently a zero placeholder in the RWA engine (`cvaRwaMinor`); BA 600 owns the computation. Registering + binding it closes the placeholder. |
| Deferred — ICAAP P2A | Pillar-2A capital self-assessment model | Helena (CRO) | Activates at ICAAP rehearsal. |

Each slice follows the same pattern Slice 1 establishes: register → tier-classify → independently validate → approve in the seed; add a `CALC_BINDINGS` entry for any *surfaced* figure; keep `recon:calc-model-binding` green.

---

## 6. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-29 | Helena (Chief Risk Officer, governance) | Initial scope-closure plan. Authoritative inventory of all RISK-MRP-01 §1.1/§5 model classes with registry status, tier, owning seat, target slice. Slice 1 lands Tier-1 `model:rwa-sa-v1` (registered + validated + approved + `rwa` CALC_BINDINGS entry). Explicit out-of-scope carve-out for prescribed inputs (SA risk-weight tables, BA 325 haircuts, SA-CCR factors, OPE25 BIC coefficients). Remaining-slice roadmap: ECL suite (2), IRRBB (3), VaR/SVaR/ES (4), CVA (5). Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1. |
