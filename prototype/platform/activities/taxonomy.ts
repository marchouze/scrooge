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
