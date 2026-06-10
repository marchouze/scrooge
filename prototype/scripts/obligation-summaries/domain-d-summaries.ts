// prototype/scripts/obligation-summaries/domain-d-summaries.ts
//
// P4-SCALE — Domain D (Conduct / FAIS / TCF / ODP authorisation-conduct-
// reporting) reviewed requirement summaries. SA rows: `ORG-CD-*` (FAIS/TCF
// high-level), `ORG-CS1/2/3-*` (Conduct Standards 1–3 of 2018), `ORG-FAIS-*`
// (FAIS KI + General-Code record-keeping), `ORG-ODP-AUTH/COND/RPT-*` (Conduct
// Standards detailed sub-section decomposition).
//
// Verdict split:
//   - reviewed-modified: the thin `ORG-CD-01..10` FAIS/TCF one-liners + the bare
//     `ORG-FAIS-KI` row — expanded to grounded 2-sentence summaries. Source text
//     `missing` in the drill-down (FAIS Act / Conduct Standards not graph-
//     extracted), noted not fabricated.
//   - reviewed-confirmed: the `ORG-CS*`, `ORG-FAIS-RK-*`, and `ORG-ODP-*` rows,
//     whose requirements already carry accurate §-level multi-clause prose.
//
// Owning seats preserved from the adopted owner.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { ObligationSummary, SummaryModule } from "./summary-types";

const MISSING =
  "Source text missing in the drill-down (FAIS Act / Conduct Standard not graph-extracted as a Provision); summary authored from the citation + existing requirement prose.";

function confirm(seat: string, what: string): ObligationSummary {
  return {
    reviewerSeat: seat,
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale: `Existing requirement is already an accurate multi-clause summary of ${what}; confirmed without rewrite. Domain D — conduct / FAIS / ODP.`,
  };
}

