---
policy-parent: Tax Policy (planned — Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md)
last-reviewed: 2026-05-15
procedureId: PROC-TX-VAT-01
title: VAT financial-services apportionment
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-15
owner: Yael (Tax & treasury engineer, engineering) · Camille (Chief Financial Officer, governance)
status: POPULATED
policy-cited: Tax Policy (planned — Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md)
system-capability: prototype/platform/tax/vat-apportionment-engine (PLANNED)
---

# Procedure — VAT financial-services apportionment

**Procedure ID:** PROC-TX-VAT-01
**Owner:** Yael (Tax & treasury engineer, engineering) · Camille (Chief Financial Officer, governance)
**Approval:** Audit Committee
**Cadence:** Monthly (provisional apportionment); Annual (final apportionment and VAT201 reconciliation); Initial (SARS apportionment method approval before commencement of trading)
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

---

## 1. Source policy

- `Tax Policy v0.1` (planned — under `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md`) — primary source; defines the bank's VAT apportionment method, treatment of exempt financial services, and input-tax attribution rules.
- `Policies/accounting-policies-ifrs-v1.md` — IAS 12 / IFRS 15 revenue recognition (co-source for the taxable-supply / exempt-supply split).

Obligation chain:

```
VAT Act 89 of 1991 + SARS Practice Note / Binding Private Ruling
  → Tax Policy v0.1
    → PROC-TX-VAT-01 (this procedure)
      → @platform/tax/vat-apportionment-engine (PLANNED)
```

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-TX-03` | Apply financial-services VAT apportionment per approved SARS method (VAT Act 89/1991 + SARS practice). |
| `ORG-TX-04` | Maintain tax records per Tax Administration Act 28/2011 retention requirements (5 years). |
| VAT Act 89/1991, section 12(a) | Financial services as defined in section 2 are exempt from VAT; the bank's core banking activities (loans, deposits, foreign exchange at spot, trading in securities) are exempt supplies. |
| VAT Act 89/1991, section 17(1) | Where a vendor makes both taxable and exempt supplies, input tax must be apportioned; only the portion relating to taxable supplies is deductible. |
| VAT Act 89/1991, section 17(2) and Practice Note 14 / Ruling BPR346 (template) | SARS-approved apportionment formula for banks; the standard formula is turnover-based (taxable-supply revenue / total revenue), but a specific ruling may permit an alternative (activity-based or transaction-count-based) formula if the turnover formula produces a distorted result. |
| Tax Administration Act 28/2011, s.25 | Submit VAT201 return monthly (vendor registered on monthly VAT period; or bi-monthly if SARS authorises). |

---

## 3. Purpose

Compute, review, attest, and file the bank's monthly VAT201 return, applying the SARS-approved financial-services apportionment method to determine the recoverable portion of input VAT incurred on mixed-use expenditure. The procedure:

1. Classifies all supplies made by the bank into taxable (standard-rated or zero-rated) and exempt (financial services under VAT Act s.12(a)) categories, and all input VAT into directly attributable (taxable-only; exempt-only; mixed-use) categories.
2. Applies the SARS-approved apportionment ratio (turnover-based standard formula, or alternative if a Binding Private Ruling is obtained) to the mixed-use input VAT pool.
3. Submits the VAT201 return and any net VAT payment to SARS within 25 days after the end of the VAT period.
4. Maintains the evidence chain — supply classification register, apportionment ratio calculation, input-VAT ledger — required for SARS audit.

The procedure is dormant in the build phase and activates at commencement of trading (the bank becomes a VAT vendor from its first taxable supply).

---

## 4. Trigger

- **Monthly primary trigger:** End of each VAT period (calendar month, unless SARS authorises bi-monthly). The VAT201 deadline is 25 days after period-end (or the last business day before that date for e-filing).
- **Initial trigger:** Before commencement of trading — Yael submits a VAT apportionment method proposal to SARS for approval (section 17(2) ruling request or confirmation that the standard turnover formula applies). The approved method is recorded as `VATApportionmentMethodApproved { method, effective_date, sars_ruling_reference }` and is the authoritative basis for all subsequent computations.
- **Annual trigger:** Financial year-end — Yael computes the final apportionment ratio for the year and reconciles it to the provisional ratios used in monthly returns. Any difference is adjusted in the final VAT201 of the year.
- **Ad-hoc trigger — supply reclassification:** If a new product or service is introduced that changes the taxable / exempt supply split materially (> 5% shift in the apportionment ratio), Yael reviews the classification and, if required, notifies SARS of the change.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | At period-end, the VAT engine ingests all revenue events from the income-statement projection, classified by supply type: taxable standard-rated (e.g. advisory fees, management fees), taxable zero-rated (e.g. certain cross-border services), and exempt financial services (interest income, dividends received, trading gains on financial instruments, spot FX spreads) | `system` | `@platform/tax/vat-apportionment-engine` (`PLANNED`) + `@platform/projections/income-statement` ✓ | Supply classification is based on the supply-classification register (a versioned configuration artefact maintained by Yael). New supply types require Yael review before classification is added to the register. |
| 2 | Compute provisional apportionment ratio: taxable supply value / total supply value for the period. For the first period of a new year, use the prior year's final ratio as the provisional ratio | `system` | `@platform/tax/vat-apportionment-engine` (`PLANNED`) | Standard SARS turnover-based formula unless a BPR is obtained for an alternative. Ratio is rounded to two decimal places per SARS practice. |
| 3 | Classify all input VAT incurred in the period into three buckets: (a) directly attributable to taxable supplies (100% recoverable); (b) directly attributable to exempt supplies (0% recoverable); (c) residual / mixed-use (apply apportionment ratio from Step 2). Emit `VATInputClassified { period, taxable_input, exempt_input, mixed_input, ratio_applied }` | `system` | `@platform/tax/vat-apportionment-engine` (`PLANNED`) + `@platform/projections/payables-ledger` (`PLANNED`) | Direct attribution is determined by the cost-centre / account coding of each input expense. Mixed-use costs (overheads, technology, staff) are the residual pool. |
| 4 | Compute recoverable input VAT: taxable-direct + (mixed-use × apportionment ratio); compute irrecoverable input VAT (embedded cost); emit `VATRecoverableComputed { period, recoverable_input, irrecoverable_input, output_vat, net_vat_payable }` | `system` | `@platform/tax/vat-apportionment-engine` (`PLANNED`) | Irrecoverable input VAT is expensed through P&L (not capitalised or deferred). |
| 5 | Generate the VAT201 return draft, including the output VAT, input VAT, and net amount payable / refundable; emit `VAT201DraftGenerated { period, draft_uri }` | `system` | `@platform/tax/vat-apportionment-engine` (`PLANNED`) + `@platform/document-store` ✓ | `draft_uri` is a BLAKE3-addressed immutable draft. |
| 6 | Yael reviews the VAT201 draft: verifies supply classification completeness, spot-checks large input-VAT items against invoices, confirms the apportionment ratio calculation, and checks that no exempt-supply transactions have been incorrectly included as taxable | `human` (Yael) | `@platform/document-store` ✓ | Yael must resolve all issues before Camille attestation. Common issues: uncoded overhead invoices in the wrong bucket; new supply types not yet classified. |
| 7 | Camille (CFO, governance) reviews and attests the VAT201: confirms the net VAT figure matches the cashflow plan, and signs off with `VAT201Attested { period, signatory: camille, attested_at }` | `human` (Camille) | `@platform/event-store` ✓ | **CFO attestation is the control event authorising SARS filing.** |
| 8 | Submit VAT201 to SARS via e-Filing; pay net VAT liability; emit `VAT201Filed { period, sars_reference, filed_at, net_vat_paid, attested_by: camille }` | `system` | `@platform/tax/sars-efiling-client` (`PLANNED`) | Submission deadline: 25 days after period-end. Late filing triggers SARS penalties under Tax Admin Act. |
| 9 | Annual reconciliation (at financial year-end): Yael computes the final apportionment ratio for the full year; compares to provisional ratios used in monthly returns; computes the year-end adjustment entry; records `VATAnnualApportionmentFinalised { year, final_ratio, cumulative_adjustment, adjustment_period }` | `human` (Yael) | `@platform/tax/vat-apportionment-engine` (`PLANNED`) | Year-end adjustment is filed in the final VAT201 of the year. Material deviations (> 5% between provisional and final ratio) are flagged to Camille and documented. |

---

## 6. Reconciliation

- **Events produced:**
  - `VATInputClassified { period, taxable_input, exempt_input, mixed_input, ratio_applied }` — Step 3.
  - `VATRecoverableComputed { period, recoverable_input, irrecoverable_input, output_vat, net_vat_payable }` — Step 4.
  - `VAT201DraftGenerated { period, draft_uri }` — Step 5.
  - `VAT201Attested { period, signatory, attested_at }` — Step 7.
  - `VAT201Filed { period, sars_reference, filed_at, net_vat_paid, attested_by }` — Step 8.
  - `VATAnnualApportionmentFinalised { year, final_ratio, cumulative_adjustment }` — Step 9.
  - `VATApportionmentMethodApproved { method, effective_date, sars_ruling_reference }` — initial setup.

- **Reconciliation invariants:**
  1. **Attestation gate:** Every `VAT201Filed` must have a preceding `VAT201Attested` from Camille.
  2. **Supply completeness:** Total VAT-period revenue in the VAT return reconciles to the income-statement projection for the same period. Deviations > ZAR 10k require Yael explanation.
  3. **Annual ratio reconciliation:** `VATAnnualApportionmentFinalised.final_ratio` falls within ±5 percentage points of the average provisional ratio. Greater deviations are flagged to Camille and documented as a supply-mix change.
  4. **Filing timeliness:** `VAT201Filed` emitted within 25 days of period-end. Late filing is a Vera finding escalated to Yael + Camille.
  5. **Input classification completeness:** All overhead invoices in the period have a supply-classification coding before the VAT engine closes the period. Unclassified amounts are held in a suspense bucket and flagged to Yael.

- **Failure mode:** VAT engine fails to produce draft → `VAT201DraftFailed { period, reason }`. Yael notified immediately; manual computation falls back to apportionment spreadsheet reviewed by Camille. SARS contacted for deadline extension if resolution not achievable within 20 days of period-end.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `VAT201Filed` event (SARS reference) | Event log | 5 years (Tax Admin Act) | Restricted |
| `VAT201Attested` event (CFO attestation) | Event log | 5 years | Restricted |
| VAT201 return document (SARS e-Filing) | Document store (linked from `VAT201Filed`) | 5 years | Restricted |
| `VATInputClassified` events (per period) | Event log | 5 years | Internal |
| Supply classification register (versioned configuration artefact) | Document store | 5 years (current version) + permanent version history | Internal |
| `VATAnnualApportionmentFinalised` events | Event log | 5 years | Restricted |
| SARS apportionment method ruling / approval (`VATApportionmentMethodApproved`) | Event log + document store | Permanent (founding document) | Restricted |
| Input-VAT supporting invoices (linked from `VATInputClassified`) | Document store | 5 years | Internal |

---

## 8. Manual steps

- **Step 6 — Yael VAT review:** Spot-check of large input-VAT items against source invoices requires human judgement; automated classification cannot handle all edge cases (e.g. a single invoice covering both taxable and exempt activities).
- **Step 7 — Camille CFO attestation:** CFO sign-off on VAT filing is a financial governance control; cannot be delegated without a formal `DelegatedSignatoryAppointed` event.
- **Step 9 — Annual ratio reconciliation (Yael):** The final apportionment ratio requires professional judgement on supply classification and materiality assessment.
- **Initial trigger — SARS method approval:** Engagement with SARS to obtain section 17(2) ruling confirmation is a manual process requiring Yael to draft and submit the ruling request, attend any SARS meeting, and document the approved method.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| VAT engine unavailable at period-end | `VAT201DraftFailed` event | Yael → Camille; manual fallback; SARS deadline extension |
| Supply misclassification detected (exempt treated as taxable) | Yael review (Step 6) or SARS audit | Yael + Camille; amended VAT201 filed; voluntary disclosure if material |
| Late VAT201 filing | `VAT201Filed` not emitted within 25 days | Vera finding → Yael + Camille; SARS penalty exposure |
| SARS e-Filing portal unavailable on deadline | `VAT201FilingFailed` event | Yael manual upload; SARS relief engaged |
| Annual ratio deviation > 5% | Year-end reconciliation (Step 9) | Yael + Camille; supply-mix change documented; SARS notification if required |
| SARS VAT audit | SARS audit notice | Yael + Camille; Thandiwe (CAE) engaged; all records made available per Tax Admin Act |

---

## 10. Related procedures

- [`corporate-tax-filing.md`](corporate-tax-filing.md) (PROC-TX-CIT-01) — irrecoverable input VAT is a deductible expense for CIT purposes; computed here and fed to the CIT computation.
- [`balance-sheet-substantiation.md`](balance-sheet-substantiation.md) — VAT payable / receivable is a balance-sheet item substantiated here.
- [`records-retention-disposal.md`](records-retention-disposal.md) — VAT records retention (5 years) is governed by the records management framework.
- `finsurv-reporting.md` (PLANNED) — cross-border services revenue that is zero-rated for VAT may overlap with FinSurv reporting obligations.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Atlas (Core banking platform architect, engineering) | Initial draft — POPULATED. All 12 sections authored; financial-services VAT apportionment for a bank documented; standard and alternative apportionment methods described; system capabilities marked PLANNED. |

---

## 12. Audit / assurance

- Vera monthly: attestation gate (invariant 1), filing timeliness (invariant 4), input classification completeness (invariant 5).
- Vera annual: supply completeness reconciliation (invariant 2), annual ratio reconciliation (invariant 3).
- Audit Committee reviews the annual VAT apportionment reconciliation and the final apportionment ratio as part of the tax compliance audit programme.
- SARS audit readiness: VAT201 returns, input-VAT ledger, supply classification register, and supporting invoices available in the document store with < 5-business-day retrieval SLA.
