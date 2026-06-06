// platform/accounting/sla/rules/pr-fx-ba-lifecycle.ts
//
// SARB BA-350 net-open-position (NOP) memorandum — the FX-lifecycle rules
// beyond trade booking, expressed as rules-as-data. Companion to PR-FX-001-BA
// (pr-fx-001-ba.ts), which owns the headline booking entry.
//
// ─── Lifecycle scope of the SARB-BA-RETURN NOP basis ────────────────────────
// The BA-350 NOP is a POSITION measure: the bank's net open foreign-currency
// exposure. That is materially different from the IFRS fair-value basis. The NOP
// changes ONLY when the open position itself opens or closes:
//
//   FxTradeExecuted  → PR-FX-001-BA   OPENS a position → NOP long/short memo.
//   FxTradeCancelled → PR-FX-CANCEL-BA REVERSES the position → unwind the memo.
//
// Every OTHER FX-lifecycle event is NOP-NEUTRAL and is modelled as an explicit
// `intentional-no-impact` rule (the ONLY legitimate non-posting outcome, spec
// §2.1 / §7.3) so the SARB representation is never "loud-by-absence":
//
//   FxPositionRevalued  → NOP is a notional/position measure, not a fair-value
//                         measure. Daily FVTPL revaluation does NOT change the
//                         open position. NOP-neutral.
//   PrincipalPayment    → settling a leg's cash does not change the NET open
//                         position (the bought-currency exposure persists until
//                         the currency is sold back). NOP-neutral.
//   SettlementConfirmed → physical settlement of an FX-spot does not change the
//                         net open position. NOP-neutral.
//   FxSettlementFailed  → a failed settlement is an IFRS credit-risk event
//                         (Stage-3 ECL); it does not alter the regulatory open
//                         position. NOP-neutral.
//   FxSettlementInstructed / TradeReportSubmitted → memos (no GL in any basis).
//
// ─── Cancellation reversal enrichment (PR-FX-CANCEL-BA) ─────────────────────
// The cancellation event does not carry the original trade's receive-leg
// notional, so the NOP reversal prices off a small, NOP-specific enrichment the
// caller supplies pre-resolved (same pure-interpreter discipline as the IFRS
// enrichment, spec §2.3):
//
//   event.enrichment.nopReversal : {
//       currency: ISO-4217,   // the original receive-leg (bought) currency
//       amountMinor: integer  // |original receive-leg counterNotional| (magnitude)
//   }
//
// The reversal flips the booking memo (Cr nop_long / Dr nop_short), netting the
// position memo to zero per currency. Until SARB-BA-RETURN is activated in
// production (CFO + Owen joint approval, Phase-4c), no caller computes this
// enrichment — the rule is exercised by tests + the dry-run preview only, where
// the enrichment is supplied directly. Wiring a NOP-enrichment builder into the
// FX cutover bridge is a Phase-4c activation task (flagged in the deliverable).
//
// NOT ACTIVATED IN PRODUCTION (see pr-fx-001-ba.ts header).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4, CEO-approved 2026-06-06);
//            D-SLA-FIRST-REPRESENTATION-SARB-BA (CFO Camille).
// Cites: SARB BA 350 (net open position); Banks Act 94 of 1990.

import type { SlaRule } from "../generated/sla-types";

const SARB_REGIME = "SARB-banks-act" as const;

/** Build a NOP-neutral intentional-no-impact rule for a lifecycle event type. */
function nopNeutralRule(args: {
  ruleId: string;
  eventType: string;
  detail: string;
  cites: readonly string[];
}): SlaRule {
  return {
    rule_id: args.ruleId,
    representation: "SARB-BA-RETURN",
    version: 1,
    effective_from: "2026-01-01",
    effective_to: null,
    applies_to: {
      event_type: args.eventType,
      instrument_type: "FX-spot",
      entity: "LE-ZA-HOZ-BANK",
      jurisdiction: "ZA",
      regulatory_regime: SARB_REGIME,
    },
    condition: { kind: "intentional-no-impact", detail: args.detail },
    lines: [],
    balancing: "assert_zero",
    cites: args.cites,
  };
}

/** FxTradeCancelled → reverse the NOP long/short memo for the original position. */
export const PR_FX_CANCEL_BA: SlaRule = {
  rule_id: "PR-FX-CANCEL-BA",
  representation: "SARB-BA-RETURN",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FxTradeCancelled",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
    regulatory_regime: SARB_REGIME,
  },
  condition: {
    kind: "always",
    detail: "SARB BA-350 — unwind the net open position memorandum on cancellation",
  },
  lines: [
    // Reverse the booking memo: Cr nop_long / Dr nop_short on the original
    // bought currency, magnitude = original receive-leg notional. Balances per
    // currency (nets the booking memo to zero).
    {
      account: { logical: "reg.nop_long", currency: "event.enrichment.nopReversal.currency" },
      side: "credit",
      amount: "abs(event.enrichment.nopReversal.amountMinor)",
      currency: "event.enrichment.nopReversal.currency",
    },
    {
      account: { logical: "reg.nop_short", currency: "event.enrichment.nopReversal.currency" },
      side: "debit",
      amount: "abs(event.enrichment.nopReversal.amountMinor)",
      currency: "event.enrichment.nopReversal.currency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:sarb:ba350:nop", "urn:obligation:reg:banks-act:fx-exposure"],
};

export const PR_FX_002_BA: SlaRule = nopNeutralRule({
  ruleId: "PR-FX-002-BA",
  eventType: "FxPositionRevalued",
  detail:
    "SARB BA-350 NOP is a position measure; daily FVTPL revaluation does not change the open position — NOP-neutral",
  cites: ["urn:obligation:sarb:ba350:nop"],
});

export const PR_FX_PRIN_BA: SlaRule = nopNeutralRule({
  ruleId: "PR-FX-PRIN-BA",
  eventType: "PrincipalPayment",
  detail:
    "SARB BA-350 NOP unchanged by settling a leg's cash — the net open position persists until the currency is sold back — NOP-neutral",
  cites: ["urn:obligation:sarb:ba350:nop"],
});

export const PR_FX_CLOSE_BA: SlaRule = nopNeutralRule({
  ruleId: "PR-FX-CLOSE-BA",
  eventType: "SettlementConfirmed",
  detail: "SARB BA-350 NOP unchanged by physical settlement of an FX-spot — NOP-neutral",
  cites: ["urn:obligation:sarb:ba350:nop"],
});

export const PR_FX_005_BA: SlaRule = nopNeutralRule({
  ruleId: "PR-FX-005-BA",
  eventType: "FxSettlementFailed",
  detail:
    "SARB BA-350 NOP unchanged by a settlement failure (an IFRS credit-risk / Stage-3 ECL event) — NOP-neutral",
  cites: ["urn:obligation:sarb:ba350:nop"],
});

export const PR_FX_INSTRUCT_BA: SlaRule = nopNeutralRule({
  ruleId: "PR-FX-INSTRUCT-BA",
  eventType: "FxSettlementInstructed",
  detail: "Settlement instruction memo — no GL impact in any representation",
  cites: ["urn:obligation:sarb:ba350:nop"],
});

export const PR_FX_REGREPORT_BA: SlaRule = nopNeutralRule({
  ruleId: "PR-FX-REGREPORT-BA",
  eventType: "TradeReportSubmitted",
  detail: "Trade-report-submitted memo — no GL impact in any representation",
  cites: ["urn:obligation:sarb:ba350:nop"],
});
