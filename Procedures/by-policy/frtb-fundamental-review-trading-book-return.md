---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-FRTB
title: FRTB (Fundamental Review of the Trading Book) market-risk return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Helena (Chief Risk Officer) · Rohan (Market & counterparty risk engineer, engineering) · Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-031
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/frtb-contract.json · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — FRTB (Fundamental Review of the Trading Book) market-risk return

**Procedure ID:** PROC-FIN-FRTB
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is FRTB-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Helena (Chief Risk Officer, governance) · Rohan (Market & counterparty risk engineer, engineering) · Camille (Chief Financial Officer, governance) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). The **FRTB market-risk methodology** (the standardised approach — sensitivities-based method / DRC / RRAO — and the internal-models approach — ES / NMRF / P&L-attribution) is the standing domain of **Helena (CRO) / Rohan**; Bea authors the **return cell contract**, not the FRTB methodology.
**Cadence:** Per the PA's prescribed FRTB-market-risk-return frequency (the standalone FRTB return of the Basel III post-crisis-reforms package — Basel MAR; the precise cadence is confirmed against the SARB revised-market-risk-framework implementation at the licence gate).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 8 — the statistical + supplementary returns).

---

## 1. Form identity (FRTB-specific — its OWN identity, MR-prefix, multi-sub-form)

| Property | Value |
|---|---|
| **Form** | **FRTB — Fundamental Review of the Trading Book** (the **standalone** FRTB return on its **OWN identity** — SARB Umoja schema package `schemas/FRTB.zip`, return name "Return - FRTB"). **★ NOT BA 320 (Market Risk) and NOT BA 325 (Selected Risk Exposure Arising from Trading and Treasury Activities).** A **supplementary** market-risk return — **NOT a D5/2025 BA-numbered Annexure**. **Multi-sub-form:** the FRTB-FM desk metadata, the SSA / SA standardised-approach risk-class sub-forms (GIRR / CSR / equity / commodity / FX; DRC; RRAO) and the IMA internal-models sub-forms (ES / NMRF / P&L-attribution / backtesting). |
| **Identity note** | FRTB is the proper home for the FRTB-SA content the fabricated scheme **wrongly pinned on BA 325**. BA 320 = Market Risk, BA 325 = Selected Risk Exposure — both already built correctly on their own identities; this return is built on the FRTB identity. |
| **Obligation** | `ORG-PR-RETURNS-031` (**authored this batch** — the replay-safe BA 420 / BA 501 pattern, in the obligations seed + markdown register). FRTB had **no D5/2025 BA-numbered obligation row**; `ORG-PR-RETURNS-031` is authored with **honest provenance — no fabricated §-number** — citing the **Basel MAR** FRTB framework + the SARB Reg-28 / PC 18/2024 / D12/2025 transposition. |
| **Regulatory instruction** | SARB / Basel Committee **MAR** (the FRTB revised market-risk framework — MAR20–MAR23 trading-book boundary, MAR21–MAR23 standardised approach (sensitivities-based method, default-risk charge, residual-risk add-on), MAR30–MAR33 internal-models approach (expected shortfall, NMRF, P&L-attribution / backtesting)) read with the **Regulations relating to Banks reg 28** (market risk) and the SARB PA **Prudential Communication 18 of 2024** (revised market-risk framework — FRTB) + **Directive D12/2025**. Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **5,015 cells**. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/FRTB.zip` → `FRTB_v20251031.xsd` + `SARB-Return - FRTB_v20251031.xlsx` (Elements sheet). **The XSD leaf cells carry the `MR########` market-risk element code** (not `BA########`). Leaf types: `Monetary1000` (money — 4,618), `Date` (281), `Percentage 19,9` (ratio — 57), plus `Text` / `Numeric` / `Currency` / `YesNo` / the FRTB enums (`AllocationStructure` / `RiskScope` / `MRCapitalisationApproach` / `TrafficLightStatus` / `CP_RiskRating`) and `SpecifyDate` / `ReportingBaseCurrency`. |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional / by-currency, never literal ZAR). |

---

## 2. The cell-data-requirement contract (the FRTB-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`.
- **FRTB instance:** `prototype/v2-core/regulatory-returns/frtb-contract.json` (5,015 cells), loaded + validated via `loadReturnContract("FRTB")`. Machine-generated by `gen-return-contract.py FRTB` (an entry for EVERY MR-prefix XSD leaf cell, no hand-omission).

### 2.1 Multi-sub-form identity (the FRTB FM / SSA / SA / IMA sub-forms)

The framework `cellRef` has **no sub-form axis**; the FRTB sub-form (FRTB_FM / FRTB_SSA* / FRTB_SA* / IMA_*) is folded into each cell's **`label` + `regulatoryDefinition`** so the desk / risk-class / approach context is never lost. (FRTB has no cross-sub-form leaf reuse, so no dedup is needed — unlike BA 94x.)

