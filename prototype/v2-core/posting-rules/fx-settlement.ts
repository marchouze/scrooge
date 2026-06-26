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

/** True iff two decimal strings are numerically equal (scale-independent). */
function decimalEquals(a: string, b: string): boolean {
  return isZeroDecimal(subtractDecimal(a, b));
}

/** Exact decimal subtract `a − b` via common-scale BigInt — never IEEE-754. */
function subtractDecimal(a: string, b: string): string {
  const pa = parseDecimal(a);
  const pb = parseDecimal(b);
  const scale = Math.max(pa.scale, pb.scale);
  const av = (pa.neg ? -pa.digits : pa.digits) * 10n ** BigInt(scale - pa.scale);
  const bv = (pb.neg ? -pb.digits : pb.digits) * 10n ** BigInt(scale - pb.scale);
  const diff = av - bv;
  if (scale === 0) return diff.toString();
  const neg = diff < 0n;
  const mag = (neg ? -diff : diff).toString().padStart(scale + 1, "0");
  const intPart = mag.slice(0, mag.length - scale);
  const fracPart = mag.slice(mag.length - scale);
  return `${neg ? "-" : ""}${intPart}.${fracPart}`;
}

/** Realised-P&L account for FX (currency-agnostic functional-currency P&L).
 *  Reached ONLY by the FCY→ZAR conversion (realisation) rule below — NEVER by
 *  settlement (D-FX-PNL-FCY-EXPOSURE-REVALUATION: settlement is P&L-neutral). */
export const FX_REALISED_PNL_ACCOUNT = "ACC-2100-006";

/** Unrealised-P&L account for FX (FVTPL) — the reval position carrier the FCY→ZAR
 *  realisation rule reclassifies cumulative unrealised OUT of, into realised. */
export const FX_UNREALISED_PNL_ACCOUNT = "ACC-2100-005";

/**
 * FX SETTLEMENT CLEARING account (D-FX-PNL-FCY-EXPOSURE-REVALUATION).
 * The P&L-NEUTRAL contra to the settled-cash nostro legs. Settlement is a change
 * of FORM — the FCY receivable/derivative becomes FCY cash — NOT a realisation,
 * so the settled cash is recognised against THIS clearing account in its own
 * currency, never the realised-P&L account. Each leg self-balances in its own
 * currency vs the nostro; the clearing account carries the in-flight settlement
 * position the cash legs convert. Sourced from the canonical chart of accounts
 * (`v2-core/accounting/chart-of-accounts.ts`, id `ACC-2100-027`) — this constant
 * is the rule's reference to that account, not a redefinition.
 */
export const FX_SETTLEMENT_CLEARING_ACCOUNT = "ACC-2100-027";

