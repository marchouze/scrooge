// platform/taxonomies/dcam/layer2-logical.ts
//
// DCAM Layer 2 — Logical Data Model
// Maps Layer 1 concept keys to industry-standard logical representations:
//   CDM      — ISDA/ICMA Common Domain Model (trade lifecycle)
//   ESMA-CFI — ISO 10962 Classification of Financial Instruments
//   ISO17442 — Legal Entity Identifier (LEI)
//   BCBS     — Basel Committee on Banking Supervision
//   FATF     — Financial Action Task Force
//
// A single concept may have multiple logical representations.
// All entries reference a `conceptKey` from CONCEPTUAL_REGISTRY.
//
// Author: Atlas (Core banking platform architect, engineering)

import type { LogicalStandard, SkosMatchType } from "../index";

export interface LogicalMapping {
  readonly conceptKey: string;
  readonly standard: LogicalStandard;
  readonly ref: string;
  readonly label: string;
  readonly skosMatch: SkosMatchType;
  readonly notes?: string;
}

export const LOGICAL_MAPPINGS: ReadonlyArray<LogicalMapping> = [
  // Equity securities
  {
    conceptKey: "SEC:ListedShare",
    standard: "CDM",
    ref: "cdm.base.staticdata.asset.common.EquityTypeEnum.EQUITY",
    label: "CDM Equity",
    skosMatch: "exactMatch",
  },
  {
    conceptKey: "SEC:ListedShare",
    standard: "ESMA-CFI",
    ref: "ES",
    label: "Equities, Shares (ISO 10962 CFI)",
    skosMatch: "broadMatch",
  },
  // Debt securities
  {
    conceptKey: "SEC:Bond",
    standard: "CDM",
    ref: "cdm.base.staticdata.asset.common.DebtClassEnum.BOND",
    label: "CDM Bond",
    skosMatch: "broadMatch",
  },
  {
    conceptKey: "SEC:Bond",
    standard: "ESMA-CFI",
    ref: "DB",
    label: "Debt, Bonds (ISO 10962 CFI)",
    skosMatch: "broadMatch",
  },
  // Money market
  {
    conceptKey: "SEC:ShortTermDebt",
    standard: "ESMA-CFI",
    ref: "MM",
    label: "Money Market Instruments (ISO 10962 CFI)",
    skosMatch: "broadMatch",
  },
  // Securities financing
  {
    conceptKey: "SEC:RepurchaseAgreement",
    standard: "CDM",
    ref: "cdm.product.repo.RepurchaseAgreement",
    label: "CDM Repo",
    skosMatch: "closeMatch",
  },
  {
    conceptKey: "SEC:RepurchaseAgreement",
    standard: "ESMA-CFI",
    ref: "RF",
    label: "Repurchase Agreements (ISO 10962 CFI)",
    skosMatch: "broadMatch",
  },
  // Interest rate derivatives
  {
    conceptKey: "DER:InterestRateDerivative",
    standard: "CDM",
    ref: "cdm.product.asset.InterestRatePayout",
    label: "CDM Interest Rate Payout",
    skosMatch: "exactMatch",
  },
  {
    conceptKey: "DER:InterestRateDerivative",
    standard: "ESMA-CFI",
    ref: "SR",
    label: "Swaps, Interest Rate (ISO 10962 CFI)",
    skosMatch: "closeMatch",
  },
  {
    conceptKey: "DER:InterestRateDerivative",
    standard: "BCBS",
    ref: "https://www.bis.org/bcbs/publ/d352.htm",
    label: "FRTB Market Risk — Interest Rate",
    skosMatch: "relatedMatch",
  },
  // Credit derivatives
  {
    conceptKey: "DER:CreditDerivative",
    standard: "CDM",
    ref: "cdm.product.asset.CreditDefaultPayout",
    label: "CDM Credit Default Payout",
    skosMatch: "exactMatch",
  },
  // FX
  {
    conceptKey: "FBC:ForeignExchange",
    standard: "CDM",
    ref: "cdm.product.asset.FxSingle",
    label: "CDM FX Single",
    skosMatch: "closeMatch",
  },
  {
    conceptKey: "FBC:ForeignExchange",
    standard: "ESMA-CFI",
    ref: "FF",
    label: "Forwards, Foreign Exchange (ISO 10962 CFI)",
    skosMatch: "broadMatch",
  },
  // Risk — credit
  {
    conceptKey: "FBC:MarketParticipant",
    standard: "BCBS",
    ref: "https://www.bis.org/bcbs/publ/d457.htm#credit-risk",
    label: "Basel III Credit Risk",
    skosMatch: "exactMatch",
    notes: "Used for RT-CR",
  },
  // Risk — market
  {
    conceptKey: "FBC:MarketParticipant",
    standard: "BCBS",
    ref: "https://www.bis.org/bcbs/publ/d352.htm",
    label: "FRTB Market Risk",
    skosMatch: "exactMatch",
    notes: "Used for RT-MK",
  },
  // Risk — liquidity
  {
    conceptKey: "FBC:MarketParticipant",
    standard: "BCBS",
    ref: "https://www.bis.org/bcbs/publ/d457.htm#liquidity-risk",
    label: "Basel III Liquidity Risk (LCR/NSFR)",
    skosMatch: "exactMatch",
    notes: "Used for RT-LQ",
  },
  // Risk — operational
  {
    conceptKey: "FBC:MarketParticipant",
    standard: "BCBS",
    ref: "https://www.bis.org/bcbs/publ/d457.htm#operational-risk",
    label: "Basel III Operational Risk",
    skosMatch: "exactMatch",
    notes: "Used for RT-OP",
  },
  // Risk — IRRBB
  {
    conceptKey: "FBC:MarketParticipant",
    standard: "BCBS",
    ref: "https://www.bis.org/bcbs/publ/d368.htm",
    label: "Basel IRRBB Standard",
    skosMatch: "exactMatch",
    notes: "Used for RT-IRRBB",
  },
  // Financial crime
  {
    conceptKey: "FBC:FinancialServicesProvider",
    standard: "FATF",
    ref: "https://www.fatf-gafi.org/en/topics/financial-crime.html",
    label: "FATF Financial Crime Framework",
    skosMatch: "closeMatch",
    notes: "Used for RT-FC, B-FINANCIAL-CRIME",
  },
  // Party — legal entity
  {
    conceptKey: "BE:LegalPerson",
    standard: "ISO17442",
    ref: "https://www.gleif.org/en/about-lei/introducing-the-legal-entity-identifier-lei",
    label: "Legal Entity Identifier (LEI)",
    skosMatch: "exactMatch",
    notes: "Required for EMIR/SFTR reporting with EU counterparties",
  },
];

/** Look up all logical mappings for a concept key. */
export function getLogicalMappings(conceptKey: string): ReadonlyArray<LogicalMapping> {
  return LOGICAL_MAPPINGS.filter((m) => m.conceptKey === conceptKey);
}
