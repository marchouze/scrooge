// platform/activities/taxonomy.ts
//
// Activity taxonomy for the bank's obligations register.
// Defines the canonical set of ACT-* codes used to classify which
// activities each regulatory obligation applies to.
//
// Authority:
//   - CEO approved (Marc, 2026-05-13) — scope column design
//   - CLAUDE.md Principle 2 (single-graph discipline): obligations
//     must carry typed citations back to their source; activity scope
//     is one dimension of that chain.
//   - CLAUDE.md Principle 1 (events as truth): this file is the
//     canonical authoring location; Regulations/_activity-taxonomy.md
//     is a markdown mirror (a render, not the source).
//
// Consumer: obligations-view.ts (parser), obligations.js (filter UI)
// Sibling register: Regulations/_activity-taxonomy.md
//
// Author: Atlas (Core banking platform architect, engineering)

export const ACTIVITY_CODES = [
  // Trading
  "ACT-TRADE-FX", // FX dealing (spot, forward, swap)
  "ACT-TRADE-BOND", // Bond trading (JSE & OTC)
  "ACT-TRADE-EQUITY", // Equity trading (JSE)
  "ACT-TRADE-OTC-IRD", // OTC interest rate derivatives
  "ACT-TRADE-OTC-CREDIT", // OTC credit derivatives
  // Banking
  "ACT-BANK-DEPOSIT", // Deposit-taking
  "ACT-BANK-PAYMENT", // Payment processing (SAMOS / sponsor-bank channel)
  "ACT-BANK-NOSTRO", // Nostro & correspondent management
  // Client
  "ACT-CLIENT-ONBOARD", // Counterparty/client onboarding (KYC, CDD, EDD)
  "ACT-CLIENT-ADVICE", // FAIS investment advice
  "ACT-CLIENT-CATEGORISE", // Client categorisation & suitability
  // Reporting
  "ACT-REPORT-PRUDENTIAL", // Prudential regulatory reporting (BA returns, ICAAP, ILAAP)
  "ACT-REPORT-CONDUCT", // Conduct / market-abuse regulatory reporting
  "ACT-REPORT-FINSURV", // FX & FinSurv reporting (EXCON)
  "ACT-REPORT-TRADE", // Trade reporting (STRATE / Umoja / ODP)
  // Risk
  "ACT-RISK-CAPITAL", // Capital management & adequacy
  "ACT-RISK-LIQUIDITY", // Liquidity management
  "ACT-RISK-MARKET", // Market risk management
  "ACT-RISK-CREDIT", // Credit & counterparty risk management
  "ACT-RISK-OPERATIONAL", // Operational risk management
  "ACT-RISK-MODEL", // Model risk & validation
  // Governance
  "ACT-GOVERN-BOARD", // Board & committee governance
  "ACT-GOVERN-AUDIT", // Internal audit
  "ACT-GOVERN-COMPLIANCE", // Compliance programme & monitoring
  "ACT-GOVERN-REMUNER", // Remuneration governance
  // Technology
  "ACT-TECH-IT", // IT systems management
  "ACT-TECH-CYBER", // Cybersecurity & cyber resilience
  "ACT-TECH-DATA", // Data management & governance
  "ACT-TECH-KEY-MGMT", // Cryptographic key management
  // Corporate
  "ACT-CORP-ENTITY", // Legal entity management (company secretarial)
  "ACT-CORP-EMPLOYEE", // Employment & HR
  "ACT-CORP-LEGAL", // Legal & contracting
] as const;

export type ActivityCode = (typeof ACTIVITY_CODES)[number];

export const ACTIVITY_LABELS: Record<ActivityCode, string> = {
  "ACT-TRADE-FX": "FX dealing",
  "ACT-TRADE-BOND": "Bond trading",
  "ACT-TRADE-EQUITY": "Equity trading (JSE)",
  "ACT-TRADE-OTC-IRD": "OTC interest rate derivatives",
  "ACT-TRADE-OTC-CREDIT": "OTC credit derivatives",
  "ACT-BANK-DEPOSIT": "Deposit-taking",
  "ACT-BANK-PAYMENT": "Payment processing",
  "ACT-BANK-NOSTRO": "Nostro & correspondent management",
  "ACT-CLIENT-ONBOARD": "Client onboarding (KYC/CDD/EDD)",
  "ACT-CLIENT-ADVICE": "FAIS investment advice",
  "ACT-CLIENT-CATEGORISE": "Client categorisation & suitability",
  "ACT-REPORT-PRUDENTIAL": "Prudential regulatory reporting",
  "ACT-REPORT-CONDUCT": "Conduct regulatory reporting",
  "ACT-REPORT-FINSURV": "FX / FinSurv reporting",
  "ACT-REPORT-TRADE": "Trade reporting",
  "ACT-RISK-CAPITAL": "Capital management",
  "ACT-RISK-LIQUIDITY": "Liquidity management",
  "ACT-RISK-MARKET": "Market risk management",
  "ACT-RISK-CREDIT": "Credit & counterparty risk",
  "ACT-RISK-OPERATIONAL": "Operational risk management",
  "ACT-RISK-MODEL": "Model risk & validation",
  "ACT-GOVERN-BOARD": "Board & committee governance",
  "ACT-GOVERN-AUDIT": "Internal audit",
  "ACT-GOVERN-COMPLIANCE": "Compliance monitoring",
  "ACT-GOVERN-REMUNER": "Remuneration governance",
  "ACT-TECH-IT": "IT systems management",
  "ACT-TECH-CYBER": "Cybersecurity",
  "ACT-TECH-DATA": "Data management",
  "ACT-TECH-KEY-MGMT": "Cryptographic key management",
  "ACT-CORP-ENTITY": "Legal entity management",
  "ACT-CORP-EMPLOYEE": "Employment & HR",
  "ACT-CORP-LEGAL": "Legal & contracting",
};

