// platform/taxonomies/index.ts
//
// Canonical taxonomy module — bundles all four classification hierarchies
// used across the obligations register, regulatory concepts, risk management,
// and product scope definitions.
//
// Four taxonomies:
//   1. Risk taxonomy (hierarchical L1/L2/L3) — Helena (Chief Risk Officer, governance)
//   2. Activity taxonomy (grouped codes)     — Atlas (Core banking platform architect, engineering)
//   3. Domain taxonomy (10 obligation domains) — Mira (Compliance / RegTech engineer, engineering)
//   4. Product scope (7 product codes)        — Atlas (Core banking platform architect, engineering)
//
// Principle 2 (single-graph discipline): every taxonomy node is a
// stable-code entry; obligations, policies, and risk records cite the
// code — the label is a derived render, never the canonical key.
//
// DCAM alignment (EDM Council DCAM framework — three-layer architecture):
//   Layer 1 Conceptual: FIBO ontological anchors (what concepts ARE)
//   Layer 2 Logical:    CDM, ESMA-CFI, BCBS, FATF (how concepts are MODELED)
//   Layer 3 Physical:   ISO 20022 message types + bank's own code strings
//
// Author: Atlas (Core banking platform architect, engineering)

// ---------------------------------------------------------------------------
// DCAM alignment type system
// EDM Council DCAM framework: three-layer architecture
// ---------------------------------------------------------------------------

export type SkosMatchType =
  | "exactMatch"
  | "closeMatch"
  | "broadMatch"
  | "narrowMatch"
  | "relatedMatch";

export type FiboModule =
  | "FND"   // Foundations (amounts, dates, jurisdictions, parties)
  | "BE"    // Business Entities (corporations, legal persons)
  | "FBC"   // Financial Business and Commerce (market participants, services)
  | "SEC"   // Securities (equities, debt, funds)
  | "DER"   // Derivatives (IR, FX, credit, equity derivatives)
  | "IND"   // Indices and Indicators (benchmarks, rates)
  | "BP"    // Business Processes (trading, settlement, clearing)
  | "LOAN"; // Loans (credit facilities)

/** Layer 1 — Conceptual: FIBO ontological anchor. Defines what the concept IS. */
export interface ConceptualLayer {
  readonly fiboModule: FiboModule;
  readonly fiboIri: string;
  readonly fiboLabel: string;
  readonly skosMatch: SkosMatchType;
  readonly definition?: string;
  readonly notes?: string;
}

export type LogicalStandard =
  | "CDM"       // ISDA/ICMA Common Domain Model — trade lifecycle data model
  | "ESMA-CFI"  // ISO 10962 Classification of Financial Instruments
  | "ISO17442"  // Legal Entity Identifier (LEI)
  | "BCBS"      // Basel Committee on Banking Supervision
  | "FATF";     // Financial Action Task Force

/** Layer 2 — Logical: Industry data models and classification standards. */
export interface LogicalLayer {
  readonly standard: LogicalStandard;
  readonly ref: string;
  readonly label: string;
  readonly skosMatch: SkosMatchType;
  readonly notes?: string;
}

export type PhysicalStandard = "ISO20022";

/** Layer 3 — Physical: Message formats. The node's own `code` is also Layer 3. */
export interface PhysicalLayer {
  readonly standard: PhysicalStandard;
  readonly messageType: string;
  readonly label: string;
  readonly notes?: string;
}

/** DCAM three-layer alignment record for a taxonomy node. */
export interface DcamAlignment {
  readonly conceptual?: ConceptualLayer;
  readonly logical?: ReadonlyArray<LogicalLayer>;
  readonly physical?: ReadonlyArray<PhysicalLayer>;
}

// ---------------------------------------------------------------------------
// Re-exports — Risk taxonomy
// ---------------------------------------------------------------------------

export type { RiskTaxonomyCode, RiskTaxonomyNode } from "../risk/taxonomy";
export { RISK_TAXONOMY } from "../risk/taxonomy";

// ---------------------------------------------------------------------------
// Re-exports — Activity taxonomy
// ---------------------------------------------------------------------------

export type { ActivityCode } from "../activities/taxonomy";
export {
  ACTIVITY_CODES,
  ACTIVITY_GROUPS,
  ACTIVITY_LABELS,
} from "../activities/taxonomy";

// ---------------------------------------------------------------------------
// Domain taxonomy — ten obligation-domain codes.
// Canonical authoring location: this file. The obligations register
// (`Regulations/_obligations-register.md`) derives from these codes.
// Owner: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO).
// ---------------------------------------------------------------------------

