// v2-core/fil-instances/trade-settlement.ts
//
// BORN-V2 generic single-asset SETTLEMENT event family
// (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 1).
//
// THE MODEL (CEO, 2026-06-23)
// ---------------------------
// A settlement is a UNIFORM SINGLE-ASSET movement — "holding H ↑/↓ by amount A at
// cost C, executing trade T" — NOT a bespoke two-leg FX event. Today's
// `FilFxSettlementConfirmed` (`./events.ts`) bakes in two legs + a `legRole`
// discriminator (spot / swap-near / swap-far) + bought/sold field NAMES. That
// shape is FX-specific by accident of history (FX was the first asset class
// migrated), even though its posting rules consume only `(currency, amount)` per
// leg. The richer truth that an FX spot settlement is TWO uniform single-asset
// movements (receive base-ccy cash, pay quote-ccy cash) is the model this event
// family expresses.
//
// `TradeSettlementExecuted` is the ASSET-CLASS-AGNOSTIC carrier of ONE such
// movement: a single holding (a `cash` FIL instance now; any FIL asset class
// later) is created/adjusted by a signed `movement`, recognised AT COST, deriving
// the GL postings for that one leg. FX spot = TWO of these; a bond buy = TWO
// (−cash, +security); a swap / amortiser = MANY. Partial / failed / retried
// settlements are simply more events — no special shape.
//
// WHY NOT A BARE `CashFlow` (CEO invariant)
// -----------------------------------------
// A settlement is NOT just "amount A moved". The (settled, booked) PAIR is what
// carries IAS 21 §28 realised P&L + IFRS 9 §3.2.3 derecognition: `movement`
// (settled cash) extinguishes a `bookedCarrying` obligation leg, and
// `settled − booked` is the realised result. A bare CashFlow that drops the booked
// carrying amount would lose the realised P&L. So this event carries BOTH the
// settled movement AND the booked carrying amount it derecognises, plus the
// `cost` the holding is recognised at.
//
// SLICE 1 IS DARK + ADDITIVE
// --------------------------
// This event is BORN-V2 (`v2status: "v2-replaced"`), three-site registered, and
// proven byte-equivalent to `FilFxSettlementConfirmed` for an FX spot vanilla
// (see `trade-settlement-fold.test.ts` + `decomposeFxSettlementToTradeSettlements`
// below). It is NOT yet emitted in production (FX vanilla keeps emitting
// `FilFxSettlementConfirmed`; the cutover is Slice 2). `FilFxSettlementConfirmed`
// is NOT removed.
//
// PACKAGE BOUNDARY: inside `v2-core/` — NO imports from `platform/`, `runtime/`,
// `domains/` (enforced by `recon:v2-no-v1-import`). The v1-side registry wiring
// imports FROM here, never vice-versa.
//
// Authority: D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL (CEO-approved 2026-06-23);
//   D-CASH-ASSET-CLASS-V1 (the holding-at-cost generalisation of cash
//   materialisation); D-FIL-FRAMEWORK-UNIFICATION; D-ENGINEERING-INTEGRITY-CHARTER
//   (root-cause; fail-closed; source-don't-duplicate; replay-safe & append-only).
//   Principle 1; Principle 2; Principle 5.
// Cites: IAS 21 §28 (settlement-date realised FX); IFRS 9 §3.2.3 (per-leg
//   derecognition).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { instantSchema, moneySchema } from "../fil-core/primitives";
import { filInstanceUrnSchema, filTypeUrnSchema } from "../fil-core/urn";
import { bopCategoryTagSchema } from "../finsurv/bop-category";
import { filOriginatingEventRefSchema, filSaCcrAssetClassSchema } from "./events";

// ---------------------------------------------------------------------------
// The single-asset settlement movement payload. Every field is asset-class-
// agnostic: the same shape settles a cash leg of an FX trade, a security leg of a
// bond buy, or a coupon leg of a swap. The asset class of the holding is named by
// `holdingType` (a FIL TYPE URN) and `holdingAssetClass` (the SA-CCR partition),
// so a consumer never has to know "FX" to route the posting.
// ---------------------------------------------------------------------------

