// platform/accounting/sla/rules/pr-fx-002.ts
//
// PR-FX-002 — IFRS daily FX revaluation (FVTPL), rules-as-data form of the
// legacy `fxRevaluationJournals` (platform/accounting/posting-rules/fx-spot.ts).
//
// Legacy behaviour (per FxPositionRevalued.unrealisedPnlZarMinor = signed Δ):
//   delta === 0           → no posting (zero-delta guard → condition non-zero-delta)
//   delta  >  0 (gain)    → Dr fx.receivable[ZAR] / Cr fx.unrealised_pnl
//   delta  <  0 (loss)    → Dr fx.unrealised_pnl  / Cr fx.receivable[ZAR]
//   amount = abs(delta), all ZAR (functional currency); no OCI (FVTPL, IFRS 9 §5.7.1).
//
// The gain/loss branch is expressed in DATA via per-line `when` predicates
// (spec §3.1): each currency sub-entry's two lines fire only on their branch.
// `condition.kind: non-zero-delta` + `delta_path` ports the `if (delta===0) return []`
// guard verbatim.
//
// Authored by: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Cites: IFRS 9 §5.7.1 (FVTPL changes through P&L), IAS 21 §28 (closing-rate retranslation).

import type { SlaRule } from "../generated/sla-types";

export const PR_FX_002: SlaRule = {
  rule_id: "PR-FX-002",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FxPositionRevalued",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail: "IFRS 9 §5.7.1 — FVTPL fair-value change recognised in P&L; zero delta → no posting",
    delta_path: "event.unrealisedPnlZarMinor",
  },
  lines: [
    // Gain branch (delta > 0): Dr fx.receivable[ZAR] / Cr fx.unrealised_pnl
    {
      account: { logical: "fx.receivable", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.unrealisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.unrealisedPnlZarMinor > 0",
    },
    {
      account: { logical: "fx.unrealised_pnl", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.unrealisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.unrealisedPnlZarMinor > 0",
    },
    // Loss branch (delta < 0): Dr fx.unrealised_pnl / Cr fx.receivable[ZAR]
    {
      account: { logical: "fx.unrealised_pnl", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.unrealisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.unrealisedPnlZarMinor < 0",
    },
    {
      account: { logical: "fx.receivable", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.unrealisedPnlZarMinor)",
      currency: "ZAR",
      when: "event.unrealisedPnlZarMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.7.1", "urn:obligation:ifrs:ias21:28"],
};
