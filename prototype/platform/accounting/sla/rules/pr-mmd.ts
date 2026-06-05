// platform/accounting/sla/rules/pr-mmd.ts
//
// Money-Market-Deposit (MMD) IFRS posting rules, expressed as rules-as-data.
// Data form of the legacy `prMmd001 / prMmdAccrual / prMmdMat / prMmdCancel`
// functions (platform/accounting/posting-rules/repo-mmd-ibl.ts). The
// parallel-run regression (tests/sla-treasury-lifecycle-parallel-run.test.ts)
// asserts the interpreter's legs match the legacy engine BYTE-FOR-BYTE on real
// deposit-lifecycle fixtures.
//
// Coverage (one rule per registry entry — posting-rule-registry.ts):
//   PR-MMD-001     DepositTaken            — liability recognition (by category)
//   PR-MMD-ACCRUAL DepositInterestAccrued  — daily interest-expense accrual
//   PR-MMD-MAT     DepositMatured          — principal + interest repayment
//   PR-MMD-CANCEL  DepositWithdrawnEarly   — early withdrawal (penalty net)
//
// ─── CATEGORY-DRIVEN LIABILITY ACCOUNT ──────────────────────────────────────
// The legacy `depositLiabilityAccount(category)` switch selects one of four LCR
// liability accounts (BA 325 Table 1). The resolver cannot key on a payload
// enum, so the four branches are expressed as four `when`-gated lines per the
// `deposit.liability_<category>` logical accounts — exactly one fires.
//
// ─── ENRICHMENT (Phase-2 context-enrichment) ────────────────────────────────
// DepositMatured / DepositWithdrawnEarly do NOT carry the deposit category (or,
// for withdrawal, the opening principal). The legacy functions default the
// category to "wholesale-non-operational" and (for cancel) take a supplied
// `principalZar`. The caller (GL posting engine) reconstructs these from the
// originating DepositTaken and supplies them PRE-RESOLVED as:
//   event.enrichment.depositCategory : the originating category (string)
//   event.enrichment.openingPrincipalZar : the originating principal (cancel)
// The interpreter stays PURE — enrichment is a typed input, never a store read.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05);
//            D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05).
// Cites: IFRS 9 §3.1.1, §4.2.1 (recognition), §3.3.1 (derecognition),
//        IFRS 9 B5.4.1 (EIR accrual), BA 325 Table 1 (LCR categories).

import type { SlaRule } from "../generated/sla-types";

/** Product key — every treasury MMD rule resolves accounts under this product. */
const MMD = "MMD" as const;

// ---------------------------------------------------------------------------
// PR-MMD-001 — DepositTaken (opening recognition by category)
//
// Legacy: Dr fx.nostro[ZAR] principalZar / Cr <liability[category]> principalZar
// Line ORDER mirrors the legacy output exactly: nostro first (debit), then the
// single category-matched liability (credit).
// ---------------------------------------------------------------------------

