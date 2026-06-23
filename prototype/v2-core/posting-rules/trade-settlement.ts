// v2-core/posting-rules/trade-settlement.ts
//
// POSTING MAPPING for the generic single-asset `TradeSettlementExecuted` event
// (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 1) + the FX-settlement DECOMPOSITION.
//
// THE MAPPING
// -----------
// `postTradeSettlementLegs` maps ONE `TradeSettlementExecuted` movement onto its
// GL legs by calling the GENERIC per-movement settlement primitive
// (`postSettlementMovementLegs`, in `./fx-settlement.ts`) — the EXACT same math
// the two-leg FX path (`postFxSettlementLegs`) composes. A RECEIVE movement
// (`movement ≥ 0`) settles a received leg (Dr cash, Cr receivable, P&L); a PAY
// movement (`movement < 0`) settles a paid leg (Cr cash, Dr payable, P&L). Because
// both paths bottom out on the one primitive, N single-asset settlements net
// BYTE-IDENTICAL per `(accountCode, currency)` to the single `FilFxSettlementConfirmed`
// spot path — by construction (Engineering Charter cmd 4 — source, don't duplicate).
//
// THE DECOMPOSITION
// -----------------
// `decomposeFxSettlementToTradeSettlements` takes the SAME inputs a
// `FilFxSettlementConfirmed` carries (boughtBooked / boughtSettled / soldBooked /
// soldSettled, legRole) and produces the equivalent list of single-asset
// `TradeSettlementExecuted` payloads: an FX SPOT ⇒ TWO (the bought/received cash
// leg + the sold/paid cash leg), each carrying that leg's booked + settled + cost +
// trade ref + holding ref. This is the pure function the Slice-2 cutover will call
// at emission time; in Slice 1 it is exercised only by the byte-proof test (DARK).
//
// PACKAGE BOUNDARY: inside `v2-core/` — imports only v2-core modules.
//
// Authority: D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL (CEO-approved 2026-06-23);
//   D-ACCT-FX-IFRS-POSTING-COMPLETENESS; D-CASH-ASSET-CLASS-V1;
//   D-ENGINEERING-INTEGRITY-CHARTER. IAS 21 §28; IFRS 9 §3.2.3.
// Author: Atlas (Core banking platform architect, engineering).

import { decimalToString, isNegativeD, negD, toDecimal } from "../fil-core/decimal";
import { formatInstanceUrn } from "../fil-core/urn";
import type { FilFxSettlementConfirmedPayload } from "../fil-instances/events";
import {
  type TradeSettlementExecutedPayload,
  movementIsReceive,
  tradeSettlementExecutedPayloadSchema,
} from "../fil-instances/trade-settlement";
import { type FxPostingLeg, FX_TYPE_PREFIX } from "./fx";
import { postSettlementMovementLegs } from "./fx-settlement";

// ---------------------------------------------------------------------------
// Posting mapping.
// ---------------------------------------------------------------------------

const TRADE_SETTLE_RULE = {
  ruleId: "PR-FX-SETTLE-V2",
  ias: "IAS 21 §23, §28 — settlement-date cash recognition + realised FX P&L",
};

/** The absolute value of a signed decimal string (positive magnitude). */
function absDecimal(signed: string): string {
  const d = toDecimal(signed);
  return decimalToString(isNegativeD(d) ? negD(d) : d);
}

/**
 * Map ONE `TradeSettlementExecuted` movement onto its GL legs through the generic
 * per-movement settlement primitive. The signed `movement` selects the side
 * (`receive` for ≥ 0, `pay` for < 0); the magnitudes fed to the primitive are the
 * POSITIVE settled cash + the booked carrying amount. The leg `sourceEventId` /
 * `postingRuleId` mirror the FX settlement path so the GL addressing + rule
 * provenance match (the rule id stays PR-FX-SETTLE-V2 for an FX cash leg; a
 * non-FX holding's rule id is selected by the caller's product treatment at
 * cutover — out of Slice-1 scope).
 */
export function postTradeSettlementLegs(payload: TradeSettlementExecutedPayload): FxPostingLeg[] {
  const base = {
    postingDate: payload.asOf.substring(0, 10),
    tenantId: payload.tenant as FxPostingLeg["tenantId"],
    sourceEventId: payload.tradeInstance,
    iasRule: TRADE_SETTLE_RULE.ias,
    postingRuleId: TRADE_SETTLE_RULE.ruleId,
  };
  const side = movementIsReceive(payload.movement.amount) ? "receive" : "pay";
  return postSettlementMovementLegs(base, {
    currency: payload.movement.currency,
    settledAmount: absDecimal(payload.movement.amount),
    bookedAmount: absDecimal(payload.bookedCarrying.amount),
    side,
  });
}

/**
 * Map a LIST of `TradeSettlementExecuted` movements onto their accumulated GL
 * legs (the N-movement analogue of `postFxSettlementLegs` over a whole trade's
 * settlement). The net per `(accountCode, currency)` is what the byte-proof
 * compares against the single FX settlement path.
 */
export function postTradeSettlementListLegs(
  payloads: readonly TradeSettlementExecutedPayload[],
): FxPostingLeg[] {
  return payloads.flatMap((p) => postTradeSettlementLegs(p));
}

