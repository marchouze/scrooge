// tests/products-dimension-key-alias.test.ts
//
// Regression coverage for the ProductDimensionAttested dimension-key drift
// (CEO-diagnosed 2026-06-12; chip task_b6fe63a6, D-FX-HELD-DIMS-SEAT-SWEEP).
//
// The event-of-record emits SHORT, canonical dimension keys (`conduct`,
// `legal`, `liquidity-risk`, `aml`, `infosec`). The dashboard products views
// historically filtered on a LONG display-key set and SILENTLY DROPPED the
// short-key events, so recent promotions never rendered on the products page.
//
// These tests prove:
//   1. A short-key `ProductDimensionAttested` event surfaces in the
//      products-LIST view per-dimension status (status != "pending").
//   2. The same surfaces in the products-DETAIL view dimension card.
//   3. The alias map is coherent: covers all 14 canonical dimensions, every
//      alias target is a real canonical key, no orphan, no unmapped key.
//   4. The 9 already-matching dimensions still fold correctly (no regression).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { buildProductDetailView } from "../dashboard/products-detail";
import { NPA_DIMENSIONS, buildProductListView } from "../dashboard/products-view";
import { makeProductDimensionAttested } from "../platform/event-store/event-types/product";
import type { Event } from "../platform/event-store/types";
import {
  CANONICAL_DIMENSION_KEYS,
  LONG_TO_SHORT_DIMENSION_KEY,
  SHORT_TO_LONG_DIMENSION_KEY,
  normaliseDimensionKey,
} from "../platform/markets/products/dimension-key-alias";
import { ALL_NPA_DIMENSION_KEYS } from "../platform/projections/products/product-register";

// ---------------------------------------------------------------------------
// Test envelope — a minimal replay-only store over an in-memory event array
// (the views only require `Pick<EventStore, "replay">`).
// ---------------------------------------------------------------------------

const ACTOR = { type: "system" as const, id: "test:Atlas" };
const ENTITY = "LE-TEST-BANK-ZA";
const CITATIONS = ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-FX-HELD-DIMS-SEAT-SWEEP"];
// An always-present baseline fixture (M4 FX Spot) — guaranteed in both views.
const PRODUCT_ID = "prd:bank:fx:fx-spot-zar-usd";
const AS_OF = "2026-06-12T09:00:00Z";

function stubStore(events: Event[]): { replay: (opts?: { type?: string }) => Generator<Event> } {
  return {
    *replay(opts: { type?: string } = {}) {
      for (const ev of events) {
        if (opts.type && ev.type !== opts.type) continue;
        yield ev;
      }
    },
  };
}

/** Narrow a possibly-undefined value to defined without a non-null assertion
 *  (Biome `noNonNullAssertion` forbids `!` in tests). */
function defined<T>(value: T | undefined | null): T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
  return value as T;
}

function attest(dimension: string, result: "implementation-attested" | "design-attested"): Event {
  return makeProductDimensionAttested({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      productId: PRODUCT_ID,
      dimension,
      result,
      citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    },
  });
}

// ---------------------------------------------------------------------------
// 1. Short-key event surfaces in the products-LIST view.
// ---------------------------------------------------------------------------

