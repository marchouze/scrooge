# Obligations register

**Curator:** Mira (compliance / RegTech engineer) · **Governance:** Zara (CCO) · **Date:** 2026-05-07 · **Version:** 1.1

> v1.1 — added Domain M (OTC Derivative Provider): 25 new obligations under FMA, FSCA Conduct Standards 1–3 of 2018, Joint Standard 2 of 2020 (as amended 9 June 2023), Joint Notice 2 of 2024, Currency & Exchanges Manual. Source: `Owner Inbox/2026-05-07_mira_fsca-odp-compliance-preparation.md`.

> **Purpose.** A consolidated register of every obligation the bank carries under applicable regulation, mapped to where it is fulfilled in the bank's policy stack. The operational expression of Principle 2 (every action traces to a source). Entries are projections over the underlying instrument analyses in this library; reproducible at any as-of date.

## How to read this register

- **ID** — a stable register identifier `ORG-<domain>-<n>` for cross-referencing.
- **Citation** — instrument and section / clause.
- **Requirement** — plain-English statement of what the regulator requires.
- **Fulfilment policy** — where in the bank's policy library this obligation is met (cross-reference to `Owner Inbox/2026-05-06_policy-register.md` and the bundle files).
- **Owner** — accountable seat (typically a governance seat, with the engineering seat in parentheses).
- **Status** — `IN FORCE` (policy approved & live) · `DRAFTING` · `PLANNED` · `PARTIAL` · `N/A-yet` (e.g., FAIS-conditional when no FSP licence held).

Where multiple regulators converge on the same obligation, it is listed once with all relevant citations.

---

## Domain A — Prudential (capital, liquidity, large exposures, leverage)

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-PR-01 | Banks Act 94/1990 + Regs Relating to Banks | Maintain capital adequacy at not less than the regulatory minimum (CET1, AT1, T2). | Capital Management Policy; ICAAP | Camille (Bea) | **IN FORCE** |
| ORG-PR-02 | Banks Act + BCBS Basel III/IV | Apply Pillar 2A add-ons as set by PA. | Capital Management Policy | Camille | **IN FORCE** |
| ORG-PR-03 | Banks Act + BCBS | Hold capital conservation buffer + countercyclical buffer where required. | Capital Management Policy | Camille | **IN FORCE** |
| ORG-PR-04 | Internal RAS / RAF | Maintain CET1 management buffer ≥ +1.5pp above all PA minima + Pillar 2A + capital conservation buffer (RAS B2 — calibration pending). | Capital Management Policy; RAS | Camille (with Helena) | PARTIAL (B2 deferred) |
| ORG-PR-05 | Banks Act + BCBS leverage ratio | Maintain leverage ratio ≥ regulatory minimum. | Capital Management Policy | Camille | **IN FORCE** |
| ORG-PR-06 | BCBS D295 / BA 325 | Maintain LCR ≥ 100% (PA min); buffer to internal floor (B2 calibration). | Liquidity Risk Management Policy | Helena + Eitan | **IN FORCE** |
| ORG-PR-07 | BCBS D335 / BA 326 | Maintain NSFR ≥ 100% (PA min); buffer to internal floor (B2 calibration). | Liquidity Risk Management Policy | Helena + Eitan | **IN FORCE** |
| ORG-PR-08 | BCBS 248 | Monitor intraday liquidity per BCBS metrics; report to PA. | Liquidity Risk Management Policy; Funding Strategy Policy | Eitan | **IN FORCE** |
| ORG-PR-09 | BCBS Large Exposures / BA 330 | Single-name large exposure capped at the regulatory ceiling. | Credit Risk Policy | Helena | **IN FORCE** |
| ORG-PR-10 | RAS B8 (CEO approved) | Sector concentration ≤ 25% of exposure without explicit BRC approval. | Credit Risk Policy | Helena | **IN FORCE** |
| ORG-PR-11 | BCBS D368 (IRRBB) | Measure and manage IRRBB through EVE and NII metrics. | IRRBB Policy (within Risk Management Framework) | Helena + Eitan | **IN FORCE** |
| ORG-PR-12 | Banks Act + PA stress-testing guidance | Conduct integrated stress testing (capital + liquidity); reverse stress tests on key vulnerabilities. | Stress Testing Policy | Helena | **IN FORCE** |
| ORG-PR-13 | Banks Act + PA | Submit annual ICAAP to PA. | Capital Management Policy; ICAAP | Camille + Helena | **IN FORCE** (annual cycle) |
| ORG-PR-14 | Banks Act + PA | Submit annual ILAAP to PA. | Liquidity Risk Management Policy; ILAAP | Eitan + Helena | **IN FORCE** (annual cycle) |
| ORG-PR-15 | BCBS Sound Liquidity Risk Management (BCBS 144) | Maintain Contingency Funding Plan; rehearsed annually. | Liquidity Risk Management Policy; Funding Strategy Policy | Eitan | **IN FORCE** |
| ORG-PR-16 | BCBS Large Exposures + Banks Act | Counterparty-credit exposure managed; netting under enforceable ISDA / GMRA. | Counterparty Credit Risk Policy; Collateral Management Policy | Helena + Saskia | **IN FORCE** |
| ORG-PR-17 | BCBS Operational Risk (rev. 2021) | Operational-risk identification, measurement, control framework. | Operational Risk Policy | Helena + Devon | **IN FORCE** |
| ORG-PR-18 | BCBS Operational Resilience (2021) | Identify Important Business Services; set impact tolerances; test scenarios. | Operational Resilience Policy | Devon (with Helena) | **IN FORCE** |
| ORG-PR-19 | BCBS Market Risk (FRTB / D352, D457) | Measure trading-book market risk per FRTB; capital under standardised or internal-model approach. | Market Risk Policy | Helena (Rohan) | **IN FORCE** |
| ORG-PR-20 | RAS / Trading Mandate (B5 deferred) | No proprietary risk-taking outside warehoused franchise hedge positions. | Trading Mandate (in refinement); Market Risk Policy | Saskia + Helena | PARTIAL (B5 deferred) |
| ORG-PR-21 | Internal RAS B7 / SR 11-7 idiom | Three-tier model risk classification; independent validation pre-deployment for Tier 1 + 2. | Model Risk Policy | Helena | **IN FORCE** |
| ORG-PR-22 | PA Guidance Note 1 of 2024 | Climate-related risk integrated into the risk taxonomy; scenario analysis; disclosures. | Climate-Related Risk Policy (within RMF); Operational Resilience Policy | Helena (with S&E) | **IN FORCE** (initial: assess / disclose / avoid) |

