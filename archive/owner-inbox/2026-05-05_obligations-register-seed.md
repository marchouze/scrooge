# Obligations register — day-one seed

**Author:** Mira
**Date:** 2026-05-05
**For:** Marc, with implementation by Atlas

This is the day-one corpus for the obligations register. Every entry below becomes a register record once Atlas's subdomain is live. Each is named with its target URN and current status. Where I expect deeper ingest later, I have noted the priority provisions to seed first.

The list mirrors what `CLAUDE.md` and the eleven role briefs already cite. It is not exhaustive — it is the floor.

## 1. South African Reserve Bank — Prudential Authority

**Source:** `oblig:source:za-sarb`

| Instrument | URN | Priority provisions |
|---|---|---|
| Banks Act 94 of 1990 | `oblig:instrument:za-sarb:banks-act-94-1990` | Sections on licensing, governance, record-keeping (s60), capital adequacy, internal audit, audit committee |
| Regulations Relating to Banks (under Banks Act) | `oblig:instrument:za-sarb:regs-relating-to-banks` | Capital, liquidity, large exposures, IRRBB, BA-return chapters |
| Directive 3 of 2018 (cloud computing and offshoring of data) | `oblig:instrument:za-sarb:d3-2018` | Whole instrument |
| BA return forms and instructions (BA100, BA120, BA200, BA300, BA320, BA325, BA330, BA340, BA350, BA610, BA700, BA900, etc.) | `oblig:instrument:za-sarb:ba-returns` | Per-form instructions; cell-level mapping owned by Bea |
| PA Joint Standard 1 of 2024 (Cybersecurity and Cyber Resilience) | `oblig:instrument:za-pa-fsca:js-1-2024-cyber` | Whole instrument |
| PA directives on remuneration governance | `oblig:instrument:za-pa:remuneration` | As issued |

## 2. Financial Sector Conduct Authority

**Source:** `oblig:source:za-fsca`

| Instrument | URN |
|---|---|
| FAIS Act 37 of 2002 | `oblig:instrument:za-fsca:fais-act-37-2002` |
| FAIS General Code of Conduct | `oblig:instrument:za-fsca:fais-gcc` |
| FAIS Determination of Fit and Proper Requirements | `oblig:instrument:za-fsca:fais-fit-and-proper` |
| FSCA Conduct Standards (issued and draft) | `oblig:instrument:za-fsca:conduct-standards` |
| FSCA Banks Conduct Standard (when finalised under COFI) | `oblig:instrument:za-fsca:banks-conduct-standard` |
| Financial Markets Act 19 of 2012 | `oblig:instrument:za-fsca:fma-19-2012` |

## 3. Financial Intelligence Centre

**Source:** `oblig:source:za-fic`

| Instrument | URN | Priority provisions |
|---|---|---|
| FIC Act 38 of 2001 (as amended) | `oblig:instrument:za-fic:fic-act-38-2001` | Sections 21 (CDD), 28 (CTR), 28A (TPR), 29 (STR), 42 (RMCP) |
| FIC Guidance Notes (especially GN 7 on RBA) | `oblig:instrument:za-fic:guidance-notes` | GN 7 priority |
| FIC Public Compliance Communications | `oblig:instrument:za-fic:pccs` | As applicable |

## 4. South African Revenue Service

**Source:** `oblig:source:za-sars`

| Instrument | URN |
|---|---|
| Income Tax Act 58 of 1962 | `oblig:instrument:za-sars:ita-58-1962` |
| Value-Added Tax Act 89 of 1991 | `oblig:instrument:za-sars:vat-act-89-1991` |
| Tax Administration Act 28 of 2011 | `oblig:instrument:za-sars:taa-28-2011` |
| Securities Transfer Tax Act 25 of 2007 | `oblig:instrument:za-sars:stt-act-25-2007` |
| SARS BRS — PAYE / EMP201 / EMP501 | `oblig:instrument:za-sars:brs-paye-emp` |
| SARS BRS — IT3(b), IT3(c), IT3(s) | `oblig:instrument:za-sars:brs-it3` |
| SARS BRS — Dividends Tax | `oblig:instrument:za-sars:brs-dividends-tax` |
| SARS BRS — FATCA | `oblig:instrument:za-sars:brs-fatca` |
| SARS BRS — CRS | `oblig:instrument:za-sars:brs-crs` |

## 5. National Treasury

**Source:** `oblig:source:za-treasury`