// ---------------------------------------------------------------------------
// FX-settlement decomposition.
// ---------------------------------------------------------------------------

/** The deterministic holding-instance URN for one decomposed cash leg. */
function holdingUrnFor(tenant: string, tradeId: string, side: "received" | "paid"): string {
  return formatInstanceUrn({ tenant, instanceId: `${tradeId}-cash-${side}` });
}

/** The canonical Cash FIL type URN (re-declared to avoid a fil-models import cycle
 * at the posting-rules layer; the single source remains the cash type definition,
 * cross-checked by the cash-materialisation grammar). */
const CASH_BALANCE_TYPE_URN = "fil:type:cash:balance:vanilla@1.0";

/**
 * Extract the bare trade-id segment from a `fil:inst:<tenant>:<id>` URN (the last
 * colon-delimited segment), so the decomposed cash legs reuse the same
 * `<tradeId>-cash-<side>` stem the cash-materialisation grammar uses.
 */
function tradeIdSegment(tradeInstanceUrn: string): string {
  const parts = tradeInstanceUrn.split(":");
  return parts[parts.length - 1] ?? tradeInstanceUrn;
}

export interface FxSettlementDecompositionInput {
  /** The FX settlement event payload to decompose. */
  readonly settlement: FilFxSettlementConfirmedPayload;
  /**
   * The FIL URN of the TRADE this settlement executes (the grouping id). The FX
   * settlement event's `instance` IS the trade instance today, so this defaults to
   * `settlement.instance`; supplied explicitly so the cutover can pass a distinct
   * booking id if/when one exists.
   */
  readonly tradeInstance?: string;
}

/**
 * Decompose a `FilFxSettlementConfirmed` into the equivalent list of uniform
 * single-asset `TradeSettlementExecuted` payloads. An FX SPOT settlement ⇒ TWO:
 *
 *   1. RECEIVE the bought-currency cash: `movement = +boughtSettled`,
 *      `bookedCarrying = boughtBooked`, `cost = boughtSettled` (a cash holding's
 *      cost basis is its settled amount).
 *   2. PAY the sold-currency cash: `movement = −soldSettled`,
 *      `bookedCarrying = soldBooked`, `cost = soldSettled`.
 *
 * The `legRole` (spot / swap-near / swap-far) collapses away — under the uniform
 * model a swap is just MORE settlement events on the same trade, not a near/far
 * discriminator. Every leg role decomposes the same way (two cash movements);
 * the resulting `TradeSettlementExecuted` events carry no role tag (the whole
 * point of the model). `bopCategory` is carried verbatim onto BOTH legs.
 *
 * Pure — no store. The byte-proof asserts the posting legs of the returned list
 * net byte-identical (per accountCode,currency) to `postFxSettlementConfirmedLegs`.
 */
export function decomposeFxSettlementToTradeSettlements(
  input: FxSettlementDecompositionInput,
): TradeSettlementExecutedPayload[] {
  const s = input.settlement;
  const tradeInstance = input.tradeInstance ?? s.instance;
  const tradeId = tradeIdSegment(tradeInstance);

  const receivedMovement = decimalToString(toDecimal(s.boughtSettled.amount));
  const paidMovement = decimalToString(negD(toDecimal(s.soldSettled.amount)));

  const received = tradeSettlementExecutedPayloadSchema.parse({
    kind: "TradeSettlementExecuted",
    tradeInstance,
    holdingInstance: holdingUrnFor(s.tenant, tradeId, "received"),
    holdingType: CASH_BALANCE_TYPE_URN,
    holdingAssetClass: "cash",
    movement: { currency: s.boughtSettled.currency, amount: receivedMovement },
    bookedCarrying: { currency: s.boughtBooked.currency, amount: s.boughtBooked.amount },
    // A cash holding is recognised at its settled cash amount (cost === settled).
    cost: { currency: s.boughtSettled.currency, amount: s.boughtSettled.amount },
    tenant: s.tenant,
    asOf: s.asOf,
    originatingEvent: { ...s.originatingEvent },
    ...(s.bopCategory !== undefined ? { bopCategory: s.bopCategory } : {}),
  });

  const paid = tradeSettlementExecutedPayloadSchema.parse({
    kind: "TradeSettlementExecuted",
    tradeInstance,
    holdingInstance: holdingUrnFor(s.tenant, tradeId, "paid"),
    holdingType: CASH_BALANCE_TYPE_URN,
    holdingAssetClass: "cash",
    movement: { currency: s.soldSettled.currency, amount: paidMovement },
    bookedCarrying: { currency: s.soldBooked.currency, amount: s.soldBooked.amount },
    cost: { currency: s.soldSettled.currency, amount: s.soldSettled.amount },
    tenant: s.tenant,
    asOf: s.asOf,
    originatingEvent: { ...s.originatingEvent },
    ...(s.bopCategory !== undefined ? { bopCategory: s.bopCategory } : {}),
  });

  return [received, paid];
}

/** True iff the FIL taxonomy type URN names an FX instrument (re-export for callers). */
export function isFxTypeUrn(typeUrn: string): boolean {
  return typeUrn.startsWith(FX_TYPE_PREFIX);
}
