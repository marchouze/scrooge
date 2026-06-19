---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-110
title: BA 110 (Off-Balance-Sheet Activities) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-003
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba110-contract.json · prototype/platform/recon/ba-return-cell-contract.ts
---

# Procedure — BA 110 (Off-Balance-Sheet Activities) return

**Procedure ID:** PROC-FIN-BA-110
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-110-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille)
**Cadence:** Monthly (per PROC-FIN-BA-01 §4; triggered by `MonthEndCloseCompleted { period }`).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 1).

---

## 1. Form identity (BA-110-specific)

| Property | Value |
|---|---|
| **Form** | **BA 110 — Off-Balance-Sheet Activities** (canonical SARB Excel A1 name; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §2). The **post-#1451 corrected** obligation row confirms this form's scope is off-balance-sheet activities (see the obligation record's own correction annotation and the canonical register for the superseded mis-label). |
| **Obligation** | `ORG-PR-RETURNS-003` (`urn:obligation:bank:prudential:pa-d5-2025-returns-ba110-liquidity:v1` — the URN slug carries a pre-#1451 mis-label corrected in the obligation record; the **ID** is canonical). |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.4**: *"Complete form BA 110, attached to this Directive as Annexure 3A, in accordance with the requirements specified in Annexure 3B of this Directive, read with the relevant requirements specified in the Regulations."* Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **130 cells** (all `Monetary1000`). Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA110.zip` → `BA110.xsd` + `SARB-Return - BA110.xlsx` (Elements sheet). |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). |

---

## 2. The cell-data-requirement contract (the BA-110-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 110 instance:** `prototype/v2-core/regulatory-returns/ba110-contract.json` (130 cells), loaded + validated via the return-contract registry (`return-contracts.ts` → `loadReturnContract("BA110")`). Machine-generated from the SARB form by `gen-return-contract.py BA110` (provenance — an entry for EVERY XSD leaf cell, no hand-omission).

Each cell entry carries `regulatoryDefinition` + `citations[]` (upward, P2); `valueType`/`currencyDimension`/`unit` (P5); `derivation`; `dataRequirements[]`; `applicability`; and `status`.

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 130 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA110")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the cell's off-balance-sheet exposure from the **`ba110-obs-fold`** projection — the off-balance-sheet memorandum register (guarantees, letters of credit, irrevocable commitments, contingent liabilities, and derivative notionals captured as memoranda, not on-balance-sheet GL postings). Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate expression (`derivation.expression`) over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication:**
   - All BA 110 cells are `sourced`: the off-balance-sheet memorandum register exists as substrate. With no off-balance-sheet exposures booked in the build phase, every line folds to an **honest 0** (CLAUDE.md build-phase vs licence-day), never a fabricated figure.

> **Currency (P5).** Off-balance-sheet amounts are reported in the functional currency, resolved from the entity's `functional-currency` reference data, never hard-coded.

---

## 4. XSD validation before submission (BA-110-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 110 instance document MUST validate against `BA110.xsd`:

1. Serialise the populated cells into the BA 110 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA110.zip → BA110.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is surfaced as a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every XSD cell has a contract entry — now asserted for BA 110 alongside the other authored returns).

---

## 5. Reconciliation invariants (BA-110-specific)

| Invariant | Assertion |
|---|---|
| **Memo-only posture** | Off-balance-sheet items are **notional memoranda**; they must NOT post to on-balance-sheet asset/liability GL accounts. A BA 110 figure with a corresponding on-balance-sheet GL movement is a control failure. |
| **Roll-up integrity** | Each subtotal equals the sum of its constituent lines per the contract `derivation.expression`. |
| **Trace-to-source** | Every **populated** cell traces to its `ba110-obs-fold` source datum; a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |
| **Cross-return consistency** | Derivative notionals reported here are consistent with the derivatives recorded for market-risk and counterparty-credit reporting (the same underlying exposure register). |

---

## 6. Four-eyes + CFO attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** → `BAReturnFiled { form: "BA110", period, paReference }`. Per the **decision-authority routing** standard, finance-close sign-off is the **CFO**'s authority; CEO escalation only on material restatement / going-concern / capital-plan breach. No BA-110-specific deviation.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-110-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 1. Cell population driven by the typed contract (130 cells); XSD pre-submission validation; off-balance-sheet memo-only reconciliation invariants. |