| Instrument | URN |
|---|---|
| FSR Act 9 of 2017 (Twin Peaks) | `oblig:instrument:za-treasury:fsr-act-9-2017` |
| Conduct of Financial Institutions Bill (track) | `oblig:instrument:za-treasury:cofi-bill` |
| Annual Taxation Laws Amendment Bills | `oblig:instrument:za-treasury:tlab-annual` |

## 6. Information Regulator

**Source:** `oblig:source:za-information-regulator`

| Instrument | URN | Priority provisions |
|---|---|---|
| POPIA — Act 4 of 2013 | `oblig:instrument:za-ir:popia-4-2013` | s11 (lawful), s14 (retention), s19–22 (security and breach), s69 (direct marketing), s72 (cross-border) |
| POPIA Regulations | `oblig:instrument:za-ir:popia-regs` | Whole |
| IR codes of conduct and guidance notes | `oblig:instrument:za-ir:guidance` | As issued |

## 7. Department of Employment and Labour

**Source:** `oblig:source:za-del`

| Instrument | URN |
|---|---|
| Basic Conditions of Employment Act 75 of 1997 | `oblig:instrument:za-del:bcea-75-1997` |
| Labour Relations Act 66 of 1995 | `oblig:instrument:za-del:lra-66-1995` |
| Employment Equity Act 55 of 1998 | `oblig:instrument:za-del:eea-55-1998` |
| Skills Development Act 97 of 1998 | `oblig:instrument:za-del:sda-97-1998` |
| Skills Development Levies Act 9 of 1999 | `oblig:instrument:za-del:sdla-9-1999` |
| COIDA 130 of 1993 | `oblig:instrument:za-del:coida-130-1993` |
| Unemployment Insurance Act 63 of 2001 | `oblig:instrument:za-del:uia-63-2001` |
| UI Contributions Act 4 of 2002 | `oblig:instrument:za-del:uica-4-2002` |

## 8. CIPC and other corporate-law authorities

**Source:** `oblig:source:za-cipc`

| Instrument | URN |
|---|---|
| Companies Act 71 of 2008 | `oblig:instrument:za-cipc:companies-act-71-2008` |
| Auditing Profession Act 26 of 2005 | `oblig:instrument:za-irba:apa-26-2005` |
| Protected Disclosures Act 26 of 2000 | `oblig:instrument:za-doj:pda-26-2000` |
| Electronic Communications and Transactions Act 25 of 2002 | `oblig:instrument:za-dcdt:ecta-25-2002` |
| Consumer Protection Act 68 of 2008 | `oblig:instrument:za-dtic:cpa-68-2008` |
| National Credit Act 34 of 2005 | `oblig:instrument:za-ncr:nca-34-2005` |
| B-BBEE Act 53 of 2003 and Financial Sector Code | `oblig:instrument:za-dtic:bbbee-53-2003` |
| National Payment System Act 78 of 1998 | `oblig:instrument:za-sarb:nps-act-78-1998` |
| POCDATARA — TFS list | `oblig:instrument:za-doj:pocdatara` |

## 9. JSE and market infrastructure

**Source:** `oblig:source:za-jse`, `oblig:source:za-strate`, `oblig:source:za-bankservafrica`, `oblig:source:za-paymentssa`

| Instrument | URN |
|---|---|
| JSE Equities Rules and Directives | `oblig:instrument:za-jse:equities-rules` |
| JSE Equity Derivatives Rules | `oblig:instrument:za-jse:equity-derivs-rules` |
| JSE Currency Derivatives Rules | `oblig:instrument:za-jse:currency-derivs-rules` |
| JSE Interest Rate Market Rules | `oblig:instrument:za-jse:irm-rules` |
| JSE Listings Requirements | `oblig:instrument:za-jse:listings` |
| Strate CSD operating rules | `oblig:instrument:za-strate:rules` |
| BankservAfrica scheme rules — EFT, AC, RTC, PayShap | `oblig:instrument:za-bankservafrica:scheme-rules` |
| PaymentsSA / PASA participant rules | `oblig:instrument:za-paymentssa:participant-rules` |

## 10. International — accounting, capital, financial crime

**Sources:** `oblig:source:ifrs`, `oblig:source:bcbs`, `oblig:source:fatf`, `oblig:source:oecd`

