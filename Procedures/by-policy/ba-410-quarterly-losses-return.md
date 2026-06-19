---
policy-parent: Policies/regulatory-reporting-policy-v1.md
last-reviewed: 2026-06-19
procedureId: PROC-FIN-BA-410
title: BA 410 (Operational Risk — Quarterly Losses) return — creation, validation, attestation and submission
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-06-19
owner: Camille (Chief Financial Officer) · Helena (Chief Risk Officer) · Devon (Chief Operating Officer) · Bea (Accounting & financial reporting engineer, engineering)
status: POPULATED
delta-on: PROC-FIN-BA-01 (Procedures/by-policy/ba-return-generation.md)
policy-cited: Policies/regulatory-reporting-policy-v1.md
obligation-cited: ORG-PR-RETURNS-018
decision-cited: D-BA-RETURN-DATA-CONTRACT
system-capability: prototype/v2-core/regulatory-returns/cell-contract.ts · prototype/v2-core/regulatory-returns/return-contracts.ts · prototype/v2-core/regulatory-returns/ba410-contract.json · prototype/platform/reporting/ba-400-op-risk.ts · prototype/platform/recon/ba-return-cell-contract.ts · prototype/platform/recon/npa-return-data-obligation-integrity.ts
---

# Procedure — BA 410 (Operational Risk: Quarterly Losses) return

**Procedure ID:** PROC-FIN-BA-410
**Delta on:** [`PROC-FIN-BA-01` — BA Return Generation](ba-return-generation.md). **This procedure does NOT restate** the generic preparer→four-eyes→attest→`BAReturnFiled`→restatement flow; it specifies only what is BA-410-specific. Read PROC-FIN-BA-01 §§3–9 first.
**Owner:** Camille (Chief Financial Officer) · Helena (Chief Risk Officer, governance) · Devon (Chief Operating Officer, governance) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille). The **operational-loss-data methodology** (the risk-event-type taxonomy, the gross-loss / recovery / net-loss measurement, the date-of-occurrence / discovery / accounting capture, the business-line attribution) is the standing domain of **Helena (Chief Risk Officer)** and **Devon (Chief Operating Officer)**; Bea authors the **return cell contract**, not the loss-data methodology.
**Cadence:** Per the PA's prescribed BA 410 frequency (quarterly — the operational-loss companion to the BA 400 operational-risk return; see PROC-FIN-BA-01 §4; confirmed against the D5/2025 completion instructions at the licence gate).
**Status:** POPULATED · **Authority:** `D-BA-RETURN-DATA-CONTRACT` (CEO-approved 2026-06-19, Phase C batch 6 — the operational family).

---

## 1. Form identity (BA-410-specific)

| Property | Value |
|---|---|
| **Form** | **BA 410 — Operational Risk: Quarterly Losses** (canonical SARB Excel A1 name; `Regulations/SARB-PA/ba-returns/_canonical-register.md` §1). The quarterly operational-loss-event return — individual losses by Basel business line and risk-event type — that underpins the loss component / internal-loss-multiplier in the BA 400 op-risk charge. |
| **Obligation** | `ORG-PR-RETURNS-018` (SARB PA Directive D5/2025 §2.1.19 — completion of regulatory return form BA 410). The obligation record's prior "BA 410 = Pillar 3 disclosure return" citation annotation is a documented fabrication the `D-BA-RETURN-DATA-CONTRACT` Phase A correction supersedes — per the Excel form A1 header, BA 410 is the **Operational Risk: Quarterly Losses** return. The obligation ID is cited; only the interpretation is corrected. |
| **Regulatory instruction** | SARB PA **Directive D5/2025 §2.1.19** (form BA 410, Annexure 18A/18B) read with the **Regulations relating to Banks reg 33** (operational risk — the operational-loss-data collection underpinning the loss component / internal-loss multiplier) and **BCBS OPE25** (the loss-data standards: the risk-event-type taxonomy, the gross-loss / recovery / net-loss measurement, the date of occurrence / discovery / accounting). Enabling law: **Banks Act 94 of 1990 s.6(6)(a)**. |
| **Cell universe** | **566 cells**. Authoritative source: `Regulations/SARB-PA/ba-returns/schemas/BA410.zip` → `BA410.xsd` + `SARB-Return - BA410.xlsx` (Elements sheet). Leaf types: `Monetary1000` (money — 549, the gross / recovery / net loss amounts), `Numeric` (ratio — 6), `Text` (text — 5, the loss-event narratives / IDs), `Date` (date — 3, occurrence / discovery / accounting), `RiskEventType` + `YesNo` (enum — 3, the risk-event-type code + the "previously reported" / "status: ended" flags). |
| **Reporting unit** | `Monetary1000` — amounts in **thousands** of the functional currency (P5: functional, never literal ZAR). Enum cells carry the Basel/Reg-33/OPE25 risk-event-type taxonomy and the loss-event status flags; date cells carry the OPE25 reference dates. |

---

## 2. The cell-data-requirement contract (the BA-410-specific input)

Cell population is **driven by the typed contract**, not hand-coded line logic:

- **Schema (the framework):** `prototype/v2-core/regulatory-returns/cell-contract.ts` — the Zod `ReturnCellContractSchema`, reusable across all BA returns.
- **BA 410 instance:** `prototype/v2-core/regulatory-returns/ba410-contract.json` (566 cells), loaded + validated via the return-contract registry (`return-contracts.ts` → `loadReturnContract("BA410")`). Machine-generated from the SARB form by `gen-return-contract.py BA410` (provenance — an entry for EVERY XSD leaf cell, no hand-omission).