## Domain B — Financial crime, AML / CFT, sanctions

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-FC-01 | FIC Act 38/2001 s.42 | Adopt and maintain a Risk Management and Compliance Programme (RMCP). | RMCP | Zara | **IN FORCE** |
| ORG-FC-02 | FIC Act ss.21–21H + FATF Rec. 10 | Conduct CDD on all clients; identification & verification before establishing the business relationship. | KYC / CDD / EDD Policy; Client master + continuous-KYC design | Zara (Mira) | **IN FORCE** |
| ORG-FC-03 | FIC Act s.21A + FIC GN 7 | Apply EDD to high-risk relationships (PEPs, foreign correspondents, complex structures). | KYC / CDD / EDD Policy; PEP Policy | Zara (Mira) | **IN FORCE** |
| ORG-FC-04 | FIC Act s.21B + FATF Rec. 10 + Companies Act + Trust Property Control Act | Verify beneficial ownership; recursive resolution to natural persons. | KYC / CDD / EDD Policy; Client master design | Zara (Mira + Imani) | **IN FORCE** |
| ORG-FC-05 | FIC Act s.22 | Retain prescribed records for 5 years after the relationship ends. | Records Management Policy; KYC / CDD / EDD Policy | Owen + Zara | **IN FORCE** |
| ORG-FC-06 | FIC GN 7 + FATF Rec. 1 | Risk-based approach: dispatch CDD intensity on customer risk-rating typology. | KYC / CDD / EDD Policy; AML/CFT Policy | Zara (Mira) | **IN FORCE** |
| ORG-FC-07 | FIC Act s.28 | File Cash Threshold Reports (CTRs) for cash transactions ≥ R 24,999.99 (or as updated). | RMCP; AML/CFT Policy | Zara (MLRO) | **IN FORCE** |
| ORG-FC-08 | FIC Act s.28A | File Property Association Reports (PARs) on association with sanctioned property. | RMCP; Sanctions Policy | Zara (MLRO) | **IN FORCE** |
| ORG-FC-09 | FIC Act s.29 | File Suspicious Transaction / Activity Reports (STRs / SARs) on suspicion. | RMCP; AML/CFT Policy | Zara (MLRO) | **IN FORCE** |
| ORG-FC-10 | FIC Act s.29(3) | Tipping-off prohibited — disclosing STR existence is a criminal offence. | RMCP; cryptographic enforcement of MLRO investigation set | Zara | **IN FORCE** |
| ORG-FC-11 | FIC Act + FATF | Designate an internal AML compliance officer and a Money Laundering Reporting Officer (MLRO). | Governance Framework; Fit-and-Proper Policy | Zara (CCO is named MLRO) | **IN FORCE** |
| ORG-FC-12 | FIC Act s.43 | Train staff on AML / CFT obligations. | AML/CFT Policy; HR Training | Zara + Sade | **IN FORCE** |
| ORG-FC-13 | UN Security Council Sanctions; OFAC SDN; EU consolidated; UK HMT; POCDATARA / DTI list (RAS B4 — zero appetite) | Block all true-positive sanctions matches pre-execution; production override by signed MLRO event with register-linked exception. | Sanctions Policy; AML/CFT Policy | Zara (Mira) | **IN FORCE** |
| ORG-FC-14 | POCDATARA + FIC Act | Targeted Financial Sanctions screening per DTI list. | Sanctions Policy | Zara | **IN FORCE** |
| ORG-FC-15 | FATCA IGA + Tax Admin Act | Identify US-reportable accounts; submit FATCA XML to SARS annually. | FATCA / CRS Policy; Tax Policy | Yael (Mira) | **IN FORCE** (annual cycle) |
| ORG-FC-16 | CRS + Tax Admin Act | Identify CRS-reportable accounts; submit CRS XML to SARS annually. | FATCA / CRS Policy; Tax Policy | Yael (Mira) | **IN FORCE** (annual cycle) |
| ORG-FC-17 | FATF Rec. 16 | Wire-transfer regulation: originator and beneficiary information accompanies cross-border transfers. | AML/CFT Policy; KYC Policy | Zara (Mira) | **IN FORCE** |
| ORG-FC-18 | RAS B3 (CEO approved) | Continuous-KYC two-tier restriction default: high-confidence triggers → restrict immediately; medium-confidence → restrict on review. | KYC / CDD / EDD Policy; Client master + continuous-KYC design | Zara (Mira) | **IN FORCE** |
| ORG-FC-19 | FIC GN 7 (RBA periodicity) | Recurring KYC: high-risk → annual; medium → 24 months; low → 36 months. | KYC / CDD / EDD Policy | Zara (Mira) | **IN FORCE** |
| ORG-FC-20 | PRECCA 12/2004 | Prevent and combat bribery and corruption; report knowledge of such conduct. | Anti-Bribery & Corruption Policy; Whistleblowing Policy | Owen + Zara | **IN FORCE** |
| ORG-FC-21 | FATF SA Mutual Evaluation Reports | Address SA mutual-evaluation findings (grey-listing remediation). | RMCP; AML/CFT Policy | Zara | PARTIAL (track-and-respond per regulatory-change management) |
| ORG-FC-22 | UK Bribery Act 2010 (extra-territorial) | UK extra-territorial reach where bank has UK touch-points. | Anti-Bribery & Corruption Policy | Owen + Zara | **IN FORCE** |

