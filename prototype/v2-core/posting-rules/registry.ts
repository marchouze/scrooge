// v2-core/posting-rules/registry.ts
//
// CANONICAL HOME of the posting-rule registry SCHEMA + DATA (WS-ACCT-FX-
// COMPLETENESS Slice 2, D-ACCT-SCHEMA-CANONICAL-HOME).
//
// The posting-rule registry is the declarative, queryable mapping from trigger
// event types to expected accounting entries (the contract between the
// posting-rule engine and the recon pipeline). It was previously a plain-TS
// array on the v1 side with NO schema. D-ACCT-SCHEMA-CANONICAL-HOME moves it
// here, gives it a Zod schema (`PostingRuleEntrySchema`), and leaves the v1
// `platform/accounting/posting-rule-registry.ts` as a re-export shim.
//
// DESIGN PRINCIPLES (established 2026-05-22; preserved):
//   1. Trade lifecycle domain owns trigger events; accounting domain owns the
//      consequence (SubLedgerPostingEmitted).
//   2. The accounting domain depends on trigger events from ANY domain. Non-
//      trade triggers are stubbed with condition "intentional-no-impact" until
//      their event types are defined and wired.
//   3. lifecycleStage scopes each entry so the recon pipeline can assert
//      opening / terminal / in-flight coverage.
//
// Stub classification (Gap-4 audit, 2026-05-26): A = event exists, stub
// unwarranted → must wire; B = event absent → deferred (cites
// D-DATA-QUALITY-CROSS-DOMAIN-V1); C = event exists, genuinely zero-impact →
// keep stub with "[zero-impact-by-design]".
//
// PACKAGE BOUNDARY: inside `v2-core/` — no imports from `platform/`, `runtime/`,
// `domains/` (enforced by `recon:v2-no-v1-import`). Pure data + Zod.
//
// Authority: D-ACCT-SCHEMA-CANONICAL-HOME (CEO-approved 2026-06-18);
//   D-MARKETS-SCHEMA-FOUNDATION; D-ACCT-FX-IFRS-POSTING-COMPLETENESS.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema + inferred types — the canonical posting-rule-entry contract.
// ---------------------------------------------------------------------------

/**
 * The domain that owns the trigger event. The accounting agent subscribes; it
 * never emits the trigger.
 */
export const triggerDomainSchema = z.enum([
  "trade", // FxTradeExecuted, BondTradeExecuted, etc.
  "risk", // ProvisionCalculated, CcrEadComputed, etc.
  "product-control", // BookPnlAttributed, etc.
  "period-close", // AccountingPeriodOpened → reversal; PeriodClosed → snapshot
  "manual", // ManualJournalEntry
]);

export type TriggerDomain = z.infer<typeof triggerDomainSchema>;

/** Where in the lifecycle the trigger event sits (scopes recon coverage). */
export const lifecycleStageSchema = z.enum(["opening", "in-flight", "terminal"]);

export type LifecycleStage = z.infer<typeof lifecycleStageSchema>;

/**
 * When a posting is expected:
 *   "always"                — every occurrence must produce a posting
 *   "non-zero-delta"        — skipped when the revaluation delta is zero
 *   "non-zero-pnl"          — skipped when realised P&L is zero
 *   "intentional-no-impact" — this event never produces a posting by design
 */
export const postingConditionSchema = z.enum([
  "always",
  "non-zero-delta",
  "non-zero-pnl",
  "intentional-no-impact",
]);

export type PostingCondition = z.infer<typeof postingConditionSchema>;

export const postingRuleEntrySchema = z.object({
  /** Event type that triggers this posting rule (matches event-store type field). */
  triggerEventType: z.string().min(1),
  /** Domain that owns and emits the trigger event. */
  triggerDomain: triggerDomainSchema,
  /** Lifecycle this entry belongs to, or "n/a" for non-lifecycle entries. */
  lifecycleId: z.string().min(1),
  /** Where in the lifecycle this trigger fires (drives recon assertion strength). */
  lifecycleStage: lifecycleStageSchema,
  /** Stable posting-rule identifier (e.g. "PR-FX-001"). */
  postingRuleId: z.string().min(1),
  /** Matches SubLedgerPostingEmitted.payload.postingType. */
  postingType: z.string().min(1),
  /** When a posting is expected. */
  condition: postingConditionSchema,
  /** Human-readable reason for the condition (IFRS citation or plain text). */
  conditionDetail: z.string().optional(),
});

