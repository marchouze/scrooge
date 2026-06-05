// platform/accounting/sla/rules/pr-equity.ts
//
// JSE equity lifecycle IFRS posting rules, expressed as rules-as-data. Data form
// of the legacy `equityTradeBookingJournals / equityRevaluationJournals /
// equityDividendJournals / equitySaleJournals` functions
// (platform/accounting/posting-rules/equities.ts). The parallel-run regression
// (tests/sla-securities-lifecycle-parallel-run.test.ts) asserts the
// interpreter's legs match the legacy engine BYTE-FOR-BYTE, including the FVOCI
// OCI-vs-P&L split on sale, dividend WHT, and FVTPL revaluation.
//
// Coverage (one rule per posting-producing registry entry + the memo rule):
//   PR-EQ-001      EquityTradeExecuted   — initial recognition (FVTPL, at cost)
//   PR-EQ-002      EquityPositionRevalued — FVTPL revaluation (P&L)
//   PR-EQ-CA       EquityDividendAccrued — dividend income + WHT
//   PR-EQ-INSTRUCT EquitySettlementInstructed — intentional-no-impact memo
//   PR-EQ-004      EquitySold            — derecognition (FVTPL P&L / FVOCI OCI)
//
// ─── PAYLOAD SHAPES ─────────────────────────────────────────────────────────
// The CDM events (EquityTradeExecuted, EquityPositionRevalued) carry nested
// Money objects (`consideration.amountMinor` / `.currency`,
// `unrealisedPnl.amountMinor` / `.currency`). The GL-specific events
// (EquityDividendAccrued, EquitySold) carry flat minor-unit fields. The flat
// context builder exposes both directly, so a rule reads
// `event.consideration.amountMinor` (nested) or `event.netDividendMinor` (flat)
// uniformly as event paths.
//
// ─── FVTPL vs FVOCI SPLIT (sale) ────────────────────────────────────────────
// EquitySold carries `classification` ("fvtpl" | "fvoci"). FVTPL recycles the
// realised P&L through P&L (§5.7.1); FVOCI does NOT recycle (§5.7.5) — instead
// the cumulative OCI reserve is reclassified to retained earnings WITHIN equity.
// The two treatments are expressed as `when`-gated lines on
// `event.classification` (mirroring the treasury category approach). Exactly one
// classification branch fires.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 2, CEO-approved
//            2026-06-05); D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved
//            2026-06-05).
// Cites: IFRS 9 §3.1.1, §3.2.3, §5.1.1, §5.7.1, §5.7.1A, §5.7.5; IAS 32 §35.

import type { SlaRule } from "../generated/sla-types";

/** Product key — every equity rule resolves accounts under this product. */
const EQUITY = "EQUITY" as const;

// ---------------------------------------------------------------------------
// PR-EQ-001 — EquityTradeExecuted (initial recognition at cost; FVTPL)
//
// Legacy: Dr Equity Asset FVTPL consideration / Cr Nostro consideration.
// All CDM equity trades are FVTPL (trading book). Amount + currency come from
// the nested `consideration` Money object.
// ---------------------------------------------------------------------------

