// seeds/treasury/instrument-definitions-seed.ts
//
// FinancialInstrumentDefined seed payloads for 4 treasury instruments.
//
// Each instrument maps to one of the NPA-approved treasury products in
// `npa-approvals-seed.ts`. The ProductApproved events must be in the event
// store before trade execution events reference these instruments — the CI
// permission gate enforces this ordering.
//
// Instruments:
//   fi:pam:REPO-7D-001   — 7-day repo, PAM, references REPO-ZAR-001
//   fi:pam:MMD-30D-001   — 30-day money market deposit, PAM, references MMD-ZAR-001
//   fi:pam:IBL-1M-001    — 1-month interbank loan fixed term, PAM, references IBL-FT-ZAR-001
//   fi:clm:IBL-CALL-001  — interbank loan call, CLM, references IBL-CALL-ZAR-001
//
// Contract-type schemas used (from instrument.ts Slice 5):
//   PAM — pamContractTermsSchema: nominalInterestRate, dayCountConvention, paymentFrequency
//   CLM — clmContractTermsSchema: baseRate, noticePeriosDays [sic — schema typo], floatingIndex
//
// All payloads pass `financialInstrumentDefinedPayloadSchema.parse()`.
//
// These payloads are exported as typed arrays. They do NOT emit events
// directly — the boot script (or seed runner) calls
// `makeFinancialInstrumentDefined(...)` from instrument.ts with these payloads.
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY — CEO-approved 2026-05-22; authority for
//     FinancialInstrumentDefined schema and factory.
//   ACTUS-FRF-V1.1 §PAM — Principal at Maturity contract-type standard.
//   ACTUS-FRF-V1.1 §CLM — Call Money contract-type standard.
//   brief:ravi:ws0-npa-pipeline-financialinstrumentdefined-seed:2026-05-23
//
// Author: Ravi (Treasury/ALM Engineer, engineering) per
//   brief:ravi:ws0-npa-pipeline-financialinstrumentdefined-seed:2026-05-23.

import type { FinancialInstrumentDefinedPayload } from "../../platform/markets/cdm/instrument";

// ---------------------------------------------------------------------------
// PAM instruments — Principal at Maturity
// ---------------------------------------------------------------------------
//
// PAM contractTerms mandatory fields (pamContractTermsSchema):
//   nominalInterestRate  — decimal, e.g. 0.0845 = 8.45%
//   dayCountConvention   — "ACT/365" | "ACT/360" | "30/360"
//   paymentFrequency     — "monthly" | "quarterly" | "semi-annual" | "annual"
//
// Treasury/interbank conventions: ACT/365, bullet (single payment at maturity)
// modelled as "monthly" frequency (shortest standard period; actual cash flow
// is a single bullet at maturity, but paymentFrequency drives the ACTUS accrual
// cadence). For repo / short-term deposits, "monthly" is the correct ACTUS
// cadence approximation.

/**
 * fi:pam:REPO-7D-001 — 7-day repo (sell/buy-back, GMRA 2011).
 *
 * Bank sells securities with agreement to repurchase in 7 days.
 * Structured as a PAM: notional = security value; nominalInterestRate = repo rate;
 * ACT/365 day count per South African money market convention.
 * Product reference: REPO-ZAR-001 (NPA-approved per npa-approvals-seed.ts).
 */
const REPO_7D_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:pam:REPO-7D-001",
  instrumentSubtype: "atomic",
  actusContractType: "PAM",
  productRef: "REPO-ZAR-001",
  issuerLei: "SARB00000000000000001",
  currency: "ZAR",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    nominalInterestRate: 0.0845,
    dayCountConvention: "ACT/365",
    paymentFrequency: "monthly",
  },
};

/**
 * fi:pam:MMD-30D-001 — 30-day money market deposit (bank as taker).
 *
 * Bank takes a 30-day fixed-rate deposit from a counterparty.
 * Structured as a PAM: notional = deposit principal; nominalInterestRate = deposit rate.
 * ACT/365 day count per South African money market convention.
 * Product reference: MMD-ZAR-001 (NPA-approved per npa-approvals-seed.ts).
 */
const MMD_30D_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:pam:MMD-30D-001",
  instrumentSubtype: "atomic",
  actusContractType: "PAM",
  productRef: "MMD-ZAR-001",
  issuerLei: "SARB00000000000000001",
  currency: "ZAR",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    nominalInterestRate: 0.0825,
    dayCountConvention: "ACT/365",
    paymentFrequency: "monthly",
  },
};

/**
 * fi:pam:IBL-1M-001 — 1-month interbank loan, fixed term.
 *
 * Bank places a 1-month fixed-rate loan with an interbank counterparty.
 * Structured as a PAM: notional = loan principal; nominalInterestRate = agreed rate.
 * ACT/365 day count per JIBAR/ZARONIA convention for interbank markets.
 * Product reference: IBL-FT-ZAR-001 (NPA-approved per npa-approvals-seed.ts).
 */
const IBL_1M_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:pam:IBL-1M-001",
  instrumentSubtype: "atomic",
  actusContractType: "PAM",
  productRef: "IBL-FT-ZAR-001",
  issuerLei: "SARB00000000000000001",
  currency: "ZAR",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    nominalInterestRate: 0.083,
    dayCountConvention: "ACT/365",
    paymentFrequency: "monthly",
  },
};

// ---------------------------------------------------------------------------
// CLM instrument — Call Money
// ---------------------------------------------------------------------------
//
// CLM contractTerms mandatory fields (clmContractTermsSchema):
//   baseRate          — decimal, e.g. 0.082 = 8.2%
//   noticePeriosDays  — integer ≥ 0 (note: schema has typo "noticePeriosDays")
//   floatingIndex     — optional: "JIBAR-3M" | "JIBAR-1M" | "ZARONIA" | "PRIME"

/**
 * fi:clm:IBL-CALL-001 — interbank loan, call (demand).
 *
 * Bank places call money with an interbank counterparty, repayable on demand.
 * Structured as a CLM: noticePeriod = 0 (overnight / demand); baseRate = ZARONIA-linked rate.
 * Product reference: IBL-CALL-ZAR-001 (NPA-approved per npa-approvals-seed.ts).
 *
 * Note: `noticePeriosDays` preserves the schema's existing field name typo
 * (clmContractTermsSchema in instrument.ts Slice 5).
 */
const IBL_CALL_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:clm:IBL-CALL-001",
  instrumentSubtype: "atomic",
  actusContractType: "CLM",
  productRef: "IBL-CALL-ZAR-001",
  issuerLei: "SARB00000000000000001",
  currency: "ZAR",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    baseRate: 0.082,
    noticePeriosDays: 0,
    floatingIndex: "ZARONIA",
  },
};

// ---------------------------------------------------------------------------
// Exported arrays
// ---------------------------------------------------------------------------

/**
 * All treasury FinancialInstrumentDefined payloads.
 * Each passes `financialInstrumentDefinedPayloadSchema.parse()`.
 */
export const TREASURY_INSTRUMENT_DEFINED_PAYLOADS: FinancialInstrumentDefinedPayload[] = [
  REPO_7D_DEFINED,
  MMD_30D_DEFINED,
  IBL_1M_DEFINED,
  IBL_CALL_DEFINED,
];
