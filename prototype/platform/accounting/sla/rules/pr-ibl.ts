// platform/accounting/sla/rules/pr-ibl.ts
//
// Interbank-Loan (IBL — bank as lender / cash placer) IFRS posting rules,
// expressed as rules-as-data. Data form of the legacy `prIbl001 / prIblAccrual
// / prIblMat / prIblRecall` functions (platform/accounting/posting-rules/
// repo-mmd-ibl.ts). The parallel-run regression asserts byte-for-byte parity.
//
// Coverage:
//   PR-IBL-001     InterbankLoanPlaced          — asset recognition (by type)
//   PR-IBL-ACCRUAL InterbankLoanInterestAccrued — daily interest-income accrual
//   PR-IBL-MAT     InterbankLoanMatured         — principal + interest receipt
//   PR-IBL-RECALL  InterbankLoanRecalledEarly   — early recall (engine supplements)
//
// ─── PLACEMENT-TYPE-DRIVEN ASSET ACCOUNT ────────────────────────────────────
// Legacy `iblAssetAccount(placementType)`: call → dueFromBanksCall, else
// fixed-term → dueFromBanksFixed. Expressed as two `when`-gated lines per the
// `ibl.due_from_banks_call` / `ibl.due_from_banks_fixed` logicals.
//
// ─── ENRICHMENT (Phase-2 context-enrichment) ────────────────────────────────
// InterbankLoanMatured does NOT carry the placementType (legacy defaults to
// "fixed-term"). The caller supplies it as `event.enrichment.placementType`.
// InterbankLoanRecalledEarly carries only `placementId`: the legacy `prIblRecall`
// returns [] (the engine must look up the opening principal). PR-IBL-RECALL
// mirrors that — with no enrichment the rule fires no lines → empty post → no-GL;
// when the engine supplies `event.enrichment.openingPrincipalZar` +
// `event.enrichment.placementType`, the principal reversal posts.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Cites: IFRS 9 §4.1.2 (amortised cost), §3.1.1 (recognition), §3.2.3
//        (derecognition), B5.4.1 (EIR accrual), BA 326 (NSFR).

import type { SlaRule } from "../generated/sla-types";

/** Product key — IBL rules resolve accounts under this product. */
const IBL = "IBL" as const;

// ---------------------------------------------------------------------------
// PR-IBL-001 — InterbankLoanPlaced (opening recognition by placement type)
//
// Legacy: Dr dueFromBanks[type] principalZar / Cr nostro principalZar.
// Line ORDER mirrors legacy: asset (debit) first, nostro (credit) second.
// ---------------------------------------------------------------------------

export const PR_IBL_001: SlaRule = {
  rule_id: "PR-IBL-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "InterbankLoanPlaced",
    instrument_type: IBL,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §4.1.2 — asset measured at amortised cost; trade-date recognition",
  },
  lines: [
    // Dr <asset account by placementType> — exactly one fires.
    {
      account: { logical: "ibl.due_from_banks_call", product: IBL, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.placementType == 'call'",
    },
    {
      account: { logical: "ibl.due_from_banks_fixed", product: IBL, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.placementType == 'fixed-term'",
    },
    // Cr nostro (cash placed out).
    {
      account: { logical: "ibl.nostro", product: IBL, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:4.1.2", "urn:obligation:ifrs:ifrs9:3.1.1"],
};

// ---------------------------------------------------------------------------
// PR-IBL-ACCRUAL — InterbankLoanInterestAccrued (daily interest-income accrual)
//
// Legacy: zero amount → []; else Dr accruedInterest / Cr interestIncome.
// ---------------------------------------------------------------------------

export const PR_IBL_ACCRUAL: SlaRule = {
  rule_id: "PR-IBL-ACCRUAL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "InterbankLoanInterestAccrued",
    instrument_type: IBL,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail: "IFRS 9 B5.4.1 — EIR accrual; zero-amount periods produce no posting",
    delta_path: "abs(event.accruedInterestZar)",
  },
  lines: [
    {
      account: { logical: "ibl.accrued_interest", product: IBL, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.accruedInterestZar)",
      currency: "ZAR",
    },
    {
      account: { logical: "ibl.interest_income", product: IBL, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.accruedInterestZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:b5.4.1"],
};

// ---------------------------------------------------------------------------
// PR-IBL-MAT — InterbankLoanMatured (principal + interest receipt, terminal)
//
// Legacy: Dr nostro (principal+interest); Cr dueFromBanks[type] principal;
// if interest>0 Cr accruedInterest interest. placementType from enrichment
// (defaults fixed-term). Interest leg `when`-gated (legacy `if (interest > 0)`).
// ---------------------------------------------------------------------------

export const PR_IBL_MAT: SlaRule = {
  rule_id: "PR-IBL-MAT",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "InterbankLoanMatured",
    instrument_type: IBL,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.2.3 — derecognition on principal repayment at maturity",
  },
  lines: [
    // Dr nostro (principal + interest cash in).
    {
      account: { logical: "ibl.nostro", product: IBL, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.principalZar) + abs(event.interestReceivedZar)",
      currency: "ZAR",
    },
    // Cr <asset account by enrichment placementType> principal — exactly one fires.
    {
      account: { logical: "ibl.due_from_banks_call", product: IBL, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.enrichment.placementType == 'call'",
    },
    {
      account: { logical: "ibl.due_from_banks_fixed", product: IBL, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.enrichment.placementType == 'fixed-term'",
    },
    // Cr accrued interest — only when interest > 0 (legacy guard).
    {
      account: { logical: "ibl.accrued_interest", product: IBL, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.interestReceivedZar)",
      currency: "ZAR",
      when: "abs(event.interestReceivedZar) > 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};

// ---------------------------------------------------------------------------
// PR-IBL-RECALL — InterbankLoanRecalledEarly (early recall, terminal)
//
// Legacy `prIblRecall` is an intentional stub: returns [] (the engine must look
// up the opening principal). PR-IBL-RECALL mirrors that with the non-zero-delta
// guard on the enrichment opening principal: no enrichment → no firing lines →
// empty post → no-GL (parity with legacy []). When the engine supplies the
// enrichment, the principal is returned: Dr nostro / Cr dueFromBanks[type].
// ---------------------------------------------------------------------------

export const PR_IBL_RECALL: SlaRule = {
  rule_id: "PR-IBL-RECALL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "InterbankLoanRecalledEarly",
    instrument_type: IBL,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail:
      "IFRS 9 §3.2.3 — derecognition on lender-initiated recall; no opening principal (enrichment) → no posting (legacy stub returns [])",
    // `exists(...)` guards the absent-enrichment case → delta 0 → no-GL.
    delta_path:
      "if(exists(event.enrichment.openingPrincipalZar), abs(event.enrichment.openingPrincipalZar), 0)",
  },
  lines: [
    // Dr nostro (principal returned to the bank).
    {
      account: { logical: "ibl.nostro", product: IBL, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.enrichment.openingPrincipalZar)",
      currency: "ZAR",
    },
    // Cr <asset account by enrichment placementType> principal — exactly one fires.
    {
      account: { logical: "ibl.due_from_banks_call", product: IBL, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.enrichment.openingPrincipalZar)",
      currency: "ZAR",
      when: "event.enrichment.placementType == 'call'",
    },
    {
      account: { logical: "ibl.due_from_banks_fixed", product: IBL, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.enrichment.openingPrincipalZar)",
      currency: "ZAR",
      when: "event.enrichment.placementType == 'fixed-term'",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};
