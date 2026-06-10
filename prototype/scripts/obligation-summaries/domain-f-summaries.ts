// prototype/scripts/obligation-summaries/domain-f-summaries.ts
//
// P4-SCALE — Domain F (Governance / ECTA electronic-records / POPIA-PAIA
// privacy / whistleblowing-ABC) reviewed requirement summaries. SA rows:
// `ORG-EL-*` (ECTA), `ORG-GV-*` (Companies Act / Banks Act / King IV governance
// + the GV-FNP/GV-FNP-S Directive D6/D7 2022 beneficial-owner & director CBCR
// families), `ORG-PR(IV)-*` (POPIA + PAIA), `ORG-WB-*` (whistleblowing / ABC).
//
// Verdict split:
//   - reviewed-modified: the thin one-liner governance/ECTA/POPIA/WB rows
//     expanded to grounded 2-sentence summaries. Source text `missing` in the
//     drill-down (Companies Act / ECTA / POPIA / King IV not graph-extracted),
//     noted not fabricated.
//   - reviewed-confirmed: rows already carrying accurate multi-clause prose
//     (GV-21/22, the GV-*-INDEPENDENCE/MINIMUM rows, the GV-FNP/GV-FNP-S D6/D7
//     CBCR families, and PR(IV)-13-GLOSS-DEPUTY-IO).
//
// Owning seats preserved from the adopted owner.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { ObligationSummary, SummaryModule } from "./summary-types";

const MISSING =
  "Source text missing in the drill-down (Companies Act / ECTA / POPIA / King IV instrument not graph-extracted as a Provision); summary authored from the citation + existing requirement prose.";

function confirm(seat: string, what: string, note = ""): ObligationSummary {
  return {
    reviewerSeat: seat,
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale: `Existing requirement is already an accurate multi-clause summary of ${what}; confirmed without rewrite.${note ? ` ${note}` : ""} Domain F — governance / privacy.`,
  };
}

function mod(seat: string, summary: string, cite: string): ObligationSummary {
  return {
    reviewerSeat: seat,
    verdict: "reviewed-modified",
    summary,
    rationale: `Thin one-liner expanded from the ${cite} citation. ${MISSING}`,
  };
}