## Domain C — Conduct, FAIS, TCF

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-CD-01 | FAIS Act 37/2002 + FSCA conduct standards | Treating Customers Fairly: six outcomes operationalised. | Conduct of Business / TCF Policy; Customer Treatment Policy | Zara + Niko | **IN FORCE** |
| ORG-CD-02 | FAIS Act | FSP licence required to give advice / render intermediary services on financial products. | FAIS Policy (planned) | Zara | N/A-yet (FSP licence pending) |
| ORG-CD-03 | FAIS Act | Designate Key Individual(s) and Representatives where FSP-licensed. | Fit-and-Proper Policy; FAIS Policy | Zara (Saskia / Niko) | N/A-yet |
| ORG-CD-04 | FAIS General Code of Conduct | Maintain advice records demonstrating suitability. | FAIS Policy; TCF Policy | Zara + Niko | N/A-yet (FSP-conditional) |
| ORG-CD-05 | FAIS Conflict of Interest Code | Manage conflicts; disclose; avoid where unmanageable. | Conflicts of Interest Policy | Owen | **IN FORCE** |
| ORG-CD-06 | FAIS + FSCA conduct standards | Fee disclosure to customers; transparency on charges. | Pricing Policy; TCF Policy; Customer Treatment Policy | Niko + Zara | **IN FORCE** (within TCF; FAIS-specific N/A-yet) |
| ORG-CD-07 | FAIS + FSCA | Complaints handling per FSCA standards. | Complaints Handling Policy | Zara + Niko | **IN FORCE** |
| ORG-CD-08 | FSR Act 9/2017 | Twin Peaks: PA prudential, FSCA conduct; cooperate with both. | Governance Framework; RMCP; Regulatory Engagement Policy | Owen + Zara | **IN FORCE** |
| ORG-CD-09 | COFI Bill (in Parliament) | Forward-compatibility with COFI activity-based licensing. | Regulatory Change Management Policy | Zara (Mira) | PARTIAL (track + design forward) |
| ORG-CD-10 | NCA (where credit provided) | National Credit Act compliance for credit products. | (planned — when credit products launch) | Zara + Niko | N/A-yet |

## Domain D — Privacy and data protection

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-PR(IV)-01 | POPIA 4/2013 s.11 | Process personal information only with a lawful basis. | POPIA / Privacy Policy | Iris | **IN FORCE** |
| ORG-PR(IV)-02 | POPIA s.13 | Process for a specific, explicit, lawful purpose; document the purpose. | POPIA / Privacy Policy; Lawful-Processing Register | Iris | **IN FORCE** |
| ORG-PR(IV)-03 | POPIA s.14 | Retain personal information only as long as necessary; documented retention schedule. | Data Retention & Disposal Policy; Records Management Policy | Iris + Owen | **IN FORCE** |
| ORG-PR(IV)-04 | POPIA s.15 | Further processing compatible with original purpose. | POPIA / Privacy Policy | Iris | **IN FORCE** |
| ORG-PR(IV)-05 | POPIA s.18 | Notice to data subjects when collecting personal information. | POPIA / Privacy Policy; Consent & Notice Policy | Iris + Niko | **IN FORCE** |
| ORG-PR(IV)-06 | POPIA ss.19–22 | Security safeguards; integrity and confidentiality of personal information. | Information Security Policy; POPIA / Privacy Policy | Iris + Senna | **IN FORCE** |
| ORG-PR(IV)-07 | POPIA s.22 | Notify the Information Regulator and data subjects of compromise. | Incident Response Policy; POPIA / Privacy Policy | Iris (with Senna) | **IN FORCE** |
| ORG-PR(IV)-08 | POPIA s.23 | Data-subject right of access. | POPIA / Privacy Policy; Data Subject Rights workflow | Iris | **IN FORCE** |
| ORG-PR(IV)-09 | POPIA s.24 | Data-subject right of correction / deletion. | POPIA / Privacy Policy; Data Subject Rights workflow | Iris | **IN FORCE** |
| ORG-PR(IV)-10 | POPIA s.71 | Limit automated decision-making affecting data subjects; provide right to challenge. | POPIA / Privacy Policy; Model Risk Policy | Iris (with Helena) | **IN FORCE** |
| ORG-PR(IV)-11 | POPIA s.34 | Lawful processing of special personal information (limited grounds). | POPIA / Privacy Policy | Iris | **IN FORCE** |
| ORG-PR(IV)-12 | POPIA s.35 | Lawful processing of children's information. | POPIA / Privacy Policy | Iris | **IN FORCE** |
| ORG-PR(IV)-13 | POPIA ss.55–56 + POPIA Reg. 4 | Designate Information Officer; lodge with Information Regulator. | POPIA / Privacy Policy; Governance Framework | Iris (designation lodgment **deferred** — Round 1 E1) | PARTIAL |
| ORG-PR(IV)-14 | POPIA s.57 | Prior authorisation for certain processing types. | POPIA / Privacy Policy | Iris | **IN FORCE** |
| ORG-PR(IV)-15 | POPIA s.72 | Cross-border transfer of personal information limited to lawful conditions. | Cross-Border Transfer Policy; POPIA / Privacy Policy | Iris (with Devon) | **IN FORCE** |
| ORG-PR(IV)-16 | PAIA 2/2000 s.51 | Maintain and lodge PAIA Manual. | PAIA Manual; POPIA / Privacy Policy | Iris + Owen | **IN FORCE** |
| ORG-PR(IV)-17 | PAIA | Respond to PAIA requests within statutory timeframes. | PAIA Manual | Iris (case-managed) | **IN FORCE** |

