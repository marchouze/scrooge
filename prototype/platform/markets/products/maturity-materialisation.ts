// platform/markets/products/maturity-materialisation.ts
//
// PRODUCT-DRIVEN maturity→successor-asset resolution (D-CASH-ASSET-CLASS-V1).
//
// The coupling "a settled FX trade materialises a `cash` asset" is a PRODUCT
// fact, declared by the FX OTC NPA (`prd:bank:fx:otc-vanilla`,
// `M4_FX_OTC_VANILLA_FIXTURE.maturityMaterialisation`) — NOT a hardwired kernel
// dependency between the `fx` and `cash` FIL asset classes. The settlement path
// (e.g. `scripts/backfill-fil-instances.ts`, the live settlement handler) calls
// `resolveMaturityMaterialisation(filTypeUrn)` to discover whether — and into
// which FIL type — a settling instrument materialises a successor. The kernel
// stays asset-class-agnostic; this resolver is the product-layer mouth.
//
// Sourcing: the rule is read off the governing Product fixture (single source of
// truth), keyed by the FIL type URN(s) the product governs. Adding a new product
// that materialises cash is a fixture edit + a registry entry here, never a
// kernel change.
//
// Authority: D-CASH-ASSET-CLASS-V1; prd:bank:fx:otc-vanilla;
//   D-FIL-FRAMEWORK-UNIFICATION; Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import { M4_FX_OTC_VANILLA_FIXTURE } from "./fixtures";
import type { MaturityMaterialisation, Product } from "./types";

// ---------------------------------------------------------------------------
// FIL type URN → governing Product. The FX OTC NPA governs the FX spot/forward
// FIL types. A product with a `maturityMaterialisation` rule contributes its
// rule; a product without one contributes nothing (origin-less settlement).
// ---------------------------------------------------------------------------

const FX_SPOT_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";
const FX_FORWARD_TYPE_URN = "fil:type:fx:forward:otc-vanilla@1.0";

/** FIL type URN → the Product that governs instruments of that type. */
const GOVERNING_PRODUCT_BY_FIL_TYPE: ReadonlyMap<string, Product> = new Map([
  [FX_SPOT_TYPE_URN, M4_FX_OTC_VANILLA_FIXTURE],
  [FX_FORWARD_TYPE_URN, M4_FX_OTC_VANILLA_FIXTURE],
]);

/**
 * The maturity-materialisation rule for a settling FIL instrument of the given
 * type, or `undefined` if the governing product declares none (the instrument
 * terminates without a successor). PURE — no event access; the settlement path
 * supplies the legs.
 */
export function resolveMaturityMaterialisation(
  filTypeUrn: string,
): MaturityMaterialisation | undefined {
  return GOVERNING_PRODUCT_BY_FIL_TYPE.get(filTypeUrn)?.maturityMaterialisation;
}
