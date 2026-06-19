---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-700
title: BA 700 (Capital Adequacy and Leverage and TLAC) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-022
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba700-contract.json · prototype/platform/reporting/ba-700-capital.ts · prototype/platform/reporting/ba-700-leverage-ratio.ts · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — BA 700 (Capital Adequacy and Leverage and TLAC) return

**Procedure ID:** PROC-FIN-BA-700
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-700-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). Capital **methodology** (qualifying-capital tiering, regulatory deductions, the buffer/Pillar-2A stack, the leverage-exposure measure) is the standing domain of Camille (Chief Financial Officer, governance); total-RWA aggregation / ICAAP linkage is the domain of Helena (Chief Risk Officer, governance). Bea authors the **return cell contract**, not the capital methodology.
**Cadence:** Monthly (per PROC-FIN-BA-01 §4; Reg 38's verbatim title is "monthly return concerning capital adequacy and leverage"; triggered by `MonthEndCloseCompleted { period }`).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 5 — the capital family).

---

## 1. Form identity (BA-700-specific)

| Property | Value |
|---|---|
| **Form** | **BA 700 — Capital Adequacy and Leverage and TLAC** (canonical SARB Excel A1 name, verbatim: "CAPITAL ADEQUACY AND LEVERAGE AND TLAC"; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). The apex prudential return. |
| **Obligation** | `ORG-PR-RETURNS-022` (post-#1451 corrected capital-adequacy return row). The obligation record's prior "BA 700 = prudent-valuation / additional-leverage disclosure" label, and the prior fabricated scheme that placed the capital-adequacy return at the balance-sheet form number, are documented fabrications the `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL` correction supersedes (the balance-sheet form number is the Balance Sheet return; see `_canonical-register.md` §2). |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.23**: *"Complete form BA 700 … in accordance with the requirements specified in Annexure 22B … read with the relevant requirements specified in the Regulations."* Read with the **Regulations relating to Banks reg 38** (capital adequacy and leverage — qualifying capital CET1/AT1/T2, regulatory deductions, minimum ratios) and the **Banks Act 94 of 1990 s.70(2)/(2A)/(2B)** (minimum capital and reserve funds on the aggregate-risk-weighted-exposure basis); **Basel III CAP** (definition of capital), the **BCBS leverage-ratio framework (LEV §147–§165)** and the **TLAC term-sheet**. Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **474 cells**. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA700.zip` → `BA700.xsd` + `SARB-Return - BA700v20260512.xlsx` (Elements sheet). Leaf types: `Monetary1000` (money — 371), `Numeric` (ratio — 97), `CP_YesNo` (enum — 2), `Text` (4). |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). Ratio cells (`Numeric`) carry the capital-adequacy and leverage percentages. |

---

## 2. The cell-data-requirement contract (the BA-700-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 700 instance:** `prototype/v2-core/regulatory-returns/ba700-contract.json` (474 cells), loaded + validated via the return-contract registry (`return-contracts.ts` → `loadReturnContract("BA700")`). Machine-generated from the SARB form by `gen-return-contract.py BA700` (provenance — an entry for EVERY XSD leaf cell, no hand-omission).

### 2.1 Capital is GL-/RWA-derived — ZERO product-attribute requirements

Unlike the credit / liquidity / market families, BA 700 carries **NO `product-attribute` requirement**. This is correct and deliberate, not an omission:

- **The capital NUMERATOR is the bank's OWN capital-classified GL** — CET1 / AT1 / T2 share capital, share premium, retained earnings, reserves, and the regulatory deductions. It is sourced from the chart-of-accounts capital classification, not from a customer-product attribute.
- **The capital DENOMINATOR (total RWA) aggregates the OTHER returns' RWA** — credit (BA 200) + market (BA 320) + operational (BA 400) + counterparty-credit + CVA + equity. The product-attribute obligations that drive those components are bound on **their own** returns (e.g. `prd:bank:credit:loan#exposureClass` on BA 200); BA 700 consumes the aggregated RWA, it does not re-bind the underlying product attributes.

So **no capital cell gates a product**. The NPA gate (`recon:npa-return-data-obligation-integrity`) sees no capital product-attribute edge — the live FX product (`prd:bank:fx:otc-vanilla`) and every future product are correctly unaffected by BA 700. We do **not** manufacture a product attribute to fill a perceived gap (Engineering Charter — no fabrication; no bulk-marking).

> **Capital-instrument note.** If the bank later models its OWN issued capital instruments (AT1 / T2 notes) as products whose tier-eligibility must be captured, a `product-attribute` edge could attach to that future capital-instrument product. No such product is modelled today, so none is attached — honest, not manufactured.

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 474 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA700")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the cell's figure from the **`ba700-capital-adequacy-fold`** projection. The capital projection (`platform/reporting/ba-700-capital.ts` — `generateBa100Capital`: CET1/AT1/T2 gross→net via corresponding-tier deductions, the RWA decomposition, the CET1/Tier 1/Total ratios) supplies the capital-stack and ratio cells.
       - The total-RWA denominator threads the **`RwaComputed`** projection, aggregating the credit (BA 200), market (BA 320), operational (BA 400), counterparty-credit, CVA and equity RWA components.
       - The leverage cells (Tier 1 ÷ exposure measure) fold from `platform/reporting/ba-700-leverage-ratio.ts` (`generateLeverageRatio`). Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate expression (`derivation.expression`) over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication (the licence-day-heavy split):**
   - **`sourced` (56 cells):** the regulatory **minimum-required ratios** (base CET1 4.5% / Tier 1 6% / Total 8% per `computeRequiredMinimums` + `BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS`), the **buffer add-ons** (capital conservation 2.5%, countercyclical, D-SIB systemic, Pillar-2A), the **base minima**, the **specified buffer requirement**, and the **specified minimum leverage ratio** (3% per `BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM`). These compute **today from BCBS / Reg-38 constants** — they do **not** need real capital, so they are honestly sourced.
   - **`licence-day-data` (418 cells):** every **achieved** capital amount, RWA amount, achieved CET1 / Tier 1 / Total ratio, excess/shortfall and TLAC position. The bank-in-formation holds **no real capital** pre-licence-day (the R300m is a licence-day **target**, not a present balance — CLAUDE.md "build phase vs licence-day"), so there is no achieved figure to report. The `statusReason` states this on every such cell. No silent zero is reported as if it were a real measured value.

> **Currency (P5).** Capital, leverage and RWA amounts are reported in the functional currency, resolved from reference data, never hard-coded. Two CET1-reserve cells (foreign-currency-translation reserve; net-investment-hedge reserve) carry `currencyDimension: by-currency` — genuinely multi-currency OCI components within CET1 per BCBS CAP (Principle 5).

---

## 4. XSD validation before submission (BA-700-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 700 instance MUST validate against `BA700.xsd`:

1. Serialise the populated cells into the BA 700 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers; the capital-stack / RWA-decomposition / ratio / leverage / TLAC structure).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA700.zip → BA700.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every XSD cell has a contract entry — asserted for BA 700 alongside the other authored returns).

