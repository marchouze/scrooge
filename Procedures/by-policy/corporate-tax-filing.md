---
procedureId: PROC-TX-CIT-01
title: Corporate income tax annual filing
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-15
owner: Yael (Tax & treasury engineer, engineering) · Camille (Chief Financial Officer, governance)
status: POPULATED
policy-cited: Tax Policy (planned — Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md)
system-capability: prototype/platform/tax/cit-engine (PLANNED)
---

# Procedure — Corporate income tax annual filing

**Procedure ID:** PROC-TX-CIT-01
**Owner:** Yael (Tax & treasury engineer, engineering) · Camille (Chief Financial Officer, governance)
**Approval:** Audit Committee
**Cadence:** Annual (ITR14 due 12 months after financial year-end; provisional tax payments at 6 months and 12 months from year-start)
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

---

## 1. Source policy

- `Tax Policy v0.1` (planned — under `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md`) — primary source; defines the bank's approach to corporate income tax, deferred tax, uncertain tax positions (IFRIC 23), and voluntary disclosure.
- `Policies/accounting-policies-ifrs-v1.md` — IAS 12 deferred tax recognition (co-source).
- `Policies/records-management-policy-v1.md` — SARS record retention requirements (co-source; 5-year statutory minimum under Tax Administration Act).

Obligation chain:

