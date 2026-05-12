# Policy register — required policies for the bank

> **Status update — 2026-05-06.** The CEO has approved (Round 2 decision pack, all 7 items): the **41 core policies** across the five bundles (Risk · Compliance & Privacy · InfoSec & Ops · Finance & Treasury · Conduct & HR), the **IFRS 9** hedge-accounting election (F1), and **this register itself** as the bank's authoritative policy taxonomy. Status of those policies transitions from `PLANNED` / `DRAFTING` to **`IN FORCE`** as of today's date; statuses in the tables below are read against this update. Carry-forward refinements remain on B2 (capital / liquidity buffers), B5 (trading mandate), and the POPIA IO designation lodgment.

**Author:** Owen (Company Secretary — policy-library custodian)
**Contributors:** Helena (risk), Zara (compliance), Iris (privacy), Senna (infosec), Camille (finance), Eitan (treasury), Saskia (markets), Devon (ops), Sade (HR), Imani (legal), Mira (regulatory citation engineering), Vera (audit lens)
**Date:** 2026-05-06
**For:** Marc (CEO)

> **Derivation note (Principle 6).** This register is itself a policy-layer artefact — a meta-policy listing every policy the bank requires. It cites the regulatory or governance authority that creates each obligation. Engineers and governance seats build standards and processes that satisfy these policies; presentations summarise from them. The register is curated by the CoSec, with the CCO (Zara) and CRO (Helena) as primary contributors and Mira engineering the citation links into the obligations register.

## How to read this register

Each policy carries:

- **Owner** — engineer / governance seat that authors and maintains.
- **Approval** — CEO / Committee (BRC, AC, RemCo, S&E, NomCo, ALCO) / Board. Per the two-track approval routing convention (memory: feedback_ceo_vs_board_approval), all material policies are Board-route.
- **Cadence** — review cycle. Annual unless stated.
- **Citation** — regulator instrument or standard that creates the obligation.
- **Status** — `EXISTS` (drafted as of 2026-05-06), `DRAFTING` (in progress), `PLANNED` (to be drafted), `BOARD-RES` (Board-reserved approval pending).

The register lists **~75 policies** across 14 domains. Some are mandatory for SARB-licence application; others become mandatory once the bank carries certain licences (e.g. FAIS) or once it lists. The minimum-viable set for the SARB licence application is flagged ★.

---

## 1. Foundation and meta-policies

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Risk Appetite Statement (RAS) | Helena | Board | Annual | Banks Act; BCBS Corporate Governance Principles for Banks | `EXISTS` (Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md, approved B1) |
| ★ Governance Framework (constitutional / meta-policy) | Helena + Owen | Board | Annual | Banks Act; King IV; Companies Act 71 of 2008 | `EXISTS` (approved A1) |
| Risk Management Framework | Helena | Board | Annual | BCBS; Banks Act | `DRAFTING` (in RAS-RAF) |
| Combined Assurance Policy | Owen + future CAE | AC | Annual | King IV; IIA IPPF | `PLANNED` |
| ★ Delegation of Authority (DoA) | Owen + Devon | Board | Annual | Companies Act; King IV | `DRAFTING` (in framework §6) |
| Policy on Policies (this register) | Owen | Board | Annual | King IV | `EXISTS` (this document) |