## Domain E — Cyber and operational resilience

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-CY-01 | Joint Standard 1 of 2024 | Maintain a cybersecurity and cyber-resilience framework with named accountability. | Cyber Resilience Policy; Information Security Policy | Devon (interim CISO function); Senna (engineering); Helena (risk appetite) | **IN FORCE** |
| ORG-CY-02 | Joint Standard 1 of 2024 | Designate an accountable executive ("responsible person") for cyber. | Governance Framework; Fit-and-Proper Policy | Devon (interim until CISO hired) | **IN FORCE** |
| ORG-CY-03 | Joint Standard 1 of 2024 | Threat modelling, risk assessment, controls catalogue. | Information Security Policy; Cyber Resilience Policy | Senna | **IN FORCE** |
| ORG-CY-04 | Joint Standard 1 of 2024 | Incident reporting to PA / FSCA per stipulated timelines. | Incident Response Policy; Cyber Resilience Policy | Senna + Iris (regulator-facing) | **IN FORCE** (per RAS B6 four-tier model) |
| ORG-CY-05 | Joint Standard 1 of 2024 + BCBS Op Resilience | Tested cyber-incident response with rehearsed runbooks. | Incident Response Policy; Operational Resilience Policy | Senna + Devon | **IN FORCE** |
| ORG-CY-06 | SARB PA Directive 3 of 2018 | Cloud computing & data offshoring assessed and registered; material outsourcing Board-reserved. | Outsourcing & Third-Party Risk Policy; Cloud Computing Policy | Devon (with Senna + Iris) | **IN FORCE** |
| ORG-CY-07 | SARB Directive 3 of 2018 | Notify PA in advance of material outsourcing. | Outsourcing & Third-Party Risk Policy | Devon | **IN FORCE** |
| ORG-CY-08 | BCBS Op Resilience | Identify Important Business Services; set impact tolerances; severe-but-plausible scenario testing. | Operational Resilience Policy; BCP / DR Policy | Devon (with Helena) | **IN FORCE** |
| ORG-CY-09 | ISO/IEC 27001:2022 (used as reference) | Information-security management system aligned to ISO 27001. | Information Security Policy | Senna | **IN FORCE** (designed-to; certification optional) |
| ORG-CY-10 | NIST CSF 2.0 (used as reference) | Cybersecurity controls aligned to NIST CSF Identify / Protect / Detect / Respond / Recover. | Cyber Resilience Policy | Senna | **IN FORCE** (reference-aligned) |
| ORG-CY-11 | RAS B6 (CEO approved) | Cyber severity tier model T1–T4 with Regulator-notification thresholds at T3 / T4. | Cyber Resilience Policy; Incident Response Policy | Senna + Iris | **IN FORCE** |
| ORG-CY-12 | NIST SP 800-218 (SSDF v1.1) (used as reference) | Secure software development lifecycle aligned to SSDF practice groups (Prepare the Organisation, Protect the Software, Produce Well-Secured Software, Respond to Vulnerabilities). | Secure SDLC Policy | Senna (engineering) + Rashida (governance) | **IN FORCE** (designed-to; reference-aligned) |
| ORG-CY-13 | SLSA v1.0 (used as reference) | Build-provenance attestation, signed artefacts, hermetic / non-falsifiable builds; target SLSA Build Level 3. | Secure SDLC Policy | Senna + Atlas | **IN FORCE** (designed-to; Build Level 3 target) |
| ORG-CY-14 | ISO/IEC 27001:2022 Annex A.8.25–A.8.34 (used as reference) | Secure development lifecycle controls — secure coding, threat modelling, separation of environments, outsourced development governance, system acceptance testing. | Secure SDLC Policy; Information Security Policy | Senna + Rashida | **IN FORCE** (reference-aligned) |

