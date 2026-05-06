# Role brief — Compliance / RegTech engineer

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Compliance / RegTech engineer** — encodes every applicable conduct, AML/CFT, and market-conduct rule into automated controls, screening, monitoring, and reporting pipelines.

## 2. Why this role exists

In South Africa's Twin Peaks regime, a bank answers to the Prudential Authority (inside SARB) for prudential matters and to the FSCA for market conduct, plus the FIC for AML/CFT, the Information Regulator for POPIA, and SARS for FATCA/CRS. In a fully coded bank, every rule must live as code with an evidence trail. This role owns that translation from rule-text to running control.

## 3. Scope of work (priority order)

1. Customer due diligence pipeline — onboarding KYC, ongoing CDD, EDD for high-risk relationships, beneficial-ownership verification.
2. Screening — sanctions (UN, OFAC, EU, UK HMT, DTI Targeted Financial Sanctions list under POCDATARA), PEP, adverse media; at onboarding and on every change.
3. Transaction monitoring — typologies, threshold rules, behavioural baselines, alert workflow, case management.
4. Regulatory reporting to FIC — STRs, SARs, CTRs, TPRs (Terrorist Property Reports) under FIC Act sections 28, 28A, 29.
5. FATCA and CRS — classification, self-certification capture, reporting in CRS/FATCA XML to SARS.
6. Conduct controls under FAIS — record-keeping, advice fitness, fee disclosure, complaints handling.
7. POPIA programme — lawful processing register, data-subject rights, breach response, cross-border transfer controls.
8. Regulatory change management — a structured process for ingesting new rules from PA, FSCA, FIC, SARS, and turning them into changes in code.

## 4. Required expertise

- South African financial-services regulation: FIC Act, FAIS Act, Banks Act, Financial Sector Regulation Act (FSR Act / Twin Peaks), Conduct of Financial Institutions Bill (COFI) developments, POPIA.
- AML/CFT typologies and FATF Recommendations.
- Sanctions and PEP screening, fuzzy matching, and false-positive reduction at scale.
- Transaction-monitoring system design — rules, alerts, case management, MI.
- Policy-as-code patterns and decision-engine design.

## 5. Desirable expertise

- Prior compliance-officer or head-of-financial-crime experience at a SA bank.
- Hands-on with vendor stacks (Actimize, Quantexa, ComplyAdvantage, LexisNexis Bridger, Refinitiv World-Check) — useful even if we build in-house.
- ISO 20022 message-level screening design.

## 6. Regulatory / certification requirements

- FIC Act 38 of 2001 (as amended by FIC Amendment Act 1 of 2017 and subsequent) — full working knowledge.
- FAIS Act 37 of 2002 and FSCA conduct standards.
- FSR Act 9 of 2017 (Twin Peaks).
- POPIA 4 of 2013.
- COFI Bill — track progress through Parliament; design forward-compatibly.
- Compliance Institute of South Africa (CISA) practitioner status preferred.

## 7. Interfaces

- **Core platform architect** — receives customer and transaction events.
- **Sales/CRM engineer** — onboarding hand-off and FAIS advice records.
- **Operations & payments engineer** — payment screening at the cut-off-sensitive moment.
- **Legal-as-code engineer** — terms, disclosures, and consent flows.
- **Tax engineer** — FATCA/CRS classification and reporting.
- **Internal audit engineer** — control evidence and testing.

## 8. Success criteria — first 90 days

- A documented control taxonomy: every applicable obligation mapped to a control, an owner, an evidence source, and a test.
- Working onboarding KYC flow with screening, risk-rating, and EDD branching.
- A first-cut transaction-monitoring rule set with alert disposition workflow.
- FIC reporting integration in test mode (STR/CTR XML).
- A regulatory-change-management process running in production with at least one tracked change executed end-to-end.

## 9. Principle alignment

**P1 — Events as source of truth.** Screening, monitoring, and regulatory reporting all run as projections of the event stream. STR/CTR re-runs against historical events are trivially reproducible, including with retrospective rule changes (the rule change is itself an event). Customer risk ratings and onboarding status are projections, not stored values.

**P2 — Traceability.** This role *owns and curates* the obligations register. Every control, screening rule, monitoring scenario, and regulatory return links to one or more entries. Regulatory change management is, in concrete terms, the process of updating the register and propagating dependent code changes to the engineers who consume it.

**P3 — Cloud-native, no manual.** ID verification, document collection, sanctions-list ingestion, and regulatory submissions are digital and automated. Case management is event-driven; investigators act inside the system, not on the side. Manual KYC steps are exceptions, justified under P2 and tracked.

**P4 — Security by design.** PII is minimised, classified, and field-level encrypted. Read events on sensitive customer data are themselves audited. The screening pipeline integrity (list version, rule version, decision logic) is attested cryptographically per decision. Insider-risk controls apply to compliance staff equally.

**P5 — Multi-everything.** Sanctions and PEP screening run multi-list across jurisdictions. The regulatory taxonomy itself is multi-jurisdictional — a customer can be subject to several regulators simultaneously. FATCA/CRS is by definition cross-border. KYC requirements dispatch on customer, account, and product jurisdiction.

## 10. Sources consulted

- Financial Intelligence Centre — FIC Act, FIC Guidance Notes (especially GN 7 on RBA), Public Compliance Communications.
- Financial Sector Conduct Authority — FAIS General Code of Conduct, conduct standards.
- Prudential Authority (SARB) — directives and guidance notes.
- Information Regulator — POPIA guidance notes and codes of conduct.
- FATF — 40 Recommendations and SA mutual evaluation reports.
- National Treasury — COFI Bill drafts and explanatory memoranda.
- SARS — FATCA and CRS Business Requirement Specifications.
