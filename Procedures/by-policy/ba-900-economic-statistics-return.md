---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-900
title: BA 900 (Economic statistics — DI statistical balance sheet) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Anya (Data & analytics engineer, engineering) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-024
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba900-contract.json · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — BA 900 (Economic statistics — DI statistical balance sheet) return

**Procedure ID:** PROC-FIN-BA-900
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-900-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Anya (Data & analytics engineer, engineering) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). The **economic-statistics analytics** (the DI statistical balance sheet by institutional sector and maturity) are the standing domain of **Bea / Anya**; Bea authors the **return cell contract**.
**Cadence:** Per the PA's prescribed BA 900 economic-statistics frequency (SARB Directive D5/2025 §2.1.25, effective 1 February 2025; the BA 900 DI sectoral balance-sheet return is **monthly** for the SARB monetary-and-financial-statistics series — confirmed against the D5/2025 completion instructions (Annexure 24B) at the licence gate). BA 900 is submitted to **both** the Prudential Authority **and** the SARB Economic Statistics Department.
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 9 — the **FINAL** return, completing the full SARB BA-return suite).

---

## 1. Form identity (BA-900-specific — the LARGEST, MULTI-SUB-FORM return)

| Property | Value |
|---|---|
| **Form** | **BA 900 — Economic statistics** (canonical SARB Excel A1 name; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). The DI statistical **Balance Sheet of Deposit-Taking Institutions per institutional and maturity breakdown, based on statistical principles**. A **multi-sub-form** return: **BA900_1 .. BA900_7** (plus two trailing `_8` / `_9` control sub-forms in the Elements list) decompose the bank's statistical balance sheet — assets (Table 1) and liabilities (Table 2) — by **institutional sector** and **maturity** band. The **largest workbook in the suite** (XSD 6.2 MB, xlsx 2.9 MB). |
| **Obligation** | `ORG-PR-RETURNS-024` (SARB PA Directive D5/2025 **§2.1.25**, Annexure 24A/24B — the **post-#1451-corrected** row: BA 900 = Economic statistics per the canonical SARB Excel A1; the prior "related-party transactions" annotation was the documented fabrication the correction supersedes). **Already adopted** — no new obligation is authored. |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.25** (form BA 900, Annexure 24A/24B) read with the **Regulations relating to Banks** and the **South African Reserve Bank Act 90 of 1989** (the SARB's monetary-and-financial-statistics mandate). Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **10,752 distinct cells** — the largest contract in the suite. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA900.zip` → `BA900.xsd` + `SARB-Return - BA900v20260512.xlsx` (Elements sheet). Leaf types: `Monetary1000` (money — 10,648, the sectored / maturity-banded balance-sheet amounts), `Integer` (count — 84), `Numeric` (ratio — 20). **Multi-sub-form note:** every XSD leaf code is **distinct** here (no code is reused across the BA900_1..9 sub-forms), so the generator's multi-sub-form deduplication is a **no-op**; the recon's independent XSD oracle yields the same **10,752**-leaf universe the xlsx Elements sheet does — they agree by construction. |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional / by-currency, never literal ZAR). |

---

## 2. The cell-data-requirement contract (the BA-900-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`.
- **BA 900 instance:** `prototype/v2-core/regulatory-returns/ba900-contract.json` (10,752 distinct cells), loaded + validated via `loadReturnContract("BA900")`. Machine-generated by `gen-return-contract.py BA900` (an entry for EVERY distinct XSD leaf cell, no hand-omission).

### 2.1 Multi-sub-form identity (the BA 900 `_1.._7` pattern itself)

The framework `cellRef` has **no sub-form axis** — BA 900 *is* the canonical `_1.._7` case the rest of the suite mirrors. The sub-form (`BA900_1` .. `BA900_9`) is folded into each cell's **`label` + `regulatoryDefinition`** so the meaning is never lost across sub-forms whose row/column labels overlap. The giant identical `formDescription` boilerplate ("BA 900 - BALANCE SHEET OF DEPOSIT TAKING INSTITUTIONS …") is **suppressed** from the per-cell context (it is the form name, not a per-cell discriminator); only the sub-form key is folded in. The build-time `recon:ba-return-cell-contract` independently re-extracts the XSD leaf set and asserts exactly one contract entry per leaf — so completeness is verified, not asserted by the generator.

### 2.2 The DI statistical balance sheet is an AGGREGATE statistic — ZERO product-attribute requirements

The reported value is a **sectored / maturity-banded balance-sheet aggregate** (Total economy / total domestic sectors / deposit-taking institutions / other financial corporations / general government / non-financial corporations / households / non-resident, by maturity) — an aggregate statistic, **not** a product-static menu attribute. So BA 900 carries **NO `product-attribute` requirement**: no BA 900 cell gates a product; the live FX product (`prd:bank:fx:otc-vanilla`) and every future product are correctly unaffected. The sector / maturity disaggregation is a **reporting dimension** of the fold (resolved from the GL / deposit / loan ledgers' counterparty-sector + maturity reference data), not a per-product static menu pick. We do **not** manufacture any (no fabrication; no bulk-marking). This is consistent with the other aggregate statistical returns (BA 930, BA 94x).

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 10,752 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA900")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` (8,032 cells) → fold the figure from the **`ba900-economic-statistics-fold`** projection over the GL / deposit / loan / securities ledgers, disaggregated by **institutional sector** and **maturity** band per the SARB statistical sectoring.
   - `sum` (2,720 cells) → aggregate the constituent sector / maturity / table cells per the workbook's "Calculation Definition" (e.g. Total economy = Total domestic sectors + Non-resident sector; total gross assets = the row-group sum). Cell values are **projections, never stored** (P1).
3. **Honours status — no silent zeros, no fabrication:** **all 10,752 BA 900 cells are `status: licence-day-data`.** The fold exists as substrate, but every cell reports a **real** sectored balance-sheet amount, and the bank-in-formation holds **no real statistical balance sheet pre-licence-day** (no real deposits, loans, securities or sectored counterparties). The `statusReason` states this on every cell.

> **Currency (P5).** Amounts are reported per-currency where the row/column names a currency axis (foreign currency / Rand / denominated-in), else functional (8,111 functional, 2,537 by-currency) — resolved from reference data, never hard-coded.

---

## 4. XSD validation before submission (BA-900-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), each generated BA900_1 .. BA900_7 sub-form instance MUST validate against `BA900.xsd`:

1. Serialise the populated cells into the BA 900 upload XML per sub-form (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers; the sector × maturity × table structure).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA900.zip → BA900.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every distinct XSD leaf has a contract entry — asserted for BA 900 alongside the other 29 authored returns, **30 returns — the complete suite**).

---

## 5. Reconciliation invariants (BA-900-specific — balance-sheet aggregate / SARB statistical reconciliation)

| Invariant | Assertion |
|---|---|
| **Sub-form coverage** | Every in-scope BA900_1 .. BA900_7 sub-form (assets, liabilities, the sector / maturity sub-tables) must be populated where the bank holds the relevant balance-sheet items; an omitted in-scope sub-form is a control failure. |
| **Balance-sheet identity** | **Total gross assets must equal total gross liabilities-plus-capital** (the statistical balance-sheet identity) for the same period; a non-zero residual blocks submission. This is the BA 900 analogue of the BA 100 balance-sheet tie. |
| **Sector totals tie** | For each row / table, **Total economy = Total domestic sectors + Non-resident sector**, and **Total domestic sectors = Σ(domestic institutional sectors** — DTIs, other financial corporations, general government, non-financial corporations, households, NPISH**)**; a mismatch blocks submission. |
| **Maturity totals tie** | For each instrument / sector cut reported by maturity, the by-maturity-band breakdown must sum to that cut's total line; a mismatch blocks submission. |
| **Cross-return statistical reconciliation** | The BA 900 statistical balance-sheet aggregates must reconcile to the **BA 100** accounting balance sheet within the documented statistical-vs-accounting bridging differences (statistical principles vs IFRS measurement); an unreconciled difference outside the bridge is a control finding (the SARB Economic Statistics Department's statistical-consistency check). |
| **Hashtotal integrity** | The form's control hashtotals must equal the sum over their declared cell range; a mismatch blocks submission. |
| **Trace-to-source** | Every **populated** cell traces to its `ba900-economic-statistics-fold` source data; a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** → `BAReturnFiled { form: "BA900", period, paReference }` (per sub-form as the upload structure requires). The economic-statistics analytics methodology is the **Bea / Anya** domain; the return filing is the **CFO (Camille)**'s authority. BA 900 is dual-submitted to the PA and the SARB Economic Statistics Department. CEO escalation only on a material restatement.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-900-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 9 — **the FINAL return, completing the full SARB BA-return suite (30 returns)**. The **largest, multi-sub-form** return (BA900_1..7; 10,752 distinct cells; XSD 6.2 MB). Cell population driven by the typed 10,752-cell contract; every XSD leaf distinct (dedup a no-op); **aggregate sectoral balance-sheet statistic — ZERO product-attribute requirements** (no fabrication); all cells `licence-day-data` (no real statistical balance sheet pre-licence-day); per-sub-form XSD pre-submission validation; balance-sheet-identity + sector/maturity-totals-tie + cross-return (BA 100) statistical-reconciliation invariants; CFO attestation; dual submission (PA + SARB Economic Statistics Department). Obligation `ORG-PR-RETURNS-024` already adopted (no new obligation authored). |
