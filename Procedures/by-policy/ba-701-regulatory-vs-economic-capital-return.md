---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-701
title: BA 701 (Regulatory vs Economic Capital) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Helena (Chief Risk Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PA-033
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba701-contract.json · prototype/platform/reporting/ba-700-capital.ts · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — BA 701 (Regulatory vs Economic Capital) return

**Procedure ID:** PROC-FIN-BA-701
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-701-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Helena (Chief Risk Officer, governance) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). The **economic-capital methodology** (the ICAAP economic-capital model, the confidence interval, intra-/inter-risk diversification, the operational-risk business-indicator coefficient + internal-loss-multiplier) is the standing domain of **Helena (Chief Risk Officer)**; the **regulatory-capital side** (the Pillar-1 @8% RWA charge per risk type) is the domain of **Camille (Chief Financial Officer)**. Bea authors the **return cell contract**, not the economic-capital methodology.
**Cadence:** Per the PA's prescribed BA 701 frequency (ICAAP-linked; typically annual/periodic — per PROC-FIN-BA-01 §4; confirmed against the D4/2025 completion instructions at the licence gate).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 5 — the capital family).

---

## 1. Form identity (BA-701-specific)

| Property | Value |
|---|---|
| **Form** | **BA 701 — Regulatory vs Economic Capital** (canonical SARB Excel A1 name, verbatim: "BA701 - REGULATORY vs ECONOMIC CAPITAL"; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). The reconciliation of the Pillar-1 regulatory capital charge to the bank's internal economic-capital demand by risk type. |
| **Obligation** | `ORG-PA-033` (SARB PA Directive D4/2025 — completion of regulatory return form BA 701). The obligation record's verbatim "recovery planning and resolution" requirement annotation is a documented mislabel the `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL` correction supersedes — the Excel form A1 header and the form's row/column structure (economic-capital demand vs regulatory capital by risk type) are authoritative. The obligation ID is cited; only the interpretation is corrected. |
| **Regulatory instruction** | SARB PA **Directive D4/2025** (Completion of regulatory return: form BA 701) read with the **Regulations relating to Banks reg 39** (the Internal Capital Adequacy Assessment Process — ICAAP) and **reg 38** (regulatory capital); **Basel SRP** (the supervisory review process — Pillar 2 / ICAAP economic capital) and **CAP**. Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **418 cells**. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA701.zip` → `BA701.xsd` + `SARB-Return - BA701v20260512.xlsx` (Elements sheet). Leaf types: `Monetary1000` (money — 371), `Percentage (19,9)` (ratio — 33), `Numeric` (ratio — 14, the confidence interval + the operational-risk BI coefficient / internal-loss-multiplier). |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). Ratio cells carry the confidence interval and the operational-risk coefficients. |

---

## 2. The cell-data-requirement contract (the BA-701-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 701 instance:** `prototype/v2-core/regulatory-returns/ba701-contract.json` (418 cells), loaded + validated via the return-contract registry (`return-contracts.ts` → `loadReturnContract("BA701")`). Machine-generated from the SARB form by `gen-return-contract.py BA701` (provenance — an entry for EVERY XSD leaf cell, no hand-omission).

### 2.1 Capital is GL-/RWA-derived — ZERO product-attribute requirements

Like BA 700, BA 701 carries **NO `product-attribute` requirement**. The regulatory-capital side reuses the BA 700 RWA decomposition (aggregated from the credit / market / operational component returns, which bind their own product attributes); the economic-capital side is an **ICAAP-model output** (the bank's internal economic-capital demand at its stated confidence interval), not a product-static menu pick. No BA 701 cell gates a product — the NPA gate sees no capital product-attribute edge, so the live FX product and every future product are correctly unaffected. We do **not** manufacture any (Engineering Charter — no fabrication; no bulk-marking).

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 418 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA701")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the cell's figure from the **`ba701-regulatory-vs-economic-capital-fold`** projection — the regulatory-capital side reuses the BA 700 regulatory-capital projection (the Pillar-1 @8% RWA charge per risk type, over the `RwaComputed` decomposition); the economic-capital side folds from the **ICAAP economic-capital model** (the economic-capital demand — gross, intra-/inter-risk diversification, net — at the bank's stated confidence interval, with the 3-year forecast). Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate expression over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication:** **all 418 BA 701 cells are `status: licence-day-data`.** The regulatory-capital side reuses substrate that exists (the BA 700 RWA decomposition), but the **economic-capital model output and the real positions it runs over do not exist pre-licence-day** — the bank holds no real capital (the R300m is a licence-day target), and the ICAAP economic-capital engine is not yet wired. There is therefore no reconciliation figure to report yet. The `statusReason` states this on every cell. The confidence-interval and operational-risk-coefficient inputs are ICAAP-methodology reference inputs (CRO / Helena domain). No silent zero is reported as if it were a real measured value.

> **Currency (P5).** Regulatory-capital and economic-capital amounts are reported in the functional currency, resolved from reference data, never hard-coded.

---

## 4. XSD validation before submission (BA-701-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 701 instance MUST validate against `BA701.xsd`:

1. Serialise the populated cells into the BA 701 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers; the regulatory-vs-economic-capital-by-risk-type structure).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA701.zip → BA701.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every XSD cell has a contract entry — asserted for BA 701 alongside the other authored returns).

---

## 5. Reconciliation invariants (BA-701-specific)

| Invariant | Assertion |
|---|---|
| **Regulatory-capital side ties to BA 700** | The Pillar-1 regulatory capital charge per risk type @8% RWA (credit / CCR / CVA / market / operational / equity / other) must reconcile to the BA 700 RWA decomposition × 8% (`RwaComputed`); a divergence between BA 701's regulatory-capital column and the BA 700 total-RWA denominator is a control failure. |
| **Economic-capital reconciliation** | `economic-capital demand (Net) = economic-capital demand (Gross) − diversification` per risk type; the net total reconciles across the risk-type rows. The economic-capital demand is reported at the **stated confidence interval** (R0010 etc.); each cell's confidence interval must match the form-level interval declaration. |
| **Regulatory-vs-economic reconciliation** | The form's core purpose: the **total regulatory capital required** must be reconciled to the **total economic-capital demand** — the difference (the Pillar-2 / ICAAP add-on, the risks not covered under Pillar 1) is the headroom/shortfall the return surfaces. A reconciliation that does not tie out (regulatory + Pillar-2 add-on ≠ economic-capital demand) is a control failure. |
| **Output-floor consistency** | The output-floor impact row must be consistent with BA 700's output-floor treatment (a no-op for this bank on the SA approach for credit + market risk). |
| **Trace-to-source** | Every **populated** cell traces to its `ba701-regulatory-vs-economic-capital-fold` source datum (the BA 700 regulatory-capital projection or the ICAAP economic-capital model); a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + dual attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) + CRO (Helena) attestation** → `BAReturnFiled { form: "BA701", period, paReference }`. Per the **decision-authority routing** standard, the regulatory-capital figures are the **CFO (Camille)**'s authority; the **economic-capital / ICAAP methodology** (confidence interval, diversification, the economic-capital model) is the **CRO (Helena)**'s authority — BA 701 is the one capital return that genuinely requires **both** seats to attest. CEO escalation only on a capital-plan breach or a material RAS-threshold breach.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-701-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 5 (the capital family). Cell population driven by the typed 418-cell contract; **GL-/RWA-derived — ZERO product-attribute requirements** (no fabrication); all cells `licence-day-data` (the ICAAP economic-capital model output + real positions do not exist pre-licence-day; no real capital); XSD pre-submission validation; regulatory-ties-to-BA-700 + economic-capital-reconciliation + regulatory-vs-economic reconciliation invariants; dual CFO+CRO attestation (the regulatory-capital + economic-capital split). |