## Domain F — Governance, board, corporate

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-GV-01 | Companies Act 71/2008 ss.86–89 | Public company maintains a Company Secretary. | Governance Framework | Owen | **IN FORCE** |
| ORG-GV-02 | Companies Act ss.75–77 | Director duties (good faith, care, skill, diligence); declare conflicts. | Code of Conduct; Conflicts of Interest Policy | Owen | **IN FORCE** |
| ORG-GV-03 | Companies Act + Banks Act | Designate Public Officer (SARS / Companies Act). | Governance Framework | Camille | **IN FORCE** |
| ORG-GV-04 | Companies Reg. 43 | Establish Social and Ethics Committee (where public-interest score applies). | Governance Framework — S&E Committee | Owen + future CHRO | **IN FORCE** (interim arrangement until Board) |
| ORG-GV-05 | Banks Act + BCBS Corporate Governance Principles + King IV | Establish a Board with majority independent NEDs and an independent chair. | Governance Framework | Owen | PARTIAL (Board not yet constituted; interim arrangement A3 approved) |
| ORG-GV-06 | Banks Act + BCBS | Establish Board Risk Committee. | Governance Framework — BRC | Helena (Owen secretariat) | **IN FORCE** (Interim Risk Forum until Board) |
| ORG-GV-07 | Companies Act + King IV | Establish Audit Committee. | Governance Framework — AC | Owen (future CAE) | **IN FORCE** (Interim Audit Forum until Board) |
| ORG-GV-08 | King IV | Establish Remuneration Committee. | Governance Framework — RemCo | Sade (interim) + Helena | PLANNED (Board-pending) |
| ORG-GV-09 | King IV | Establish Nominations Committee. | Governance Framework — NomCo | Owen (future CHRO) | PLANNED (Board-pending) |
| ORG-GV-10 | BCBS Corporate Governance Principles | Designate CRO with direct access to BRC. | Governance Framework; Fit-and-Proper Policy | Helena | **IN FORCE** |
| ORG-GV-11 | Banks Act + BCBS | Designate fit-and-proper officers (CEO, CRO, CFO, COO, Treasurer, Head of Markets, CCO, CISO, CAE, GC, CHRO, CoSec, IO). | Fit-and-Proper Policy | Sade + Owen + Helena | **IN FORCE** (where seats exist) |
| ORG-GV-12 | Companies Act + IAS 24 | Disclose related-party transactions. | Conflicts of Interest Policy; Related-Party Transactions Policy; Accounting Policies (IFRS) | Owen + Camille | **IN FORCE** |
| ORG-GV-13 | Protected Disclosures Act 26/2000 | Whistleblowing channel with statutory protections. | Whistleblowing Policy | Owen | **IN FORCE** |
| ORG-GV-14 | King IV | Apply-and-explain corporate-governance principles; integrated reporting. | Governance Framework | Owen | **IN FORCE** |
| ORG-GV-15 | King IV + Banks Act | Director induction, evaluation, succession. | Governance Framework | Owen | PARTIAL (operational once Board exists) |
| ORG-GV-16 | Companies Act + JSE LR (if listed) | Annual financial statements signed and filed. | Accounting Policies (IFRS); Governance Framework | Camille + Owen | **IN FORCE** (annual cycle) |
| ORG-GV-17 | Banks Act + Joint Standard 1 of 2024 | Board approves RAS, RMF, ICAAP, ILAAP, material policies. | Governance Framework — Reserved Matters | Owen | **IN FORCE** (interim approval = CEO + CRO + CFO concurrence) |
| ORG-GV-18 | BCBS Corporate Governance | Three lines of defence formally operating; independence preserved. | Governance Framework — 3LoD | Owen + Helena + Vera | **IN FORCE** |
| ORG-GV-19 | BCBS Compliance and the Compliance Function (2005) | Compliance function independent, resourced, with direct access to BRC. | Governance Framework; RMCP | Zara | **IN FORCE** |
| ORG-GV-20 | BCBS 223 | Internal Audit Function operates independently per IIA IPPF. | Governance Framework — AC; Internal Audit Charter (planned) | future CAE (Vera engineering) | PARTIAL (charter pending CAE hire) |

## Domain G — Accounting and financial reporting

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-AC-01 | IFRS 9 | Classify financial instruments at recognition (amortised cost / FVOCI / FVTPL) per business-model + SPPI test. | Accounting Policies (IFRS) | Camille (Bea) | **IN FORCE** |
| ORG-AC-02 | IFRS 9 | Recognise expected credit losses (ECL) per three-stage model. | Provisioning / IFRS 9 ECL Policy | Helena + Bea | **IN FORCE** |
| ORG-AC-03 | IFRS 9 (CEO election F1) | Apply IFRS 9 hedge accounting (IAS 39 carryover not used). | Hedge Accounting Policy | Eitan + Camille | **IN FORCE** |
| ORG-AC-04 | IFRS 7 | Disclose risks arising from financial instruments. | Accounting Policies (IFRS); Financial Reporting & Disclosure Policy | Camille (Bea) | **IN FORCE** |
| ORG-AC-05 | IFRS 13 | Apply fair-value measurement framework. | Accounting Policies (IFRS) | Camille (Bea) | **IN FORCE** |
| ORG-AC-06 | IFRS 15 | Recognise revenue per five-step model. | Accounting Policies (IFRS) | Camille (Bea) | **IN FORCE** |
| ORG-AC-07 | IFRS 16 | Recognise leases on the balance sheet. | Accounting Policies (IFRS) | Camille (Bea) | **IN FORCE** |
| ORG-AC-08 | IAS 1 | Present financial statements per IAS 1 structure. | Accounting Policies (IFRS) | Camille (Bea) | **IN FORCE** |
| ORG-AC-09 | IAS 12 | Recognise current and deferred income taxes. | Accounting Policies (IFRS); Tax Policy | Camille + Yael | **IN FORCE** |
| ORG-AC-10 | IAS 21 | Apply functional / presentation currency framework. | Accounting Policies (IFRS) | Camille (Bea) | **IN FORCE** |
| ORG-AC-11 | IAS 24 | Disclose related-party transactions. | Accounting Policies (IFRS); Related-Party Transactions Policy | Camille + Owen | **IN FORCE** |
| ORG-AC-12 | IFRIC 23 | Disclose uncertain tax positions. | Tax Policy; Accounting Policies (IFRS) | Yael + Camille | **IN FORCE** |
| ORG-AC-13 | Banks Act + Regs Relating to Banks | Submit monthly / quarterly BA returns to PA. | Financial Reporting & Disclosure Policy; Capital Management Policy; Liquidity Risk Management Policy | Camille (Bea) | **IN FORCE** (cycle) |
| ORG-AC-14 | Companies Act + Banks Act | Annual financial statements audited by external auditor. | External Audit Engagement Policy; Accounting Policies (IFRS) | Camille (with AC + future CAE) | **IN FORCE** (annual cycle) |
| ORG-AC-15 | BCBS 239 | Risk-data aggregation and risk-reporting principles. | Accounting Policies (IFRS); Risk Management Framework | Anya (with Helena + Camille) | **IN FORCE** |
| ORG-AC-16 | IRBA + Companies Act | External auditor independence and rotation. | External Audit Engagement Policy | Camille + Owen | **IN FORCE** |