```
Income Tax Act 58 of 1962
  → Tax Policy v0.1
    → PROC-TX-CIT-01 (this procedure)
      → @platform/tax/cit-engine (PLANNED)
```

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-TX-01` | Pay corporate income tax on taxable income per Income Tax Act 58/1962. |
| `ORG-TX-04` | Maintain tax records per Tax Administration Act 28/2011 retention requirements. |
| `ORG-TX-08` | Designate a Public Officer responsible for SARS-facing matters (Companies Act + Tax Admin Act). |
| `ORG-TX-09` | Voluntary Disclosure Programme used where material discovery occurs (Income Tax Act + Tax Admin Act). |
| `ORG-AC-09` | Recognise current and deferred income taxes in accordance with IAS 12. |
| `ORG-AC-12` | Disclose uncertain tax positions per IFRIC 23. |
| Income Tax Act 58/1962, Part I (general charging provisions) | Taxable income is the amount remaining after the deduction from income of all permissible deductions. Banks are subject to special provisions on interest income, bad debts, and financial instrument accrual. |
| Tax Administration Act 28/2011, s.25 | Submit annual return of income (ITR14) within 12 months of financial year-end (or SARS-extended deadline). |
| Tax Administration Act 28/2011, s.28–30 | Provisional tax: first provisional payment at 6 months from year-start; second provisional at year-end; third provisional (optional) before ITR14 assessment. |

---

## 3. Purpose

Compute, review, attest, and file the bank's annual corporate income tax return (ITR14) and provisional tax payments on schedule, ensuring:

1. Taxable income is derived entirely from the canonical event log (Principle 1 — no manual spreadsheet reconstructions).
2. All deductions specific to banking institutions (section 11(a) interest, section 24J financial instrument accrual, section 25B bad-debt provisions, special allowances) are applied correctly and consistently with the bank's documented tax methodology.
3. Deferred tax assets and liabilities are correctly computed per IAS 12 (`ORG-AC-09`) and reconciled to the accounting profit in the audited financial statements.
4. Uncertain tax positions (IFRIC 23) are identified, quantified, and disclosed in the financial statements before the ITR14 is filed.
5. Every filing is traceable to a `CITReturnFiled` event containing the SARS case number, enabling point-in-time reconstruction of the submitted return.
6. A Voluntary Disclosure Programme path is available (`ORG-TX-09`) if a material error is discovered post-filing.

In the build phase, the procedure is rehearsed against synthetic financial data. It activates on real taxable income from the first trading year.

---

## 4. Trigger

- **Annual primary trigger:** `AnnualCloseCompleted { year }` event — emitted by the year-end close procedure after audited financial statements are finalised. This event initiates the CIT computation cycle.
- **Provisional tax triggers (biannual):**
  - First provisional: 6 months after start of the financial year — Yael computes the estimated taxable income based on year-to-date actuals and year-end projections.
  - Second provisional: at financial year-end — revised estimate based on full-year actuals.
- **Ad-hoc trigger — VDP:** A material error discovered post-filing triggers `CITVoluntaryDisclosureTriggered { year, discovery_date, estimated_adjustment }`. SARS engagement begins within 21 days.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | `AnnualCloseCompleted { year }` event emitted by year-end close; CIT engine subscribes and begins taxable-income computation | `system` | `@platform/event-store` ✓ | Upstream dependency: year-end close (PLANNED). |
| 2 | CIT engine reads accounting profit from the consolidated income-statement projection, then applies South African tax adjustments: (a) add back non-deductible expenditure (entertainment, penalties, prohibited items per s.23); (b) deduct permanent differences (exempt income, dividends from resident companies); (c) apply section 24J financial-instrument accrual (yield-to-maturity basis for financial instruments) | `system` | `@platform/tax/cit-engine` (`PLANNED`) | Section 24J requires YTM accrual for financial instruments; this is the primary bank-specific tax adjustment. The engine reads instrument cash flows from the positions projection. |
| 3 | Apply banking-specific deductions: section 11(a) interest deductions; section 25B bad-debt provisions (confirmed bad debts only; potential bad debts are Stage-3 ECL that are deductible only when confirmed written off); capital allowances for fixed assets; leases per section 11(e) | `system` | `@platform/tax/cit-engine` (`PLANNED`) | Stage-3 ECL provisions are NOT tax-deductible until the debt is legally written off (SARS interpretation of s.25B). The deferred tax computation (Step 5) captures this temporary difference. |
| 4 | Compute assessed loss carried forward (if applicable) from prior year's tax computation event; apply to current-year taxable income; emit `CITAssessedLossApplied { year, assessed_loss_bf, taxable_income_before_loss, taxable_income_after_loss }` | `system` | `@platform/tax/cit-engine` (`PLANNED`) | Assessed loss is only available in the first years of operation. The engine checks `CITReturnFiled` from the prior year for the opening assessed loss. |
| 5 | Compute deferred tax: identify all temporary differences between accounting carrying value and tax base for each asset/liability category; apply current corporate tax rate (28% for banks; subject to rate changes per SARS budget); emit `DeferredTaxComputed { year, deferred_tax_asset, deferred_tax_liability, net_deferred_tax, rate_applied }` | `system` | `@platform/tax/cit-engine` (`PLANNED`) + `@platform/projections/balance-sheet` ✓ | Key temporary differences: ECL provisions (accounting but not yet deductible); capital allowances (tax depreciation faster/slower than accounting); finance leases; assessed losses recognised as DTA. |
| 6 | Identify uncertain tax positions per IFRIC 23: any tax treatment where it is not probable that SARS will accept the bank's position; quantify the expected additional liability or deduction using the most-likely-amount method | `human` (Yael) | `@platform/tax/cit-engine` (`PLANNED`) | Yael applies professional judgement to IFRIC 23 assessment. The engine surfaces all significant temporary differences and unusual deductions as candidates for Yael's review. |
| 7 | Yael reviews the full CIT computation draft: reconciles taxable income to accounting profit (tax proof), verifies section 24J calculations, checks ECL deductibility claims, confirms deferred tax balances. Raises any issues in the tracking register | `human` (Yael) | `@platform/document-store` ✓ | All issues must be resolved before Camille attestation. |
| 8 | Compute provisional tax payment amounts: first provisional = 50% of prior year tax liability (or current estimate if materially different); second provisional = estimated full-year liability minus first provisional payment; emit `ProvisionalTaxComputed { year, period: first | second, amount, basis }` | `system` | `@platform/tax/cit-engine` (`PLANNED`) | Under-estimation by > 20% of final liability triggers SARS interest; engine warns Yael if estimate is below the safe-harbour threshold. |
| 9 | Camille (CFO, governance) reviews and attests the CIT computation: confirms taxable income reconciliation, deferred tax balances, provisional tax amounts, and IFRIC 23 disclosures; emits `CITReturnAttested { year, signatory: camille, attested_at }` | `human` (Camille) | `@platform/event-store` ✓ | **CFO attestation is the control event authorising SARS filing.** No `CITReturnFiled` can be emitted without a preceding `CITReturnAttested`. |
| 10 | Submit ITR14 to SARS via e-Filing portal; capture SARS case number; emit `CITReturnFiled { year, sars_case_number, filed_at, attested_by: camille }` | `system` | `@platform/tax/sars-efiling-client` (`PLANNED`) | Submission is automated post-attestation; SARS case number captured from portal response. Tax payment (if final liability exceeds provisional payments) submitted on same date. |
| 11 | Provisional tax payments submitted biannually via SARS e-Filing: emit `ProvisionalTaxPaid { year, period, amount, sars_receipt }` | `system` | `@platform/tax/sars-efiling-client` (`PLANNED`) | Timely payment obligation per Tax Admin Act s.28–30. Engine monitors deadlines and fires warnings at T-14 days. |
| 12 | If material error discovered post-filing: Yael assesses materiality (> 5% of tax liability or any structural position error); if material, initiates VDP engagement with SARS; emit `CITVoluntaryDisclosureTriggered { year, discovery_date, estimated_adjustment, materiality_basis }` | `human` (Yael) | `@platform/event-store` ✓ | VDP must be initiated proactively before SARS audit detection. Camille and Thandiwe (CAE) notified immediately on VDP trigger. |

---

## 6. Reconciliation

- **Events produced:**
  - `CITAssessedLossApplied { year, assessed_loss_bf, taxable_income_before_loss, taxable_income_after_loss }` — Step 4.
  - `DeferredTaxComputed { year, deferred_tax_asset, deferred_tax_liability, net_deferred_tax, rate_applied }` — Step 5.
  - `ProvisionalTaxComputed { year, period, amount, basis }` — Step 8.
  - `CITReturnAttested { year, signatory, attested_at }` — Step 9.
  - `CITReturnFiled { year, sars_case_number, filed_at, attested_by }` — Step 10.
  - `ProvisionalTaxPaid { year, period, amount, sars_receipt }` — Step 11.
  - `CITVoluntaryDisclosureTriggered { year, discovery_date, estimated_adjustment }` — Step 12 (rare).

- **Reconciliation invariants:**
  1. **Attestation gate:** Every `CITReturnFiled` must have a preceding `CITReturnAttested` from Camille. Enforced by the e-filing engine.
  2. **Tax proof:** The taxable income in the CIT computation must reconcile to accounting profit + permanent differences + timing differences. The engine produces a machine-readable tax-proof table; deviations are Vera findings.
  3. **DTA recoverability:** Deferred tax assets must not exceed the expected future taxable profit horizon (IAS 12 recognition threshold). Vera checks annually that the DTA balance is supported by projections.
  4. **Provisional tax timeliness:** `ProvisionalTaxPaid` event within 7 days of each provisional deadline. Missing or late payments are a Vera finding escalated to Yael + Camille.
  5. **IFRIC 23 disclosure:** Any uncertain tax position with > ZAR 500k potential adjustment must appear in the IFRIC 23 disclosure block in the financial statements. Vera checks that every `IFRIC23UncertainPositionIdentified` event has a downstream disclosure entry.

- **Failure mode:** CIT engine fails to produce draft (missing upstream data, projection engine error) → `CITDraftFailed { year, reason }` emitted. Yael + Camille notified; manual computation falls back to tax-proof spreadsheet reviewed by Camille. SARS may be contacted for a deadline extension if resolution cannot be achieved before ITR14 due date.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CITReturnFiled` event (SARS case number) | Event log | 5 years minimum (Tax Admin Act s.29) | Restricted |
| `CITReturnAttested` event (CFO attestation) | Event log | 5 years | Restricted |
| ITR14 return document (SARS e-Filing portal submission) | Document store (linked from `CITReturnFiled`) | 5 years | Restricted |
| `DeferredTaxComputed` events | Event log | 5 years | Internal |
| Tax computation workpaper (BLAKE3-addressed PDF) | Document store | 5 years | Restricted |
| `ProvisionalTaxPaid` events + SARS payment receipts | Event log + document store | 5 years | Restricted |
| `CITVoluntaryDisclosureTriggered` events + SARS VDP correspondence | Event log + document store | 5 years post-VDP resolution | Confidential |
| IFRIC 23 disclosure workpaper | Document store | 5 years | Restricted |

