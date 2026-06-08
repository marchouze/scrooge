// platform/accounting/sla/rules/pr-fx-memo.ts
//
// Memo-only FX rules — `condition: intentional-no-impact`. PR-FX-INSTRUCT
// (FxSettlementInstructed) and PR-FX-REGREPORT (TradeReportSubmitted) produce
// no GL movement BY DESIGN. Expressing them as data with the
// `intentional-no-impact` condition (spec §2.1 / §7.3) keeps them LOUD-yet-zero:
// the interpreter records an `intentional-no-impact` outcome with the reason,
// so they read as "intentionally no GL impact", NOT "missing — substrate gap".
//
// ─── PR-FX-003 (TradeMatured) — DEPRECATED, deliberately NOT ported ─────────
// The accounting `TradeMatured` event-type and its rule PR-FX-003
// (`fxSettlementJournals`) were retired by the CEO decision of 2026-05-20: its
// responsibilities were split across PR-FX-PRIN (per-leg cash) +
// PR-FX-LIFECYCLE-CLOSE (realised-P&L residual), both of which fire on CDM
// lifecycle events that production code actually emits. `makeTradeMatured(...)`
// is only constructed by test code; no production path emits it, so PR-FX-003
// is an UNREACHABLE accounting path. Porting it would add a data rule for a
// dead event purely for back-compat with a deprecated type — net-negative
// (it would also need a non-trivial bidirectional `settledBaseCurrencyMinor`
// sign branch + nostro-account-from-payload handling that the CDM lifecycle
// events express more cleanly). DECISION: skip PR-FX-003 in the data port; the
// legacy `fxSettlementJournals` function remains in fx-spot.ts solely for the
// deprecated test-only emitters during the deprecation window. This skip is
// itself the documented Phase-2 deliverable for PR-FX-003.
//
// Authored by: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Cites: IFRS 9 §3.2.3 (derecognition criteria), IAS 21 §28, IAS 1 §27.

import type { SlaRule } from "../generated/sla-types";

/** PR-FX-INSTRUCT — FxSettlementInstructed: wire-dispatch memo, no GL impact. */
export const PR_FX_INSTRUCT: SlaRule = {
  rule_id: "PR-FX-INSTRUCT",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FxSettlementInstructed",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "intentional-no-impact",
    detail:
      "IFRS 9 §3.2.3 / IAS 21 §28 — instruction dispatch only; no cash moved, no derecognition. Derecognition occurs at PR-FX-PRIN on correspondent confirmation.",
  },
  lines: [],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3", "urn:obligation:ifrs:ias21:28"],
};

/** PR-FX-REGREPORT — TradeReportSubmitted: regulatory dispatch memo, no GL impact. */
export const PR_FX_REGREPORT: SlaRule = {
  rule_id: "PR-FX-REGREPORT",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "TradeReportSubmitted",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "intentional-no-impact",
    detail:
      "IAS 1 §27 — regulatory dispatch (SARB FinSurv / DTCC-SAFE) is not an accounting transaction; no asset/liability/income/expense recognition.",
  },
  lines: [],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ias1:27"],
};
