// platform/accounting/sla/rules/pr-bond.ts
//
// JSE bond lifecycle IFRS posting rules, expressed as rules-as-data. The sole
// production posting path for bond booking / interest-accrual / revaluation /
// maturity / sale; account mappings come from BOND_ACCOUNTS (resolver.ts). The
// interpreter suite (tests/sla-securities-lifecycle-interpreter.test.ts) pins
// the leg footprints on real bond-lifecycle fixtures (banking AND trading book).
//
// Coverage (one rule per registry entry — posting-rule-registry.ts):
//   PR-BOND-001  BondTradeExecuted    — initial recognition (banking vs trading)
//   PR-BOND-EIR  BondInterestAccrued  — EIR interest accrual
//   PR-BOND-002  BondPositionRevalued — FVTPL revaluation (trading book)
//   PR-BOND-MAT  BondMatured          — derecognition at maturity
//   PR-BOND-SALE BondSold             — derecognition on sale
//
// ─── BANKING-BOOK vs TRADING-BOOK SELECTION ─────────────────────────────────
// Banking-book and trading-book bookings differ ONLY in the asset account
// (banking ACC-3100-001 vs trading ACC-3100-002). The resolver cannot key on a
// payload enum, so the two asset legs are expressed as `when`-gated lines on
// `event.portfolio` (mirroring the treasury deposit-category approach) — exactly
// one fires. The maturity / sale rules read the portfolio from ENRICHMENT (the
// triggering event does not carry it; see PORTFOLIO ENRICHMENT below).
//
// ─── DIRTY-PRICE ENRICHMENT (booking) ───────────────────────────────────────
// The booking amount is `Math.round(nominalMinor * dirtyPricePercent / 100)`.
// `dirtyPricePercent` is a NON-INTEGER (e.g. 98.0, 99.4); the SLA expression
// sandbox is integer-only money arithmetic (a non-integer path value is rejected
// by design — spec §4.2: supply pre-translated minor-unit amounts). So the
// caller (GL posting engine) pre-computes the integer dirty-price amount with
// `Math.round` and hands it in as `event.enrichment.dirtyPriceAmountMinor`.
//
// ─── PORTFOLIO ENRICHMENT (maturity / sale) ─────────────────────────────────
// BondMatured / BondSold do NOT carry `portfolio`. The caller resolves the real
// portfolio from the originating BondTradeExecuted and supplies it as
// `event.enrichment.portfolio`, defaulting to "banking-book" for maturity and
// "trading-book" for sale when the opening event is not found.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 2, CEO-approved
//            2026-06-05); D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved
//            2026-06-05).
// Cites: IFRS 9 §3.1.1, §3.2.3, §5.1.1, §5.4.1, §5.7.1.

import type { SlaRule } from "../generated/sla-types";

/** Product key — every bond rule resolves accounts under this product. */
const BOND = "BOND" as const;

// ---------------------------------------------------------------------------
// PR-BOND-001 — BondTradeExecuted (initial recognition; banking vs trading)
//
// Legacy (buy):  Dr Bond Asset[portfolio] dirtyPriceAmount / Cr Nostro
//        (sell): Dr Nostro / Cr Bond Asset[portfolio]
// Line ORDER mirrors the legacy output exactly. The asset account is chosen by
// `event.portfolio` via per-line `when` predicates; the side is chosen by
// `event.side`. dirtyPriceAmount is the pre-computed enrichment amount.
// ---------------------------------------------------------------------------

