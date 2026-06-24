// v2-core/posting-rules/fx-settlement.ts
//
// FX SETTLEMENT / DERECOGNITION / NDF / FVOCI-RECLASS posting rules — the pure
// `economic-input → balanced leg[]` core of the FX posting permutations the
// initial-recognition + revaluation rules (fx.ts) do not cover
// (WS-ACCT-FX-COMPLETENESS Slice 3, D-ACCT-FX-IFRS-POSTING-COMPLETENESS).
//
// WHY THESE ARE PURE FUNCTIONS OVER AN EXPLICIT INPUT (not over a FIL event)
// -------------------------------------------------------------------------
// The V2 accounting fold reads the FIL instance lifecycle, which has exactly
// three events: FilInstrumentCreated / FilInstrumentAmended / FilInstrumentTerminated.
// The terminal event (`FilInstrumentTerminated`) carries NO economic terms — no
// notional, no settlement rate, no booked rate — so the settlement realised-P&L,
// swap-leg, NDF-fixing and FVOCI→P&L reclassification postings CANNOT be derived
// automatically from the current FIL terminal event. That trigger-wiring gap is
// recorded as tracked `ProductDeferredGap`s (FX_SETTLEMENT_DEFERRED_GAPS below),
// NOT silently omitted (Engineering Charter cmd 5).
//
// What IS done now — and is load-bearing the moment the FIL terminal event grows
// economic terms — is the IFRS posting LOGIC itself: each rule is a pure,
// balanced, IFRS-cited `payload → leg[]` function with a unit test proving the
// legs sum to zero per currency. When the richer FIL terminal event lands, the
// fold calls these functions with the terms it then carries; the determination
// is already correct and proven.
//
// MONEY: decimal-native MoneyWire ({__money,currency,amount} major-unit string).
// Arithmetic uses the decimal-engine-free string add/sub helpers below (the
// amounts are exact decimal strings; we never convert to float).
//
// PACKAGE BOUNDARY: inside `v2-core/` — imports only v2-core modules.
//
// Authority: D-ACCT-FX-IFRS-POSTING-COMPLETENESS (CEO-approved 2026-06-18);
//   D-ACCT-SCHEMA-CANONICAL-HOME; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
//   IFRS 9 §3.2.3, §5.7.1, §5.7.10–11; IAS 21 §23, §28.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { MoneyWire } from "../core/money-wire";
import { FX_FVOCI_OCI_RESERVE_ACCOUNT, type FxPostingLeg, resolveFxAccountSet } from "./fx";

// ---------------------------------------------------------------------------
// Money helpers — EXACT decimal arithmetic via BigInt, never IEEE-754 float.
// v2-core/core has no decimal engine and v2-core may not import the platform
// decimal engine (package boundary), so the minimal exact subtract/zero-check
// the realised-P&L balancing needs is implemented here on scaled BigInt.
// ---------------------------------------------------------------------------

function money(currency: string, amount: string): MoneyWire {
  return { __money: "v1", currency, amount };
}

/** Parse a decimal string into { sign, integer-scaled BigInt, scale }. */
function parseDecimal(s: string): { neg: boolean; digits: bigint; scale: number } {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const dot = body.indexOf(".");
  if (dot === -1) return { neg, digits: BigInt(body || "0"), scale: 0 };
  const intPart = body.slice(0, dot);
  const fracPart = body.slice(dot + 1);
  const scale = fracPart.length;
  const digits = BigInt(`${intPart}${fracPart}` || "0");
  return { neg, digits, scale };
}

/** True iff the decimal string is exactly zero (any scale / sign). */
function isZeroDecimal(s: string): boolean {
  const p = parseDecimal(s);
  return p.digits === 0n;
}

/** Realised-P&L account for FX (currency-agnostic functional-currency P&L). */
const FX_REALISED_PNL_ACCOUNT = "ACC-2100-006";

