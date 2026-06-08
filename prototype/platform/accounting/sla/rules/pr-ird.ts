// platform/accounting/sla/rules/pr-ird.ts
//
// OTC IRD swap lifecycle IFRS posting rules, expressed as rules-as-data. The
// sole production posting path for IRS booking / revaluation / coupon /
// termination; account mappings come from IRD_ACCOUNTS (resolver.ts). The
// interpreter suite (tests/sla-ird-lifecycle-interpreter.test.ts) pins the leg
// footprints on real IRS-lifecycle fixtures (booking asset/liability, NPV reval
// gain/loss/sign-flip, coupon net-receive/net-pay, termination asset/liability
// close-out).
//
// Coverage (one rule per registry posting-producing entry + the two memos —
// posting-rule-registry.ts):
//   PR-IRS-001   IrdSwapTradeExecuted    — initial recognition (at-market zero-NPV
//                                          / off-market asset / off-market liability)
//   PR-IRS-002   IrdSwapPositionRevalued — FVTPL NPV re-measurement (gain / loss /
//                                          asset↔liability sign-flip)
//   PR-IRS-003   IrdSwapCouponSettled    — net coupon cash settlement (receive / pay)
//   PR-IRS-TERM  IrdSwapTerminated       — derecognition on termination
//   PR-IRS-SCHED IrsCouponScheduleGenerated  — intentional-no-impact memo
//   PR-IRS-INSTRUCT IrsCouponPaymentInstructed — intentional-no-impact memo
//
// ─── CANONICAL EVENT TYPES ──────────────────────────────────────────────────
// The accounting event types are the `IrdSwap*` family (ird-accounting.ts), the
// ones the legacy posting engine actually consumed. The registry's older
// `IrsTradeBooked / IrsPositionRevalued / IrsCouponSettlementConfirmed` names are
// the trade-domain emitters; the GL path keys on the `IrdSwap*` accounting
// events, so these rules do too. The termination rule keys on the REAL event
// type `IrdSwapTerminated` — the prior `IrsSwapTerminated` typo in the registry
// meant the rule never fired; this data form keys on the correct type.
//
// ─── BRANCH → WHEN-PREDICATE TRANSLATION ────────────────────────────────────
// The legacy functions branch on the signed amount (positive NPV → asset side,
// negative → liability side; gain vs loss; net-receive vs net-pay; sign-flip).
// Each branch is expressed as a per-line `when` predicate over the signed event
// fields, ordered to reproduce the legacy leg order exactly. Exactly one branch's
// lines fire for any given event.
//
// ─── ZERO-SKIP CONDITIONS ───────────────────────────────────────────────────
// Booking, revaluation and coupon produce no posting when the driving amount is
// zero (`npvMinor`, `npvDeltaMinor`, `netCashMinor`). That maps to
// `condition: non-zero-delta` keyed on the absolute driving amount — the
// interpreter returns the explicit `intentional-no-impact` skip (no legs).
// Termination produces no legs only when BOTH `terminationPaymentMinor == 0` AND
// `carryingNpvAtTerminationMinor == 0`; that compound all-zero case produces zero
// legs here too (no line fires, no pnl leg — and a consistent event has
// realisedPnl == terminationPayment − carryingNpv == 0), so PR-IRS-TERM stays
// `always` and balances to nothing when the swap matures at zero value.
//
// ─── AMOUNTS ARE INTEGER MINOR UNITS ────────────────────────────────────────
// Every IRS amount (npvMinor, npvDeltaMinor, netCashMinor, terminationPayment,
// carryingNpv, realisedPnl) is an integer minor-unit field on the triggering
// event — no enrichment is required (unlike bond booking's float dirty-price).
// The integer-only SLA expression sandbox evaluates them directly. (The brief
// flags coupon/termination as enrichment-context candidates; in this schema the
// carrying NPV and net cash are already carried on the IrdSwapTerminated /
// IrdSwapCouponSettled payloads, so no prior-event lookup is needed — the rules
// stay pure with no enrichment.)
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 3, CEO-approved
//            2026-06-05); D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved
//            2026-06-05).
// Cites: IFRS 9 §3.2.3, §4.1.4, §5.7.1.

import type { SlaRule } from "../generated/sla-types";

/** Product key — every IRD-swap rule resolves accounts under this product. */
const IRD = "IRD" as const;

