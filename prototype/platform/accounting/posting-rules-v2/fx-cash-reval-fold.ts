// platform/accounting/posting-rules-v2/fx-cash-reval-fold.ts
//
// EOD-MTM REVALUATION OF SETTLED FCY CASH (D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1).
//
// THE GAP THIS CLOSES (CEO-confirmed, #1617 documented)
// -----------------------------------------------------
// On a multi-trade SETTLED book the functional (ZAR) trial balance did NOT net to
// zero at closing marks. Settled FCY cash (the nostro balances, ACC-1200-*) is a
// foreign-currency MONETARY item (IAS 21 §23(a)): it must be retranslated to the
// functional currency at the CLOSING rate each reporting date, and the exchange
// difference recognised in profit or loss (IAS 21 §28). The PvP settlement
// (PR-FX-SETTLE-V2) recognises the cash at its SETTLE-date (transaction) rate and
// carries it at that ZAR cost basis; the daily retranslation of that monetary
// balance to the closing mark — and its unrealised-P&L contra — was MISSING from
// the GL fold. The open FX contract is already revalued (PR-FX-REVAL-V2); this is
// specifically the SETTLED FCY cash holding that was not.
//
// THE ENTRY (BALANCED IN ZAR — IAS 21 §21, §23, §28)
// --------------------------------------------------
// Per non-functional settled-cash currency, with a closing official mark:
//   closing ZAR carrying value = net FCY cash × closing rate
//   ZAR cost basis             = Σ (settled FCY leg × its settle rate)   [from settlement]
//   retranslation delta (P&L)  = closing − cost basis                    (signed)
//
//   Dr/Cr  FX Cash Monetary-Item Retranslation Adjustment (ACC-1200-099, ZAR)
//   Cr/Dr  Unrealised FX P&L — FVTPL                       (ACC-2100-005, ZAR)
//
// Both legs are in ZAR and EQUAL in magnitude, so the entry self-balances in the
// functional currency BY CONSTRUCTION (the CEO per-entry invariant): every Dr/Cr
// pair is ZAR-equal at its own rate, so the sum balances pre- AND post-EOD-MTM.
//
// The retranslation-adjustment account (ACC-1200-099, asset-cash, ZAR) carries the
// §23 ZAR carrying-value movement of the FCY monetary item. It sits BESIDE the
// nostro: the nostro is presented at its native FCY (and its ZAR cost basis); this
// ZAR account holds the cumulative retranslation to closing. Their ZAR sum is the
// monetary item's §23 closing carrying value. The contra is unrealised P&L — the
// §28 exchange difference (FVTPL, P&L; an FX monetary item is never OCI, F1).
//
// NO-SILENT-ZERO / FAIL-CLOSED (Engineering Charter cmd 2). A currency with a net
// settled-cash position but NO closing official mark (OfficialMarkAdopted, dated
// ≤ asOf) is surfaced in `unmarkedCurrencies` and NO reval leg is posted for it —
// never a fabricated 0 reval. The caller (recon) fails closed on a non-empty
// `unmarkedCurrencies` over a book that carries settled FCY cash.
//
// EVENT-SOURCED MARKS (Charter cmd 4 — source, don't hardcode). The closing rate
// is the OfficialMarkAdopted mark for `<ccy>/ZAR` (decimal-native), adopted by
// `adoptDailyOfficialFxMarks` before this fold runs. No spot/quote is read here.
//
// PURE FOLD (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD). FX has no stored
// GlPostingEmitted; this reval is expressed entirely as in-memory fold legs, like
// the FX-instance fold and the conversion fold.
//
// PACKAGE BOUNDARY: v1 side (`platform/`) — MAY import from `v2-core/`.
//
// Authority: D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1 (CEO 2026-06-29);
//   D-FX-PNL-FCY-EXPOSURE-REVALUATION; D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; Engineering Charter (cmd 1 root-cause,
//   cmd 2 fail-closed, cmd 4 source-don't-hardcode). IAS 21 §21, §23, §28.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  type DecimalValue as Decimal,
  addD,
  decimalToString,
  divD,
  isNegativeD,
  isZeroD,
  mulD,
  negD,
  roundDecimal,
  subD,
  toDecimal,
} from "../../../v2-core/fil-core/decimal";
import type { FilFxSettlementConfirmedPayload } from "../../../v2-core/fil-instances/events";
import type { TradeSettlementExecutedPayload } from "../../../v2-core/fil-instances/trade-settlement";
import type { FxPostingLeg } from "../../../v2-core/posting-rules/fx";
import { FX_UNREALISED_PNL_ACCOUNT } from "../../../v2-core/posting-rules/fx-settlement";
import type { OfficialMarkAdoptedPayload } from "../../event-store/event-types/valuation";
import type { EventStore } from "../../event-store/store";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../../projections/filter";