## Domain H — Tax

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-TX-01 | Income Tax Act 58/1962 | Pay corporate income tax on taxable income. | Tax Policy | Yael | **IN FORCE** |
| ORG-TX-02 | Income Tax Act + OECD TP Guidelines | Transfer pricing per arm's-length principle for cross-border related-party transactions. | Transfer Pricing Policy; Tax Policy | Yael | **IN FORCE** |
| ORG-TX-03 | VAT Act 89/1991 + SARS practice | Apply financial-services VAT apportionment per approved method. | Tax Policy | Yael | **IN FORCE** |
| ORG-TX-04 | Tax Administration Act 28/2011 | Maintain tax records per Tax Admin Act retention requirements. | Records Management Policy; Tax Policy | Yael + Owen | **IN FORCE** |
| ORG-TX-05 | Income Tax Act | Withholding tax on cross-border interest, dividends, royalties. | Tax Policy | Yael | **IN FORCE** |
| ORG-TX-06 | FATCA IGA + Tax Admin Act | FATCA classification + reporting (see ORG-FC-15). | FATCA / CRS Policy; Tax Policy | Yael (Mira) | **IN FORCE** |
| ORG-TX-07 | CRS + Tax Admin Act | CRS classification + reporting (see ORG-FC-16). | FATCA / CRS Policy; Tax Policy | Yael (Mira) | **IN FORCE** |
| ORG-TX-08 | Companies Act + Tax Admin Act | Designate Public Officer responsible for SARS-facing matters. | Governance Framework | Camille | **IN FORCE** |
| ORG-TX-09 | Income Tax Act + Tax Admin Act | Voluntary Disclosure Programme used where material discovery occurs. | Tax Policy | Yael (with Camille) | **IN FORCE** |

## Domain I — Labour and HR

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-HR-01 | Labour Relations Act 66/1995 | Fair labour practices; due-process disciplinary and grievance handling. | Disciplinary Policy; Grievance Policy | Sade | **IN FORCE** |
| ORG-HR-02 | LRA + Codes of Good Practice | Substantive and procedural fairness in dismissals. | Disciplinary Policy | Sade | **IN FORCE** |
| ORG-HR-03 | BCEA 75/1997 | Working hours, leave, overtime per BCEA minima. | Leave Policy; HR baseline | Sade | **IN FORCE** |
| ORG-HR-04 | Employment Equity Act 55/1998 | Eliminate unfair discrimination; affirmative action plan; EE report. | Employment Equity Policy; Harassment & Discrimination Policy | Sade | **IN FORCE** |
| ORG-HR-05 | EE Act + Codes of Good Practice | Equal pay for work of equal value; gender-pay equity reviewed. | Remuneration Policy; Employment Equity Policy | Sade + Helena | **IN FORCE** |
| ORG-HR-06 | EE Act | Sexual / other harassment prevention. | Harassment & Discrimination Policy | Sade | **IN FORCE** |
| ORG-HR-07 | Skills Development Act 97/1998 + Skills Development Levies Act | SDL contributions; workplace skills plan; ATR. | Skills Development Policy | Sade | **IN FORCE** |
| ORG-HR-08 | B-BBEE Act + Financial Sector Code | B-BBEE compliance and reporting. | B-BBEE Policy | Sade (with future CHRO + S&E) | **IN FORCE** |
| ORG-HR-09 | Occupational Health & Safety Act 85/1993 | OHS programme; H&S officer; risk assessments. | Health & Safety Policy | Sade | **IN FORCE** |
| ORG-HR-10 | Banks Act + BCBS Compensation principles + King IV | Risk-aligned remuneration with deferral, malus, clawback for MRTs. | Remuneration Policy | Sade + Helena | **IN FORCE** |
| ORG-HR-11 | Banks Act + PA fit-and-proper standards | Designated officers meet fit-and-proper standards continuously. | Fit-and-Proper Policy | Sade + Owen + Helena | **IN FORCE** |