// ---------------------------------------------------------------------------
// DCAM assembly — Activity taxonomy
// ---------------------------------------------------------------------------

import {
  CONCEPTUAL_REGISTRY,
  PHYSICAL_ACTIVITY,
  getLogicalMappings,
} from "../taxonomies/dcam/index";
import type { DcamAlignment } from "../taxonomies/dcam/types";

/**
 * Assemble the full DCAM three-layer alignment for an activity code.
 * Returns undefined for codes with no Layer 1 anchor.
 */
export function getActivityDcamAlignment(code: ActivityCode): DcamAlignment | undefined {
  const physical = PHYSICAL_ACTIVITY[code];
  if (!physical) return undefined;
  const concept = physical.conceptKey ? CONCEPTUAL_REGISTRY.get(physical.conceptKey) : undefined;
  const logical = physical.conceptKey ? getLogicalMappings(physical.conceptKey) : [];

  if (!concept && logical.length === 0 && (!physical.iso20022 || physical.iso20022.length === 0)) {
    return undefined;
  }

  const conceptual = concept
    ? {
        fiboModule: concept.fiboModule,
        fiboIri: concept.fiboIri,
        fiboLabel: concept.fiboLabel,
        skosMatch: concept.skosMatch,
        ...(concept.definition !== undefined ? { definition: concept.definition } : {}),
      }
    : undefined;
  const logicalMapped =
    logical.length > 0
      ? logical.map((m) => ({
          standard: m.standard,
          ref: m.ref,
          label: m.label,
          skosMatch: m.skosMatch,
          ...(m.notes !== undefined ? { notes: m.notes } : {}),
        }))
      : undefined;
  const physicalMapped =
    physical.iso20022 && physical.iso20022.length > 0
      ? physical.iso20022.map((p) => ({
          standard: "ISO20022" as const,
          messageType: p.messageType,
          label: p.label,
          ...(p.notes !== undefined ? { notes: p.notes } : {}),
        }))
      : undefined;

  return {
    ...(conceptual !== undefined ? { conceptual } : {}),
    ...(logicalMapped !== undefined ? { logical: logicalMapped } : {}),
    ...(physicalMapped !== undefined ? { physical: physicalMapped } : {}),
  };
}

export const ACTIVITY_GROUPS: Record<string, ActivityCode[]> = {
  Trading: [
    "ACT-TRADE-FX",
    "ACT-TRADE-BOND",
    "ACT-TRADE-EQUITY",
    "ACT-TRADE-OTC-IRD",
    "ACT-TRADE-OTC-CREDIT",
  ],
  Banking: ["ACT-BANK-DEPOSIT", "ACT-BANK-PAYMENT", "ACT-BANK-NOSTRO"],
  Client: ["ACT-CLIENT-ONBOARD", "ACT-CLIENT-ADVICE", "ACT-CLIENT-CATEGORISE"],
  Reporting: [
    "ACT-REPORT-PRUDENTIAL",
    "ACT-REPORT-CONDUCT",
    "ACT-REPORT-FINSURV",
    "ACT-REPORT-TRADE",
  ],
  Risk: [
    "ACT-RISK-CAPITAL",
    "ACT-RISK-LIQUIDITY",
    "ACT-RISK-MARKET",
    "ACT-RISK-CREDIT",
    "ACT-RISK-OPERATIONAL",
    "ACT-RISK-MODEL",
  ],
  Governance: [
    "ACT-GOVERN-BOARD",
    "ACT-GOVERN-AUDIT",
    "ACT-GOVERN-COMPLIANCE",
    "ACT-GOVERN-REMUNER",
  ],
  Technology: ["ACT-TECH-IT", "ACT-TECH-CYBER", "ACT-TECH-DATA", "ACT-TECH-KEY-MGMT"],
  Corporate: ["ACT-CORP-ENTITY", "ACT-CORP-EMPLOYEE", "ACT-CORP-LEGAL"],
};
