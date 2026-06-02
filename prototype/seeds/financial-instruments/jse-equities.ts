// seeds/financial-instruments/jse-equities.ts
//
// Equity FinancialInstrument seed payloads — JSE-listed ordinary shares.
//
// Four representative JSE Top-40 equities admitted to the bank's instrument
// universe (actusContractType = "STK"):
//   NPN — Naspers          ZAE000015889
//   SOL — Sasol            ZAE000006896
//   SBK — Standard Bank    ZAE000109815
//   MTN — MTN Group        ZAE000042164
//
// Each equity has:
//   - A FinancialInstrumentDefined payload (actusContractType = "STK", with
//     STK contractTerms per stkContractTermsSchema from instrument.ts Slice 5).
//   - A FinancialInstrumentClassified payload:
//       hqlaLevel       = "non-hqla"  (ordinary equities do not qualify as HQLA
//                                      unless they meet the narrow LCR §2b
//                                      equity-inclusion criteria; default non-hqla).
//       baselRiskWeight = "100pct"    (equity holdings in the banking book,
//                                      RRB Regulation 23 standardised treatment).
//       ifrs9Category   = "fvtpl"     (held for trading; MTM through P&L,
//                                      IFRS 9 §4.1.4).
//       saCcrAssetClass = "n-a"       (cash equities are not derivatives).
//
// These payloads are exported as typed arrays. They do NOT emit events directly —
// the seed runner (scripts/seed-financial-instruments.ts) calls
// makeFinancialInstrumentDefined / makeFinancialInstrumentClassified with them.
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
//   ACTUS-FRF-V1.1 §STK — Stock contract-type standard.
//   JSE-RULES-EQUITIES — JSE Listings Requirements; ordinary-share conventions.
//   IFRS-9-§4.1 — classification and measurement (§4.1.4 held-for-trading FVTPL).
//   RRB-REG-23 — Banks Act Regulation 23 SA standardised risk weights.
//
// Author: Kai (Trading Systems Engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

import type {
  FinancialInstrumentClassifiedPayload,
  FinancialInstrumentDefinedPayload,
} from "../../platform/markets/cdm/instrument";

// ---------------------------------------------------------------------------
// FinancialInstrumentDefined payloads — JSE equities
// ---------------------------------------------------------------------------

// CFI code ESVUFR: E=Equity, S=common/ordinary share, V=voting, U=free
// (no ownership restrictions), F=fully paid, R=registered. ISO 10962.
const EQUITY_CFI = "ESVUFR";

const NPN_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:equity:JSE:NPN",
  instrumentSubtype: "atomic",
  actusContractType: "STK",
  isin: "ZAE000015889",
  cfiCode: EQUITY_CFI,
  currency: "ZAR",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    dividendFrequency: "annual",
    exchange: "JSE",
  },
};

const SOL_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:equity:JSE:SOL",
  instrumentSubtype: "atomic",
  actusContractType: "STK",
  isin: "ZAE000006896",
  cfiCode: EQUITY_CFI,
  currency: "ZAR",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    dividendFrequency: "semi-annual",
    exchange: "JSE",
  },
};

const SBK_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:equity:JSE:SBK",
  instrumentSubtype: "atomic",
  actusContractType: "STK",
  isin: "ZAE000109815",
  cfiCode: EQUITY_CFI,
  currency: "ZAR",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    dividendFrequency: "semi-annual",
    exchange: "JSE",
  },
};

const MTN_DEFINED: FinancialInstrumentDefinedPayload = {
  instrumentId: "fi:equity:JSE:MTN",
  instrumentSubtype: "atomic",
  actusContractType: "STK",
  isin: "ZAE000042164",
  cfiCode: EQUITY_CFI,
  currency: "ZAR",
  jurisdiction: "ZA",
  legalEntityId: "LE-ZA-HOZ-BANK",
  contractTerms: {
    dividendFrequency: "semi-annual",
    exchange: "JSE",
  },
};

/**
 * All four JSE equity FinancialInstrumentDefined payloads.
 * Each passes `financialInstrumentDefinedPayloadSchema.parse()`.
 */
export const JSE_EQUITY_DEFINED_PAYLOADS: FinancialInstrumentDefinedPayload[] = [
  NPN_DEFINED,
  SOL_DEFINED,
  SBK_DEFINED,
  MTN_DEFINED,
];

// ---------------------------------------------------------------------------
// FinancialInstrumentClassified payloads — JSE equities
// ---------------------------------------------------------------------------

const EQUITY_CLASSIFICATION_COMMON = {
  hqlaLevel: "non-hqla" as const,
  baselRiskWeight: "100pct" as const,
  ifrs9Category: "fvtpl" as const,
  saCcrAssetClass: "n-a" as const,
  classifiedBy: "Kai (Trading Systems Engineer, engineering)",
  effectiveDate: "2026-05-22",
  rationale:
    "JSE-listed ordinary equities held for trading: classified FVTPL under IFRS 9 §4.1.4 (MTM through P&L), 100% Basel III standardised risk weight (RRB Regulation 23), non-HQLA (do not meet the narrow LCR equity-inclusion criteria). Cash equities are not derivatives, so SA-CCR does not apply.",
};

export const JSE_EQUITY_CLASSIFIED_PAYLOADS: FinancialInstrumentClassifiedPayload[] = [
  { instrumentId: "fi:equity:JSE:NPN", ...EQUITY_CLASSIFICATION_COMMON },
  { instrumentId: "fi:equity:JSE:SOL", ...EQUITY_CLASSIFICATION_COMMON },
  { instrumentId: "fi:equity:JSE:SBK", ...EQUITY_CLASSIFICATION_COMMON },
  { instrumentId: "fi:equity:JSE:MTN", ...EQUITY_CLASSIFICATION_COMMON },
];
