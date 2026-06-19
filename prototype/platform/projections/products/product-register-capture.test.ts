// platform/projections/products/product-register-capture.test.ts
//
// Tests the WHOLE-SET-REPLACE fold of `ProductReturnDataCaptureDeclared` into
// the product register, including the deterministic (as_of, event_id) tie-break
// REQUIRED by replay-safety: folding the same events in any order — and folding
// N times — yields the identical declared set.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import type { ReturnDataCapture } from "../../../v2-core/regulatory-returns/return-data-capture";
import { makeProductReturnDataCaptureDeclared } from "../../event-store/event-types/product";
import type { Actor, Event } from "../../event-store/types";
import { buildProductRegisterView } from "./product-register";

const ACTOR: Actor = { type: "service", id: "atlas" };
const PRODUCT_ID = "prd:bank:credit:loan";

function declare(args: {
  asOf: string;
  eventId: string;
  captures: ReturnDataCapture[];
}): Event {
  return makeProductReturnDataCaptureDeclared({
    asOf: args.asOf,
    entity: "LE-BANK-SA",
    actor: ACTOR,
    citations: ["D-BA-RETURN-DATA-CONTRACT"],
    eventId: args.eventId,
    payload: {
      productId: PRODUCT_ID,
      captures: args.captures,
      declaredByName: "Atlas",
      declaredByPosition: "Core banking platform architect",
    },
  });
}

function cap(attributeKey: string): ReturnDataCapture {
  return {
    attributeKey,
    valueShape: "enum",
    source: "gl-account",
    ref: `chart-of-accounts#${attributeKey}`,
    outOfCompositionJustification: "CoA-sourced, not type-determined",
    citations: ["D-BA-RETURN-DATA-CONTRACT"],
  };
}

describe("ProductReturnDataCaptureDeclared fold — whole-set replace", () => {
  it("the LATEST declaration (by as_of) REPLACES the whole set (not a delta-union)", () => {
    const e1 = declare({ asOf: "2026-06-19T00:00:00.000Z", eventId: "ev-1", captures: [cap("hqlaLevel")] });
    const e2 = declare({
      asOf: "2026-06-20T00:00:00.000Z",
      eventId: "ev-2",
      captures: [cap("fundingStability")], // a DIFFERENT attribute — replaces, not unions
    });
    const reg = buildProductRegisterView([e1, e2]);
    const row = reg.get(PRODUCT_ID);
    expect(row).toBeDefined();
    expect([...(row?.declaredReturnDataCaptures.keys() ?? [])]).toEqual(["fundingStability"]);
  });

  it("an EMPTY latest declaration clears the set (explicit nothing-to-declare)", () => {
    const e1 = declare({ asOf: "2026-06-19T00:00:00.000Z", eventId: "ev-1", captures: [cap("hqlaLevel")] });
    const e2 = declare({ asOf: "2026-06-20T00:00:00.000Z", eventId: "ev-2", captures: [] });
    const row = buildProductRegisterView([e1, e2]).get(PRODUCT_ID);
    expect([...(row?.declaredReturnDataCaptures.keys() ?? [])]).toEqual([]);
  });
});

describe("ProductReturnDataCaptureDeclared fold — deterministic replay tie-break", () => {
  // Two declarations with the SAME as_of must resolve deterministically by
  // event_id (lexicographically greater wins). This must hold regardless of the
  // order the events arrive in the fold, and folding N times must be stable.
  const sameAsOf = "2026-06-19T00:00:00.000Z";
  const lo = declare({ asOf: sameAsOf, eventId: "aaa", captures: [cap("hqlaLevel")] });
  const hi = declare({ asOf: sameAsOf, eventId: "zzz", captures: [cap("fundingStability")] });

  it("event_id tie-break: greater event_id wins on equal as_of", () => {
    const row = buildProductRegisterView([lo, hi]).get(PRODUCT_ID);
    expect([...(row?.declaredReturnDataCaptures.keys() ?? [])]).toEqual(["fundingStability"]);
  });

  it("order-independent: reversing the input yields the IDENTICAL result", () => {
    const a = buildProductRegisterView([lo, hi]).get(PRODUCT_ID);
    const b = buildProductRegisterView([hi, lo]).get(PRODUCT_ID);
    expect([...(a?.declaredReturnDataCaptures.keys() ?? [])]).toEqual([
      ...(b?.declaredReturnDataCaptures.keys() ?? []),
    ]);
    expect([...(a?.declaredReturnDataCaptures.keys() ?? [])]).toEqual(["fundingStability"]);
  });

  it("idempotent: folding the same events repeatedly is stable", () => {
    const once = buildProductRegisterView([lo, hi]).get(PRODUCT_ID);
    const twice = buildProductRegisterView([lo, hi, lo, hi]).get(PRODUCT_ID);
    expect([...(twice?.declaredReturnDataCaptures.keys() ?? [])]).toEqual([
      ...(once?.declaredReturnDataCaptures.keys() ?? []),
    ]);
  });
});