## Domain J — Markets, trading, market conduct

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-MK-01 | Financial Markets Act 19/2012 Ch. X | Market abuse prohibitions: insider trading, market manipulation, false reporting. | Market Abuse / Surveillance Policy; Insider Trading / PA Dealing Policy | Saskia + Zara + Owen | PARTIAL (policy planned in markets bundle) |
| ORG-MK-02 | FMA + FSCA conduct standards | Best execution where required. | Best Execution Policy (planned, markets bundle) | Saskia | PLANNED |
| ORG-MK-03 | FMA + JSE rules | Voice / e-comms recording for trading personnel. | Voice & Communications Recording Policy (planned, markets bundle) | Saskia + Senna + Iris + Sade | PLANNED |
| ORG-MK-04 | RAS B5 (deferred — under refinement) | Trading mandate: client-driven and franchise market-making; no proprietary risk-taking outside franchise hedges. | Trading Mandate (in refinement) | Saskia + Helena + Camille | PARTIAL (B5 deferred) |
| ORG-MK-05 | FMA Ch. X + JSE LR (if listed) | Insider information handled per insider-trading provisions. | Insider Trading / PA Dealing Policy | Owen + Zara | **IN FORCE** |
| ORG-MK-06 | ISDA / GMRA / GMSLA | Master agreements with enforceable netting. | Counterparty Onboarding Policy (planned); Collateral Management Policy | Saskia + Imani + Eitan | PARTIAL |
| ORG-MK-07 | ZARONIA MPG | Adopt ZARONIA conventions; JIBAR fall-back. | Funding Strategy Policy; Hedge Accounting Policy; Pricing Policy | Eitan + Camille | **IN FORCE** |
| ORG-MK-08 | Currency and Exchanges Manual (Excon) | FX / cross-border transactions per Authorised Dealer rules. | Excon Compliance Policy (planned); Funding Strategy Policy | Eitan + Zara | PARTIAL |

## Domain K — ECTA, electronic transactions, document execution

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-EL-01 | ECTA 25/2002 | Recognise electronic communications and signatures (excluding ECTA Schedule 1 cases). | Document Execution Policy (planned); Contracting Policy | Imani | **IN FORCE** (within governance framework P3) |
| ORG-EL-02 | ECTA Schedule 1 | Reserve wet signatures for excluded categories (wills, alienation of land, certain bills of exchange, long-term leases where statute requires writing). | Document Execution Policy | Imani | **IN FORCE** |
| ORG-EL-03 | POPIA + ECTA | Electronic-record integrity and authenticity. | Information Security Policy; POPIA / Privacy Policy | Senna + Iris | **IN FORCE** |

## Domain M — OTC Derivative Provider (FMA / FSCA / Joint Standards)

> *Added 2026-05-07 by Mira on the back of `Owner Inbox/2026-05-07_mira_fsca-odp-compliance-preparation.md`. Status assumes the bank's strategic foundation: institutional bank seeking SARB licence + ODP authorisation via Application Index 1 (banks-track), live operation post-licence-day per the AI-driven-bank reframe.*

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-FMA-001 | Financial Markets Act 19/2012 s.6A | Be authorised by the FSCA before conducting ODP business; authorisation precedes any live OTC derivative principal-side activity. | ODP Authorisation Policy (planned, markets bundle) | Camille + Saskia + Owen | PRE-LICENCE |
| ORG-FMA-002 | FMA s.109 | Penalty: up to R10m fine and/or 5 years imprisonment for unauthorised ODP activity or holding-out. | Governance Framework; Operating-Model Boundary | Owen | **IN FORCE** (boundary policed) |
| ORG-FMA-003 | FMA Regulations (GN R.98/2018) reg 3 | Report OTC derivative transactions to a licensed Trade Repository (Strate, designated Dec 2024); 169 data elements per transaction; live by 1 March 2027. | Trade Reporting Policy (planned); Anya data contracts | Mira + Anya + Tomas | DRAFTING |
| ORG-CS1-001 | Conduct Standard 1/2018 §3 | Demonstrate operational capital sufficient for the ODP business. | Capital Management Policy; ICAAP | Camille | **IN FORCE** (Banks-Act-prudential-covered) |
| ORG-CS1-002 | CS 1/2018 §4 | Fit-and-proper: senior management, controlling body, key individuals. | Fit-and-Proper Policy | Owen + Sade | PARTIAL (thin-human-layer at licence-day) |
| ORG-CS1-003 | CS 1/2018 §5 | Risk-management framework — board-approved policies + procedures, written. | Risk Management Framework | Helena | IN FLIGHT (RAS recalibration) |
| ORG-CS1-004 | CS 1/2018 §6 | IT and operational capacity demonstration. | Operational Resilience Policy; ODP Authorisation Policy | Devon | IN FLIGHT |
| ORG-CS2-001 | CS 2/2018 + Strate TR | Trade reporting per the 169-element schema; aligned with EMIR / EMIR Refit. | Trade Reporting Policy; Anya schema-registry | Anya + Mira | DRAFTING |
| ORG-CS3-001 | Conduct Standard 3/2018 §3 | Written trading-relationship agreement before any OTC derivative transaction (ISDA Master + ZA Schedule + CSA). | Counterparty Onboarding Policy; Imani clause library | Imani + Saskia | IN FLIGHT |
| ORG-CS3-002 | CS 3/2018 §4 | Timely confirmation of all material terms post-execution (industry T+1 / T+5). | Confirmation Procedure (Kai); OTC Trading Policy (planned) | Kai (Saskia) | DRAFTING |
| ORG-CS3-003 | CS 3/2018 §5 | Portfolio reconciliation at specified intervals; identifies discrepancies in material terms + valuation. | Portfolio Reconciliation Procedure (Tomas) | Tomas (Saskia) | DRAFTING |
| ORG-CS3-004 | CS 3/2018 §6 | Dispute-resolution procedures in place before transaction commencement. | OTC Dispute Resolution Procedure (Imani + Zara) | Imani + Zara | DRAFTING |
| ORG-CS3-005 | CS 3/2018 §7 | Client / counterparty categorisation policy + due diligence pre-trade. | Client Categorisation Policy (planned) | Zara (Niko substrate) | DRAFTING |
| ORG-CS3-006 | CS 3/2018 §8 | Daily valuation; agreed methodology with counterparty. | Valuation Procedure (Rohan); Hedge Accounting Policy | Rohan (with Bea) | DRAFTING |
| ORG-CS3-007 | CS 3/2018 §9 | Conflicts-of-interest management on OTC derivative dealing. | Conflicts of Interest Policy | Owen | **IN FORCE** (general); ODP-specific extension PLANNED |
| ORG-CS3-008 | CS 3/2018 §10 | Complaints handling. | TCF / Complaints Policy | Zara | DRAFTING |
| ORG-CS3-009 | CS 3/2018 §12 | Record-keeping ≥ 5 years; tamper-evident. | Records Management Policy; Event-store Substrate (Atlas) | Atlas (Owen) | **IN FORCE** (P1 over-delivers) |
| ORG-JS2-001 | Joint Standard 2/2020 (as amd. 9 June 2023) §4 | Calculate + exchange Variation Margin daily, per-counterparty, against MTM. | Margin Policy; VM Procedure (Ravi) | Ravi (Eitan) | DRAFTING |
| ORG-JS2-002 | JS 2/2020 §5 | Calculate + exchange Initial Margin (phased by group notional; final-phase Sept 2025: > ZAR 100bn average notional). | Margin Policy; IM Procedure (Ravi + Rohan); SIMM methodology | Ravi (Rohan) | PHASED (tracking BCBS-IOSCO phase-in) |
| ORG-JS2-003 | JS 2/2020 §6 (as amended) | Eligible collateral: cash, gold, SAGB (+ 2022 expansion to certain SA central-government bonds). | Collateral Management Policy | Eitan | DRAFTING |
| ORG-JS2-004 | JS 2/2020 §7 | Minimum transfer amount aggregate (IM + VM) ≤ R5m. | Margin Policy; encoded in margin-event constructor | Ravi | DRAFTING |
| ORG-JS2-005 | JS 2/2020 §3 | Board-approved policies + procedures sufficient for relevant transactions. | Risk Management Framework; Margin Policy | Helena | IN FLIGHT |
| ORG-JS2-006 | JS 2/2020 §8 | Margin-specific dispute-resolution procedures pre-transaction. | Margin Dispute Procedure (Imani) | Imani | DRAFTING |
| ORG-JN2-2024 | Joint Notice 2/2024 + JS 2/2020 | Margin information reporting to PA via Umoja portal from 1 April 2025. | Trade Reporting Policy (Umoja sub-pipeline); Margin Policy | Tomas + Anya | DRAFTING |
| ORG-EXCON-ODP-001 | Currency and Exchanges Manual + SARB FinSurv | Non-resident counterparty OTC derivative transactions: Authorised Dealer compliance + FinSurv reporting + approvals where required. | Excon Compliance Policy; OTC Trading Policy | Eitan (Mira) | DRAFTING |

