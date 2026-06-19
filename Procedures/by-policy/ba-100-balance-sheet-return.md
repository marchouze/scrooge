---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-100
title: BA 100 (Balance Sheet) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-002
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/ba100-contract.ts · prototype/v2-core/regulatory-returns/inverse-index.ts · prototype/platform/recon/ba-return-cell-contract.ts
---

# Procedure — BA 100 (Balance Sheet) return

**Procedure ID:** PROC-FIN-BA-100
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md) (the generic flow). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-100-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille)
**Cadence:** Monthly (per PROC-FIN-BA-01 §4; triggered by `MonthEndCloseCompleted { period }`).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase B).

---

## 1. Form identity (BA-100-specific)

| Property | Value |
|---|---|
| **Form** | **BA 100 — Balance Sheet** (canonical SARB Excel A1 name; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). The solvency/capital return is a separate form (BA 700), per the canonical register. |
| **Obligation** | `ORG-PR-RETURNS-002` (`urn:obligation:bank:prudential:pa-d5-2025-returns-ba100-capital:v1`). |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.3**: *"Complete form BA 100, attached to this Directive as Annexure 2A, in accordance with the requirements specified in Annexure 2B of this Directive, read with the relevant requirements specified in the Regulations."* Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **843 cells** = 127 line-items (R0010…R1270) × up to 7 columns (Banking, Trading, Total1, Total bank, Bank intra-group balances, Consolidated bank, Consolidated bank controlling company) + 10 upload-integrity hash-totals. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA100.zip` → `BA100.xsd` + `SARB-Return - BA100.xlsx`. |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). |

---

## 2. The cell-data-requirement contract (the BA-100-specific input)

Cell population is **driven by the typed contract**, not by hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 100 instance:** `prototype/v2-core/regulatory-returns/ba100-contract.json` (843 cells), loaded + validated by `ba100-contract.ts` (`ba100Contract()`). Machine-generated from the SARB form by `gen-ba100-contract.py` (provenance).

Each cell entry carries: `regulatoryDefinition` + `citations[]` (upward, P2); `valueType`/`currencyDimension`/`unit` (P5); `derivation` (`direct`|`sum`|`formula` with the SARB cell-coordinate expression); `dataRequirements[]` (the GL categories, projections, products and reference data that feed the cell); `applicability`; and `status` (`sourced` | `counsel-gated-TBC` | `licence-day-data`).

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 843 cells, the BA 100 generator:

1. **Reads the contract entry** via `ba100Contract()`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the cell's `dataRequirements` (`gl-account` category balances for the cell's row × the column's entity dimension) from the **GL trial-balance projection** (`gl-trial-balance`). Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate expression (`derivation.expression`, e.g. `[BA100,R0020,C0010]+[BA100,R0050,C0010]`) over the already-resolved constituent cells.
   - hash-total cells → compute the control sum over the populated cell range at generation time.
3. **Applies the column dimension** (Banking C0010 / Trading C0020 split from the per-instrument `tradingBookDesignation`; the consolidation columns C0060/C0070 from the **legal-entity tree**; the intra-group column C0050 from the **party register** intra-group flags).
4. **Honours status — no silent zeros, no fabrication:**
   - `sourced` cells fold from real substrate; an unbooked line folds to an **honest 0** (build phase holds no real positions — CLAUDE.md build-phase vs licence-day).
   - `licence-day-data` cells (the loan / mortgage / lease / commodity lines with no approved product) are reported as 0 with the gap recorded; they populate once such a product is approved (NPA) and booked.
   - `counsel-gated-TBC` cells (none in BA 100 at v1) would be held for counsel, never guessed.

> **Currency (P5).** The functional currency is resolved from the entity's `functional-currency` reference data, never hard-coded. The single `by-currency` cell (R0970 — Foreign-currency loans) is reported on the per-currency axis.

---

## 4. XSD validation before submission (BA-100-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 100 instance document MUST validate against `BA100.xsd`:

1. Serialise the populated cells into the BA 100 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers).
2. Validate the XML against `Regulations/SARB-PA/ba-returns/schemas/BA100.zip → BA100.xsd` (typed cell wrappers, `totalDigits`/`fractionDigits` constraints, hash-total fields).
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission. The validation failure is surfaced as a blocking finding, never suppressed.

This is in addition to — not a replacement for — the completeness guarantee enforced at build time by `recon:ba-return-cell-contract` (every XSD cell has a contract entry).

---

## 5. Reconciliation invariants (BA-100-specific)

The four-eyes reviewer + the automated pre-submission check assert:

| Invariant | Assertion |
|---|---|
| **Balance-sheet identity** | **TOTAL ASSETS (R0540) = TOTAL EQUITY AND LIABILITIES (R0880)** in every column. A non-zero difference blocks submission. |
| **Equity composition** | TOTAL EQUITY (R0870) = R0800 (attributable to equity holders) + R0840 (preference/minority). |
| **Roll-up integrity** | Each subtotal (e.g. R0120 loans, R0240 gross loans, R0550 deposits) equals the sum of its constituent lines per the contract `derivation.expression`. |
| **Trace-to-source** | Every **populated** cell traces to its `dataRequirements`; a populated cell with no resolved source datum is a control failure (the value must not exist without a source — P1/P2). |
| **GL agreement** | The BA 100 asset/liability/equity totals reconcile to the GL trial-balance (the same fold `recon:ba-returns-vs-gl-balances` asserts). |

---

## 6. Four-eyes + CFO attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** → `BAReturnFiled { form: "BA100", period, paReference }`. Per the **decision-authority routing** standard, finance-close / AFS sign-off is the **CFO**'s authority; CEO escalation only on material restatement / going-concern / capital-plan breach (CLAUDE.md). No BA-100-specific deviation.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-100-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase B. Cell population driven by the typed L2 contract; XSD pre-submission validation; balance-sheet reconciliation invariants. |
