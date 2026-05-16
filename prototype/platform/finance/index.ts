// platform/finance/index.ts
//
// Public barrel for the finance module.
//
// Downstream consumers import from `@platform/finance`.
//
// Authority: D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
// Authors: Bea (Accounting & financial reporting engineer, engineering)

export { classifyFxSubLedger, computeIfrsTrialBalance } from "./ifrs9/classifier";

export type { IfrsJournalEntry, IfrsTrialBalance, IfrsTrialBalanceRow } from "./ifrs9/types";
