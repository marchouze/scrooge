// platform/accounting/posting-rule-registry.ts
//
// Declarative, queryable mapping from trigger event types to expected
// accounting entries (SubLedgerPostingEmitted). Replaces the implicit
// dispatch-map comments in gl-posting-engine.ts as the single authoritative
// source for the trade-domain → accounting-domain relationship.
//
// Design principles (established 2026-05-22 session):
//   1. Trade lifecycle domain owns trigger events; accounting domain owns
//      the consequence (SubLedgerPostingEmitted).
//   2. The accounting domain depends on trigger events from ANY domain —
//      not only trade events. Non-trade triggers (risk, product-control,
//      period-close) are stubbed here with condition: "intentional-no-impact"
//      until their event types are defined and wired.
//   3. lifecycleStage scopes each entry so the recon pipeline can assert:
//      - "opening" entries must exist for every lifecycle instance
//      - "terminal" entries must exist for every CLOSED instance
//      - "in-flight" entries are checked but not mandated
//
// The POSTING_RULE_REGISTRY is the contract between the posting-rule engine
// (gl-posting-engine.ts) and the recon pipeline (recon:gl-ledger-coverage).
// Any rule wired in the engine must appear here; any entry here with
// condition ≠ "intentional-no-impact" must be wired in the engine.
//
// Stub classification (per Gap-4 audit, 2026-05-26):
//   Category A — event type EXISTS in EVENT_TYPE_REGISTRY, stub is unwarranted
//                → must be wired (recon:posting-rule-stub-audit will FAIL)
//   Category B — event type does NOT exist in EVENT_TYPE_REGISTRY
//                → legitimately deferred; conditionDetail cites
//                  D-DATA-QUALITY-CROSS-DOMAIN-V1
//   Category C — event type EXISTS, stub is genuinely zero-accounting-impact
//                → keep stub; conditionDetail contains "[zero-impact-by-design]"
//                  with IFRS 9 / accounting-policy rationale
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved).
// Author: Bea (Accounting & financial reporting engineer, engineering).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The domain that owns the trigger event — i.e. the agent responsible for
 * emitting it. The accounting agent subscribes; it never emits the trigger.
 */
export type TriggerDomain =
  | "trade" // FxTradeExecuted, BondTradeExecuted, etc.
  | "risk" // future: ProvisionCalculated, CcrEadComputed, etc.
  | "product-control" // future: BookPnlAttributed, etc.
  | "period-close" // AccountingPeriodOpened → reversal; PeriodClosed → snapshot
  | "manual"; // ManualJournalEntry (already first-class)

/**
 * Where in the lifecycle the trigger event sits.
 * Used by the recon pipeline to scope coverage assertions.
 */
export type LifecycleStage = "opening" | "in-flight" | "terminal";