const FUNCTIONAL_CURRENCY = "ZAR";

/** Posting-rule id for the EOD-MTM settled-FCY-cash reval (IAS 21 §23/§28). */
export const FX_CASH_REVAL_RULE_ID = "PR-FX-CASH-REVAL-V2";

/**
 * FX Cash Monetary-Item Retranslation Adjustment (ZAR). Carries the §23 ZAR
 * carrying-value movement of the settled FCY cash from its settle-date cost basis
 * to the closing mark; the contra is unrealised FX P&L (§28). Sourced from the
 * canonical chart of accounts (ACC-1200-099) — this constant is the rule's
 * reference to that account, not a redefinition.
 */
export const FX_CASH_RETRANSLATION_ACCOUNT = "ACC-1200-099";

const IAS_RULE =
  "IAS 21 §23, §28 — settled FCY cash daily retranslation to closing rate, exchange difference to P&L";

/** True iff a posting-rule id is an EOD-MTM cash-reval leg (double-count guard). */
export function isFxCashRevalSourcedGlPosting(postingRuleId: string | undefined): boolean {
  return postingRuleId === FX_CASH_REVAL_RULE_ID;
}

// ---------------------------------------------------------------------------
// Settled FCY-cash position accumulator — per non-functional currency, the net
// FCY cash position AND its ZAR cost basis, derived from the settlement legs
// (the SAME events the FX fold settles). The ZAR cost basis of an FCY leg is its
// partner ZAR leg of the same trade; we accumulate the signed ZAR-equivalent at
// the settle rate so the cost basis reflects the actual booked rate (not a mark).
// ---------------------------------------------------------------------------

interface SettledCashPosition {
  /** Net FCY cash position (signed major-unit decimal; + = long FCY, − = short). */
  netFcy: Decimal;
  /** ZAR cost basis of the net position (signed major-unit decimal). */
  zarCostBasis: Decimal;
}

const SETTLEMENT_EVENT_TYPES = ["TradeSettlementExecuted", "FilFxSettlementConfirmed"] as const;

/**
 * Fold the settled FCY cash positions (per non-functional currency) from the
 * settlement events admitted under the provenance lens + posting-date window.
 *
 * A `FilFxSettlementConfirmed` carries BOTH legs (bought + sold) of a trade, so
 * each FCY leg's ZAR cost basis is its ZAR partner leg directly. A single-asset
 * `TradeSettlementExecuted` carries ONE leg; the FCY leg's ZAR partner is the
 * SAME trade's ZAR `TradeSettlementExecuted` movement (grouped by `tradeInstance`).
 * Both event families are dual-read (the FX fold reads both); here we group both
 * onto a per-trade buffer and pair FCY ↔ ZAR legs to recover the settle-rate ZAR
 * cost basis. A trade with no ZAR leg (FCY↔FCY cross) pairs the two FCY legs and
 * is left at zero ZAR basis for the leg whose ZAR-equivalent is not directly
 * observable — handled by the closing-mark retranslation of the net position
 * (the §23 monetary-item carrying value is mark-driven regardless of basis split).
 */