---

## 8. Manual steps

- **Step 6 — IFRIC 23 identification (Yael):** Uncertain tax position identification requires professional legal and tax judgement. The engine surfaces candidates, but Yael determines which positions are uncertain and quantifies them.
- **Step 7 — Yael tax review:** Reconciliation of taxable income to accounting profit (tax proof) and verification of section 24J calculations require detailed knowledge of both the financial instruments held and SARS interpretations; cannot be fully automated without significant model-risk implications.
- **Step 9 — Camille CFO attestation:** Camille is the statutory signatory for tax purposes (as CFO / Public Officer nominee). Cannot be delegated without a formal `DelegatedSignatoryAppointed` event.
- **Step 12 — VDP materiality assessment (Yael):** Decision whether to invoke the Voluntary Disclosure Programme requires judgement on materiality threshold, SARS interpretation risk, and penalty exposure. Yael decides; Camille and Thandiwe notified.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| CIT engine fails to produce draft | `CITDraftFailed` event; Yael notified | Yael → Camille; SARS deadline extension if needed |
| Provisional tax under-estimated (> 20% shortfall) | Engine safe-harbour warning; post-assessment SARS interest notice | Yael + Camille; cash-flow impact flagged to Eitan (Treasurer) |
| ITR14 not filed by deadline | `CITReturnFiled` not emitted by due date | Vera finding → Yael + Camille + Thandiwe; SARS penalty exposure |
| SARS e-Filing portal unavailable on deadline | `CITFilingFailed` event; 3-retry limit | Yael manual upload via SARS branch / telephonic backup; SARS deadline relief engaged |
| Material tax error discovered post-filing | Yael review or SARS query | `CITVoluntaryDisclosureTriggered`; Camille + Thandiwe notified; VDP engaged within 21 days |
| Deferred tax asset exceeds recoverable horizon | Vera annual DTA recoverability check | Camille + Yael; impairment of DTA recognised |
| IFRIC 23 position not disclosed | Vera check against `IFRIC23UncertainPositionIdentified` events | Yael + Camille; financial statement amendment before filing |