## 2. Risk policies (Helena, with Rohan engineering)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Credit Risk Policy | Helena | BRC | Annual | Banks Act; BCBS large-exposures framework | `PLANNED` |
| ★ Market Risk Policy | Helena | BRC | Annual | BCBS Market Risk (FRTB / D352, D457) | `PLANNED` |
| ★ Liquidity Risk Management Policy | Helena + Eitan | BRC | Annual | BCBS D295 / D335 / BCBS 144 | `IN FORCE` (v1: Policies/liquidity-risk-management-policy-v1.md; inbox: Owner Inbox/2026-05-11_camille-eitan-helena_liquidity-risk-management-policy-v1.md) |
| IRRBB Policy | Helena + Eitan | BRC | Annual | BCBS D368 | `PLANNED` |
| Counterparty Credit Risk Policy | Helena + Saskia | BRC | Annual | BCBS large-exposures framework | `PLANNED` |
| ★ Operational Risk Policy | Helena + Devon | BRC | Annual | BCBS Operational Risk (rev. 2021) | `PLANNED` |
| ★ Operational Resilience Policy | Devon (with Helena) | BRC | Annual | BCBS Operational Resilience (2021) | `PLANNED` |
| Model Risk Policy | Helena | BRC | Annual | SR 11-7 / SS 1/23 idiom; BCBS | `PLANNED` (B7 approved) |
| Stress Testing Policy | Helena | BRC | Annual | Banks Act / PA; BCBS | `PLANNED` |
| ★ ICAAP | Helena (with Camille) | Board | Annual | Banks Act / PA | `PLANNED` |
| ★ ILAAP | Helena (with Eitan) | Board | Annual | Banks Act / PA; BCBS | `PLANNED` |
| Climate-Related Risk Policy | Helena (with S&E) | BRC + S&E | Annual | PA Guidance Note 1 of 2024; TCFD | `PLANNED` (B9 approved) |
| Reputational Risk Policy | Helena | BRC | Annual | King IV | `PLANNED` |
| Strategic Risk Policy | Helena (with CEO) | Board | Annual | King IV | `PLANNED` |

## 3. Compliance & financial-crime policies (Zara, with Mira engineering)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Risk Management & Compliance Programme (RMCP) | Zara | BRC + Board | Annual | FIC Act s.42 | `IN FORCE` (v1: Policies/risk-management-and-compliance-policy-v1.md; inbox: Owner Inbox/2026-05-11_mira-zara_rmcp-v1.md) |
| ★ AML / CFT Policy | Zara | BRC | Annual | FIC Act 38 of 2001; FATF Recs | `IN FORCE` (v1: Policies/aml-cft-policy-v1.md; inbox: Owner Inbox/2026-05-11_mira-zara_aml-cft-policy-v1.md) |
| ★ Sanctions Policy | Zara | BRC | Annual | UN; OFAC; EU; UK HMT; POCDATARA / DTI list | `PLANNED` (B4 approved) |
| PEP Policy | Zara | BRC | Annual | FIC Guidance Note 7 (RBA); FATF Rec. 12 | `PLANNED` |
| ★ KYC / CDD / EDD Policy | Zara (with Mira) | BRC | Annual | FIC Act ss.21–21H | `DRAFTING` (in client-master design, D1 approved) |
| Transaction Monitoring Policy | Zara (with Mira) | BRC | Annual | FIC Act ss.28–29; FATF | `PLANNED` |
| STR / CTR / TPR Policy | Zara | BRC | Annual | FIC Act ss.28 / 28A / 29 | `PLANNED` |
| FATCA / CRS Policy | Zara + Yael | BRC | Annual | FATCA IGA; CRS; SARS BRS | `PLANNED` |
| Tipping-Off Prevention Policy | Zara | BRC | Annual | FIC Act | `PLANNED` |
| ★ Conduct of Business / TCF Policy | Zara | BRC | Annual | FSCA conduct standards; TCF outcomes | `PLANNED` |
| FAIS Policy (when FSP licence carried) | Zara (with Saskia / Niko) | BRC | Annual | FAIS Act 37 of 2002; General Code of Conduct | `PLANNED` |
| Market Abuse / Surveillance Policy | Zara (with Saskia) | BRC | Annual | Financial Markets Act 19 of 2012, Ch. X | `PLANNED` |
| Complaints Handling Policy | Zara (with Niko) | BRC | Annual | FAIS; FSCA; National Credit Act where relevant | `PLANNED` |
| Excon Compliance Policy | Zara (with Eitan) | BRC | Annual | Currency and Exchanges Manual for Authorised Dealers | `PLANNED` |
| Regulatory Change Management Policy | Zara (with Mira) | BRC | Annual | Internal — implements P2 | `PLANNED` |
| Regulatory Engagement Policy | Zara (with Owen) | Board | Annual | King IV; Banks Act | `PLANNED` |

