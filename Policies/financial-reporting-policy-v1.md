---
policy-id: financial-reporting-policy
title: Financial Reporting Policy v1
version: "1"
status: IN FORCE
owner: Camille (Chief Financial Officer, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - Companies Act 71 of 2008 s.29–31 (annual financial statements)
  - IFRS as adopted by the IASB (accounting framework)
  - Banks Act 94 of 1990 s.73–79 (annual accounts and audit)
  - Regulations Relating to Banks reg.35 (published financial statements)
  - IAS 1 (Presentation of Financial Statements)
  - IAS 8 (Accounting Policies, Changes in Accounting Estimates and Errors)
  - IFRS 7 (Financial Instruments: Disclosures)
  - IFRS 15 (Revenue from Contracts with Customers)
  - D-REGULATORY-READINESS-GATE-PLAN
author: Camille (Chief Financial Officer, governance) + Bea (Accounting & financial reporting engineer, engineering)
date: 2026-05-22
summary: Financial Reporting Policy covering AFS preparation, IFRS presentation elections, going-concern assessment, materiality thresholds, external auditor relationship governance, publication timelines, and management accounts vs statutory accounts distinction. CORPORATE-BIND — applies from incorporation.
decision-required: false
riskTaxonomy:
  - RT-FR
  - RT-GV
---

# Financial Reporting Policy v1

> **Authors.** Camille (Chief Financial Officer, governance) — lead; Bea (Accounting & financial reporting engineer, engineering) — co-author.
> **Status.** CORPORATE-BIND. Financial reporting obligations under the Companies Act 71 of 2008 and IFRS bind from the date of incorporation of Hoz Bank Limited, not from commencement of trading. The preparation of annual financial statements in compliance with IFRS is a standing obligation from the first financial year; the Banks Act 94 of 1990 annual account obligations (s.73–79) and reg.35 publication obligations apply from registration as a bank.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. Financial Reporting Policy — Overarching

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim per `D-THIN-HUMAN-LAYER-MINIMUM`) · **Cadence:** Annual; triggered on material change to accounting policies, IFRS standards adoption, or auditor relationship · **Citation:** Companies Act 71 of 2008 s.29–31 + IFRS (IAS 1, IAS 8) + Banks Act 94 of 1990 s.73–79 + Regulations Relating to Banks reg.35

### Purpose

This policy governs how Hoz Bank Limited (the "Bank") prepares, presents, and publishes its financial statements. Its purpose is to ensure that: (i) the Bank's annual financial statements are prepared in accordance with IFRS as adopted by the IASB and comply with the Companies Act 71 of 2008 and Banks Act 94 of 1990; (ii) accounting policy elections are made explicitly and documented consistently; (iii) going-concern assessment is performed at each reporting date; (iv) materiality thresholds are established for disclosure and error correction decisions; (v) the external auditor relationship is governed appropriately; and (vi) publication timelines meet regulatory and statutory requirements.

The policy sits at the *policy* layer of the Reg → Policy → Procedure → System Capability chain (Principle 2). Procedures under this policy (including `Procedures/by-policy/afs-preparation.md`, `Procedures/by-policy/going-concern-assessment.md`, and `Procedures/by-policy/management-accounts-production.md`) operationalise it. The GL system, financial statement production engine, and consolidation tools are the system capabilities. This policy does not reproduce IFRS standards; it records the Bank's elections and governance decisions above those standards.

### Principles

- **IFRS as the governing accounting framework.** The Bank prepares its financial statements in accordance with International Financial Reporting Standards as adopted by the International Accounting Standards Board. No locally-modified IFRS variant applies unless the Companies Act or Banks Act requires a specific departure; any required departure is disclosed prominently.
- **Consistency of accounting policies.** Accounting policies, once elected, are applied consistently across reporting periods. Changes to accounting policies require a formal policy amendment approved by the Board (CEO interim), a retrospective restatement where required by IAS 8, and an `AccountingPolicyChanged { policyId, priorPolicy, newPolicy, effectiveDate, ifrsBasis }` typed event in the event log.
- **Annual financial statements as the primary statutory artefact.** The AFS is the primary statutory output. Management accounts are a periodic operating tool; they are not substitutes for the AFS and must not be presented to third parties as compliant financial statements without an explicit statement of their non-statutory nature.
- **External audit as a compliance obligation, not an operational review.** The external auditor's opinion is required by Companies Act s.30 and Banks Act s.74. The auditor relationship is governed under the independence standards in IRBA Code of Professional Conduct and ISA 260; the CFO does not manage the auditor relationship for operational convenience.
- **Events-first financial reporting.** The GL event log (per Principle 1) is the single source of truth for all financial statement line items. AFS figures are derived from queries over the event log; no standalone spreadsheet or summary figure is the canonical source. The `FinancialStatementPublished { period, filingType, contentHash, auditorOpinion }` event is the canonical record of each AFS publication.

