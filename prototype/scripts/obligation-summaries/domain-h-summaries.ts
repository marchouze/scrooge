// prototype/scripts/obligation-summaries/domain-h-summaries.ts
//
// P4-SCALE — Domain H (Accounting / financial reporting: IFRS, IAS, Banks-Act
// returns, external audit, BCBS 239) reviewed requirement summaries. All rows
// are SA `ORG-AC-*` thin one-liners → `reviewed-modified`; source text is
// `missing` in the live drill-down (IFRS/IAS standards are not graph-extracted
// Provisions), so each summary is authored from the standard cited + existing
// prose, with the gap noted (not fabricated).
//
// Owning seats: mostly cfo (finance-close authority); ORG-AC-02 cro (ECL is a
// credit-risk measure), ORG-AC-03 treasurer (hedge accounting), ORG-AC-15 coo
// (BCBS 239 risk-data aggregation) — preserved from the adopted owner.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { SummaryModule } from "./summary-types";

const MISSING =
  "Source text missing in the drill-down (IFRS/IAS/SA standard not graph-extracted as a Provision); summary authored from the standard cited + existing requirement prose.";

export const DOMAIN_H: SummaryModule = {
  "ORG-AC-01": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Classify financial assets at initial recognition into amortised cost, fair value through other comprehensive income (FVOCI), or fair value through profit or loss (FVTPL) under IFRS 9, determined by the business model for managing the asset and whether its cash flows are solely payments of principal and interest (the SPPI test). Classify financial liabilities at amortised cost or FVTPL accordingly, and document the business-model and SPPI assessment supporting each classification.",
    rationale: `Thin one-liner expanded from the IFRS 9 classification citation. ${MISSING}`,
  },
  "ORG-AC-02": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Recognise expected credit losses on financial assets measured at amortised cost and FVOCI, and on loan commitments and financial guarantees, under the IFRS 9 three-stage impairment model — 12-month ECL at Stage 1, lifetime ECL on a significant increase in credit risk at Stage 2, and lifetime ECL with interest on the net carrying amount once credit-impaired at Stage 3. Estimate ECL on a probability-weighted, forward-looking basis incorporating macroeconomic scenarios.",
    rationale: `Thin one-liner expanded from the IFRS 9 ECL citation (three-stage model). ${MISSING}`,
  },
  "ORG-AC-03": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Apply IFRS 9 hedge accounting (the IAS 39 carryover option is not elected per CEO election F1), designating and documenting qualifying hedging relationships — fair-value, cash-flow or net-investment hedges — and demonstrating an economic relationship, that credit risk does not dominate, and an appropriate hedge ratio. Measure and record hedge effectiveness and any ineffectiveness each reporting period.",
    rationale: `Thin one-liner expanded from the IFRS 9 hedge-accounting citation (CEO election F1). ${MISSING}`,
  },
  "ORG-AC-04": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Disclose the nature and extent of risks arising from financial instruments under IFRS 7 — credit risk, liquidity risk and market risk — together with the bank's objectives, policies and processes for managing those risks, on both a qualitative and quantitative basis. Provide the prescribed sensitivity, maturity and credit-quality analyses in the annual financial statements.",
    rationale: `Thin one-liner expanded from the IFRS 7 citation. ${MISSING}`,
  },
  "ORG-AC-05": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Measure fair value under IFRS 13 as the price to sell an asset or transfer a liability in an orderly transaction between market participants at the measurement date, maximising observable inputs and minimising unobservable ones. Classify each measurement within the fair-value hierarchy (Level 1 quoted prices, Level 2 observable inputs, Level 3 unobservable inputs) and provide the prescribed valuation-technique and hierarchy disclosures.",
    rationale: `Thin one-liner expanded from the IFRS 13 fair-value citation. ${MISSING}`,
  },
  "ORG-AC-06": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Recognise revenue from contracts with customers under the IFRS 15 five-step model — identify the contract, identify the performance obligations, determine the transaction price, allocate it to the performance obligations, and recognise revenue as each obligation is satisfied. Apply this to fee- and commission-based banking income (interest income falls under IFRS 9 effective-interest, outside IFRS 15).",
    rationale: `Thin one-liner expanded from the IFRS 15 five-step citation. ${MISSING}`,
  },
  "ORG-AC-07": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Recognise leases on the balance sheet under IFRS 16 by bringing a right-of-use asset and a corresponding lease liability into account for lessee contracts (subject to the short-term and low-value exemptions), and depreciate the asset while unwinding interest on the liability. Apply lessor accounting (finance or operating lease classification) where the bank is a lessor.",
    rationale: `Thin one-liner expanded from the IFRS 16 citation. ${MISSING}`,
  },
  "ORG-AC-08": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Present a complete set of financial statements under IAS 1 — statement of financial position, statement of profit or loss and other comprehensive income, statement of changes in equity, statement of cash flows, and notes — on a going-concern, accrual basis with consistent classification and the required comparative information. Make the going-concern and material-accounting-policy disclosures IAS 1 prescribes.",
    rationale: `Thin one-liner expanded from the IAS 1 presentation citation. ${MISSING}`,
  },
  "ORG-AC-09": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Recognise and measure current and deferred income taxes under IAS 12: current tax for the period's taxable profit, and deferred tax on temporary differences between the carrying amounts and tax bases of assets and liabilities, measured at the rates expected to apply on reversal. Recognise deferred-tax assets only to the extent future taxable profit is probable.",
    rationale: `Thin one-liner expanded from the IAS 12 citation. ${MISSING}`,
  },
  "ORG-AC-10": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Apply the IAS 21 framework for the effects of changes in foreign-exchange rates: measure and record transactions in each entity's functional currency, translate foreign-currency monetary items at the closing rate with exchange differences in profit or loss, and translate results and position into the group's presentation currency for consolidation. Determine each entity's functional currency from the primary economic environment in which it operates.",
    rationale: `Thin one-liner expanded from the IAS 21 functional/presentation-currency citation. ${MISSING}`,
  },
  "ORG-AC-11": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Disclose related-party relationships, transactions and outstanding balances under IAS 24, including parent and subsidiary relationships, key-management-personnel compensation, and the terms of related-party transactions, irrespective of whether a price was charged. Maintain a related-party register sufficient to support the disclosure.",
    rationale: `Thin one-liner expanded from the IAS 24 citation. ${MISSING}`,
  },
  "ORG-AC-12": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Account for and disclose uncertainty over income-tax treatments under IFRIC 23, determining whether to reflect each uncertain tax treatment using the most-likely-amount or the expected-value method on the assumption that the tax authority will examine the position with full knowledge. Re-assess judgements and estimates when facts and circumstances change.",
    rationale: `Thin one-liner expanded from the IFRIC 23 uncertain-tax-position citation. ${MISSING}`,
  },
  "ORG-AC-13": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Submit the prescribed monthly and quarterly BA returns to the Prudential Authority under the Banks Act and the Regulations relating to Banks, reconciled to the general ledger and the IFRS financial statements. Meet each return's regulatory deadline and retain the supporting computation and audit trail.",
    rationale: `Thin one-liner expanded from the Banks Act + Regulations-relating-to-Banks BA-returns citation. ${MISSING}`,
  },
  "ORG-AC-14": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Prepare annual financial statements and have them audited by a registered external auditor as required by the Companies Act read with the Banks Act, with the auditor expressing an opinion on whether the statements fairly present the bank's financial position and performance under IFRS. Table the audited statements through the Audit Committee and the board and file them as required.",
    rationale: `Thin one-liner expanded from the Companies Act + Banks Act external-audit citation. ${MISSING}`,
  },
  "ORG-AC-15": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Apply the BCBS 239 principles for effective risk-data aggregation and risk reporting, ensuring risk data is accurate, complete, timely and adaptable, and that risk reports to the board and management are accurate, comprehensive, clear and produced at the required frequency. Underpin this with strong data governance and architecture so aggregated risk exposures can be produced reliably, including under stress (read across with ORG-RM risk-data-aggregation rows).",
    rationale: `Thin one-liner expanded from the BCBS 239 citation. ${MISSING}`,
  },
  "ORG-AC-16": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Maintain external-auditor independence and mandatory audit-firm and partner rotation as required by the IRBA rules read with the Companies Act, including restrictions on non-audit services and the cooling-off and rotation periods that preserve auditor objectivity. Govern auditor appointment, independence assessment and rotation through the Audit Committee.",
    rationale: `Thin one-liner expanded from the IRBA + Companies Act auditor-independence/rotation citation. ${MISSING}`,
  },
};
