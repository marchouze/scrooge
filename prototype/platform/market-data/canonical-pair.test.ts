// platform/market-data/canonical-pair.test.ts
//
// Unit tests for `toCanonicalPair`, `toCanonicalPairKey`, and `canonicalSide`.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import { canonicalSide, toCanonicalPair, toCanonicalPairKey } from "./canonical-pair";

describe("toCanonicalPair — ZAR pairs", () => {
  it("USD/ZAR stays USD/ZAR (foreign is base)", () => {
    const r = toCanonicalPair("USD", "ZAR");
    expect(r.base).toBe("USD");
    expect(r.quote).toBe("ZAR");
    expect(r.pairKey).toBe("USD/ZAR");
    expect(r.inverted).toBe(false);
  });

  it("ZAR/USD inverts to USD/ZAR (foreign becomes base)", () => {
    const r = toCanonicalPair("ZAR", "USD");
    expect(r.base).toBe("USD");
    expect(r.quote).toBe("ZAR");
    expect(r.pairKey).toBe("USD/ZAR");
    expect(r.inverted).toBe(true);
  });

  it("EUR/ZAR stays EUR/ZAR", () => {
    expect(toCanonicalPair("EUR", "ZAR").pairKey).toBe("EUR/ZAR");
    expect(toCanonicalPair("EUR", "ZAR").inverted).toBe(false);
  });

  it("ZAR/EUR inverts to EUR/ZAR", () => {
    const r = toCanonicalPair("ZAR", "EUR");
    expect(r.pairKey).toBe("EUR/ZAR");
    expect(r.inverted).toBe(true);
  });

  it("ZAR vs unranked exotic — exotic is base (ZAR is below everything else)", () => {
    expect(toCanonicalPair("MXN", "ZAR").pairKey).toBe("MXN/ZAR");
    expect(toCanonicalPair("ZAR", "MXN").pairKey).toBe("MXN/ZAR");
    expect(toCanonicalPair("ZAR", "MXN").inverted).toBe(true);
  });
});

describe("toCanonicalPair — non-ZAR major pairs", () => {
  it("EUR outranks USD: EUR/USD canonical", () => {
    expect(toCanonicalPair("EUR", "USD").pairKey).toBe("EUR/USD");
    expect(toCanonicalPair("EUR", "USD").inverted).toBe(false);
    expect(toCanonicalPair("USD", "EUR").pairKey).toBe("EUR/USD");
    expect(toCanonicalPair("USD", "EUR").inverted).toBe(true);
  });

  it("GBP outranks USD: GBP/USD canonical", () => {
    expect(toCanonicalPair("GBP", "USD").pairKey).toBe("GBP/USD");
    expect(toCanonicalPair("USD", "GBP").pairKey).toBe("GBP/USD");
    expect(toCanonicalPair("USD", "GBP").inverted).toBe(true);
  });

  it("EUR outranks GBP: EUR/GBP canonical", () => {
    expect(toCanonicalPair("EUR", "GBP").pairKey).toBe("EUR/GBP");
    expect(toCanonicalPair("GBP", "EUR").pairKey).toBe("EUR/GBP");
  });

  it("AUD outranks NZD: AUD/NZD canonical", () => {
    expect(toCanonicalPair("AUD", "NZD").pairKey).toBe("AUD/NZD");
    expect(toCanonicalPair("NZD", "AUD").pairKey).toBe("AUD/NZD");
  });

  it("USD outranks CHF: USD/CHF canonical (brief precedence: USD > CHF)", () => {
    expect(toCanonicalPair("USD", "CHF").pairKey).toBe("USD/CHF");
    expect(toCanonicalPair("CHF", "USD").pairKey).toBe("USD/CHF");
    expect(toCanonicalPair("CHF", "USD").inverted).toBe(true);
  });

  it("CHF outranks CAD per brief: CHF/CAD canonical", () => {
    expect(toCanonicalPair("CHF", "CAD").pairKey).toBe("CHF/CAD");
    expect(toCanonicalPair("CAD", "CHF").pairKey).toBe("CHF/CAD");
  });

  it("USD outranks JPY: USD/JPY canonical", () => {
    expect(toCanonicalPair("USD", "JPY").pairKey).toBe("USD/JPY");
    expect(toCanonicalPair("JPY", "USD").pairKey).toBe("USD/JPY");
  });
});