describe("dimension-key drift — products-list view", () => {
  it("surfaces a SHORT-key `conduct` attestation (would be dropped before the fix)", () => {
    const store = stubStore([attest("conduct", "implementation-attested")]);
    const view = buildProductListView(store, AS_OF);
    const product = defined(view.products.find((p) => p.productId === PRODUCT_ID));
    // Keyed on the canonical SHORT key.
    expect(product.dimensions.conduct).toBe("implementation-attested");
    expect(product.dimensions.conduct).not.toBe("pending");
  });

  it("surfaces a SHORT-key `legal` attestation", () => {
    const store = stubStore([attest("legal", "implementation-attested")]);
    const view = buildProductListView(store, AS_OF);
    const product = defined(view.products.find((p) => p.productId === PRODUCT_ID));
    expect(product.dimensions.legal).toBe("implementation-attested");
  });

  it("normalises a legacy LONG-key payload onto the canonical short key too", () => {
    // Even a stray long-key event resolves correctly (defence in depth).
    const store = stubStore([attest("conduct-suitability", "design-attested")]);
    const view = buildProductListView(store, AS_OF);
    const product = defined(view.products.find((p) => p.productId === PRODUCT_ID));
    expect(product.dimensions.conduct).toBe("design-attested");
  });

  it("does not regress the 9 already-matching dimensions", () => {
    const matching = [
      "market-risk",
      "credit-risk",
      "operational-risk",
      "operational-readiness",
      "accounting",
      "capital",
      "model-risk",
      "privacy",
      "tax",
    ] as const;
    const store = stubStore(matching.map((d) => attest(d, "implementation-attested")));
    const view = buildProductListView(store, AS_OF);
    const product = defined(view.products.find((p) => p.productId === PRODUCT_ID));
    for (const d of matching) {
      expect(product.dimensions[d]).toBe("implementation-attested");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Short-key event surfaces in the products-DETAIL view.
// ---------------------------------------------------------------------------

describe("dimension-key drift — products-detail view", () => {
  it("surfaces a SHORT-key `legal` attestation on its dimension card", () => {
    const store = stubStore([attest("legal", "implementation-attested")]);
    const detail = defined(buildProductDetailView(PRODUCT_ID, store, AS_OF));
    // The card is keyed by the LONG display key (frontend `switch` contract).
    const card = defined(detail.dimensions.find((c) => c.dimension === "legal-documentation"));
    expect(card.attestation.status).toBe("implementation-attested");
    expect(card.attestation.status).not.toBe("pending");
  });

  it("surfaces a SHORT-key `liquidity-risk` attestation", () => {
    const store = stubStore([attest("liquidity-risk", "design-attested")]);
    const detail = defined(buildProductDetailView(PRODUCT_ID, store, AS_OF));
    const card = defined(detail.dimensions.find((c) => c.dimension === "liquidity-funding"));
    expect(card.attestation.status).toBe("design-attested");
  });
});

// ---------------------------------------------------------------------------
// 3. Alias-map coherence.
// ---------------------------------------------------------------------------

describe("dimension-key-alias coherence", () => {
  it("the canonical key set matches the event-of-record / projection set", () => {
    expect([...CANONICAL_DIMENSION_KEYS]).toEqual([...ALL_NPA_DIMENSION_KEYS]);
    expect(CANONICAL_DIMENSION_KEYS).toHaveLength(14);
  });

  it("the view's NPA_DIMENSIONS set IS the canonical short-key set", () => {
    const viewKeys = [...NPA_DIMENSIONS].sort();
    const canonical = [...CANONICAL_DIMENSION_KEYS].sort();
    expect(viewKeys).toEqual(canonical as typeof viewKeys);
  });

  it("every long alias target is a real canonical short key (no orphan)", () => {
    for (const short of Object.values(LONG_TO_SHORT_DIMENSION_KEY)) {
      expect(CANONICAL_DIMENSION_KEYS).toContain(short);
    }
  });

  it("the 5 drifted dimensions are the only aliases, and they round-trip", () => {
    const expected: Record<string, string> = {
      "liquidity-funding": "liquidity-risk",
      "conduct-suitability": "conduct",
      "aml-sanctions-pep": "aml",
      "legal-documentation": "legal",
      "information-security": "infosec",
    };
    expect(LONG_TO_SHORT_DIMENSION_KEY).toEqual(expected);
    for (const [long, short] of Object.entries(expected)) {
      expect(normaliseDimensionKey(long)).toBe(short);
      expect(SHORT_TO_LONG_DIMENSION_KEY[short]).toBe(long);
    }
  });

  it("every canonical key normalises to itself (idempotent on short keys)", () => {
    for (const short of CANONICAL_DIMENSION_KEYS) {
      expect(normaliseDimensionKey(short)).toBe(short);
    }
  });

  it("unknown keys pass through unchanged (never invents a key)", () => {
    expect(normaliseDimensionKey("not-a-dimension")).toBe("not-a-dimension");
  });
});
