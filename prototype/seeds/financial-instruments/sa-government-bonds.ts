// seeds/financial-instruments/sa-government-bonds.ts
//
// Bond FinancialInstrument seed payloads — SA government bonds (Slice 10).
//
// Three representative SA government bonds admitted to the bank's instrument
// universe:
//   R186  — ZAG000030108  10.5%  due 2026-12-21  (benchmark 5Y)
//   R2030 — ZAG000057547   7.75% due 2030-01-31
//   R2040 — ZAG000074989   9.0%  due 2040-01-31  (long end)
//
// Each bond has:
//   - A FinancialInstrumentDefined payload (actusContractType = "PAM", with
//     PAM contractTerms per pamContractTermsSchema from instrument.ts Slice 5).
//   - A FinancialInstrumentClassified payload:
//       hqlaLevel     = "level-1"   (SA sovereign bonds qualify as Level 1 HQLA
//                                    per BA 325 §42; 0% risk-weight domestic-currency
//                                    sovereign meets level-1 criteria).
//       baselRiskWeight = "0pct"    (sovereign domestic-currency, 0% RW per
//                                    RRB Regulation 23 / BCBS SA Table 1).
//       ifrs9Category = "fvtoci"   (held-to-collect-and-sell; typical for bond
//                                    portfolio; OCI recycled on disposal,
//                                    IFRS 9 §4.1.2A).
//       saCcrAssetClass = "n-a"    (bonds are not derivatives; SA-CCR not applicable).
//
// These payloads are exported as typed arrays. They do NOT emit events directly —
// the boot script (or a seed runner) calls makeFinancialInstrumentDefined /
// makeFinancialInstrumentClassified with these payloads.
//
// All three FinancialInstrumentDefined payloads pass
//   financialInstrumentDefinedPayloadSchema.parse()
// All three FinancialInstrumentClassified payloads pass
//   financialInstrumentClassifiedPayloadSchema.parse()
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) Slice 10.
//   ACTUS-FRF-V1.1 §PAM — Principal at Maturity contract-type standard.
//   BA-325 §42–§54 — HQLA tiering under Basel III LCR implementation (SA).
//   RRB-REG-23 — Banks Act Regulation 23 SA standardised risk weights.
//   IFRS-9-§4.1 — classification and measurement; §4.1.2A FVTOCI criteria.
//   JSE-RULES-BONDS — JSE Debt Listings Requirements; ACT/365 day-count;
//     semi-annual coupon convention for SA government bonds.
//
// Author: Eitan (IRRBB / derivatives engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY Slice 10 (CEO-approved 2026-05-22).

import type {
  FinancialInstrumentClassifiedPayload,
  FinancialInstrumentDefinedPayload,
} from "../../platform/markets/cdm/instrument";

// ---------------------------------------------------------------------------
// FinancialInstrumentDefined payloads — SA government bonds
// ---------------------------------------------------------------------------

/**
 * R186 — Republic of South Africa bond, 10.5% coupon, maturing 2026-12-21.
 * ISIN: ZAG000030108. This is the benchmark 5-year (at issuance) SA government
 * bond traded on the JSE. ACTUS contract type PAM (Principal at Maturity) —
 * fixed coupon, semi-annual payments, ACT/365 day-count.
 */
const R186_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:bond:ZAG000030108",
  instrumentSubtype: "decomposable",
  actusContractType: "PAM",
  isin: "ZAG000030108",
  cfiCode: "DBFUFR",
  issuerLei: "ZA-GOVT-LEI",
  currency: "ZAR",
  maturityDate: "2026-12-21",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    nominalInterestRate: 0.105,
    dayCountConvention: "ACT/365",
    paymentFrequency: "semi-annual",
  },
};

/**
 * R2030 — Republic of South Africa bond, 7.75% coupon, maturing 2030-01-31.
 * ISIN: ZAG000057547. Mid-curve SA government benchmark.
 */