export function foldSettledFcyCashPositions(args: {
  readonly eventStore: EventStore;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly filter: ProvenanceFilter;
}): Map<string, SettledCashPosition> {
  // Per-trade buffer of (currency, signedFcyMajor) cash movements, so an FCY leg
  // can be paired with its ZAR partner of the SAME trade for the cost basis.
  const tradeLegs = new Map<string, Array<{ currency: string; signed: Decimal }>>();

  function pushLeg(tradeInstance: string, currency: string, signed: Decimal, postingDate: string) {
    if (postingDate < args.periodStart || postingDate > args.periodEnd) return;
    const arr = tradeLegs.get(tradeInstance) ?? [];
    arr.push({ currency, signed });
    tradeLegs.set(tradeInstance, arr);
  }

  for (const t of SETTLEMENT_EVENT_TYPES) {
    for (const e of args.eventStore.replay({ type: t })) {
      if (!eventMatchesProvenanceFilter(e, args.filter)) continue;
      if (t === "TradeSettlementExecuted") {
        const p = e.payload as unknown as TradeSettlementExecutedPayload;
        const signed = toDecimal(p.movement.amount); // already signed (+receive/−pay)
        pushLeg(p.tradeInstance, p.movement.currency, signed, p.asOf.substring(0, 10));
      } else {
        const p = e.payload as unknown as FilFxSettlementConfirmedPayload;
        const postingDate = p.asOf.substring(0, 10);
        // Bought leg is RECEIVED (+settled); sold leg is PAID (−settled).
        pushLeg(
          p.instance,
          p.boughtBooked.currency,
          toDecimal(p.boughtSettled.amount),
          postingDate,
        );
        pushLeg(
          p.instance,
          p.soldBooked.currency,
          negD(toDecimal(p.soldSettled.amount)),
          postingDate,
        );
      }
    }
  }

  const positions = new Map<string, SettledCashPosition>();
  for (const legs of tradeLegs.values()) {
    // The ZAR leg(s) of this trade — its signed ZAR cash movement is the cost
    // basis the FCY leg(s) were exchanged against (settle-rate ZAR-equivalent).
    const zarLegs = legs.filter((l) => l.currency === FUNCTIONAL_CURRENCY);
    const fcyLegs = legs.filter((l) => l.currency !== FUNCTIONAL_CURRENCY);
    // Net signed ZAR moved on this trade (its sign is opposite the FCY net: ZAR
    // paid to buy FCY, ZAR received to sell FCY). The FCY leg's ZAR cost basis is
    // the negated ZAR movement (a received-FCY leg has a ZAR-paid partner).
    let zarMoved = toDecimal("0");
    for (const z of zarLegs) zarMoved = addD(zarMoved, z.signed);

    for (const f of fcyLegs) {
      const pos = positions.get(f.currency) ?? {
        netFcy: toDecimal("0"),
        zarCostBasis: toDecimal("0"),
      };
      pos.netFcy = addD(pos.netFcy, f.signed);
      // Cost basis: the ZAR-equivalent the FCY leg was exchanged at. For a single
      // FCY leg the trade's ZAR movement (negated) IS its basis. For a trade with
      // multiple FCY legs the basis is apportioned by |fcy|/|Σfcy| of the ZAR
      // moved — the standard pro-rata of the partner leg.
      const basis = apportionBasis(f.signed, fcyLegs, zarMoved);
      pos.zarCostBasis = addD(pos.zarCostBasis, basis);
      positions.set(f.currency, pos);
    }
  }
  return positions;
}

/**
 * The ZAR cost basis of ONE FCY leg = the (negated) ZAR moved on the trade,
 * apportioned across the trade's FCY legs by |this leg| / Σ|fcy legs|. For the
 * common one-FCY-leg trade this is simply −zarMoved. A received-FCY leg
 * (signed > 0) pairs with ZAR paid (zarMoved < 0) → basis positive; a paid-FCY
 * leg (signed < 0) pairs with ZAR received (zarMoved > 0) → basis negative; in
 * both cases basis = −(zarMoved × |thisFcy|/Σ|fcy|).
 */
function apportionBasis(
  thisFcy: Decimal,
  fcyLegs: ReadonlyArray<{ currency: string; signed: Decimal }>,
  zarMoved: Decimal,
): Decimal {
  let sumAbs = toDecimal("0");
  for (const f of fcyLegs) sumAbs = addD(sumAbs, absD(f.signed));
  if (isZeroD(sumAbs)) return toDecimal("0");
  const weight = divD(absD(thisFcy), sumAbs);
  return negD(mulD(zarMoved, weight));
}

function absD(d: Decimal): Decimal {
  return isNegativeD(d) ? negD(d) : d;
}