### Roles

Camille (Chief Financial Officer, governance) is the policy owner. Camille is responsible for: overseeing the AFS preparation process; making or recommending accounting policy elections; managing the external auditor relationship at the governance level; presenting the AFS to the Board for approval; signing off on going-concern assessments. Bea (Accounting & financial reporting engineer, engineering — reports to Camille) builds and operates the financial statement production engine, the GL reconciliation harness, and the management accounts production process. Bea produces the `FinancialStatementPublished` events and the management accounts on the cadence set in §5. Owen (Company Secretary, governance) manages the Companies Act filing obligations (annual return, AFS lodgement with CIPC) and Banks Act s.74 audit report filing with the SARB. The CEO approves the AFS on behalf of the Board (interim).

---

## 2. IFRS Presentation Elections

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) for initial elections; Helena (Chief Risk Officer, governance) for risk disclosure elections · **Cadence:** Reviewed at each new IFRS standard adoption; otherwise stable · **Citation:** IAS 1 (Presentation of Financial Statements), IFRS 7 (Financial Instruments: Disclosures), IFRS 9 (Financial Instruments — classification and measurement)

### 2.1 Statement of Financial Position

The Bank presents a classified statement of financial position, separating current and non-current assets and liabilities per IAS 1 paragraphs 60–76. Given the Bank's financial institution nature, a liquidity-based presentation (per IAS 1 paragraph 60) is elected for the main body of the statement of financial position, consistent with common banking practice, with current/non-current supplementary disclosure in the notes. The exact format is set in `Procedures/by-policy/afs-preparation.md`.

### 2.2 Statement of Profit or Loss and Other Comprehensive Income

The Bank presents a single statement of profit or loss and OCI (combined format) per IAS 1. Within the statement, items of OCI are classified by whether they may be reclassified to profit or loss. The function-of-expense method is used for the presentation of expenses in the profit or loss section. Net interest income and non-interest revenue are presented as separate line items in the income statement; trading revenue (fair-value gains/losses on trading instruments) is presented as a sub-line of non-interest revenue.

### 2.3 IFRS 9 Classification Elections

The Bank's financial instrument classification elections under IFRS 9 are governed by `Policies/accounting-policies-ifrs-v1.md` (which is incorporated by reference into this policy for the IFRS 9 classification and measurement layer). Key elections recorded here:

- **Trading book instruments** (JSE bonds/equities held for client facilitation, OTC IRD): classified at fair value through profit or loss (FVTPL) by default — mandatory FVTPL for instruments held for trading.
- **Liquidity buffer — HQLA portfolio**: classified at amortised cost or FVOCI (fair value through OCI) subject to the Bank's business model assessment per IFRS 9 paragraph 4.1.2; elections documented in `Procedures/by-policy/afs-preparation.md`.
- **Designated at fair value through OCI**: for equity instruments not held for trading (if any); election is irrevocable on an instrument-by-instrument basis.

### 2.4 IFRS 7 Risk Disclosure

The Bank's IFRS 7 disclosures are co-authored by Camille and Helena. The disclosures cover: credit risk (maximum exposure, collateral, credit quality per IFRS 7.35A–35N), market risk (sensitivity analysis per IFRS 7.40–42), and liquidity risk (maturity analysis per IFRS 7.39). The IFRS 7 disclosure pack is a standard section of the AFS notes; the template is in `Procedures/by-policy/afs-preparation.md`.

---

## 3. Going-Concern Assessment

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) · **Cadence:** At each AFS date; triggered on any material adverse capital or liquidity event · **Citation:** IAS 1 paragraphs 25–26 (going-concern), Banks Act 94 of 1990 s.68 (capital adequacy), Companies Act 71 of 2008 s.29 (annual financial statements), Regulations Relating to Banks reg.26 (liquidity)

### Purpose

