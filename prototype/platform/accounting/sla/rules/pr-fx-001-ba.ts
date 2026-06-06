// platform/accounting/sla/rules/pr-fx-001-ba.ts
//
// PR-FX-001-BA — SARB BA-350 net-open-position (NOP) memorandum classification
// for an FX-spot trade booking, expressed as rules-as-data (spec §3.2).
//
// This is the FIRST SECONDARY REPRESENTATION (D-SLA-FIRST-REPRESENTATION-SARB-BA,
// CFO Camille (Chief Financial Officer, finance)). It proves the parallel-basis
// fan-out: the SAME `FxTradeExecuted` event that produces the IFRS trading
// receivable/payable split (PR-FX-001) ALSO produces — independently and in
// parallel — this differing SARB regulatory-basis entry. One event → two
// `ProposedPosting`s, one per representation, each balanced independently
// (Phase-0 spec §2.2).
//
// ─── The differing basis ────────────────────────────────────────────────────
// The SARB BA-350 (foreign-currency exposure / net-open-position return)
// classifies an internal FX-spot booking by the GROSS OPEN POSITION it creates,
// not by the IFRS trading sub-ledger split. A buy USD / sell ZAR booking opens a
// USD LONG position; the regulatory memo records that as a balanced
// long-vs-short pair on the receive-leg currency (the bought currency is the
// long position; the offset is the short memo). Concretely (per spec §3.2):
//   Dr reg.nop_long  [receiveCurrency]  = |near.counterNotional.amountMinor|
//   Cr reg.nop_short [receiveCurrency]  = |near.counterNotional.amountMinor|
// The memo balances per currency (long == short within the bought currency) and
// lands in a SEPARATE physical account range (ACC-9000-xxx) than the IFRS
// trading accounts (ACC-2100-xxx) — "differing regulatory requirements"
// satisfied STRUCTURALLY by a parallel rule set, not by an `if (basis)` branch.
//
// ─── Account resolution (resolver.ts, SARB-BA-RETURN rows) ──────────────────
//   reg.nop_long  → ACC-9000-001 (NOP Memorandum — Long, debit)
//   reg.nop_short → ACC-9000-002 (NOP Memorandum — Short, credit)
// Both accounts are multi-currency NOP memos (per-entry currency authoritative).
// A currency with no resolver row follows the SAME no-silent-fallback discipline
// as the IFRS resolver: unmapped currency → FX unresolved-currency suspense
// (ACC-2100-007) + a high-severity urgent-correction alert
// (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE) — but because the NOP memo rows are
// authored as multi-currency (any traded currency resolves), this is the
// permanent last-resort safety net only.
//
// ─── ACTIVATED IN PRODUCTION (SARB activation Round 3 — the flip) ────────────
// The production GL posting engine (`bea-gl-posting-engine.ts` via
// `bea-gl-fx-interpreter-cutover.ts`) now calls
// `interpret(..., ["IFRS","SARB-BA-RETURN"], ...)` — every FX booking yields the
// IFRS trading split AND this SARB NOP memo, each balanced independently. The
// rule is interpreter-eligible only because it carries a four-eyes SlaRuleApproved
// (approver Camille ≠ publisher Bea); the CFO+CoSec joint activation Decisions are
// on the log. Additivity holds: the IFRS posting is byte-for-byte unchanged.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4, CEO-approved 2026-06-06);
//            D-SLA-FIRST-REPRESENTATION-SARB-BA (CFO Camille);
//            D-SLA-SARB-ACTIVATION-CFO + D-SLA-SARB-BA-RETURN-ACTIVATION-COSEC
//            (joint production activation, Round 3).
// Cites: SARB BA 350 (net open position); Banks Act 94 of 1990 (exposure).

import type { SlaRule } from "../generated/sla-types";

export const PR_FX_001_BA: SlaRule = {
  rule_id: "PR-FX-001-BA",
  representation: "SARB-BA-RETURN",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FxTradeExecuted",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
    regulatory_regime: "SARB-banks-act",
  },
  condition: {
    kind: "always",
    detail: "SARB BA-350 — FX net open position memorandum classification",
  },
  lines: [
    // The bought (receive-leg) currency is the LONG open position; the offset is
    // the SHORT memo. Both legs carry the receive-leg currency so the NOP memo
    // balances per currency (long == short). Amount = receive-leg notional.
    {
      account: { logical: "reg.nop_long", currency: "event.near.receiveCurrency" },
      side: "debit",
      amount: "abs(event.near.counterNotional.amountMinor)",
      currency: "event.near.receiveCurrency",
    },
    {
      account: { logical: "reg.nop_short", currency: "event.near.receiveCurrency" },
      side: "credit",
      amount: "abs(event.near.counterNotional.amountMinor)",
      currency: "event.near.receiveCurrency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:sarb:ba350:nop", "urn:obligation:reg:banks-act:fx-exposure"],
};
