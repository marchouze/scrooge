# Model-Registry Scope-Closure — Slice 2 (IFRS 9 ECL suite governed)

> **Governance document** | Author: Helena (Chief Risk Officer, governance) | Owner-policy: RISK-MRP-01 (Model Risk Policy v1) §5 | Date: 2026-05-29
> **Authority:** D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation, 2026-05-29). Backing brief: `brief:helena:model-registry-scope-closure-slice-2-ifrs-9-ecl-:2026-05-29`. Predecessor: Slice 1 (PR #886, merged) landed `model:rwa-sa-v1` + the `rwa` CALC_BINDINGS entry.
> **Status:** Slice 2 of N — IFRS 9 ECL suite registered, governed and bound. Remaining slices (IRRBB, VaR/SVaR/ES, CVA) sequenced below.

This document is a *render* of a `RecordFiled` event in the Documents register (Principle 1 — events are the only source of truth). The markdown is never the canonical artefact; the event is. Identity discipline per CLAUDE.md — every agent reference pairs name + position on first mention.

---

## 1. The gap this slice closes

`Policies/model-risk-policy-v1.md` (RISK-MRP-01) §5.2 mandates the IFRS 9 ECL governance suite as **six Tier-1 models**: staging (SICR), PD, LGD, EAD, macroeconomic overlay, and the ECL computation engine. None were registered in the model registry. Under D-TRUSTED-FIGURES-PROGRAM-V1 every *surfaced* figure must trace to a registered + approved model; the IFRS 9 impairment provision is a published-financial-statement figure and a regulatory-capital driver (the provision adjusts CET1), so an ungoverned ECL is a live control weakness.

The bank holds debt instruments (e.g. SAGB) that attract a 12-month Stage-1 ECL **even on SA local-currency sovereign exposure** — IFRS 9 has no sovereign carve-out. This is a real build-phase obligation, not a licence-day-only concern.

---

## 2. What Slice 2 lands (this PR)

### 2.1 Six ECL models registered, tier-classified Tier-1, validated and approved

Added to `prototype/seeds/models/calc-model-seed.ts` following the established idempotent register → classify-tier → independently-validate → approve sequence. Rohan (Risk systems engineer, engineering) submits as first line; Nadia (Independent-validation engineer) classifies the tier and approves as second line. Methodology accountability sits with Helena (CRO) per RISK-MRP-01 §3.4; Camille (Chief Financial Officer, governance) confirms accounting-treatment consistency for the ECL suite.

| Model | modelId | Tier | Methodology owner |
|---|---|---|---|
| IFRS 9 staging / SICR | `model:ecl-staging-ifrs9-v1` | 1 | Helena (CRO); Camille (CFO) confirms accounting |
| IFRS 9 12-month PD | `model:ecl-pd-ifrs9-v1` | 1 | Helena (CRO) |
| IFRS 9 LGD | `model:ecl-lgd-ifrs9-v1` | 1 | Helena (CRO) |
| IFRS 9 EAD | `model:ecl-ead-ifrs9-v1` | 1 | Helena (CRO) |
| IFRS 9 macroeconomic overlay | `model:ecl-macro-overlay-ifrs9-v1` | 1 | Helena (CRO); Camille (CFO) confirms |
| IFRS 9 ECL computation engine | `model:ecl-engine-ifrs9-v1` | 1 | Helena (CRO); figure owned by Camille (CFO) |

**Tier rationale (RISK-MRP-01 §2.1):** IFRS 9 ECL models affect published financial statements and regulatory capital — unambiguously Tier-1 under SR 11-7 §V, requiring full independent validation. The staging model is the most judgement-intensive component (it determines 12-month vs lifetime ECL); the ECL engine produces the impairment provision booked to the AFS.

### 2.2 A real (not hollow) ECL engine bound in `CALC_BINDINGS`

Added the `ecl` binding to `prototype/platform/model-registry/calculation-binding.ts`: figure "IFRS 9 Expected Credit Loss", `model:ecl-engine-ifrs9-v1` v1.0.0, owning agent "Camille (Chief Financial Officer)" (the impairment figure owner), output unit `ZAR-minor`, citations `[D-TRUSTED-FIGURES-PROGRAM-V1, D-MODEL-REGISTRY-SCOPE-CLOSURE-V1, IFRS-9-B5.5, BANKS-ACT-94-1990]`.

The engine (`prototype/platform/accounting/ecl-engine.ts`, `computeStage1Ecl`) computes the **12-month Stage-1 ECL = Σ (PD × LGD × EAD)** over the actual debt book:

- **EAD** is folded per ISIN from the store's `BondTradeExecuted` events (the bond-accounting schema the event store validates): EAD = |net nominal × latest clean price / 100|, in minor units. Net-flat positions are excluded.
- **PD** (12-month, point-in-time) and **LGD** are build-phase placeholder parameters by risk bucket (sovereign-bond, corporate-bond, covered-bond, debt-other), owned by `model:ecl-pd-ifrs9-v1` / `model:ecl-lgd-ifrs9-v1`. SA sovereign carries a non-zero 12-month PD (10 bps) — no sovereign carve-out.
- **Staging** is delegated to the existing `assessIfrs9Stage()` engine (`model:ecl-staging-ifrs9-v1`); the bound figure surfaces the Stage-1 slice.

**NO SILENT ZEROS.** When the debt book is empty (the current build-phase state — no bonds are booked in the live store) the engine returns `status: "degraded"` with an explicit reason ("no in-scope debt exposures — ECL is 0 by absence of exposure, NOT a computed figure"). The server's `emitCalculationProvenance()` emits a `CalculationPerformed{status:"degraded", output:null}` plus a `SubstrateAlert{integrity}`, so the figure renders "value unavailable" on the `/api/data-failures` banner — never an unexplained 0.

### 2.3 Recon gates stay green

- `recon:calc-model-binding` — `ecl` is now a fifth bound figure tracing to an approved model.
- `recon:calc-no-silent-zero` — the ECL engine uses `requireWeight` for every PD/LGD lookup (an unknown risk bucket throws, never a silent default).
- `recon:model-risk-gap-inventory` (product-keyed, non-blocking) — unaffected.
- `recon:expected-event-watchdog` — automatically expects a `CalculationPerformed` for the new `ecl` binding (derived from `CALC_BINDINGS`); the boot emitter satisfies it.

---

## 3. Substrate gap surfaced (not hidden)

**Bond-event schema duality.** The store registers `BondTradeExecuted` against the bond-accounting schema (`platform/event-store/event-types/bond-accounting.ts` — flat fields: `bondIsin`, `nominalMinor`, `cleanPricePercent`), but the `unified-position` projection (`platform/projections/markets/unified-position.ts`) reads a *different* CDM payload shape (`nominalAmount.amountMinor`, `cleanPrice`, `instrumentId`) from `markets/cdm/fixed-income.ts`. Only the bond-accounting registry is wired into the store, so a store-valid `BondTradeExecuted` event does **not** populate the unified-position bond rows. The ECL engine therefore reads EAD directly from the bond-accounting event stream (the reachable, store-valid source) rather than the unified-position projection. The schema duality is a pre-existing substrate gap (out of scope for this slice) — flagged here for a later reconciliation that unifies the two `BondTradeExecuted` payload definitions.

---

## 4. Remaining-slice roadmap

| Slice | Scope | Owning seat | Sequencing note |
|---|---|---|---|
| ✅ **Slice 1 — RWA** | Risk-Weighted Assets (standardised) | Helena (CRO) | Landed (PR #886). |
| ✅ **Slice 2 — IFRS 9 ECL suite** | staging, PD, LGD, EAD, macro overlay, ECL engine | Helena (CRO); Camille (CFO) confirms accounting | **This PR.** |
| **Slice 3 — IRRBB** | Economic Value of Equity (EVE), Net Interest Income (NII) sensitivity | Helena (CRO) | Behavioural-assumption-heavy; Tier-1. Feeds BA 330 / ICAAP IRRBB. |
| **Slice 4 — Market-risk VaR suite** | VaR, Stressed VaR (SVaR), Expected Shortfall (ES) | Helena (CRO) | Tier-1. Adds the internal-measure VaR family for RAS MR limits + ICAAP. |
| **Slice 5 — CVA** | Credit Valuation Adjustment | Helena (CRO) | Tier-1. Closes the zero placeholder in the RWA engine (`cvaRwaMinor`); BA 600 owns the computation. |
| Deferred — ICAAP P2A | Pillar-2A capital self-assessment model | Helena (CRO) | Activates at ICAAP rehearsal. |

**Excluded entirely (prescribed inputs, not bank models):** BA 325 haircuts, SA-CCR supervisory factors, SA standardised risk weights. These are regulator-prescribed constants the engines consume, not methodologies the bank owns, calibrates or validates.

---

## 5. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-29 | Helena (Chief Risk Officer, governance) | Slice 2 of D-MODEL-REGISTRY-SCOPE-CLOSURE-V1. Registered six Tier-1 IFRS 9 ECL models (staging/PD/LGD/EAD/macro-overlay/engine); added the `ecl` CALC_BINDINGS entry bound to `model:ecl-engine-ifrs9-v1`; built a 12-month Stage-1 ECL engine over the debt book with a loud `degraded` status (no silent zeros). Surfaced the bond-event schema-duality substrate gap. Remaining slices: IRRBB (3), VaR/SVaR/ES (4), CVA (5). Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1. |