The Bank's Board must confirm that the Bank is a going concern at each annual reporting date. The going-concern basis of preparation is the default per IAS 1 paragraph 25; if material uncertainty exists regarding the Bank's ability to continue as a going concern, that uncertainty must be disclosed; if the going-concern basis is not appropriate, the financial statements are prepared on an alternative basis and that fact is disclosed.

At the build phase, no regulatory capital is held and no trading activities are conducted; the going-concern assessment covers the Bank's ability to fund the build phase and reach the pre-licence go-live readiness gate. At licence-day and thereafter, the assessment covers regulatory capital adequacy, liquidity, and the ability to service obligations as they fall due.

### Assessment Framework

Camille performs the going-concern assessment with inputs from: Helena (risk exposure and capital adequacy); Eitan (Treasurer, governance — liquidity and funding position); the CEO (strategic plan and capital-raise pipeline). The assessment considers:

1. **Capital position:** current CET1 ratio and headroom above the regulatory minimum (4.5% CET1 + SARB Pillar 2A add-on + capital conservation buffer); capital trajectory under the ICAAP base case and adverse scenario.
2. **Liquidity position:** LCR and NSFR against regulatory minimums (100%); available liquidity buffer; funding concentration and maturity profile.
3. **Operating cash flows:** ability to service operational costs for at least 12 months from the reporting date.
4. **Strategic plan viability:** board-approved business plan and any material uncertainty in executing it.

The outcome of the assessment is a `GoingConcernAssessed { period, outcome, keyAssumptions, signatories }` typed event. If material uncertainty is identified, a `GoingConcernMaterialUncertaintyIdentified { period, nature, mitigants }` event is also filed; Camille presents the findings to the CEO and, at licence-day, the Board AC and external auditor within 5 business days.

---

## 4. Materiality Thresholds

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) · **Cadence:** Set at the start of each financial year; reviewed if total assets or revenues change materially · **Citation:** IAS 1 paragraphs 7 and 29–31 (materiality and aggregation), IAS 8 paragraphs 5 and 41–53 (error correction materiality), IFRS Practice Statement 2 (Making Materiality Judgements)

### Quantitative Materiality Thresholds

Materiality thresholds are set by Camille at the start of each financial year, calibrated to the Bank's total assets, revenues, and capital position, and approved by the Board (CEO interim). The following thresholds are operative from the effective date of this policy (build-phase calibration; recalibrated at first year-end):

| Threshold type | Level | Basis |
|---|---|---|
| Overall materiality (AFS) | 5% of net assets (equity) | Typical for financial institutions in build phase |
| Performance materiality | 75% of overall materiality | Reduces detection risk |
| Trivial (clearly inconsequential) | 5% of overall materiality | Not aggregated; no disclosure required |
| Error correction trigger (prior periods) | 10% of overall materiality | Restatement required if cumulative error exceeds this |

These thresholds are recorded in a `MaterialityThresholdsSet { period, overallMateriality, performanceMateriality, trivial, errorCorrectionTrigger, rationale }` typed event at the start of each year. The external auditor's materiality assessment is independent; the Bank's materiality does not constrain the auditor's independent assessment.

---

## 5. Publication Timeline

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) · **Cadence:** Annual; aligned to statutory deadlines · **Citation:** Companies Act 71 of 2008 s.30 (six-month filing deadline after year-end), Banks Act 94 of 1990 s.74–75 (SARB submission of annual accounts and auditor report), Regulations Relating to Banks reg.35 (published financial statements within four months of year-end for a bank)

### Statutory Deadlines

| Milestone | Deadline | Responsible |
|---|---|---|
| Draft AFS ready for audit | T+60 days after year-end | Bea |
| Audit fieldwork complete | T+90 days after year-end | External auditor |
| Board approval of AFS | T+100 days after year-end | CEO (Board interim) |
| Submission to SARB (reg.35) | T+120 days after year-end (four months) | Camille + Owen |
| CIPC lodgement (Companies Act s.30) | T+180 days after year-end (six months) | Owen |
| Publication on Bank's website | Same day as SARB submission | Bea + Owen |

Camille owns the overall timeline; any milestone at risk of missing its deadline is escalated to the CEO at least 15 business days before the deadline. A missed statutory deadline is a material compliance breach reportable to the SARB and is a `ComplianceObligationBreached { obligation, deadline, actualDate, escalationPath }` event.

---

## 6. Management Accounts vs Statutory Accounts