// ---------------------------------------------------------------------------
// PR-FX-SETTLE-V2 (#5) — Settlement / realised P&L (spot & physical forward).
// IAS 21 §23, §28. FVTPL TREATMENT (D-FX-TRADE-DATE-FVTPL-OBS, settlement side).
//
// THE FVTPL SHIFT (why this is NOT a gross receivable/payable relief any more)
// ---------------------------------------------------------------------------
// Trade-date recognition is now IFRS 9 FVTPL + off-balance-sheet memorandum
// (PR-FX-001-V2): an at-market FX trade posts NIL on-balance-sheet at inception
// and records the contractual buy/sell notionals OFF-balance-sheet (ACC-9100-*).
// There is therefore NO on-balance-sheet FX trading receivable/payable
// (ACC-2100-002/003/…) for settlement to extinguish. The OLD settlement entry
// relieved a gross receivable/payable that no longer exists on-balance-sheet, so
// it left DANGLING inverted ACC-2100 balances after every settled trade — the
// defect this rule fixes.
//
// THE FVTPL SETTLEMENT ENTRY. At settlement the derivative is derecognised and
// the cash is recognised at the settled amounts. The balancing entry is REALISED
// FX P&L (ACC-2100-006) — NOT a receivable/payable relief:
//
//   Dr Cash (bought ccy) @ settled amount   ;  Cr Realised FX P&L (bought ccy)
//   Cr Cash (sold ccy)   @ settled amount   ;  Dr Realised FX P&L (sold ccy)
//
// Each cash movement balances IN ITS OWN CURRENCY against the realised-P&L leg —
// there is NO same-currency gross-up (no opposing receivable in the same ccy).
// The realised-P&L account accumulates the per-currency legs; its REPORTING-
// CURRENCY net (Σ received − Σ paid, translated) IS the realised FX result of the
// trade. The on-BS derivative carrying value accrued by revaluation (unrealised
// P&L, ACC-2100-005) is reclassified into realised separately on the terminal
// derecognition event (PR-FX-CLOSE-V2, `postFxDerecognitionLegs`); this rule is
// the settlement-date cash + realised recognition.
//
// `bookedAmount` is RETAINED in the input shape (the OBS commitment carrying at
// the booked rate) for callers / the deferred swap-leg permutations, but the
// FVTPL cash leg is recognised at the SETTLED amount and the balancing realised
// P&L matches it in the same currency — so the per-currency entry closes at zero.
// ---------------------------------------------------------------------------

export interface FxSettlementInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  /** Bought-currency leg: the receivable that becomes cash on settlement. */
  readonly boughtCurrency: string;
  /** Receivable carrying amount at the BOOKED rate (functional ccy of the leg). */
  readonly boughtBookedAmount: string;
  /** Cash actually received at the SETTLEMENT rate (same ccy). */
  readonly boughtSettledAmount: string;
  /** Sold-currency leg: the payable extinguished by paying cash. */
  readonly soldCurrency: string;
  /** Payable carrying amount at the BOOKED rate. */
  readonly soldBookedAmount: string;
  /** Cash actually paid at the SETTLEMENT rate (same ccy). */
  readonly soldSettledAmount: string;
}

const SETTLE_RULE = {
  ruleId: "PR-FX-SETTLE-V2",
  ias: "IAS 21 §23, §28 — settlement-date cash recognition + realised FX P&L",
};

/** Cash account for a settlement leg — the correspondent nostro for the ccy. */
export function nostroFor(currency: string): string {
  switch (currency) {
    case "ZAR":
      return "ACC-1200-001";
    case "USD":
      return "ACC-1200-002";
    case "EUR":
      return "ACC-1200-003";
    case "GBP":
      return "ACC-1200-004";
    case "JPY":
      return "ACC-1200-005";
    case "CHF":
      return "ACC-1200-006";
    case "AUD":
      return "ACC-1200-007";
    default:
      // Fail-closed to the FX settlement suspense (loud, balancing) — never a
      // silent USD fallback (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
      return "ACC-2100-007";
  }
}

/**
 * The GENERIC per-MOVEMENT settlement primitive (D-FX-TRADE-SETTLEMENT-PRODUCT-
 * MODEL, Slice 1; FVTPL settlement per D-FX-TRADE-DATE-FVTPL-OBS). Settles ONE
 * recognised leg — a single uniform asset movement — into its TWO GL legs: the
 * cash/nostro movement at the settled amount and the equal-and-opposite REALISED
 * FX P&L leg in the SAME currency. `side` selects the cash polarity (RECEIVE = Dr
 * cash; PAY = Cr cash) and the P&L counter-side. Amounts are POSITIVE magnitudes
 * (the sign is the `side`). NO on-balance-sheet receivable/payable is touched —
 * trade-date is OBS-only, so there is none to extinguish.
 *
 * This is the single source of the settlement leg math: `postFxSettlementLegs`
 * (the two-leg FX path) composes TWO of these, and the single-asset
 * `TradeSettlementExecuted` posting maps one movement onto exactly ONE call — so
 * N single-asset settlements net BYTE-IDENTICAL to the two-leg FX path by
 * construction, not by coincidence (Engineering Charter cmd 4 — source, don't
 * duplicate).
 */
