---
title: "FX Spot — model-risk gate attestation"
author: Nadia (quantitative risk methodology engineer, engineering)
date: 2026-05-12
decision-required: false
product: prd:bank:fx:fx-spot-zar-usd
gate: model-risk
result: cleared
---

# FX Spot — model-risk gate attestation

**Author:** Nadia (quantitative risk methodology engineer, engineering)
**Date:** 2026-05-12
**Product:** `prd:bank:fx:fx-spot-zar-usd`
**Gate:** model-risk (NPA §5, dimension 8)
**Result:** **CLEARED — Tier-1, no conditions**

**Authority:** `D-NEW-PRODUCT-APPROVAL-POLICY` (CEO-approved 2026-05-10) · `D-PRODUCT-CONSTRUCTION-SUBSTRATE` (CEO-approved 2026-05-10) · `D-S7-TARGETED-3-5-OPEN-QUESTIONS` sub-decision A (Tier definitions locked, 2026-05-08)

---

## 1. Tier classification — Tier-1

Under the methodology tier system (`Procedures/validation/_tier-definitions-v0.1.md` §1–§2, status `locked-for-slice-A`), a product attracts **Tier-1** model-risk classification when *none* of the following apply:

- the fair-value measurement relies on an unobservable input (IFRS 13 Level 2 or Level 3);
- pricing requires a deterministic quantitative method, statistical model, or calibration surface;
- capital or liquidity ratios are produced by an internal model for this product; or
- an AML/conduct decision is driven by a model specific to this product.

FX Spot ZAR/USD satisfies *none* of the Tier-2 or Tier-1 (model-based) criteria. The sole price input is the live quoted market rate (Reuters/Bloomberg bid/offer); no interpolation, calibration, or curve-building is involved. **Tier-1 — market-observable, no model uncertainty** applies by construction.

This is consistent with the disambiguation worked examples in §3 of the tier-definitions file, which explicitly classes a straight spot-FX exchange at a quoted market rate as a Tier-3 in terms of *validation depth required*, noting it does not even meet the threshold of "model" under the taxonomy at §4 (no statistical/ML component, no deterministic quantitative method, no rule-based algorithm producing a non-observable output — it is pure ETL from a market-data feed to a booking entry).

---

## 2. No pricing model required — IFRS 13 Level 1

FX Spot ZAR/USD is priced at the observable quoted rate sourced from Reuters/Bloomberg. Under IFRS 13 §76–79, this is a **Level 1** input: an unadjusted quoted price in an active market for an identical asset at the measurement date. Level-1 fair values carry zero model uncertainty by definition — the measurement is the market price; no model is interposed between input and output.

Consequences for the model-risk gate:

- No model specification is required (no `ModelSubmitted` event is raised for this product).
- No pre-deployment validation is required (the tier-definitions cadence column for Tier-1/Level-1 is "N/A — no model").
- No ongoing revalidation cadence applies.
- No model-risk capital add-on is warranted under the bank's RAS § B7 model-risk appetite (which reserves capital-add-ons for Tier-2 and above).

The SARB ZAR Fixing Rate (used for FinSurv reporting) is itself a published observable; no bank-internal model is involved in its application.

---

## 3. Risk metrics — FX delta only; higher-order Greeks are structurally zero

The sole risk sensitivity for a spot-FX position is **FX delta**: the change in ZAR value of the position for a unit move in the ZAR/USD spot rate. Higher-order Greeks are structurally absent, not merely negligible:

| Greek | Why structurally zero for FX Spot |
|---|---|
| Gamma (Δ²V/ΔS²) | Payoff is linear in spot rate; second derivative of a linear function is identically zero. |
| Vega (ΔV/Δσ) | No optionality; implied-volatility surface has no bearing on valuation. |
| Theta (ΔV/Δt) | T+2 settlement is a fixed calendar convention, not a time-value term in the payoff. Any carry effect is captured in the forward points of a *forward*, not a spot. |
| Rho (ΔV/Δr) | Interest-rate sensitivity enters only for forward products via the interest-rate differential; spot settles in two business days without interest-rate exposure in the payoff. |

This means the risk-engine requirement for FX Spot is a single scalar delta per currency pair — already implemented under the SA-FX standardised approach. No model is required to compute delta; it is the notional amount in foreign currency, converted at the current spot rate.

---

## 4. Capital approach — SA-FX under FRTB; no internal model approval required

The bank adopts the **Standardised Approach for FX** under BCBS *Minimum Capital Requirements for Market Risk* (FRTB, January 2019), Chapter 21. The SA-FX treatment for spot positions requires:

1. Convert the net open position in each foreign currency to the reporting currency at the spot rate.
2. Apply the prescribed risk weight (8% for standard currencies under the simplified SA; currency-pair sensitivity approach under the full SA).

No internal model is used at any point in the capital calculation. Accordingly:

- No Internal Models Approval Process (IMA) approval is required from the SARB.
- No model-risk capital overlay applies (RAS § B7 reserving is triggered by Tier-2+ models only).
- No model-in-use registration (`ModelSubmitted` event) is raised.

