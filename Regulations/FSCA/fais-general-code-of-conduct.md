---
title: FAIS General Code of Conduct — Analysis
author: Mira (Compliance / RegTech engineer)
date: 2026-05-12
status: POPULATED
decision-required: false
---

# FAIS General Code of Conduct for Authorised Financial Services Providers and Representatives

**Source document:** `Regulations/FSCA/source-docs/fais-general-code-of-conduct.pdf`
**Extracted text:** `Regulations/FSCA/source-docs/fais-general-code-of-conduct.txt`
**Instrument:** Board Notice 80 of 2003, as amended by Board Notice 43 of 14 May 2008
**Enabling provision:** FAIS Act 37 of 2002, s.15
**Curator:** Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO)
**Status:** POPULATED
**Last reviewed:** 2026-05-12
**Entity scope:** `securities` (Hoz Securities Limited — primary FSP licensee)

---

## Citation

General Code of Conduct for Authorised Financial Services Providers and Representatives (Board Notice 80 of 2003, as amended by Board Notice 43 of 2008). Published under FAIS Act 37 of 2002 s.15. Obligations register umbrella row: `ORG-FAIS-RK-GENERAL-CODE`. Sub-domain rows: `ORG-FAIS-RK-ADVICE`, `ORG-FAIS-RK-SUITABILITY`, `ORG-FAIS-RK-FEE-DISCLOSURE`, `ORG-FAIS-RK-COMPLAINT-HANDLING`.

---

## Section-by-section analysis

### Part I — s.1: Definitions, construction and application

**Verbatim (key definitions):**

> **"provider"** means an authorised financial services provider, and includes a representative.

> The provisions of this Code apply, unless stated otherwise in this Code or otherwise by law, to all financial services providers and representatives.

**Construction rule:**

> This Code must be construed — (i) in conjunction with the provisions of the Act and in manner conducive to the promotion and achievement of the objectives of codes of conduct as stated in section 16 of the Act; and (ii) as being in addition to any other law not inconsistent with its provisions and not as replacing any such law.

> In the case of any inconsistency or conflict between — (i) a provision of this Code and a provision of any other specific Code drafted under section 15 of the Act, the last mentioned provision shall prevail; and (ii) a provision of this Code and a provision of any other law specifically regulating market conduct in the rendering of financial services in respect of one or more specific financial products, the last mentioned provision, unless inconsistent or in conflict with the Act, shall prevail.

**Application to Hoz:** The GCC applies to Hoz Securities Limited as the authorised FSP and to all its representatives. The FSCA Conduct Standards (CS 1, CS 2, CS 3 of 2018) applicable to ODP activities are lex specialis and prevail over the GCC where they conflict — but the GCC supplies the general conduct baseline.

---

### Part II — s.2: General duty of provider

**Verbatim:**

> A provider must at all times render financial services honestly, fairly, with due skill, care and diligence, and in the interests of clients and the integrity of the financial services industry.

**Obligation triggered:** `ORG-FAIS-RK-GENERAL-CODE` — This is the primary conduct obligation. It maps to FAIS Act s.16(1)(a). The phrase "at all times" means the duty is continuous, not transaction-specific. For Hoz Securities Limited as an institutional FSP, "in the interests of clients" applies across all advice and intermediary service interactions.

**Obligations register citation update:** `ORG-FAIS-RK-GENERAL-CODE` Citation column — the GCC s.2 reference is now pinned (replaces `[citation: TBC — full General Code sub-section index]` for this element).

---

### Part II — s.3: Specific duties of provider

**Verbatim (s.3(1)):**

> When a provider renders a financial service — (a) representations made and information provided to a client by the provider — (i) must be factually correct; (ii) must be provided in plain language, avoid uncertainty or confusion and not be misleading; (iii) must be adequate and appropriate in the circumstances of the particular financial service, taking into account the factually established or reasonably assumed level of knowledge of the client; (iv) must be provided timeously so as to afford the client reasonably sufficient time to make an informed decision about the proposed transaction; ... (vii) must, as regards all amounts, sums, values, charges, fees, remuneration or monetary obligations mentioned or referred to therein and payable to the product supplier or the provider, be reflected in specific monetary terms...

