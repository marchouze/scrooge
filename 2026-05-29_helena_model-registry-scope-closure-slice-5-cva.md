---
title: "Model-Registry Scope-Closure — Slice 5 (CVA governed; workstream close)"
author: "Helena (Chief Risk Officer, governance)"
date: "2026-05-29"
category: "cro-model-registry-scope-closure"
workstream: "WS-MODEL-REGISTRY-SCOPE-CLOSURE"
authority:
  - "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1"
  - "D-TRUSTED-FIGURES-PROGRAM-V1"
  - "D-RMS-PHASE-3"
citations:
  - "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1"
  - "D-TRUSTED-FIGURES-PROGRAM-V1"
  - "BCBS-D424"
  - "RISK-MRP-01"
---

# Model-Registry Scope-Closure — Slice 5: CVA governed (workstream close)

**Author:** Helena (Chief Risk Officer, governance) — model-risk-policy owner; counterparty credit risk / CVA is a CRO-owned risk measure.
**Build:** Rohan (Risk systems engineer, engineering). **Validation:** Nadia (Independent-validation engineer). **Credit-spread inputs:** Ravi (market-data infrastructure engineer).
**Authority:** D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation, 2026-05-29).

## What landed

This is the **final slice** of WS-MODEL-REGISTRY-SCOPE-CLOSURE. It registers and governs the counterparty Credit Valuation Adjustment (CVA) and binds a governed `cva` figure. With it, **every model class declared in RISK-MRP-01 (Model Risk Policy v1) §1.1 is now registered, approved, and — where surfaced — bound in `CALC_BINDINGS`.** The workstream closes.

CVA was previously ungoverned: it existed only as an optional passthrough input (`cvaRwaMinor`) to the `rwa` binding, where BA 600 owns the regulatory RWA charge. There was no governed CVA *figure* and no registered CVA model. Under D-TRUSTED-FIGURES-PROGRAM-V1 a surfaced figure must trace to a registered + approved model — this slice closes that control gap. The `rwa` binding's `cvaRwaMinor` passthrough is untouched (BA 600 owns the RWA charge; this slice adds the *valuation* figure, separate).

## Models registered (Tier-1)

Both registered idempotently via the governed flow (Rohan submits → Nadia tier-classifies → Nadia approves) in `seeds/models/calc-model-seed.ts`:

1. **`model:cva-exposure-epe-v1`** — CVA exposure / EPE sub-model. Maps the live uncollateralised OTC derivative book (IRS + FX forward/swap; FX spot excluded as settlement-not-term risk) to a per-counterparty netted positive EAD = `max(0, Σ current MTM) + Σ PFE add-on` (one netting set per counterparty).
2. **`model:cva-engine-v1`** — counterparty CVA engine. Aggregates the standardised CVA `= Σ_counterparty LGD × EAD × PD × discount` (no-hedge, no-correlation sum — the build-phase analogue of Basel BA-CVA, BCBS d424 MAR50, and IFRS 13 fair-value CVA). Surfaced figure, calcKey `cva`.

Both are Tier-1 under SR 11-7 §V and RISK-MRP-01 §2 (CVA feeds the counterparty-credit-risk appetite and the BA-CVA / IFRS 13 fair-value adjustment). Methodology accountability and figure ownership both sit with **Helena (CRO)** — CVA is CRO-owned per the decision-authority routing table.

## Methodology (chosen + documented)

Per counterparty: `CVA_cp = LGD × EAD_cp × PD_cp × discount`, summed across counterparties.

- **EAD** — current positive exposure (positive IRS MTM only; negative MTM is the counterparty's exposure to us, not ours) plus a documented notional-fraction PFE add-on (`IRS_PFE_ADDON_FRACTION` 0.5%, `FX_PFE_ADDON_FRACTION` 1%). The SA-CCR supervisory factors that would normally drive the add-on are **prescribed inputs, explicitly out of scope** (Slice-5 exclusions).
- **PD** — derived from a live counterparty credit spread (Ravi: `credit-spread:<partyId>` / `cds:<partyId>`) via the credit-triangle `PD ≈ 1 − exp(−s·T / LGD)` where one exists; otherwise a documented standardised weight by counterparty class (`FALLBACK_PD_BY_CLASS`: bank 50 bps, sovereign 30 bps, corporate 200 bps, other 300 bps) via a **loud `requireWeight` lookup** — an unknown class fails, never a silent 0% PD.
- **LGD** — Basel-CVA standard 60% for senior uncollateralised exposure (`CVA_LGD_DEFAULT`).
- **discount** — single build-phase factor 0.97 (`CVA_DISCOUNT_FACTOR`); a full discounted-EPE profile is a licence-day extension.

## No silent zeros

The figure surfaces only with genuine uncollateralised OTC exposure AND a resolvable PD for every exposed counterparty. Otherwise a loud, reasoned `status`:

- **`no-otc-exposure`** — no uncollateralised positive OTC exposure (no open IRS / FX-forward / FX-swap positions, or all net-negative MTM). CVA is 0 by absence of exposure, surfaced loudly.
- **`insufficient-credit-inputs`** — exposure exists but a counterparty has neither a live spread nor a resolvable fallback weight. Degraded, output null, surfaced on `/api/data-failures`.
- **`computed`** — genuine exposure + resolvable PD → real figure with provenance.

## Live-vs-degraded at filing

At this build-phase derive, the bank's OTC term book has no booked IRS revaluation MTM stream and no open FX forward/swap positions carrying uncollateralised positive exposure (the populated trading book is FX **spot**, which is excluded). The CVA figure therefore degrades **loudly** to **`no-otc-exposure`** — a governed, explicit "no counterparty credit risk to value" state surfaced on the data-failure banner, **never a silent 0**. When term OTC positions (IRS with revaluation, or FX forwards/swaps) land, the engine computes a live number against the counterparty credit-spread inputs without any code change — the path is exercised by the unit tests.

## Workstream close

WS-MODEL-REGISTRY-SCOPE-CLOSURE is **complete**. Predecessor slices: RWA (#886), ECL suite (#888), IRRBB EVE+NII (#891), market-risk VaR/SVaR/ES (#893). With CVA landed, all RISK-MRP-01 §1.1 model classes are registered + bound and `CALC_BINDINGS` is fully coherent with the policy's declared model scope.

*This document is a render of the canonical `RecordFiled` event (Principle 1).*
