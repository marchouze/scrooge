// v2-core/fil-instances/holding-materialisation.ts
//
// HOLDING-AT-COST materialisation — the asset-class-agnostic generalisation of
// the cash-only `cash-materialisation.ts` (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL,
// Slice 1).
//
// THE GENERALISATION
// ------------------
// `cash-materialisation.ts` (D-CASH-ASSET-CLASS-V1) builds a `cash` FIL instance
// when an FX trade settles — but it hard-codes the `cash` asset class, the
// received/paid side, and the FX-pair `hedgingSetTag`. A settlement under the
// uniform single-asset model (`./trade-settlement.ts`) recognises a HOLDING of
// ANY asset class at COST: the FX cash leg is the first holding type; a bond's
// security leg is the next. This builder is the one grammar for "recognise the
// holding a `TradeSettlementExecuted` movement produces, at its cost basis".
//
// It is PURE — no store, no I/O. It takes a settled `TradeSettlementExecuted`
// payload (the movement + cost + holding identity) and produces the canonical
// `FilInstrumentCreated` payload for the holding instance, recognised at `cost`.
// The caller routes it to whichever sink it owns (scenario EventStore or anchor
// SQLite) — identical to how `buildSettledCashPayloads` is consumed.
//
// COST vs MOVEMENT: a `cash` holding's cost basis IS its settled cash amount, so
// for the FX cash leg `cost === |movement|`. But the builder stamps the holding's
// notional from `cost` (NOT from `movement`) so that a future amortised-cost or
// fair-value holding — whose carrying cost differs from the cash that bought it —
// materialises at the correct basis without a shape change. This is the
// (amount, cost) separation the CEO model requires (a bare CashFlow that recognised
// the holding at the cash moved would lose the cost basis).
//
// Principle 1 / Principle 2: the holding carries `originatingInstrument =
// tradeInstance`, the explicit single-graph back-ref to the trade that produced
// it (the same back-ref `cash-materialisation.ts` stamps), so the reverse-coherence
// + cash-cascade machinery (`./cash-cascade.ts`) works on these holdings unchanged.
//
// PACKAGE BOUNDARY: inside `v2-core/` — imports only fil-core + fil-instances.
//
// Authority: D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL (CEO-approved 2026-06-23);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE (decimal-native MAJOR-unit Money);
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed; root-cause; no fork). Principle 1.
// Cites: IAS 21 §28 (settlement-date FX); IFRS 9 §3.2 (cost on initial recognition).
// Author: Atlas (Core banking platform architect, engineering).

import { decimalToString, isNegativeD, negD, toDecimal } from "../fil-core/decimal";
import type { Money } from "../fil-core/primitives";
import {
  type FilInstrumentCreatedPayload,
  filInstrumentCreatedPayloadSchema,
} from "./events";
import type { TradeSettlementExecutedPayload } from "./trade-settlement";

/**
 * Normalise a settlement `as-of` to a full ISO-8601 datetime (the FIL lifecycle
 * payload schema requires a datetime; some callers pass a bare calendar date). A
 * bare `YYYY-MM-DD` → start-of-day UTC; a value already carrying a time component
 * passes through. Byte-identical to `cash-materialisation.asOfDateTime`.
 */
function asOfDateTime(asOf: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? `${asOf}T00:00:00.000Z` : asOf;
}

/**
 * The economic-term axes a holding needs that the settlement movement payload does
 * NOT itself carry (counterparty / netting set / hedging-set tag are trade-level
 * facts, not movement-level ones). The caller — which knows the trade — supplies
 * them. Optional `cashTypeUrn`-style overrides are NOT needed: the holding type is
 * carried on the settlement payload (`holdingType`).
 */
export interface HoldingTradeContext {
  /** Counterparty party id (carried from the trade's economic terms). */
  readonly counterpartyId: string;
  /** Legally-enforceable netting set id (carried from the trade). */
  readonly nettingSetId: string;
  /** Reporting (functional) currency — for the holding's hedgingSetTag pair. */
  readonly reporting: string;
}

/** The built holding-creation payload + its instance URN. */
export interface BuiltHolding {
  /** The holding instance URN (echoed from the settlement payload). */
  readonly instance: string;
  /** Validated FilInstrumentCreated payload recognising the holding at cost. */
  readonly payload: FilInstrumentCreatedPayload;
}

/** True iff a signed major-unit decimal string is ≥ 0. */
function isNonNegative(signedAmount: string): boolean {
  return !signedAmount.trim().startsWith("-");
}

/** The absolute value of a signed decimal-string Money (preserve currency). */
function absMoney(m: Money): Money {
  const d = toDecimal(m.amount);
  return { currency: m.currency, amount: decimalToString(isNegativeD(d) ? negD(d) : d) };
}

/**
 * Build the canonical holding-of-record `FilInstrumentCreated` payload a settled
 * `TradeSettlementExecuted` movement produces, recognised AT COST.
 *
 * - A RECEIVE (`movement ≥ 0`) creates a `long` (asset) holding; a PAY (`movement
 *   < 0`) a `short` (funding) holding. The Money notional is always POSITIVE
 *   (schema requires it); the sign lives in `direction` — identical to
 *   `buildSettledCashPayloads`.
 * - The holding is recognised at `cost` (NOT at the movement), so the cost basis
 *   is faithful for non-cash / amortised-cost holdings later. For the FX cash leg
 *   `cost === |movement|`, so this is byte-identical to the cash-only builder.
 *
 * Pure — no store. The caller checks idempotency + routes to its sink.
 */
export function buildSettledHoldingPayload(
  settlement: TradeSettlementExecutedPayload,
  ctx: HoldingTradeContext,
): BuiltHolding {
  const direction: "long" | "short" = isNonNegative(settlement.movement.amount)
    ? "long"
    : "short";
  // Recognise at COST (positive). For a cash holding cost === |movement|.
  const recognisedNotional = absMoney(settlement.cost);
  const payload = filInstrumentCreatedPayloadSchema.parse({
    kind: "FilInstrumentCreated",
    instance: settlement.holdingInstance,
    type: settlement.holdingType,
    tenant: settlement.tenant,
    asOf: asOfDateTime(settlement.asOf),
    originatingEvent: { ...settlement.originatingEvent },
    initialStage: "active",
    economicTerms: {
      assetClass: settlement.holdingAssetClass,
      notional: recognisedNotional,
      direction,
      counterpartyId: ctx.counterpartyId,
      nettingSetId: ctx.nettingSetId,
      currency: settlement.movement.currency,
      settlementDate: settlement.asOf,
      hedgingSetTag: `${settlement.movement.currency}/${ctx.reporting}`,
      // Principle 1 / Principle 2 — the holding links back to the trade that
      // produced it (the grouping id), so cash-cascade / reverse-coherence work.
      originatingInstrument: settlement.tradeInstance,
    },
  });
  return { instance: settlement.holdingInstance, payload };
}