export const PR_EQ_001: SlaRule = {
  rule_id: "PR-EQ-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "EquityTradeExecuted",
    instrument_type: EQUITY,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.1.1, §5.1.1 — trade-date recognition at consideration (FVTPL)",
  },
  lines: [
    {
      account: { logical: "equity.asset_fvtpl", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "event.consideration.amountMinor",
      currency: "event.consideration.currency",
    },
    {
      account: { logical: "equity.nostro", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "event.consideration.amountMinor",
      currency: "event.consideration.currency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.1.1", "urn:obligation:ifrs:ifrs9:5.1.1"],
};

// ---------------------------------------------------------------------------
// PR-EQ-002 — EquityPositionRevalued (FVTPL revaluation through P&L)
//
// Legacy: delta == 0 → []; gain (delta>0): Dr Equity Asset FVTPL / Cr Unrealised
// P&L FVTPL; loss (delta<0): Dr Unrealised P&L FVTPL / Cr Equity Asset FVTPL.
// Amount + currency from the nested `unrealisedPnl` Money object. Zero-skip via
// condition: non-zero-delta. Direction via per-line `when` predicates.
// ---------------------------------------------------------------------------

export const PR_EQ_002: SlaRule = {
  rule_id: "PR-EQ-002",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "EquityPositionRevalued",
    instrument_type: EQUITY,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail: "IFRS 9 §5.7.1 — FVTPL fair-value movement through P&L; zero delta → no posting",
    delta_path: "event.unrealisedPnl.amountMinor",
  },
  lines: [
    // Gain: Dr Equity Asset FVTPL; Cr Unrealised P&L FVTPL.
    {
      account: { logical: "equity.asset_fvtpl", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.unrealisedPnl.amountMinor)",
      currency: "event.unrealisedPnl.currency",
      when: "event.unrealisedPnl.amountMinor > 0",
    },
    {
      account: { logical: "equity.unrealised_pnl_fvtpl", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.unrealisedPnl.amountMinor)",
      currency: "event.unrealisedPnl.currency",
      when: "event.unrealisedPnl.amountMinor > 0",
    },
    // Loss: Dr Unrealised P&L FVTPL; Cr Equity Asset FVTPL.
    {
      account: { logical: "equity.unrealised_pnl_fvtpl", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.unrealisedPnl.amountMinor)",
      currency: "event.unrealisedPnl.currency",
      when: "event.unrealisedPnl.amountMinor < 0",
    },
    {
      account: { logical: "equity.asset_fvtpl", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.unrealisedPnl.amountMinor)",
      currency: "event.unrealisedPnl.currency",
      when: "event.unrealisedPnl.amountMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.7.1"],
};

// ---------------------------------------------------------------------------
// PR-EQ-CA — EquityDividendAccrued (dividend income + withholding tax)
//
// Legacy line order (equityDividendJournals):
//   grossDividendTotal == 0 → [].
//   With WHT (withholdingTax > 0):
//     1. Dr Dividend Receivable    (net)
//     2. Dr WHT Payable            (withholdingTax)
//     3. Cr Dividend Income        (gross)
//   Without WHT:
//     1. Dr Dividend Receivable    (net)   [== gross when no WHT]
//     2. Cr Dividend Income        (gross)
// Zero-skip ported via condition: non-zero-delta on grossDividendTotalMinor. The
// WHT leg is `when`-gated on withholdingTax > 0 (legacy `if (withholdingTax>0)`).
// In BOTH branches the receivable leg uses `netDividendMinor` (== gross when no
// WHT, so the no-WHT branch's two legs balance gross-against-gross), and the
// income leg uses gross — exactly as the legacy emits.
// ---------------------------------------------------------------------------

export const PR_EQ_CA: SlaRule = {
  rule_id: "PR-EQ-CA",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "EquityDividendAccrued",
    instrument_type: EQUITY,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail:
      "IFRS 9 §5.7.1A; IAS 32 §35 — dividend income recognised when right established; zero gross → no posting",
    delta_path: "abs(event.grossDividendTotalMinor)",
  },
  lines: [
    // 1. Dr Dividend Receivable — net (== gross when no WHT).
    {
      account: { logical: "equity.dividend_receivable", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.netDividendMinor)",
      currency: "event.currency",
    },
    // 2. Dr WHT Payable — only when withholding tax > 0.
    {
      account: { logical: "equity.withholding_tax_payable", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.withholdingTaxMinor)",
      currency: "event.currency",
      when: "event.withholdingTaxMinor > 0",
    },
    // 3. Cr Dividend Income — gross (both branches).
    {
      account: { logical: "equity.dividend_income", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.grossDividendTotalMinor)",
      currency: "event.currency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.7.1a", "urn:obligation:ias:ias32:35"],
};

// ---------------------------------------------------------------------------
// PR-EQ-INSTRUCT — EquitySettlementInstructed (settlement-system memo)
//
// Category C: genuinely zero-accounting-impact. EquitySettlementInstructed is a
// DVP dispatch memo to Strate; GL recognition fires on settlement confirmation
// (PR-EQ-004). intentional-no-impact — the interpreter returns the explicit skip
// (no legs), matching the legacy engine's no-posting path.
// ---------------------------------------------------------------------------

export const PR_EQ_INSTRUCT: SlaRule = {
  rule_id: "PR-EQ-INSTRUCT",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "EquitySettlementInstructed",
    instrument_type: EQUITY,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "intentional-no-impact",
    detail: "Settlement instruction memo; cash moves on confirmation [zero-impact-by-design]",
  },
  lines: [],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};

// ---------------------------------------------------------------------------
// PR-EQ-004 — EquitySold (derecognition; FVTPL P&L / FVOCI OCI split)
//
// Legacy line order (equitySaleJournals):
//   FVTPL:
//     1. Dr Nostro                (saleProceeds)
//     2. Cr Equity Asset FVTPL    (carryingAmount)
//     3a. gain (pnl>0): Cr Unrealised P&L FVTPL (pnl)
//     3b. loss (pnl<0): Dr Unrealised P&L FVTPL (|pnl|)
//   FVOCI (§5.7.5 — no recycling to P&L):
//     1. Dr Nostro                (saleProceeds)
//     2. Cr Equity Asset FVOCI    (carryingAmount)
//     3a. gain (pnl>0): Dr OCI Reserve (pnl)  / Cr Retained Earnings (pnl)
//     3b. loss (pnl<0): Dr Retained Earnings (|pnl|) / Cr OCI Reserve (|pnl|)
// The branches are `when`-gated on `event.classification` and the signed
// realisedPnl. Line order below reproduces both branches exactly: the FVTPL
// block (Nostro, asset, gain-cr/loss-dr) then the FVOCI block (Nostro, asset,
// gain Dr-OCI/Cr-RE then loss Dr-RE/Cr-OCI) — only the matching classification's
// lines fire.
// ---------------------------------------------------------------------------

export const PR_EQ_004: SlaRule = {
  rule_id: "PR-EQ-004",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "EquitySold",
    instrument_type: EQUITY,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.2.3 — derecognition on sale; FVOCI cumulative OCI not recycled (§5.7.5)",
  },
  lines: [
    // ════════════════════════════ FVTPL ════════════════════════════
    // 1. Dr Nostro — sale proceeds.
    {
      account: { logical: "equity.nostro", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.saleProceedsMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvtpl'",
    },
    // 2. Cr Equity Asset FVTPL — carrying amount.
    {
      account: { logical: "equity.asset_fvtpl", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.carryingAmountAtSaleMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvtpl'",
    },
    // 3a. Gain: Cr Unrealised P&L FVTPL.
    {
      account: { logical: "equity.unrealised_pnl_fvtpl", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvtpl' && event.realisedPnlMinor > 0",
    },
    // 3b. Loss: Dr Unrealised P&L FVTPL.
    {
      account: { logical: "equity.unrealised_pnl_fvtpl", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvtpl' && event.realisedPnlMinor < 0",
    },
    // ════════════════════════════ FVOCI ════════════════════════════
    // 1. Dr Nostro — sale proceeds.
    {
      account: { logical: "equity.nostro", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.saleProceedsMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvoci'",
    },
    // 2. Cr Equity Asset FVOCI — carrying amount.
    {
      account: { logical: "equity.asset_fvoci", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.carryingAmountAtSaleMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvoci'",
    },
    // 3a. Gain: Dr OCI Reserve / Cr Retained Earnings (reclassify within equity).
    {
      account: { logical: "equity.oci_reserve_fvoci", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvoci' && event.realisedPnlMinor > 0",
    },
    {
      account: { logical: "equity.retained_earnings", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvoci' && event.realisedPnlMinor > 0",
    },
    // 3b. Loss: Dr Retained Earnings / Cr OCI Reserve.
    {
      account: { logical: "equity.retained_earnings", product: EQUITY, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvoci' && event.realisedPnlMinor < 0",
    },
    {
      account: { logical: "equity.oci_reserve_fvoci", product: EQUITY, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.classification == 'fvoci' && event.realisedPnlMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3", "urn:obligation:ifrs:ifrs9:5.7.5"],
};