| Instrument | URN |
|---|---|
| IFRS 9 — Financial Instruments | `oblig:instrument:ifrs:ifrs-9` |
| IFRS 7 — Disclosures | `oblig:instrument:ifrs:ifrs-7` |
| IFRS 13 — Fair Value | `oblig:instrument:ifrs:ifrs-13` |
| IFRS 15 — Revenue | `oblig:instrument:ifrs:ifrs-15` |
| IFRS 16 — Leases | `oblig:instrument:ifrs:ifrs-16` |
| IAS 1, IAS 7, IAS 12, IAS 21, IAS 27 | `oblig:instrument:ifrs:ias-{n}` |
| IFRIC 23 — Uncertainty over Income Tax Treatments | `oblig:instrument:ifrs:ifric-23` |
| BCBS Basel III post-crisis reforms (Basel IV) | `oblig:instrument:bcbs:basel-iv` |
| BCBS FRTB | `oblig:instrument:bcbs:frtb` |
| BCBS SA-CCR | `oblig:instrument:bcbs:sa-ccr` |
| BCBS IRRBB | `oblig:instrument:bcbs:irrbb` |
| BCBS LCR | `oblig:instrument:bcbs:lcr` |
| BCBS NSFR | `oblig:instrument:bcbs:nsfr` |
| BCBS 239 — Risk-data aggregation principles | `oblig:instrument:bcbs:239` |
| BCBS Principles for Sound Stress Testing | `oblig:instrument:bcbs:stress-testing` |
| FATF 40 Recommendations | `oblig:instrument:fatf:40-recs` |
| FATF SA Mutual Evaluation Reports | `oblig:instrument:fatf:za-mer` |
| OECD Common Reporting Standard | `oblig:instrument:oecd:crs` |
| OECD BEPS Actions (selected: 2, 4, 5, 13) | `oblig:instrument:oecd:beps-{n}` |

## 11. International — markets, payments, data

**Sources:** `oblig:source:isda`, `oblig:source:icma`, `oblig:source:isla`, `oblig:source:swift`, `oblig:source:iso`, `oblig:source:fix`, `oblig:source:bian`

| Instrument | URN | Notes |
|---|---|---|
| ISDA Master Agreement (2002) | `oblig:instrument:isda:master-2002` | Licensed; structured extract only |
| ISDA Credit Support Annex / Deed | `oblig:instrument:isda:csa` | Licensed |
| ISDA Common Domain Model | `oblig:instrument:isda:cdm` | Licensed |
| GMRA 2011 (ICMA) | `oblig:instrument:icma:gmra-2011` | Licensed |
| GMSLA (ISLA) | `oblig:instrument:isla:gmsla` | Licensed |
| SWIFT CBPR+ guidelines | `oblig:instrument:swift:cbpr-plus` | |
| SWIFT gpi rulebook | `oblig:instrument:swift:gpi-rulebook` | |
| SWIFT Customer Security Programme (CSP) | `oblig:instrument:swift:csp` | |
| ISO 20022 message catalogue | `oblig:instrument:iso:20022-catalogue` | |
| FIX Protocol 4.4 / 5.0 SP2 | `oblig:instrument:fix:4-4`, `oblig:instrument:fix:5-0-sp2` | |
| BIAN Service Domain Reference Model | `oblig:instrument:bian:service-domains` | Reference only |

## 12. Internal policy — initial stubs

These are placeholders to be authored, attested, and version-controlled. Each is created at status `draft` and held there until its named approver completes authoring.

| Policy | URN | Owner | Approver |
|---|---|---|---|
| Risk Management and Compliance Programme (RMCP) under FIC s42 | `oblig:policy:internal:rmcp` | Mira | Marc |
| Credit risk policy | `oblig:policy:internal:credit-risk` | Rohan | Marc |
| Market risk policy | `oblig:policy:internal:market-risk` | Rohan | Marc |
| Liquidity risk policy | `oblig:policy:internal:liquidity-risk` | Rohan | Marc |
| Operational risk policy | `oblig:policy:internal:operational-risk` | Rohan | Marc |
| Model governance policy | `oblig:policy:internal:model-governance` | Rohan | Vera (independent challenge) + Marc |
| Information security policy | `oblig:policy:internal:infosec` | Atlas | Marc |
| POPIA processing register and consent policy | `oblig:policy:internal:popia` | Mira | Marc |
| Remuneration policy (PA-aligned) | `oblig:policy:internal:remuneration` | Sade | Marc |
| Conflicts of interest policy | `oblig:policy:internal:conflicts` | Mira | Marc |
| Outsourcing and cloud policy (D3/2018-aligned) | `oblig:policy:internal:outsourcing` | Atlas | Marc |
| Whistle-blower / protected disclosure policy | `oblig:policy:internal:whistleblower` | Vera | Marc |
| Records management and retention policy | `oblig:policy:internal:records-retention` | Atlas | Marc |
| Tax policy and uncertain tax positions | `oblig:policy:internal:tax` | Yael | Marc |
| Internal audit charter | `oblig:policy:internal:internal-audit-charter` | Vera | Audit committee (proxy: Marc) |

