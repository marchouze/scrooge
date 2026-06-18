// platform/markets/products/materialise-settled-cash-for-fx.ts
//
// Settlement-runtime ADAPTER (D-CASH-ASSET-CLASS-V1, WS-CASH-ASSET-CLASS).
//
// The thin shim the live FX settlement handlers call at the settlement point to
// materialise the settled cash leg(s) as Cash FIL instruments-of-record. It maps
// the per-leg cash data the handlers already have (pay/receive currency + signed
// amount, trade id, settled instant) into a `SettledFxForCashMaterialisation` and
// delegates to `materialiseSettledCash`. Keeping the FX-instance-URN + FIL-type
// derivation here — single-sourced and identical to the backfill — means the
// instance the live path materialises is the SAME instrument-of-record the
// backfill / projection refer to (Principle 1; no fork).
//
// PRODUCT-DRIVEN throughout: `materialiseSettledCash` reads the maturity→cash
// rule off the governing product; this adapter contributes only the leg data.
//
// FOREIGN-CURRENCY DENOMINATION (MV-CASH-001): each leg is denominated in ITS OWN
// currency. The received foreign leg is the instrument-of-record whose value
// moves with the FX rate; the paid funding leg is in the reporting currency.
//
// BOUNDARY: V1-SIDE platform file — MAY import v2-core; reads the product layer.
//
// Authority: D-CASH-ASSET-CLASS-V1; prd:bank:fx:otc-vanilla; Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering).

import { formatInstanceUrn, formatTypeUrn } from "../../../v2-core/fil-core/urn";
import { anchorFunctionalCurrency } from "../../identity/functional-currency";
import { type SettledCashLeg, materialiseSettledCash } from "./materialise-settled-cash";

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = ENTITY;

// FIL type URNs — identical grammar to scripts/backfill-fil-instances.ts so the
// live-materialised FX instance URN/type matches the projection's view.
const FX_SPOT_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "spot",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});
const FX_FORWARD_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "forward",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});

/** The data a live FX settlement handler has for one settling trade. */
export interface SettledFxLegData {
  readonly tradeId: string;
  /** The PAID (delivered) leg — bank's outflow. amountMajor is the absolute MAJOR amount. */
  readonly payCurrency: string;
  readonly payAmountMajor: number;
  /** The RECEIVED leg — bank's inflow. amountMajor is the absolute MAJOR amount. */
  readonly receiveCurrency: string;
  readonly receiveAmountMajor: number;
  /** Counterparty + netting-set carried from the trade (for the cash instances). */
  readonly counterpartyId: string;
  /** Settlement instant (ISO). The cash leg's as-of. */
  readonly settledAsOf: string;
  /** Whether the settling instrument is a forward (else spot) — selects the FIL type. */
  readonly isForward?: boolean;
}

/**
 * Materialise the settled cash legs of one settled FX trade into the v2 anchor
 * store. Returns the number of NEW cash instances emitted (0 when the governing
 * product declares no cash rule, or all legs already present).
 *
 * Sign convention: received leg → +, paid leg → − (drives the cash instance's
 * long/short direction). A zero-amount leg is dropped (no degenerate instrument).
 */
export function materialiseSettledCashForFxLegs(data: SettledFxLegData): number {
  const reporting = anchorFunctionalCurrency();
  const fxTypeUrn = data.isForward ? FX_FORWARD_TYPE_URN : FX_SPOT_TYPE_URN;
  const fxInstance = formatInstanceUrn({ tenant: TENANT, instanceId: data.tradeId });
  const nettingSetId = `NS-${data.counterpartyId}-${reporting}`;

  const cashLegs: SettledCashLeg[] = [];
  if (data.receiveCurrency && data.receiveAmountMajor !== 0) {
    cashLegs.push({
      currency: data.receiveCurrency,
      signedMajor: Math.abs(data.receiveAmountMajor),
      side: "received",
    });
  }
  if (data.payCurrency && data.payAmountMajor !== 0) {
    cashLegs.push({
      currency: data.payCurrency,
      signedMajor: -Math.abs(data.payAmountMajor),
      side: "paid",
    });
  }
  if (cashLegs.length === 0) return 0;

  return materialiseSettledCash({
    tradeId: data.tradeId,
    fxInstance,
    fxTypeUrn,
    settledAsOf: data.settledAsOf,
    entity: ENTITY,
    tenant: TENANT,
    reporting,
    counterpartyId: data.counterpartyId,
    nettingSetId,
    cashLegs,
  });
}
