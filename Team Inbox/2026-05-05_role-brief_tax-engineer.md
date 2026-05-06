# Role brief — Tax engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Tax engineer** — encodes every applicable South African tax obligation (direct, indirect, withholding, employment, third-party reporting, international exchange) into automated computation, submission, and evidence pipelines.

## 2. Why this role exists

A bank touches almost every tax SARS administers. The standard practice — quarterly scrambles into spreadsheets — is incompatible with this project's premise. This role makes tax a continuously running output of the ledger and the customer/employee/transaction data, with submissions to SARS as deterministic artefacts.

## 3. Scope of work (priority order)

1. Corporate income tax and provisional tax — current and deferred, IFRS 12 alignment with accounting.
2. VAT — VAT 201, financial-services apportionment (a banking specialty), input-tax recovery method, VAT on imported services.
3. Employment taxes (with HR engineer) — PAYE, UIF, SDL, EMP201, EMP501, IRP5/IT3(a).
4. Withholding taxes — Dividends Tax, Interest WHT (with treaty-relief logic), Royalties WHT, WHT on foreign-entertainers/sportspersons (rarely relevant), service-fee WHT (where applicable).
5. Third-party data: IT3(b) interest, IT3(c) capital gains, IT3(s) tax-free savings, IT3(d) (where applicable).
6. Securities Transfer Tax on equities.
7. International information reporting — FATCA, CRS — XML production and submission via SARS eFiling.
8. Tax accounting controls — current and deferred tax computation, effective tax rate analytics, uncertain tax positions (IFRIC 23).
9. Excise / customs / specific levies if and when relevant.
10. Transfer pricing documentation for cross-border intra-group flows (if multi-entity).

## 4. Required expertise

- South African tax law in real depth, with banking specifics.
- VAT for financial services — apportionment methods and the SARS rulings landscape.
- Tax-engine and rules-management design for high-volume environments.
- SARS eFiling and Modernised Third Party Data Submission Service (3PDSS) integration.
- IFRS tax accounting (IAS 12, IFRIC 23).

## 5. Desirable expertise

- Big-Four banking-tax experience or in-house tax at a SA bank.
- HEDQF / specialist tax certification (Master of Tax, HDip Tax) preferred.
- Experience implementing FATCA/CRS XML production at scale.

## 6. Regulatory / certification requirements

- Income Tax Act 58 of 1962.
- Value-Added Tax Act 89 of 1991.
- Tax Administration Act 28 of 2011.
- Securities Transfer Tax Act 25 of 2007.
- Customs and Excise Act 91 of 1964 (only as needed).
- SARS Business Requirement Specifications: PAYE, EMP201/501, IT3(b)/(c)/(s), Dividends Tax, FATCA, CRS, IRP5/IT3(a).
- OECD CRS standard and Multilateral Competent Authority Agreement.
- Registered tax practitioner (SARS / RCB).

## 7. Interfaces

- **Accounting engineer** — current/deferred tax flows into the financial statements.
- **HR engineer** — payroll taxes share the employment data and submissions.
- **Compliance engineer** — FATCA/CRS classifications come from the customer file.
- **Trading systems engineer** — STT, dividends-tax, WHT triggers at booking time.
- **Operations & payments engineer** — withholding-tax mechanics on cross-border payments.
- **Internal audit engineer** — control evidence on tax processes.

## 8. Success criteria — first 90 days

- Tax-obligation register: every applicable tax mapped to a return, a cadence, and a data source.
- VAT 201 producible in test from live transaction data, including a documented apportionment method.
- IT3(b) and Dividends Tax declarations producible in test.
- FATCA/CRS XML pipeline scaffolded with SARS test-environment connectivity.
- IFRS current/deferred tax computation agreed with accounting and reproducible.

## 9. Principle alignment

**P1 — Events as source of truth.** VAT 201, EMP201/501, IT3 outputs, Dividends Tax declarations, STT computations, and FATCA/CRS reports are queries over the event log and reference data. Provisional and current-tax computations run continuously. SARS submissions are snapshots of those queries at the deadline. Re-runs after a transaction reclassification are straightforward replays.

**P2 — Traceability.** Every tax computation cites the Act and section that imposes it; every WHT rate cites the relevant DTA article where treaty relief is applied; every classification (FATCA chapter 4, CRS) cites the standard provision that drives it; every VAT apportionment factor cites the SARS ruling or methodology document that supports it.

**P3 — Cloud-native, no manual.** All filings go via SARS eFiling, 3PDSS, and the relevant XML standards. No manually prepared returns. Tax adjustments are event-driven workflows. Reconciliation between accounting and tax is continuous.

**P4 — Security by design.** Tax submissions are signed and integrity-checked end-to-end. Access to tax data is least-privileged and read-event-logged. Taxpayer-identifier data is field-level encrypted. SARS credentials and machine identities live in HSM-backed stores.

**P5 — Multi-everything.** Multi-jurisdictional from day one in the data model: SARS today, plus DTA-driven WHT relief logic for cross-border interest, dividends, and royalties, host-country corporate and indirect taxes when expansion comes. Transfer-pricing calculations for inter-entity flows are in-system, not in spreadsheets. Tax classifications carry currency and jurisdiction.

## 10. Sources consulted

- South African Revenue Service — Income Tax Act, VAT Act, Tax Administration Act, BRS documents for PAYE, EMP201/501, IT3(b)/(c)/(s), Dividends Tax, FATCA, CRS.
- National Treasury — annual Taxation Laws Amendment Bills and Explanatory Memoranda.
- OECD — Common Reporting Standard, BEPS Actions where they bite (interest deductibility, hybrid mismatches, transfer pricing).
- IFRS — IAS 12, IFRIC 23.
- Securities Transfer Tax Act 25 of 2007.