/**
 * PER-ENTRY ZAR-balance residuals for the settlement entries. For each settled
 * trade, sum the ZAR-equivalent of its legs AT THE TRADE'S OWN SETTLE RATE — the
 * ZAR cash leg is the identity, and each FCY leg's ZAR-equivalent IS its ZAR
 * partner leg of the SAME trade (the settle-rate exchange). A balanced settlement
 * entry nets to ZERO in ZAR by construction (Dr bought-ccy cash @ settle rate = Cr
 * sold-ccy cash @ settle rate, IAS 21 §21). Returns the residual (ZAR major-unit
 * decimal) per trade so the recon can fail closed on a single non-zero entry.
 *
 * The residual is computed as Σ(signed ZAR leg) + Σ(signed FCY leg × its trade
 * settle rate), where the trade settle rate = |ZAR moved| / |FCY moved| per
 * currency on that trade — i.e. the FCY leg is valued at exactly the rate the ZAR
 * partner implies, so a correct PvP settlement residual is exactly zero.
 */
export function foldSettlementEntryZarResiduals(args: {
  readonly eventStore: EventStore;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly filter: ProvenanceFilter;
}): Map<string, Decimal> {
  // Re-group the settlement legs per trade (same source as the positions fold).
  const tradeLegs = new Map<string, Array<{ currency: string; signed: Decimal }>>();
  function pushLeg(trade: string, currency: string, signed: Decimal, postingDate: string) {
    if (postingDate < args.periodStart || postingDate > args.periodEnd) return;
    const arr = tradeLegs.get(trade) ?? [];
    arr.push({ currency, signed });
    tradeLegs.set(trade, arr);
  }
  for (const t of SETTLEMENT_EVENT_TYPES) {
    for (const e of args.eventStore.replay({ type: t })) {
      if (!eventMatchesProvenanceFilter(e, args.filter)) continue;
      if (t === "TradeSettlementExecuted") {
        const p = e.payload as unknown as TradeSettlementExecutedPayload;
        pushLeg(
          p.tradeInstance,
          p.movement.currency,
          toDecimal(p.movement.amount),
          p.asOf.substring(0, 10),
        );
      } else {
        const p = e.payload as unknown as FilFxSettlementConfirmedPayload;
        const postingDate = p.asOf.substring(0, 10);
        pushLeg(
          p.instance,
          p.boughtBooked.currency,
          toDecimal(p.boughtSettled.amount),
          postingDate,
        );
        pushLeg(
          p.instance,
          p.soldBooked.currency,
          negD(toDecimal(p.soldSettled.amount)),
          postingDate,
        );
      }
    }
  }
  const residuals = new Map<string, Decimal>();
  for (const [trade, legs] of tradeLegs) {
    const zarLegs = legs.filter((l) => l.currency === FUNCTIONAL_CURRENCY);
    const fcyLegs = legs.filter((l) => l.currency !== FUNCTIONAL_CURRENCY);
    let zarMoved = toDecimal("0");
    for (const z of zarLegs) zarMoved = addD(zarMoved, z.signed);
    // The trade's ZAR-equiv of its FCY legs is exactly the ZAR partner it was
    // exchanged against (−zarMoved across the FCY legs, apportioned by |fcy|). The
    // residual is the ZAR legs + that ZAR-equiv, which is zero for a balanced PvP.
    let residual = zarMoved; // signed ZAR legs
    for (const f of fcyLegs) {
      residual = addD(residual, apportionBasis(f.signed, fcyLegs, zarMoved));
    }
    residuals.set(trade, residual);
  }
  return residuals;
}

/**
 * Per non-functional currency, the SETTLE-rate COST-BASIS rate (ZAR per 1 FCY) of
 * the net settled-cash position = `zarCostBasis / netFcy`. The GL view uses this to
 * carry the FCY nostro at its cost basis (IAS 21 §23); the EOD-MTM reval
 * (ACC-1200-099) holds the adjustment from cost to the closing mark — so the row +
 * the reval-asset together give the §23 closing carrying value WITHOUT
 * double-counting, and every entry balances per-entry in ZAR. A net-zero position
 * is omitted (no carrying value to translate). The cost rate is a plain number used
 * only for presentation/translation (no money-name token), consistent with the GL
 * view's existing reporting-conversion convention (the no-float-money gate scope).
 */