export const tradeSettlementExecutedPayloadSchema = z.object({
  kind: z.literal("TradeSettlementExecuted"),
  /**
   * The FIL URN of the TRADE whose obligation this movement executes — the
   * grouping / trade id tying ONE trade's create + its N settlements + the
   * holdings they produce. This is the booking id whose ABSENCE today forced the
   * cash-cancel cascade to be a back-ref scan (plan Finding 2). Principle 2: the
   * single-graph link from a settlement back to the trade it settles is explicit.
   */
  tradeInstance: filInstanceUrnSchema,
  /**
   * The FIL URN of the HOLDING instance this movement creates or adjusts (the
   * `cash` FIL instance now; a security instance later). A RECEIVE creates/credits
   * the holding; a PAY draws it down. Principle 1: the holding is a real
   * event-sourced instrument-of-record, not a derived phantom.
   */
  holdingInstance: filInstanceUrnSchema,
  /** The FIL TYPE URN of the holding (`fil:type:cash:balance:vanilla@1.0`, …). */
  holdingType: filTypeUrnSchema,
  /**
   * The SA-CCR asset class of the holding (`cash` for an FX cash leg; `credit` /
   * `equity` / … for a security leg later). Named explicitly so the posting +
   * materialisation route on the holding's class, never on the trade's. Re-uses
   * the FIL economic-terms asset-class union (`./events.ts`) — one vocabulary.
   */
  holdingAssetClass: filSaCcrAssetClassSchema,
  /**
   * The SETTLED movement — the actual cash/asset that moved at the settlement
   * rate, SIGNED in MAJOR units in its OWN currency: `+` received (holding ↑),
   * `−` paid (holding ↓). This is the `(amount)` half of the (amount, cost) pair.
   */
  movement: moneySchema,
  /**
   * The CARRYING amount of the obligation leg being DERECOGNISED at the BOOKED
   * rate (the receivable extinguished on a receive; the payable extinguished on a
   * pay), as POSITIVE major-unit Money in the same currency as `movement`. The
   * realised result of the settlement is `movement − bookedCarrying` (signed),
   * IAS 21 §28 / IFRS 9 §3.2.3. This is the (cost-of-obligation) half of the pair
   * a bare CashFlow would drop — it MUST be carried.
   */
  bookedCarrying: moneySchema,
  /**
   * The COST the HOLDING is recognised at (the cost basis carried onto the
   * created/adjusted holding instance — `D-CASH-ASSET-CLASS-V1` recognises a
   * settled cash holding at its settled amount; a security holding at its purchase
   * cost). Positive major-unit Money in the holding's currency. Carried so the
   * holding-at-cost materialisation can stamp the cost basis WITHOUT re-deriving it
   * from the movement (a future amortised-cost holding's cost ≠ its cash movement).
   */
  cost: moneySchema,
  /** The tenant axis (S2) — anchor tenant for the anchor book. */
  tenant: z.string().min(1),
  /** ISO-8601 instant the settlement takes effect (the holding's as-of). */
  asOf: instantSchema,
  /** The canonical v1 event of record this settlement renders (Principle 1). */
  originatingEvent: filOriginatingEventRefSchema,
  /**
   * OPTIONAL BoP-category tag (FinSurv per-transaction reporting scaffold,
   * D-FX-OTC-CLOSURE-BACKLOG Phase C10) — carried verbatim from the source FX
   * settlement so the read-side FinSurv projection folds it unchanged. Append-only-
   * safe (OPTIONAL); the accounting posting reads only `movement` / `bookedCarrying`
   * so it is unaffected (BoP is a regulatory axis, not an accounting one).
   */
  bopCategory: bopCategoryTagSchema.optional(),
});

export type TradeSettlementExecutedPayload = z.infer<typeof tradeSettlementExecutedPayloadSchema>;

// ---------------------------------------------------------------------------
// The registered event kind list. ONE born-V2 kind in this family today; the set
// is a list so adding a sibling (e.g. a settlement-reversal) later is additive.
// ---------------------------------------------------------------------------

export const TRADE_SETTLEMENT_EVENT_KINDS = ["TradeSettlementExecuted"] as const;

export type TradeSettlementEventKind = (typeof TRADE_SETTLEMENT_EVENT_KINDS)[number];

/**
 * The directional reading of a movement (pure helper for consumers): `receive`
 * iff the signed movement is ≥ 0 (holding ↑), `pay` otherwise (holding ↓). The
 * sign on `movement` is the single source of truth — there is no separate
 * bought/sold or near/far discriminator (the whole point of the uniform model).
 */
export function settlementDirection(payload: TradeSettlementExecutedPayload): "receive" | "pay" {
  return movementIsReceive(payload.movement.amount) ? "receive" : "pay";
}

/** True iff a signed major-unit decimal string is ≥ 0 (a receive). */
export function movementIsReceive(signedAmount: string): boolean {
  return !signedAmount.trim().startsWith("-");
}
