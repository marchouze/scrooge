---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-400
title: BA 400 (Operational Risk) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Helena (Chief Risk Officer) · Devon (Chief Operating Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-017
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba400-contract.json · prototype/platform/reporting/ba-400-op-risk.ts · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — BA 400 (Operational Risk) return

**Procedure ID:** PROC-FIN-BA-400
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-400-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). The **operational-risk methodology** (the BIA/TSA approach election, the business-line mapping, the gross-income definition, and — at the SARB transition — the BCBS standardised-approach business-indicator + internal-loss-multiplier framework) is the standing domain of **Helena (Chief Risk Officer)** and **Devon (Chief Operating Officer)**; Bea authors the **return cell contract**, not the operational-risk methodology.
**Cadence:** Per the PA's prescribed BA 400 frequency (monthly per the obligation `ORG-PR-RETURNS-017`; the op-risk capital charge feeds the BA 700 RWA denominator — see PROC-FIN-BA-01 §4; confirmed against the D5/2025 completion instructions at the licence gate).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 6 — the operational family).

---

## 1. Form identity (BA-400-specific)

| Property | Value |
|---|---|
| **Form** | **BA 400 — Operational Risk** (canonical SARB Excel A1 name; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). The operational-risk capital return — BIA / TSA op-risk capital on annual gross income; the op-risk RWA charge (12.5 × op-capital) feeds the **BA 700** total-RWA denominator. |
| **Obligation** | `ORG-PR-RETURNS-017` (SARB PA Directive D5/2025 §2.1.18 — completion of regulatory return form BA 400). Per the Excel form A1 header, BA 400 is the **Operational Risk** return. The obligation record's prior citation annotation mislabelled this form's subject — a documented fabrication the `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL` correction supersedes (see the footnote below). The obligation ID is cited; only the interpretation is corrected (re-confirmed this batch). |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.18** (form BA 400, Annexure 17A/17B) read with the **Regulations relating to Banks reg 33** (operational risk — the basic-indicator approach (BIA) and the standardised approach (TSA) on annual gross income; and, on the SARB transition, the BCBS standardised approach / SMA business-indicator + internal-loss-multiplier framework) and **BCBS D196 §645–§654** / **BCBS OPE** (the revised operational-risk standard). Enabling law: **Banks Act 94 of 1990 s.6(6)(a)** (and s.70(2) — minimum capital on the aggregate-risk-weighted-exposure basis). |
| **Cell universe** | **147 cells**. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA400.zip` → `BA400.xsd` + `SARB-Return - BA400.xlsx` (Elements sheet). Leaf types: `Monetary1000` (money — 141), `Percentage 19,9` + `Numeric` (ratio — 3), `Integer` (count — 2, the loss-event counts), `YesNo` (enum — 1, the ILM-usage flag). |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). Ratio cells carry the ILM capital add-on as a % of gross income; count cells carry the loss-event counts. |

> **Footnote (the corrected obligation annotation).** The leverage-ratio requirement is reported within **BA 700** (Capital Adequacy and Leverage and TLAC) per Reg 38A — *not* on this operational-risk form. The obligation record's prior annotation to the contrary is the documented fabrication that `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL` (and this batch's re-confirmation) supersedes.

---

## 2. The cell-data-requirement contract (the BA-400-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 400 instance:** `prototype/v2-core/regulatory-returns/ba400-contract.json` (147 cells), loaded + validated via the return-contract registry (`return-contracts.ts` → `loadReturnContract("BA400")`). Machine-generated from the SARB form by `gen-return-contract.py BA400` (provenance — an entry for EVERY XSD leaf cell, no hand-omission).

### 2.1 Operational risk is gross-income- and loss-event-derived (entity-level) — ZERO product-attribute requirements

Operational risk is **entity-level**, not product-static. The BIA / TSA capital is computed from the bank's **annual gross income** (an income-statement aggregate, per Basel business line for TSA); the loss inputs are individual operational-loss events attributed to a business line and a risk-event type at capture time by the org unit. Neither side keys off a product-static menu attribute. So — like the capital family, and per the brief — BA 400 carries **NO `product-attribute` requirement**. No BA 400 cell gates a product: the NPA gate sees no operational product-attribute edge, so the live FX product (`prd:bank:fx:otc-vanilla`) and every future product are correctly unaffected. We do **not** manufacture any (Engineering Charter — no fabrication; no bulk-marking).

> The α / β / 12.5× factors **are** BCBS D196 / Reg 33 regulatory constants — but they live as code constants (`BIA_ALPHA`, `BUSINESS_LINE_BETA`, the ×12.5) **inside** the `ba-400-op-risk.ts` fold, not as reported BA 400 cells. The constants' sourced-ness is enforced by the op-risk engine's unit tests, not by a form cell.

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 147 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA400")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the cell's figure from the **`ba400-operational-risk-fold`** projection — the `ba-400-op-risk.ts` op-risk projection (`generateBa300OpRisk`: the BIA `α=15% × average positive annual gross income`; the TSA `1/3 × Σ max(0, Σ βᵢ × grossIncomeᵢ)` per Basel business line; and `op-RWA = 12.5 × op-capital`) over the annual gross-income inputs. Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate expression over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication:** **all 147 BA 400 cells are `status: licence-day-data`.** The op-risk projection exists as substrate, but every **reported** cell needs **real audited gross income** (three financial years in steady state) and/or the **operational-loss history** the internal-loss-multiplier consumes — neither of which the bank-in-formation has pre-licence-day (the known **`GAP-BA700-OPERATIONAL-RWA`**). The `statusReason` states this on every cell. No silent zero is reported as if it were a real measured value.

> **Currency (P5).** Op-risk capital, gross-income and add-on amounts are reported in the functional currency, resolved from reference data, never hard-coded.

---

## 4. XSD validation before submission (BA-400-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 400 instance MUST validate against `BA400.xsd`:

1. Serialise the populated cells into the BA 400 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers; the BIA/TSA gross-income-by-business-line + op-capital + op-RWA + ILM structure).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA400.zip → BA400.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every XSD cell has a contract entry — asserted for BA 400 alongside the other authored returns).

---

## 5. Reconciliation invariants (BA-400-specific)

| Invariant | Assertion |
|---|---|
| **Op-RWA = 12.5 × op-capital** | The reported operational-risk RWA must equal `12.5 ×` the selected-approach operational-risk capital (BIA or TSA) — the `ba-400-op-risk.ts` `opRiskRwaMinor = round(12.5 × opRiskCapitalMinor)` identity. A divergence is a control failure. |
| **Ties to BA 700** | The BA 400 operational-risk RWA must reconcile to the **operational-risk component of the BA 700 total-RWA denominator** (`RwaComputed` operational leg). A divergence between BA 400's op-RWA and the BA 700 operational-RWA input is a control failure. |
| **BIA average over positive years** | Under BIA, capital = `α × (Σ positive-year gross income / count of positive years)` — non-positive years are excluded from both numerator and denominator (per BCBS D196 §650). The reported per-year gross-income lines must tie to the included/excluded set the average uses. |
| **TSA per-year floor at zero** | Under TSA, each year's `Σ βᵢ × grossIncomeᵢ` is floored at zero before the 3-year average (`max(0, …)`); the reported per-year weighted line must reflect the floor. |
| **Trace-to-source** | Every **populated** cell traces to its `ba400-operational-risk-fold` source datum (the gross-income inputs / the op-risk computation); a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** (the capital figure) with **CRO (Helena) / COO (Devon) sign-off on the operational-risk methodology** (approach election, business-line mapping, gross-income definition) → `BAReturnFiled { form: "BA400", period, paReference }`. Per the **decision-authority routing** standard, the operational-risk capital figure is reported by the **CFO (Camille)**; the operational-risk **methodology** is the **CRO (Helena)** / **COO (Devon)** domain. CEO escalation only on a capital-plan breach or a material RAS-threshold breach.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-400-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 6 (the operational family). Cell population driven by the typed 147-cell contract; **gross-income-/loss-event-derived — ZERO product-attribute requirements** (no fabrication); all cells `licence-day-data` (no audited 3-year gross income, no loss history pre-licence-day — `GAP-BA700-OPERATIONAL-RWA`); XSD pre-submission validation; op-RWA = 12.5 × op-capital + ties-to-BA-700 invariants; CFO attestation with CRO/COO methodology sign-off. |