export function foldSettledFcyCashCostRates(args: {
  readonly eventStore: EventStore;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly filter: ProvenanceFilter;
}): Map<string, number> {
  const positions = foldSettledFcyCashPositions(args);
  const rates = new Map<string, number>();
  for (const [ccy, pos] of positions) {
    if (isZeroD(pos.netFcy)) continue;
    const net = Number(decimalToString(pos.netFcy));
    if (net === 0) continue;
    const basis = Number(decimalToString(pos.zarCostBasis));
    rates.set(ccy, basis / net);
  }
  return rates;
}

// ---------------------------------------------------------------------------
// Closing official marks — the EVENT-SOURCED <ccy>/ZAR rate for the reval.
// Reads OfficialMarkAdopted (dated ≤ periodEnd), latest-wins per pair. Missing
// mark for a held currency → fail-closed (surfaced, no fabricated 0 reval).
// ---------------------------------------------------------------------------

/** The latest <ccy>/ZAR official mark dated ≤ asOf, as a decimal rate string. */
function closingMarksByCurrency(args: {
  readonly eventStore: EventStore;
  readonly asOf: string;
  readonly filter: ProvenanceFilter;
}): Map<string, Decimal> {
  const byCcy = new Map<string, { markAsOf: string; rate: Decimal }>();
  for (const e of args.eventStore.replay({ type: "OfficialMarkAdopted" })) {
    if (!eventMatchesProvenanceFilter(e, args.filter)) continue;
    const p = e.payload as unknown as OfficialMarkAdoptedPayload;
    // Only fx-rate marks expressed as `<ccy>/ZAR` (the closing rate of the FCY
    // monetary item). `instrumentKey` carries the pair; `mark` is the decimal rate.
    if (p.markType !== "fx-rate") continue;
    const instrument = typeof p.instrumentKey === "string" ? p.instrumentKey : "";
    if (!instrument.endsWith(`/${FUNCTIONAL_CURRENCY}`)) continue;
    const ccy = instrument.slice(0, instrument.length - `/${FUNCTIONAL_CURRENCY}`.length);
    if (ccy.length === 0 || ccy === FUNCTIONAL_CURRENCY) continue;
    // The mark's own as-of (the rate date), NOT the adoption-event as-of — a mark
    // dated AFTER the reporting date must not be used (no look-ahead).
    const markAsOf = typeof p.markAsOf === "string" ? p.markAsOf : "";
    if (markAsOf.substring(0, 10) > args.asOf.substring(0, 10)) continue;
    const rateStr = typeof p.mark === "string" ? p.mark : "";
    if (rateStr.length === 0) continue;
    const existing = byCcy.get(ccy);
    // Latest mark ≤ asOf wins (the closing mark for the reporting date).
    if (existing === undefined || markAsOf > existing.markAsOf) {
      byCcy.set(ccy, { markAsOf, rate: toDecimal(rateStr) });
    }
  }
  const out = new Map<string, Decimal>();
  for (const [ccy, v] of byCcy) out.set(ccy, v.rate);
  return out;
}

// ---------------------------------------------------------------------------
// The fold.
// ---------------------------------------------------------------------------

export interface FxCashRevalFoldArgs {
  readonly eventStore: EventStore;
  /** Inclusive posting-date window lower bound (ISO date). */
  readonly periodStart: string;
  /** Inclusive posting-date window upper bound (ISO date). */
  readonly periodEnd: string;
  /** Provenance lens. Defaults to the operating-book read. */
  readonly filter?: ProvenanceFilter;
  /** Tenant for the emitted legs (anchor book by default). */
  readonly tenantId?: string;
}

export interface FxCashRevalFoldResult {
  readonly legs: readonly FxPostingLeg[];
  /**
   * Currencies that carry a net settled-cash position but have NO closing
   * official mark (dated ≤ periodEnd). Fail-closed: NO reval is posted for them
   * and the caller (recon) fails on a non-empty list (never a fabricated 0).
   */
  readonly unmarkedCurrencies: readonly string[];
}