export const PR_MMD_001: SlaRule = {
  rule_id: "PR-MMD-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "DepositTaken",
    instrument_type: MMD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §4.2.1 — financial liability recognised at fair value (par) on receipt",
  },
  lines: [
    // Dr Nostro (cash received).
    {
      account: { logical: "deposit.nostro", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
    },
    // Cr <liability account by category> — exactly one of the four fires.
    {
      account: { logical: "deposit.liability_retail_stable", product: MMD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.depositCategory == 'retail-stable'",
    },
    {
      account: { logical: "deposit.liability_retail_less_stable", product: MMD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.depositCategory == 'retail-less-stable'",
    },
    {
      account: { logical: "deposit.liability_wholesale_operational", product: MMD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.depositCategory == 'wholesale-operational'",
    },
    {
      account: {
        logical: "deposit.liability_wholesale_non_operational",
        product: MMD,
        currency: "ZAR",
      },
      side: "credit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.depositCategory == 'wholesale-non-operational'",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:4.2.1", "urn:obligation:ifrs:ifrs9:3.1.1"],
};

// ---------------------------------------------------------------------------
// PR-MMD-ACCRUAL — DepositInterestAccrued (daily interest-expense accrual)
//
// Legacy: zero amount → []; else Dr interestExpense / Cr accruedInterest.
// The zero-skip is ported via condition: non-zero-delta on accruedInterestZar.
// ---------------------------------------------------------------------------

export const PR_MMD_ACCRUAL: SlaRule = {
  rule_id: "PR-MMD-ACCRUAL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "DepositInterestAccrued",
    instrument_type: MMD,
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
      account: { logical: "deposit.interest_expense", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.accruedInterestZar)",
      currency: "ZAR",
    },
    {
      account: { logical: "deposit.accrued_interest", product: MMD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.accruedInterestZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:b5.4.1"],
};

// ---------------------------------------------------------------------------
// PR-MMD-MAT — DepositMatured (principal + interest repayment, terminal)
//
// Legacy: Dr <liability[category]> principal; if interest>0 Dr accruedInterest
// interest; Cr nostro (principal+interest). Category from enrichment (defaults
// wholesale-non-operational, matching the legacy default arg).
// The interest leg is `when`-gated on interest>0 (legacy `if (interest > 0)`).
// ---------------------------------------------------------------------------

export const PR_MMD_MAT: SlaRule = {
  rule_id: "PR-MMD-MAT",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "DepositMatured",
    instrument_type: MMD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.3.1 — derecognition on extinguishment (maturity repayment)",
  },
  lines: [
    // Dr <liability account by enrichment category> — exactly one fires.
    {
      account: { logical: "deposit.liability_retail_stable", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.enrichment.depositCategory == 'retail-stable'",
    },
    {
      account: { logical: "deposit.liability_retail_less_stable", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.enrichment.depositCategory == 'retail-less-stable'",
    },
    {
      account: { logical: "deposit.liability_wholesale_operational", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.enrichment.depositCategory == 'wholesale-operational'",
    },
    {
      account: {
        logical: "deposit.liability_wholesale_non_operational",
        product: MMD,
        currency: "ZAR",
      },
      side: "debit",
      amount: "abs(event.principalZar)",
      currency: "ZAR",
      when: "event.enrichment.depositCategory == 'wholesale-non-operational'",
    },
    // Dr accrued interest derecognition — only when interest > 0 (legacy guard).
    {
      account: { logical: "deposit.accrued_interest", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.interestPaidZar)",
      currency: "ZAR",
      when: "abs(event.interestPaidZar) > 0",
    },
    // Cr nostro (principal + interest cash out).
    {
      account: { logical: "deposit.nostro", product: MMD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.principalZar) + abs(event.interestPaidZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.3.1"],
};

// ---------------------------------------------------------------------------
// PR-MMD-CANCEL — DepositWithdrawnEarly (early withdrawal, terminal)
//
// Legacy: principalZar (enrichment opening principal) ≤ 0 → [] (engine must
// supply); else Dr <liability[category]> principal / Cr nostro (principal -
// penalty); if penalty>0 Cr interestExpense penalty.
// The "no opening principal → empty" guard is ported via condition:
// non-zero-delta on the enrichment opening principal: with no enrichment the
// path is absent → the per-line `when` predicates all reference enrichment, so
// every line is gated; a missing opening principal yields zero firing lines →
// empty post → no-GL (matches legacy `[]`).
// ---------------------------------------------------------------------------

export const PR_MMD_CANCEL: SlaRule = {
  rule_id: "PR-MMD-CANCEL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "DepositWithdrawnEarly",
    instrument_type: MMD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail:
      "IFRS 9 §3.3.1 — derecognition on early withdrawal; no opening principal (enrichment) → no posting (legacy `principalZar <= 0 → []`)",
    // `exists(...)` guards the absent-enrichment case: with no opening principal
    // the delta is 0 → intentional-no-impact (matches the legacy `[]`), never a
    // loud UnknownPathError.
    delta_path:
      "if(exists(event.enrichment.openingPrincipalZar), abs(event.enrichment.openingPrincipalZar), 0)",
  },
  lines: [
    // Dr <liability account by enrichment category> principal — exactly one fires.
    {
      account: { logical: "deposit.liability_retail_stable", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.enrichment.openingPrincipalZar)",
      currency: "ZAR",
      when: "event.enrichment.depositCategory == 'retail-stable'",
    },
    {
      account: { logical: "deposit.liability_retail_less_stable", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.enrichment.openingPrincipalZar)",
      currency: "ZAR",
      when: "event.enrichment.depositCategory == 'retail-less-stable'",
    },
    {
      account: { logical: "deposit.liability_wholesale_operational", product: MMD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.enrichment.openingPrincipalZar)",
      currency: "ZAR",
      when: "event.enrichment.depositCategory == 'wholesale-operational'",
    },
    {
      account: {
        logical: "deposit.liability_wholesale_non_operational",
        product: MMD,
        currency: "ZAR",
      },
      side: "debit",
      amount: "abs(event.enrichment.openingPrincipalZar)",
      currency: "ZAR",
      when: "event.enrichment.depositCategory == 'wholesale-non-operational'",
    },
    // Cr nostro (principal - penalty) — net cash out.
    {
      account: { logical: "deposit.nostro", product: MMD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.enrichment.openingPrincipalZar) - abs(event.penaltyZar)",
      currency: "ZAR",
    },
    // Cr interestExpense penalty — penalty retained by the bank (reduces expense).
    // Only when penalty > 0 (legacy `if (penalty > 0)`).
    {
      account: { logical: "deposit.interest_expense", product: MMD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.penaltyZar)",
      currency: "ZAR",
      when: "abs(event.penaltyZar) > 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.3.1"],
};