export interface PostingRuleEntry {
  /** Event type that triggers this posting rule (matches event store type field). */
  triggerEventType: string;
  /** Domain that owns and emits the trigger event. */
  triggerDomain: TriggerDomain;
  /**
   * Lifecycle this entry belongs to — matches TRADE_LIFECYCLE_REGISTRY[n].lifecycleId,
   * or "n/a" for non-lifecycle entries (period-close, manual, non-trade stubs).
   */
  lifecycleId: string;
  /**
   * Where in the lifecycle this trigger fires.
   * Drives recon assertion strength: opening = always assert; terminal = assert
   * on closed instances only; in-flight = check but don't mandate.
   */
  lifecycleStage: LifecycleStage;
  /** Stable posting-rule identifier (e.g. "PR-FX-001"). */
  postingRuleId: string;
  /** Matches SubLedgerPostingEmitted.payload.postingType. */
  postingType: string;
  /**
   * When a posting is expected:
   *   "always"           — every occurrence of this trigger must produce a posting
   *   "non-zero-delta"   — skipped when the P&L delta / revaluation delta is zero
   *   "non-zero-pnl"     — skipped when realised P&L is zero
   *   "intentional-no-impact" — this event never produces a posting by design
   */
  condition: "always" | "non-zero-delta" | "non-zero-pnl" | "intentional-no-impact";
  /** Human-readable reason for the condition (IFRS citation or plain text). */
  conditionDetail?: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const POSTING_RULE_REGISTRY: readonly PostingRuleEntry[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // FX SPOT  (lifecycleId: "fx-spot-trade")
  // ══════════════════════════════════════════════════════════════════════════

  // PR-FX-001 — Initial recognition at trade date (IFRS 9 §3.1.1, §5.1.1)
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

  // PR-FX-002 — Daily FVTPL revaluation (IFRS 9 §5.7.1, IAS 21 §28)
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

  // PR-FX-INSTRUCT — Settlement instruction (memo; no GL impact)
  // Category C: genuinely zero-accounting-impact — FxSettlementInstructed is an
  // informational payment-instruction event; cash moves only on correspondent
  // confirmation (FxSettlementConfirmed / PrincipalPayment). No IFRS 9 recognition
  // trigger fires on instruction dispatch. [zero-impact-by-design]
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

  // PR-FX-PRIN — Per-leg cash at correspondent confirmation
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

  // PR-FX-REGREPORT — Regulatory reporting dispatch (memo; no GL impact)
  // Category C: genuinely zero-accounting-impact — TradeReportSubmitted is a
  // regulatory-dispatch confirmation (SARB FinSurv / DTCC). Submission of a
  // report is not a financial transaction; IFRS 9 prescribes no GL entry
  // for regulatory reporting events. [zero-impact-by-design]
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

  // PR-FX-LIFECYCLE-CLOSE — Realised P&L on settlement confirmation
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

  // PR-FX-CANCEL — Reversal postings on trade cancellation
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

  // PR-FX-005 — Stage-3 ECL on one-leg-delivered failure
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

  // PR-FX-003 — DEPRECATED settlement path (back-compat only)
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
  // BOND  (lifecycleId: "bond-trade")
  // ══════════════════════════════════════════════════════════════════════════

  // PR-BOND-001 — Initial recognition (IFRS 9 §3.1.1; FVOCI / FVTPL / AC)
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

  // PR-BOND-EIR — Interest accrual under effective interest method
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

  // PR-BOND-002 — FVTPL / FVOCI revaluation
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

  // PR-BOND-MAT — Maturity / principal repayment
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

  // PR-BOND-SALE — Sale before maturity
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

  // PR-EQ-001 — Initial recognition (IFRS 9 §5.1.1, FVTPL)
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

  // PR-EQ-002 — FVTPL revaluation
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

  // PR-EQ-CA — Corporate action (dividend, stock split)
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

  // No direct GL entry on settlement instruction (memo path)
  // Category C: genuinely zero-accounting-impact — EquitySettlementInstructed is
  // a settlement-system dispatch memo (DVP instruction to STRATE). GL recognition
  // fires only on EquitySettlementConfirmed (IFRS 9 §3.2.3 settlement-date
  // derecognition). [zero-impact-by-design]
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

  // PR-EQ-004 — Derecognition on settlement confirmation
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

  // PR-IRS-001 — Initial recognition (IFRS 9 §4.1.4 — at fair value)
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

  // PR-IRS-002 — NPV revaluation
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

  // Coupon schedule generation — memo only
  // Category C: genuinely zero-accounting-impact — IrsCouponScheduleGenerated
  // records the fixing of coupon amounts for the payment schedule. No cash
  // changes hands at this point; IFRS 9 B5.4.1 EIR accrual fires on coupon
  // settlement dates, not on schedule publication. [zero-impact-by-design]
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

  // Coupon payment instruction — memo only
  // Category C: genuinely zero-accounting-impact — IrsCouponPaymentInstructed
  // dispatches a payment instruction to the correspondent; no cash has moved.
  // GL posts on IrsCouponSettlementConfirmed per IFRS 9 net-settlement
  // recognition. [zero-impact-by-design]
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

  // PR-IRS-003 — Net coupon cash settlement
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

  // PR-IRS-TERM — Termination / derecognition
  {
    // Canonical event is IrdSwapTerminated (ird-accounting.ts); the prior
    // 'IrsSwapTerminated' typo meant this rule never fired. No such events exist
    // yet, so the fix is figure-neutral and activates the rule going forward.
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
  // REPO  (lifecycleId: "repo-trade")
  // Authority: WS1-PR1a; IAS 39 §27; IFRS 9 §3.2.3–3.2.4
  // ══════════════════════════════════════════════════════════════════════════

  // PR-REPO-001 — Initial recognition as secured borrowing (IAS 39 §27)
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

  // PR-REPO-SETTLE-START — Start-leg confirmation (memo; no GL impact)
  // Category C: genuinely zero-accounting-impact — RepoStartLegSettled confirms
  // that the start-leg cash and collateral exchange has completed. Initial
  // recognition was already posted on RepoTradeOpened (IAS 39 §27 secured-
  // borrowing model). Posting a second entry here would double-count the
  // liability. [zero-impact-by-design]
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

  // PR-REPO-ACCRUAL — Daily repo rate accrual (IFRS 9 B5.4.1 EIR)
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

  // PR-REPO-END — Repurchase settlement (terminal)
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

  // PR-REPO-CANCEL — Early unwind (terminal)
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
  // MMD / DEPOSIT  (lifecycleId: "mmd-deposit")
  // Authority: WS1-PR1a; IFRS 9 §4.2.1; BA 110 (LCR outflow rates)
  // ══════════════════════════════════════════════════════════════════════════

  // PR-MMD-001 — Initial recognition of deposit liability
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

  // PR-MMD-ACCRUAL — Daily interest expense accrual
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

  // PR-MMD-MAT — Maturity repayment (terminal)
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

  // PR-MMD-CANCEL — Early withdrawal (terminal)
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
  // FUNDING LINE  (lifecycleId: "funding-line")
  // Authority: WS1-PR1a; IFRS 9 §4.2.1; BA 110 Table 2 (100% outflow rate)
  // ══════════════════════════════════════════════════════════════════════════

  // PR-FUNDING-001 — Drawdown recognition
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

  // PR-FUNDING-END — Full repayment (terminal)
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
  // INTERBANK LOAN  (lifecycleId: "interbank-loan")
  // Authority: WS1-PR1a; IFRS 9 §4.1.2 (amortised cost); BA 120 (NSFR)
  // ══════════════════════════════════════════════════════════════════════════

  // PR-IBL-001 — Initial recognition of placement (bank as lender)
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

  // PR-IBL-ACCRUAL — Daily interest income accrual
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

  // PR-IBL-MAT — Maturity receipt (terminal)
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

  // PR-IBL-RECALL — Early recall by lender (terminal)
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
  // NON-TRADE TRIGGER STUBS
  // These event types do not yet exist in EVENT_TYPE_REGISTRY. They are
  // registered here so the gap is visible in recon output. Each stub must
  // be updated when the corresponding domain event is introduced and wired
  // into the GL engine. See platform/accounting/non-trade-trigger-spec.md
  // for the pattern.
  // ══════════════════════════════════════════════════════════════════════════

  // Category B: deferred — event schema pending D-DATA-QUALITY-CROSS-DOMAIN-V1.
  // ProvisionCalculated does not yet exist in the EVENT_TYPE_REGISTRY; the risk
  // domain has not yet published its ECL calculation event schema. Wire this rule
  // when the risk domain lands ProvisionCalculated (IFRS 9 §5.5 ECL provision
  // posting: Dr ECL Expense / Cr Loss Allowance).
  // deferred: event schema pending — D-DATA-QUALITY-CROSS-DOMAIN-V1
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

  // Category B: deferred — event schema pending D-DATA-QUALITY-CROSS-DOMAIN-V1.
  // BookPnlAttributed does not yet exist in the EVENT_TYPE_REGISTRY; the
  // product-control domain has not yet published its book-level P&L attribution
  // event schema. Wire this rule when product-control lands BookPnlAttributed
  // (IFRS 9 §5.7.1 FVTPL P&L posting: Dr/Cr FVTPL Position / Dr/Cr P&L).
  // deferred: event schema pending — D-DATA-QUALITY-CROSS-DOMAIN-V1
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

/** Find all registry entries that are expected to produce postings (condition ≠ intentional-no-impact). */
export function getMandatoryEntries(): readonly PostingRuleEntry[] {
  return POSTING_RULE_REGISTRY.filter((e) => e.condition !== "intentional-no-impact");
}

/** Find all registry entries for a given lifecycle. */
export function findEntriesForLifecycle(lifecycleId: string): readonly PostingRuleEntry[] {
  return POSTING_RULE_REGISTRY.filter((e) => e.lifecycleId === lifecycleId);
}
