// platform/accounting/sla/rules/pr-repo.ts
//
// Repo (bank as cash borrower / secured borrowing, IAS 39 §27) IFRS posting
// rules, expressed as rules-as-data. Data form of the legacy `prRepo001 /
// prRepoSettleStart / prRepoAccrual / prRepoEnd / prRepoCancel` functions
// (platform/accounting/posting-rules/repo-mmd-ibl.ts). The parallel-run
// regression asserts byte-for-byte parity.
//
// Coverage:
//   PR-REPO-001          RepoTradeOpened          — secured-borrowing recognition
//   PR-REPO-SETTLE-START RepoStartLegSettled      — intentional-no-impact memo
//   PR-REPO-ACCRUAL      RepoInterestAccrued      — daily repo-rate accrual
//   PR-REPO-END          RepoEndLegSettled        — repurchase settlement (terminal)
//   PR-REPO-CANCEL       RepoTradeTerminatedEarly — early unwind (engine supplements)
//
// ─── PR-REPO-END / PR-REPO-CANCEL ───────────────────────────────────────────
// The legacy `prRepoEnd` collapses the derecognition into a single
// Dr nostro / Cr REPO.asset of `repurchasePriceZar` (the event's own field) — no
// opening lookup needed; the rule mirrors that exactly. The legacy `prRepoCancel`
// is an intentional stub returning [] (the bilateral cash amount is not on the
// event). PR-REPO-CANCEL mirrors that: with no enrichment cash amount it fires no
// lines → empty post → no-GL; when the engine supplies
// `event.enrichment.unwindCashZar` the reversal posts (Dr nostro / Cr REPO.asset).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Cites: IAS 39 §27 (repos as secured borrowings), IFRS 9 §3.1.1 (recognition),
//        §3.2.3 (derecognition), B5.4.1 (EIR accrual).

import type { SlaRule } from "../generated/sla-types";

/** Product key — repo rules resolve accounts under this product. */
const REPO = "REPO" as const;

// ---------------------------------------------------------------------------
// PR-REPO-001 — RepoTradeOpened (secured-borrowing recognition)
//
// Legacy: Dr REPO.asset startLegCashZar / Cr nostro startLegCashZar.
// ---------------------------------------------------------------------------

export const PR_REPO_001: SlaRule = {
  rule_id: "PR-REPO-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "RepoTradeOpened",
    instrument_type: REPO,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IAS 39 §27 — collateral not derecognised; cash receipt is secured borrowing",
  },
  lines: [
    {
      account: { logical: "repo.asset", product: REPO, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.startLegCashZar)",
      currency: "ZAR",
    },
    {
      account: { logical: "repo.nostro", product: REPO, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.startLegCashZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ias39:27", "urn:obligation:ifrs:ifrs9:3.1.1"],
};

// ---------------------------------------------------------------------------
// PR-REPO-SETTLE-START — RepoStartLegSettled (intentional-no-impact memo)
//
// Legacy `prRepoSettleStart` returns [] — recognition already posted at
// RepoTradeOpened; this confirmation has no GL impact.
// ---------------------------------------------------------------------------

export const PR_REPO_SETTLE_START: SlaRule = {
  rule_id: "PR-REPO-SETTLE-START",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "RepoStartLegSettled",
    instrument_type: REPO,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "intentional-no-impact",
    detail:
      "Recognition already posted at RepoTradeOpened; start-leg settlement is a confirmation-only memo [zero-impact-by-design]",
  },
  lines: [],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ias39:27"],
};

// ---------------------------------------------------------------------------
// PR-REPO-ACCRUAL — RepoInterestAccrued (daily repo-rate accrual)
//
// Legacy: zero amount → []; else Dr REPO.accruedInterest / Cr REPO.interestPnL.
// ---------------------------------------------------------------------------

export const PR_REPO_ACCRUAL: SlaRule = {
  rule_id: "PR-REPO-ACCRUAL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "RepoInterestAccrued",
    instrument_type: REPO,
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
      account: { logical: "repo.accrued_interest", product: REPO, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.accruedInterestZar)",
      currency: "ZAR",
    },
    {
      account: { logical: "repo.interest_pnl", product: REPO, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.accruedInterestZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:b5.4.1"],
};

// ---------------------------------------------------------------------------
// PR-REPO-END — RepoEndLegSettled (repurchase settlement, terminal)
//
// Legacy: Dr nostro repurchasePriceZar / Cr REPO.asset repurchasePriceZar.
// (The legacy rule collapses the principal / accrued-interest split into a
// single clear of REPO.asset — see the documented substrate gap in the legacy
// source; PR-REPO-END reproduces it exactly for parity.)
// ---------------------------------------------------------------------------

export const PR_REPO_END: SlaRule = {
  rule_id: "PR-REPO-END",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "RepoEndLegSettled",
    instrument_type: REPO,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.2.3 — derecognition of secured borrowing on repurchase",
  },
  lines: [
    {
      account: { logical: "repo.nostro", product: REPO, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.repurchasePriceZar)",
      currency: "ZAR",
    },
    {
      account: { logical: "repo.asset", product: REPO, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.repurchasePriceZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};

// ---------------------------------------------------------------------------
// PR-REPO-CANCEL — RepoTradeTerminatedEarly (early unwind, terminal)
//
// Legacy `prRepoCancel` is an intentional stub returning [] (the bilateral
// unwind cash is not on the early-termination payload). PR-REPO-CANCEL mirrors
// that: the non-zero-delta guard on the enrichment unwind cash means no
// enrichment → no firing lines → empty post → no-GL (parity with legacy []).
// When the engine supplies `event.enrichment.unwindCashZar`, the reversal posts
// (Dr nostro / Cr REPO.asset).
// ---------------------------------------------------------------------------

export const PR_REPO_CANCEL: SlaRule = {
  rule_id: "PR-REPO-CANCEL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "RepoTradeTerminatedEarly",
    instrument_type: REPO,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail:
      "IFRS 9 §3.2.3 — derecognition on early termination; no unwind cash (enrichment) → no posting (legacy stub returns [])",
    // `exists(...)` guards the absent-enrichment case → delta 0 → no-GL.
    delta_path:
      "if(exists(event.enrichment.unwindCashZar), abs(event.enrichment.unwindCashZar), 0)",
  },
  lines: [
    {
      account: { logical: "repo.nostro", product: REPO, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.enrichment.unwindCashZar)",
      currency: "ZAR",
    },
    {
      account: { logical: "repo.asset", product: REPO, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.enrichment.unwindCashZar)",
      currency: "ZAR",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};