describe("toCanonicalPair — ranked vs unranked", () => {
  it("USD vs MXN: USD is base (USD ranked, MXN unranked)", () => {
    expect(toCanonicalPair("USD", "MXN").pairKey).toBe("USD/MXN");
    expect(toCanonicalPair("MXN", "USD").pairKey).toBe("USD/MXN");
    expect(toCanonicalPair("MXN", "USD").inverted).toBe(true);
  });

  it("EUR vs BRL: EUR is base", () => {
    expect(toCanonicalPair("EUR", "BRL").pairKey).toBe("EUR/BRL");
    expect(toCanonicalPair("BRL", "EUR").pairKey).toBe("EUR/BRL");
  });
});

describe("toCanonicalPair — tiebreak (unranked-vs-unranked)", () => {
  it("BRL vs MXN: lex-ascending → BRL/MXN", () => {
    expect(toCanonicalPair("BRL", "MXN").pairKey).toBe("BRL/MXN");
    expect(toCanonicalPair("MXN", "BRL").pairKey).toBe("BRL/MXN");
    expect(toCanonicalPair("MXN", "BRL").inverted).toBe(true);
  });

  it("ARS vs BRL: lex-ascending → ARS/BRL", () => {
    expect(toCanonicalPair("ARS", "BRL").pairKey).toBe("ARS/BRL");
    expect(toCanonicalPair("BRL", "ARS").pairKey).toBe("ARS/BRL");
  });
});

describe("toCanonicalPair — degenerate inputs", () => {
  it("identity (base === quote) throws", () => {
    expect(() => toCanonicalPair("USD", "USD")).toThrow(RangeError);
    expect(() => toCanonicalPair("ZAR", "ZAR")).toThrow(RangeError);
  });

  it("empty string throws", () => {
    expect(() => toCanonicalPair("", "ZAR")).toThrow(RangeError);
    expect(() => toCanonicalPair("USD", "")).toThrow(RangeError);
  });
});

describe("toCanonicalPairKey — convenience accessor", () => {
  it("returns just the pairKey string", () => {
    expect(toCanonicalPairKey("ZAR", "USD")).toBe("USD/ZAR");
    expect(toCanonicalPairKey("USD", "ZAR")).toBe("USD/ZAR");
    expect(toCanonicalPairKey("EUR", "USD")).toBe("EUR/USD");
  });
});

describe("canonicalSide — side-aware flipping", () => {
  it("non-inverted: side passes through", () => {
    const direct = toCanonicalPair("USD", "ZAR"); // inverted=false
    expect(canonicalSide("buy", direct)).toBe("buy");
    expect(canonicalSide("sell", direct)).toBe("sell");
  });

  it("inverted: buy ↔ sell flip", () => {
    const inverted = toCanonicalPair("ZAR", "USD"); // inverted=true
    expect(canonicalSide("buy", inverted)).toBe("sell");
    expect(canonicalSide("sell", inverted)).toBe("buy");
  });

  it("buy USD/ZAR == sell ZAR/USD economically (same canonical bucket, same side)", () => {
    // Trade 1: booked as buy USD/ZAR — canonical pair USD/ZAR, no flip.
    const t1 = toCanonicalPair("USD", "ZAR");
    const t1Side = canonicalSide("buy", t1);
    // Trade 2: booked as sell ZAR/USD — canonical pair USD/ZAR (inverted), side flips.
    const t2 = toCanonicalPair("ZAR", "USD");
    const t2Side = canonicalSide("sell", t2);
    // Both end up in the same canonical bucket with the same canonical side.
    expect(t1.pairKey).toBe(t2.pairKey);
    expect(t1Side).toBe(t2Side);
    expect(t1Side).toBe("buy");
  });
});
