// seeds/financial-instruments/zar-irs.ts
//
// Interest-rate-swap FinancialInstrument seed payloads — ZAR vanilla IRS
// templates (actusContractType = "IRS", instrumentSubtype = "compositional").
//
// Two representative single-currency ZAR interest-rate swaps:
//   fi:irs:ZAR-5Y-JIBAR3M-001  — 5Y, bank pays fixed 8.5% vs JIBAR-3M, quarterly.
//   fi:irs:ZAR-10Y-ZARONIA-001 — 10Y, bank pays floating ZARONIA vs fixed 9.2%, quarterly.
//
// IRS instruments are *compositional* — the fixed and floating legs only make
// sense as a pair and are not independently tradeable (instrument.ts §subtype).
//
// Each swap has:
//   - A FinancialInstrumentDefined payload (IRS contractTerms per
//     irsContractTermsSchema: fixedRate, floatingIndex, bankPays,
//     paymentFrequency, dayCountConvention).
//   - A FinancialInstrumentClassified payload:
//       hqlaLevel       = "non-hqla"     (derivatives are never HQLA).
//       baselRiskWeight = "100pct"       (counterparty placeholder; capital is
//                                         driven by SA-CCR EAD, not a flat RW).
//       ifrs9Category   = "fvtpl"        (derivatives are FVTPL, IFRS 9 §4.1.4).
//       saCcrAssetClass = "interest-rate" (SA-CCR IR asset class, BCBS 279 §6).
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
//   ACTUS-FRF-V1.1 §IRS — Interest Rate Swap contract-type standard.
//   IFRS-9-§4.1 — derivatives measured FVTPL (§4.1.4).
//   BCBS-279 — SA-CCR; interest-rate asset class for derivative EAD.
//
// Author: Eitan (IRRBB / derivatives engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

import type {
  FinancialInstrumentClassifiedPayload,
  FinancialInstrumentDefinedPayload,
} from "../../platform/markets/cdm/instrument";

// ---------------------------------------------------------------------------
// FinancialInstrumentDefined payloads — ZAR vanilla IRS
// ---------------------------------------------------------------------------

const IRS_5Y_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:irs:ZAR-5Y-JIBAR3M-001",
  instrumentSubtype: "compositional",
  actusContractType: "IRS",
  currency: "ZAR",
  maturityDate: "2031-06-02",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    fixedRate: 0.085,
    floatingIndex: "JIBAR-3M",
    bankPays: "fixed",
    paymentFrequency: "quarterly",
    dayCountConvention: "ACT/365",
  },
};

const IRS_10Y_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:irs:ZAR-10Y-ZARONIA-001",
  instrumentSubtype: "compositional",
  actusContractType: "IRS",
  currency: "ZAR",
  maturityDate: "2036-06-02",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    fixedRate: 0.092,
    floatingIndex: "ZARONIA",
    bankPays: "floating",
    paymentFrequency: "quarterly",
    dayCountConvention: "ACT/365",
  },
};

/**
 * All ZAR IRS FinancialInstrumentDefined payloads.
 * Each passes `financialInstrumentDefinedPayloadSchema.parse()`.
 */
export const ZAR_IRS_DEFINED_PAYLOADS: FinancialInstrumentDefinedPayload[] = [
  IRS_5Y_DEFINED,
  IRS_10Y_DEFINED,
];

// ---------------------------------------------------------------------------
// FinancialInstrumentClassified payloads — ZAR vanilla IRS
// ---------------------------------------------------------------------------

const IRS_CLASSIFICATION_COMMON = {
  hqlaLevel: "non-hqla" as const,
  baselRiskWeight: "100pct" as const,
  ifrs9Category: "fvtpl" as const,
  saCcrAssetClass: "interest-rate" as const,
  classifiedBy: "Eitan (IRRBB / derivatives engineer, engineering)",
  effectiveDate: "2026-05-22",
  rationale:
    "Single-currency ZAR vanilla interest-rate swaps: FVTPL under IFRS 9 §4.1.4 (derivatives), non-HQLA, SA-CCR interest-rate asset class for derivative EAD (BCBS 279 §6). The 100% standardised risk weight is a placeholder — derivative capital is driven by SA-CCR exposure-at-default, not a flat balance-sheet risk weight.",
};

export const ZAR_IRS_CLASSIFIED_PAYLOADS: FinancialInstrumentClassifiedPayload[] = [
  { instrumentId: "fi:irs:ZAR-5Y-JIBAR3M-001", ...IRS_CLASSIFICATION_COMMON },
  { instrumentId: "fi:irs:ZAR-10Y-ZARONIA-001", ...IRS_CLASSIFICATION_COMMON },
];
