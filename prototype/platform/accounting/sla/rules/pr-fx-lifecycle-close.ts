// platform/accounting/sla/rules/pr-fx-lifecycle-close.ts
//
// PR-FX-LIFECYCLE-CLOSE — IFRS realised-P&L residual on the CDM
// SettlementConfirmed lifecycle-close event. Rules-as-data form of the legacy
// `fxLifecycleCloseJournals` (platform/accounting/posting-rules/fx-spot.ts).
//
// Legacy behaviour (SettlementConfirmed.realisedPnlDelta = signed ZAR minor):
//   realisedPnlDelta === 0 → no posting
//   realisedPnlDelta  >  0 (gain) → Dr fx.nostro[ZAR]    / Cr fx.realised_pnl
//   realisedPnlDelta  <  0 (loss) → Dr fx.realised_pnl   / Cr fx.nostro[ZAR]
//   amount = abs(realisedPnlDelta), all ZAR (functional currency, IAS 21 §28).
//
// The principal cash legs are derecognised by PR-FX-PRIN on the two
// PrincipalPayment events; this rule records ONLY the realised-P&L residual and
// closes the trade. Gain/loss branch expressed in DATA via per-line `when`;
// `condition.kind: non-zero-pnl` ports the `if (pnl === 0) return []` guard.
//
// Authored by: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Cites: IFRS 9 §3.2.3 (derecognition), IAS 21 §28 (settlement-date P&L).

import type { SlaRule } from "../generated/sla-types";

export const PR_FX_LIFECYCLE_CLOSE: SlaRule = {
  rule_id: "PR-FX-LIFECYCLE-CLOSE",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "SettlementConfirmed",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-pnl",
    detail: "IAS 21 §28 — realised-P&L residual recognised on settlement; zero → no posting",
    delta_path: "event.realisedPnlDelta",
  },
  lines: [
    // Gain branch (pnl > 0): Dr fx.nostro[ZAR] / Cr fx.realised_pnl
    {
      account: { logical: "fx.nostro", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlDelta)",
      currency: "ZAR",
      when: "event.realisedPnlDelta > 0",
    },
    {
      account: { logical: "fx.realised_pnl", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlDelta)",
      currency: "ZAR",
      when: "event.realisedPnlDelta > 0",
    },
    // Loss branch (pnl < 0): Dr fx.realised_pnl / Cr fx.nostro[ZAR]
    {
      account: { logical: "fx.realised_pnl", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlDelta)",
      currency: "ZAR",
      when: "event.realisedPnlDelta < 0",
    },
    {
      account: { logical: "fx.nostro", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlDelta)",
      currency: "ZAR",
      when: "event.realisedPnlDelta < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3", "urn:obligation:ifrs:ias21:28"],
};