// ---------------------------------------------------------------------------
// PR-IRS-001 — IrdSwapTradeExecuted (initial recognition; IFRS 9 §4.1.4, §5.7.1)
//
// Legacy (irdSwapTradeBookingJournals):
//   npvMinor == 0 → [] (at-market swap; no day-1 entry).
//   npvMinor  > 0 → Dr Swap Asset / Cr Unrealised P&L     (amount = |npv|)
//   npvMinor  < 0 → Dr Unrealised P&L / Cr Swap Liability (amount = |npv|)
// The zero-skip is the non-zero-delta condition on abs(event.npvMinor); the
// asset-vs-liability side is chosen by per-line `when` predicates on the signed
// npvMinor. Line ORDER mirrors the legacy output exactly.
// ---------------------------------------------------------------------------

export const PR_IRS_001: SlaRule = {
  rule_id: "PR-IRS-001",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "IrdSwapTradeExecuted",
    instrument_type: IRD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail:
      "IFRS 9 §4.1.4, §5.7.1 — OTC swap is FVTPL; at-market (zero-NPV) inception produces no day-1 posting",
    delta_path: "abs(event.npvMinor)",
  },
  lines: [
    // ── Positive NPV → asset side: Dr Swap Asset; Cr Unrealised P&L ──
    {
      account: { logical: "ird.swap_asset_fvtpl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.npvMinor)",
      currency: "event.currency",
      when: "event.npvMinor > 0",
    },
    {
      account: { logical: "ird.unrealised_pnl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.npvMinor)",
      currency: "event.currency",
      when: "event.npvMinor > 0",
    },
    // ── Negative NPV → liability side: Dr Unrealised P&L; Cr Swap Liability ──
    {
      account: { logical: "ird.unrealised_pnl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.npvMinor)",
      currency: "event.currency",
      when: "event.npvMinor < 0",
    },
    {
      account: { logical: "ird.swap_liability_fvtpl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.npvMinor)",
      currency: "event.currency",
      when: "event.npvMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:4.1.4", "urn:obligation:ifrs:ifrs9:5.7.1"],
};

// ---------------------------------------------------------------------------
// PR-IRS-002 — IrdSwapPositionRevalued (FVTPL NPV re-measurement; IFRS 9 §5.7.1)
//
// Legacy (irdSwapRevaluationJournals): npvDeltaMinor == 0 → []. Otherwise four
// branches keyed on opening/closing/delta signs. Reproduced as `when`-gated
// lines, in the legacy emit order per branch:
//
//   sign-flip asset→liability (opening>0 && closing<0):
//     Dr Unrealised P&L (|opening| + |closing|)
//     Cr Swap Asset     (|opening|)
//     Cr Swap Liability (|closing|)
//   sign-flip liability→asset (opening<0 && closing>0):
//     Dr Swap Liability (|opening|)
//     Dr Swap Asset     (|closing|)
//     Cr Unrealised P&L (|opening| + |closing|)
//   simple gain (no flip, delta>0):
//     Dr Swap Asset / Cr Unrealised P&L  (|delta|)
//   simple loss (no flip, delta<0):
//     Dr Unrealised P&L / Cr Swap Liability (|delta|)
//
// "No flip" predicates exclude the two sign-flip cases so exactly one branch
// fires. The legacy `signFlipToLiability`/`signFlipToAsset` flags take precedence
// over the simple gain/loss path, so the simple-branch predicates AND-out both
// flip conditions.
// ---------------------------------------------------------------------------

export const PR_IRS_002: SlaRule = {
  rule_id: "PR-IRS-002",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "IrdSwapPositionRevalued",
    instrument_type: IRD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail: "IFRS 9 §5.7.1 — FVTPL NPV re-measurement; zero delta produces no posting",
    delta_path: "event.npvDeltaMinor",
  },
  lines: [
    // ── Sign-flip asset→liability (opening>0 && closing<0) ──
    {
      account: { logical: "ird.unrealised_pnl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.npvOpeningMinor) + abs(event.npvClosingMinor)",
      currency: "event.currency",
      when: "event.npvOpeningMinor > 0 && event.npvClosingMinor < 0",
    },
    {
      account: { logical: "ird.swap_asset_fvtpl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.npvOpeningMinor)",
      currency: "event.currency",
      when: "event.npvOpeningMinor > 0 && event.npvClosingMinor < 0",
    },
    {
      account: { logical: "ird.swap_liability_fvtpl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.npvClosingMinor)",
      currency: "event.currency",
      when: "event.npvOpeningMinor > 0 && event.npvClosingMinor < 0",
    },
    // ── Sign-flip liability→asset (opening<0 && closing>0) ──
    {
      account: { logical: "ird.swap_liability_fvtpl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.npvOpeningMinor)",
      currency: "event.currency",
      when: "event.npvOpeningMinor < 0 && event.npvClosingMinor > 0",
    },
    {
      account: { logical: "ird.swap_asset_fvtpl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.npvClosingMinor)",
      currency: "event.currency",
      when: "event.npvOpeningMinor < 0 && event.npvClosingMinor > 0",
    },
    {
      account: { logical: "ird.unrealised_pnl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.npvOpeningMinor) + abs(event.npvClosingMinor)",
      currency: "event.currency",
      when: "event.npvOpeningMinor < 0 && event.npvClosingMinor > 0",
    },
    // ── Simple gain (no sign flip, delta>0): Dr Swap Asset; Cr Unrealised P&L ──
    {
      account: { logical: "ird.swap_asset_fvtpl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.npvDeltaMinor)",
      currency: "event.currency",
      when: "event.npvDeltaMinor > 0 && !(event.npvOpeningMinor > 0 && event.npvClosingMinor < 0) && !(event.npvOpeningMinor < 0 && event.npvClosingMinor > 0)",
    },
    {
      account: { logical: "ird.unrealised_pnl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.npvDeltaMinor)",
      currency: "event.currency",
      when: "event.npvDeltaMinor > 0 && !(event.npvOpeningMinor > 0 && event.npvClosingMinor < 0) && !(event.npvOpeningMinor < 0 && event.npvClosingMinor > 0)",
    },
    // ── Simple loss (no sign flip, delta<0): Dr Unrealised P&L; Cr Swap Liability ──
    {
      account: { logical: "ird.unrealised_pnl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.npvDeltaMinor)",
      currency: "event.currency",
      when: "event.npvDeltaMinor < 0 && !(event.npvOpeningMinor > 0 && event.npvClosingMinor < 0) && !(event.npvOpeningMinor < 0 && event.npvClosingMinor > 0)",
    },
    {
      account: { logical: "ird.swap_liability_fvtpl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.npvDeltaMinor)",
      currency: "event.currency",
      when: "event.npvDeltaMinor < 0 && !(event.npvOpeningMinor > 0 && event.npvClosingMinor < 0) && !(event.npvOpeningMinor < 0 && event.npvClosingMinor > 0)",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.7.1"],
};

// ---------------------------------------------------------------------------
// PR-IRS-003 — IrdSwapCouponSettled (net coupon cash settlement)
//
// Legacy (irdSwapCouponJournals): netCashMinor == 0 → [].
//   netCashMinor > 0 (bank receives): Dr Nostro / Cr Swap Asset    (|net|)
//   netCashMinor < 0 (bank pays):     Dr Swap Liability / Cr Nostro (|net|)
// Zero-skip ported via condition: non-zero-delta on abs(event.netCashMinor); the
// receive-vs-pay direction is per-line `when` predicates on the signed netCash.
// ---------------------------------------------------------------------------

export const PR_IRS_003: SlaRule = {
  rule_id: "PR-IRS-003",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "IrdSwapCouponSettled",
    instrument_type: IRD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "non-zero-delta",
    detail: "IFRS 9 — net coupon recognised on settlement date; zero net produces no posting",
    delta_path: "abs(event.netCashMinor)",
  },
  lines: [
    // ── Bank receives net cash: Dr Nostro; Cr Swap Asset ──
    {
      account: { logical: "ird.nostro", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.netCashMinor)",
      currency: "event.currency",
      when: "event.netCashMinor > 0",
    },
    {
      account: { logical: "ird.swap_asset_fvtpl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.netCashMinor)",
      currency: "event.currency",
      when: "event.netCashMinor > 0",
    },
    // ── Bank pays net cash: Dr Swap Liability; Cr Nostro ──
    {
      account: { logical: "ird.swap_liability_fvtpl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.netCashMinor)",
      currency: "event.currency",
      when: "event.netCashMinor < 0",
    },
    {
      account: { logical: "ird.nostro", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.netCashMinor)",
      currency: "event.currency",
      when: "event.netCashMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.7.1"],
};

// ---------------------------------------------------------------------------
// PR-IRS-TERM — IrdSwapTerminated (derecognition; IFRS 9 §3.2.3)
//
// Legacy (irdSwapTerminationJournals) emits up to three independent legs, in
// this fixed order:
//   1. Cash settlement (only when terminationPaymentMinor != 0):
//        termPayment > 0 (receives): Dr Nostro (termPayment)
//        termPayment < 0 (pays):     Cr Nostro (|termPayment|)
//   2. Derecognise carrying NPV (only when carryingNpv != 0):
//        carryingNpv > 0 (was asset):     Cr Swap Asset     (carryingNpv)
//        carryingNpv < 0 (was liability): Dr Swap Liability (|carryingNpv|)
//   3. Realised P&L residual (only when realisedPnlMinor != 0):
//        pnl > 0 (gain): Cr Unrealised P&L (pnl)
//        pnl < 0 (loss): Dr Unrealised P&L (|pnl|)
//
// Each leg is an INDEPENDENT `when`-gated line (not mutually-exclusive branches);
// the three groups fire independently exactly as the legacy `if` blocks do, in
// the same order. The all-zero early-return (termPayment == 0 && carryingNpv == 0)
// is reproduced naturally: no cash/derecognition leg fires, and for a consistent
// event (realisedPnl = termPayment − carryingNpv = 0) no P&L leg fires either —
// zero legs, matching the legacy `[]`.
//
// Balance: realisedPnl = terminationPayment − carryingNpvAtTermination, so the
// three legs net to zero per currency in every consistent case (asset/liability,
// gain/loss, receive/pay).
// ---------------------------------------------------------------------------

export const PR_IRS_TERM: SlaRule = {
  rule_id: "PR-IRS-TERM",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "IrdSwapTerminated",
    instrument_type: IRD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §3.2.3 — derecognition on termination; close-out cash + NPV + realised P&L",
  },
  lines: [
    // 1. Cash settlement.
    {
      account: { logical: "ird.nostro", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.terminationPaymentMinor)",
      currency: "event.currency",
      when: "event.terminationPaymentMinor > 0",
    },
    {
      account: { logical: "ird.nostro", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.terminationPaymentMinor)",
      currency: "event.currency",
      when: "event.terminationPaymentMinor < 0",
    },
    // 2. Derecognise carrying NPV.
    {
      account: { logical: "ird.swap_asset_fvtpl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.carryingNpvAtTerminationMinor)",
      currency: "event.currency",
      when: "event.carryingNpvAtTerminationMinor > 0",
    },
    {
      account: { logical: "ird.swap_liability_fvtpl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.carryingNpvAtTerminationMinor)",
      currency: "event.currency",
      when: "event.carryingNpvAtTerminationMinor < 0",
    },
    // 3. Realised P&L residual.
    {
      account: { logical: "ird.unrealised_pnl", product: IRD, currency: "ZAR" },
      side: "credit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.realisedPnlMinor > 0",
    },
    {
      account: { logical: "ird.unrealised_pnl", product: IRD, currency: "ZAR" },
      side: "debit",
      amount: "abs(event.realisedPnlMinor)",
      currency: "event.currency",
      when: "event.realisedPnlMinor < 0",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:3.2.3"],
};

// ---------------------------------------------------------------------------
// PR-IRS-SCHED — IrsCouponScheduleGenerated (intentional-no-impact memo)
//
// Category C: genuinely zero-accounting-impact. The coupon schedule is fixed for
// the payment dates; no cash changes hands and IFRS 9 B5.4.1 EIR accrual fires on
// coupon settlement, not schedule publication. The interpreter returns the
// explicit skip (no legs), matching the legacy engine's no-posting path.
// ---------------------------------------------------------------------------

export const PR_IRS_SCHED: SlaRule = {
  rule_id: "PR-IRS-SCHED",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "IrsCouponScheduleGenerated",
    instrument_type: IRD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "intentional-no-impact",
    detail: "Schedule generated; no cash or GL impact until coupon dates [zero-impact-by-design]",
  },
  lines: [],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.7.1"],
};

// ---------------------------------------------------------------------------
// PR-IRS-INSTRUCT — IrsCouponPaymentInstructed (intentional-no-impact memo)
//
// Category C: genuinely zero-accounting-impact. A payment instruction dispatched
// to the correspondent; no cash has moved. GL posts on the net coupon settlement
// (PR-IRS-003) per IFRS 9 net-settlement recognition. The interpreter returns the
// explicit skip (no legs).
// ---------------------------------------------------------------------------

export const PR_IRS_INSTRUCT: SlaRule = {
  rule_id: "PR-IRS-INSTRUCT",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "IrsCouponPaymentInstructed",
    instrument_type: IRD,
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "intentional-no-impact",
    detail: "Payment instruction issued; GL posts on confirmed settlement [zero-impact-by-design]",
  },
  lines: [],
  balancing: "assert_zero",
  cites: ["urn:obligation:ifrs:ifrs9:5.7.1"],
};
