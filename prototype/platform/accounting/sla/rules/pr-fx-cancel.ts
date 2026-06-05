// platform/accounting/sla/rules/pr-fx-cancel.ts
//
// PR-FX-CANCEL — IFRS trade-cancellation reversal. Rules-as-data form of the
// legacy `fxCancellationJournals` (platform/accounting/posting-rules/fx-spot.ts).
//
// ─── CONTEXT-ENRICHMENT (brief deliverable 2) ──────────────────────────────
// Cancellation reverses the trade's PRIOR postings — facts that live on prior
// `SubLedgerPostingEmitted` events, not on the cancellation event. The caller
// (GL posting engine, which already reconstructs these via its cancellation
// index) supplies them PRE-RESOLVED as enrichment:
//
//   event.enrichment.reversalBookingLegs : Array<{
//       accountId: ACC-NNNN-NNN,      // exact prior-posting account
//       debitCredit: "debit"|"credit",// ALREADY FLIPPED (reversal direction)
//       amountMinor: integer,         // minor units, magnitude
//       currency: ISO-4217 }>
//   event.enrichment.cumulativeUnrealisedPnlZarMinor : signed ZAR minor
//
// The interpreter stays PURE — it never reads the event store; the enrichment
// is a typed input. The reversal-booking-legs are expanded by the `for_each`
// construct (one leg per array element), bypassing the logical→physical
// resolver (`use_physical_account`) so the reversal lands on EXACTLY the
// accounts the original booking used — including any suspense account — and
// nets each prior posting to zero. The per-iteration side is read from the
// (already-flipped) `item.debitCredit` via `side_path`.
//
// ─── LEGACY BEHAVIOUR ──────────────────────────────────────────────────────
//   (i)  reverse every booking leg (flip debit↔credit) — variable count.
//   (ii) reverse cumulative unrealised P&L (one ZAR pair, direction by sign):
//          wasGain (cum > 0): Dr fx.unrealised_pnl / Cr fx.receivable[ZAR]
//          wasLoss (cum < 0): Dr fx.receivable[ZAR] / Cr fx.unrealised_pnl
//          amount = abs(cum), ZAR. cum === 0 → no P&L pair.
//
// Authored by: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Cites: IFRS 9 §3.2.3 (derecognition when rights/obligations extinguished).

import type { SlaRule } from "../generated/sla-types";

export const PR_FX_CANCEL: SlaRule = {
  rule_id: "PR-FX-CANCEL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    // Both event kinds carry `tradeId` at the payload root; the cancellation
    // reversal is identical. The interpreter's context-builder registry maps
    // both FxTradeCancelled and TradeCancelled to the flat FX builder.
    event_type: "FxTradeCancelled",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.2.3 — reverse all prior postings on cancellation (extinguished rights)",
  },
  lines: [
    // (i) Reverse every prior booking leg — one expanded leg per enrichment
    //     element, on the exact prior-posting account, with the already-flipped
    //     side carried on the element.
    {
      for_each: "event.enrichment.reversalBookingLegs",
      use_physical_account: true,
      account: { logical: "item.accountId", currency: "item.currency" },
      side: "debit", // placeholder; overridden by side_path
      side_path: "item.debitCredit",
      amount: "item.amountMinor",
      currency: "item.currency",
    },
    // (ii) Reverse cumulative unrealised P&L — wasGain branch.
    {
      account: { logical: "fx.unrealised_pnl", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.enrichment.cumulativeUnrealisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.enrichment.cumulativeUnrealisedPnlZarMinor > 0",
    },
    {
      account: { logical: "fx.receivable", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.enrichment.cumulativeUnrealisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.enrichment.cumulativeUnrealisedPnlZarMinor > 0",
    },
    // (ii) Reverse cumulative unrealised P&L — wasLoss branch.
    {
      account: { logical: "fx.receivable", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.enrichment.cumulativeUnrealisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.enrichment.cumulativeUnrealisedPnlZarMinor < 0",
    },
    {
      account: { logical: "fx.unrealised_pnl", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.enrichment.cumulativeUnrealisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.enrichment.cumulativeUnrealisedPnlZarMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};
