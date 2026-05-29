---
policy-parent: FATCA / CRS Policy (planned — Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md)
last-reviewed: 2026-05-15
procedureId: PROC-TX-FATCA-01
title: FATCA/CRS annual submission
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-15
owner: Yael (Tax & treasury engineer, engineering) · Mira (Regulatory intelligence engineer, compliance)
status: POPULATED
policy-cited: FATCA / CRS Policy (planned — Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md)
system-capability: prototype/platform/tax/fatca-crs-engine (PLANNED)
---

# Procedure — FATCA / CRS annual submission

**Procedure ID:** PROC-TX-FATCA-01
**Owner:** Yael (Tax & treasury engineer, engineering) · Mira (Regulatory intelligence engineer, compliance)
**Approval:** Audit Committee
**Cadence:** Annual (SARS submission deadline: 31 July following the reporting year for both FATCA and CRS); Continuous (FATCA / CRS due-diligence events at client onboarding and annually)
**Version:** v0.1 — 2026-05-15
**Status:** POPULATED

---

## 1. Source policy

- `FATCA / CRS Policy v0.1` (planned — under `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md`) — primary source; defines the bank's FATCA classification as a Reporting South African Financial Institution (Reporting SAFI), CRS classification, due-diligence procedures for identifying US-reportable accounts (FATCA) and CRS-reportable accounts, and the annual reporting workflow.
- `Policies/aml-cft-policy-v1.md` — AML/CFT policy (co-source; KYC due-diligence for FATCA / CRS shares infrastructure with the KYC procedure).

Obligation chain:

```
FATCA IGA between South Africa and the United States (Annex II — Reporting SAFI obligations)
  + CRS (Common Reporting Standard, OECD) implemented via Tax Administration Act 28/2011
    → FATCA / CRS Policy v0.1
      → PROC-TX-FATCA-01 (this procedure)
        → @platform/tax/fatca-crs-engine (PLANNED)
```

