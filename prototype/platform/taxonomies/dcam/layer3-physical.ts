// platform/taxonomies/dcam/layer3-physical.ts
//
// DCAM Layer 3 — Physical Data Model
// Maps the bank's physical taxonomy codes to:
//   - Layer 1 concept keys (conceptKey → CONCEPTUAL_REGISTRY key)
//   - ISO 20022 message type mappings (physical message format)
//
// The bank's code strings (e.g. "equity-securities") are the Layer 3 identifiers.
// They do NOT embed Layer 1 or Layer 2 data — they reference by key.
// Cross-layer assembly is performed by assembly functions in the parent index.ts.
//
// Author: Atlas (Core banking platform architect, engineering)

export interface PhysicalProductMapping {
  readonly conceptKey?: string; // → CONCEPTUAL_REGISTRY key (Layer 1 reference)
  readonly iso20022?: ReadonlyArray<{
    readonly messageType: string;
    readonly label: string;
    readonly notes?: string;
  }>;
}

export const PHYSICAL_PRODUCT_SCOPE: Readonly<Record<string, PhysicalProductMapping>> = {
  "equity-securities": {
    conceptKey: "SEC:ListedShare",
    iso20022: [
      { messageType: "sese.023", label: "Securities Settlement Instruction" },
      { messageType: "seev.036", label: "Corporate Action Instruction" },
    ],
  },
  "debt-securities": {
    conceptKey: "SEC:Bond",
    iso20022: [{ messageType: "sese.023", label: "Securities Settlement Instruction" }],
  },
  "money-market-instruments": {
    conceptKey: "SEC:ShortTermDebt",
    iso20022: [{ messageType: "sese.023", label: "Securities Settlement Instruction" }],
  },
  "interest-rate-derivatives": {
    conceptKey: "DER:InterestRateDerivative",
    iso20022: [
      {
        messageType: "auth.001",
        label: "EMIR Trade Report",
        notes: "Mandatory for OTC IRD with EU counterparties",
      },
      {
        messageType: "sese.023",
        label: "Securities Settlement Instruction",
        notes: "For physically-settled OTC",
      },
    ],
  },
  "fx-instruments": {
    conceptKey: "FBC:ForeignExchange",
    iso20022: [
      { messageType: "fxtr.014", label: "FX Trade Instruction" },
      {
        messageType: "auth.001",
        label: "EMIR Trade Report",
        notes: "NDF / FX forward if EU counterparty",
      },
    ],
  },
  "securities-financing": {
    conceptKey: "SEC:RepurchaseAgreement",
    iso20022: [
      { messageType: "sese.023", label: "Securities Settlement Instruction" },
      { messageType: "auth.001", label: "EMIR Trade Report", notes: "SFT reporting under SFTR" },
    ],
  },
  "multi-asset": {
    // No conceptual anchor — internal catch-all
  },
};

// Risk L1 code → conceptual key + per-code BCBS ref override
export const PHYSICAL_RISK_L1: Readonly<Record<string, { conceptKey: string; bcbsRef?: string }>> =
  {
    "RT-CR": {
      conceptKey: "FBC:MarketParticipant",
      bcbsRef: "https://www.bis.org/bcbs/publ/d457.htm#credit-risk",
    },
    "RT-MK": {
      conceptKey: "FBC:MarketParticipant",
      bcbsRef: "https://www.bis.org/bcbs/publ/d352.htm",
    },
    "RT-LQ": {
      conceptKey: "FBC:MarketParticipant",
      bcbsRef: "https://www.bis.org/bcbs/publ/d457.htm#liquidity-risk",
    },
    "RT-OP": {
      conceptKey: "FBC:MarketParticipant",
      bcbsRef: "https://www.bis.org/bcbs/publ/d457.htm#operational-risk",
    },
    "RT-IRRBB": {
      conceptKey: "FBC:MarketParticipant",
      bcbsRef: "https://www.bis.org/bcbs/publ/d368.htm",
    },
    "RT-CD": { conceptKey: "FBC:FinancialServicesProvider" },
    "RT-FC": { conceptKey: "FBC:FinancialServicesProvider" },
    "RT-LR": { conceptKey: "FBC:RegulatoryAgency" },
    // RT-ST, RT-RP, RT-CL — no conceptual anchor (internal strategic/reputational/climate classifications)
  };