## 4. Privacy & data-protection policies (Iris)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ POPIA / Privacy Policy | Iris | BRC + S&E | Annual | POPIA 4 of 2013 | `IN FORCE` (v1: Policies/popia-privacy-policy-v1.md; inbox: Owner Inbox/2026-05-11_iris-zara_popia-privacy-policy-v1.md) |
| Data Retention & Disposal Policy | Iris (with Owen) | BRC | Annual | POPIA s.14; legal-records retention | `PLANNED` |
| Cross-Border Transfer Policy | Iris | BRC | Annual | POPIA s.72; SARB Directive 3 of 2018 | `PLANNED` |
| ★ PAIA Manual | Iris (with Owen) | Information Officer signs | On change | PAIA Act 2 of 2000 | `PLANNED` (E1 deferred) |
| Privacy Impact Assessment Policy | Iris | BRC | Annual | POPIA s.55 IO duties | `PLANNED` |
| Consent & Notice Policy | Iris (with Niko) | BRC | Annual | POPIA ss.13, 18 | `PLANNED` |

## 5. Information security & cyber policies (Senna engineering; Rashida CISO governance from 2026-05-06)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Information Security Policy | Senna + Rashida (CISO from 2026-05-06) | BRC | Annual | POPIA ss.19–22; ISO 27001 | `IN FORCE` (Round 2 bundle §1) |
| ★ Cyber Resilience Policy | Senna + Rashida (CISO from 2026-05-06) | BRC | Annual | Joint Standard 1 of 2024 | `IN FORCE` (Round 2 bundle §2; B6 approved) |
| Access Control Policy | Senna + Rashida | BRC | Annual | POPIA ss.19; ISO 27001 | `PLANNED` |
| Cryptographic Key Management Policy | Senna + Rashida | BRC | Annual | FIPS 140-2/3; ISO 27001 | `PLANNED` |
| Incident Response Policy | Senna + Rashida (with Iris, Zara) | BRC | Annual | Joint Standard 1 of 2024; POPIA s.22 | `IN FORCE` (Round 2 bundle §3) |
| Secure SDLC Policy | Senna + Rashida | BRC | Annual | NIST SSDF; SLSA; ISO/IEC 27001:2022 A.8.25–A.8.34; Joint Standard 1 of 2024 | **`IN FORCE`** (added 2026-05-06 end-of-day; bundle §9; procedure `secure-sdlc.md` populated) |
| Data Classification & Handling Policy | Senna (with Iris) | BRC | Annual | POPIA; ISO 27001 | `PLANNED` |
| Acceptable Use Policy | Senna (with Sade) | BRC | Annual | ISO 27001 | `PLANNED` |
| Vulnerability Management Policy | Senna | BRC | Annual | ISO 27001; NIST | `PLANNED` |
| Fraud Risk Management Policy | Zara + Senna | BRC | Annual | FIC Act; King IV | `PLANNED` |

## 6. Operations & technology policies (Devon)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Outsourcing & Third-Party Risk Policy | Devon | Board | Annual | SARB Directive 3 of 2018 | `PLANNED` |
| Cloud Computing Policy | Devon (with Senna, Iris) | Board | Annual | SARB Directive 3 of 2018; POPIA s.72 | `PLANNED` |
| ★ Business Continuity & Disaster Recovery Policy | Devon | BRC | Annual | BCBS Operational Resilience; King IV | `PLANNED` |
| Change Management Policy | Devon (with Atlas) | BRC | Annual | ITIL; BCBS Operational Risk | `PLANNED` |
| ★ Records Management Policy | Owen (with Devon) | Board | Annual | Companies Act; FIC Act s.22; POPIA | `PLANNED` |
| IT General Controls Policy | Devon (with Atlas, Senna) | BRC | Annual | COBIT; ISO 27001 | `PLANNED` |
| Vendor Management Policy | Devon | BRC | Annual | SARB Directive 3 of 2018 | `PLANNED` |