The SA-FX approach is rule-based and fully deterministic once the net open position and the prescribed risk weights are known. Banks Act Regulation 32 (market risk) endorses the use of the standardised approach as the primary capital method pending any IMA application; the bank does not intend to apply for IMA at this stage.

---

## 5. FinSurv reporting — rule-based; no model

Exchange-control reporting to the SARB Financial Surveillance Department (FinSurv) for spot-FX transactions applies category codes under the Currency and Exchanges Manual (Excon Manual). The applicable transaction category is determined by:

1. Counterparty classification (resident / non-resident).
2. Transaction nature (goods payment, capital flow, interbank, etc.).
3. Amount thresholds for enhanced reporting.

The SARB ZAR Fixing Rate (published daily by the SARB) is used where a regulated rate reference is required. Each of these determinations is a **rule lookup**, not a model output. No interpolation, statistical inference, or quantitative method is applied. FinSurv compliance is therefore outside the scope of the model-risk gate; it is governed by the ExCon compliance dimension of the NPA attestation (owned by Zara, CCO — conduct + AML dimensions).

---

## 6. Obligation chain — ORG-MK-08

The markets-obligation register entry **ORG-MK-08** covers the obligation to have adequate risk-management frameworks for each product class approved for trading. For FX Spot, the ORG-MK-08 obligation is satisfied by:

- The delta-only risk representation (§3 above) — proportionate to the linear payoff.
- The SA-FX capital treatment (§4 above) — standardised, no model.
- The market-data sourcing from a regulated feed (Reuters/Bloomberg; SARB ZAR Fixing) — no model-dependent data cleaning.

ORG-MK-08 does not require an internal pricing model where the product is priced at an observable quoted rate; the risk-framework obligation is met by the standardised capital approach and the delta-only risk metric, both of which are rule-based.

---

## 7. Residual conditions

**None.** FX Spot ZAR/USD is a Tier-1 product with no model, no internal-model capital, Level-1 fair value, and rule-based FinSurv reporting. The model-risk gate is cleared unconditionally.

The following items are noted as **not conditions** (they are substrate gaps or sequencing items owned by other agents):

| Item | Owner | Status |
|---|---|---|
| Obligations-register explicit row for IFRS 13 | Mira (obligations-register curator) | Tracked; does not block NPA gate |
| `ProductionUseBoundary` schema (Tier-2+ models) | Atlas + Nadia + Kai | Not applicable to Tier-1 |
| Model Risk Policy (Helena) | Helena (CRO) | Not applicable to Tier-1; policy governs Tier-2+ model registration |

---

## 8. Citation chain

| Citation | Role in this attestation |
|---|---|
| `D-NEW-PRODUCT-APPROVAL-POLICY` | Mandates the model-risk gate as dimension 8 of the NPA due-diligence cycle; specifies `ProductDimensionAttested` as the output event. |
| `D-PRODUCT-CONSTRUCTION-SUBSTRATE` | Authorises the construction substrate within which this attestation is produced; FX Spot is the first product progressing through the substrate's pre-go-live gates. |
| BCBS *Minimum Capital Requirements for Market Risk* (FRTB, January 2019) | Chapter 21 — SA-FX treatment for standardised-approach banks; basis for "no IMA required" finding at §4. |
| Banks Act 94 of 1990, Regulations Relating to Banks, **Regulation 32** (market risk) | Domestic capital-framework authority for SA-FX; endorses standardised approach pending IMA. |
| `ORG-MK-08` | Obligations-register entry for adequate risk-management frameworks per product class; satisfied by delta-only + SA-FX (§6). |
| `Procedures/validation/_tier-definitions-v0.1.md` (status: `locked-for-slice-A`) | Tier-1 classification criteria and the "what counts as a model" taxonomy; basis for §1. |
| IFRS 13 §76–79 | Level-1 fair-value hierarchy; basis for §2 (no model interposed between quoted rate and booking). |

---

## 9. Attestation event payload

The following TypeScript constant is the `ProductDimensionAttested` payload for the model-risk gate. It is to be pasted into `M4_FX_SPOT_FIXTURE.policyAttestations[0].gatesCleared` and emitted as a typed event at the pre-go-live gate run.

```typescript
// ProductDimensionAttested — model-risk gate
// Paste into M4_FX_SPOT_FIXTURE.policyAttestations[0].gatesCleared
// and emit as a typed event at pre-go-live
const MODEL_RISK_ATTESTATION = {
  dimension: "model-risk-gate",
  result: "cleared",
  attestedBy: "Nadia (quantitative risk methodology engineer, engineering)",
  attestedAt: "2026-05-12T00:00:00.000Z",
  tier: "tier-1",
  rationale: "FX Spot ZAR/USD is priced at an IFRS 13 Level-1 observable quoted rate with linear payoff; no pricing model, no internal capital model, and no model-dependent FinSurv reporting path — Tier-1 by construction under the locked tier-definitions v0.1.",
  citationChain: [
    "D-NEW-PRODUCT-APPROVAL-POLICY",
    "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    "BCBS-FRTB-2019",
    "BANKS-ACT-REG-32",
    "ORG-MK-08",
  ],
  conditions: [],
};
```

---

—Nadia (quantitative risk methodology engineer, engineering)
