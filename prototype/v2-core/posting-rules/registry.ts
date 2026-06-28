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
  /**
   * STRUCTURED retirement flag. `true` iff this rule is superseded and MUST NOT
   * be rendered as a live posting rule on any product / accounting surface. The
   * row stays registered (append-only; replay of historical events still
   * resolves it) but every read-path that renders "which rules are LIVE" filters
   * `deprecated === true` out. Sourced as a typed boolean — NOT parsed from the
   * free-text `conditionDetail` prose (Charter cmd 4, source-don't-hardcode).
   * When set, `supersededBy` names the live rule(s) that replaced it.
   */
  deprecated: z.boolean().optional(),
  /** The live posting-rule id(s) that supersede a `deprecated` rule (audit trail). */
  supersededBy: z.array(z.string().min(1)).optional(),
  /**
   * IFRS 9 measurement-family GATE. When set, this rule applies ONLY to a product
   * whose `accountingClassification.ifrs9Family` matches — so an FVOCI-only rule
   * never renders for an FVTPL product. This is the structured, IFRS-coherent way
   * to scope a measurement-specific rule out of a product family it can never fire
   * for (e.g. the FVOCI→P&L reclassification rule, which can never fire for an FX
   * derivative — FX is mandatorily FVTPL, IFRS 9 §5.7.5 is equity-only). Sourced as
   * a typed field, not a hardcoded render denylist (Charter cmd 4).
   * Authority: D-FX-ACCOUNTING-RENDER-COHERENCE; D-FX-IFRS-REVIEW-FOUNDATION (F1).
   */
  appliesWhenIfrs9Family: z.enum(["fvtpl", "fvoci", "amortised-cost"]).optional(),
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
    deprecated: true,
    supersededBy: ["PR-FX-001-V2"],
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
    deprecated: true,
    supersededBy: ["PR-FX-REVAL-V2"],
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
    deprecated: true,
    supersededBy: ["PR-FX-SETTLE-V2"],
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
    deprecated: true,
    supersededBy: ["PR-FX-CLOSE-V2"],
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
      "DEPRECATED 2026-05-20 — superseded by the V2 FIL fold (PR-FX-SETTLE-V2 + PR-FX-CLOSE-V2); kept for legacy test fixture back-compat",
    deprecated: true,
    supersededBy: ["PR-FX-SETTLE-V2", "PR-FX-CLOSE-V2"],
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
      "IFRS 9 §3.1.1, §5.1.1, B3.1.2 — FX trade-date FVTPL recognition (FIL fold). An at-market FX derivative has fair value ≈ 0 at inception → NIL on-balance-sheet gross-up (the old self-cancelling Dr-receivable/Cr-payable pair is REMOVED). The contractual buy/sell notionals are recorded OFF-balance-sheet in the FX-commitment memorandum block (ACC-9100-*), self-balancing per currency from the fxAgreement quad. The on-balance-sheet position is carried by daily revaluation (PR-FX-REVAL-V2). Authority: D-FX-TRADE-DATE-FVTPL-OBS.",
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
      "IFRS 9 §3.2.3 — FX derecognition on settlement/cancellation (FIL fold). The reworked reversal fires at fold time when FilInstrumentTerminated.derecognitionTerms is present (accumulated unrealised → realised); a bare terminal posts the zero-amount memo. Settlement realised-P&L, swap-leg, NDF-fixing and FVOCI→P&L reclassification refinements are now WIRED via the FIL FX settlement event family (D-FIL-FX-SETTLEMENT-EVENTS) — the former ProductDeferredGaps are resolved.",
  },

  // ── FX completeness rules (WS-ACCT-FX-COMPLETENESS Slice 3; WIRED by
  //    WS-FIL-FX-SETTLEMENT-EVENTS) ───────────────────────────────────────────
  // Each rule's POSTING LOGIC is implemented + balanced + unit-tested in
  // v2-core/posting-rules/fx-settlement.ts, and the TRIGGER-WIRING now FIRES at
  // fold time: the FIL FX settlement event family (FilFxSettlementConfirmed /
  // FilNdfFixingObserved / the enriched FilInstrumentTerminated) carries the
  // economic terms these rules need (D-FIL-FX-SETTLEMENT-EVENTS). The five
  // ProductDeferredGaps are resolved append-only. lifecycleId "fx-fil-instance"
  // is NOT a TRADE_LIFECYCLE_REGISTRY lifecycle, so these rows impose no
  // gl-ledger-coverage mandate. Authority: D-ACCT-FX-IFRS-POSTING-COMPLETENESS;
  // D-FIL-FX-SETTLEMENT-EVENTS.
  {
    triggerEventType: "FilFxSettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-SETTLE-V2",
    postingType: "fx-fil-settlement-realised-pnl",
    condition: "non-zero-pnl",
    conditionDetail:
      'IAS 21 §23, §28 — settlement-date cash recognition + realised FX P&L (spot / physical forward). Fires at fold time on FilFxSettlementConfirmed{legRole:"spot"} via fx-settlement.postFxSettlementLegs (resolved gap fx-settlement-realised-pnl-trigger).',
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
      'IAS 21 §23 — FX swap near-leg settlement. Fires at fold time on FilFxSettlementConfirmed{legRole:"swap-near"} via fx-settlement.postFxSwapNearLegLegs (resolved gap fx-swap-near-far-leg-trigger).',
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
      'IAS 21 §23 — FX swap far-leg settlement; closes composite. Fires at fold time on FilFxSettlementConfirmed{legRole:"swap-far"} via fx-settlement.postFxSwapFarLegLegs (resolved gap fx-swap-near-far-leg-trigger).',
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
      "IFRS 9 §5.7.1 / IAS 21 §28 — NDF fixing cash-settled realised P&L (no principal legs). Fires at fold time on FilNdfFixingObserved via fx-settlement.postFxNdfFixingLegs (resolved gap fx-ndf-fixing-trigger).",
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
      "IFRS 9 §5.7.10–11 — FVOCI → P&L reclassification on derecognition. RETAINED machinery for the future EQUITY-instrument estate (postFxFvociReclassLegs); it can NEVER fire for an FX derivative, which is mandatorily FVTPL (IFRS 9 §5.7.5 is equity-only). Gated FVOCI-only so it does NOT render on an FVTPL FX product (D-FX-ACCOUNTING-RENDER-COHERENCE; D-FX-IFRS-REVIEW-FOUNDATION F1).",
    // FVOCI-only — never renders for an FVTPL FX product.
    appliesWhenIfrs9Family: "fvoci",
  },
  // ── FX trade-date OBS commitment release + FCY→ZAR realisation
  //    (D-FX-TRADE-DATE-FVTPL-OBS settlement side; D-FX-PNL-FCY-EXPOSURE-
  //    REVALUATION realisation). Two posting rules the trade-date OBS-memorandum
  //    model adds to the FX lifecycle: the OBS commitment recorded at trade date
  //    (PR-FX-001-V2) is RELEASED on settlement/maturity, and realised P&L arises
  //    ONLY on FCY→ZAR conversion (settlement itself is P&L-neutral). Both are pure
  //    leg functions in fx.ts / fx-settlement.ts; these rows make the rule ids
  //    first-class so they resolve in the NPA accounting perspective + the
  //    leg-structure drift gate. lifecycleId "fx-fil-instance" is NOT a
  //    TRADE_LIFECYCLE_REGISTRY lifecycle, so no gl-ledger-coverage mandate.
  {
    triggerEventType: "FilFxSettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-OBS-RELEASE-V2",
    postingType: "fx-fil-obs-commitment-release",
    condition: "always",
    conditionDetail:
      "IAS 21 §23 — release the trade-date OFF-balance-sheet FX-commitment memorandum (ACC-9100-*) on settlement/maturity. The standing commitment to exchange the two currencies is discharged when the trade settles, so the OBS memorandum legs PR-FX-001-V2 booked are reversed (equal-and-opposite, self-balancing per currency). The on-balance-sheet reval is reclassified to realised P&L by PR-FX-CLOSE-V2 separately, so the two never double-reverse. Fires at fold time via fx.postFxObsCommitmentReleaseLegs. Authority: D-FX-TRADE-DATE-FVTPL-OBS.",
  },
  {
    triggerEventType: "FilFxSettlementConfirmed",
    triggerDomain: "trade",
    lifecycleId: "fx-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-FX-CONVERT-V2",
    postingType: "fx-fil-fcy-zar-conversion",
    condition: "non-zero-pnl",
    conditionDetail:
      "IAS 21 §28 / IFRS 9 §5.7.1 — FCY→ZAR conversion (realisation). Settlement is P&L-NEUTRAL: the FCY exposure stays OPEN, carried as FCY cash at its ZAR cost basis. Realised P&L = ZAR proceeds − ZAR cost basis, struck ONLY when the FCY is converted back to ZAR (the position is squared); a second pair reclassifies the cumulative unrealised (ACC-2100-005) into realised (ACC-2100-006), total P&L unchanged. Fires at fold time via fx-settlement.postFxConversionLegs. Authority: D-FX-PNL-FCY-EXPOSURE-REVALUATION.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CAPITAL V2 FIL-FOLD posting rules (lifecycleId: "capital-fil-instance").
  //
  // The V2 capital composition (D-CAPITAL-ASSET-CLASS-V1) computes the BA-700 /
  // BA-100 own-funds composition as a PURE FOLD over the generic FIL instance
  // lifecycle events (FilInstrumentCreated / FilInstrumentAmended /
  // FilInstrumentTerminated) for `capital` asset-class instances, via the pure
  // rules in `v2-core/posting-rules/capital.ts`. No `SubLedgerPostingEmitted` /
  // `GlPostingEmitted` is stored on the capital read path — the legs are folded in
  // memory — so these are NOT gl-ledger-coverage mandates; they document the V2
  // capital posting determination so the capital treatment module's
  // `applicablePostingRuleIds` resolve (recon:accounting-schema-home assertion c).
  // lifecycleId "capital-fil-instance" is NOT a TRADE_LIFECYCLE_REGISTRY lifecycle.
  // Authority: D-CAPITAL-ASSET-CLASS-V1; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "FilInstrumentCreated",
    triggerDomain: "trade",
    lifecycleId: "capital-fil-instance",
    lifecycleStage: "opening",
    postingRuleId: "PR-CAP-ISSUE-001-V2",
    postingType: "capital-fil-issuance",
    condition: "always",
    conditionDetail:
      "IAS 32 §22 (CET1 equity at proceeds) / IFRS 9 §4.2.1 (AT1/T2 liability amortised cost) — own-funds recognition on issuance (FIL fold). Dr settlement-cash / Cr own-funds account per qualifying tier. Reg 38; Banks Act §70; BCBS RBC20.2; CAP.",
  },
  {
    triggerEventType: "FilInstrumentAmended",
    triggerDomain: "trade",
    lifecycleId: "capital-fil-instance",
    lifecycleStage: "in-flight",
    postingRuleId: "PR-CAP-ADJUST-002-V2",
    postingType: "capital-fil-adjustment",
    condition: "non-zero-delta",
    conditionDetail:
      "Partial redemption / Tier 2 straight-line amortisation step (last 5 years; BCBS CAP). Re-stamps the carrying amount the composition counts. CET1 distributions (IAS 32 §35) are an equity charge in the retained-earnings fold, NOT a capital-instrument posting — tracked deferred gap.",
  },
  {
    triggerEventType: "FilInstrumentTerminated",
    triggerDomain: "trade",
    lifecycleId: "capital-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-CAP-REDEEM-003-V2",
    postingType: "capital-fil-redemption",
    condition: "always",
    conditionDetail:
      "IAS 32 §33 (own equity derecognition) / IFRS 9 §3.3.1 (liability extinguishment) — own-funds derecognition on redemption/call/maturity/cancellation (FIL fold). A bare terminal posts the zero-amount memo; the redemption-proceeds cash leg requires a richer FIL terminal event (tracked deferred gap, mirrors PR-FX-CLOSE-V2).",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEPOSIT V2 FIL-FOLD posting rules (lifecycleId: "deposit-fil-instance").
  //
  // The born-V2 deposit (bank-as-taker liability) contribution to BA 100 (balance
  // sheet) + BA 300 (LCR / NSFR) is computed as a PURE FOLD over the generic FIL
  // instance lifecycle events (FilInstrumentCreated / FilInstrumentTerminated) for
  // money-market DEPOSIT instances (`fil:type:ir:money-market.deposit:*`), via the
  // pure rules in `v2-core/posting-rules/deposit.ts` (mirrors the capital fold). No
  // `SubLedgerPostingEmitted` / `GlPostingEmitted` is stored on the deposit read
  // path — the legs are folded in memory — so these are NOT gl-ledger-coverage
  // mandates; they document the V2 deposit posting determination so the deposit
  // treatment module's `applicablePostingRuleIds` resolve. lifecycleId
  // "deposit-fil-instance" is NOT a TRADE_LIFECYCLE_REGISTRY lifecycle.
  //
  // BORN-V2 — supersedes the v1-only `mmd-deposit` lifecycle (PR-MMD-001 et al.,
  // below) for the leaf-fold read path. The v1 rows stay registered (replay of
  // historical events resolves them); the v1→v2 flip of the DepositTaken event
  // estate is the tracked follow-on (gap ba300-deposit-funding-v1-flip), NOT widened
  // here (V1-retirement directive rule 1: no new v1-only emission — this slice emits
  // born-V2 FIL events only). Authority: D-BA-RETURN-CELL-VALUE-ENGINE;
  // D-BA-RETURN-CAPABILITY-FIRST; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
  // D-V1-REMOVAL-PHASE-1.
  // ══════════════════════════════════════════════════════════════════════════
  {
    triggerEventType: "FilInstrumentCreated",
    triggerDomain: "trade",
    lifecycleId: "deposit-fil-instance",
    lifecycleStage: "opening",
    postingRuleId: "PR-DEP-TAKEON-001-V2",
    postingType: "deposit-fil-take-on",
    condition: "always",
    conditionDetail:
      "IAS 32 §11/§AG3 (financial liability) / IFRS 9 §3.1.1 + §4.2.1 (amortised cost) — deposit recognition on take-on (FIL fold). Dr settlement-cash (nostro) / Cr deposit-liability account per counterparty sector (ACC-6100-001..004). The BA 100 deposit detail line (R0570–R0620) is keyed off the instance's typed depositTerms.depositCategory; the LCR run-off band + R1010 sector analysis off counterpartySector. BCBS d238 LCR; SARB Reg 26; BA 100; BA 300.",
  },
  {
    triggerEventType: "FilInstrumentTerminated",
    triggerDomain: "trade",
    lifecycleId: "deposit-fil-instance",
    lifecycleStage: "terminal",
    postingRuleId: "PR-DEP-REPAY-002-V2",
    postingType: "deposit-fil-repayment",
    condition: "always",
    conditionDetail:
      "IFRS 9 §3.3.1 (financial-liability extinguishment) — deposit derecognition on maturity/repayment/early-withdrawal (FIL fold). A bare terminal posts the zero-amount memo; the principal-repayment cash leg + accrued-interest settlement require a richer FIL terminal event (tracked deferred gap, mirrors PR-CAP-REDEEM-003-V2 / PR-FX-CLOSE-V2).",
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

/**
 * True iff the posting-rule id is RETIRED (structured `deprecated` flag). A
 * retired rule stays registered (replay of historical events resolves it) but
 * MUST NOT render as a live posting rule on any product / accounting surface.
 * Sourced from the registry's own typed flag — never a hardcoded denylist
 * (Charter cmd 4). An unknown rule id is treated as NOT deprecated (the caller's
 * other gates assert real-id existence).
 */
export function isDeprecatedRuleId(postingRuleId: string): boolean {
  return POSTING_RULE_REGISTRY.some(
    (e) => e.postingRuleId === postingRuleId && e.deprecated === true,
  );
}

/** The set of LIVE (non-deprecated) trigger event types for a set of lifecycle ids. */
export function liveTriggerEventTypesForLifecycles(
  lifecycleIds: readonly string[],
): ReadonlySet<string> {
  const live = new Set<string>();
  for (const e of POSTING_RULE_REGISTRY) {
    if (e.deprecated === true) continue;
    if (!lifecycleIds.includes(e.lifecycleId)) continue;
    live.add(e.triggerEventType);
  }
  return live;
}
