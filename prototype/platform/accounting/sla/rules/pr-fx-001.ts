// platform/accounting/sla/rules/pr-fx-001.ts
//
// PR-FX-001 — IFRS FX trade-booking, expressed as rules-as-data (spec §3.2).
//
// The sole production posting path for FX trade-booking. The interpreter suite
// (tests/sla-pr-fx-001-interpreter.test.ts) pins the leg footprint on real
// FxTradeExecuted fixtures. `fxTradeBookingJournals` (fx-spot.ts) remains the
// shared leg-construction helper this rule's account mapping mirrors.
//
// Legacy posting (per the natural-side convention, fx-spot.ts §PR-FX-001):
//   payCcy sub-entry:     Dr Receivable[payCcy]     / Cr Payable[payCcy]
//                          amount = |near.notional.amountMinor|
//   receiveCcy sub-entry: Dr Receivable[receiveCcy] / Cr Payable[receiveCcy]
//                          amount = |near.counterNotional.amountMinor|
//
// The line ORDER matches the legacy output exactly: receivable(pay),
// payable(pay), receivable(recv), payable(recv).
//
// Account resolution (resolver.ts) — PER-CURRENCY (USD=USD; no FCY pool):
//   fx.receivable ZAR → ACC-2100-001 ; USD → ACC-2100-002
//   fx.payable    ZAR → ACC-2100-003 ; USD → ACC-2100-004
// A non-ZAR/USD leg (EUR/GBP/JPY/…) has no dedicated account → the interpreter
// routes it to the FX unresolved-currency suspense ACC-2100-007 + raises a
// high-severity urgent-correction alert (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE),
// NEVER a silent USD fallback.
//
// Authored by: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05);
//            D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05).
// Cites: IFRS 9 §3.1.1 (trade-date recognition), IAS 21 §21.

import type { SlaRule } from "../generated/sla-types";

export const PR_FX_001: SlaRule = {
  rule_id: "PR-FX-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FxTradeExecuted",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: { kind: "always", detail: "IFRS 9 §3.1.1 — recognition on trade date" },
  lines: [
    // payCcy sub-entry: Dr Receivable[payCcy] / Cr Payable[payCcy]
    {
      account: { logical: "fx.receivable", currency: "event.near.payCurrency" },
      side: "debit",
      amount: "abs(event.near.notional.amountMinor)",
      currency: "event.near.payCurrency",
    },
    {
      account: { logical: "fx.payable", currency: "event.near.payCurrency" },
      side: "credit",
      amount: "abs(event.near.notional.amountMinor)",
      currency: "event.near.payCurrency",
    },
    // receiveCcy sub-entry: Dr Receivable[receiveCcy] / Cr Payable[receiveCcy]
    {
      account: { logical: "fx.receivable", currency: "event.near.receiveCurrency" },
      side: "debit",
      amount: "abs(event.near.counterNotional.amountMinor)",
      currency: "event.near.receiveCurrency",
    },
    {
      account: { logical: "fx.payable", currency: "event.near.receiveCurrency" },
      side: "credit",
      amount: "abs(event.near.counterNotional.amountMinor)",
      currency: "event.near.receiveCurrency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.1.1", "urn:obligation:ifrs:ias21:21"],
};
