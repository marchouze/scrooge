# Role brief — Accounting & financial reporting engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Accounting & financial reporting engineer** — turns the core ledger into IFRS-compliant financial statements and the full set of SARB BA regulatory returns, on a fully automated cycle.

## 2. Why this role exists

A bank's accounting function is the meeting point of the ledger, IFRS, tax, and the regulator. In a fully online, fully coded bank, monthly close is not a person-driven exercise — it is a deterministic pipeline. This role designs that pipeline so that financial statements, BA returns, and audit packs fall out of the system, not out of spreadsheets.

## 3. Scope of work (priority order)

1. Chart of accounts and sub-ledger design (with the platform architect) so that every regulatory and IFRS line maps from postings without manual re-classification.
2. IFRS engine — IFRS 9 (classification, measurement, expected credit loss), IFRS 7 (disclosures), IFRS 13 (fair value), IFRS 15 (revenue), IFRS 16 (leases), IAS 1, IAS 7, IAS 12.
3. Automated month-end, quarter-end, and year-end close.
4. SARB BA returns generation — BA100 (balance sheet), BA120 (off-balance-sheet), BA200 (income statement), BA300 (capital adequacy), BA325 (market risk), BA330 (credit risk), BA610 (liquidity), BA700 (large exposures), BA900 (institutional sectoral data), and the rest of the BA suite as applicable.
5. External auditor pack — automated working papers, journal-entry analytics, sample selections.
6. Inter-entity reconciliation and consolidation if multi-entity.
7. Sub-ledger to GL reconciliation, continuously, not monthly.
8. Statutory annual financial statements production.

## 4. Required expertise

- IFRS, with deep IFRS 9 (banks live or die on ECL methodology and disclosure).
- South African banking accounting practice and the SARB BA return framework.
- General-ledger and sub-ledger architecture for a financial institution.
- Reporting toolchains: data modelling, semantic layer, deterministic transformation pipelines.
- Reconciliation design — break detection, ageing, escalation.

## 5. Desirable expertise

- Prior Big-Four banking-audit or bank financial-control experience.
- XBRL taxonomy work (some BA returns and JSE filings use XBRL).
- Hyperion / Oracle FCCS / Workiva / equivalent close-and-disclose tooling — even if we are replacing it, knowing the patterns helps.

## 6. Regulatory / certification requirements

- CA(SA) strongly preferred. Failing that, ACCA or CIMA with banking experience.
- Working knowledge of SARB Banks Act Regulations (Regulations Relating to Banks) and the BA return forms and instructions.
- IRBA (Independent Regulatory Board for Auditors) audit-quality expectations on the auditee side.
- JSE Listings Requirements if the bank is to be listed.

## 7. Interfaces

- **Core platform architect** — agrees the GL and sub-ledger design.
- **Tax engineer** — shares the deferred tax, current tax, and indirect tax surfaces.
- **Risk engineer** — IFRS 9 ECL methodology and capital-adequacy returns share inputs.
- **Compliance engineer** — regulatory-return submission workflow.
- **Internal audit engineer** — provides continuous evidence for control testing.

## 8. Success criteria — first 90 days

- A documented chart of accounts and sub-ledger map with every line tied to an IFRS disclosure and a BA return cell.
- A working monthly close that runs deterministically from raw postings to a draft set of financials and BA100/BA200/BA900 in test mode.
- An IFRS 9 ECL methodology document agreed with the risk engineer.
- A sub-ledger-to-GL reconciliation that runs intraday with break detection.
- A clear list of which BA returns are in scope for the licence applied for, with delivery dates.

## 9. Principle alignment

**P1 — Events as source of truth.** The trial balance, balance sheet, income statement, and every BA return cell are *queries* over the event log. Month-end is a snapshot of a query at a moment, not a posting cycle. Sub-ledger-to-GL reconciliation is a query identity check, continuously asserted, not a balancing exercise. Restatements are re-runs of the same query at a new as-of date.

**P2 — Traceability.** Every chart-of-accounts node carries a citation to the IFRS line and BA return cell it supports. Every disclosure carries a citation to the IFRS paragraph that requires it. Every accounting policy is a register entry, not an internal note.

**P3 — Cloud-native, no manual.** No spreadsheets in the close cycle. Auditor working papers are saved queries, not exports. Manual journals are an exception path requiring coded approval, citation under P2, and immediate event recording. Statutory financials are rendered from the same query layer, not assembled.

**P4 — Security by design.** Segregation of duties between preparer and approver enforced in code. All postings cryptographically attributed. Immutable audit trail of every adjustment, every reclassification, every period close. Access to financial data is least-privileged and read-event-logged.

**P5 — Multi-everything.** Multi-entity consolidation from day one (IFRS 10 boundary, IAS 27 separate financials). Functional and presentation currencies handled per IAS 21. Multi-GAAP capability where statutory and group reporting bases differ. BA returns produced per legal entity per jurisdiction; group consolidation is a separate query.

## 10. Sources consulted

- South African Reserve Bank — Regulations Relating to Banks (under Banks Act 94 of 1990), and the BA return forms and instructions.
- IFRS Foundation — IFRS 9, 7, 13, 15, 16; IAS 1, 7, 12.
- SAICA — banking-sector application guidance.
- IRBA — auditor-related expectations relevant to controls and evidence.
- JSE Listings Requirements (for a future listing scenario).
