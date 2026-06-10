// prototype/scripts/obligation-summaries/domain-b-summaries.ts
//
// P4-SCALE — Domain B (Financial crime: AML / CFT / CPF, sanctions, ABC)
// reviewed requirement summaries. SA `ORG-FC-*` rows. Source text is `missing`
// in the live drill-down for the thin FIC-Act rows (the statute is not graph-
// extracted as a Provision); summaries are authored from the citation + existing
// prose, gap noted (not fabricated). The richly-authored rows (FC-23, FC-24,
// FC-MLRO-ALTERNATE, FC-SANCTIONS-SCREENING) are already accurate → confirmed.
//
// Owning seats preserved from the adopted owner: cco for AML/sanctions;
// company-secretary for ORG-FC-05/20/22 (record-retention, PRECCA, UK Bribery
// Act); cfo for ORG-FC-15/16 (FATCA/CRS reporting).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { SummaryModule } from "./summary-types";

const MISSING =
  "FIC Act / AML source text missing in the drill-down (statute not graph-extracted as a Provision); summary authored from the citation + existing requirement prose.";

export const DOMAIN_B: SummaryModule = {
  "ORG-FC-01": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Adopt, document, implement and maintain a Risk Management and Compliance Programme (RMCP) under section 42 of the FIC Act 38 of 2001 that sets out how the bank identifies, assesses, mitigates and monitors its money-laundering, terrorist-financing and proliferation-financing risks. Keep the RMCP current, board-approved, and aligned to the bank's ML/TF/PF risk assessment.",
    rationale: `Thin one-liner expanded from the FIC Act s.42 RMCP citation. ${MISSING}`,
  },
  "ORG-FC-02": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Conduct customer due diligence on all clients under FIC Act ss.21–21H read with FATF Recommendation 10, identifying and verifying the client (and any person acting on their behalf) before establishing the business relationship or concluding a single transaction. Understand the nature and intended purpose of the relationship and keep the CDD information current.",
    rationale: `Thin one-liner expanded from the FIC Act ss.21–21H + FATF Rec. 10 citation. ${MISSING}`,
  },
  "ORG-FC-03": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Apply enhanced due diligence to higher-risk relationships under FIC Act s.21A and FIC Guidance Note 7 — including politically exposed persons, foreign correspondent relationships and complex or opaque ownership structures — obtaining senior-management approval and additional source-of-funds/source-of-wealth evidence. Subject these relationships to enhanced ongoing monitoring.",
    rationale: `Thin one-liner expanded from the FIC Act s.21A + FIC GN 7 citation. ${MISSING}`,
  },
  "ORG-FC-04": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Establish and verify the beneficial ownership of each client under FIC Act s.21B read with FATF Recommendation 10, the Companies Act and the Trust Property Control Act, resolving ownership and control recursively through to the natural persons who ultimately own or control the client. Where no natural-person owner is identified, identify the natural person exercising control or holding the senior managing position.",
    rationale: `Thin one-liner expanded from the FIC Act s.21B + FATF Rec. 10 + Companies Act + TPCA citation. ${MISSING}`,
  },
  "ORG-FC-05": {
    reviewerSeat: "company-secretary",
    verdict: "reviewed-modified",
    summary:
      "Retain the prescribed CDD and transaction records under FIC Act s.22 for at least five years after the business relationship ends or the single transaction is concluded, in a form that can be produced to the FIC or a supervisory body on request. Ensure the records are complete enough to reconstruct each transaction and the client-identification basis.",
    rationale: `Thin one-liner expanded from the FIC Act s.22 record-retention citation. ${MISSING}`,
  },
  "ORG-FC-06": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Operate a risk-based approach under FIC Guidance Note 7 and FATF Recommendation 1, dispatching the intensity of CDD and ongoing monitoring on each client's risk rating derived from the bank's ML/TF/PF risk typology (customer, product, channel, geography). Document the risk-rating methodology and apply simplified or enhanced measures only where the risk assessment justifies it.",
    rationale: `Thin one-liner expanded from the FIC GN 7 + FATF Rec. 1 risk-based-approach citation. ${MISSING}`,
  },
  "ORG-FC-07": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "File Cash Threshold Reports with the FIC under FIC Act s.28 for cash transactions at or above the prescribed threshold (R24,999.99 or as updated), within the prescribed period of the transaction. Maintain the detection and aggregation controls needed to identify reportable cash transactions reliably.",
    rationale: `Thin one-liner expanded from the FIC Act s.28 CTR citation. ${MISSING}`,
  },
  "ORG-FC-08": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "File Property Association Reports with the FIC under FIC Act s.28A where the bank possesses or controls property associated with, or owned/controlled by, a sanctioned person or entity, within the prescribed period. Integrate the trigger with the bank's sanctions-screening controls so association events are detected and reported.",
    rationale: `Thin one-liner expanded from the FIC Act s.28A PAR citation. ${MISSING}`,
  },
  "ORG-FC-09": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "File Suspicious Transaction and Activity Reports with the FIC under FIC Act s.29 whenever the bank knows or suspects that a transaction or activity may be connected to money laundering, terrorist financing, the proceeds of unlawful activities, or a contravention. Report as soon as possible after forming the suspicion, and operate the detection, escalation and reporting workflow that supports this.",
    rationale: `Thin one-liner expanded from the FIC Act s.29 STR/SAR citation. ${MISSING}`,
  },
  "ORG-FC-10": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Prohibit tipping-off under FIC Act s.29(3): no person may disclose to the client, or to any third party, the existence or contents of a suspicious-transaction report or that an investigation may follow, as such disclosure is a criminal offence. Build the STR workflow so report existence is restricted on a need-to-know basis.",
    rationale: `Thin one-liner expanded from the FIC Act s.29(3) tipping-off citation. ${MISSING}`,
  },
  "ORG-FC-11": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Designate an internal AML compliance officer and a Money Laundering Reporting Officer (MLRO) under the FIC Act and the FATF standards, with sufficient seniority, independence and resources to oversee the RMCP and to receive, assess and file suspicious-transaction reports. Document the appointments and the escalation lines into the MLRO.",
    rationale: `Thin one-liner expanded from the FIC Act + FATF AML-officer/MLRO citation. ${MISSING}`,
  },
  "ORG-FC-11-GLOSS-CEO-MLRO-BAR": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the MLRO must be a person other than the CEO, in line with FIC s.43A, FIC published RMCP guidance and accountable-institution supervisory expectations on second-line independence; confirmed without rewrite. Domain B — financial crime.",
  },
  "ORG-FC-12": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Provide ongoing AML/CFT training to staff under FIC Act s.43 so that employees understand their obligations, can recognise suspicious activity, and know how to escalate it. Tailor the training to roles and risk exposure and retain attendance and content records as evidence.",
    rationale: `Thin one-liner expanded from the FIC Act s.43 training citation. ${MISSING}`,
  },
  "ORG-FC-13": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the obligation to block all true-positive sanctions matches pre-execution (UN/OFAC/EU/UK-HMT/POCDATARA lists; RAS B4 zero-appetite) with a signed-MLRO register-linked override; confirmed without rewrite. Domain B — sanctions.",
  },
  "ORG-FC-14": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Conduct targeted financial sanctions screening against the POCDATARA and FIC-Act-designated (DTI) lists, screening clients and transactions for matches with persons and entities subject to UN Security Council and domestic targeted financial sanctions. Freeze without delay and report any property of a designated person as the regime requires.",
    rationale: `Thin one-liner expanded from the POCDATARA + FIC Act targeted-financial-sanctions citation. ${MISSING}`,
  },
  "ORG-FC-15": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Identify US-reportable accounts under the FATCA Intergovernmental Agreement read with the Tax Administration Act and submit the FATCA XML return to SARS annually for onward exchange with the IRS. Operate the self-certification, indicia-review and validation controls that drive the classification (read across with ORG-TX-06).",
    rationale: `Thin one-liner expanded from the FATCA IGA + Tax Admin Act citation. ${MISSING}`,
  },
  "ORG-FC-16": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Identify CRS-reportable accounts under the OECD Common Reporting Standard as transposed by the Tax Administration Act and submit the CRS XML return to SARS annually for onward exchange with partner jurisdictions. Operate the self-certification and due-diligence controls the CRS prescribes (read across with ORG-TX-07).",
    rationale: `Thin one-liner expanded from the CRS + Tax Admin Act citation. ${MISSING}`,
  },
  "ORG-FC-17": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Ensure required originator and beneficiary information accompanies cross-border wire transfers under FATF Recommendation 16 (the 'travel rule'), and screen, hold or reject transfers that lack the prescribed information. Maintain the controls to capture, transmit and verify the payer/payee data across the payment chain.",
    rationale: `Thin one-liner expanded from the FATF Rec. 16 wire-transfer citation. ${MISSING}`,
  },
  "ORG-FC-18": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the continuous-KYC two-tier restriction default (high-confidence → restrict immediately; medium-confidence → restrict on review) per RAS B3; confirmed without rewrite. Domain B — financial crime.",
  },
  "ORG-FC-19": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the recurring-KYC periodicity by risk band (high → annual; medium → 24 months; low → 36 months) per FIC GN 7 risk-based-approach periodicity; confirmed without rewrite. Domain B — financial crime.",
  },
  "ORG-FC-20": {
    reviewerSeat: "company-secretary",
    verdict: "reviewed-modified",
    summary:
      "Prevent and combat bribery and corruption under the Prevention and Combating of Corrupt Activities Act 12 of 2004 (PRECCA), including the duty on a person in a position of authority to report knowledge or reasonable suspicion of specified corrupt or related offences involving amounts above the threshold. Maintain an anti-bribery-and-corruption programme with controls on gifts, facilitation payments and third-party due diligence.",
    rationale: `Thin one-liner expanded from the PRECCA 12/2004 citation. ${MISSING}`,
  },
  "ORG-FC-21": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Address the findings of South Africa's FATF Mutual Evaluation Reports and contribute to the greylisting-remediation action plan, closing the bank-level control gaps identified for effectiveness areas such as beneficial ownership, sanctions implementation and STR quality. Track remediation to completion and evidence the improvements.",
    rationale: `Thin one-liner expanded from the FATF SA Mutual Evaluation Reports citation. ${MISSING}`,
  },
  "ORG-FC-22": {
    reviewerSeat: "company-secretary",
    verdict: "reviewed-modified",
    summary:
      "Apply UK Bribery Act 2010 controls where the bank has UK touch-points that bring it within the Act's extra-territorial reach, including the corporate offence of failing to prevent bribery and the 'adequate procedures' defence. Maintain proportionate anti-bribery procedures, due diligence and training covering the UK-nexus activities.",
    rationale: `Thin one-liner expanded from the UK Bribery Act 2010 (extra-territorial) citation. ${MISSING}`,
  },
  "ORG-FC-23": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the CPF controls under FATF Rec. 7 and the PA's post-greylisting banks-supervisory expectations (sanctions screening, beneficial-ownership effectiveness, EDD on high-risk corridors, RBA calibration evidence) per AML/CFT/CPF Communication 1 of 2025 and FIC Act s.42(2)(q)/(qA); confirmed without rewrite. Domain B — financial crime.",
  },
  "ORG-FC-24": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the quarterly ML/TF/PF risk-return submission to the PA per Directive 4 of 2022 under FIC Act s.43A(3) (form, frequency, content, electronic channel); confirmed without rewrite. Domain B — financial crime.",
  },
  "ORG-FC-MLRO-ALTERNATE": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the obligation to designate an MLRO-alternate for continuity, independently fit-and-proper under FIC Act s.43A and FIC published RMCP guidance; confirmed without rewrite (citation carries an explicit TBC flag pending licence-gate counsel — not a requirement-text defect). Domain B — financial crime.",
  },
  "ORG-FC-SANCTIONS-SCREENING": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the obligation to screen all transactions and counterparties against applicable sanctions lists under FIC Act ss.21–28A, the UN Security Council regime and POCDATARA, blocking true-positive matches pre-execution with a documented override/exception procedure; confirmed without rewrite (citation carries an explicit TBC flag pending licence-gate counsel). Domain B — sanctions.",
  },
};