---

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FC-15` | Identify US-reportable accounts and submit FATCA XML to SARS annually (FATCA IGA + Tax Admin Act). |
| `ORG-FC-16` | Identify CRS-reportable accounts and submit CRS XML to SARS annually (CRS + Tax Admin Act). |
| `ORG-TX-06` | FATCA classification and reporting (cross-reference to `ORG-FC-15`). |
| `ORG-TX-07` | CRS classification and reporting (cross-reference to `ORG-FC-16`). |
| `ORG-TX-04` | Maintain FATCA / CRS records per Tax Administration Act 28/2011 retention requirements (5 years). |
| FATCA IGA (SA–US), Article 2.2 + Annex II | Reporting SAFI must report US-reportable accounts annually to SARS; SARS transmits to IRS via IDES. Annex II exempt institutions and products applied. |
| CRS (OECD Standard), Sections II–IX | Due diligence on pre-existing and new account holders; self-certification for new accounts; annual reporting to SARS of CRS-reportable accounts (account balance, income, proceeds). |
| Tax Administration Act 28/2011, Chapter 16A | SARS AEOI (Automatic Exchange of Information) obligations for reporting financial institutions; FATCA and CRS submission via SARS AEOI portal. |

---

## 3. Purpose

Identify and annually report US-reportable accounts (FATCA) and tax-resident-reportable accounts in participating CRS jurisdictions to SARS by 31 July following each reporting year. The procedure:

1. Maintains a continuously-updated FATCA / CRS classification for every account holder based on self-certification collected at onboarding and re-certification events.
2. At year-end, identifies all reportable accounts (US persons with accounts exceeding the FATCA de minimis threshold; non-SA tax residents in CRS participating jurisdictions) and computes the reportable figures (account balance as of 31 December; gross amounts of interest, dividends, and other income; gross proceeds from asset sales).
3. Generates the FATCA XML (Schema 2.x) and CRS XML (OECD Schema 2.x) in the exact format required by the SARS AEOI portal.
4. Reviews, attests, and submits the XML reports to SARS by 31 July.
5. Maintains the due-diligence record for every account — self-certification, review events, reportability classification — as required by the FATCA IGA and CRS for potential SARS or IRS inspection.

The procedure activates at commencement of trading (when the bank first holds accounts for clients who may be US persons or non-SA tax residents).

---

## 4. Trigger

- **Annual reporting trigger:** `AnnualCloseCompleted { year }` event (31 December year-end) initiates the FATCA / CRS identification and reporting cycle. Deadline: SARS AEOI portal submission by 31 July.
- **Continuous due-diligence trigger:** `ClientOnboardingCompleted { client_id }` event — the KYC / onboarding procedure collects self-certification (W-9 or W-8 for FATCA; self-certification form for CRS). Classification is set at onboarding.
- **Annual self-certification re-review trigger:** For pre-existing accounts, annual review of whether classification has changed (change in address, new self-certification, US indicia detected). `FATCACRSClassificationReviewed { client_id, year, classification, change_flag }` event emitted.
- **Change-of-circumstance trigger:** A material change of circumstance (e.g. client notifies change of tax residency, new US indicia detected in KYC data) triggers an out-of-cycle reclassification.

---

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | At client onboarding, collect FATCA self-certification: (a) W-9 (US persons — confirm US tax identification number); (b) W-8BEN / W-8BEN-E (non-US persons — certify non-US status); collect CRS self-certification form (tax residency jurisdiction(s) + TIN). Emit `FATCACRSSelfCertificationReceived { client_id, fatca_status, crs_tax_residency, tin, certified_at }` | `system` + `human` (KYC analyst / Zara) | `@domains/compliance/kyc-onboarding` ✓ (partial) | Self-certification is the primary FATCA / CRS evidence. Missing or refused self-certifications trigger the "undocumented account" or "recalcitrant account" treatment. |
| 2 | Apply FATCA classification logic: US person (W-9) → Reportable US Account; non-US person with no US indicia → Non-Reportable; non-US person with US indicia (US birthplace, US mailing address, US phone, standing transfer instruction to US, C/O or hold-mail address only) → Apply enhanced due diligence before classifying; Financial institution → apply FATCA entity classification (NFFE, FFI, exempt entity). Emit `FATCAClassificationAssigned { client_id, classification, indicia_detected, effective_date }` | `system` | `@platform/tax/fatca-crs-engine` (`PLANNED`) | US indicia detection is an automated check against KYC data fields. Enhanced due diligence for indicia requires Yael review. |
| 3 | Apply CRS classification: determine tax residency from self-certification; check for CRS participating jurisdiction (OECD AEOI portal list); assign CRS reportability. Emit `CRSClassificationAssigned { client_id, tax_residency_jurisdictions, crs_reportable, effective_date }` | `system` | `@platform/tax/fatca-crs-engine` (`PLANNED`) | The CRS participating-jurisdiction list is a SARS-maintained external reference updated annually. Yael is responsible for updating the reference in the engine before each annual cycle. |
| 4 | Annual re-review (each calendar year): for all pre-existing accounts, check for changes in KYC data that may indicate a change of FATCA / CRS status (change of address, new self-certification, US indicia). Emit `FATCACRSClassificationReviewed { client_id, year, prior_classification, new_classification, change_flag }` | `system` | `@platform/tax/fatca-crs-engine` (`PLANNED`) | Changed classifications trigger an updated `FATCAClassificationAssigned` or `CRSClassificationAssigned` event. Yael reviews any changes before the annual report is generated. |
| 5 | At `AnnualCloseCompleted { year }`: identify all US-reportable accounts (FATCA) with year-end account balance ≥ USD 50,000 (individual) or ≥ USD 250,000 (entity, pre-existing); all CRS-reportable accounts without de minimis threshold. Query account balances, interest paid, dividends paid, and gross asset-sale proceeds from the ledger projection | `system` | `@platform/tax/fatca-crs-engine` (`PLANNED`) + `@platform/projections/account-balance` (`PLANNED`) | FATCA de minimis thresholds apply to pre-existing individual accounts; new accounts have no de minimis. CRS has no de minimis threshold. |
| 6 | Generate FATCA XML report (OECD FATCA Schema 2.0 / IRS FATCA IDES format): one `AccountReport` per reportable US account, including account number, account holder name / TIN, account balance, income, and gross proceeds | `system` | `@platform/tax/fatca-crs-engine` (`PLANNED`) | Schema version must match SARS AEOI portal requirements at the time of submission. Yael confirms current schema version before generation. |
| 7 | Generate CRS XML report (OECD CRS Schema 2.0): one `AccountReport` per reportable account per CRS jurisdiction, including account number, account holder name / TIN / tax residency, account balance, income, and gross proceeds | `system` | `@platform/tax/fatca-crs-engine` (`PLANNED`) | Multiple `AccountReport` entries for account holders with tax residency in multiple CRS jurisdictions. |
| 8 | Yael reviews the FATCA and CRS XML reports: verifies account count, spot-checks reportable figures against source account data, confirms TIN format compliance, checks that no exempt accounts are incorrectly included. Raises issues in the tracking register | `human` (Yael) | `@platform/document-store` ✓ | All issues must be resolved before Camille attestation. Common issues: missing TINs (require client follow-up); incorrect account classification at onboarding. |
| 9 | Mira (Regulatory intelligence engineer, compliance) reviews the FATCA / CRS report for regulatory completeness: confirms SARS schema compliance, checks that the GIIN (Global Intermediary Identification Number) is current and registered with the IRS, verifies participating-jurisdiction list is up to date | `human` (Mira) | `@platform/document-store` ✓ | Mira's review is the compliance gate for schema and regulatory compliance. Yael's review is the data-accuracy gate. |
| 10 | Camille (CFO, governance) attests the FATCA and CRS reports; emits `FATCAReportAttested { year, signatory: camille, attested_at }` and `CRSReportAttested { year, signatory: camille, attested_at }` | `human` (Camille) | `@platform/event-store` ✓ | **CFO attestation is the control event authorising SARS AEOI portal submission.** |
| 11 | Submit FATCA XML and CRS XML to SARS via AEOI portal; capture SARS receipt references; emit `FATCAReportFiled { year, sars_reference, filed_at, account_count }` and `CRSReportFiled { year, sars_reference, filed_at, account_count }` | `system` | `@platform/tax/sars-aeoi-client` (`PLANNED`) | Submission deadline: 31 July following the reporting year. SARS transmits to IRS (FATCA) and participating jurisdictions' tax authorities (CRS) via OECD AEOI hub. |

---

## 6. Reconciliation

- **Events produced:**
  - `FATCACRSSelfCertificationReceived { client_id, fatca_status, crs_tax_residency, tin, certified_at }` — at onboarding.
  - `FATCAClassificationAssigned { client_id, classification, indicia_detected, effective_date }` — Step 2.
  - `CRSClassificationAssigned { client_id, tax_residency_jurisdictions, crs_reportable, effective_date }` — Step 3.
  - `FATCACRSClassificationReviewed { client_id, year, prior_classification, new_classification, change_flag }` — annual review.
  - `FATCAReportAttested + CRSReportAttested { year, signatory, attested_at }` — Steps 10a/10b.
  - `FATCAReportFiled + CRSReportFiled { year, sars_reference, filed_at, account_count }` — Step 11.

- **Reconciliation invariants:**
  1. **Classification completeness:** Every active account has a current `FATCAClassificationAssigned` and `CRSClassificationAssigned` event. Accounts without classification are flagged as `undocumented` and subject to the enhanced due-diligence path.
  2. **Self-certification age:** CRS self-certifications must not exceed 3 years without re-certification for pre-existing accounts. Vera checks annually.
  3. **Attestation gate:** Every `FATCAReportFiled` and `CRSReportFiled` must have a preceding attestation event from Camille.
  4. **Account-balance reconciliation:** Total account balances in the FATCA / CRS reports reconcile to the period-end account-balance projection for the same set of accounts. Deviations are Vera findings.
  5. **Filing timeliness:** Both `FATCAReportFiled` and `CRSReportFiled` emitted before 31 July. Late filing is a Vera finding escalated to Yael + Mira + Camille.

- **Failure mode:** FATCA / CRS engine fails → `FATCACRSReportFailed { year, reason }`. Yael and Mira notified; manual XML generation falls back to SARS-provided bulk-upload template reviewed by Yael. SARS contacted for deadline extension if resolution not achievable before 31 July.

---

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `FATCACRSSelfCertificationReceived` events + supporting documents (W-9, W-8, self-certification forms) | Event log + document store | 5 years from end of year (Tax Admin Act; FATCA IGA) | Restricted — PII |
| `FATCAClassificationAssigned` + `CRSClassificationAssigned` events | Event log | 5 years | Restricted — PII |
| `FATCACRSClassificationReviewed` events (annual) | Event log | 5 years | Restricted |
| `FATCAReportFiled` + `CRSReportFiled` events (SARS references) | Event log | 5 years | Restricted |
| FATCA XML report (SARS AEOI submission) | Document store (BLAKE3-addressed) | 5 years | Confidential — tax/regulatory |
| CRS XML report (SARS AEOI submission) | Document store (BLAKE3-addressed) | 5 years | Confidential — tax/regulatory |
| SARS AEOI receipt / acknowledgement | Document store | 5 years | Restricted |
| GIIN registration certificate (IRS) | Document store | Permanent | Restricted |

---

## 8. Manual steps

- **Step 1 — Self-certification collection at onboarding:** Physical or wet-signature W-9 / W-8 forms may be required by institutional counterparties; the KYC team collects and scans these. Digital self-certification via the client onboarding portal can be automated but requires legal sign-off on electronic signature validity.
- **Step 8 — Yael data-accuracy review:** Manual verification of TIN format, account figure spot-checks, and missing-TIN resolution (client follow-up required) cannot be fully automated.
- **Step 9 — Mira regulatory review:** Schema compliance check and GIIN currency verification require regulatory knowledge that cannot be embedded in the engine without ongoing updates.
- **Step 10 — Camille CFO attestation:** CFO attestation of tax reports filed with SARS is a governance control.
- **Enhanced due diligence (Step 2 US indicia):** Where US indicia are detected on a non-US self-certified account, Yael must review and make a judgement call on re-classification. This cannot be automated.

---

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| FATCA / CRS engine unavailable at year-end | `FATCACRSReportFailed` event | Yael + Mira → Camille; manual XML fallback; SARS deadline extension |
| Missing client TIN at report generation | Engine flags missing TIN in reportable accounts | Yael client follow-up; if unresolved, account reported with `TIN_NOT_AVAILABLE_INDICIA` code |
| GIIN not registered or expired | Mira review (Step 9) | Yael + Mira; IRS GIIN renewal; SARS notified of late GIIN as needed |
| Late FATCA / CRS filing (past 31 July) | `FATCAReportFiled` / `CRSReportFiled` not emitted by deadline | Vera finding → Yael + Mira + Camille + Thandiwe; SARS penalty exposure; IRS / OECD AEOI potential NTA |
| Classification error (US person undetected) | SARS or IRS audit / query | Yael + Mira; amended FATCA XML; voluntary correction if not yet queried |
| SARS AEOI portal unavailable | `FATCAFilingFailed` / `CRSFilingFailed` event | Yael manual submission; SARS contact for alternative submission path |

---

## 10. Related procedures

- [`kyc-onboarding.md`](kyc-onboarding.md) — FATCA / CRS self-certification is collected as part of the KYC onboarding flow; this procedure relies on the KYC data and documentation.
- [`kyc-recurring.md`](kyc-recurring.md) — annual KYC review includes FATCA / CRS classification re-review.
- [`corporate-tax-filing.md`](corporate-tax-filing.md) (PROC-TX-CIT-01) — FATCA / CRS uses the same SARS e-Filing infrastructure; tax records retention overlaps.
- [`records-retention-disposal.md`](records-retention-disposal.md) — 5-year records retention for FATCA / CRS documentation.
- [`popia-dsar.md`](popia-dsar.md) — FATCA / CRS self-certification data contains PII subject to POPIA access and correction rights.

---

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-15 | Atlas (Core banking platform architect, engineering) | Initial draft — POPULATED. All 12 sections authored; FATCA IGA + CRS (OECD) + Tax Admin Act obligations documented; due-diligence lifecycle + annual XML reporting workflow included; system capabilities marked PLANNED. |

---

## 12. Audit / assurance

- Vera annual: classification completeness (invariant 1), self-certification age (invariant 2), attestation gate (invariant 3), account-balance reconciliation (invariant 4), filing timeliness (invariant 5).
- Audit Committee receives annual FATCA / CRS report summary — account count by classification, jurisdiction coverage, TIN completeness rate.
- Mira (Regulatory intelligence engineer, compliance) monitors OECD AEOI participating-jurisdiction list updates and SARS AEOI portal schema versions; surfaced as findings if updates are not incorporated before the annual reporting cycle.
- SARS / IRS FATCA compliance review readiness: all self-certification documents, classification events, and filed XML reports available in the document store with < 5-business-day retrieval SLA.