## 13. Initial obligations to encode

Highest-priority obligations to seed once instruments and provisions are loaded. These become the first targets of citation from Atlas's platform code and from each domain engineer's first integration.

1. `oblig:obligation:kyc:cdd-natural-person` — basis: FIC Act s21; FATF R10.
2. `oblig:obligation:kyc:cdd-juristic-person` — basis: FIC Act s21; FATF R10.
3. `oblig:obligation:kyc:edd-pep` — basis: FIC Act + Guidance; FATF R12.
4. `oblig:obligation:kyc:edd-high-risk-jurisdiction` — basis: FATF R19; FIC Guidance.
5. `oblig:obligation:screening:sanctions-onboarding` — basis: POCDATARA TFS; UN; OFAC; EU; UK HMT.
6. `oblig:obligation:screening:sanctions-payment-message` — basis: same.
7. `oblig:obligation:reporting:fic-str` — basis: FIC Act s29.
8. `oblig:obligation:reporting:fic-ctr` — basis: FIC Act s28.
9. `oblig:obligation:reporting:fic-tpr` — basis: FIC Act s28A.
10. `oblig:obligation:reporting:fatca-annual` — basis: SARS BRS FATCA.
11. `oblig:obligation:reporting:crs-annual` — basis: SARS BRS CRS; OECD CRS.
12. `oblig:obligation:reporting:ba-monthly-100` — basis: SARB Regulations Relating to Banks; BA100 instructions.
13. `oblig:obligation:accounting:ifrs9-ecl-stage` — basis: IFRS 9.
14. `oblig:obligation:tax:vat-201-monthly` — basis: VAT Act; SARS BRS.
15. `oblig:obligation:tax:emp201-monthly` — basis: ITA Fourth Schedule; SARS BRS.
16. `oblig:obligation:tax:dividends-tax-declaration` — basis: ITA; SARS BRS.
17. `oblig:obligation:tax:stt-on-securities-transfer` — basis: STT Act.
18. `oblig:obligation:popia:breach-notification` — basis: POPIA s22.
19. `oblig:obligation:popia:right-of-access` — basis: POPIA s23.
20. `oblig:obligation:execution:e-signature-default` — basis: ECTA s13; with exclusions per Schedule 1.
21. `oblig:obligation:hr:bcea-leave-minima` — basis: BCEA.
22. `oblig:obligation:hr:fit-and-proper-faisrep` — basis: FAIS Determination of Fit and Proper.
23. `oblig:obligation:trading:best-execution-evidence` — basis: FSCA conduct standards.
24. `oblig:obligation:trading:market-abuse-surveillance` — basis: FMA Chapter X.
25. `oblig:obligation:payments:swift-csp-attestation` — basis: SWIFT CSP.
26. `oblig:obligation:audit:internal-audit-function` — basis: Banks Act; King IV; IIA IPPF.
27. `oblig:obligation:audit:audit-committee-reporting` — basis: Companies Act s94; King IV.
28. `oblig:obligation:cyber:joint-standard-1-2024` — basis: PA/FSCA Joint Standard 1 of 2024.

## 14. Curation cadence

- **In-force regulator content:** quarterly attestation refresh, plus on issued change notification.
- **Licensed standards:** quarterly refresh against the licensed copy.
- **Internal policies:** annually, plus on material change.
- **Counterparty contracts:** at execution and on amendment.
- **Stale-attestation alarms:** raised by Atlas's platform; reviewed by Mira; auditable by Vera.

## 15. Notes for Atlas

The seeding work begins as soon as the register subdomain is live. I would like to do the seeding incrementally, in this order:

1. Sources and instruments (this document's headings 1–11).
2. Internal policy stubs at `draft` (heading 12).
3. Provisions for the priority instruments (Banks Act, FIC Act, FAIS Act, POPIA, IFRS 9, BCBS Basel IV, FRTB, ITA Fourth Schedule).
4. The 28 priority obligations (heading 13), each citing the provisions seeded in step 3.
5. Then the long tail.

Step 4 is the moment the rest of the team can start citing in code.
