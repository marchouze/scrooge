---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-920
title: BA 920 (Analysis of instalment-sale credit, leasing finance and selected assets) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Anya (Data & analytics engineer, engineering) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-025
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba920-contract.json · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — BA 920 (Analysis of instalment-sale credit, leasing finance and selected assets) return

**Procedure ID:** PROC-FIN-BA-920
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-920-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Anya (Data & analytics engineer, engineering) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). The **economic-statistics analytics** (the instalment-sale / leasing disaggregation by finance type and financed asset class) are the standing domain of **Bea / Anya**; Bea authors the **return cell contract**.
**Cadence:** Per the PA's prescribed BA 920 economic-statistics frequency (SARB Directive D5/2025 §2.1.26, effective 1 February 2025; the precise submission cadence is confirmed against the D5/2025 completion instructions at the licence gate).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 8 — the statistical + supplementary returns).

---

## 1. Form identity (BA-920-specific)

| Property | Value |
|---|---|
| **Form** | **BA 920 — Analysis of instalment-sale credit, leasing finance and selected assets** (canonical SARB Excel A1 name; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). An economic-statistics return that disaggregates the bank's instalment-sale credit, financial-lease and suspensive-sale book by finance type and financed asset class (vehicles, transport, agricultural / industrial / commercial equipment, ICT, other goods), with opening / closing balances and transaction flows. |
| **Obligation** | `ORG-PR-RETURNS-025` (SARB PA Directive D5/2025 §2.1.26 — post-#1451 corrected to the canonical A1 name; the prior "concentration risk" annotation was the documented fabrication the correction supersedes). |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.26** (form BA 920, Annexure 25A/25B) read with the **Regulations relating to Banks** and the **National Credit Act 34 of 2005** (instalment-sale / lease / suspensive-sale definitions) for the SARB economic-statistics series. Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **493 cells**. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA920.zip` → `BA920.xsd` + `SARB-Return - BA920.xlsx` (Elements sheet). Leaf types: `Monetary1000` (money — 428, the balances + flows), `Integer` (count — 62, actual-number cells), `Numeric` (ratio — 3). |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). |

---

## 2. The cell-data-requirement contract (the BA-920-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 920 instance:** `prototype/v2-core/regulatory-returns/ba920-contract.json` (493 cells), loaded + validated via the registry (`return-contracts.ts` → `loadReturnContract("BA920")`). Machine-generated from the SARB form by `gen-return-contract.py BA920` (provenance — an entry for EVERY XSD leaf cell, no hand-omission).

### 2.1 BA 920 carries REAL product-attribute requirements (finance type + financed asset class)

Unlike the aggregate statistical returns (BA 930 / BA 94x), BA 920 disaggregates by **finance type** (instalment-sale credit vs financial lease vs suspensive sale / non-financial asset) and **financed asset class** — attributes a future instalment-sale / leasing product must carry. The contract attaches a `product-attribute` requirement `ref: prd:bank:credit:instalment-sale-lease#<attr>` to each cell that keys off such an attribute, with `required:false` on the monetary aggregates that are merely **sliced** by it (no cell REPORTS a finance-type / asset-class enum value as its own dimension on this return, so there is no `required:true`). The future instalment-sale / leasing product (`prd:bank:credit:instalment-sale-lease`) is **unapproved**, so the NPA gate (`recon:npa-return-data-obligation-integrity`) gates it once it is created, and the **live FX product (`prd:bank:fx:otc-vanilla`) is never matched** (exact product-id equality). No bulk-marking, no fabrication.

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 493 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA920")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the figure from the **`ba920-instalment-sale-leasing-fold`** projection over the instalment-sale + leasing + suspensive-sale sub-ledger (by finance type and financed asset class). Cell values are **projections, never stored** (P1).
   - `sum` → evaluate the SARB cell-coordinate calculation over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication:** **all 493 BA 920 cells are `status: licence-day-data`.** The fold exists as substrate, but every cell reports an **actual** instalment-sale / leasing amount and the bank-in-formation runs **no instalment-sale / leasing book pre-licence-day**. The `statusReason` states this on every cell.

> **Currency (P5).** Balances and flows are reported in the functional currency, resolved from reference data, never hard-coded.

---

## 4. XSD validation before submission (BA-920-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 920 instance MUST validate against `BA920.xsd`:

1. Serialise the populated cells into the BA 920 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers; the finance-type × asset-class × flow structure).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA920.zip → BA920.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every XSD cell has a contract entry — asserted for BA 920 alongside the other 28 authored returns).

---

## 5. Reconciliation invariants (BA-920-specific)

| Invariant | Assertion |
|---|---|
| **Tie to BA 900** | The BA 920 finance-type block totals must tie to the corresponding BA 900 economic-statistics line references the form cites (instalment-sale credit → BA 900 R0500; financial leases → BA 900 R0510; non-financial assets → BA 900 R1060); a divergence is a control failure. |
| **Opening + flows = closing** | For each finance-type / asset-class block, closing balance must equal opening balance plus transactions (plus / minus) plus valuation changes plus other changes; a divergence is a control failure. |
| **Asset-class subtotals** | Each finance-type block's asset-class rows must sum to the block total; a mismatch blocks submission. |
| **Hashtotal integrity** | The form's control hashtotals must equal the sum over their declared cell range; a mismatch blocks submission. |
| **Trace-to-source** | Every **populated** cell traces to its `ba920-instalment-sale-leasing-fold` source data; a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** → `BAReturnFiled { form: "BA920", period, paReference }`. The instalment-sale / leasing analytics methodology is the **Bea / Anya** domain; the return filing is the **CFO (Camille)**'s authority (per the decision-authority routing standard, economic-statistics returns are a CFO finance-reporting obligation). CEO escalation only on a material restatement.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-920-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 8 (statistical + supplementary returns). Cell population driven by the typed 493-cell contract; **real product-attribute requirements (finance type + financed asset class) on the future instalment-sale / leasing product — `required:false` slices, no fabrication**; all cells `licence-day-data` (no instalment-sale / leasing book pre-licence-day); XSD pre-submission validation; tie-to-BA-900 + opening-flows-closing invariants; CFO attestation. |
