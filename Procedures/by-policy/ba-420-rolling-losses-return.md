---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-420
title: BA 420 (12-Months Rolling Losses) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Helena (Chief Risk Officer) · Devon (Chief Operating Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-018B
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba420-contract.json · prototype/platform/reporting/ba-400-op-risk.ts · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — BA 420 (12-Months Rolling Losses) return

**Procedure ID:** PROC-FIN-BA-420
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-420-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). The **operational-loss-data methodology** and the rolling-window aggregation definition are the standing domain of **Helena (Chief Risk Officer)** and **Devon (Chief Operating Officer)**; Bea authors the **return cell contract**, not the loss-data methodology.
**Cadence:** Per the PA's prescribed BA 420 frequency (the trailing-12-month rolling companion to the BA 410 quarterly-loss return; see PROC-FIN-BA-01 §4; confirmed against the D5/2025 completion instructions at the licence gate).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 6 — the operational family).

---

## 1. Form identity (BA-420-specific)

| Property | Value |
|---|---|
| **Form** | **BA 420 — 12-Months Rolling Losses** (canonical SARB Excel A1 name; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). The same per-event operational-loss data as BA 410, aggregated over a **trailing 12-month rolling window** — the rolling-window companion that feeds the loss component / internal-loss-multiplier. |
| **Obligation** | `ORG-PR-RETURNS-018B` (SARB PA Directive D5/2025 §2.1.19 — the BA 420 sibling of `ORG-PR-RETURNS-018`/BA 410, **authored this batch**). BA 420 had **no dedicated obligation row** pre-batch-6 (`ORG-PR-RETURNS-019` is BA 500 — Securitisation Schemes); `ORG-PR-RETURNS-018B` is authored under the same D5/2025 §2.1.19 operational-loss-reporting provision, which `ORG-PR-RETURNS-018`'s correction note explicitly cross-references ("see also BA 420 12-Months Rolling Losses"). Sourced from the SARB Excel form schedule. |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.19** (form BA 420, the rolling-window companion to BA 410, Annexure 18A/18B) read with the **Regulations relating to Banks reg 33** (operational risk — the rolling 12-month operational-loss aggregation feeding the loss component / internal-loss multiplier) and **BCBS OPE25** (the loss-data standards). Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **540 cells**. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA420.zip` → `BA420_v15012026.xsd` + `SARB-Return - BA420_v15012026.xlsx` (Elements sheet; version-suffixed). Leaf types: `Monetary1000` (money — 536, the rolling gross / recovery / net loss amounts), `Numeric` (ratio — 4). |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). |

---

## 2. The cell-data-requirement contract (the BA-420-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 420 instance:** `prototype/v2-core/regulatory-returns/ba420-contract.json` (540 cells), loaded + validated via the return-contract registry (`return-contracts.ts` → `loadReturnContract("BA420")`). Machine-generated from the SARB form by `gen-return-contract.py BA420` (provenance — an entry for EVERY XSD leaf cell, no hand-omission).

### 2.1 Operational losses are captured per-event at the entity (business-line) level — ZERO product-attribute requirements

BA 420 aggregates the **same individual operational-loss events** as BA 410 over a trailing 12-month window — **entity-level** capture, not a product-static menu pick. So — like BA 400 / BA 410 and the capital family — BA 420 carries **NO `product-attribute` requirement**. No BA 420 cell gates a product: the NPA gate sees no operational product-attribute edge, so the live FX product (`prd:bank:fx:otc-vanilla`) and every future product are correctly unaffected. We do **not** manufacture any (Engineering Charter — no fabrication; no bulk-marking).

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 540 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA420")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the cell's figure from the **`ba420-rolling-losses-fold`** projection over the **`OperationalLossEvent`** stream / the loss-event register, aggregated over a **trailing 12-month window** (gross / recovery / net loss by business line + risk-event type). Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate expression over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication:** **all 540 BA 420 cells are `status: licence-day-data`.** The `OperationalLossEvent` stream and the loss-event register exist as substrate, but every cell reports an **actual** rolling operational-loss amount / count, and the bank-in-formation has booked **no operational losses pre-licence-day** (the known **`GAP-BA700-OPERATIONAL-RWA`**). The `statusReason` states this on every cell. No silent zero is reported as if it were a real measured value.

> **Currency (P5).** Rolling gross / recovery / net loss amounts are reported in the functional currency, resolved from reference data, never hard-coded.

---

## 4. XSD validation before submission (BA-420-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 420 instance MUST validate against `BA420_v15012026.xsd`:

1. Serialise the populated cells into the BA 420 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers; the rolling-12-month × business-line × risk-event-type structure).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA420.zip → BA420_v15012026.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every XSD cell has a contract entry — asserted for BA 420 alongside the other authored returns).

---

## 5. Reconciliation invariants (BA-420-specific)

| Invariant | Assertion |
|---|---|
| **Rolling window = trailing 12 months** | Every reported rolling figure must aggregate exactly the `OperationalLossEvent` rows whose reference date falls within the trailing 12-month window ending at the reporting period; an event outside the window contributing to a rolling cell, or an in-window event omitted, is a control failure. |
| **Rolling consistency with BA 410** | The BA 420 rolling totals must be consistent with the sum of the constituent BA 410 quarterly returns over the same 12-month window (the four quarters composing the window) — modulo the rolling cut-off; a divergence that is not explained by the window boundary is a control failure. |
| **Net loss = gross loss − recoveries** | For every rolling loss row, the reported net loss must equal gross loss minus recoveries (OPE25); a divergence is a control failure. |
| **Hashtotal integrity** | The form's control hashtotals must equal the sum over their declared cell range; a mismatch blocks submission. |
| **Trace-to-source** | Every **populated** cell traces to its `ba420-rolling-losses-fold` source data (the in-window `OperationalLossEvent` set); a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** with **CRO (Helena) / COO (Devon) sign-off on the loss-data methodology and the rolling-window definition** → `BAReturnFiled { form: "BA420", period, paReference }`. Per the **decision-authority routing** standard, operational-loss measurement is the **CRO (Helena)** / **COO (Devon)** domain; the return filing is the **CFO (Camille)**'s authority. CEO escalation only on a material operational-loss event meeting the RAS-threshold / regulatory-reportable-incident trigger.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time from the `OperationalLossEvent` stream over the rolling window, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-420-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 6 (the operational family). Cell population driven by the typed 540-cell contract; **per-event entity-level loss capture aggregated over a trailing 12-month window — ZERO product-attribute requirements** (no fabrication); all cells `licence-day-data` (no operational-loss history pre-licence-day — `GAP-BA700-OPERATIONAL-RWA`); XSD pre-submission validation; rolling-window + rolling-consistency-with-BA-410 invariants; new obligation `ORG-PR-RETURNS-018B` authored as the BA 420 sibling; CFO attestation with CRO/COO loss-data methodology sign-off. |