export const DOMAIN_F: SummaryModule = {
  // ── ECTA electronic records (ORG-EL-*) ─────────────────────────────────
  "ORG-EL-01": mod(
    "coo",
    "Recognise the legal validity of electronic communications, data messages and electronic signatures under the Electronic Communications and Transactions Act 25 of 2002, save for the transaction categories excluded by ECTA Schedule 1. Treat data messages as meeting writing, signature and original-document requirements where the Act's conditions are satisfied.",
    "ECTA 25/2002",
  ),
  "ORG-EL-02": mod(
    "coo",
    "Reserve wet-ink signatures and paper form for the transaction categories excluded by ECTA Schedule 1 — including wills, the alienation of immovable property, certain bills of exchange, and long-term leases where statute requires writing — which cannot be validly concluded by electronic means. Route any such excluded transaction through the non-electronic execution path.",
    "ECTA Schedule 1",
  ),
  "ORG-EL-03": mod(
    "ciso",
    "Preserve the integrity and authenticity of electronic records under POPIA read with ECTA, ensuring data messages retained as records remain complete, unaltered and reliably attributable from creation through to retention and retrieval. Apply the integrity, tamper-evidence and provenance controls that make the electronic record legally reliable.",
    "POPIA + ECTA",
  ),

  // ── Companies-Act / Banks-Act / King-IV governance (ORG-GV-*) ──────────
  "ORG-GV-01": mod(
    "company-secretary",
    "Appoint and maintain a Company Secretary as required of a public company under Companies Act 71 of 2008 ss.86–89, fulfilling the statutory duties of guidance to directors, governance administration and statutory record-keeping. Ensure the Company Secretary meets the eligibility and independence requirements of the Act.",
    "Companies Act ss.86–89",
  ),
  "ORG-GV-02": mod(
    "company-secretary",
    "Ensure directors discharge their fiduciary and statutory duties under Companies Act ss.75–77 — acting in good faith, for a proper purpose, in the best interests of the company, and with the care, skill and diligence required — and declare and manage personal financial interests under s.75. Maintain the conflicts-of-interest register and the supporting declarations.",
    "Companies Act ss.75–77",
  ),
  "ORG-GV-03": mod(
    "cfo",
    "Appoint a Public Officer for the company as required by the Companies Act read with the Banks Act, being the responsible representative for SARS-facing and statutory matters, and register the appointment. Maintain the appointment current and resident as the law requires (read across with ORG-TX-08).",
    "Companies Act + Banks Act",
  ),
  "ORG-GV-04": mod(
    "company-secretary",
    "Establish a Social and Ethics Committee under Companies Regulation 43 where the company's public-interest score brings it within scope, with the committee performing the statutory monitoring functions (ethics, legal compliance, labour and social, environmental, consumer relations) and reporting to shareholders. Maintain the committee's terms of reference and reporting.",
    "Companies Reg. 43",
  ),
  "ORG-GV-05": mod(
    "company-secretary",
    "Constitute a board with a majority of independent non-executive directors and an independent chair, consistent with the Banks Act, the BCBS Corporate Governance Principles and King IV. Maintain the board's composition, independence assessment and balance of skills and experience.",
    "Banks Act + BCBS Corporate Governance Principles + King IV",
  ),
  "ORG-GV-06": mod(
    "cro",
    "Establish a Board Risk Committee under the Banks Act and the BCBS Corporate Governance Principles, responsible for overseeing the risk-management framework, risk appetite and the bank's risk profile, with the CRO having direct access to it. Maintain the committee's charter, membership and reporting cadence.",
    "Banks Act + BCBS",
  ),
  "ORG-GV-07": mod(
    "company-secretary",
    "Establish an Audit Committee under the Companies Act read with King IV, composed of independent non-executive directors, responsible for overseeing financial reporting integrity, the external and internal audit functions, and internal financial controls. Maintain the committee's statutory composition and functions.",
    "Companies Act + King IV",
  ),
  "ORG-GV-08": mod(
    "coo",
    "Establish a Remuneration Committee consistent with King IV, responsible for the remuneration policy and its implementation, including the risk-aligned remuneration of executives and material risk-takers. Maintain the committee's charter and its remuneration-report disclosures.",
    "King IV",
  ),
  "ORG-GV-09": mod(
    "company-secretary",
    "Establish a Nominations Committee consistent with King IV, responsible for board composition, director nomination and succession, and the assessment of director independence and fit-and-properness. Maintain the committee's charter and nomination process.",
    "King IV",
  ),
  "ORG-GV-10": mod(
    "cro",
    "Designate a Chief Risk Officer with operational independence from business-line management and direct access to the Board Risk Committee, consistent with the BCBS Corporate Governance Principles. Ensure the CRO has the authority, stature and resources to oversee the risk-management function (read across with ORG-GV-CRO-INDEPENDENCE).",
    "BCBS Corporate Governance Principles",
  ),
  "ORG-GV-11": mod(
    "coo",
    "Designate the fit-and-proper officers required under the Banks Act and the BCBS principles — including the CEO, CRO, CFO, COO, Treasurer, Head of Markets, CCO, CISO, CAE, GC, CHRO, CoSec and Information Officer — and maintain their continuous fit-and-properness. Notify the Prudential Authority of designations and changes as required.",
    "Banks Act + BCBS",
  ),
  "ORG-GV-12": mod(
    "company-secretary",
    "Identify, approve and disclose related-party transactions under the Companies Act read with IAS 24, applying the governance approvals the Act requires and the disclosure the standard requires. Maintain the related-party register supporting both (read across with ORG-AC-11).",
    "Companies Act + IAS 24",
  ),
  "ORG-GV-13": mod(
    "company-secretary",
    "Provide a whistleblowing channel with the statutory protections of the Protected Disclosures Act 26 of 2000, enabling employees and others to report improprieties confidentially and without fear of occupational detriment. Operate the intake, investigation and protection process the Act contemplates (read across with ORG-WB-01).",
    "Protected Disclosures Act 26/2000",
  ),
  "ORG-GV-14": mod(
    "company-secretary",
    "Apply the King IV corporate-governance principles on an apply-and-explain basis and produce integrated reporting that connects strategy, governance, performance and prospects with value creation over time. Disclose the application of each principle and the outcomes achieved.",
    "King IV",
  ),
  "ORG-GV-15": mod(
    "company-secretary",
    "Operate director induction, ongoing development, periodic board and director performance evaluation, and succession planning, consistent with King IV and the Banks Act. Maintain the records evidencing induction, evaluation outcomes and the succession pipeline.",
    "King IV + Banks Act",
  ),
  "ORG-GV-16": mod(
    "cfo",
    "Prepare, have signed, and file annual financial statements as required by the Companies Act (and the JSE Listings Requirements if listed), approved by the board and signed by the authorised directors. Meet the statutory filing deadlines and retain the supporting records.",
    "Companies Act + JSE LR (if listed)",
  ),
  "ORG-GV-17": mod(
    "company-secretary",
    "Ensure the board approves the Risk Appetite Statement, the Risk Management Framework, the ICAAP, the ILAAP and all material policies, consistent with the Banks Act and Joint Standard 2 of 2024. Maintain the board-approval record and the review cycle for each reserved document.",
    "Banks Act + Joint Standard 2 of 2024",
  ),
  "ORG-GV-18": mod(
    "company-secretary",
    "Operate the three lines of defence formally — business-line ownership of risk, independent risk and compliance oversight, and independent internal audit assurance — with the independence of the second and third lines preserved, consistent with the BCBS Corporate Governance Principles. Maintain the mandates and reporting lines that protect that independence.",
    "BCBS Corporate Governance",
  ),
  "ORG-GV-19": mod(
    "cco",
    "Operate an independent, adequately-resourced Compliance function with direct access to the Board Risk Committee, consistent with the BCBS paper Compliance and the Compliance Function in Banks (2005). Maintain the compliance charter, the compliance-risk-management programme and the function's reporting lines.",
    "BCBS Compliance and the Compliance Function (2005)",
  ),
  "ORG-GV-20": mod(
    "cae",
    "Operate an independent Internal Audit function consistent with BCBS 223 and the IIA International Professional Practices Framework, with a functional reporting line to the Audit Committee (or interim audit forum) and administrative independence. Maintain the internal-audit charter, risk-based audit plan and quality-assurance programme.",
    "BCBS 223",
  ),
  "ORG-GV-21": confirm(
    "company-secretary",
    "the 7-year retention of director-decision records (board/committee resolutions, CEO-reserved-matter decisions) under Companies Act ss.24/66/71/73/75 and Banks Act s.60",
  ),
  "ORG-GV-22": confirm(
    "company-secretary",
    "the significant-owner notification, register and fit-and-proper obligation under Joint Standard 1 of 2020 (Significant Owner)",
  ),
  "ORG-GV-AC-MINIMUM": confirm(
    "company-secretary",
    "the Audit-Committee minimum composition (≥3 independent non-executive directors; Companies Act s.94(2); Reg. 43; King IV)",
  ),
  "ORG-GV-CFO-INDEPENDENCE": confirm(
    "cfo",
    "the CFO fit-and-proper qualification (Banks Act s.60; PA standards) and direct Audit-Committee access (Companies Act s.94)",
  ),
  "ORG-GV-CRO-INDEPENDENCE": confirm(
    "cro",
    "the CRO operational-independence-from-business-line and direct-board-access obligation (JS 2/2024 §6–§7; BCBS CG Principles 2015 §3; Banks Act s.60)",
  ),
  "ORG-GV-DIRECTORS-MINIMUM": confirm(
    "company-secretary",
    "the statutory minimum-directors requirement (Companies Act s.66(2) ≥3 directors for a public company; Banks Act s.60 board composition)",
  ),
  "ORG-GV-FNP-001": confirm(
    "company-secretary",
    "PA Directive D6/2022 §2.1–§2.2 (maintain beneficial-owner records + provide an ownership-structure organogram to the PA)",
  ),
  "ORG-GV-FNP-002": confirm(
    "company-secretary",
    "PA Directive D6/2022 §2.2.1–§2.2.2 (submit beneficial-owner CBCRs / police clearances + organogram on PA written request)",
  ),
  "ORG-GV-FNP-003": confirm(
    "company-secretary",
    "PA Directive D6/2022 §2.2.5–§2.2.7 (CBCR freshness — ≤30 days SA nationals / ≤60 days foreign nationals)",
  ),
  "ORG-GV-FNP-004": confirm(
    "company-secretary",
    "PA Directive D6/2022 §2.3.1 (submit updated beneficial-owner CBCRs within the freshness timelines on becoming aware of changes)",
  ),
  "ORG-GV-FNP-005": confirm(
    "company-secretary",
    "PA Directive D6/2022 §2.4.1 (periodic risk-based re-screening of beneficial owners; CBCRs to the PA within 30 days)",
  ),
  "ORG-GV-FNP-S-001": confirm(
    "company-secretary",
    "PA Directive D7/2022 §2.1.1 (submit director/executive-officer CBCRs to the PA on written request)",
  ),
  "ORG-GV-FNP-S-002": confirm(
    "company-secretary",
    "PA Directive D7/2022 §2.1.2 (accompany every form BA 020 submitted on/after 1 Sep 2022 with a CBCR)",
  ),
  "ORG-GV-FNP-S-003": confirm(
    "company-secretary",
    "PA Directive D7/2022 §2.1.5–§2.1.6 (director/executive-officer CBCR freshness — ≤30 days SA / ≤60 days foreign from BA 020 date)",
  ),
  "ORG-GV-FNP-S-004": confirm(
    "company-secretary",
    "PA Directive D7/2022 §2.1.4 (disqualify any prospective director/executive officer unable or unwilling to undergo a CBC)",
  ),
  "ORG-GV-FNP-S-005": confirm(
    "company-secretary",
    "PA Directive D7/2022 §2.1.10 (include CBCRs for every prospective director/executive officer/key person in a Banks-Act s.12 establishment application)",
  ),
  "ORG-GV-FNP-S-006": confirm(
    "company-secretary",
    "PA Directive D7/2022 §2.1.13 (periodic risk-based re-screening of directors/executive officers/key persons; CBCRs to the PA within 30 days)",
  ),

  // ── POPIA / PAIA privacy (ORG-PR(IV)-*) ────────────────────────────────
  "ORG-PR(IV)-01": mod(
    "information-officer",
    "Process personal information only where a lawful basis exists under POPIA s.11 — consent, contractual necessity, legal obligation, protection of a legitimate interest, public-law duty, or the responsible party's or a third party's legitimate interest. Record the lawful basis relied upon for each processing operation.",
    "POPIA 4/2013 s.11",
  ),
  "ORG-PR(IV)-02": mod(
    "information-officer",
    "Collect and process personal information for a specific, explicitly defined and lawful purpose related to the bank's functions under POPIA s.13, and document that purpose. Do not process for purposes incompatible with the one for which the information was collected.",
    "POPIA s.13",
  ),
  "ORG-PR(IV)-03": mod(
    "information-officer",
    "Retain personal information only for as long as necessary to achieve the purpose for which it was collected, or as required by law, under POPIA s.14, and operate a documented retention-and-deletion schedule. Securely destroy or de-identify information once the retention basis falls away.",
    "POPIA s.14",
  ),
  "ORG-PR(IV)-04": mod(
    "information-officer",
    "Ensure any further processing of personal information is compatible with the purpose for which it was originally collected under POPIA s.15, assessing compatibility against the relationship, nature, consequences and any contractual or legal basis. Obtain a fresh lawful basis where further processing is not compatible.",
    "POPIA s.15",
  ),
  "ORG-PR(IV)-05": mod(
    "information-officer",
    "Notify data subjects of the prescribed particulars when collecting their personal information under POPIA s.18 — including the information collected, the purpose, the recipients, and the data subject's rights — unless an exemption applies. Provide the notice before or as soon as reasonably practicable after collection.",
    "POPIA s.18",
  ),
  "ORG-PR(IV)-06": mod(
    "information-officer",
    "Secure the integrity and confidentiality of personal information under POPIA ss.19–22 by maintaining appropriate, reasonable technical and organisational measures against loss, damage, unauthorised destruction, and unlawful access or processing, informed by generally accepted security practices and the bank's risk assessment. Impose equivalent obligations on operators (processors) by written contract.",
    "POPIA ss.19–22",
  ),
  "ORG-PR(IV)-07": mod(
    "information-officer",
    "Notify the Information Regulator and the affected data subjects of any compromise (breach) of personal information as soon as reasonably possible after discovery, under POPIA s.22, providing the prescribed particulars to enable data subjects to protect themselves. Maintain the breach-detection, assessment and notification process.",
    "POPIA s.22",
  ),
  "ORG-PR(IV)-08": mod(
    "information-officer",
    "Honour the data subject's right of access under POPIA s.23, confirming whether the bank holds their personal information and providing the record or a description of it on request, subject to the prescribed fees and grounds for refusal. Operate the access-request intake and response process within the statutory timeframes.",
    "POPIA s.23",
  ),
  "ORG-PR(IV)-09": mod(
    "information-officer",
    "Honour the data subject's right to request correction or deletion of personal information that is inaccurate, irrelevant, excessive, out of date, incomplete, misleading or unlawfully obtained, under POPIA s.24. Action the request, or attach an indication where it cannot be resolved, and notify recipients as required.",
    "POPIA s.24",
  ),
  "ORG-PR(IV)-10": mod(
    "information-officer",
    "Limit decisions affecting a data subject that are based solely on automated processing under POPIA s.71, and where such decisions are permitted, provide the data subject the opportunity to make representations and require them to be informed of the underlying logic. Govern automated decision-making affecting customers accordingly.",
    "POPIA s.71",
  ),
  "ORG-PR(IV)-11": mod(
    "information-officer",
    "Process special personal information only on one of the limited authorising grounds in POPIA s.34 and its sectoral provisions, recognising the general prohibition on processing categories such as religious or philosophical beliefs, race, health, biometric data and criminal behaviour. Document the authorising ground for any special-information processing.",
    "POPIA s.34",
  ),
  "ORG-PR(IV)-12": mod(
    "information-officer",
    "Process the personal information of children only on a ground authorised by POPIA s.35 (such as competent-person consent or the establishment of a legal right), recognising the general prohibition on processing children's information. Apply additional safeguards where children's information is processed.",
    "POPIA s.35",
  ),
  "ORG-PR(IV)-13": mod(
    "information-officer",
    "Designate an Information Officer under POPIA ss.55–56 read with POPIA Regulation 4, register the designation with the Information Regulator, and ensure the Information Officer performs the statutory duties of encouraging compliance, dealing with requests, and developing the PAIA manual and POPIA processes. Resource and empower the role accordingly.",
    "POPIA ss.55–56 + POPIA Reg. 4",
  ),
  "ORG-PR(IV)-13-GLOSS-DEPUTY-IO": confirm(
    "information-officer",
    "the obligation to designate a deputy Information Officer under POPIA Regulation 4 and lodge it with the Information Regulator as a separate filing from the IO designation",
  ),
  "ORG-PR(IV)-14": mod(
    "information-officer",
    "Obtain prior authorisation from the Information Regulator under POPIA s.57 before carrying out the processing types for which it is required — such as certain unique-identifier, criminal-behaviour, credit-reporting or specified data-transfer processing — and not commence that processing until authorised. Identify in advance any processing within the s.57 categories.",
    "POPIA s.57",
  ),
  "ORG-PR(IV)-15": mod(
    "information-officer",
    "Transfer personal information across South African borders only where a POPIA s.72 condition is met — adequate-protection regime, data-subject consent, contractual necessity, or transfer for the data subject's benefit where consent is impracticable. Implement the transfer mechanism (such as binding contractual safeguards) that establishes the lawful basis.",
    "POPIA s.72",
  ),
  "ORG-PR(IV)-16": mod(
    "information-officer",
    "Compile, maintain and make available a PAIA Manual under section 51 of the Promotion of Access to Information Act 2 of 2000, describing the records the bank holds and how to request access, and lodge it as required. Keep the manual current as the bank's record-holdings change.",
    "PAIA 2/2000 s.51",
  ),
  "ORG-PR(IV)-17": mod(
    "information-officer",
    "Respond to PAIA access requests within the statutory timeframes, granting or refusing access on the grounds the Act permits and advising requesters of their internal-appeal and review rights. Operate the request-logging, decision and notification workflow PAIA requires.",
    "PAIA",
  ),

  // ── Whistleblowing / ABC (ORG-WB-*) ────────────────────────────────────
  "ORG-WB-01": mod(
    "company-secretary",
    "Provide the statutory protections for whistleblowers under the Protected Disclosures Act 26 of 2000, shielding employees and workers who make a protected disclosure from occupational detriment and providing safe reporting routes. Operate the disclosure-intake, assessment and protection process the Act contemplates (read across with ORG-GV-13).",
    "Protected Disclosures Act 26/2000",
  ),
  "ORG-WB-02": mod(
    "company-secretary",
    "Operate a zero-tolerance anti-bribery-and-corruption programme consistent with PRECCA and, where applicable, the UK Bribery Act and the US FCPA, including pre-approval of gifts and hospitality above a defined threshold and anti-bribery due diligence on third parties and intermediaries. Maintain the ABC policy, registers and training.",
    "PRECCA + UK Bribery Act + FCPA where applicable",
  ),
  "ORG-WB-03": mod(
    "company-secretary",
    "Maintain a board-approved Code of Conduct and code of ethics consistent with King IV and the Companies Act, setting out the ethical standards expected of directors and employees and how breaches are reported and addressed. Communicate, train on, and periodically review the codes.",
    "King IV + Companies Act",
  ),
  "ORG-WB-04": mod(
    "company-secretary",
    "Identify, declare and manage conflicts of interest across directors and employees under the Companies Act read with King IV, maintaining declarations and a conflicts register and applying recusal and management measures where conflicts arise. Review the conflicts framework periodically.",
    "Companies Act + King IV",
  ),
};