export const PR_BOND_001: SlaRule = {
  rule_id: "PR-BOND-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "BondTradeExecuted",
    instrument_type: BOND,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.1.1, §5.1.1 — recognition on trade date at dirty price",
  },
  lines: [
    // ── BUY: Dr Bond Asset[portfolio]; Cr Nostro ──
    {
      account: { logical: "bond.asset_banking", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "event.enrichment.dirtyPriceAmountMinor",
      currency: "event.currency",
      when: "event.side == 'buy' && event.portfolio == 'banking-book'",
    },
    {
      account: { logical: "bond.asset_trading", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "event.enrichment.dirtyPriceAmountMinor",
      currency: "event.currency",
      when: "event.side == 'buy' && event.portfolio == 'trading-book'",
    },
    {
      account: { logical: "bond.nostro", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "event.enrichment.dirtyPriceAmountMinor",
      currency: "event.currency",
      when: "event.side == 'buy'",
    },
    // ── SELL: Dr Nostro; Cr Bond Asset[portfolio] ──
    {
      account: { logical: "bond.nostro", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "event.enrichment.dirtyPriceAmountMinor",
      currency: "event.currency",
      when: "event.side == 'sell'",
    },
    {
      account: { logical: "bond.asset_banking", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "event.enrichment.dirtyPriceAmountMinor",
      currency: "event.currency",
      when: "event.side == 'sell' && event.portfolio == 'banking-book'",
    },
    {
      account: { logical: "bond.asset_trading", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "event.enrichment.dirtyPriceAmountMinor",
      currency: "event.currency",
      when: "event.side == 'sell' && event.portfolio == 'trading-book'",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.1.1", "urn:obligation:ifrs:ifrs9:5.1.1"],
};

// ---------------------------------------------------------------------------
// PR-BOND-EIR — BondInterestAccrued (effective-interest accrual)
//
// Legacy: accruedInterestMinor == 0 → []; else Dr AccruedInterestReceivable /
// Cr InterestIncome (EIR). Zero-skip ported via condition: non-zero-delta.
// ---------------------------------------------------------------------------

export const PR_BOND_EIR: SlaRule = {
  rule_id: "PR-BOND-EIR",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "BondInterestAccrued",
    instrument_type: BOND,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail: "IFRS 9 §5.4.1 — EIR accrual; zero-amount periods produce no posting",
    delta_path: "abs(event.accruedInterestMinor)",
  },
  lines: [
    {
      account: { logical: "bond.accrued_interest_receivable", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.accruedInterestMinor)",
      currency: "event.currency",
    },
    {
      account: { logical: "bond.interest_income_eir", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.accruedInterestMinor)",
      currency: "event.currency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.4.1"],
};

// ---------------------------------------------------------------------------
// PR-BOND-002 — BondPositionRevalued (FVTPL revaluation, trading book)
//
// Legacy: delta == 0 → []; gain (delta>0): Dr Bond Asset Trading / Cr Unrealised
// P&L; loss (delta<0): Dr Unrealised P&L / Cr Bond Asset Trading. Amounts are
// abs(delta). Zero-skip ported via condition: non-zero-delta. The gain/loss
// direction is expressed as per-line `when` predicates on the signed delta.
// ---------------------------------------------------------------------------

export const PR_BOND_002: SlaRule = {
  rule_id: "PR-BOND-002",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "BondPositionRevalued",
    instrument_type: BOND,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail: "IFRS 9 §5.7.1 — FVTPL mark-to-market; zero delta produces no posting",
    delta_path: "event.unrealisedPnlZarMinor",
  },
  lines: [
    // Gain: Dr Bond Asset Trading; Cr Unrealised P&L.
    {
      account: { logical: "bond.asset_trading", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.unrealisedPnlZarMinor)",
      currency: "event.currency",
      when: "event.unrealisedPnlZarMinor > 0",
    },
    {
      account: { logical: "bond.unrealised_pnl", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.unrealisedPnlZarMinor)",
      currency: "event.currency",
      when: "event.unrealisedPnlZarMinor > 0",
    },
    // Loss: Dr Unrealised P&L; Cr Bond Asset Trading.
    {
      account: { logical: "bond.unrealised_pnl", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.unrealisedPnlZarMinor)",
      currency: "event.currency",
      when: "event.unrealisedPnlZarMinor < 0",
    },
    {
      account: { logical: "bond.asset_trading", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.unrealisedPnlZarMinor)",
      currency: "event.currency",
      when: "event.unrealisedPnlZarMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.7.1"],
};

// ---------------------------------------------------------------------------
// PR-BOND-MAT — BondMatured (derecognition at maturity)
//
// Legacy line order (bondMaturityJournals):
//   1. Dr Nostro                          (nominalRepaid + finalCoupon)
//   2. Cr AccruedInterestReceivable       (finalCoupon)   [only if finalCoupon>0]
//   3. Cr Bond Asset[portfolio]           (nominalRepaid)
// The asset account is chosen by `event.enrichment.portfolio` (legacy default
// "banking-book", supplied by the caller). The accrued-interest leg is gated on
// finalCoupon > 0 (legacy `if (finalCouponMinor > 0)`).
// ---------------------------------------------------------------------------

export const PR_BOND_MAT: SlaRule = {
  rule_id: "PR-BOND-MAT",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "BondMatured",
    instrument_type: BOND,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.2.3 — derecognition on principal repayment at maturity",
  },
  lines: [
    // 1. Dr Nostro — total cash received (nominal + final coupon).
    {
      account: { logical: "bond.nostro", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.nominalRepaidMinor) + abs(event.finalCouponMinor)",
      currency: "event.currency",
    },
    // 2. Cr AccruedInterestReceivable — final coupon (only when > 0).
    {
      account: { logical: "bond.accrued_interest_receivable", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.finalCouponMinor)",
      currency: "event.currency",
      when: "abs(event.finalCouponMinor) > 0",
    },
    // 3. Cr Bond Asset[portfolio] — nominal derecognised. Exactly one fires.
    {
      account: { logical: "bond.asset_banking", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.nominalRepaidMinor)",
      currency: "event.currency",
      when: "event.enrichment.portfolio == 'banking-book'",
    },
    {
      account: { logical: "bond.asset_trading", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.nominalRepaidMinor)",
      currency: "event.currency",
      when: "event.enrichment.portfolio == 'trading-book'",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};

// ---------------------------------------------------------------------------
// PR-BOND-SALE — BondSold (derecognition on sale)
//
// Legacy line order (bondSaleJournals):
//   1. Dr Nostro                           (saleProceeds)
//   Gain / break-even (realisedPnl >= 0):
//     2. Cr Bond Asset[portfolio]          (carryingAmountAtSale)
//     3. Cr Realised P&L                   (realisedPnl)  [only if realisedPnl>0]
//   Loss (realisedPnl < 0):
//     2. Dr Realised P&L                   (|realisedPnl|)
//     3. Cr Bond Asset[portfolio]          (carryingAmountAtSale)
// The asset account is chosen by `event.enrichment.portfolio` (legacy default
// "trading-book", supplied by the caller).
//
// NOTE ON LINE ORDER: in the loss branch the legacy emits Dr Realised P&L BEFORE
// Cr Bond Asset; in the gain branch Cr Bond Asset comes BEFORE Cr Realised P&L.
// The `when`-gated lines below are ordered to reproduce both branch orders
// exactly (the gain asset/pnl lines precede the loss pnl/asset lines, and only
// the matching branch's lines fire).
// ---------------------------------------------------------------------------

export const PR_BOND_SALE: SlaRule = {
  rule_id: "PR-BOND-SALE",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "BondSold",
    instrument_type: BOND,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.2.3 — derecognition on disposal; realised P&L = proceeds − carrying",
  },
  lines: [
    // 1. Dr Nostro — sale proceeds (both branches).
    {
      account: { logical: "bond.nostro", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.saleProceedsMinor)",
      currency: "event.currency",
    },
    // ── GAIN / break-even branch (realisedPnl >= 0) ──
    // 2. Cr Bond Asset[portfolio] — carrying amount.
    {
      account: { logical: "bond.asset_banking", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.carryingAmountAtSaleMinor)",
      currency: "event.currency",
      when: "event.realisedPnlMinor >= 0 && event.enrichment.portfolio == 'banking-book'",
    },
    {
      account: { logical: "bond.asset_trading", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.carryingAmountAtSaleMinor)",
      currency: "event.currency",
      when: "event.realisedPnlMinor >= 0 && event.enrichment.portfolio == 'trading-book'",
    },
    // 3. Cr Realised P&L — gain (only when realisedPnl > 0).
    {
      account: { logical: "bond.realised_pnl", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.realisedPnlMinor > 0",
    },
    // ── LOSS branch (realisedPnl < 0) ──
    // 2. Dr Realised P&L — loss.
    {
      account: { logical: "bond.realised_pnl", product: BOND, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.realisedPnlMinor < 0",
    },
    // 3. Cr Bond Asset[portfolio] — full carrying amount.
    {
      account: { logical: "bond.asset_banking", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.carryingAmountAtSaleMinor)",
      currency: "event.currency",
      when: "event.realisedPnlMinor < 0 && event.enrichment.portfolio == 'banking-book'",
    },
    {
      account: { logical: "bond.asset_trading", product: BOND, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.carryingAmountAtSaleMinor)",
      currency: "event.currency",
      when: "event.realisedPnlMinor < 0 && event.enrichment.portfolio == 'trading-book'",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};