const R2030_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:bond:ZAG000057547",
  instrumentSubtype: "decomposable",
  actusContractType: "PAM",
  isin: "ZAG000057547",
  cfiCode: "DBFUFR",
  issuerLei: "ZA-GOVT-LEI",
  currency: "ZAR",
  maturityDate: "2030-01-31",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    nominalInterestRate: 0.0775,
    dayCountConvention: "ACT/365",
    paymentFrequency: "semi-annual",
  },
};

/**
 * R2040 — Republic of South Africa bond, 9.0% coupon, maturing 2040-01-31.
 * ISIN: ZAG000074989. Long-end SA government benchmark; used for IRRBB
 * duration gap and NSFR stable-funding modelling.
 */
const R2040_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:bond:ZAG000074989",
  instrumentSubtype: "decomposable",
  actusContractType: "PAM",
  isin: "ZAG000074989",
  cfiCode: "DBFUFR",
  issuerLei: "ZA-GOVT-LEI",
  currency: "ZAR",
  maturityDate: "2040-01-31",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    nominalInterestRate: 0.09,
    dayCountConvention: "ACT/365",
    paymentFrequency: "semi-annual",
  },
};

/**
 * All three SA government bond FinancialInstrumentDefined payloads.
 * Each passes `financialInstrumentDefinedPayloadSchema.parse()`.
 */
export const SA_GOVERNMENT_BOND_DEFINED_PAYLOADS: FinancialInstrumentDefinedPayload[] = [
  R186_DEFINED,
  R2030_DEFINED,
  R2040_DEFINED,
];

// ---------------------------------------------------------------------------
// FinancialInstrumentClassified payloads — SA government bonds
// ---------------------------------------------------------------------------
//
// SA government bonds in domestic currency (ZAR) qualify as:
//   hqlaLevel     = "level-1"    — BA 325 §42: central-government securities
//     in domestic currency, 0% risk-weight, meet Level-1 criteria without
//     haircut adjustment; same treatment as SARB reserves for LCR buffer.
//   baselRiskWeight = "0pct"     — RRB Regulation 23 / Basel III SA Table 1:
//     sovereign claims in domestic currency, 0% standardised risk weight.
//   ifrs9Category = "fvtoci"    — IFRS 9 §4.1.2A: held-to-collect-and-sell;
//     MTM in OCI; gains/losses recycled to P&L on disposal. Typical for a
//     bank bond portfolio; alternative is amortised-cost (§4.1.2) if
//     held-to-collect only.
//   saCcrAssetClass = "n-a"      — not a derivative; SA-CCR does not apply.

const BOND_CLASSIFICATION_COMMON = {
  hqlaLevel: "level-1" as const,
  baselRiskWeight: "0pct" as const,
  ifrs9Category: "fvtoci" as const,
  saCcrAssetClass: "n-a" as const,
  classifiedBy: "Eitan (IRRBB / derivatives engineer, engineering)",
  effectiveDate: "2026-05-22",
  rationale:
    "SA government bonds denominated in ZAR qualify as Level-1 HQLA (BA 325 §42), carry 0% Basel III standardised risk weight (RRB Regulation 23), and are classified as FVTOCI under IFRS 9 §4.1.2A for the held-to-collect-and-sell bond portfolio. SA-CCR does not apply to non-derivative instruments.",
};

const R186_CLASSIFIED: FinancialInstrumentClassifiedPayload = {
  instrumentId: "fi:bond:ZAG000030108",
  ...BOND_CLASSIFICATION_COMMON,
};

const R2030_CLASSIFIED: FinancialInstrumentClassifiedPayload = {
  instrumentId: "fi:bond:ZAG000057547",
  ...BOND_CLASSIFICATION_COMMON,
};

const R2040_CLASSIFIED: FinancialInstrumentClassifiedPayload = {
  instrumentId: "fi:bond:ZAG000074989",
  ...BOND_CLASSIFICATION_COMMON,
};

/**
 * All three SA government bond FinancialInstrumentClassified payloads.
 * Each passes `financialInstrumentClassifiedPayloadSchema.parse()`.
 */
export const SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS: FinancialInstrumentClassifiedPayload[] = [
  R186_CLASSIFIED,
  R2030_CLASSIFIED,
  R2040_CLASSIFIED,
];
