// platform/markets/products/booking-product-binding.ts
//
// BOOKING-TIME PRODUCT BINDING — the NPA gate for S0d
// (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD).
//
// When a FIL instrument is BOOKED, the booking path stamps the id of the
// NPA-approved `V2ProductRegistered` product the instrument is booked under onto
// its economic terms (`FilEconomicTerms.productId`). The accounting fold then
// resolves the instrument's composed reporting treatment DIRECTLY from that bound
// product — deterministically — instead of inferring it from a type-scope
// fallback.
//
// THIS IS THE NPA GATE: only a FIL type that an NPA-approved product GOVERNS gets
// a `productId` stamped. A FIL type with no governing approved product gets no
// binding — the instance then folds via the documented fail-closed path (no
// silent default — Engineering Charter cmd 2). So an instrument can only carry a
// product binding if a product was genuinely approved to book it.
//
// SOURCING (Engineering Charter cmd 4 — source, don't hardcode). The
// FIL-type → governing v2 product id mapping is the canonical NPA-approval fact:
// the `v2:prd:bank:fx:otc-vanilla` product is registered (`V2ProductRegistered`,
// scoped `fil:type:fx:spot:*` + `fil:type:fx:forward:*`) by the anchor
// standing-data seed (`scripts/seed-v2-anchor-bank-standing-data.ts`), composing
// its treatment from the FX treatment modules per D-ACCT-MODULAR-PRODUCT-COMPOSED-
// FOLD. This registry is the single home of that scope→productId fact for the
// booking paths; a future slice that co-locates `V2ProductRegistered` into the
// FIL booking store can fold this map from the events directly (the co-location
// gap is tracked separately — see fx-fold.ts S0d note).
//
// MATCHING is by FIL type SCOPE (the same `matchesFilScope` grammar
// `V2ProductRegistered.filTypeScopes` uses), so a versioned type URN
// (`fil:type:fx:spot:otc-vanilla@1.0`) binds to a product scoped `fil:type:fx:*`.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17, S0d);
//   D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19); Principle 1; Principle 2.
// Author: Bea (Financial Accountant, finance); architecture consult: Atlas (Core
//   banking platform architect, engineering).

import { matchesFilScope } from "../../../v2-core/fil-core/urn";

/**
 * One NPA-approved governing-product binding: the v2 product id and the FIL type
 * scope patterns it governs (mirroring `V2ProductRegistered.filTypeScopes`).
 */
interface GoverningProductBinding {
  /** The `V2ProductRegistered.productId` the matching instruments book under. */
  readonly productId: string;
  /** FIL type scope patterns the product governs (e.g. `fil:type:fx:spot:*`). */
  readonly filTypeScopes: readonly string[];
}

/**
 * The NPA-approved governing-product registry, FX slice. Each entry mirrors the
 * `V2ProductRegistered` of an NPA-approved product. Keeping this list aligned
 * with the registered products is asserted by the booking-binding unit test (so
 * a product id / scope drift fails closed in CI, not silently at fold time).
 */
const NPA_APPROVED_GOVERNING_PRODUCTS: readonly GoverningProductBinding[] = [
  {
    // FX OTC Vanilla (spot + forward) — D-FX-OTC-NPA-SCOPE-EXPANSION,
    // D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD. Registered scoped fil:type:fx:spot:*
    // + fil:type:fx:forward:* in seed-v2-anchor-bank-standing-data.ts.
    productId: "v2:prd:bank:fx:otc-vanilla",
    filTypeScopes: ["fil:type:fx:spot:*", "fil:type:fx:forward:*"],
  },
];

/**
 * Resolve the NPA-approved governing product id for a FIL instrument of the given
 * type URN — the booking-time product binding (S0d). Returns `undefined` when no
 * NPA-approved product governs the type (the instrument then carries no
 * `productId` and the accounting fold fails closed for it — no silent default).
 *
 * PURE — no event access. The booking path calls this and, if it returns a
 * product id, stamps it on `FilEconomicTerms.productId`.
 */
export function resolveBookingProductId(filTypeUrn: string): string | undefined {
  for (const binding of NPA_APPROVED_GOVERNING_PRODUCTS) {
    if (binding.filTypeScopes.some((scope) => matchesFilScope(scope, filTypeUrn))) {
      return binding.productId;
    }
  }
  return undefined;
}