## 7. Finance, accounting, tax policies (Camille, with Bea + Yael)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Capital Management Policy | Camille | Board (via BRC) | Annual | Banks Act; BCBS Basel III/IV | `IN FORCE` (v1: Policies/capital-management-policy-v1.md; inbox: Owner Inbox/2026-05-11_camille-helena_capital-management-policy-v1.md) |
| ★ Recovery & Resolution Planning Policy | Helena + Camille + Owen | Board | Annual | PA D1/2015; Banks Act ss.60-72; FSB Key Attributes | `IN FORCE` (v1: Policies/recovery-resolution-planning-policy-v1.md; inbox: Owner Inbox/2026-05-11_helena-camille_recovery-resolution-planning-policy-v1.md) |
| ★ Capital Plan | Camille | Board | Annual | Banks Act; PA | `PLANNED` |
| ★ Accounting Policies (IFRS) | Camille (with Bea) | AC + Board | Annual | IFRS 9 / 7 / 13 / 15 / 16; IAS 1 / 12 / 21 | `PLANNED` |
| Financial Reporting & Disclosure Policy | Camille (with Bea) | AC + Board | Annual | Banks Act; IFRS; JSE LR (if listed) | `PLANNED` |
| ★ Tax Policy | Yael (under Camille) | AC | Annual | Income Tax Act; VAT Act; Tax Admin Act | `PLANNED` |
| Transfer Pricing Policy | Yael | AC | Annual | Income Tax Act; OECD TP Guidelines | `PLANNED` |
| External Audit Engagement Policy | Camille (with Owen) | AC + Board | Annual | Companies Act; Banks Act; IRBA | `PLANNED` |
| Provisioning / IFRS 9 ECL Policy | Helena (with Bea) | BRC + AC | Annual | IFRS 9 | `PLANNED` |

## 8. Treasury policies (Eitan, with Ravi engineering)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| Funding Strategy Policy | Eitan | ALCO + BRC | Annual | Banks Act; BCBS 144 | `PLANNED` |
| Hedge Accounting Policy | Eitan (with Camille) | AC | Annual | IFRS 9 / IAS 39 carryover | `PLANNED` |
| FTP Methodology Policy | Eitan (with Camille, Helena) | ALCO | Annual | Internal — implements RAS | `PLANNED` |
| Collateral Management Policy | Eitan (with Saskia) | ALCO + BRC | Annual | BCBS; ISDA / GMRA market practice | `PLANNED` |
| Capital Instrument Issuance Policy | Eitan (with Camille) | Board | On need | Banks Act; BCBS Basel III/IV | `PLANNED` |
| Intraday Liquidity Policy | Eitan | ALCO + BRC | Annual | BCBS BCBS 248 | `PLANNED` |

## 9. Markets policies (Saskia, with Kai engineering)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Trading Mandate | Saskia (with Helena) | Board | Annual | Banks Act; FMA; BCBS market risk | `IN FORCE` (v1: Policies/trading-mandate-v1.md; inbox: Owner Inbox/2026-05-11_kai-helena-devon_trading-mandate-v1.md) |
| Best Execution Policy | Saskia | BRC | Annual | FAIS; FMA; FSCA conduct standards | `PLANNED` |
| Voice & Communications Recording Policy | Saskia (with Senna, Iris, Sade) | BRC | Annual | FMA Ch. X; POPIA; FAIS | `PLANNED` |
| Counterparty Onboarding Policy (markets) | Saskia (with Zara, Imani) | BRC | Annual | FIC Act; FATCA; ISDA | `PLANNED` |
| New Product Approval Policy | Saskia (with Helena, Camille, Zara) | BRC | On product | BCBS; FSCA conduct standards | **`IN FORCE`** (Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md; v1.0; D-NEW-PRODUCT-APPROVAL-POLICY) |

