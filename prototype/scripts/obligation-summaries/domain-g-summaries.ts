// prototype/scripts/obligation-summaries/domain-g-summaries.ts
//
// P4-SCALE — Domain G (Tax: corporate income tax, transfer pricing, VAT,
// withholding, FATCA/CRS, tax administration) reviewed requirement summaries.
// All rows are SA `ORG-TX-*` thin one-liners → `reviewed-modified`; the source
// text is `missing` in the live drill-down (no extractable graph Provision text
// for the SA tax statutes), so each summary is authored from the citation +
// the existing requirement prose and the gap is noted in the rationale.
//
// Owning seat: cfo (tax sits in the CFO's finance-close authority).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { SummaryModule } from "./summary-types";

const SA_MISSING =
  "SA source text missing in the drill-down (no extractable graph Provision text for the SA tax statute); summary authored from the citation + existing requirement prose.";

export const DOMAIN_G: SummaryModule = {
  "ORG-TX-01": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Compute and pay South African corporate income tax on the bank's taxable income at the prevailing company rate under the Income Tax Act 58 of 1962, after allowable deductions, capital allowances and assessed-loss carry-forwards. Submit provisional tax (IRP6) on the prescribed dates and the annual income-tax return (ITR14) to SARS within the statutory filing window, and settle any balance of tax due.",
    rationale: `Thin one-liner expanded to a 2-sentence summary from the Income Tax Act 58/1962 citation. ${SA_MISSING}`,
  },
  "ORG-TX-02": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Price all cross-border transactions with connected (related) parties on an arm's-length basis as required by section 31 of the Income Tax Act read with the OECD Transfer Pricing Guidelines, so that intra-group pricing reflects what independent parties would agree. Maintain contemporaneous transfer-pricing documentation (master file, local file and, where thresholds are met, country-by-country report) supporting the method selected and the comparability analysis.",
    rationale: `Thin one-liner expanded from the Income Tax Act s.31 + OECD TP Guidelines citation. ${SA_MISSING}`,
  },
  "ORG-TX-03": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Apply the SARS-approved VAT apportionment method to recover input VAT on mixed (taxable and exempt) financial-services supplies under the VAT Act 89 of 1991, since most banking income is VAT-exempt and only the taxable portion of input VAT is claimable. Account for and remit output VAT on standard-rated fee income, and submit VAT201 returns on the prescribed cycle.",
    rationale: `Thin one-liner expanded from the VAT Act 89/1991 + SARS-practice citation (financial-services apportionment). ${SA_MISSING}`,
  },
  "ORG-TX-04": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Keep and retain all records, books of account and supporting documents necessary to satisfy the bank's tax obligations for the period prescribed by the Tax Administration Act 28 of 2011 (generally five years from the date of the relevant return, longer where an audit or objection is in progress). The records must be retrievable in a form SARS can access on request and must substantiate every figure in the bank's tax returns.",
    rationale: `Thin one-liner expanded from the Tax Administration Act 28/2011 retention citation. ${SA_MISSING}`,
  },
  "ORG-TX-05": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Withhold, account for and remit South African withholding taxes on cross-border payments to non-residents — withholding tax on interest, dividends tax on dividends, and withholding tax on royalties — at the rates set in the Income Tax Act as reduced by any applicable double-tax agreement. Obtain and retain the declarations and beneficial-ownership evidence required to apply a treaty-reduced rate, and submit the prescribed withholding returns to SARS.",
    rationale: `Thin one-liner expanded from the Income Tax Act withholding citation. ${SA_MISSING}`,
  },
  "ORG-TX-06": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Classify account holders for US FATCA purposes, identify US-reportable accounts under the SA–US Intergovernmental Agreement read with the Tax Administration Act, and submit the FATCA report to SARS annually for onward exchange with the IRS (operationalised jointly with ORG-FC-15). Maintain the self-certification and indicia-review controls that drive the classification.",
    rationale: `Thin one-liner expanded from the FATCA IGA + Tax Admin Act citation. ${SA_MISSING}`,
  },
  "ORG-TX-07": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Classify account holders under the OECD Common Reporting Standard as transposed by the Tax Administration Act, identify CRS-reportable accounts by tax residence, and submit the CRS report to SARS annually for onward exchange with partner jurisdictions (operationalised jointly with ORG-FC-16). Maintain the self-certification, due-diligence and reasonableness controls the CRS prescribes.",
    rationale: `Thin one-liner expanded from the CRS + Tax Admin Act citation. ${SA_MISSING}`,
  },
  "ORG-TX-08": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Appoint a Public Officer for the bank as required by the Companies Act read with the Tax Administration Act, being the bank's responsible representative for all SARS-facing tax matters, and register the appointment with SARS. The Public Officer must be a senior person resident in South Africa and is accountable for the bank's compliance with its tax obligations.",
    rationale: `Thin one-liner expanded from the Companies Act + Tax Admin Act Public-Officer citation. ${SA_MISSING}`,
  },
  "ORG-TX-09": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Where a material tax default or under-declaration is discovered, use the SARS Voluntary Disclosure Programme under the Income Tax Act read with the Tax Administration Act to regularise the position before SARS commences an audit or investigation, securing relief from understatement penalties in exchange for full disclosure. Govern any VDP application through the bank's tax-governance process with appropriate sign-off.",
    rationale: `Thin one-liner expanded from the Income Tax Act + Tax Admin Act VDP citation. ${SA_MISSING}`,
  },
};