// ---------------------------------------------------------------------------
// PR-FX-SETTLE-V2 (#5) — Settlement (spot & physical forward). IAS 21 §23.
// P&L-NEUTRAL TREATMENT (D-FX-PNL-FCY-EXPOSURE-REVALUATION, REFINES
// D-FX-TRADE-DATE-FVTPL-OBS, settlement side).
//
// SETTLEMENT IS NOT REALISATION (the correction)
// ----------------------------------------------
// Settlement is a change of FORM, NOT a change of exposure: the FCY
// receivable/derivative becomes FCY CASH, carried at the SAME ZAR cost basis. The
// exposure stays OPEN across settlement, so settlement recognises NO realised P&L
// (D-FX-PNL-FCY-EXPOSURE-REVALUATION). Realised P&L arises ONLY when the FCY is
// later converted back to ZAR (the FCY→ZAR conversion rule below squares the
// position). The OLD entry that posted "realised FX P&L" (ACC-2100-006) on
// settlement is REMOVED — that was the defect this refinement fixes.
//
// Trade-date recognition is IFRS 9 FVTPL + off-balance-sheet memorandum
// (PR-FX-001-V2): an at-market FX trade posts NIL on-balance-sheet at inception
// and records the contractual buy/sell notionals OFF-balance-sheet (ACC-9100-*).
// There is therefore NO on-balance-sheet FX trading receivable/payable for
// settlement to extinguish — settlement NEVER touches that block.
//
// THE P&L-NEUTRAL SETTLEMENT ENTRY. At settlement the settled cash is recognised
// against the FX SETTLEMENT CLEARING account (ACC-2100-027) — NOT realised P&L:
//
//   Dr Cash (bought ccy) @ settled amount   ;  Cr FX Settlement Clearing (bought ccy)
//   Cr Cash (sold ccy)   @ settled amount   ;  Dr FX Settlement Clearing (sold ccy)
//
// Each cash movement balances IN ITS OWN CURRENCY against the clearing leg — no
// same-currency gross-up, no P&L footprint, and the receivable/payable block is
// untouched. The clearing account carries the in-flight FX-settlement position the
// cash legs convert (the FCY cash is then carried at its ZAR cost basis on the
// cash FIL instance + revalued daily exactly like the open contract). The OBS
// trade-date commitment is released separately (PR-FX-OBS-RELEASE-V2).
//
// `bookedAmount` is the settlement-date §23 retranslation PRECONDITION operand
// (F3): the settlement leg recognises cash at the SETTLED amount, and for a
// deliverable settlement the settled cash EQUALS the booked carrying amount in the
// same currency. A same-currency booked≠settled difference is an IAS 21 §28/§29
// exchange difference this P&L-neutral rule CANNOT represent (it would net to zero
// and be silently dropped), so the rule FAILS CLOSED on it rather than absorbing it
// (Charter cmd 2). With settled == booked the per-currency entry closes at zero
// with NO realised P&L.
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
 * MODEL, Slice 1; P&L-NEUTRAL settlement per D-FX-PNL-FCY-EXPOSURE-REVALUATION).
 * Settles ONE recognised leg — a single uniform asset movement — into its TWO GL
 * legs: the cash/nostro movement at the settled amount and the equal-and-opposite
 * FX SETTLEMENT CLEARING leg in the SAME currency. `side` selects the cash polarity
 * (RECEIVE = Dr cash; PAY = Cr cash) and the clearing counter-side. Amounts are
 * POSITIVE magnitudes (the sign is the `side`). NO realised P&L is struck
 * (settlement is a change of FORM, not a realisation) and NO on-balance-sheet
 * receivable/payable is touched (trade-date is OBS-only, so there is none).
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
   * Carrying amount of the OBS commitment leg at the BOOKED rate (positive). The
   * P&L-neutral settlement recognises cash at the SETTLED amount; this amount is the
   * settlement-date §23 retranslation PRECONDITION operand (F3): for a deliverable
   * settlement it MUST equal `settledAmount` in the same currency, else the rule
   * fails closed (a same-currency booked≠settled difference is an IAS 21 §28/§29
   * exchange difference this P&L-neutral rule cannot represent).
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
 * Produce the TWO GL legs for ONE P&L-NEUTRAL settlement movement: the cash
 * recognition at the SETTLED amount and the equal-and-opposite FX SETTLEMENT
 * CLEARING leg in the SAME currency. NO realised P&L is struck and NO
 * on-balance-sheet receivable/payable is touched — trade-date is OBS-only
 * (PR-FX-001-V2) and settlement is a change of FORM, not a realisation
 * (D-FX-PNL-FCY-EXPOSURE-REVALUATION).
 *
 *   receive → Dr Cash[ccy] (settled) ; Cr FX Settlement Clearing[ccy] (settled)
 *   pay     → Cr Cash[ccy] (settled) ; Dr FX Settlement Clearing[ccy] (settled)
 *
 * The entry closes at zero in the movement's own currency (no same-currency
 * gross-up, no P&L footprint). The clearing account carries the in-flight
 * FX-settlement position the cash legs convert; the FCY cash is then carried at its
 * ZAR cost basis on the cash FIL instance and revalued daily exactly like the open
 * contract. A zero settled amount yields no legs (nothing to recognise).
 */