**Owner:** Camille (Chief Financial Officer, governance) · **Cadence:** Management accounts: monthly; Statutory accounts: annual · **Citation:** IAS 1 (statutory basis), IAS 34 (interim financial reporting — applicable if interim reports are published externally)

### Distinction

Management accounts are internal financial reports prepared on a monthly basis for internal governance (ALCO, CEO, Board risk oversight). They are not audited, not filed with any regulator, and not published externally. They are produced on an IFRS-consistent basis but may include non-GAAP management performance metrics (e.g., adjusted revenue excluding mark-to-market volatility) as supplementary columns, clearly labelled as non-GAAP. The `ManagementAccountsProduced { period, approvedBy, contentHash }` event is the canonical record of each monthly close.

Statutory accounts (the Annual Financial Statements) are the legally binding presentation of the Bank's financial position and performance. They are prepared by Bea, audited by the external auditor, approved by the Board, and filed with the SARB and CIPC per §5. No figure in the statutory accounts may be sourced from a non-event-log-derived calculation; every line item traces to Principle 1.

### Reconciliation

Camille prepares a management-to-statutory reconciliation for any difference between the management account figures and the statutory AFS figures for the same period (e.g., timing differences, non-GAAP adjustments, reclassifications required by IFRS presentation). The reconciliation is an appendix to the Board-approved AFS. Unexplained differences of more than the trivial materiality threshold require investigation by Bea and sign-off by Camille before the AFS is approved.

---

## 7. External Auditor Relationship

**Owner:** Camille (Chief Financial Officer, governance) · **Approval:** Board (CEO interim) appoints and removes the external auditor; the SARB must be notified of auditor appointment and any change · **Cadence:** Auditor appointment reviewed at each AGM; auditor rotation per IRBA and Companies Act requirements · **Citation:** Companies Act 71 of 2008 s.90–94 (appointment of auditor), Banks Act 94 of 1990 s.74–75 (SARB notification and auditor report), IRBA Code of Professional Conduct (independence requirements)

### Governance Principles

- **Independence is absolute.** The external auditor must be independent of the Bank under the IRBA Code. No partner or staff member of the audit firm provides non-audit services that impair independence. Camille confirms independence in writing with the audit partner prior to each year-end audit commencement.
- **SARB notification.** Any change of external auditor requires prior written notification to the SARB per Banks Act s.75. Owen manages the SARB communication; an `AuditorChangedNotifiedToSARB { outgoingAuditor, incomingAuditor, sarb NotificationDate }` event is the canonical record.
- **Audit fee governance.** Audit fee negotiations are managed by Camille with Board oversight. Fees must be set at a level that does not create financial dependence by the auditor on the Bank and does not impair independence. Fee agreements are tabled at the Audit Committee (once constituted; CEO interim approval in the build phase).
- **Management representation letter.** Camille signs the management representation letter for each audit, confirming the accuracy and completeness of information provided to the auditor. The representation letter is retained as part of the audit file; its existence is recorded as a `ManagementRepresentationLetterSigned { period, signatories, auditFirm }` event.

---

## 8. Substrate Dependencies and Gaps

- **Financial statement production engine (Bea).** Derives AFS line items from GL event log queries. Discharge exit signal: `FinancialStatementPublished { period, filingType, contentHash, auditorOpinion }` event on first year-end close.
- **Going-concern assessment tooling (Bea + Helena).** Capital and liquidity input feeds to support the IAS 1 going-concern assessment. Currently manual; substrate build formalises the data pipeline.
- **External auditor engagement.** External auditor appointment is a licence-application gate item; SARB requirement for a registered auditor before banking licence grant. Currently unengaged (build phase).

---

## 9. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Camille (Chief Financial Officer, governance) + Bea (Accounting & financial reporting engineer, engineering) | Initial policy authored. Seven sections: (1) Overarching — IFRS framework, consistency principle, external audit obligation, events-first accounting; (2) IFRS Presentation Elections — SoFP classification, P&L format, IFRS 9 elections, IFRS 7 risk disclosures; (3) Going-Concern Assessment — framework, capital/liquidity inputs, typed event output; (4) Materiality Thresholds — quantitative table, annual recalibration; (5) Publication Timeline — statutory deadline table for reg.35, CIPC, website; (6) Management Accounts vs Statutory Accounts — distinction, non-GAAP labelling, reconciliation requirement; (7) External Auditor Relationship — independence, SARB notification, fee governance. CORPORATE-BIND. |
