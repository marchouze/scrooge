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
//   4. Product scope (8 product codes)        — Atlas (Core banking platform architect, engineering)
//
// Principle 2 (single-graph discipline): every taxonomy node is a
// stable-code entry; obligations, policies, and risk records cite the
// code — the label is a derived render, never the canonical key.
//
// Author: Atlas (Core banking platform architect, engineering)

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
}

export const DOMAIN_TAXONOMY: ReadonlyArray<DomainTaxonomyNode> = [
  {
    code: "A-PRUDENTIAL",
    label: "Prudential regulation",
    description:
      "Capital adequacy, liquidity management, ICAAP, ILAAP, and recovery planning under the Banks Act and SARB Directives.",
  },
  {
    code: "B-FINANCIAL-CRIME",
    label: "Financial crime",
    description:
      "Anti-money-laundering, sanctions compliance, POCA, FIC Act obligations, and FATF Recommendations implementation.",
  },
  {
    code: "C-FAIS",
    label: "FAIS Act — conduct",
    description:
      "FSP licensing, fit-and-proper requirements, conflict-of-interest management, and conduct obligations under the Financial Advisory and Intermediary Services Act.",
  },
  {
    code: "D-MARKET-CONDUCT",
    label: "Market conduct",
    description:
      "FSCA conduct supervision, Treating Customers Fairly (TCF), market-abuse prohibition, and FMCA obligations.",
  },
  {
    code: "E-CYBER",
    label: "Cyber & information security",
    description:
      "Cyber and information-security obligations under PA/FSCA Joint Standard 2 of 2024 and POPIA ss.19–22.",
  },
  {
    code: "F-GOVERNANCE",
    label: "Corporate governance",
    description:
      "Board composition, audit-committee, remuneration governance, and internal-audit independence under BCBS CGPS and Companies Act 71 of 2008.",
  },
  {
    code: "G-REPORTING",
    label: "Regulatory reporting",
    description:
      "BA-return submissions to the SARB Prudential Authority, FinSurv reporting, and trade reporting to STRATE / Umoja / ODP.",
  },
  {
    code: "H-OPERATIONAL",
    label: "Operational resilience",
    description:
      "Outsourcing controls, business-continuity planning, and DORA-aligned operational resilience obligations.",
  },
  {
    code: "I-TREASURY",
    label: "Treasury & ALCO",
    description:
      "Interest-rate risk in the banking book (IRRBB), collateral management, liquidity-buffer maintenance, and ALCO governance.",
  },
  {
    code: "J-MARKET-INFRASTRUCTURE",
    label: "Market infrastructure",
    description:
      "CSD and STRATE participation rules, settlement obligations, and obligations as an ODP (Over-the-counter Derivatives Provider).",
  },
] as const;

// ---------------------------------------------------------------------------
// Product scope taxonomy — eight product-scope codes.
// Canonical authoring location: this file.
// Owner: Atlas (Core banking platform architect, engineering).
// ---------------------------------------------------------------------------

export interface ProductScopeNode {
  readonly code: string;
  readonly label: string;
  readonly description: string;
}

export const PRODUCT_SCOPE: ReadonlyArray<ProductScopeNode> = [
  {
    code: "equities",
    label: "Equities",
    description: "JSE-listed equities — spot trading and equity finance.",
  },
  {
    code: "bonds",
    label: "Bonds",
    description: "JSE-listed and OTC bonds — government, SOE, and corporate fixed-income.",
  },
  {
    code: "ird",
    label: "Interest rate derivatives",
    description:
      "OTC interest rate derivatives — IRS, basis swaps, FRAs, caps, floors, and swaptions.",
  },
  {
    code: "fx",
    label: "FX",
    description: "FX spot and forward — USD/ZAR and major cross-currency pairs.",
  },
  {
    code: "money-market",
    label: "Money market",
    description: "Money market instruments — call deposits, NCDs, and treasury bills.",
  },
  {
    code: "repo",
    label: "Repo & securities lending",
    description: "Repos, reverse repos, and securities-lending arrangements.",
  },
  {
    code: "derivatives",
    label: "Derivatives (generic)",
    description:
      "Generic derivatives catch-all for obligations spanning multiple derivative asset classes.",
  },
  {
    code: "universal",
    label: "Universal",
    description: "Applies to all products — used for obligations with no product-specific scope.",
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
