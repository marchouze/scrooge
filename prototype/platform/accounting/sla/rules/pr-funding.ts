// platform/accounting/sla/rules/pr-funding.ts
//
// Funding-line (wholesale committed facility) IFRS posting rules, expressed as
// rules-as-data. Data form of the legacy `prFunding001 / prFundingEnd`
// functions (platform/accounting/posting-rules/repo-mmd-ibl.ts). The
// parallel-run regression asserts byte-for-byte parity.
//
// Coverage:
//   PR-FUNDING-001 FundingLineDrawn  — drawdown recognition (wholesale-non-op)
//   PR-FUNDING-END FundingLineRepaid — full repayment (terminal)
//
// Both legs are ZAR. The drawdown liability books to the shared
// wholesale-non-operational deposit liability (BA 325 Table 2, 100% outflow) —
// the SAME physical account the deposit family uses for that category, so the
// resolver row reuses `deposit.liability_wholesale_non_operational`.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Cites: IFRS 9 §4.2.1 (recognition), §3.3.1 (derecognition), BA 325 Table 2.

import type { SlaRule } from "../generated/sla-types";

/** Product key — funding-line rules resolve accounts under this product. */
const FUNDING = "FUNDING" as const;

// ---------------------------------------------------------------------------
// PR-FUNDING-001 — FundingLineDrawn (opening recognition)
//
// Legacy: Dr nostro drawnAmountZar / Cr liabilityWholesaleNonOp drawnAmountZar.
// ---------------------------------------------------------------------------

export const PR_FUNDING_001: SlaRule = {
  rule_id: "PR-FUNDING-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FundingLineDrawn",
    instrument_type: FUNDING,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §4.2.1 — liability recognised at fair value (par) on drawdown",
  },
  lines: [
    {
      account: { logical: "funding.nostro", product: FUNDING, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.drawnAmountZar)",
      currency: "ZAR",
    },
    {
      account: {
        logical: "funding.liability_wholesale_non_operational",
        product: FUNDING,
        currency: "ZAR",
      },
      side: "credit",
      amount: "abs(event.drawnAmountZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:4.2.1"],
};

// ---------------------------------------------------------------------------
// PR-FUNDING-END — FundingLineRepaid (full repayment, terminal)
//
// Legacy: Dr liabilityWholesaleNonOp repaidAmountZar / Cr nostro repaidAmountZar.
// ---------------------------------------------------------------------------

export const PR_FUNDING_END: SlaRule = {
  rule_id: "PR-FUNDING-END",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FundingLineRepaid",
    instrument_type: FUNDING,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.3.1 — derecognition on full repayment",
  },
  lines: [
    {
      account: {
        logical: "funding.liability_wholesale_non_operational",
        product: FUNDING,
        currency: "ZAR",
      },
      side: "debit",
      amount: "abs(event.repaidAmountZar)",
      currency: "ZAR",
    },
    {
      account: { logical: "funding.nostro", product: FUNDING, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.repaidAmountZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.3.1"],
};
