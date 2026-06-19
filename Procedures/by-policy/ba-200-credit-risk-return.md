---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-200
title: BA 200 (Credit Risk — IRB + Standardised, incl. CCR) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-007
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba200-contract.json · prototype/platform/reporting/ba-200-credit-risk.ts · prototype/platform/risk/sa-ccr/ · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — BA 200 (Credit Risk: IRB + Standardised, incl. counterparty credit risk) return

**Procedure ID:** PROC-FIN-BA-200
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-200-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). Credit-risk **methodology** (asset-class mapping, risk-weight functions, PD/LGD, SA-CCR) is the standing domain of Helena (Chief Risk Officer, governance) / Rohan (Credit & counterparty-risk engineer); Bea authors the **return cell contract**, not the risk methodology.
**Cadence:** Monthly (per PROC-FIN-BA-01 §4; triggered by `MonthEndCloseCompleted { period }`).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 2 — the credit family).

---

## 1. Form identity (BA-200-specific)

| Property | Value |
|---|---|
| **Form** | **BA 200 — Credit Risk (IRB + Standardised approaches; includes counterparty credit risk sub-forms)** (canonical SARB Excel A1 name; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). |
| **Obligation** | `ORG-PR-RETURNS-007` (post-#1451 corrected credit-risk return row). |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.8**: *"Complete form BA 200 … in accordance with the requirements specified in the Annexure … read with the relevant requirements specified in the Regulations."* Read with the **Regulations relating to Banks reg 23** (credit risk) and **reg 23(15)–(19)** (counterparty credit risk / SA-CCR); **Basel CRE20–CRE36**. Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **4 570 cells** across the STA and IRB sub-forms (`BA200_STA*`, `BA200_IRB*`). Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA200.zip` → `BA200_v15012026.xsd` + `SARB-Return - BA200_v15012026.xlsx` (Elements sheet). Leaf types: `Monetary1000`/`Monetary1000NN` (money), `Percentage 19,9` (ratio), `Integer` (count), `Numeric`, `Text`, `IDType`. |
| **Reporting unit** | `Monetary1000`/`Monetary1000NN` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). |

---

## 2. The cell-data-requirement contract (the BA-200-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 200 instance:** `prototype/v2-core/regulatory-returns/ba200-contract.json` (4 570 cells), loaded + validated via the return-contract registry (`return-contracts.ts` → `loadReturnContract("BA200")`). Machine-generated from the SARB form by `gen-return-contract.py BA200` (provenance — an entry for EVERY XSD leaf cell, no hand-omission).

### 2.1 Product-attribute requirements — the NEW binding (Phase C batch 2)

Unlike the financial family (GL-derived, no product attributes), BA 200 cells genuinely require attributes a **credit product** must carry. Each cell that keys off such an attribute carries a `product-attribute` `dataRequirement` with `ref: prd:bank:credit:loan#<attr>`. The **distinct `required:true` attributes BA 200 obliges** are:

| Attribute | Why required | Clause |
|---|---|---|
| `exposureClass` | a cell in an explicit "Asset class: …" breakdown cannot place an exposure without its class | Basel CRE20.16–CRE20.40; SARB reg 23(6) |
| `regulatoryApproach` | an EAD/RWA cell cannot be placed in the correct STA-vs-IRB sub-form without it | Basel CRE20 / CRE30–CRE36; SARB reg 23(11)–(13) |
| `pdEstimate` | on an IRB sub-form, the average-PD / expected-loss cell is populate-or-die without the obligor PD | Basel CRE31–CRE36; SARB reg 23(11)–(13) |
| `lgdEstimate` | IRB risk-weight + expected-loss input | Basel CRE32–CRE36; SARB reg 23(11)–(13) |