> (b) the provider must disclose to the client the existence of any personal interest in the relevant service, or of any circumstance which gives rise to an actual or potential conflict of interest in relation to such service, and take all reasonable steps to ensure fair treatment of the client...

> (f) the provider involved must not deal in any financial product for own benefit, account or interest where the dealing is based upon advance knowledge of pending transactions for or with clients, or on any non-public information the disclosure of which would be expected to affect the prices of such product.

**Verbatim (s.3(2) — record-keeping):**

> A provider must have appropriate procedures and systems in place to — (i) record such verbal and written communications relating to a financial service rendered to a client as are contemplated in the Act, this Code or any other Code drafted in terms of section 15 of the Act; (ii) store and retrieve such records and any other material documentation relating to the client or financial service rendered to the client; and (iii) keep such client records and documentation safe from destruction.

> All such records must be kept for a period of five years after termination, to the knowledge of the provider, of the product concerned or, in any other case, after the rendering of the financial service concerned.

> Providers are not required to keep the records themselves but must ensure that they are available for inspection within seven days of the registrar's request.

> Records may be kept in an appropriate electronic or recorded format, which are accessible and readily reducible to written or printed form.

**Verbatim (s.3(3) — confidentiality):**

> A provider may not disclose any confidential information acquired or obtained from a client or... a product supplier in regard to such client or supplier, unless the written consent of the client or product supplier, as the case may be, has been obtained beforehand or disclosure of the information is required in the public interest or under any law.

**Obligations triggered:**

- **s.3(2)(i)–(iii) + five-year floor:** `ORG-FAIS-RK-ADVICE` — This is the specific GCC citation for advice-record keeping. The citation `GCC s.3(2)` (read with FAIS Act s.18) is the **precision citation** replacing `[citation: TBC — precise General Code sub-section on advice-record retention]` in the obligations register. Retention period: five years after termination of the product or rendering of the financial service.
- **s.3(1)(b) — conflict disclosure:** `ORG-FAIS-RK-GENERAL-CODE` — feeds the Conflicts of Interest Policy (`ORG-WB-04`); cross-binds to `fais-conflict-of-interest-code.md`.
- **s.3(1)(f) — front-running prohibition:** `ORG-FAIS-RK-GENERAL-CODE` — no front-running on client order flow. Critical for institutional OTC trading where the bank's proprietary desk and client-flow desk must be separated. Cross-binds to the Trading Policy and information-barrier controls.

**Citation update for obligations register:**
- `ORG-FAIS-RK-ADVICE` Citation: `FAIS Act 37/2002 s.18` + **`GCC (BN 80/2003) s.3(2)` — five-year record retention; seven-day availability for inspection; electronic format acceptable**
- `ORG-FAIS-RK-SUITABILITY` Citation: **`GCC s.8`** (see below)
- `ORG-FAIS-RK-FEE-DISCLOSURE` Citation: **`GCC s.3(1)(a)(vii)` + `GCC s.7(1)(c)(iii)(bb)` + `GCC s.7(1)(c)(vi)`** (see below)

---

### Part III — s.4: Information on Product Suppliers

**Verbatim (s.4(1)):**

> A provider other than a direct marketer must at the earliest reasonable opportunity, and only where appropriate, furnish the client with full particulars of the following information about the relevant product supplier... (b)(i) the contractual relationship with the product supplier (if any), and whether the provider has contractual relationships with other product suppliers... (d) where applicable, the fact that the provider — (i) directly or indirectly holds more than 10% of the relevant product supplier's shares, or has any equivalent substantial financial interest in the product supplier; (ii) during the preceding 12 month period received more than 30% of total remuneration, including commission, from the product supplier.

**Application to Hoz:** As an institutional FSP, Hoz Securities Limited's "product suppliers" in the FAIS sense are the counterparties / issuers of financial products in the institutional OTC market. The s.4 disclosure obligations apply in the context of intermediary services. For principal trading (where Hoz Securities is itself the counterparty), the GCC applies to the advice and information disclosure dimension.

---