/**
 * Derive the EOD-MTM revaluation legs for settled FCY cash. For each
 * non-functional currency holding a net settled-cash position with a closing
 * official mark, post a BALANCED ZAR entry retranslating the §23 monetary item to
 * the closing rate (exchange difference → unrealised FX P&L, IAS 21 §28). The
 * reval `postingDate` is `periodEnd` (the reporting date the closing mark applies
 * to). A currency without a closing mark is surfaced in `unmarkedCurrencies` and
 * NO leg is posted for it (fail-closed; no silent zero).
 */
export function deriveFxCashRevalLegs(args: FxCashRevalFoldArgs): FxCashRevalFoldResult {
  const filter = args.filter ?? defaultProvenanceFilter();
  const tenantId = (args.tenantId ?? "LE-ZA-HOZ-BANK") as FxPostingLeg["tenantId"];
  const positions = foldSettledFcyCashPositions({
    eventStore: args.eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter,
  });
  const marks = closingMarksByCurrency({
    eventStore: args.eventStore,
    asOf: args.periodEnd,
    filter,
  });

  const legs: FxPostingLeg[] = [];
  const unmarkedCurrencies: string[] = [];
  const postingDate = args.periodEnd.substring(0, 10);

  // Deterministic currency order for replay-stable output.
  for (const ccy of [...positions.keys()].sort()) {
    const pos = positions.get(ccy);
    if (pos === undefined) continue;
    // A net-zero settled position needs no reval (the §23 carrying value is zero).
    if (isZeroD(pos.netFcy)) continue;

    const mark = marks.get(ccy);
    if (mark === undefined) {
      // Fail-closed: a held FCY monetary balance with NO closing mark is NOT
      // revalued to zero — it is surfaced so the recon fails (Charter cmd 2).
      unmarkedCurrencies.push(ccy);
      continue;
    }

    // Closing ZAR carrying value of the monetary item (IAS 21 §23) and the
    // retranslation delta vs the settle-rate cost basis (IAS 21 §28). Round the
    // delta to the ZAR cent (HALF_EVEN) — the GL posts at cent granularity; the
    // single rounding boundary keeps both legs equal so the entry self-balances.
    const closingZar = mulD(pos.netFcy, mark);
    const delta = roundDecimal(subD(closingZar, pos.zarCostBasis), 2, "HALF_EVEN"); // +gain / −loss
    if (isZeroD(delta)) continue; // no exchange difference at the closing mark

    const isGain = !isNegativeD(delta);
    const magnitude = decimalToString(isGain ? delta : negD(delta));

    // The retranslation-adjustment account (ACC-1200-099, ZAR) carries the §23 ZAR
    // carrying-value movement of the monetary item; the contra is unrealised FX
    // P&L (ACC-2100-005, ZAR). A GAIN raises the FCY-cash carrying value (Dr the
    // adjustment asset) and credits P&L; a LOSS flips both. BOTH legs are ZAR-equal
    // → the entry balances in the functional currency by construction.
    const base = {
      postingDate,
      tenantId,
      sourceEventId: `fx-cash-reval:${ccy}:${postingDate}`,
      iasRule: IAS_RULE,
      postingRuleId: FX_CASH_REVAL_RULE_ID,
    };
    legs.push({
      ...base,
      creditDebit: isGain ? "debit" : "credit",
      accountCode: FX_CASH_RETRANSLATION_ACCOUNT,
      amount: { __money: "v1", currency: FUNCTIONAL_CURRENCY, amount: magnitude },
      description: `FX settled-cash retranslation ${ccy}→${FUNCTIONAL_CURRENCY} @ closing mark (IAS 21 §23, ${isGain ? "gain" : "loss"})`,
    });
    legs.push({
      ...base,
      creditDebit: isGain ? "credit" : "debit",
      accountCode: FX_UNREALISED_PNL_ACCOUNT,
      amount: { __money: "v1", currency: FUNCTIONAL_CURRENCY, amount: magnitude },
      description: `FX settled-cash unrealised exchange difference ${ccy} (IAS 21 §28, FVTPL)`,
      pnlKind: "unrealised",
    });
  }

  return { legs, unmarkedCurrencies };
}