// Domain code → conceptual key
export const PHYSICAL_DOMAIN: Readonly<Record<string, { conceptKey: string }>> = {
  "A-PRUDENTIAL": { conceptKey: "FBC:PrudentialRegulator" },
  "B-FINANCIAL-CRIME": { conceptKey: "FBC:FinancialServicesProvider" },
  "C-FAIS": { conceptKey: "FBC:FinancialServicesProvider" },
  "D-MARKET-CONDUCT": { conceptKey: "FBC:FinancialProduct" },
  "F-GOVERNANCE": { conceptKey: "FND:FormalOrganization" },
  "G-REPORTING": { conceptKey: "FBC:RegulatoryAgency" },
  "H-OPERATIONAL": { conceptKey: "FBC:MarketParticipant" },
  "I-TREASURY": { conceptKey: "FBC:MarketParticipant" },
  "J-MARKET-INFRASTRUCTURE": { conceptKey: "FBC:Exchange" },
  // E-CYBER — no FIBO anchor (NIST/ISO 27001 domain)
};

// Activity code → conceptual key + optional ISO 20022 messages
export const PHYSICAL_ACTIVITY: Readonly<Record<string, PhysicalProductMapping>> = {
  "ACT-TRADE-FX": {
    conceptKey: "FBC:ForeignExchange",
    iso20022: [{ messageType: "fxtr.014", label: "FX Trade Instruction" }],
  },
  "ACT-TRADE-BOND": {
    conceptKey: "SEC:Bond",
    iso20022: [{ messageType: "sese.023", label: "Securities Settlement Instruction" }],
  },
  "ACT-TRADE-EQUITY": {
    conceptKey: "SEC:ListedShare",
    iso20022: [{ messageType: "sese.023", label: "Securities Settlement Instruction" }],
  },
  "ACT-TRADE-OTC-IRD": {
    conceptKey: "DER:InterestRateDerivative",
    iso20022: [
      { messageType: "auth.001", label: "EMIR Trade Report" },
      {
        messageType: "sese.023",
        label: "Settlement Instruction",
        notes: "Physically-settled only",
      },
    ],
  },
  "ACT-TRADE-OTC-CREDIT": {
    conceptKey: "DER:CreditDerivative",
    iso20022: [{ messageType: "auth.001", label: "EMIR Trade Report" }],
  },
  "ACT-BANK-PAYMENT": {
    conceptKey: "FBC:Payment",
    iso20022: [
      { messageType: "pacs.008", label: "FI Credit Transfer" },
      { messageType: "pain.001", label: "Credit Transfer Initiation" },
    ],
  },
  "ACT-BANK-NOSTRO": {
    iso20022: [
      { messageType: "camt.053", label: "Bank Account Statement" },
      { messageType: "camt.052", label: "Intraday Liquidity Report" },
    ],
  },
  "ACT-REPORT-TRADE": {
    conceptKey: "FBC:RegulatoryAgency",
    iso20022: [{ messageType: "auth.001", label: "EMIR / SFTR Trade Report" }],
  },
  "ACT-RISK-CAPITAL": { conceptKey: "FND:MonetaryAmount" },
  "ACT-CLIENT-ADVICE": { conceptKey: "FBC:FinancialService" },
  "ACT-CLIENT-ONBOARD": { conceptKey: "BE:LegalPerson" },
};

// Party kind → conceptual key
export const PHYSICAL_PARTY_KIND: Readonly<Record<string, { conceptKey: string } | null>> = {
  "natural-person": { conceptKey: "BE:LegallyCompetentNaturalPerson" },
  "legal-entity": { conceptKey: "BE:LegalPerson" },
  agent: null, // Bank-specific AI persona — no FIBO or industry equivalent
};