## Domain L — Whistleblowing, ethics, anti-bribery (cross-cutting)

| ID | Citation | Requirement | Fulfilment policy | Owner | Status |
|---|---|---|---|---|---|
| ORG-WB-01 | Protected Disclosures Act 26/2000 | Provide statutory protections for whistleblowers. | Whistleblowing Policy | Owen | **IN FORCE** |
| ORG-WB-02 | PRECCA + UK Bribery Act + FCPA where applicable | Zero-tolerance ABC programme; pre-approval of gifts above threshold; ABC due diligence on third parties. | Anti-Bribery & Corruption Policy; Gifts, Hospitality & Entertainment Policy | Owen + Zara | **IN FORCE** |
| ORG-WB-03 | King IV + Companies Act | Code of Conduct, code of ethics. | Code of Conduct | Owen + Sade | **IN FORCE** |
| ORG-WB-04 | Companies Act + King IV | Conflicts of interest declared and managed. | Conflicts of Interest Policy | Owen | **IN FORCE** |

---

## Status summary

| Status | Count | Note |
|---|---|---|
| **IN FORCE** | ~152 | Policy approved (Round 1 + Round 2) and operationally live |
| PARTIAL | ~13 | Policy in force; obligation partially discharged (e.g., Board not yet constituted, B2 / B5 calibration deferred) |
| PLANNED | ~6 | Policy not yet drafted (markets / customer / legal bundle to follow) |
| N/A-yet | ~5 | Obligation contingent on a state not yet reached (FAIS licence, listing, lending products) |
| DRAFTING | ~2 | Currently being authored |

**Total tracked obligations: ~178** across 12 domains and ~64 instruments.

## Maintenance

Mira (compliance / RegTech engineer) curates this register under Zara (CCO).

- Each instrument analysis file in this library produces a slice of register entries.
- New entries are events: `ObligationRegistered { id, citation, requirement, fulfilment, owner, status, version }`.
- Status changes are events; `ObligationStatusChanged { id, from, to, reason, citation }`.
- Vera (audit) consumes the register's status events as continuous-controls evidence.
- Quarterly review by the Interim Risk Forum; annual review by the Audit Committee (Interim Audit Forum) once a Board exists, the BRC and AC.
- Regulatory-change management feeds amendments — new obligations are added; superseded obligations are retired with date and reason.

## Co-dependencies

- `Owner Inbox/2026-05-06_policy-register.md` — the policy library this register fulfils.
- `Owner Inbox/2026-05-06_governance-framework.md` — the constitutional document under which this register operates.
- `Owner Inbox/2026-05-06_core-policies-*.md` — the core policy bundles whose contents discharge each obligation.
- `Regulations/_index.md` — the instrument inventory; per-instrument analyses extend the register.
- `CLAUDE.md` Principle 2 — the architectural authority for this register.