### 2.1 Operational losses are captured per-event at the entity (business-line) level — ZERO product-attribute requirements

BA 410 captures **individual operational-loss events**, attributed to a Basel business line and a risk-event type at capture time by the org unit — **entity-level**, not a product-static menu pick. So — like BA 400 and the capital family — BA 410 carries **NO `product-attribute` requirement**. No BA 410 cell gates a product: the NPA gate sees no operational product-attribute edge, so the live FX product (`prd:bank:fx:otc-vanilla`) and every future product are correctly unaffected. We do **not** manufacture any (Engineering Charter — no fabrication; no bulk-marking).

---

## 3. Cell-population steps (delta on PROC-FIN-BA-01 §6 "data extraction")

For each of the 566 cells, the generator:

1. **Reads the contract entry** via `loadReturnContract("BA410")`.
2. **Resolves the value by `derivation.kind`:**
   - `direct` → fold the cell's figure from the **`ba410-quarterly-losses-fold`** projection over the **`OperationalLossEvent`** stream / the loss-event register (gross loss, recoveries, net loss, by Basel business line + risk-event type, with the occurrence / discovery / accounting dates). Cell values are **projections, never stored** (P1).
   - `sum` / `formula` → evaluate the SARB cell-coordinate expression over the already-resolved constituent cells.
3. **Honours status — no silent zeros, no fabrication:** **all 566 BA 410 cells are `status: licence-day-data`.** The `OperationalLossEvent` stream and the loss-event register exist as substrate, but every cell reports an **actual** operational-loss amount / count / date / risk-event-type, and the bank-in-formation has booked **no operational losses pre-licence-day** (the known **`GAP-BA700-OPERATIONAL-RWA`**). The `statusReason` states this on every cell. No silent zero is reported as if it were a real measured value.

> **Currency (P5).** Gross / recovery / net loss amounts are reported in the functional currency, resolved from reference data, never hard-coded.

---

## 4. XSD validation before submission (BA-410-specific hard gate)

**Before** the four-eyes review (PROC-FIN-BA-01 §7), the generated BA 410 instance MUST validate against `BA410.xsd`:

1. Serialise the populated cells into the BA 410 upload XML (the `BAxxxxxxxx` element envelope; `Monetary1000` value wrappers; the per-loss-event × business-line × risk-event-type structure with the OPE25 reference dates + status flags).
2. Validate against `Regulations/SARB-PA/ba-returns/schemas/BA410.zip → BA410.xsd`.
3. **Fail-closed (Engineering Charter cmd 2):** an XSD-invalid instance is NOT eligible for review or submission; the failure is a blocking finding, never suppressed.

This is in addition to the build-time completeness guarantee enforced by `recon:ba-return-cell-contract` (every XSD cell has a contract entry — asserted for BA 410 alongside the other authored returns).

---

## 5. Reconciliation invariants (BA-410-specific)

| Invariant | Assertion |
|---|---|
| **Net loss = gross loss − recoveries** | For every loss-event row, the reported net loss must equal gross loss minus recoveries (OPE25); a divergence is a control failure. |
| **Loss aggregation ties to the event stream** | The reported totals (by business line, by risk-event type, and the grand total) must equal the aggregation of the in-period `OperationalLossEvent` rows the fold reads; a divergence between a reported subtotal and the event-stream aggregate is a control failure. |
| **Hashtotal integrity** | The form's control hashtotals must equal the sum over their declared cell range (form-integrity controls); a mismatch blocks submission. |
| **Quarter window consistency** | Every reported loss event's accounting/occurrence date must fall within (or be correctly flagged "previously reported in section 2" for) the reporting quarter; a date outside the window without the flag is a control failure. |
| **Trace-to-source** | Every **populated** cell traces to its `ba410-quarterly-losses-fold` source datum (an `OperationalLossEvent`); a populated cell with no resolved source is a control failure (no value without a source — P1/P2). |

---

## 6. Four-eyes + attestation (inherited)

As PROC-FIN-BA-01 §7–8: preparer (Bea) → independent reviewer → **CFO (Camille) attestation** with **CRO (Helena) / COO (Devon) sign-off on the loss-data methodology** (risk-event-type classification, business-line attribution, loss measurement) → `BAReturnFiled { form: "BA410", period, paReference }`. Per the **decision-authority routing** standard, operational-loss measurement is the **CRO (Helena)** / **COO (Devon)** domain; the return filing is the **CFO (Camille)**'s authority. CEO escalation only on a material operational-loss event meeting the RAS-threshold / regulatory-reportable-incident trigger.

---

## 7. Events-first (P1)

Markdown is a render. The procedure registration and each filing land as typed events first (PROC-FIN-BA-01 §9; RMS `RecordFiled`). The cell-data-requirement **contract is reference data (Plane A)** — it carries no events; cell **values** are projections folded at generation time from the `OperationalLossEvent` stream, never stored.

---

## 8. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-06-19 | Bea (Accounting & financial reporting engineer) | Initial BA-410-specific procedure as a delta on PROC-FIN-BA-01, under `D-BA-RETURN-DATA-CONTRACT` Phase C batch 6 (the operational family). Cell population driven by the typed 566-cell contract; **per-event entity-level loss capture — ZERO product-attribute requirements** (no fabrication); all cells `licence-day-data` (no operational-loss history pre-licence-day — `GAP-BA700-OPERATIONAL-RWA`); XSD pre-submission validation; net=gross−recoveries + loss-aggregation + quarter-window invariants; CFO attestation with CRO/COO loss-data methodology sign-off. |