export interface SettlementMovementInput {
  readonly currency: string;
  /** Cash actually moved at the SETTLEMENT rate (positive magnitude). */
  readonly settledAmount: string;
  /**
   * Carrying amount of the OBS commitment leg at the BOOKED rate (positive).
   * RETAINED for traceability + the deferred swap-leg permutations; the FVTPL
   * settlement recognises cash at the SETTLED amount and balances it with realised
   * P&L in the same currency, so this no longer drives an on-BS obligation relief.
   */
  readonly bookedAmount: string;
  /** `receive` recognises bought-leg cash (Dr cash); `pay` recognises sold-leg cash (Cr cash). */
  readonly side: "receive" | "pay";
}

type SettlementLegBase = Omit<
  FxPostingLeg,
  "creditDebit" | "accountCode" | "amount" | "description"
>;

/**
 * Produce the TWO GL legs for ONE FVTPL settlement movement: the cash recognition
 * at the SETTLED amount and the equal-and-opposite REALISED FX P&L leg in the SAME
 * currency. NO on-balance-sheet receivable/payable is touched — trade-date is now
 * OBS-only (PR-FX-001-V2), so there is no gross receivable/payable to extinguish.
 *
 *   receive → Dr Cash[ccy] (settled) ; Cr Realised P&L[ccy] (settled)
 *   pay     → Cr Cash[ccy] (settled) ; Dr Realised P&L[ccy] (settled)
 *
 * The entry closes at zero in the movement's own currency (no same-currency gross-
 * up). The realised-P&L account then carries one leg per settled currency; its
 * REPORTING-CURRENCY net across the trade's two movements is the realised FX result
 * (D-FX-TRADE-DATE-FVTPL-OBS). A zero settled amount yields no legs (nothing to
 * recognise).
 */
export function postSettlementMovementLegs(
  base: SettlementLegBase,
  movement: SettlementMovementInput,
): FxPostingLeg[] {
  if (isZeroDecimal(movement.settledAmount)) return [];
  const cashSide: "debit" | "credit" = movement.side === "receive" ? "debit" : "credit";
  // The realised-P&L leg is the OPPOSITE side of the cash leg, in the SAME currency,
  // for the SAME amount — so the movement balances in its own currency with no
  // receivable/payable. (The trade's reporting-currency realised result is the net
  // of the per-currency realised-P&L legs the two movements produce.)
  const pnlSide: "debit" | "credit" = cashSide === "debit" ? "credit" : "debit";
  const cashLeg: FxPostingLeg = {
    ...base,
    creditDebit: cashSide,
    accountCode: nostroFor(movement.currency),
    amount: money(movement.currency, movement.settledAmount),
    description:
      movement.side === "receive"
        ? `FX Settlement cash received ${movement.currency}`
        : `FX Settlement cash paid ${movement.currency}`,
  };
  const realisedPnlLeg: FxPostingLeg = {
    ...base,
    creditDebit: pnlSide,
    accountCode: FX_REALISED_PNL_ACCOUNT,
    amount: money(movement.currency, movement.settledAmount),
    description: `FX Settlement realised P&L ${movement.currency} (FVTPL, ${movement.side === "receive" ? "bought" : "sold"} leg)`,
  };
  return [cashLeg, realisedPnlLeg];
}

