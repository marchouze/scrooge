// platform/accounting/sla/rules/pr-fx-fwd-points-accrual.ts
//
// PR-FX-FWD-POINTS-ACCRUAL — IFRS daily forward-points amortisation.
//
// Triggered by: FxForwardPointsAccrued
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//            IAS 21 §28 (exchange differences on settlement of monetary items)
// Author: Nadia (Model validation engineer, engineering).
//
// ACCOUNTING RATIONALE:
//   FX forward and swap far-leg contracts carry a forward premium or discount
//   equal to (contractedForwardRate − spotRateAtTradeDate) × notionalFcy.
//   IAS 21.28 requires exchange differences on monetary items to be recognised
//   in profit or loss in the period in which they arise. For derivatives held
//   at FVTPL the time-value component (forward points) is amortised on a
//   straight-line basis over the contract tenor.
//
//   The accounting entry for each DAILY accrual slice (non-final days):
//     Premium (dailyAmortisedZarMinor > 0):
//       Dr fx.forward_points_deferred_income  / Cr fx.forward_points_pnl
//       (reduces the deferred income balance; recognises income today)
//     Discount (dailyAmortisedZarMinor < 0):
//       Dr fx.forward_points_pnl  / Cr fx.forward_points_deferred_expense
//       (increases the deferred expense balance; recognises cost today)
//
//   On the FINAL accrual day (isFinalAccrual = true) the rule also clears any
//   remaining cumulative deferred balance — handled by PR-FX-FWD-POINTS-CLEAR.
//
// OPENING ENTRY (at trade date, not covered by this rule):
//   When the forward is booked the full forward-points amount is deferred:
//     Premium → Cr fx.forward_points_deferred_income  Dr fx.receivable[ZAR]
//     Discount → Dr fx.forward_points_deferred_expense Cr fx.payable[ZAR]
//   This initial deferral is a Bea build-item and NOT in scope of this rule,
//   which only handles the DAILY slice (day-1 onwards).
//
// SPOT-GATE NOTE: instrument_type is omitted on this rule because
//   FxForwardPointsAccrued does not carry a flat spot-stamp — it is
//   purpose-built for FX-forward / FX-swap and the product discriminant
//   lives in the event's legKind field (outright | far). The SLA interpreter
//   matches by event_type only when instrument_type is absent.
//
// Cites: IAS 21 §28; IFRS 9 §5.7.1; D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL.

import type { SlaRule } from "../generated/sla-types";

// ---------------------------------------------------------------------------
// PR-FX-FWD-POINTS-ACCRUAL (non-final days)
// ---------------------------------------------------------------------------

export const PR_FX_FWD_POINTS_ACCRUAL: SlaRule = {
  rule_id: "PR-FX-FWD-POINTS-ACCRUAL",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FxForwardPointsAccrued",
    // No instrument_type: FxForwardPointsAccrued is forward/swap-only; the
    // event itself is the discriminant (IAS 21 §28 amortisation).
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail:
      "IAS 21 §28 — forward-points daily amortisation slice; zero slice → no posting.",
    delta_path: "event.dailyAmortisedZarMinor",
  },
  lines: [
    // ── Premium slice (dailyAmortisedZarMinor > 0): income day ──
    // Recognise income: Dr deferred-income (reduces liability) / Cr P&L
    {
      account: { logical: "fx.forward_points_deferred_income", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.dailyAmortisedZarMinor)",
      currency: "ZAR",
      when: "event.dailyAmortisedZarMinor > 0",
    },
    {
      account: { logical: "fx.forward_points_pnl", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.dailyAmortisedZarMinor)",
      currency: "ZAR",
      when: "event.dailyAmortisedZarMinor > 0",
    },
    // ── Discount slice (dailyAmortisedZarMinor < 0): cost day ──
    // Recognise cost: Dr P&L / Cr deferred-expense (increases asset)
    {
      account: { logical: "fx.forward_points_pnl", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.dailyAmortisedZarMinor)",
      currency: "ZAR",
      when: "event.dailyAmortisedZarMinor < 0",
    },
    {
      account: { logical: "fx.forward_points_deferred_expense", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.dailyAmortisedZarMinor)",
      currency: "ZAR",
      when: "event.dailyAmortisedZarMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: [
    "urn:obligation:ifrs:ias21:28",
    "urn:obligation:ifrs:ifrs9:5.7.1",
    "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
  ],
};

// ---------------------------------------------------------------------------
// Design note — no separate "clear" rule.
//
// Under strict straight-line amortisation, the close engine emits one
// FxForwardPointsAccrued per calendar day with:
//   dailyAmortisedZarMinor = round(totalForwardPointsZarMinor / tenorCalendarDays)
//   (last day absorbs the rounding remainder)
//
// After exactly tenorCalendarDays emissions the sum of dailyAmortisedZarMinor
// equals totalForwardPointsZarMinor. The deferred-income/expense balance
// returns to zero naturally — no separate "clear" entry is required. The
// isFinalAccrual flag on the payload is informational only; it lets consumers
// assert completeness and close open positions, but does not require a
// separate rule-firing.
// ---------------------------------------------------------------------------
