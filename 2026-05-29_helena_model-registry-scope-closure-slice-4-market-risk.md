---
title: "Model-Registry Scope-Closure — Slice 4 (market-risk VaR/SVaR/ES governed)"
author: "Helena (Chief Risk Officer, governance)"
date: "2026-05-29"
category: "cro-model-registry-scope-closure"
authority:
  - "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1"
  - "D-TRUSTED-FIGURES-PROGRAM-V1"
citations:
  - "RISK-MRP-01"
  - "BCBS-D457"
  - "SR-11-7"
classification: "governance-seat"
---

# Model-Registry Scope-Closure — Slice 4: market-risk VaR / SVaR / ES

**Author:** Helena (Chief Risk Officer, governance) — model-risk-policy owner; market-risk figures are CRO-owned.
**Authority:** D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation, 2026-05-29).

## The gap

`Policies/model-risk-policy-v1.md` (RISK-MRP-01) §1.1 declares market-risk models — Value-at-Risk (VaR), Stressed VaR (SVaR) and Expected Shortfall (ES) — in scope of the Model Risk Policy. Until this slice they were **ungoverned and uncomputed**: no registered, owned, validated model produced them, and no figure was surfaced. Under D-TRUSTED-FIGURES-PROGRAM-V1 every surfaced regulatory figure must trace to an approved model; an absent market-risk measure is a live control weakness, because market risk feeds the Risk Appetite Statement (RAS) market-risk limits and potential Pillar-1 / Pillar-2 market-risk capital.

Unlike the banking-book figures closed in Slices 1–3 (RWA / ECL / IRRBB), the **trading book is not empty** — FX positions are live — so these measures are designed to compute *live* rather than degrade by absence, subject to sufficient market-data return history.

## What landed

### Four Tier-1 models registered, tier-classified and validated (Nadia)

| modelId | Figure | Standard |
|---|---|---|
| `model:market-risk-pnl-sensitivity-v1` | Risk-factor exposure vector (live trading book → net ZAR per factor) | RISK-MRP-01 §1.1 |
| `model:market-risk-var-hs-v1` | VaR — 99% 1-day, historical simulation | Basel-2.5 / BCBS d457 |
| `model:market-risk-svar-hs-v1` | Stressed VaR — 99% 1-day, stress-calibrated | Basel-2.5 MAR |
| `model:market-risk-es-hs-v1` | Expected Shortfall — 97.5% 1-day | BCBS d457 / MAR33 |

All four are **Tier-1** under SR 11-7 §V and RISK-MRP-01 §2: a misstated market-risk measure misstates the RAS market-risk limit utilisation and the market-risk capital self-assessment. Full independent validation applies. Methodology accountability **and** figure ownership both sit with Helena (CRO) — market-risk figures are CRO-owned per the decision-authority routing table. The historical return window is supplied by Ravi (market-data infrastructure engineer); the engine was built by Rohan (Risk systems engineer) and validated by Nadia (Independent-validation engineer).

### Methodology (chosen + documented)

- **VaR** — historical simulation, 99% confidence, 1-day holding period, 250-business-day observation window (the Basel-2.5 / FRTB lookback). Historical simulation is elected over parametric / Monte-Carlo for the build phase: it makes no distributional assumption and captures fat tails directly from realised returns — the most defensible method for a small book with short history.
- **SVaR** — the same 99% 1-day historical-simulation VaR calibrated to a window of significant financial stress (Basel-2.5 MAR / FRTB ES-stress-period analogue). SVaR ≥ VaR is enforced. Until a multi-year return history exists the stress window is the full available window.
- **ES** — 97.5% 1-day Expected Shortfall (the FRTB d457 / MAR33 prescribed quantile): the mean loss in the tail beyond the 97.5% quantile. A coherent risk measure that captures the magnitude of tail losses.

### Three bound figures + real engines

`var`, `svar`, `es` added to `CALC_BINDINGS` (owningAgent "Helena (Chief Risk Officer)", unit "ZAR-minor"). They consume the live trading-book exposure vector and the per-risk-factor historical return window. The risk-factor abstraction is data-driven: bonds, IRS and equity legs map to their own factors as their price-history feeds land, with no engine change.

### No silent zeros

The suite surfaces a real figure only when there are live positions **and** a sufficient return window for every risk factor. Otherwise it surfaces a loud, reasoned status (`no-positions` or `insufficient-history`) via the data-failures substrate, output null — never an unexplained 0. A VaR derived from a too-short window would understate tail risk; refusing to surface it is the control.

## Final-slice note

This is the **final slice** of D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 within market-risk's standard suite. **CVA is Slice 5** (dispatched separately) and is out of scope here. The prescribed FRTB standardised-approach inputs (risk-weight buckets, correlation parameters), BA 325 haircuts, SA-CCR factors and SA risk-weight tables are regulatory-prescribed constants, not bank models, and are intentionally excluded from model-registry scope.