## 10. Customer / sales policies (Niko)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Customer Acceptance Policy | Niko (with Zara) | BRC | Annual | FIC Act; FAIS; TCF | `PLANNED` |
| Customer Treatment Policy (TCF outcomes) | Niko (with Zara) | BRC | Annual | FSCA TCF outcomes | `PLANNED` |
| Marketing & Advertising Policy | Niko (with Zara) | BRC | Annual | FAIS; FSCA conduct standards; National Credit Act where relevant | `PLANNED` |
| Pricing Policy | Niko (with Helena, Eitan, Camille) | BRC | Annual | FAIS fee disclosure; TCF | `PLANNED` |
| Channel Conduct Policy | Niko | BRC | Annual | FSCA conduct standards | `PLANNED` |

## 11. People & HR policies (Sade, future CHRO)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Remuneration Policy | Sade (interim) / future CHRO + Helena | RemCo + Board | Annual | King IV; Banks Act; BCBS Compensation principles | `IN FORCE` (v1: Policies/remuneration-policy-v1.md; inbox: Owner Inbox/2026-05-11_owen-sade_remuneration-policy-v1.md) |
| ★ Fit-and-Proper Policy | Sade (with Owen, Helena) | NomCo | Annual | PA / FSCA fit-and-proper standards | `IN FORCE` (v1: Policies/fit-and-proper-policy-v1.md; inbox: Owner Inbox/2026-05-11_owen-helena_fit-and-proper-policy-v1.md) |
| Recruitment & Selection Policy | Sade | RemCo | Biennial | Employment Equity Act | `PLANNED` |
| Disciplinary Policy | Sade | RemCo | Biennial | Labour Relations Act | `PLANNED` |
| Grievance Policy | Sade | RemCo | Biennial | Labour Relations Act | `PLANNED` |
| Harassment & Discrimination Policy | Sade | RemCo + S&E | Biennial | Employment Equity Act; Codes of Good Practice | `PLANNED` |
| Health & Safety Policy | Sade | S&E | Biennial | Occupational Health and Safety Act | `PLANNED` |
| Leave Policy | Sade | RemCo | Biennial | BCEA | `PLANNED` |
| Performance Management Policy | Sade | RemCo | Annual | Internal | `PLANNED` |
| Employment Equity Policy | Sade | S&E | Annual | Employment Equity Act | `PLANNED` |
| B-BBEE Policy | Sade | S&E | Annual | B-BBEE Act + Codes; FSC | `PLANNED` |
| Skills Development Policy | Sade | RemCo | Biennial | Skills Development Act; SDL | `PLANNED` |

## 12. Conduct & ethics policies (Owen, with Sade & Zara)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Code of Conduct | Owen (with Sade) | Board | Biennial | King IV; Companies Act | `PLANNED` |
| Code of Ethics | Owen | Board | Biennial | King IV | `PLANNED` |
| ★ Conflicts of Interest Policy | Owen | Board | Biennial | Companies Act; King IV; FAIS | `PLANNED` |
| Related-Party Transactions Policy | Owen | Board | Biennial | Companies Act; IAS 24; JSE LR if listed | `PLANNED` |
| Gifts, Hospitality & Entertainment Policy | Owen | AC + S&E | Biennial | PRECCA; King IV | `PLANNED` |
| ★ Anti-Bribery & Corruption Policy | Owen + Zara | Board | Biennial | PRECCA; UK Bribery Act (extra-territorial); FCPA where relevant | `PLANNED` |
| ★ Whistleblowing Policy | Owen | AC + S&E | Biennial | Protected Disclosures Act; King IV | `PLANNED` |
| Insider Trading / Personal Account Dealing Policy | Owen + Zara | BRC | Annual | FMA Ch. X; JSE LR if listed | `PLANNED` |
| Information Disclosure / Insider-Information Policy | Owen + Zara | Board | Biennial | FMA; JSE LR if listed | `PLANNED` |
| Social & Ethics Policy | Owen + future CHRO | S&E | Biennial | Companies Act Reg. 43 | `PLANNED` |

## 13. Legal policies (Imani, future GC)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| Contracting Policy | Imani | BRC | Annual | Companies Act; ECTA | `PLANNED` |
| Litigation Policy | Imani (with Owen) | BRC | Annual | Internal | `PLANNED` |
| Intellectual Property Policy | Imani | BRC | Biennial | IP statutes | `PLANNED` |
| Document Execution Policy (ECTA) | Imani | BRC | Annual | Electronic Communications and Transactions Act 25 of 2002 | `PLANNED` |