export function postFxSettlementLegs(input: FxSettlementInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: SETTLE_RULE.ias,
    postingRuleId: SETTLE_RULE.ruleId,
  };
  // FVTPL settlement: the two-leg path is exactly TWO per-movement settlements —
  // the bought-leg RECEIVE and the sold-leg PAY — composed through the SAME
  // per-movement primitive (`postSettlementMovementLegs`). Source, don't duplicate
  // (Engineering Charter cmd 4): one settlement math, so the two-leg FX path and N
  // single-asset `TradeSettlementExecuted` settlements net byte-identical per
  // (account, currency) by construction. Each movement recognises cash at the
  // settled amount and balances it with realised P&L in the SAME currency; no
  // on-balance-sheet receivable/payable is touched (trade-date is OBS-only).
  return [
    ...postSettlementMovementLegs(base, {
      currency: input.boughtCurrency,
      settledAmount: input.boughtSettledAmount,
      bookedAmount: input.boughtBookedAmount,
      side: "receive",
    }),
    ...postSettlementMovementLegs(base, {
      currency: input.soldCurrency,
      settledAmount: input.soldSettledAmount,
      bookedAmount: input.soldBookedAmount,
      side: "pay",
    }),
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-CLOSE-V2 (#6, reworked) — Derecognition with realised-P&L reversal.
// IFRS 9 §3.2.3.
//
// Reverses the accumulated revaluation asset/liability and recognises the
// realised P&L on derecognition, replacing the current zero-amount memo. Inputs
// are the prior accumulated reval (the unrealised P&L sitting in ACC-2100-005)
// and the realised result.
//
//   Dr/Cr FX Reval (reverse accumulated unrealised)
//   Cr/Dr FX Realised P&L (recognise realised)
// ---------------------------------------------------------------------------

export interface FxDerecognitionInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  readonly currency: string;
  /** Accumulated unrealised reval to reverse (signed: +gain credit balance). */
  readonly accumulatedUnrealised: string;
}

const CLOSE_RULE = {
  ruleId: "PR-FX-CLOSE-V2",
  ias: "IFRS 9 §3.2.3 — derecognition: reverse accumulated reval, recognise realised P&L",
};

export function postFxDerecognitionLegs(input: FxDerecognitionInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: CLOSE_RULE.ias,
    postingRuleId: CLOSE_RULE.ruleId,
  };
  const accounts = resolveFxAccountSet(input.currency);
  const amt = input.accumulatedUnrealised;
  if (isZeroDecimal(amt)) {
    // Nothing accumulated — a clean derecognition with no P&L to reclassify.
    return [];
  }
  const isGain = !amt.startsWith("-");
  const magnitude = isGain ? amt : amt.slice(1);
  // Reverse the unrealised (which sat as a credit gain in unrealised P&L) and
  // move it to realised P&L. The two legs net to zero in the currency.
  return [
    {
      ...base,
      creditDebit: isGain ? "debit" : "credit",
      accountCode: accounts.unrealisedPnl,
      amount: money(input.currency, magnitude),
      description: `FX Derecognition reverse unrealised ${input.currency}`,
    },
    {
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(input.currency, magnitude),
      description: `FX Derecognition recognise realised ${input.currency}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-SWAP-NEAR-V2 (#7) / PR-FX-SWAP-FAR-V2 (#8) — swap leg settlement.
// IAS 21 §23. Each leg settles per the spot/physical settlement rule (#5); the
// far leg additionally closes the composite. They reuse the settlement leg
// builder with the rule id rebranded.
// ---------------------------------------------------------------------------

export function postFxSwapNearLegLegs(input: FxSettlementInput): FxPostingLeg[] {
  return rebrand(
    postFxSettlementLegs(input),
    "PR-FX-SWAP-NEAR-V2",
    "IAS 21 §23 — swap near-leg settlement",
  );
}

export function postFxSwapFarLegLegs(input: FxSettlementInput): FxPostingLeg[] {
  return rebrand(
    postFxSettlementLegs(input),
    "PR-FX-SWAP-FAR-V2",
    "IAS 21 §23 — swap far-leg settlement; closes composite",
  );
}

function rebrand(legs: FxPostingLeg[], ruleId: string, ias: string): FxPostingLeg[] {
  return legs.map((l) => ({ ...l, postingRuleId: ruleId, iasRule: ias }));
}

// ---------------------------------------------------------------------------
// PR-FX-NDF-FIX-V2 (#9) — NDF fixing P&L (cash-only, NO principal legs).
// IFRS 9 §5.7.1 / IAS 21 §28.
//
//   P&L = notional × (fixing − contracted)
//   Dr/Cr Cash (settlement ccy) ; Cr/Dr FX Realised Gain/Loss
// No principal legs (an NDF is cash-settled; principal never exchanges).
// ---------------------------------------------------------------------------

export interface FxNdfFixingInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  /** Settlement currency the net cash difference is paid/received in. */
  readonly settlementCurrency: string;
  /** Net cash difference in the settlement currency: notional × (fixing − contracted).
   *  Positive = gain (cash received); negative = loss (cash paid). */
  readonly netCashDifference: string;
}

const NDF_RULE = {
  ruleId: "PR-FX-NDF-FIX-V2",
  ias: "IFRS 9 §5.7.1 / IAS 21 §28 — NDF fixing: cash-settled realised P&L, no principal",
};

export function postFxNdfFixingLegs(input: FxNdfFixingInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: NDF_RULE.ias,
    postingRuleId: NDF_RULE.ruleId,
  };
  const diff = input.netCashDifference;
  if (isZeroDecimal(diff)) return [];
  const isGain = !diff.startsWith("-");
  const magnitude = isGain ? diff : diff.slice(1);
  return [
    {
      ...base,
      creditDebit: isGain ? "debit" : "credit",
      accountCode: nostroFor(input.settlementCurrency),
      amount: money(input.settlementCurrency, magnitude),
      description: `FX NDF fixing cash ${input.settlementCurrency} (${isGain ? "received" : "paid"})`,
    },
    {
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(input.settlementCurrency, magnitude),
      description: `FX NDF fixing realised P&L ${input.settlementCurrency}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-FVOCI-RECLASS-V2 (#10) — FVOCI → P&L reclassification on derecognition.
// IFRS 9 §5.7.10–11.
//
//   Dr FVOCI reserve ; Cr FX Realised Gain/Loss (P&L)
// Recycles the accumulated OCI reserve into P&L when the FVOCI-elected
// instrument is derecognised.
// ---------------------------------------------------------------------------

export interface FxFvociReclassInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  readonly currency: string;
  /** Accumulated FVOCI reserve to recycle (signed: +credit reserve balance). */
  readonly accumulatedOci: string;
}

const FVOCI_RECLASS_RULE = {
  ruleId: "PR-FX-FVOCI-RECLASS-V2",
  ias: "IFRS 9 §5.7.10–11 — FVOCI → P&L reclassification on derecognition",
};

export function postFxFvociReclassLegs(input: FxFvociReclassInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: FVOCI_RECLASS_RULE.ias,
    postingRuleId: FVOCI_RECLASS_RULE.ruleId,
  };
  const amt = input.accumulatedOci;
  if (isZeroDecimal(amt)) return [];
  const isGain = !amt.startsWith("-");
  const magnitude = isGain ? amt : amt.slice(1);
  return [
    {
      ...base,
      creditDebit: isGain ? "debit" : "credit",
      accountCode: FX_FVOCI_OCI_RESERVE_ACCOUNT,
      amount: money(input.currency, magnitude),
      description: `FX FVOCI reserve recycle ${input.currency}`,
    },
    {
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(input.currency, magnitude),
      description: `FX FVOCI → P&L reclassification ${input.currency}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tracked deferred gaps — the TRIGGER-WIRING for the rules above was deferred
// because the FIL terminal/settlement events did not carry the economic terms
// these rules need. WS-FIL-FX-SETTLEMENT-EVENTS (D-FIL-FX-SETTLEMENT-EVENTS)
// CLOSED that gap: the FIL FX settlement event family now carries those terms
// and the FX trial-balance fold fires every rule (proof in fx-fold.test.ts).
//
// Each gap below is retained as the HISTORICAL record of what was deferred (the
// inventory is append-only — we never delete a tracked gap) and is now marked
// `resolvedBy` with the event family that satisfies its `targetTrigger`. The
// store-side closure (npa-fx-accounting-deferred-gaps.ts) re-emits the FX
// accounting attestation with the resolved gaps removed (latest-wins), and the
// NPA-page badge + the recorder both read `activeFxSettlementDeferredGaps()`
// (the still-open subset) so resolved rules render `active`.
// Engineering Charter cmd 5: no silent deferral; cmd 3: no green by concealment.
// ---------------------------------------------------------------------------

export interface FxDeferredPostingGap {
  readonly gapId: string;
  readonly title: string;
  readonly owner: string;
  readonly targetTrigger: string;
  readonly citations: readonly string[];
  /**
   * When the gap's trigger-wiring has landed, the authority + event family that
   * resolved it. `undefined` ⇒ still an open deferral. Resolution is recorded
   * in-code (the historical inventory is append-only) AND in the store (the
   * attestation re-emit drops the resolved gap latest-wins).
   */
  readonly resolvedBy?: string;
}

/** The WS-FIL-FX-SETTLEMENT-EVENTS resolution marker shared by all five gaps. */
const FX_SETTLEMENT_RESOLUTION =
  "D-FIL-FX-SETTLEMENT-EVENTS — FIL FX settlement/terminal/NDF event family carries the economic terms; the FX trial-balance fold fires the rule (fx-fold.test.ts)";

export const FX_SETTLEMENT_DEFERRED_GAPS: readonly FxDeferredPostingGap[] = [
  {
    gapId: "fx-settlement-realised-pnl-trigger",
    title:
      "PR-FX-SETTLE-V2 settlement realised-P&L: posting logic implemented + balanced, but the FIL fold cannot fire it automatically — FilInstrumentTerminated carries no settlement rate / booked rate. Needs a richer FIL settlement event (or terms on the terminal event).",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL terminal event carries settlement + booked economic terms",
    citations: ["IAS-21-§23", "IAS-21-§28", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilFxSettlementConfirmed{legRole:"spot"}`,
  },
  {
    gapId: "fx-derecognition-realised-reversal-trigger",
    title:
      "PR-FX-CLOSE-V2 derecognition reversal: posting logic implemented + balanced, but FilInstrumentTerminated carries no accumulated-reval amount, so the fold still posts the zero-amount memo. Needs the prior accumulated unrealised on the terminal event.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL terminal event carries accumulated unrealised reval",
    citations: ["IFRS-9-§3.2.3", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilInstrumentTerminated.derecognitionTerms`,
  },
  {
    gapId: "fx-swap-near-far-leg-trigger",
    title:
      "PR-FX-SWAP-NEAR-V2 / PR-FX-SWAP-FAR-V2 swap-leg settlement: posting logic implemented + balanced, but the FIL fold has no per-leg (near/far) settlement event for an FX swap composite. Needs swap-leg settlement events.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL swap near-leg / far-leg settlement events",
    citations: ["IAS-21-§23", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilFxSettlementConfirmed{legRole:"swap-near"|"swap-far"}`,
  },
  {
    gapId: "fx-ndf-fixing-trigger",
    title:
      "PR-FX-NDF-FIX-V2 NDF fixing P&L: posting logic implemented + balanced, but NO NDF fixing event (NdfFixingObserved / NdfFixed) exists in the FIL lifecycle. Needs an NDF fixing/cash-settlement event carrying notional, contracted and fixing rates.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL NDF fixing / cash-settlement event",
    citations: ["IFRS-9-§5.7.1", "IAS-21-§28", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilNdfFixingObserved`,
  },
  {
    gapId: "fx-fvoci-reclass-trigger",
    title:
      "PR-FX-FVOCI-RECLASS-V2 FVOCI→P&L reclassification: posting logic implemented + balanced, but FilInstrumentTerminated carries neither the FVOCI election nor the accumulated OCI reserve, so the fold cannot fire the recycle. Needs the election + accumulated OCI on the terminal event.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "FIL terminal event carries FVOCI election + accumulated OCI",
    citations: ["IFRS-9-§5.7.10", "IFRS-9-§5.7.11", "D-ACCT-FX-IFRS-POSTING-COMPLETENESS"],
    resolvedBy: `${FX_SETTLEMENT_RESOLUTION} — FilInstrumentTerminated.fvociReclassTerms`,
  },
];

/**
 * The FX settlement deferred gaps that are STILL OPEN (not yet resolved). The
 * NPA-page badge renders a rule `active` iff no open gap names it; the store-side
 * recorder records only open gaps onto the FX accounting attestation. After
 * WS-FIL-FX-SETTLEMENT-EVENTS this is empty — every rule fires at fold time.
 */
export function activeFxSettlementDeferredGaps(): readonly FxDeferredPostingGap[] {
  return FX_SETTLEMENT_DEFERRED_GAPS.filter((g) => g.resolvedBy === undefined);
}