export function postSettlementMovementLegs(
  base: SettlementLegBase,
  movement: SettlementMovementInput,
): FxPostingLeg[] {
  if (isZeroDecimal(movement.settledAmount)) return [];
  // SETTLEMENT-DATE §23 RETRANSLATION PRECONDITION (D-FX-IFRS-REVIEW-FOUNDATION,
  // F3). For a DELIVERABLE FX settlement the cash exchanged in a given currency IS
  // the contractual notional, so the SETTLED amount EQUALS the BOOKED carrying
  // amount in that SAME currency — the booked/settled distinction is a CROSS-
  // currency (rate) concept, not a same-currency amount difference. The P&L-neutral
  // rule recognises cash at the settled amount and balances it with the clearing
  // leg at the SAME settled amount, so a same-currency booked≠settled residual would
  // be SILENTLY DROPPED (it nets to zero by construction) — masking a real IAS 21
  // §28/§29 exchange difference. That is the settlement-realisation failure mode in
  // a different guise. Fail closed (Charter cmd 2): a same-currency booked≠settled
  // movement is NOT representable by this P&L-neutral rule and must be routed
  // through an explicit exchange-difference treatment, never absorbed silently.
  if (!decimalEquals(movement.settledAmount, movement.bookedAmount)) {
    throw new Error(
      `postSettlementMovementLegs: settled amount (${movement.settledAmount} ${movement.currency}) ≠ booked amount (${movement.bookedAmount} ${movement.currency}) for the SAME currency. A deliverable FX settlement exchanges the contractual notional, so settled == booked per currency; a difference is an IAS 21 §28/§29 exchange difference the P&L-neutral settlement rule cannot represent (it would net to zero and be silently dropped). Route it through an explicit exchange-difference / conversion treatment (PR-FX-CONVERT-V2). Authority: D-FX-IFRS-REVIEW-FOUNDATION (F3); D-FX-PNL-FCY-EXPOSURE-REVALUATION.`,
    );
  }
  const cashSide: "debit" | "credit" = movement.side === "receive" ? "debit" : "credit";
  // The clearing leg is the OPPOSITE side of the cash leg, in the SAME currency,
  // for the SAME amount — so the movement balances in its own currency with no
  // receivable/payable and NO realised P&L (settlement is a change of form, not a
  // realisation; D-FX-PNL-FCY-EXPOSURE-REVALUATION).
  const clearingSide: "debit" | "credit" = cashSide === "debit" ? "credit" : "debit";
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
  const clearingLeg: FxPostingLeg = {
    ...base,
    creditDebit: clearingSide,
    accountCode: FX_SETTLEMENT_CLEARING_ACCOUNT,
    amount: money(movement.currency, movement.settledAmount),
    description: `FX Settlement clearing ${movement.currency} (P&L-neutral, ${movement.side === "receive" ? "bought" : "sold"} leg)`,
  };
  return [cashLeg, clearingLeg];
}

export function postFxSettlementLegs(input: FxSettlementInput): FxPostingLeg[] {
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: SETTLE_RULE.ias,
    postingRuleId: SETTLE_RULE.ruleId,
  };
  // P&L-NEUTRAL settlement: the two-leg path is exactly TWO per-movement
  // settlements — the bought-leg RECEIVE and the sold-leg PAY — composed through
  // the SAME per-movement primitive (`postSettlementMovementLegs`). Source, don't
  // duplicate (Engineering Charter cmd 4): one settlement math, so the two-leg FX
  // path and N single-asset `TradeSettlementExecuted` settlements net byte-identical
  // per (account, currency) by construction. Each movement recognises cash at the
  // settled amount and balances it with the FX settlement clearing leg in the SAME
  // currency — NO realised P&L (settlement is a change of form); no on-balance-sheet
  // receivable/payable is touched (trade-date is OBS-only).
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
// PR-FX-CONVERT-V2 — FCY→ZAR CONVERSION (realisation). IAS 21 §28; IFRS 9 §5.7.1.
// Authority: D-FX-PNL-FCY-EXPOSURE-REVALUATION (CEO-approved 2026-06-25).
//
// REALISATION HAPPENS ONLY HERE. Settlement (PR-FX-SETTLE-V2) is P&L-neutral — the
// FCY exposure stays OPEN, carried as FCY cash at its ZAR cost basis. Realised P&L
// arises ONLY when the FCY is converted BACK to ZAR (the position is squared):
//
//   realised P&L = ZAR proceeds − ZAR cost basis of the FCY sold
//
// The conversion (a) recognises the ZAR proceeds received + draws down the FCY cash
// sold at its ZAR cost basis, the difference being realised P&L (ACC-2100-006); and
// (b) RECLASSIFIES the cumulative UNREALISED P&L accrued on that exposure (sitting
// in ACC-2100-005) INTO realised — total P&L unchanged, only its split moves from
// unrealised to realised (IFRS 9 §5.7.1). The position is reduced by the converted
// FCY notional.
//
// Worked example — convert USD 7m (ZAR cost basis R129.95m) → ZAR @ 19.00:
//   ZAR proceeds = 133,000,000; cost basis = 129,950,000 → realised = +R3,050,000.
//   Reclassify the cumulative unrealised (the same +R3,050,000 that accrued as the
//   spot moved 18.565 → 19.00) from ACC-2100-005 into ACC-2100-006: net P&L is
//   unchanged, it simply ceases to be "unrealised".
//
// PURE + balanced. A zero converted amount yields no legs.
// ---------------------------------------------------------------------------