### 2.2 FRTB carries REAL trading-book product-attribute requirements

A FRTB cell genuinely keys off the **trading-book designation**, the **FRTB risk class** and the **market-risk capitalisation approach** a future trading-book product must capture. The contract attaches a `product-attribute` requirement `ref: prd:bank:trading:frtb-instrument#<attr>` — `required:true` on the FRTB-FM desk-metadata cells that **REPORT** the trading-book scope / allocation / capitalisation approach (the cells that DEFINE those dimensions), and `required:false` on the SA sensitivities-based-method charge aggregates that are merely **sliced** by the risk class (GIRR / CSR / equity / commodity / FX). The future trading-book product (`prd:bank:trading:frtb-instrument`) is **unapproved**, so the NPA gate gates it once created, and the **live FX product is never matched** (exact product-id equality). No bulk-marking, no fabrication.

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 5,015 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("FRTB")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the figure from the **`frtb-market-risk-fold`** projection over the trading book — the standardised approach (sensitivities-based method by risk class, DRC, RRAO) and the internal-models approach (ES, NMRF, P&L-attribution / backtesting), by trading desk. Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate calculation over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication:** **all 5,015 FRTB cells are `status: licence-day-data`.** The fold exists as substrate, but every cell needs a **real** trading book, which the bank-in-formation does not run pre-licence-day. The `statusReason` states this on every cell — and notes that FRTB is the standalone return, NOT BA 320 / BA 325.

> **Currency (P5).** FRTB capital amounts are reported in the functional currency (the FX risk class per-currency where the row names the FX axis), resolved from reference data, never hard-coded.

---

## 4. XSD validation before submission (FRTB-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated FRTB instance MUST validate against `FRTB_v20251031.xsd`:

1. Serialise the populated cells into the FRTB upload XML (the `MRxxxxxxxx` element envelope; `Monetary1000` value wrappers; the desk × risk-class × approach × sub-form structure).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/FRTB.zip → FRTB_v20251031.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every MR-prefix XSD cell has a contract entry — asserted for FRTB alongside the other 28 authored returns).

---

## 5. Reconciliation invariants (FRTB-specific)

| Invariant | Assertion |
|---|---|
| **SA = SBM + DRC + RRAO** | The standardised-approach total capital must equal the sensitivities-based-method charge plus the default-risk charge plus the residual-risk add-on (MAR21); a divergence is a control failure. |
| **Risk-class aggregation** | The sensitivities-based-method charge must aggregate the per-risk-class (GIRR / CSR-NS / CSR-CTP / equity / commodity / FX) delta / vega / curvature charges per the MAR21 correlation-scenario aggregation (low / medium / high); a divergence is a control failure. |
| **IMA vs SA dual-report** | Where a desk is on the internal-models approach, the SA charge must still be reported for the same desk (the SA-floor / dual-reporting requirement); an IMA desk with no SA figure is a control failure. |
| **Traffic-light consistency** | The reported P&L-attribution / backtesting traffic-light status must be consistent with the underlying ES / actual-vs-hypothetical P&L test results; an inconsistent zone is a control failure. |
| **Hashtotal integrity** | The form's control hashtotals must equal the sum over their declared cell range; a mismatch blocks submission. |
| **Trace-to-source** | Every **populated** cell traces to its `frtb-market-risk-fold` source data; a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** with **CRO (Helena) / Rohan sign-off on the FRTB market-risk methodology** → `BAReturnFiled { form: "FRTB", period, paReference }`. Per the decision-authority routing standard, FRTB market-risk measurement is the **CRO (Helena)** domain; the return filing is the **CFO (Camille)**'s authority. CEO escalation only on a material restatement, a RAS-threshold market-risk breach, or an IMA-model-approval / PLA-test traffic-light red zone.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial FRTB-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 8 (statistical + supplementary returns). **FRTB on its OWN identity (NOT BA 320 Market Risk, NOT BA 325 Selected Risk Exposure)**; supplementary, MR-prefix, multi-sub-form (FM / SSA / SA / IMA); cell population driven by the typed 5,015-cell contract; **real trading-book product-attribute requirements on the future trading-book product** (tradingBookDesignation / marketRiskApproach required:true on FM desk-metadata, frtbRiskClass required:false slices); all cells `licence-day-data` (no trading book pre-licence-day); **new obligation `ORG-PR-RETURNS-031` authored replay-safe (Basel MAR, no fabricated §-number)**; XSD pre-submission validation; SA=SBM+DRC+RRAO + IMA-vs-SA-dual-report invariants; CFO attestation with CRO/Rohan FRTB-methodology sign-off. |