/** Capitalised alias matching the canonical-home schema naming convention used
 * by `recon:accounting-schema-home`. */
export const PostingRuleEntrySchema = postingRuleEntrySchema;

export type PostingRuleEntry = z.infer<typeof postingRuleEntrySchema>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const POSTING_RULE_REGISTRY: readonly PostingRuleEntry[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // FX SPOT  (lifecycleId: "fx-spot-trade") — V1 trade-event triggers.
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "FxTradeExecuted",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "opening",
    postingRuleId: "PR-FX-001",
    postingType: "trade-booking",
    condition: "always",
    conditionDetail: "IFRS 9 §3.1.1 — recognition on trade date",
  },
  {
    triggerEventType: "FxPositionRevalued",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-FX-002",
    postingType: "revaluation",
    condition: "non-zero-delta",
    conditionDetail: "IFRS 9 §5.7.1 — only changes in fair value recognised",
  },
  {
    triggerEventType: "FxSettlementInstructed",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-FX-INSTRUCT",
    postingType: "payment-initiation",
    condition: "intentional-no-impact",
    conditionDetail:
      "MT202 / pacs.009 instruction issued; no cash moved yet [zero-impact-by-design]",
  },
  {
    triggerEventType: "PrincipalPayment",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-FX-PRIN",
    postingType: "fx-principal-payment",
    condition: "always",
    conditionDetail: "IAS 21 §23 — settlement-date cash leg recognition",
  },
  {
    triggerEventType: "TradeReportSubmitted",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-FX-REGREPORT",
    postingType: "trade-booking",
    condition: "intentional-no-impact",
    conditionDetail: "SARB FinSurv / DTCC dispatch; no GL impact [zero-impact-by-design]",
  },
  {
    triggerEventType: "SettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-LIFECYCLE-CLOSE",
    postingType: "fx-lifecycle-close",
    condition: "non-zero-pnl",
    conditionDetail: "IAS 21 §28 — realised P&L on settlement date; zero-P&L trades skipped",
  },
  {
    triggerEventType: "FxTradeCancelled",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-CANCEL",
    postingType: "cancellation",
    condition: "always",
    conditionDetail: "Full reversal of all prior postings for this tradeId",
  },
  {
    triggerEventType: "FxSettlementFailed",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-005",
    postingType: "settlement",
    condition: "always",
    conditionDetail:
      "IFRS 9 §5.5.13 — only failureKind=one-leg-delivered triggers ECL posting; neither-delivered and operational-delay are FVTPL out of ECL scope per IFRS 9 §5.5.1",
  },
  {
    triggerEventType: "TradeMatured",
    triggerDomain: "trade",
    lifecycleId: "fx-spot-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-003",
    postingType: "settlement",
    condition: "non-zero-pnl",
    conditionDetail:
      "DEPRECATED 2026-05-20 — superseded by PR-FX-PRIN + PR-FX-LIFECYCLE-CLOSE; kept for legacy test fixture back-compat",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FX V2 FIL-FOLD posting rules (lifecycleId: "fx-fil-instance").
  //
  // The V2 accounting fold (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD) computes the
  // FX trial balance as a PURE FOLD over the FIL instance lifecycle events
  // (FilInstrumentCreated / FilInstrumentAmended / FilInstrumentTerminated) via
  // the lifted pure rules in `v2-core/posting-rules/fx.ts`. These registry rows
  // make those rule ids first-class so the FX treatment module's
  // `applicablePostingRuleIds` resolve (recon:accounting-schema-home assertion
  // c) and the determination renders on the NPA page (Slice 5).
  //
  // No `SubLedgerPostingEmitted` is stored on the FX read path — the legs are
  // folded in memory — so these are not gl-ledger-coverage mandates; they
  // document the V2 FX posting determination. Authority: D-ACCT-FX-IFRS-POSTING-
  // COMPLETENESS; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "FilInstrumentCreated",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "opening",
    postingRuleId: "PR-FX-001-V2",
    postingType: "fx-fil-initial-recognition",
    condition: "always",
    conditionDetail:
      "IFRS 9 §3.1.1 — FX initial recognition at trade date (FIL fold). Long: Dr receivable / Cr payable; short: reversed. Forward/swap/NDF: derivative fair value ≈ 0 at inception.",
  },
  {
    triggerEventType: "FilInstrumentAmended",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-FX-REVAL-V2",
    postingType: "fx-fil-revaluation",
    condition: "non-zero-delta",
    conditionDetail:
      "IFRS 9 §5.7.1 (FVTPL) / §5.7.5 (FVOCI election → OCI) — FX revaluation on amendment (FIL fold). FVOCI routes the fair-value movement to the OCI reserve (ACC-2100-008) instead of P&L.",
  },
  {
    triggerEventType: "FilInstrumentTerminated",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-CLOSE-V2",
    postingType: "fx-fil-derecognition",
    condition: "always",
    conditionDetail:
      "IFRS 9 §3.2.3 — FX derecognition on settlement/cancellation (FIL fold). Settlement realised-P&L, swap-leg, NDF-fixing and FVOCI→P&L reclassification refinements are tracked deferred gaps (FilInstrumentTerminated carries no economic terms) — see D-ACCT-FX-IFRS-POSTING-COMPLETENESS ProductDeferredGaps.",
  },

  // ── FX completeness rules (WS-ACCT-FX-COMPLETENESS Slice 3) ──────────────
  // Each rule's POSTING LOGIC is implemented + balanced + unit-tested in
  // v2-core/posting-rules/fx-settlement.ts. The TRIGGER-WIRING is a tracked
  // ProductDeferredGap: the FIL fold's terminal/settlement events do not yet
  // carry the economic terms (settlement rate, accumulated reval/OCI, NDF fixing)
  // these rules need, so they cannot fire automatically today. lifecycleId
  // "fx-fil-instance" is NOT a TRADE_LIFECYCLE_REGISTRY lifecycle, so these rows
  // impose no gl-ledger-coverage mandate. Authority: D-ACCT-FX-IFRS-POSTING-
  // COMPLETENESS.
  {
    triggerEventType: "FilFxSettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-SETTLE-V2",
    postingType: "fx-fil-settlement-realised-pnl",
    condition: "non-zero-pnl",
    conditionDetail:
      "IAS 21 §23, §28 — settlement-date cash recognition + realised FX P&L (spot / physical forward). Logic in fx-settlement.postFxSettlementLegs; trigger-wiring deferred (FIL settlement event not yet present) — ProductDeferredGap fx-settlement-realised-pnl-trigger.",
  },
  {
    triggerEventType: "FilFxSettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-SWAP-NEAR-V2",
    postingType: "fx-fil-swap-near-leg",
    condition: "non-zero-pnl",
    conditionDetail:
      "IAS 21 §23 — FX swap near-leg settlement. Logic in fx-settlement.postFxSwapNearLegLegs; trigger-wiring deferred (no per-leg swap settlement event) — ProductDeferredGap fx-swap-near-far-leg-trigger.",
  },
  {
    triggerEventType: "FilFxSettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-SWAP-FAR-V2",
    postingType: "fx-fil-swap-far-leg",
    condition: "non-zero-pnl",
    conditionDetail:
      "IAS 21 §23 — FX swap far-leg settlement; closes composite. Logic in fx-settlement.postFxSwapFarLegLegs; trigger-wiring deferred — ProductDeferredGap fx-swap-near-far-leg-trigger.",
  },
  {
    triggerEventType: "FilNdfFixingObserved",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-NDF-FIX-V2",
    postingType: "fx-fil-ndf-fixing",
    condition: "non-zero-pnl",
    conditionDetail:
      "IFRS 9 §5.7.1 / IAS 21 §28 — NDF fixing cash-settled realised P&L (no principal legs). Logic in fx-settlement.postFxNdfFixingLegs; trigger-wiring deferred (NO NdfFixing event exists in the FIL lifecycle) — ProductDeferredGap fx-ndf-fixing-trigger.",
  },
  {
    triggerEventType: "FilInstrumentTerminated",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-FVOCI-RECLASS-V2",
    postingType: "fx-fil-fvoci-reclass",
    condition: "non-zero-pnl",
    conditionDetail:
      "IFRS 9 §5.7.10–11 — FVOCI → P&L reclassification on derecognition. Logic in fx-settlement.postFxFvociReclassLegs; trigger-wiring deferred (terminal event carries neither the FVOCI election nor the accumulated OCI) — ProductDeferredGap fx-fvoci-reclass-trigger.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BOND  (lifecycleId: "bond-trade")
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "BondTradeExecuted",
    triggerDomain: "trade",
    lifecycleId: "bond-trade",
    lifecycleStage: "opening",
    postingRuleId: "PR-BOND-001",
    postingType: "bond-trade-booking",
    condition: "always",
    conditionDetail: "IFRS 9 §3.1.1 — recognition on trade date",
  },
  {
    triggerEventType: "BondInterestAccrued",
    triggerDomain: "trade",
    lifecycleId: "bond-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-BOND-EIR",
    postingType: "bond-interest-accrual",
    condition: "always",
    conditionDetail: "IFRS 9 B5.4.1 — EIR accrual for amortised-cost bonds",
  },
  {
    triggerEventType: "BondPositionRevalued",
    triggerDomain: "trade",
    lifecycleId: "bond-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-BOND-002",
    postingType: "bond-revaluation",
    condition: "non-zero-delta",
    conditionDetail: "IFRS 9 §5.7.1 / §5.7.10 — FVTPL or FVOCI mark-to-market",
  },
  {
    triggerEventType: "BondMatured",
    triggerDomain: "trade",
    lifecycleId: "bond-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-BOND-MAT",
    postingType: "bond-maturity",
    condition: "always",
    conditionDetail: "IFRS 9 §3.2.3 — derecognition on principal repayment",
  },
  {
    triggerEventType: "BondSold",
    triggerDomain: "trade",
    lifecycleId: "bond-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-BOND-SALE",
    postingType: "bond-sale",
    condition: "always",
    conditionDetail: "IFRS 9 §3.2.3 — derecognition on disposal",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EQUITY  (lifecycleId: "equity-trade")
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "EquityTradeExecuted",
    triggerDomain: "trade",
    lifecycleId: "equity-trade",
    lifecycleStage: "opening",
    postingRuleId: "PR-EQ-001",
    postingType: "equity-trade-booking",
    condition: "always",
    conditionDetail: "IFRS 9 §3.1.1 — trade-date recognition",
  },
  {
    triggerEventType: "EquityPositionRevalued",
    triggerDomain: "trade",
    lifecycleId: "equity-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-EQ-002",
    postingType: "equity-revaluation",
    condition: "non-zero-delta",
    conditionDetail: "IFRS 9 §5.7.1 — fair-value movement through P&L",
  },
  {
    triggerEventType: "EquityCorporateActionApplied",
    triggerDomain: "trade",
    lifecycleId: "equity-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-EQ-CA",
    postingType: "equity-dividend-accrual",
    condition: "always",
    conditionDetail: "IFRS 9 §5.7.1A — dividend income recognised when right established",
  },
  {
    triggerEventType: "EquitySettlementInstructed",
    triggerDomain: "trade",
    lifecycleId: "equity-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-EQ-INSTRUCT",
    postingType: "payment-initiation",
    condition: "intentional-no-impact",
    conditionDetail:
      "Settlement instruction memo; cash moves on confirmation [zero-impact-by-design]",
  },
  {
    triggerEventType: "EquitySettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "equity-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-EQ-004",
    postingType: "equity-sale",
    condition: "always",
    conditionDetail: "IFRS 9 §3.2.3 — settlement-date derecognition",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // IRD SWAP  (lifecycleId: "ird-swap-trade")
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "IrsTradeBooked",
    triggerDomain: "trade",
    lifecycleId: "ird-swap-trade",
    lifecycleStage: "opening",
    postingRuleId: "PR-IRS-001",
    postingType: "ird-swap-trade-booking",
    condition: "always",
    conditionDetail: "IFRS 9 §4.1.4 — at-market swap is at-fair-value on inception (zero NPV)",
  },
  {
    triggerEventType: "IrsPositionRevalued",
    triggerDomain: "trade",
    lifecycleId: "ird-swap-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-IRS-002",
    postingType: "ird-swap-revaluation",
    condition: "non-zero-delta",
    conditionDetail: "IFRS 9 §5.7.1 — FVTPL NPV re-measurement",
  },
  {
    triggerEventType: "IrsCouponScheduleGenerated",
    triggerDomain: "trade",
    lifecycleId: "ird-swap-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-IRS-SCHED",
    postingType: "ird-swap-trade-booking",
    condition: "intentional-no-impact",
    conditionDetail:
      "Schedule generated; no cash or GL impact until coupon dates [zero-impact-by-design]",
  },
  {
    triggerEventType: "IrsCouponPaymentInstructed",
    triggerDomain: "trade",
    lifecycleId: "ird-swap-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-IRS-INSTRUCT",
    postingType: "ird-swap-coupon-settlement",
    condition: "intentional-no-impact",
    conditionDetail:
      "Payment instruction issued; GL posts on confirmed settlement [zero-impact-by-design]",
  },
  {
    triggerEventType: "IrsCouponSettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "ird-swap-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-IRS-003",
    postingType: "ird-swap-coupon-settlement",
    condition: "always",
    conditionDetail: "IFRS 9 — net coupon recognised on settlement date",
  },
  {
    triggerEventType: "IrdSwapTerminated",
    triggerDomain: "trade",
    lifecycleId: "ird-swap-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-IRS-TERM",
    postingType: "ird-swap-termination",
    condition: "always",
    conditionDetail: "IFRS 9 §3.2.3 — derecognition on termination",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REPO  (lifecycleId: "repo-trade") — IAS 39 §27; IFRS 9 §3.2.3–3.2.4
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "RepoTradeOpened",
    triggerDomain: "trade",
    lifecycleId: "repo-trade",
    lifecycleStage: "opening",
    postingRuleId: "PR-REPO-001",
    postingType: "repo-trade-booking",
    condition: "always",
    conditionDetail: "IAS 39 §27 — collateral not derecognised; cash receipt is secured borrowing",
  },
  {
    triggerEventType: "RepoStartLegSettled",
    triggerDomain: "trade",
    lifecycleId: "repo-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-REPO-SETTLE-START",
    postingType: "repo-trade-booking",
    condition: "intentional-no-impact",
    conditionDetail:
      "Recognition already posted at RepoTradeOpened; this is a confirmation-only memo [zero-impact-by-design]",
  },
  {
    triggerEventType: "RepoInterestAccrued",
    triggerDomain: "trade",
    lifecycleId: "repo-trade",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-REPO-ACCRUAL",
    postingType: "repo-interest-accrual",
    condition: "non-zero-delta",
    conditionDetail: "IFRS 9 B5.4.1 — EIR accrual; zero-amount periods skipped",
  },
  {
    triggerEventType: "RepoEndLegSettled",
    triggerDomain: "trade",
    lifecycleId: "repo-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-REPO-END",
    postingType: "repo-maturity",
    condition: "always",
    conditionDetail: "IFRS 9 §3.2.3 — derecognition of secured borrowing on repurchase",
  },
  {
    triggerEventType: "RepoTradeTerminatedEarly",
    triggerDomain: "trade",
    lifecycleId: "repo-trade",
    lifecycleStage: "terminal",
    postingRuleId: "PR-REPO-CANCEL",
    postingType: "repo-cancellation",
    condition: "always",
    conditionDetail:
      "IFRS 9 §3.2.3 — derecognition on early termination; engine supplements with opening payload",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MMD / DEPOSIT  (lifecycleId: "mmd-deposit") — IFRS 9 §4.2.1; BA 110
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "DepositTaken",
    triggerDomain: "trade",
    lifecycleId: "mmd-deposit",
    lifecycleStage: "opening",
    postingRuleId: "PR-MMD-001",
    postingType: "deposit-booking",
    condition: "always",
    conditionDetail:
      "IFRS 9 §4.2.1 — financial liability recognised at fair value (par) on receipt",
  },
  {
    triggerEventType: "DepositInterestAccrued",
    triggerDomain: "trade",
    lifecycleId: "mmd-deposit",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-MMD-ACCRUAL",
    postingType: "deposit-interest-accrual",
    condition: "non-zero-delta",
    conditionDetail: "IFRS 9 B5.4.1 — EIR accrual; zero-amount periods skipped",
  },
  {
    triggerEventType: "DepositMatured",
    triggerDomain: "trade",
    lifecycleId: "mmd-deposit",
    lifecycleStage: "terminal",
    postingRuleId: "PR-MMD-MAT",
    postingType: "deposit-maturity",
    condition: "always",
    conditionDetail: "IFRS 9 §3.3.1 — derecognition on extinguishment (maturity repayment)",
  },
  {
    triggerEventType: "DepositWithdrawnEarly",
    triggerDomain: "trade",
    lifecycleId: "mmd-deposit",
    lifecycleStage: "terminal",
    postingRuleId: "PR-MMD-CANCEL",
    postingType: "deposit-cancellation",
    condition: "always",
    conditionDetail:
      "IFRS 9 §3.3.1 — derecognition on early withdrawal; engine supplements with opening principal",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FUNDING LINE  (lifecycleId: "funding-line") — IFRS 9 §4.2.1; BA 110 Table 2
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "FundingLineDrawn",
    triggerDomain: "trade",
    lifecycleId: "funding-line",
    lifecycleStage: "opening",
    postingRuleId: "PR-FUNDING-001",
    postingType: "funding-drawdown",
    condition: "always",
    conditionDetail: "IFRS 9 §4.2.1 — liability recognised at fair value (par) on drawdown",
  },
  {
    triggerEventType: "FundingLineRepaid",
    triggerDomain: "trade",
    lifecycleId: "funding-line",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FUNDING-END",
    postingType: "funding-repayment",
    condition: "always",
    conditionDetail: "IFRS 9 §3.3.1 — derecognition on full repayment",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INTERBANK LOAN  (lifecycleId: "interbank-loan") — IFRS 9 §4.1.2; BA 120
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "InterbankLoanPlaced",
    triggerDomain: "trade",
    lifecycleId: "interbank-loan",
    lifecycleStage: "opening",
    postingRuleId: "PR-IBL-001",
    postingType: "ibl-placement-booking",
    condition: "always",
    conditionDetail: "IFRS 9 §4.1.2 — asset measured at amortised cost; trade-date recognition",
  },
  {
    triggerEventType: "InterbankLoanInterestAccrued",
    triggerDomain: "trade",
    lifecycleId: "interbank-loan",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-IBL-ACCRUAL",
    postingType: "ibl-interest-accrual",
    condition: "non-zero-delta",
    conditionDetail: "IFRS 9 B5.4.1 — EIR accrual; zero-amount periods skipped",
  },
  {
    triggerEventType: "InterbankLoanMatured",
    triggerDomain: "trade",
    lifecycleId: "interbank-loan",
    lifecycleStage: "terminal",
    postingRuleId: "PR-IBL-MAT",
    postingType: "ibl-maturity",
    condition: "always",
    conditionDetail: "IFRS 9 §3.2.3 — derecognition on principal repayment at maturity",
  },
  {
    triggerEventType: "InterbankLoanRecalledEarly",
    triggerDomain: "trade",
    lifecycleId: "interbank-loan",
    lifecycleStage: "terminal",
    postingRuleId: "PR-IBL-RECALL",
    postingType: "ibl-recall",
    condition: "always",
    conditionDetail:
      "IFRS 9 §3.2.3 — derecognition on lender-initiated recall; engine supplements with opening principal",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NON-TRADE TRIGGER STUBS — event types not yet in EVENT_TYPE_REGISTRY.
  // Category B: deferred — cites D-DATA-QUALITY-CROSS-DOMAIN-V1.
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "ProvisionCalculated",
    triggerDomain: "risk",
    lifecycleId: "n/a",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-PROV-001",
    postingType: "ecl-provision",
    condition: "intentional-no-impact",
    conditionDetail:
      "Future: risk domain will emit ProvisionCalculated; accounting agent subscribes. Not yet wired. deferred: event schema pending — D-DATA-QUALITY-CROSS-DOMAIN-V1",
  },
  {
    triggerEventType: "BookPnlAttributed",
    triggerDomain: "product-control",
    lifecycleId: "n/a",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-BOOK-PNL-001",
    postingType: "bond-revaluation",
    condition: "intentional-no-impact",
    conditionDetail:
      "Future: product-control domain will emit BookPnlAttributed; accounting agent subscribes. Not yet wired. deferred: event schema pending — D-DATA-QUALITY-CROSS-DOMAIN-V1",
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Find all registry entries for a given trigger event type. */
export function findEntriesForEventType(eventType: string): readonly PostingRuleEntry[] {
  return POSTING_RULE_REGISTRY.filter((e) => e.triggerEventType === eventType);
}

/** Find all registry entries expected to produce postings (condition ≠ intentional-no-impact). */
export function getMandatoryEntries(): readonly PostingRuleEntry[] {
  return POSTING_RULE_REGISTRY.filter((e) => e.condition !== "intentional-no-impact");
}

/** Find all registry entries for a given lifecycle. */
export function findEntriesForLifecycle(lifecycleId: string): readonly PostingRuleEntry[] {
  return POSTING_RULE_REGISTRY.filter((e) => e.lifecycleId === lifecycleId);
}

/** Find the registry entry for a given posting-rule id (first match). */
export function findEntryForRuleId(postingRuleId: string): PostingRuleEntry | undefined {
  return POSTING_RULE_REGISTRY.find((e) => e.postingRuleId === postingRuleId);
}