export interface FxConversionInput {
  readonly instanceId: string;
  readonly tenantId: string;
  readonly postingDate: string;
  /** The FCY (the currency being SOLD back to ZAR). */
  readonly fcyCurrency: string;
  /** The reporting currency the proceeds are received in (typically ZAR). */
  readonly reportingCurrency: string;
  /** FCY amount converted, positive magnitude in the FCY (its OWN currency). */
  readonly fcyAmount: string;
  /** ZAR proceeds received for the FCY (reporting ccy, positive magnitude). */
  readonly zarProceeds: string;
  /** ZAR COST BASIS of the FCY sold (the booked ZAR given up to acquire it). */
  readonly zarCostBasis: string;
  /**
   * Cumulative UNREALISED P&L accrued on this exposure to date (signed: + gain
   * sat as a credit in ACC-2100-005). Reclassified into realised on conversion so
   * total P&L is unchanged. Pass "0" when none has accrued (or is un-measured).
   */
  readonly accumulatedUnrealised: string;
}

const CONVERT_RULE = {
  ruleId: "PR-FX-CONVERT-V2",
  ias: "IAS 21 §28 / IFRS 9 §5.7.1 — FCY→ZAR conversion: realise (proceeds − cost basis); reclassify unrealised → realised",
};

/**
 * Produce the legs for an FCY→ZAR conversion (realisation). The realised result is
 * `zarProceeds − zarCostBasis` (signed); the cash legs draw down the FCY cash at
 * its ZAR cost basis and recognise the ZAR proceeds, the difference being realised
 * P&L. A second pair reclassifies the cumulative unrealised (ACC-2100-005) into
 * realised (ACC-2100-006) so total P&L is unchanged. Both pairs balance in ZAR.
 */