Computed drivers (`riskWeight`, `creditConversionFactor`, `onOffBalanceSheet`, `collateralType`, `defaultStatus`) are attached `required:false` — the engine derives them from the required inputs; the aggregate still folds. **This is the binding the NPA gate enforces**: a future credit product (`prd:bank:credit:loan`) cannot reach approval unless it captures — or tracks as an accounting deferred gap — these attributes (`recon:npa-return-data-obligation-integrity`). The live FX product (`prd:bank:fx:otc-vanilla`) feeds NO credit product-attribute cell and is therefore **not** blocked.

> **Honest substrate gap (Engineering Charter cmd 3 + 5).** The product-scope schema (`productScopeForEventSchema`) is FX-shaped and does not yet model credit attributes; until it is extended, a credit product is approvable only by tracking each owed attribute as a `ProductDeferredGap` on its accounting dimension. Tracked, not hidden.

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 4 570 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA200")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the cell's credit figure from the **`ba200-credit-risk-fold`** projection — the SA credit-risk engine (`platform/reporting/ba-200-credit-risk.ts`) over the credit-exposure register + the credit-RWA projection; counterparty-credit EAD from the **SA-CCR engine** (`platform/risk/sa-ccr/`). Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate expression (`derivation.expression`) over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication:** all BA 200 cells are `status: licence-day-data`. The credit-risk engine + SA-CCR + RWA projection exist as substrate, but the bank books **no real credit exposures pre-licence-day**; the form therefore has no figures to report yet. The `statusReason` states this on every cell. The product-attribute `dataRequirements` bind **now** so the future credit product is gated — that is the build-now value.

> **Currency (P5).** Credit amounts are reported in the functional currency, resolved from reference data, never hard-coded.

---

## 4. XSD validation before submission (BA-200-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 200 instance MUST validate against `BA200_v15012026.xsd`:

1. Serialise the populated cells into the BA 200 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000`/`Monetary1000NN` value wrappers; the STA/IRB sub-form structure).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA200.zip → BA200_v15012026.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every XSD cell has a contract entry — asserted for BA 200 alongside the other authored returns).

---

## 5. Reconciliation invariants (BA-200-specific)

| Invariant | Assertion |
|---|---|
| **RWA ties to the credit-RWA projection** | The total risk-weighted-exposure cells must equal the credit-RWA projection used for BA 700 capital-adequacy; a divergence between the BA 200 RWA and the capital-return numerator is a control failure. |
| **CCR EAD = 1.4 × (RC + PFE)** | Counterparty-credit-risk exposure-at-default cells equal the SA-CCR engine output: `EAD = 1.4 × (replacementCost + potentialFutureExposure)` (Basel CRE52; SARB reg 23(15)–(19)). A BA 200 CCR EAD not equal to the SA-CCR engine value is a control failure. |
| **Asset-class roll-up integrity** | Each asset-class subtotal equals the sum of its constituent exposure-class rows per `derivation.expression`; the total-exposure column equals on-balance + off-balance-post-CCF + CCR EAD. |
| **STA/IRB partition** | An exposure appears under exactly one approach sub-form (its `regulatoryApproach`); the STA total + IRB total reconcile to the bank's total credit exposure with no double-count. |
| **Trace-to-source** | Every **populated** cell traces to its `ba200-credit-risk-fold` / SA-CCR source datum; a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + CFO attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** → `BAReturnFiled { form: "BA200", period, paReference }`. Per the **decision-authority routing** standard, finance-close sign-off is the **CFO**'s authority; **credit-risk methodology** sign-off (asset-class mapping, risk-weight/PD-LGD calibration, SA-CCR parameters) is **CRO (Helena)**'s authority. CEO escalation only on material restatement / RAS-threshold breach.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-200-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 2 (the credit family). Cell population driven by the typed contract (4 570 cells, licence-day-data); the **product-attribute binding** (`prd:bank:credit:loan#exposureClass|regulatoryApproach|pdEstimate|lgdEstimate` required); XSD pre-submission validation; RWA-ties-to-projection + CCR EAD = 1.4×(RC+PFE) reconciliation invariants. |
