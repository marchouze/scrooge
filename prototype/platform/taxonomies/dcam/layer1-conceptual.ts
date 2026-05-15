// platform/taxonomies/dcam/layer1-conceptual.ts
//
// DCAM Layer 1 — Conceptual Data Model
// Business concepts anchored to FIBO (EDM Council / OMG) ontology IRIs.
// This is the single source of truth for every business concept used by the bank.
// Physical codes (product scope, risk codes, activity codes) reference these by key.
//
// Key format: "<fiboModule>:<localName>" — stable across FIBO releases.
// The fiboIri may evolve; the key does not.
//
// Author: Atlas (Core banking platform architect, engineering)

import type { FiboModule, SkosMatchType } from "./types";

export interface ConceptualConcept {
  readonly key: string;
  readonly fiboModule: FiboModule;
  readonly fiboIri: string;
  readonly fiboLabel: string;
  readonly skosMatch: SkosMatchType;
  readonly definition?: string;
}

export const CONCEPTUAL_REGISTRY: ReadonlyMap<string, ConceptualConcept> = new Map([
  // Securities — Equities
  [
    "SEC:ListedShare",
    {
      key: "SEC:ListedShare",
      fiboModule: "SEC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/SEC/Equities/EquityInstruments/ListedShare",
      fiboLabel: "Listed Share",
      skosMatch: "exactMatch",
      definition: "An equity security that is traded on a recognised exchange",
    },
  ],
  // Securities — Debt
  [
    "SEC:Bond",
    {
      key: "SEC:Bond",
      fiboModule: "SEC",
      fiboIri: "https://spec.edmcouncil.org/fibo/ontology/SEC/Debt/Bonds/Bond",
      fiboLabel: "Bond",
      skosMatch: "broadMatch",
      definition: "Debt instrument with fixed maturity and coupon obligations",
    },
  ],
  [
    "SEC:ShortTermDebt",
    {
      key: "SEC:ShortTermDebt",
      fiboModule: "SEC",
      fiboIri: "https://spec.edmcouncil.org/fibo/ontology/SEC/Debt/ShortTermDebt/ShortTermDebt",
      fiboLabel: "Short-Term Debt Instrument",
      skosMatch: "exactMatch",
    },
  ],
  // Securities — Financing
  [
    "SEC:RepurchaseAgreement",
    {
      key: "SEC:RepurchaseAgreement",
      fiboModule: "SEC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/SEC/Securities/SecuritiesFinancing/RepurchaseAgreement",
      fiboLabel: "Repurchase Agreement",
      skosMatch: "broadMatch",
      definition:
        "Short-term financing arrangement using securities as collateral; also covers stock lending",
    },
  ],
  // Derivatives
  [
    "DER:InterestRateDerivative",
    {
      key: "DER:InterestRateDerivative",
      fiboModule: "DER",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/DER/RateDerivatives/IRDerivatives/InterestRateDerivative",
      fiboLabel: "Interest Rate Derivative",
      skosMatch: "exactMatch",
      definition: "A derivative whose value is derived from a reference interest rate",
    },
  ],
  [
    "DER:CreditDerivative",
    {
      key: "DER:CreditDerivative",
      fiboModule: "DER",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/DER/CreditDerivatives/CreditDerivatives/CreditDerivative",
      fiboLabel: "Credit Derivative",
      skosMatch: "exactMatch",
    },
  ],
  // Financial Business and Commerce
  [
    "FBC:ForeignExchange",
    {
      key: "FBC:ForeignExchange",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/MarketsAndExchanges/ForeignExchange",
      fiboLabel: "Foreign Exchange",
      skosMatch: "broadMatch",
      definition: "Currency exchange market; covers spot, forward, and swap instruments",
    },
  ],
  [
    "FBC:FinancialServicesProvider",
    {
      key: "FBC:FinancialServicesProvider",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/FinancialServicesEntities/FinancialServicesProvider",
      fiboLabel: "Financial Services Provider",
      skosMatch: "closeMatch",
    },
  ],
  [
    "FBC:Payment",
    {
      key: "FBC:Payment",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/PaymentsAndSchedules/Payments/Payment",
      fiboLabel: "Payment",
      skosMatch: "exactMatch",
    },
  ],
  [
    "FBC:MarketParticipant",
    {
      key: "FBC:MarketParticipant",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/MarketsAndExchanges/MarketParticipant",
      fiboLabel: "Market Participant",
      skosMatch: "closeMatch",
    },
  ],
  [
    "FBC:Exchange",
    {
      key: "FBC:Exchange",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/MarketsAndExchanges/Exchange",
      fiboLabel: "Exchange",
      skosMatch: "closeMatch",
    },
  ],
  [
    "FBC:RegulatoryAgency",
    {
      key: "FBC:RegulatoryAgency",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/RegulatoryAgencies/RegulatoryAgency",
      fiboLabel: "Regulatory Agency",
      skosMatch: "relatedMatch",
    },
  ],
  [
    "FBC:PrudentialRegulator",
    {
      key: "FBC:PrudentialRegulator",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/RegulatoryAgencies/PrudentialRegulator",
      fiboLabel: "Prudential Regulator",
      skosMatch: "broadMatch",
    },
  ],
  [
    "FBC:FinancialService",
    {
      key: "FBC:FinancialService",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/ProductsAndServices/FinancialProductsAndServices/FinancialService",
      fiboLabel: "Financial Service",
      skosMatch: "closeMatch",
    },
  ],
  [
    "FBC:FinancialProduct",
    {
      key: "FBC:FinancialProduct",
      fiboModule: "FBC",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FBC/ProductsAndServices/FinancialProductsAndServices/FinancialProduct",
      fiboLabel: "Financial Product",
      skosMatch: "closeMatch",
    },
  ],
  // Business Entities
  [
    "BE:LegallyCompetentNaturalPerson",
    {
      key: "BE:LegallyCompetentNaturalPerson",
      fiboModule: "BE",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/BE/LegalEntities/LegalPersons/LegallyCompetentNaturalPerson",
      fiboLabel: "Legally Competent Natural Person",
      skosMatch: "exactMatch",
    },
  ],
  [
    "BE:LegalPerson",
    {
      key: "BE:LegalPerson",
      fiboModule: "BE",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/BE/LegalEntities/LegalPersons/LegalPerson",
      fiboLabel: "Legal Person",
      skosMatch: "broadMatch",
    },
  ],
  // Foundations
  [
    "FND:MonetaryAmount",
    {
      key: "FND:MonetaryAmount",
      fiboModule: "FND",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FND/Accounting/CurrencyAmount/MonetaryAmount",
      fiboLabel: "Monetary Amount",
      skosMatch: "exactMatch",
    },
  ],
  [
    "FND:FormalOrganization",
    {
      key: "FND:FormalOrganization",
      fiboModule: "FND",
      fiboIri:
        "https://spec.edmcouncil.org/fibo/ontology/FND/Organizations/FormalOrganizations/FormalOrganization",
      fiboLabel: "Formal Organization",
      skosMatch: "broadMatch",
    },
  ],
]);