export function postFxConversionLegs(input: FxConversionInput): FxPostingLeg[] {
  if (isZeroDecimal(input.fcyAmount)) return [];
  const base = {
    postingDate: input.postingDate,
    tenantId: input.tenantId as FxPostingLeg["tenantId"],
    sourceEventId: input.instanceId,
    iasRule: CONVERT_RULE.ias,
    postingRuleId: CONVERT_RULE.ruleId,
  };
  const reporting = input.reportingCurrency;
  const legs: FxPostingLeg[] = [];

  // (a) Cash exchange: receive ZAR proceeds (Dr ZAR nostro), draw down the FCY cash
  // sold at its ZAR COST BASIS (Cr FCY nostro, carried in ZAR cost), and recognise
  // the difference as REALISED P&L. All three legs are in the reporting currency so
  // the realisation result is the functional-currency figure directly.
  legs.push({
    ...base,
    creditDebit: "debit",
    accountCode: nostroFor(reporting),
    amount: money(reporting, input.zarProceeds),
    description: `FX Conversion ZAR proceeds received (sell ${input.fcyAmount} ${input.fcyCurrency})`,
  });
  legs.push({
    ...base,
    creditDebit: "credit",
    accountCode: nostroFor(input.fcyCurrency),
    amount: money(reporting, input.zarCostBasis),
    description: `FX Conversion ${input.fcyCurrency} cash drawn down at ZAR cost basis`,
  });
  const realised = subtractDecimal(input.zarProceeds, input.zarCostBasis);
  if (!isZeroDecimal(realised)) {
    const isGain = !realised.startsWith("-");
    const magnitude = isGain ? realised : realised.slice(1);
    // Gain: the cash pair above is Dr-heavy (proceeds > cost) → balance with a
    // Cr to realised P&L. Loss flips both.
    legs.push({
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(reporting, magnitude),
      description: `FX Conversion realised P&L ${reporting} (proceeds − cost basis, ${isGain ? "gain" : "loss"})`,
      // REALISED exchange-difference recognition (F7).
      pnlKind: "realised",
    });
  }

  // (b) Reclassify cumulative UNREALISED → realised (total P&L unchanged). The
  // unrealised sat as a credit gain in ACC-2100-005; Dr it to reverse, Cr realised.
  const unrealised = input.accumulatedUnrealised;
  if (!isZeroDecimal(unrealised)) {
    const isGain = !unrealised.trim().startsWith("-");
    const magnitude = isGain ? unrealised.trim() : unrealised.trim().slice(1);
    legs.push({
      ...base,
      creditDebit: isGain ? "debit" : "credit",
      accountCode: FX_UNREALISED_PNL_ACCOUNT,
      amount: money(reporting, magnitude),
      description: `FX Conversion reverse cumulative unrealised ${reporting}`,
      // Reverses the UNREALISED P&L sitting on the unrealised account (F7).
      pnlKind: "unrealised",
    });
    legs.push({
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(reporting, magnitude),
      description: `FX Conversion reclassify unrealised → realised ${reporting}`,
      // Reclassifies into REALISED P&L (F7).
      pnlKind: "realised",
    });
  }

  return legs;
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
      // Reverses the accumulated UNREALISED reval P&L (F7).
      pnlKind: "unrealised",
    },
    {
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_REALISED_PNL_ACCOUNT,
      amount: money(input.currency, magnitude),
      description: `FX Derecognition recognise realised ${input.currency}`,
      // Recognises REALISED P&L on derecognition (F7).
      pnlKind: "realised",
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
      // NDF fixing is a cash-settled REALISED exchange difference (F7).
      pnlKind: "realised",
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
      // Recycles OCI into REALISED P&L (F7). NB: the FVOCI path is IFRS-invalid
      // for FX (F1) and never fires for an FX instance; the marker is set for
      // completeness on the rule itself.
      pnlKind: "realised",
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
  /**
   * Set when the deferred rule is NOT merely un-triggered but IFRS-INVALID for the
   * FX asset class — it can never legitimately fire (D-FX-IFRS-REVIEW-FOUNDATION,
   * F1). Distinct from `resolvedBy`: a resolved gap's rule fires; an invalid-for-FX
   * rule must NEVER fire. Carries the authority + reason. Like `activeFxSettlement
   * DeferredGaps`, an invalid-for-FX gap is NOT an open deferral (it is closed by
   * exclusion, not by wiring).
   */
  readonly invalidForFx?: string;
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
      "PR-FX-FVOCI-RECLASS-V2 FVOCI→P&L reclassification: INVALID-FOR-FX, not deferred. An FX derivative is FVTPL-only (IFRS 9 §5.7.1; the §5.7.5 OCI election is equity-only, §5.7.1(b); a derivative fails SPPI). No FX instrument can be FVOCI, so this recycle can never legitimately fire for FX. Retained as historical inventory only; the recycle leg function stays for any future equity-instrument FVOCI estate, but it is excluded from the FX lifecycle map.",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger: "N/A — FVOCI is IFRS-invalid for FX (no trigger to wire)",
    citations: ["IFRS-9-§5.7.1", "IFRS-9-§5.7.5", "D-FX-IFRS-REVIEW-FOUNDATION"],
    invalidForFx:
      "D-FX-IFRS-REVIEW-FOUNDATION (F1) — an FX derivative is FVTPL-only; the §5.7.5 OCI election is equity-only and an FX derivative is held-for-trading (IFRS 9 §5.7.1(b)). FVOCI cannot apply to FX, so PR-FX-FVOCI-RECLASS-V2 must NEVER fire for an FX instance. Closed by exclusion, not by trigger-wiring.",
  },
];

/**
 * The FX settlement deferred gaps that are STILL OPEN (neither resolved by
 * trigger-wiring NOR closed by exclusion as invalid-for-FX). The NPA-page badge
 * renders a rule `active` iff no open gap names it; the store-side recorder records
 * only open gaps onto the FX accounting attestation. After WS-FIL-FX-SETTLEMENT-
 * EVENTS (resolution) + D-FX-IFRS-REVIEW-FOUNDATION F1 (FVOCI invalid-for-FX
 * exclusion) this is empty — every remaining rule fires at fold time, and the
 * FVOCI-reclass rule is excluded as IFRS-invalid for FX (never an open deferral).
 */
export function activeFxSettlementDeferredGaps(): readonly FxDeferredPostingGap[] {
  return FX_SETTLEMENT_DEFERRED_GAPS.filter(
    (g) => g.resolvedBy === undefined && g.invalidForFx === undefined,
  );
}