---

## 10. Related procedures

- [`balance-sheet-substantiation.md`](balance-sheet-substantiation.md) — audited balance sheet is the starting point for the tax computation (accounting profit).
- [`ifrs10-consolidation-cycle.md`](ifrs10-consolidation-cycle.md) (PROC-ACC-IFRS10-01) — consolidated financial statements are the accounting basis for the group-level tax computation (if group CIT filing is required).
- [`ba-return-generation.md`](ba-return-generation.md) (PROC-FIN-BA-01) — capital ratio monitoring is affected by the deferred tax asset / liability recognised under this procedure.
- [`ecl-staging-cycle.md`](ecl-staging-cycle.md) (PROC-RSK-ECL-02) — ECL provision deductibility timing (s.25B) is the primary source of deferred tax temporary differences.
- [`records-retention-disposal.md`](records-retention-disposal.md) — SARS 5-year records retention obligation overlaps with the general records management framework.
- `fatca-crs-annual-submission.md` (PROC-TX-FATCA-01) — FATCA / CRS reporting uses overlapping SARS e-Filing infrastructure.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Atlas (Core banking platform architect, engineering) | Initial draft — POPULATED. All 12 sections authored; system capabilities marked PLANNED; banking-specific tax adjustments (s.24J, s.25B) documented; provisional tax and VDP paths included. |

---

## 12. Audit / assurance

- Vera annual: attestation gate (invariant 1), tax-proof reconciliation (invariant 2), provisional tax timeliness (invariant 4), IFRIC 23 disclosure completeness (invariant 5).
- Vera annual: DTA recoverability check (invariant 3) — output to Audit Committee.
- Audit Committee reviews the annual CIT computation as part of the financial statement audit scope; Thandiwe (CAE) co-reviews the IFRIC 23 assessment.
- External auditor reviews the tax computation and deferred tax balances as part of the annual audit engagement (`ORG-AC-14`).
- SARS examination readiness: all `CITReturnFiled` events and supporting workpapers available in the document store with < 5-business-day retrieval SLA.
