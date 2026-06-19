// platform/markets/products/booking-product-binding.test.ts
//
// Unit tests for the S0d NPA-gate booking-product-binding resolver
// (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-FX-OTC-CLOSURE-BACKLOG).
//
// Author: Bea (Financial Accountant, finance); architecture consult: Atlas
//   (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { resolveBookingProductId } from "./booking-product-binding";

describe("resolveBookingProductId — S0d NPA gate", () => {
  it("binds an FX spot instrument to the approved FX OTC Vanilla v2 product", () => {
    expect(resolveBookingProductId("fil:type:fx:spot:otc-vanilla@1.0")).toBe(
      "v2:prd:bank:fx:otc-vanilla",
    );
  });

  it("binds an FX forward instrument to the same FX OTC Vanilla v2 product", () => {
    expect(resolveBookingProductId("fil:type:fx:forward:otc-vanilla@1.0")).toBe(
      "v2:prd:bank:fx:otc-vanilla",
    );
  });

  it("returns the v2 product id, NOT the v1 product id (the fold resolves the v2 registration)", () => {
    // The fold resolves against V2ProductRegistered.productId; the binding must be
    // the v2-namespaced id, not the v1 NPA id (`prd:bank:fx:otc-vanilla`).
    expect(resolveBookingProductId("fil:type:fx:spot:otc-vanilla@1.0")).not.toBe(
      "prd:bank:fx:otc-vanilla",
    );
  });

  it("does NOT bind a non-FX type (no approved governing product → fail-closed at fold)", () => {
    // IR / cash / bond instruments have no governing product in the S0d FX slice;
    // they carry no binding and the fold fails closed for them (no silent default).
    expect(resolveBookingProductId("fil:type:ir:swap.vanilla:vanilla-irs-zar@1.0")).toBeUndefined();
    expect(resolveBookingProductId("fil:type:cash:balance:vanilla@1.0")).toBeUndefined();
    expect(resolveBookingProductId("fil:type:ir:bond.govt:sagb@1.0")).toBeUndefined();
  });
});
