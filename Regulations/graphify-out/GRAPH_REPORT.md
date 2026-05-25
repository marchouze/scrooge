# Graph Report - Regulations  (2026-05-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 110 nodes · 141 edges · 16 communities (14 shown, 2 thin omitted)
- Extraction: 68% EXTRACTED · 32% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.28)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ee82f75c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]

## God Nodes (most connected - your core abstractions)
1. `Banks Act Guidance Note 4/2014 — Internal Ratings-Based Approach Application Process` - 27 edges
2. `Banks Act Guidance Note 3/2025 — Climate-Related Disclosures for Banks` - 14 edges
3. `Banks Act Guidance Note 9/2022 — Credit Risk Models (IRB Approach)` - 9 edges
4. `GN 2/2025 (IRB Credit Risk) — Acknowledgement of receipt: Requires all recipient institutions to provide a signed acknowledgement of receipt from the CEO and independent auditors to the PA.` - 8 edges
5. `Introduction: This guidance note addresses IRB credit risk model requirements for banks approved to use the Internal Ratings-Based approach, which does not apply to this bank using the standardised approach.` - 8 edges
6. `Banks Act Guidance Note 6/2022 — Business Risk Assessments (AML/CFT)` - 8 edges
7. `Acknowledgement of receipt: Purely procedural requirement for IRB banks to return a signed acknowledgement to the PA and share the guidance note with auditors, not applicable to this institution.` - 7 edges
8. `Acknowledgement of receipt: A procedural requirement obliging the bank's CEO and independent auditors to sign and return an acknowledgement of receipt of this guidance note to the Prudential Authority.` - 7 edges
9. `Acknowledgement of receipt: Requires the CEO and independent auditors to sign and return an acknowledgement of receipt of this guidance note to the Prudential Authority.` - 7 edges
10. `Acknowledgment of receipt: Requires the CEO to sign and return an acknowledgment of receipt to the PA and to provide a copy to the institution's independent auditors, a procedural compliance obligation directly applicable to this bank.` - 7 edges

## Surprising Connections (you probably didn't know these)
- `IRB Application Pack Requirement & Overview: Banks intending to adopt the Internal Ratings-Based approach must submit a completed IRB application pack signed by the CEO and board chairperson.` --conceptually_related_to--> `Introduction: This guidance note addresses IRB credit risk model requirements for banks approved to use the Internal Ratings-Based approach, which does not apply to this bank using the standardised approach.`  [INFERRED]
  Regulations/Banks/source-docs/banks-gn4-2014-structured.json → Regulations/Banks/source-docs/banks-gn9-2022-structured.json
- `Credit Risk Stress Testing Approach: Banks must describe their credit risk stress testing approach and demonstrate compliance with regulation 23(11)(b)(ix).` --conceptually_related_to--> `Introduction: This guidance note addresses IRB credit risk model requirements for banks approved to use the Internal Ratings-Based approach, which does not apply to this bank using the standardised approach.`  [INFERRED]
  Regulations/Banks/source-docs/banks-gn4-2014-structured.json → Regulations/Banks/source-docs/banks-gn9-2022-structured.json
- `GN 2/2025 (IRB Credit Risk) — Introduction: Introduces the guidance note arising from a 2021 PA discussion paper on IRB credit risk model requirements, directed at IRB-approved banks.` --conceptually_related_to--> `Model documentation quality: Requirements for IRB banks to maintain high-quality model development and validation documentation are specific to IRB-approved institutions, not this bank.`  [INFERRED]
  Regulations/Banks/source-docs/banks-gn2-2025-structured.json → Regulations/Banks/source-docs/banks-gn9-2022-structured.json
- `GN 2/2025 (IRB Credit Risk) — Guidance related to specified matters: Provides IRB-specific guidance on CRM capital treatment, local government/PSE exposure taxonomy, and rating assignment horizon for IRB-approved banks.` --conceptually_related_to--> `Validation: Annual independent validation requirements for IRB credit risk models used in RWA calculations are specific to IRB-approved banks and do not bind this institution.`  [INFERRED]
  Regulations/Banks/source-docs/banks-gn2-2025-structured.json → Regulations/Banks/source-docs/banks-gn9-2022-structured.json
