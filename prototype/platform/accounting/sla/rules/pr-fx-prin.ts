// platform/accounting/sla/rules/pr-fx-prin.ts
//
// PR-FX-PRIN — IFRS per-leg principal-payment cash, rules-as-data form of the
// legacy `fxPrincipalPaymentJournals` (platform/accounting/posting-rules/fx-spot.ts).
//
// Legacy behaviour (PrincipalPayment payload; one event per leg):
//   netCash === 0          → no posting (defensive; schema says non-zero)
//   legKind === "receive"  → Dr fx.nostro[ccy]   / Cr fx.receivable[ccy]
//   legKind === "deliver"  → Dr fx.payable[ccy]  / Cr fx.nostro[ccy]
//   amount = abs(netCash), currency = event.currency.
//
// The receive/deliver branch is expressed in DATA via per-line `when`
// predicates over `event.legKind`. `condition.kind: non-zero-delta` on
// `event.netCash` ports the `if (amount === 0) return []` guard.
//
// Per-currency resolution (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE): ZAR/USD (and
// EUR for nostro) resolve to dedicated accounts; any other currency
// account-resolution-misses → suspense (ACC-2100-007) + urgent-correction alert,
// NEVER the silent legacy USD/EUR fallback.
//
// Authored by: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05);
//            D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05).
// Cites: IFRS 9 §3.2.3 (derecognition on transfer of contractual cash flows),
//        IAS 21 §28 (settlement-date FX gain/loss recognition).

import type { SlaRule } from "../generated/sla-types";

export const PR_FX_PRIN: SlaRule = {
  rule_id: "PR-FX-PRIN",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "PrincipalPayment",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail: "IFRS 9 §3.2.3 — derecognise per-leg cash at correspondent confirmation",
    delta_path: "event.netCash",
  },
  lines: [
    // receive: Dr fx.nostro[ccy] / Cr fx.receivable[ccy]
    {
      account: { logical: "fx.nostro", currency: "event.currency" },
      side: "debit",
      amount: "abs(event.netCash)",
      currency: "event.currency",
      when: 'event.legKind == "receive"',
    },
    {
      account: { logical: "fx.receivable", currency: "event.currency" },
      side: "credit",
      amount: "abs(event.netCash)",
      currency: "event.currency",
      when: 'event.legKind == "receive"',
    },
    // deliver: Dr fx.payable[ccy] / Cr fx.nostro[ccy]
    {
      account: { logical: "fx.payable", currency: "event.currency" },
      side: "debit",
      amount: "abs(event.netCash)",
      currency: "event.currency",
      when: 'event.legKind == "deliver"',
    },
    {
      account: { logical: "fx.nostro", currency: "event.currency" },
      side: "credit",
      amount: "abs(event.netCash)",
      currency: "event.currency",
      when: 'event.legKind == "deliver"',
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3", "urn:obligation:ifrs:ias21:28"],
};