---

## 5. Reconciliation invariants (BA-700-specific)

| Invariant | Assertion |
|---|---|
| **Capital-adequacy ratio identity** | `CAR = qualifying capital ÷ total RWA` for each tier: `CET1 ratio = netCET1 / totalRWA`, `Tier 1 ratio = (netCET1 + netAT1) / totalRWA`, `Total ratio = (Tier 1 + netT2) / totalRWA`. Each achieved-ratio cell must equal the corresponding capital amount ÷ the total-RWA cell (BCBS RBC20.2; Reg 38). |
| **RWA decomposition ties to the component returns** | `totalRWA = creditRWA (BA 200) + marketRWA (BA 320) + operationalRWA (BA 400) + counterparty-credit + CVA + equity`. The BA 700 total-RWA cell must equal the sum of the component RWA from the `RwaComputed` projection used by BA 200 / BA 320 / BA 400; a divergence between BA 700's denominator and the component returns is a control failure. |
| **Leverage-ratio identity** | `leverage ratio = Tier 1 capital ÷ total exposure measure ≥ 3%` (BCBS LEV; Reg 38). The leverage cell must equal `generateLeverageRatio` output; the leverage denominator is the **non-risk-based exposure measure** (on-balance-sheet + derivative SA-CCR + SFT + off-balance-sheet commitments), NOT total RWA — the two denominators must not be conflated. |
| **Tier ordering** | `netCET1 ≤ Tier 1 ≤ Total capital`; `CET1 ratio ≤ Tier 1 ratio ≤ Total ratio`. A violation (a tier exceeding a higher tier) is a control failure. |
| **Minimum-required overlay** | The all-in required CET1 = base 4.5% + conservation 2.5% + countercyclical + D-SIB + Pillar-2A (uniform overlay across CET1 / Tier 1 / Total per `computeRequiredMinimums`); the required-minimum cells must equal this overlay sum. |
| **Trace-to-source** | Every **populated** cell traces to its `ba700-capital-adequacy-fold` source datum (or the regulatory-constant input for the minimum/buffer cells); a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + CFO attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** → `BAReturnFiled { form: "BA700", period, paReference }`. Per the **decision-authority routing** standard, the AFS / capital-plan / finance-close sign-off on BA 700 is the **CFO (Camille)**'s authority; **total-RWA aggregation methodology + ICAAP linkage** sign-off is **CRO (Helena)**'s. CEO escalation only on a capital-plan breach, an approaching RAS-threshold breach, or a material restatement.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-700-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 5 (the capital family). Cell population driven by the typed 474-cell contract; **GL-/RWA-derived — ZERO product-attribute requirements** (no fabrication); the honest licence-day-heavy status split (56 sourced regulatory-minimum/buffer/leverage-minimum cells from BCBS/Reg-38 constants, 418 licence-day achieved-capital/RWA/ratio cells — no real capital pre-licence-day); XSD pre-submission validation; reconciliation invariants — CAR = qualifying-capital ÷ total-RWA, total-RWA = the sum of the credit / market / operational RWA components (per §5), and the leverage backstop = Tier 1 ÷ exposure measure ≥ 3% (see §5 for the form-number ties). |