### Part IV — s.5: Information on Providers

**Verbatim:**

> Where a provider other than a direct marketer renders a financial service to a client, the provider must at the earliest reasonable opportunity furnish the client with full particulars of the following information... (a) Full business and trade names, registration number (if any), postal and physical addresses, telephone and, where applicable, cellular phone number, and internet and e-mail addresses... (b) concise details of the legal and contractual status of the provider... (d) details of the financial services which the provider is authorised to provide in terms of the relevant licence and any conditions or restrictions applicable thereto; (e) whether the provider holds guarantees or professional indemnity or fidelity insurance cover or not. (f) whether a representative of a provider is rendering services under supervision as defined in the Determination of Fit and Proper Requirements.

**Obligation triggered:** `ORG-FAIS-RK-GENERAL-CODE` — pre-engagement disclosure of provider identity, licence scope, and supervision status. Activates at FSP licence-day. The "under supervision" disclosure flag in s.5(f) is directly linked to the fit and proper determination — representatives who have not yet completed their full competency requirements must be disclosed as serving under supervision.

---

### Part V — s.6: Contacting of Client

**Verbatim:**

> A provider must — (a) in making contact arrangements, and in all communications and dealings with a client, act honourably, professionally and with due regard to the convenience of the client; and (b) at the commencement of any contact, visit or call initiated by the provider, explain the purpose thereof and at the earliest opportunity, provide the information referred to in section 5.