## 14. Audit & assurance (Vera engineer, future CAE)

| Policy | Owner | Approval | Cadence | Citation | Status |
|---|---|---|---|---|---|
| ★ Internal Audit Charter | Thandiwe (with Vera) | AC + Board | Annual | IIA IPPF; BCBS 223 | `IN FORCE` (v1: Policies/internal-audit-charter-v1.md; inbox: Owner Inbox/2026-05-11_thandiwe-vera_internal-audit-charter-v1.md) |
| Combined Assurance Policy | Future CAE (with Owen) | AC | Annual | King IV; IIA | `PLANNED` |
| External Audit Independence Policy | Camille + future CAE | AC + Board | Annual | IRBA; Companies Act | `PLANNED` |

---

## Summary

- **Total policies:** ~75 across 14 domains.
- **Marked ★ (minimum-viable for SARB-licence application):** ~30 — these are the must-haves before a licence application is credible. Of those:
  - Already drafted today: **RAS, Governance Framework, KYC/CDD/EDD (in client-master design)** — 3.
  - Drafted in part: **DoA, Risk Management Framework** — 2.
  - Approved-pending-drafting: B3, B4, B6, B7, B8, B9 (defaults set; full policies to be drafted).
  - **The remaining ★ policies are all `PLANNED`** — they are the priority drafting queue for Helena, Zara, Iris, Senna, Devon, Camille, Eitan, Saskia.
- **Two B-route items deferred** (B2 capital/liquidity buffer floors, B5 trading mandate) feed directly into the Capital Management Policy and Trading Mandate respectively; their refinement will close out those policy stubs.

## Recommended drafting sequence

1. **Constitutional layer (now in force):** RAS, governance framework. ✓
2. **Compliance core (next 2 weeks):** RMCP, AML/CFT, Sanctions, KYC/CDD/EDD, FATCA/CRS, POPIA / Privacy, PAIA Manual.
3. **Risk core (parallel, 2–3 weeks):** Credit, Market, Liquidity, IRRBB, Operational, Operational Resilience, Model Risk, Climate.
4. **Finance core (parallel, 2–3 weeks):** Capital Management (incorporates B2 refinement), Accounting Policies, Tax, ICAAP, ILAAP.
5. **Operations and security (parallel, 3–4 weeks):** Outsourcing, BCP/DR, Information Security, Cyber Resilience, Incident Response, Records Management.
6. **Conduct & ethics (4 weeks):** Code of Conduct, Conflicts of Interest, Anti-Bribery, Whistleblowing, Gifts.
7. **HR (4–6 weeks):** Remuneration, Fit-and-Proper, plus the labour-law mandatory set.
8. **Markets, customer, treasury (parallel with above, owned by respective seats).**
9. **Audit (when CAE is hired):** Internal Audit Charter, Combined Assurance.

Helena and Zara to coordinate the sequencing with Owen; Owen tracks the policy-library state as a projection over policy events (drafting, approval, review, retirement).

## Open items requiring CEO action

1. **Approve this register** as the policy taxonomy of record. *(See potential decision in next decision pack.)*
2. **Confirm drafting sequence and cadence.** Default proceeds on the recommendation above.
3. **Authorise sequencing of the FAIS-licence application** so the FAIS-conditional policies can be added to the queue at the right time.
4. **Authorise the drafting of the Trading Mandate (B5 deferred) and Capital Management Policy (B2 deferred)** as a coordinated piece of work led by Saskia / Helena / Camille / Eitan.

## Co-dependencies

- `Owner Inbox/2026-05-06_governance-framework.{md,html}` — the constitutional policy this register sits under.
- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.{md,html}` — drives §2 (Risk policies).
- `Owner Inbox/2026-05-06_client-master-and-continuous-kyc.{md,html}` — operational substrate for §3 (Compliance / financial-crime policies).
- Mira's obligations register — the citation graph from each policy back to its regulator instrument; this register is the inventory side of that graph.