- `GN 2/2025 (IRB Credit Risk) — Acknowledgement of receipt: Requires all recipient institutions to provide a signed acknowledgement of receipt from the CEO and independent auditors to the PA.` --conceptually_related_to--> `Validation: Annual independent validation requirements for IRB credit risk models used in RWA calculations are specific to IRB-approved banks and do not bind this institution.`  [INFERRED]
  Regulations/Banks/source-docs/banks-gn2-2025-structured.json → Regulations/Banks/source-docs/banks-gn9-2022-structured.json

## Communities (16 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (21): Banks Act Guidance Note 4/2014 — Internal Ratings-Based Approach Application Process, South African Environment Model Tailoring: Banks must describe the process followed to tailor models to the South African environment and branch management's input into model development., Rating System Experience Requirement: Banks must demonstrate they meet the experience requirement by detailing how long their rating and scoring systems have been in operation., Regulatory vs Internal Parameter Estimates: Banks must outline any differences between parameter estimates used for regulatory capital purposes and those used internally., Data Management and Technological Environment: Banks must describe their data management approach, including systems used for storing rating and parameter information, with reference to regulation 23(11)(b)(viii)., Calibration Databases and Regulatory Reporting: Banks must describe how calibration databases and regulatory capital figures are obtained and confirm ability to submit risk-based returns within prescribed periods., Independent Validation Approach: Banks must describe their validation approach covering back-testing, performance monitoring, and benchmarking of rating system parameter estimates., Annexure B — Rating System Detail Template: Annexure B requires banks to provide structured details for each rating system including methodology, weaknesses, portfolio coverage, and approval committee information. (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (14): Banks Act Guidance Note 3/2025 — Climate-Related Disclosures for Banks, GN 3/2025 (Climate Disclosures) — Introduction: All SARB-licensed banks must build capacity to identify, assess, manage and disclose climate-related risks and opportunities as a matter of safety and soundness., Quantitative disclosure templates (BCBS Annexure 1): Banks must complete and publish BCBS-prescribed quantitative templates covering transition-risk exposures and financed emissions by sector as well as physical-risk exposure data., Additional considerations: Where relevant, disclosures should incorporate South Africa-specific transition pathways and, for environmentally sustainable financing targets, reference the South African green finance taxonomy., Assurance requirements: External assurance is not currently mandated but banks must subject climate disclosures to internal governance and controls equivalent to those used for financial reporting, with external assurance expected in future., Implementation: The PA expects proactive, non-compliance-driven implementation of climate risk management and disclosures, with proportionate application and continuous improvement over time., Principles and conceptual foundations for disclosures: Sets out the core principles and conceptual foundations that banks must apply when preparing climate-related disclosures., Supervisory expectations: Banks are required to produce high-quality, decision-useful climate-related disclosure reports meeting both the stated principles and PA supervisory expectations across qualitative and quantitative dimensions. (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.35
Nodes (13): Acknowledgment of receipt: Requires the CEO to sign and return an acknowledgment of receipt to the PA and to provide a copy to the institution's independent auditors, a procedural compliance obligation directly applicable to this bank., Banks Act Guidance Note 2/2025 — Internal Ratings-Based Approach for Credit Risk, GN 2/2025 (IRB Credit Risk) — Acknowledgement of receipt: Requires all recipient institutions to provide a signed acknowledgement of receipt from the CEO and independent auditors to the PA., Acknowledgement of receipt: Banks must provide a copy of this Guidance Note to their independent auditors and return a signed acknowledgement of receipt from the CEO and auditors to the PA., Acknowledgement of receipt: A procedural requirement obliging the bank's CEO and independent auditors to sign and return an acknowledgement of receipt of this guidance note to the Prudential Authority., Banks Act Guidance Note 5/2022 — Effective Implementation of Group Controls (AML/CFT), Introduction: Establishes FATF Recommendation 18 as the basis requiring financial groups to implement group-wide AML/CFT programmes including intra-group information sharing policies., The implementation of AML/CFT group controls in banks' and controlling companies' foreign operations: Requires foreign operations of South African banking groups to declare compliance with local AML/CFT legislation via Form BA 099A, relevant if this bank is part of a group with foreign operations. (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (10): GN 2/2025 (IRB Credit Risk) — Introduction: Introduces the guidance note arising from a 2021 PA discussion paper on IRB credit risk model requirements, directed at IRB-approved banks., Rating and Risk Estimation System Documentation: Banks must complete Annexure B for each model to be used under the IRB approach, including all relevant supporting documentation., IRB Application Pack Requirement & Overview: Banks intending to adopt the Internal Ratings-Based approach must submit a completed IRB application pack signed by the CEO and board chairperson., Banks Act Guidance Note 9/2022 — Credit Risk Models (IRB Approach), Introduction: This guidance note addresses IRB credit risk model requirements for banks approved to use the Internal Ratings-Based approach, which does not apply to this bank using the standardised approach., LGD estimates for defaulted loans: Regulatory requirements for estimating LGDs on defaulted loans under the IRB framework are not applicable to a standardised-approach bank., LGD overrides: Guidance on LGD override processes for capital calculations is exclusively relevant to IRB-approved banks and does not apply to this institution., Quality and representativeness of development datasets: Requirements for development datasets used in IRB credit risk models, including low-default portfolios, are not relevant to a non-IRB bank. (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (9): Banks Act Guidance Note 3/2014 — Effective Risk Data Aggregation and Risk Reporting, Introduction (duplicate): Reiterates the background and purpose of the BCBS Principles for risk data aggregation and reporting as the basis for this guidance note., Objective of the Questionnaire (duplicate): Reiterates the requirement for banks to complete the group-level questionnaire to demonstrate progress toward compliance with the Principles., Participating Banks: Mandates that all South African banks and branches of foreign institutions must complete the questionnaire, directly binding this bank., Completing the Questionnaire: Requires each participating bank to designate a sufficiently senior key contact person to liaise with the Prudential Authority for the purposes of the questionnaire exercise., Banks Act Guidance Note 3/2016 — Credit Risk and Accounting for Expected Credit Losses, GN 3/2016 — BCBS Guidance on Credit Risk and Accounting for Expected Credit Losses: Introduces BCBS supervisory guidance on sound credit risk practices for expected credit loss accounting frameworks, relevant sector-wide but indirectly applicable to an institutional-only bank with limited credit-exposure-generating activities., Background — BCBS December 2015 Document: References the BCBS December 2015 guidance document on credit risk and ECL accounting as the source material underpinning this guidance note. (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (7): Banks Act Guidance Note 5/2014 — Outsourcing of Functions within Banks, Introduction: Introduces the regulatory rationale for oversight of outsourcing, acknowledging benefits but flagging risks to management control over banking functions., Definitions: Defines 'outsourcing' broadly to include both intra-group and third-party service providers performing continuing business activities on behalf of the bank, directly applicable when determining scope of obligations., Applicability of this guidance note: Scopes the guidance note to material business activities and functions, requiring the bank to assess whether its outsourced activities (e.g. IT, settlement, risk systems) meet the materiality threshold., Material business activities and functions: Requires banks to identify and manage risks around all material outsourced functions, with management oversight and governance treated as core expectations directly binding on this bank., Key requirements for outsourcing of material business activities and functions: Sets out mandatory requirements including a board-approved outsourcing policy, risk assessments, and due diligence processes that this bank must have in place for any material outsourced function., Additional guidance surrounding key requirements: Provides detailed guidance on board and senior management responsibilities under Regulation 39, directly binding on this bank's governance structures for all material outsourcing arrangements.

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (7): Banks Act Guidance Note 6/2022 — Business Risk Assessments (AML/CFT), Introduction: Establishes that all banks must conduct a business-level ML/TF/PF risk assessment as the foundation of their risk-based AML/CFT approach, directly binding on this SARB-licensed bank., Identification of ML/TF/PF risk: Requires banks to identify ML/TF/PF risks using national risk assessments, regulatory frameworks, and institution-specific data sources, directly applicable to this bank given its OTC derivatives, FX spot, and bond/equity activities., Assessing ML/TF/PF risk: Requires banks to assess the likelihood and impact of identified ML/TF/PF threats on the institution and sector, directly binding and relevant to this bank's institutional counterparty profile and product mix., Trigger Events: Mandates banks to review their risk assessments upon defined trigger events such as new products, new markets, or regulatory changes, directly binding on this bank particularly given potential expansion of trading activities., Risk factor consideration examples: Provides illustrative risk factors banks must consider in their business risk assessments, directly relevant to this bank's customer base, geographic exposure, products, and delivery channels., Terminology: Defines key terms including DPIP, FPPO, and FATF Recommendations used throughout the guidance note; relevant sector-wide but primarily operative where the bank onboards PEP-related counterparties.

### Community 7 - "Community 7"
Cohesion: 0.40
Nodes (5): Banks Act Guidance Note 10/2022 — Supervisory Guidelines: Prevention of Unlawful Activities, Introduction: Establishes the FATF risk-based approach requirement for ML/TF/PF risk assessment, which is directly binding on this bank as a SARB-licensed institution subject to AML/CFT obligations., Definitions: Defines Crypto Assets and Crypto Asset Service Providers relevant to scoping AML/CFT obligations, material if the bank has any indirect exposure to CASPs through institutional counterparties., Application of a risk-based approach: Identification and assessment of risks relative to CAs and CASPs: Requires banks to assess direct and indirect ML/TF/PF exposure to CAs and CASPs, relevant to the extent this bank's institutional counterparties engage in crypto-related activities., Monitoring of client relationships: Directly requires ongoing transaction monitoring of client activity and reporting of suspicious or unusual activity to the FIC, binding on this bank in respect of all its institutional counterparties.

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (5): Banks Act Guidance Note 3/2010 — Market Risk Hypothetical Back-Testing (IMA Banks), GN 3/2010 Section 2 — Hypothetical Back-Testing Reporting Requirements (BA320/BA325): IMA-approved banks must report hypothetical back-testing exceptions on monthly form BA320 (lines 96–106, column 6) and daily form BA325 (lines 20–30, column 3/5)., GN 3/2010 Section 3 — Basel Committee Further Guidelines on VaR Model Justification: Basel consultative guidance (January 2009) requires IMA banks to justify any significant changes to their internal VaR models, informing future regulatory expectations for model governance., GN 3/2010 Section 4 — Hypothetical Back-Testing Process and Terminology: Prescribes the detailed process and terminology for hypothetical back-testing, mapping portfolio and desk-level exceptions to specific BA320 and BA325 line items., GN 3/2010 Section 5 — Ex-Post Hypothetical P&L vs Ex-Ante VaR Comparison Methodology: Defines how the ex-post hypothetical daily P&L (static T-1 portfolio revalued at T prices) must be compared against the ex-ante VaR to determine back-testing exceptions, noting there is currently no separate standalone regulatory obligation beyond this comparison.

### Community 9 - "Community 9"
Cohesion: 0.60
Nodes (5): Credit Risk Stress Testing Approach: Banks must describe their credit risk stress testing approach and demonstrate compliance with regulation 23(11)(b)(ix)., Banks Act Guidance Note 9/2008 — Stress Testing, GN 9/2008 (Stress Testing) — The process for submission: Describes submission processes for Pillar 2 stress tests via ICAAP and Pillar 1 IRB credit risk stress test results during on-site reviews, applicable to banks using the IRB approach rather than standardised credit risk measurement., GN 9/2008 (Stress Testing) — Some selected excerpts: Sets out IRB-approach credit risk stress testing requirements under Pillar 1 Regulation 23(11)(b)(ix), which are binding only on banks that have adopted the IRB approach for credit risk measurement., The treatment of stale ratings: Requirements for IRB banks to regularly refresh internal ratings to reflect current credit risk are not applicable to this bank's standardised-approach framework.

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (3): Banks Act Guidance Note 5/2016 — Corporate Governance Principles for Banks, Background: Section 60B of the Banks Act and regulation 39 impose a direct statutory duty on this bank's board and executive officers to establish and maintain adequate and effective corporate governance processes commensurate with the bank's nature, complexity and risks., Documents issued by the Basel Committee on Banking Supervision relating to corporate governance principles for banks: The BCBS July 2015 corporate governance guidelines inform the principles and guidance that the Prudential Authority expects banks to apply, making them a key reference for this bank's governance framework design and ongoing compliance.

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (3): Banks Act Guidance Note 7/2016 — Capital Arbitrage Transactions, GN 7/2016 (Capital Arbitrage) — Section 1: Describes strategies used in capital arbitrage transactions designed to offset regulatory capital adjustments, including securities issuance, sales contracts, and collateralised derivatives, which are relevant to this bank's OTC derivative and structured activities., GN 7/2016 (Capital Arbitrage) — Section 2: Continues enumeration of capital arbitrage strategies (including guarantees) that the Prudential Authority scrutinises, relevant to ensuring this bank's OTC derivative and capital structure transactions do not constitute impermissible regulatory capital offsets.

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (3): GN 2/2025 (IRB Credit Risk) — Guidance related to specified matters: Provides IRB-specific guidance on CRM capital treatment, local government/PSE exposure taxonomy, and rating assignment horizon for IRB-approved banks., Credit Risk Rating System Register: Banks must complete and submit a Credit Risk Rating System Register as specified by the SARB., Use Test Compliance: Banks must summarise compliance with the use test, showing how rating systems are integral to credit approval, risk reporting, and internal capital allocation.

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (3): Corporate Governance and IRB Oversight: Banks must describe the governance framework for IRB implementation, including model development, maintenance, and independent validation., Model Validation, Development and Monitoring Policies: Banks must submit board-approved policies covering model validation, development, and monitoring., Model documentation quality: Requirements for IRB banks to maintain high-quality model development and validation documentation are specific to IRB-approved institutions, not this bank.

## Knowledge Gaps
- **32 isolated node(s):** `18-Month Application Period: Banks should allow up to 18 months between submitting the IRB application pack and receiving approval or denial.`, `Parallel Reporting Run Requirement: All IRB applicant banks must undertake a minimum six-month parallel reporting run for affected portfolios during the 18-month application period.`, `Two-Stage IRB Application Process: The IRB application process consists of a documentation submission stage followed by an on-site focused supervisory review by BSD.`, `Bank Readiness and Roll-Out Plan: Banks must demonstrate a state of readiness with a clear IRB roll-out plan covering material portfolios before applying for advanced approach approval.`, `Application Pack Compilation Guidance: Banks must provide concise responses in the application pack to enable BSD to scope its supervisory review of the IRB application.` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Banks Act Guidance Note 4/2014 — Internal Ratings-Based Approach Application Process` connect `Community 0` to `Community 9`, `Community 3`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.265) - this node is a cross-community bridge._
- **Why does `Banks Act Guidance Note 9/2022 — Credit Risk Models (IRB Approach)` connect `Community 3` to `Community 9`, `Community 2`, `Community 13`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Why does `Banks Act Guidance Note 3/2025 — Climate-Related Disclosures for Banks` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `GN 2/2025 (IRB Credit Risk) — Acknowledgement of receipt: Requires all recipient institutions to provide a signed acknowledgement of receipt from the CEO and independent auditors to the PA.` (e.g. with `Acknowledgement of receipt: Purely procedural requirement for IRB banks to return a signed acknowledgement to the PA and share the guidance note with auditors, not applicable to this institution.` and `Validation: Annual independent validation requirements for IRB credit risk models used in RWA calculations are specific to IRB-approved banks and do not bind this institution.`) actually correct?**
  _`GN 2/2025 (IRB Credit Risk) — Acknowledgement of receipt: Requires all recipient institutions to provide a signed acknowledgement of receipt from the CEO and independent auditors to the PA.` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `Introduction: This guidance note addresses IRB credit risk model requirements for banks approved to use the Internal Ratings-Based approach, which does not apply to this bank using the standardised approach.` (e.g. with `GN 2/2025 (IRB Credit Risk) — Introduction: Introduces the guidance note arising from a 2021 PA discussion paper on IRB credit risk model requirements, directed at IRB-approved banks.` and `IRB Application Pack Requirement & Overview: Banks intending to adopt the Internal Ratings-Based approach must submit a completed IRB application pack signed by the CEO and board chairperson.`) actually correct?**
  _`Introduction: This guidance note addresses IRB credit risk model requirements for banks approved to use the Internal Ratings-Based approach, which does not apply to this bank using the standardised approach.` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `18-Month Application Period: Banks should allow up to 18 months between submitting the IRB application pack and receiving approval or denial.`, `Parallel Reporting Run Requirement: All IRB applicant banks must undertake a minimum six-month parallel reporting run for affected portfolios during the 18-month application period.`, `Two-Stage IRB Application Process: The IRB application process consists of a documentation submission stage followed by an on-site focused supervisory review by BSD.` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._