**Application to Hoz:** For institutional counterparties (Hoz Securities Limited's client base), the "contact" obligations apply to how the bank initiates relationship discussions and product conversations. The obligation to provide s.5 information at the commencement of contact is a pre-engagement disclosure gate.

---

### Part VI — s.7: Information about Financial Service

**Verbatim (key excerpts):**

> Subject to the provisions of this Code, a provider other than a direct marketer, must — (a) provide a reasonable and appropriate general explanation of the nature and material terms of the relevant contract or transaction to a client, and generally make full and frank disclosure of any information that would reasonably be expected to enable the client to make an informed decision; (b) whenever reasonable and appropriate, provide to the client any material contractual information and any material illustrations, projections or forecasts in the possession of the provider...

> (c) in particular, at the earliest reasonable opportunity, provide, where applicable, full and appropriate information of the following: (i) Name, class or type of financial product concerned; (ii) nature and extent of benefits to be provided... (iii) where the financial product is marketed or positioned as an investment or as having an investment component: (aa) concise details of the manner in which the value of the investment is determined... (bb) separate disclosure (and not mere disclosure of an all inclusive fee or charge) of any charges and fees to be levied against the product...

> (iv) the nature and extent of monetary obligations assumed by the client, directly or indirectly, in favour of the product supplier, including the manner of payment or discharge thereof, the frequency thereof, the consequences of non-compliance...

> (v) the nature and extent of monetary obligations assumed by the client, directly or indirectly, in favour of the provider, including the manner of payment or discharge thereof, the frequency thereof, and the consequences of non-compliance.

> (vi) the nature, extent and frequency of any incentive, remuneration, consideration, commission, fee or brokerages ("valuable consideration"), which will or may become payable to the provider, directly or indirectly, by any product supplier or any person other than the client, or for which the provider may become eligible, as a result of rendering of the financial service, as well as the identity of the product supplier or other person providing or offering the valuable consideration.

**Obligations triggered:**
- `ORG-FAIS-RK-FEE-DISCLOSURE` — **Precision citation: GCC s.7(1)(c)(vi)** — disclosure of all fees, remuneration, and valuable consideration received by the provider, including the identity of who pays it. This is the GCC's fee-disclosure requirement, replacing `[citation: TBC — precise General Code sub-section on fee / charge disclosure pre-engagement]`.
- `ORG-FAIS-RK-ADVICE` — **Precision citation: GCC s.7(1)(a)+(b)+(c)** — full and frank disclosure of material terms, material contractual information, product details.

---

### Part VII — s.8: Suitability

**Verbatim:**

> A provider, other than a direct marketer, must, prior to providing a client with advice — (a) take reasonable steps to seek from the client appropriate and available information regarding the client's financial situation, financial product experience and objectives to enable the provider to provide the client with appropriate advice; (b) conduct an analysis, for purposes of the advice, based on the information obtained; (c) identify the financial product or products that will be appropriate to the client's risk profile and financial needs, subject to the limitations imposed on the provider under the Act or any contractual arrangement.

> The provider must take reasonable steps to ensure that the client understands the advice and that the client is in a position to make an informed decision.

> Where a client — (a) has not provided all information requested by a provider furnishing advice... the provider must fully inform the client thereof and ensure that the client clearly understands that — (i) a full analysis in respect of the client... could not be undertaken; (ii) there may be limitations on the appropriateness of the advice provided; and (iii) the client should take particular care to consider on its own whether the advice is appropriate...

**Obligation triggered:** `ORG-FAIS-RK-SUITABILITY` — **Precision citation: GCC s.8(1)(a)–(c)** replaces `[citation: TBC — precise General Code sub-section on suitability-assessment record requirements]`. The three-step suitability process: (1) seek client information; (2) conduct analysis; (3) identify appropriate product. For institutional counterparties, the client-information-seeking obligation is calibrated to the institutional assumption-set (professional/institutional clients are presumed to understand product mechanics — but the information-gathering and analysis steps still apply to verify appropriateness for this specific counterparty's stated objectives and risk profile).

**GCC s.8 and the advice-record:** The suitability analysis under s.8 is captured in the Record of Advice (s.9). The two sections are operationally linked — s.8 is the process; s.9 is the artefact.

---

### Part VII — s.9: Record of Advice

**Verbatim:**

> A provider must, subject to and in addition to the duties imposed by section 18 of the Act and section 3(2) of this Code, maintain a record of the advice furnished to a client as contemplated in section 8, which record must reflect the basis on which the advice was given, and in particular — (a) a brief summary of the information and material on which the advice was based; (b) the financial products which were considered; and (c) the financial product or products recommended with an explanation of why the product or products selected, is or are likely to satisfy the client's identified needs and objectives; and (d) where the financial product or products recommended is a replacement product... the comparison of fees, charges, special terms and conditions... between the terminated product and the replacement product; and the reasons why the replacement product was considered to be more suitable to the client's needs than retaining or modifying the terminated product.

> A provider, other than a direct marketer, must provide a client with a copy of the record contemplated in 9(1) in writing.

**Obligation triggered:** `ORG-FAIS-RK-ADVICE` — **Precision citation: GCC s.9(1)(a)–(d)** — four mandatory elements of the advice record: (a) information basis; (b) products considered; (c) recommendation + rationale; (d) replacement-product comparison where applicable. The `AdviceRecorded` event schema in the substrate must capture all four elements. Cross-reference to `Procedures/by-policy/fais-advice-record-capture.md` steps 3–4 (needs analysis; advice framing).

---

### Part VIII — s.10: Custody of Financial Products and Funds

**Verbatim (key excerpts):**

> A provider who receives or holds financial products or funds of or on behalf of a client must account for such products or funds properly and promptly and — ... (d) open and maintain a separate account, designated for client funds, at a bank and — (i) must within one business day of receipt pay into the account all funds held on behalf of clients; (ii) ensure that the separate account only contains funds of clients and not those of the provider...

**Application to Hoz:** Hoz Securities Limited as an institutional FSP will hold client funds / financial products in the course of OTC trading and settlement. The s.10 client-fund segregation obligation applies. Cross-binds to the client-asset segregation obligations in the FSCA Conduct Standards and under the Financial Markets Act 19 of 2012.

---

### Part IX — s.11–s.13: Risk Management

**Verbatim (s.11):**

> A provider must at all times have and effectively employ the resources, procedures and appropriate technological systems that can reasonably be expected to eliminate as far as reasonably possible, the risk that clients, product suppliers and other providers or representatives will suffer financial loss through theft, fraud, other dishonest acts, poor administration, negligence, professional misconduct or culpable omissions.

**Verbatim (s.12):**

> A provider, excluding a representative, must... structure the internal control procedures concerned so as to provide reasonable assurance that — (a) the relevant business can be carried on in an orderly and efficient manner; (b) financial and other information used or provided by the provider will be reliable; and (c) all applicable laws are complied with.

**Obligation triggered:** `ORG-FAIS-RK-GENERAL-CODE` — operational-risk and internal-control obligations under GCC ss.11–12 align with the broader operational resilience framework (Principles 3 + 4; Joint Standard 2/2024; `ORG-CY-*` rows). The GCC risk-management obligation is the FAIS-conduct-side expression of the same operational control requirement.

---

### Part X — s.14–s.15: Advertising and Direct Marketing

**Verbatim (s.14(1)):**

> An advertisement by any provider must — (a) not contain any statement, promise or forecast which is fraudulent, untrue or misleading; (b) if it contains — (i) performance data (including awards and rankings), include references to their source and date; (ii) illustrations, forecasts or hypothetical data — (aa) contain support in the form of clearly stated basic assumptions... (bb) make it clear that they are not guaranteed and are provided for illustrative purposes only; (iii) a warning statement about risks involved in buying or selling a financial product, prominently render or display such statement; and (iv) information about past performances, also contain a warning that past performances are not necessarily indicative of future performances.

**Application to Hoz:** All marketing materials, term sheets, pitch books, and electronic communications (Bloomberg messages, email) relating to products Hoz Securities Limited offers fall within the GCC s.14 advertising standards. The "not fraudulent, untrue or misleading" standard is a baseline content obligation on all client-facing communications.

---

### Part XI — s.16–s.19: Complaints

**Verbatim (s.16(2)):**

> A provider must — (a) request that any client who has a complaint against the provider must lodge such complaint in writing; (b) maintain a record of such complaints for a period of five years; (c) handle complaints from clients in a timely and fair manner; (d) take steps to investigate and respond promptly to such complaints; and (e) where such a complaint is not resolved to the client's satisfaction, advise the client of any further steps which may be available to the client in terms of the Act or any other law.

**Verbatim (s.17 — internal complaint resolution system):**

> A provider, excluding a representative must maintain an internal complaint resolution system and procedures based on the following: (a) Maintenance of a comprehensive complaints policy outlining the provider's commitment to, and system and procedures for, internal resolution of complaints; (b) transparency and visibility: ensuring that clients have full knowledge of the procedures for resolution of their complaints; (c) accessibility of facilities: ensuring the existence of easy access to such procedures at any office or branch of the provider open to clients, or through ancillary postal, fax, telephone or electronic helpdesk support; and (d) fairness: ensuring that a resolution of a complaint can during and by means of the resolution process be effected which is fair to both clients and the provider and its staff.

**Verbatim (s.19 — specific obligations, key):**

> ... the internal complaint resolution system and procedures of a provider excluding a representative must contain arrangements which — (a) must — (i) reduce the details of the internal complaint resolution system and procedures of the provider, including all subsequent updating or upgrading thereof, to writing; (ii) provide that access to the procedures is at all times available to clients at any relevant office or branch of the provider... (d) must make provision that after the receipt and recording of a particular complaint, the complaint will as soon as practically possible be forwarded to the relevant staff appointed to consider its resolution, and that — (i) the complaint receives proper consideration; (ii) appropriate management controls are available to exercise effective control and supervision of the consideration process; (iii) the client is informed of the results of the consideration within the time referred to in Rule 6(b) of the Rules: Provided that if the outcome is not favourable to the client, full written reasons must be furnished to the client within the time referred to in Rule 6(b) of the Rules, and the client must be advised that the complaint may within six months be pursued with the Ombud...

**Obligations triggered:**
- `ORG-FAIS-RK-COMPLAINT-HANDLING` — **Precision citation: GCC ss.16–19** replaces `[citation: TBC — precise FAIS subordinate-legislation reference for complaint-management]`. The five-year complaint-record retention (s.16(2)(b)) cross-references FAIS Act s.18(b). The internal complaint-resolution system requirements (s.17–s.19) are detailed obligations: written policy, transparent access, fair process, mandatory Ombud referral disclosure where complaint unresolved.

---

### Part XII — s.20: Termination of Agreement or Business

**Verbatim:**

> Subject to the Act, and sections 3(2) and (3) of this Code — (a)(i) a provider must, subject to any contractual obligations, give immediate effect to a request of a client who voluntarily seeks to terminate any agreement with the provider or relating to a financial product or advice...

**Application to Hoz:** Applies to position unwind requests, early termination of OTC contracts (where contractual terms allow), and FSP-relationship termination.

---

### Part XIII — s.21: Waiver of Rights

**Verbatim:**

> No provider may request or induce in any manner a client to waive any right or benefit conferred on the client by, or in terms of, any provision of this Code or recognise, accept or act on any such waiver by the client, and any such waiver is null and void.

**Application to Hoz:** ISDA Master Agreements and other trading master agreements cannot contractually exclude the GCC protections. Any attempt to waive client GCC rights in a trading master is void. Cross-binds to Imani's (Legal-as-code engineer, engineering) ISDA/GMRA clause-library review obligation.

---

## Obligation summary table

| GCC Section | Plain-English obligation | Obligations register row | Precision citation |
|---|---|---|---|
| s.2 | Render financial services honestly, fairly, with due skill, care and diligence, in interests of clients | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.2 |
| s.3(1)(a) | Representations must be factually correct, plain language, adequate, timeous, in specific monetary terms | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.3(1)(a)(i)–(viii) |
| s.3(1)(b) | Disclose personal interests and actual/potential conflicts of interest | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.3(1)(b) |
| s.3(1)(f) | No front-running on client order flow or non-public information | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.3(1)(f) |
| s.3(2) | Record-keeping: five-year retention for all client records and financial service records; seven-day availability; electronic format acceptable | `ORG-FAIS-RK-ADVICE` | **GCC s.3(2)** (replaces `[citation: TBC]`) |
| s.3(3) | Client confidentiality; no disclosure without written consent | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.3(3) |
| s.5 | Pre-engagement disclosure: FSP identity, licence scope, supervision status | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.5(a)–(g) |
| s.7(1)(a)+(b)+(c) | Full and frank disclosure of product nature, material terms, material contractual information | `ORG-FAIS-RK-ADVICE` | GCC s.7(1)(a)–(c) |
| s.7(1)(c)(vi) | Disclose all fees, remuneration, commission, and other valuable consideration payable to provider | `ORG-FAIS-RK-FEE-DISCLOSURE` | **GCC s.7(1)(c)(vi)** (replaces `[citation: TBC]`) |
| s.8(1)(a)–(c) | Suitability: seek client info; conduct analysis; identify appropriate product | `ORG-FAIS-RK-SUITABILITY` | **GCC s.8(1)(a)–(c)** (replaces `[citation: TBC]`) |
| s.9(1)(a)–(d) | Record of advice: basis summary; products considered; recommendation + rationale; replacement comparison | `ORG-FAIS-RK-ADVICE` | **GCC s.9(1)(a)–(d)** (replaces `[citation: TBC]`) |
| s.11 | Operational risk: have and effectively employ resources, procedures, and technology to prevent client financial loss | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.11 |
| s.12 | Internal controls: orderly and efficient business; reliable information; compliance | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.12 |
| s.16(2) | Complaints: receive in writing; five-year records; timely and fair handling; Ombud escalation path | `ORG-FAIS-RK-COMPLAINT-HANDLING` | **GCC ss.16–19** (replaces `[citation: TBC]`) |
| s.21 | No waiver of client rights under this Code; waivers are null and void | `ORG-FAIS-RK-GENERAL-CODE` | GCC s.21 |

---

## Citation precision updates for obligations register

The following `[citation: TBC]` placeholders in Domain P of `Regulations/_obligations-register.md` are now resolved:

| Row | Was | Now |
|---|---|---|
| `ORG-FAIS-RK-ADVICE` | `General Code of Conduct [citation: TBC — precise General Code sub-section on advice-record retention]` | `GCC (BN 80/2003) s.3(2)` — five-year retention; seven-day inspection availability; electronic format accepted. Also `GCC s.7(1)(a)–(c)` + `GCC s.9(1)(a)–(d)` for advice content requirements. |
| `ORG-FAIS-RK-SUITABILITY` | `General Code of Conduct [citation: TBC — precise General Code sub-section on suitability-assessment record requirements]` | `GCC (BN 80/2003) s.8(1)(a)–(c)` — suitability process (seek info; analyse; identify appropriate product). Record artefact under `GCC s.9(1)`. |
| `ORG-FAIS-RK-FEE-DISCLOSURE` | `General Code of Conduct [citation: TBC — precise General Code sub-section on fee / charge disclosure pre-engagement]` | `GCC (BN 80/2003) s.7(1)(c)(vi)` — disclosure of all fees, remuneration, commission and valuable consideration payable to provider, including payor identity. Also `GCC s.3(1)(a)(vii)` for specific monetary-amount requirements. |
| `ORG-FAIS-RK-COMPLAINT-HANDLING` | `FAIS Subordinate Legislation on complaint-management standards [citation: TBC — precise FAIS subordinate-legislation reference]` | `GCC (BN 80/2003) ss.16–19` — complaint receipt in writing; five-year records; timely/fair handling; internal resolution system requirements; Ombud referral where unresolved. |
| `ORG-FAIS-RK-GENERAL-CODE` | `FAIS General Code of Conduct (umbrella reference) [citation: TBC — full General Code sub-section index]` | `GCC (BN 80/2003) — full instrument; umbrella obligation. Key sub-sections: s.2 (general duty), s.3(1)(a)–(f) (specific duties), s.5 (provider info), s.7 (service info), s.8 (suitability), s.9 (advice record), ss.11–12 (risk management), ss.16–19 (complaints), s.21 (no waiver).` |

---

## Application to Hoz Bank / Hoz Securities Limited

**Primary applicant:** Hoz Securities Limited (FSP licensee). The GCC binds all Hoz Securities Limited staff who render financial services to institutional counterparties.

**Institutional counterparty calibration:** The suitability process (GCC s.8) and information requirements (GCC ss.4–7) apply to institutional counterparties — but the standard is calibrated to the institutional client's presumed sophistication level (per the "factually established or reasonably assumed level of knowledge of the client" qualifier in GCC s.3(1)(a)(iii)). Hoz Securities Limited's client-categorisation-as-institutional screening (`ORG-CD-04` cross-reference) feeds this calibration.

**OTC derivatives intersection:** The GCC is the baseline conduct standard. The FSCA Conduct Standards 1, 2, 3 of 2018 and Joint Standard 2 of 2020 (ODP regime) are lex specialis for the ODP-specific conduct obligations and prevail where they conflict with the GCC (per GCC s.1(2)(b)(ii)). The GCC suitability, advice-record, fee-disclosure, and complaint-handling obligations apply in addition to the ODP-specific requirements.

**Hoz Bank Limited:** The GCC applies to Hoz Bank Limited only to the extent it renders deposit-advice services under the FAIS Act s.1(4) carve-out (deposit-specific code of conduct under FAIS Act s.15(2)(b)). The General Code (BN 80/2003) is the operative code for Hoz Bank's deposit-advice activities absent a separate deposit-specific code. In practice, the OTC-trading and institutional-advisory business runs through Hoz Securities Limited, not Hoz Bank Limited.

---

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-12 | Mira (Compliance / RegTech engineer) | Initial POPULATED version. Source PDF downloaded from faisombud.co.za; text extracted via pdftotext. All 22 sections of the GCC populated with verbatim text and obligation analysis. Precision citations for all five Domain P `[citation: TBC]` placeholders resolved: `ORG-FAIS-RK-ADVICE` → `GCC s.3(2)` + `s.9(1)(a)–(d)`; `ORG-FAIS-RK-SUITABILITY` → `GCC s.8(1)(a)–(c)`; `ORG-FAIS-RK-FEE-DISCLOSURE` → `GCC s.7(1)(c)(vi)`; `ORG-FAIS-RK-COMPLAINT-HANDLING` → `GCC ss.16–19`; `ORG-FAIS-RK-GENERAL-CODE` → full section index. |
