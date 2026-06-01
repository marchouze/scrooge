// platform/recon/fx-pair-direction.test.ts
//
// Unit tests for the fx-pair-direction recon — pure-function helpers and
// the run() pipeline driven by injected sources.
//
// Author: Devon (Chief Operating Officer, engineering)

import { describe, expect, it } from "bun:test";

import { canonicalisePair, isCanonical, run } from "./fx-pair-direction";

describe("canonicalisePair (ACI major-first hierarchy)", () => {
  it("USD/ZAR is canonical (USD outranks ZAR)", () => {
    expect(canonicalisePair("USD", "ZAR")).toBe("USD/ZAR");
    expect(canonicalisePair("ZAR", "USD")).toBe("USD/ZAR");
  });

  it("EUR/USD is canonical (EUR outranks USD)", () => {
    expect(canonicalisePair("EUR", "USD")).toBe("EUR/USD");
    expect(canonicalisePair("USD", "EUR")).toBe("EUR/USD");
  });

  it("GBP/USD is canonical (GBP outranks USD)", () => {
    expect(canonicalisePair("GBP", "USD")).toBe("GBP/USD");
    expect(canonicalisePair("USD", "GBP")).toBe("GBP/USD");
  });

  it("EUR/GBP is canonical (EUR outranks GBP)", () => {
    expect(canonicalisePair("EUR", "GBP")).toBe("EUR/GBP");
    expect(canonicalisePair("GBP", "EUR")).toBe("EUR/GBP");
  });

  it("unranked-vs-unranked falls back to alphabetical ascending", () => {
    expect(canonicalisePair("BRL", "MXN")).toBe("BRL/MXN");
    expect(canonicalisePair("MXN", "BRL")).toBe("BRL/MXN");
  });

  it("ranked-vs-unranked: ranked is base", () => {
    expect(canonicalisePair("USD", "MXN")).toBe("USD/MXN");
    expect(canonicalisePair("MXN", "USD")).toBe("USD/MXN");
  });
});

describe("isCanonical", () => {
  it("USD/ZAR canonical, ZAR/USD not", () => {
    expect(isCanonical("USD", "ZAR")).toBe(true);
    expect(isCanonical("ZAR", "USD")).toBe(false);
  });

  it("EUR/USD canonical, USD/EUR not", () => {
    expect(isCanonical("EUR", "USD")).toBe(true);
    expect(isCanonical("USD", "EUR")).toBe(false);
  });

  it("identical base and quote are not canonical (degenerate)", () => {
    expect(isCanonical("USD", "USD")).toBe(false);
  });
});

describe("run() — pipeline assertions", () => {
  it("empty state: zero sources → asserted=0, ok=true", () => {
    const r = run({
      fxTradeEvents: [],
      seedKeys: [],
      midRateKeys: [],
      standardPairs: [],
    });
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("all-canonical sources produce zero violations", () => {
    const r = run({
      fxTradeEvents: [
        {
          event_id: "e1",
          as_of: "2026-05-21",
          payload: { currencyPair: { base: "USD", quote: "ZAR" } },
        },
      ],
      seedKeys: ["USD/ZAR", "EUR/USD", "EUR/ZAR"],
      midRateKeys: ["USD/ZAR", "EUR/USD"],
      standardPairs: ["USD/ZAR", "EUR/ZAR"],
    });
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
    // 1 event + 3 seed keys + 2 mid + 2 standard = 8.
    expect(r.asserted).toBe(8);
  });

  it("non-canonical event payload (ZAR/USD) is flagged as warn", () => {
    const r = run({
      fxTradeEvents: [
        {
          event_id: "bad-1",
          as_of: "2026-05-21",
          payload: { currencyPair: { base: "ZAR", quote: "USD" } },
        },
      ],
      seedKeys: [],
      midRateKeys: [],
      standardPairs: [],
    });
    expect(r.violations).toHaveLength(1);
    const v = r.violations[0];
    expect(v?.severity).toBe("warn");
    expect(v?.subject).toContain("FxTradeExecuted:bad-1");
    expect(v?.message).toContain("USD/ZAR");
    // P2 advisory — warn does not flip ok=false.
    expect(r.ok).toBe(true);
  });

  it("non-canonical seed key (ZAR/EUR) is flagged as warn", () => {
    const r = run({
      fxTradeEvents: [],
      seedKeys: ["ZAR/EUR"],
      midRateKeys: [],
      standardPairs: [],
    });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.subject).toBe("seeds/fx-rates.json:ZAR/EUR");
    expect(r.violations[0]?.message).toContain("EUR/ZAR");
  });

  it("malformed pair string (no slash) is flagged as warn", () => {
    const r = run({
      fxTradeEvents: [],
      seedKeys: ["USDZAR"],
      midRateKeys: [],
      standardPairs: [],
    });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
  });

  it("non-canonical STANDARD_PAIRS entry is flagged", () => {
    const r = run({
      fxTradeEvents: [],
      seedKeys: [],
      midRateKeys: [],
      standardPairs: ["ZAR/USD"],
    });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.subject).toContain("STANDARD_PAIRS");
  });
});
