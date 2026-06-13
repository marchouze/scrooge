// platform/accounting/sla/rules/pr-fx-realised-pnl.ts
//
// PR-FX-REALISED-PNL — IFRS realised P&L recognition on close-out of a desk
// FCY cash instrument.
//
// Triggered by: RealisedPnlRecognised event
// Authority: D-FIL-BOOK-COMPOSITE-VALUATION (CEO-approved 2026-06-13)
// Author: Atlas (Core banking platform architect, engineering) /
//         Bea (Accounting & financial reporting engineer, engineering) — GL posting design.
//
// ACCOUNTING RATIONALE:
//   When the desk disposes of (part of) an FCY cash position, the Δ between
//   the disposal proceeds rate (ZAR per FCY) and the weighted-average carrying
//   cost rate crystallises as realised P&L (IAS 21 §28: exchange differences
//   recognised in profit or loss on settlement of monetary items).
//
//   The amount is:
//     realisedPnlZarMinor = (disposalCostZarRate − avgCostZarRate) × amountClosedMinor
//   carried on the RealisedPnlRecognised payload.
//
// POSTING:
//   Gain (pnl > 0):  Dr fx.nostro[settlementCcy]  / Cr fx.realised_pnl[ZAR]
//   Loss (pnl < 0):  Dr fx.realised_pnl[ZAR]      / Cr fx.nostro[settlementCcy]
//   amount = |realisedPnlZarMinor|; currency = ZAR.
//
// NOTE: this rule REPLACES pr-fx-lifecycle-close.ts (PR-FX-LIFECYCLE-CLOSE),
// which was triggered by SettlementConfirmed and posted the _broken_
// (officialMark − bookRate) × notional formula (an asset swap, not realised
// P&L — see RETIRED note in that file). The correct figure comes from the
// RealisedPnlRecognised event emitted by the currency-position close-out path.
//
// Cites: IAS 21 §28, IFRS 9 §5.7.1 (FVTPL P&L), D-FIL-BOOK-COMPOSITE-VALUATION.

import type { SlaRule } from "../generated/sla-types";

export const PR_FX_REALISED_PNL: SlaRule = {
  rule_id: "PR-FX-REALISED-PNL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "RealisedPnlRecognised",
    // The RealisedPnlRecognised event originates from FX cash-instrument
    // close-outs (FX-spot book). instrument_type omitted (the event does not
    // carry an instrument_type discriminant; all RealisedPnlRecognised events
    // are FX-book in origin).
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-pnl",
    detail:
      "IAS 21 §28 — realised exchange difference recognised on disposal of FCY monetary item; zero → no posting",
    delta_path: "event.realisedPnlZarMinor",
  },
  lines: [
    // Gain branch (pnl > 0): Dr fx.nostro[ZAR] / Cr fx.realised_pnl[ZAR]
    {
      account: { logical: "fx.nostro", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.realisedPnlZarMinor > 0",
    },
    {
      account: { logical: "fx.realised_pnl", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.realisedPnlZarMinor > 0",
    },
    // Loss branch (pnl < 0): Dr fx.realised_pnl[ZAR] / Cr fx.nostro[ZAR]
    {
      account: { logical: "fx.realised_pnl", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.realisedPnlZarMinor < 0",
    },
    {
      account: { logical: "fx.nostro", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.realisedPnlZarMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ias21:28", "urn:obligation:ifrs:ifrs9:5.7.1"],
};