export interface DomainTaxonomyNode {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly dcamAlignment?: DcamAlignment;
}

export const DOMAIN_TAXONOMY: ReadonlyArray<DomainTaxonomyNode> = [
  {
    code: "A-PRUDENTIAL",
    label: "Prudential Regulation",
    description: "Capital adequacy, liquidity, ICAAP, ILAAP, recovery planning",
    dcamAlignment: {
      conceptual: {
        fiboModule: "FBC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/RegulatoryAgencies/PrudentialRegulator",
        fiboLabel: "Prudential Regulator",
        skosMatch: "broadMatch",
      },
    },
  },
  {
    code: "B-FINANCIAL-CRIME",
    label: "Financial Crime",
    description: "AML, sanctions, POCA, FIC Act, FATF",
    dcamAlignment: {
      logical: [
        {
          standard: "FATF",
          ref: "https://www.fatf-gafi.org/en/topics/fatf-recommendations.html",
          label: "FATF 40 Recommendations",
          skosMatch: "closeMatch",
        },
      ],
    },
  },
  {
    code: "C-FAIS",
    label: "Financial Advisory and Intermediary Services",
    description: "FSP licensing, fit-and-proper, conduct under FAIS Act",
    dcamAlignment: {
      conceptual: {
        fiboModule: "FBC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/FinancialServicesEntities/FinancialServicesProvider",
        fiboLabel: "Financial Services Provider",
        skosMatch: "closeMatch",
      },
    },
  },
  {
    code: "D-MARKET-CONDUCT",
    label: "Market Conduct",
    description: "FSCA conduct, TCF, market-abuse prohibition, FMCA",
    dcamAlignment: {
      conceptual: {
        fiboModule: "FBC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/FBC/ProductsAndServices/FinancialProductsAndServices/FinancialProduct",
        fiboLabel: "Financial Product (Market Conduct)",
        skosMatch: "closeMatch",
      },
    },
  },
  {
    code: "E-CYBER",
    label: "Cyber and Information Security",
    description: "Cyber/information security under PA/FSCA Joint Standard 2 of 2024, POPIA",
    // No FIBO or industry standard IRI — NIST/ISO 27001 domain
  },
  {
    code: "F-GOVERNANCE",
    label: "Corporate Governance",
    description: "Board, audit-committee, remuneration, internal-audit per BCBS CGPS, Companies Act",
    dcamAlignment: {
      conceptual: {
        fiboModule: "FND",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/FND/Organizations/FormalOrganizations/FormalOrganization",
        fiboLabel: "Formal Organization",
        skosMatch: "broadMatch",
      },
    },
  },
  {
    code: "G-REPORTING",
    label: "Regulatory Reporting",
    description: "BA returns, FinSurv, STRATE/Umoja/ODP trade reporting",
    dcamAlignment: {
      conceptual: {
        fiboModule: "FBC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/RegulatoryAgencies/RegulatoryAgency",
        fiboLabel: "Regulatory Agency (Reporting)",
        skosMatch: "relatedMatch",
      },
    },
  },
  {
    code: "H-OPERATIONAL",
    label: "Operational Resilience",
    description: "Outsourcing, business-continuity, DORA-aligned resilience",
    dcamAlignment: {
      logical: [
        {
          standard: "BCBS",
          ref: "https://www.bis.org/bcbs/publ/d457.htm#operational-risk",
          label: "Basel III Operational Risk",
          skosMatch: "relatedMatch",
        },
      ],
    },
  },
  {
    code: "I-TREASURY",
    label: "Treasury and ALM",
    description: "IRRBB, collateral management, liquidity-buffer, ALCO",
    dcamAlignment: {
      conceptual: {
        fiboModule: "FBC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/MarketsAndExchanges/MarketParticipant",
        fiboLabel: "Market Participant (Treasury)",
        skosMatch: "closeMatch",
      },
    },
  },
  {
    code: "J-MARKET-INFRASTRUCTURE",
    label: "Market Infrastructure",
    description: "CSD/STRATE rules, settlement, ODP obligations",
    dcamAlignment: {
      conceptual: {
        fiboModule: "FBC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/MarketsAndExchanges/Exchange",
        fiboLabel: "Exchange / Market Infrastructure",
        skosMatch: "closeMatch",
      },
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Product scope taxonomy — seven product-scope codes.
// Canonical authoring location: this file.
// Owner: Atlas (Core banking platform architect, engineering).
//
// v1.25 — ground-up redesign following EDM Council DCAM framework.
// Old codes (8): equities, bonds, ird, fx, money-market, repo, derivatives, universal
// New codes (7): equity-securities, debt-securities, money-market-instruments,
//                interest-rate-derivatives, fx-instruments, securities-financing,
//                multi-asset
// ---------------------------------------------------------------------------

export interface ProductScopeNode {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly dcamAlignment?: DcamAlignment;
}

export const PRODUCT_SCOPE: ReadonlyArray<ProductScopeNode> = [
  {
    code: "equity-securities",
    label: "Equity Securities",
    description: "JSE-listed equities — spot trading and equity finance",
    dcamAlignment: {
      conceptual: {
        fiboModule: "SEC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/SEC/Equities/EquityInstruments/ListedShare",
        fiboLabel: "Listed Share",
        skosMatch: "exactMatch",
      },
      logical: [
        {
          standard: "CDM",
          ref: "cdm.base.staticdata.asset.common.EquityTypeEnum.EQUITY",
          label: "CDM Equity",
          skosMatch: "exactMatch",
        },
        {
          standard: "ESMA-CFI",
          ref: "ES",
          label: "Equities, Shares (ISO 10962 CFI)",
          skosMatch: "broadMatch",
        },
      ],
      physical: [
        { standard: "ISO20022", messageType: "sese.023", label: "Securities Settlement Instruction" },
        { standard: "ISO20022", messageType: "seev.036", label: "Corporate Action Instruction" },
      ],
    },
  },
  {
    code: "debt-securities",
    label: "Debt Securities",
    description: "JSE-listed and OTC bonds — government, SOE, and corporate fixed-income",
    dcamAlignment: {
      conceptual: {
        fiboModule: "SEC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/SEC/Debt/Bonds/Bond",
        fiboLabel: "Bond",
        skosMatch: "broadMatch",
        definition: "Debt instrument with fixed maturity and coupon obligations",
      },
      logical: [
        {
          standard: "CDM",
          ref: "cdm.base.staticdata.asset.common.DebtClassEnum.BOND",
          label: "CDM Bond",
          skosMatch: "broadMatch",
        },
        {
          standard: "ESMA-CFI",
          ref: "DB",
          label: "Debt, Bonds (ISO 10962 CFI)",
          skosMatch: "broadMatch",
        },
      ],
      physical: [
        { standard: "ISO20022", messageType: "sese.023", label: "Securities Settlement Instruction" },
      ],
    },
  },
  {
    code: "money-market-instruments",
    label: "Money Market Instruments",
    description: "Money market instruments: call deposits, NCDs, treasury bills",
    dcamAlignment: {
      conceptual: {
        fiboModule: "SEC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/SEC/Debt/ShortTermDebt/ShortTermDebt",
        fiboLabel: "Short-Term Debt Instrument",
        skosMatch: "exactMatch",
      },
      logical: [
        {
          standard: "ESMA-CFI",
          ref: "MM",
          label: "Money Market Instruments (ISO 10962 CFI)",
          skosMatch: "broadMatch",
        },
      ],
      physical: [
        { standard: "ISO20022", messageType: "sese.023", label: "Securities Settlement Instruction" },
      ],
    },
  },
  {
    code: "interest-rate-derivatives",
    label: "Interest Rate Derivatives",
    description: "OTC interest rate derivatives: IRS, basis swaps, FRAs, caps, floors, swaptions",
    dcamAlignment: {
      conceptual: {
        fiboModule: "DER",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/DER/RateDerivatives/IRDerivatives/InterestRateDerivative",
        fiboLabel: "Interest Rate Derivative",
        skosMatch: "exactMatch",
      },
      logical: [
        {
          standard: "CDM",
          ref: "cdm.product.asset.InterestRatePayout",
          label: "CDM Interest Rate Payout",
          skosMatch: "exactMatch",
        },
        {
          standard: "ESMA-CFI",
          ref: "SR",
          label: "Swaps, Interest Rate (ISO 10962 CFI)",
          skosMatch: "closeMatch",
        },
        {
          standard: "BCBS",
          ref: "https://www.bis.org/bcbs/publ/d352.htm",
          label: "FRTB Market Risk — Interest Rate",
          skosMatch: "relatedMatch",
        },
      ],
      physical: [
        {
          standard: "ISO20022",
          messageType: "auth.001",
          label: "EMIR Trade Report",
          notes: "Mandatory for OTC IRD with EU counterparties",
        },
        {
          standard: "ISO20022",
          messageType: "sese.023",
          label: "Securities Settlement Instruction",
          notes: "For physically-settled OTC",
        },
      ],
    },
  },
  {
    code: "fx-instruments",
    label: "FX Instruments",
    description: "FX spot and forward: USD/ZAR and major cross-currency pairs",
    dcamAlignment: {
      conceptual: {
        fiboModule: "FBC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/MarketsAndExchanges/ForeignExchange",
        fiboLabel: "Foreign Exchange",
        skosMatch: "broadMatch",
      },
      logical: [
        {
          standard: "CDM",
          ref: "cdm.product.asset.FxSingle",
          label: "CDM FX Single",
          skosMatch: "closeMatch",
        },
        {
          standard: "ESMA-CFI",
          ref: "FF",
          label: "Forwards, Foreign Exchange (ISO 10962 CFI)",
          skosMatch: "broadMatch",
        },
      ],
      physical: [
        { standard: "ISO20022", messageType: "fxtr.014", label: "FX Trade Instruction" },
        {
          standard: "ISO20022",
          messageType: "auth.001",
          label: "EMIR Trade Report",
          notes: "NDF / FX forward if EU counterparty",
        },
      ],
    },
  },
  {
    code: "securities-financing",
    label: "Securities Financing",
    description: "Repos, reverse repos, and securities-lending arrangements",
    dcamAlignment: {
      conceptual: {
        fiboModule: "SEC",
        fiboIri: "https://spec.edmcouncil.org/fibo/ontology/SEC/Securities/SecuritiesFinancing/RepurchaseAgreement",
        fiboLabel: "Repurchase Agreement",
        skosMatch: "broadMatch",
        notes: "broadMatch — code also covers stock lending",
      },
      logical: [
        {
          standard: "CDM",
          ref: "cdm.product.repo.RepurchaseAgreement",
          label: "CDM Repo",
          skosMatch: "closeMatch",
        },
        {
          standard: "ESMA-CFI",
          ref: "RF",
          label: "Repurchase Agreements (ISO 10962 CFI)",
          skosMatch: "broadMatch",
        },
      ],
      physical: [
        { standard: "ISO20022", messageType: "sese.023", label: "Securities Settlement Instruction" },
        {
          standard: "ISO20022",
          messageType: "auth.001",
          label: "EMIR Trade Report",
          notes: "SFT reporting under SFTR",
        },
      ],
    },
  },
  {
    code: "multi-asset",
    label: "Multi-Asset / Universal",
    description: "Applies to all products — cross-product scope obligations",
    // No DCAM alignment: internal catch-all with no industry equivalent
  },
] as const;

// ---------------------------------------------------------------------------
// Unified bundle — AllTaxonomies.
// ---------------------------------------------------------------------------

import {
  ACTIVITY_CODES as _AC,
  ACTIVITY_GROUPS as _AG,
  ACTIVITY_LABELS as _AL,
} from "../activities/taxonomy";
import { RISK_TAXONOMY as _RT } from "../risk/taxonomy";

export interface AllTaxonomies {
  readonly risk: {
    readonly name: string;
    readonly description: string;
    readonly nodes: typeof _RT;
  };
  readonly activity: {
    readonly name: string;
    readonly description: string;
    readonly codes: typeof _AC;
    readonly labels: typeof _AL;
    readonly groups: typeof _AG;
  };
  readonly domain: {
    readonly name: string;
    readonly description: string;
    readonly nodes: ReadonlyArray<DomainTaxonomyNode>;
  };
  readonly productScope: {
    readonly name: string;
    readonly description: string;
    readonly nodes: ReadonlyArray<ProductScopeNode>;
  };
}

export const ALL_TAXONOMIES: AllTaxonomies = {
  risk: {
    name: "Risk Taxonomy",
    description:
      "Hierarchical risk classification (L1/L2/L3). Owner: Helena (Chief Risk Officer, governance).",
    nodes: _RT,
  },
  activity: {
    name: "Activity Taxonomy",
    description:
      "Activity codes classifying bank operations. Owner: Atlas (Core banking platform architect, engineering).",
    codes: _AC,
    labels: _AL,
    groups: _AG,
  },
  domain: {
    name: "Obligation Domain Taxonomy",
    description:
      "Ten regulatory domain codes for the obligations register. Owner: Mira (Compliance / RegTech engineer, engineering).",
    nodes: DOMAIN_TAXONOMY,
  },
  productScope: {
    name: "Product Scope Taxonomy",
    description:
      "Product classifications for obligation scope. Owner: Atlas (Core banking platform architect, engineering).",
    nodes: PRODUCT_SCOPE,
  },
};