export const DOMAIN_D: SummaryModule = {
  // ── FAIS / TCF high-level (ORG-CD-*) — reviewed-modified ────────────────
  "ORG-CD-01": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Operationalise the six Treating Customers Fairly outcomes across the product lifecycle under the FAIS Act 37 of 2002 and the FSCA conduct standards — fair treatment embedded in culture, products meeting identified customer needs, clear and appropriate information, suitable advice, products performing as led to expect, and no unreasonable post-sale barriers. Evidence the TCF outcomes through governance, product oversight and conduct management information.",
    rationale: `Thin one-liner expanded from the FAIS Act + FSCA conduct-standards TCF citation. ${MISSING}`,
  },
  "ORG-CD-02": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Hold an FSP licence under the FAIS Act before furnishing advice or rendering intermediary services in respect of financial products, and operate only within the categories and product subcategories the licence authorises. Maintain the licence conditions and notify the FSCA of changes affecting the authorisation.",
    rationale: `Thin one-liner expanded from the FAIS Act FSP-licensing citation. ${MISSING}`,
  },
  "ORG-CD-03": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Where FSP-licensed, designate the required fit-and-proper Key Individual(s) responsible for managing or overseeing the financial-services activities, and appoint and supervise Representatives rendering those services, under the FAIS Act. Maintain the Representative register and the supervision arrangements the Act requires.",
    rationale: `Thin one-liner expanded from the FAIS Act KI/Representative citation. ${MISSING}`,
  },
  "ORG-CD-04": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Maintain advice records under the FAIS General Code of Conduct that demonstrate the suitability of advice given, capturing the client information obtained, the analysis performed, and the basis on which the product recommended is appropriate to the client's needs and circumstances. Retain the records for the prescribed period (read across with ORG-FAIS-RK-SUITABILITY).",
    rationale: `Thin one-liner expanded from the FAIS General Code of Conduct advice-record citation. ${MISSING}`,
  },
  "ORG-CD-05": {
    reviewerSeat: "company-secretary",
    verdict: "reviewed-modified",
    summary:
      "Manage conflicts of interest under the FAIS Conflict of Interest Management Code, identifying conflicts, avoiding them where they cannot be managed, and disclosing any residual conflict to the client together with the measures taken to manage it. Maintain a board-approved conflicts-of-interest management policy and the associated registers.",
    rationale: `Thin one-liner expanded from the FAIS Conflict of Interest Code citation. ${MISSING}`,
  },
  "ORG-CD-06": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Disclose all fees and charges to customers transparently before and at the point of sale under the FAIS Act and the FSCA conduct standards, so the customer understands the cost of the product and any intermediary remuneration. Present charges in a clear, comparable form (read across with ORG-FAIS-RK-FEE-DISCLOSURE).",
    rationale: `Thin one-liner expanded from the FAIS + FSCA conduct-standards fee-disclosure citation. ${MISSING}`,
  },
  "ORG-CD-07": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Operate a complaints-handling framework that meets the FSCA conduct standards under the FAIS Act, covering receipt, recording, fair and timely investigation, resolution and escalation, and advising complainants of their right to refer the matter to the FAIS Ombud. Maintain complaints management information and root-cause analysis (read across with ORG-FAIS-RK-COMPLAINT-HANDLING).",
    rationale: `Thin one-liner expanded from the FAIS + FSCA complaints-handling citation. ${MISSING}`,
  },
  "ORG-CD-08": {
    reviewerSeat: "company-secretary",
    verdict: "reviewed-modified",
    summary:
      "Operate within the Twin Peaks regulatory architecture established by the Financial Sector Regulation Act 9 of 2017 — prudential regulation by the Prudential Authority and market-conduct regulation by the FSCA — and cooperate with, and report to, both regulators as their respective mandates require. Maintain the governance to satisfy dual-regulator supervisory and information obligations.",
    rationale: `Thin one-liner expanded from the FSR Act 9/2017 Twin-Peaks citation. ${MISSING}`,
  },
  "ORG-CD-09": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Maintain forward-compatibility with the COFI Bill's activity-based conduct-licensing regime (currently before Parliament), so that the bank's conduct framework can transition from the FAIS institutional licence to COFI activity licences with minimal redesign once enacted. Track the Bill's progress and map current conduct obligations to the prospective COFI activities.",
    rationale: `Thin one-liner expanded from the COFI Bill citation (in Parliament). ${MISSING}`,
  },
  "ORG-CD-10": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Where the bank provides credit, comply with the National Credit Act — registration as a credit provider, affordability assessment, pre-agreement disclosure and quotation, permissible cost-of-credit limits, and reckless-lending prohibitions. Operate the NCA controls across the credit-product lifecycle.",
    rationale: `Thin one-liner expanded from the National Credit Act citation (where credit provided). ${MISSING}`,
  },
  "ORG-FAIS-KI": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Designate at least one fit-and-proper Key Individual under FAIS Act s.8 and the Determination of Fit and Proper Requirements, 2017, responsible for managing or overseeing the rendering of financial services, and satisfy the FSCA of the KI's honesty and integrity, competence (qualifications, experience, regulatory exams) and operational ability. Maintain continuous fit-and-proper compliance and notify the FSCA of changes.",
    rationale: `Thin one-liner expanded from the FAIS Act s.8 + Determination of Fit and Proper Requirements, 2017 citation. ${MISSING}`,
  },

  // ── Conduct Standard 1 of 2018 (ODP authorisation) — confirmed ─────────
  "ORG-CS1-001": confirm(
    "cfo",
    "Conduct Standard 1/2018 §3 (operational capital sufficiency for the ODP business)",
  ),
  "ORG-CS1-002": confirm(
    "company-secretary",
    "Conduct Standard 1/2018 §4 (fit-and-proper: senior management, controlling body, key individuals)",
  ),
  "ORG-CS1-003": confirm(
    "cro",
    "Conduct Standard 1/2018 §5 (board-approved written risk-management framework)",
  ),
  "ORG-CS1-004": confirm(
    "coo",
    "Conduct Standard 1/2018 §6 (IT and operational-capacity demonstration)",
  ),

  // ── Conduct Standard 2/2018 trade reporting (schema) — confirmed ───────
  "ORG-CS2-001": confirm(
    "coo",
    "Conduct Standard 2/2018 + Strate TR trade reporting per the 169-element schema, aligned with EMIR / EMIR Refit",
  ),

  // ── Conduct Standard 3 of 2018 (ODP conduct) — confirmed ───────────────
  "ORG-CS3-001": confirm(
    "cco",
    "Conduct Standard 3/2018 §3 (written trading-relationship agreement before any OTC derivative transaction — ISDA Master + ZA Schedule + CSA)",
  ),
  "ORG-CS3-002": confirm(
    "head-of-global-markets",
    "Conduct Standard 3/2018 §4 (timely confirmation of all material terms post-execution)",
  ),
  "ORG-CS3-003": confirm(
    "coo",
    "Conduct Standard 3/2018 §5 (portfolio reconciliation at specified intervals; discrepancy identification)",
  ),
  "ORG-CS3-004": confirm(
    "coo",
    "Conduct Standard 3/2018 §6 (dispute-resolution procedures in place before transaction commencement)",
  ),
  "ORG-CS3-005": confirm(
    "cco",
    "Conduct Standard 3/2018 §7 (client/counterparty categorisation policy + pre-trade due diligence)",
  ),
  "ORG-CS3-006": confirm(
    "cro",
    "Conduct Standard 3/2018 §8 (daily valuation; agreed methodology with counterparty)",
  ),
  "ORG-CS3-007": confirm(
    "company-secretary",
    "Conduct Standard 3/2018 §9 (conflicts-of-interest management on OTC derivative dealing)",
  ),
  "ORG-CS3-008": confirm("cco", "Conduct Standard 3/2018 §10 (complaints handling)"),
  "ORG-CS3-009": confirm(
    "coo",
    "Conduct Standard 3/2018 §12 (tamper-evident record-keeping ≥ 5 years)",
  ),

  // ── FAIS General-Code record-keeping (ORG-FAIS-RK-*) — confirmed ────────
  "ORG-FAIS-RK-ADVICE": confirm(
    "cco",
    "the FAIS GCC s.3(2) advice-record obligation (capture and retain every advice interaction ≥ 5 years after termination)",
  ),
  "ORG-FAIS-RK-COMPLAINT-HANDLING": confirm(
    "cco",
    "the FAIS GCC s.16(2) + FAIS Act s.18(b) complaints-handling and 5-year complaint-record obligation",
  ),
  "ORG-FAIS-RK-FEE-DISCLOSURE": confirm(
    "cco",
    "the FAIS GCC s.7(1)(c)(vi)/s.3(1)(a)(vii) written pre-engagement fee-and-remuneration disclosure obligation",
  ),
  "ORG-FAIS-RK-GENERAL-CODE": confirm(
    "cco",
    "the FAIS General Code of Conduct (BN 80/2003) in its entirety — honest/fair/skilled conduct, clients'-best-interests, conflicts management",
  ),
  "ORG-FAIS-RK-SUITABILITY": confirm(
    "cco",
    "the FAIS GCC s.8(1)(a)–(c) suitability-assessment and record obligation",
  ),

  // ── ODP authorisation (CS 1/2018 sub-section decomposition) — confirmed ─
  "ORG-ODP-AUTH-001": confirm(
    "cco",
    "CS 1/2018 §4.1 (capital/reserves proportional to ODP risk; ≥6-months operating-expense liquid net assets + orderly-wind-up cover)",
  ),
  "ORG-ODP-AUTH-002": confirm(
    "cco",
    "CS 1/2018 §4.2.1 (honesty and integrity of controlling-body members and senior managers; Annexure B/C disclosure)",
  ),
  "ORG-ODP-AUTH-003": confirm(
    "cco",
    "CS 1/2018 §4.2.2 (competency of controlling-body members and senior managers; maintained register)",
  ),
  "ORG-ODP-AUTH-004": confirm(
    "coo",
    "CS 1/2018 §4.2.3 (operational ability to fulfil all FMA responsibilities — SA business address, communications, administration)",
  ),
  "ORG-ODP-AUTH-005": confirm(
    "cfo",
    "CS 1/2018 §4.2.4/§4.2.5 (financial soundness — not in liquidation/business-rescue; assets exceed liabilities; current-asset adequacy)",
  ),
  "ORG-ODP-AUTH-006": confirm(
    "cco",
    "CS 1/2018 §4.3–§4.6 (responsible governance, board-approved risk policies, annual independent risk-system review, compliance function)",
  ),

  // ── ODP conduct (CS 2/2018 sub-section decomposition) — confirmed ──────
  "ORG-ODP-COND-001": confirm(
    "cco",
    "CS 2/2018 §3 (general conduct duties — honest/fair/skilled, clients' interests, clear communication, conflicts management)",
  ),
  "ORG-ODP-COND-002": confirm(
    "cco",
    "CS 2/2018 §4 (counterparty/client categorisation before transacting; written notification and consent)",
  ),
  "ORG-ODP-COND-003": confirm(
    "cco",
    "CS 2/2018 §5 (pre-execution client information-gathering and appropriateness assessment)",
  ),
  "ORG-ODP-COND-004": confirm(
    "cco",
    "CS 2/2018 §6 (factually-correct, plain-language, timely client representations)",
  ),
  "ORG-ODP-COND-005": confirm(
    "cco",
    "CS 2/2018 §7 (written agreement covering payment, netting, default/termination and close-out terms)",
  ),
  "ORG-ODP-COND-006": confirm(
    "head-of-global-markets",
    "CS 2/2018 §8 (timely confirmation — T+1 standard / T+5 complex per Annexure A)",
  ),
  "ORG-ODP-COND-007": confirm(
    "coo",
    "CS 2/2018 §9 (portfolio-reconciliation arrangements agreed in writing; frequency by portfolio size)",
  ),
  "ORG-ODP-COND-008": confirm(
    "coo",
    "CS 2/2018 §10 (written dispute identification/recording/monitoring procedures)",
  ),
  "ORG-ODP-COND-009": confirm(
    "coo",
    "CS 2/2018 §11 (semi-annual portfolio-compression analysis for portfolios ≥ 500 non-centrally-cleared OTC derivatives)",
  ),
  "ORG-ODP-COND-010": confirm(
    "treasurer",
    "CS 2/2018 §12 (utmost-good-faith handling and segregation of client/counterparty collateral)",
  ),
  "ORG-ODP-COND-011": confirm(
    "cco",
    "CS 2/2018 §13–§17 (FAIS-licensed-intermediary marketing arrangements, disclosure and §6 performance)",
  ),
  "ORG-ODP-COND-012": confirm(
    "cco",
    "CS 2/2018 §15 (confidentiality of counterparty/client information, with the prescribed exceptions)",
  ),

  // ── ODP reporting (CS 3/2018 sub-section decomposition) — confirmed ────
  "ORG-ODP-RPT-001": confirm(
    "cco",
    "CS 3/2018 §3 (report every executed/modified/terminated OTC derivative across the prescribed asset classes to the licensed trade repository)",
  ),
  "ORG-ODP-RPT-002": confirm(
    "cco",
    "CS 3/2018 §4–§5 (allocation of the reporting obligation — CCP, dual-ODP, delegation — and minimum report content)",
  ),
  "ORG-ODP-RPT-003": confirm(
    "cco",
    "CS 3/2018 §6–§8 (T+1 reporting; daily MTM/MTModel valuation; Annexure event reporting)",
  ),
  "ORG-ODP-RPT-004": confirm(
    "cco",
    "CS 3/2018 Annexure A items 1–59 (counterparty, product and transaction data-field clusters)",
  ),
  "ORG-ODP-RPT-005": confirm(
    "cco",
    "CS 3/2018 Annexure A items 60–100 (asset-class-specific and event/valuation data-field clusters)",
  ),
};
