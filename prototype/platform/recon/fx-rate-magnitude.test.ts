// platform/recon/fx-rate-magnitude.test.ts
//
// Unit tests for the fx-rate-magnitude advisory recon.
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - PR #654 (pair-direction precedent)
//   - Slice 3b (Devon — sim generator simplification, PR #665) — recon
//     reframed side-aware (BUY: counter = notional / rate; SELL: counter =
//     notional × rate).
//
// Author: Kai (trading systems engineer); side-aware rewrite Devon (COO, engineering).

import { describe, expect, it } from "bun:test";

import { legDrift, run } from "./fx-rate-magnitude";

describe("legDrift helper", () => {
  it("SELL: zero drift when notional × rate = counterNotional exactly", () => {
    // SELL on USD/ZAR: pay=USD (base), receive=ZAR (quote). notional in USD,
    // counter in ZAR, rate = quote-per-base = ZAR/USD.
    expect(
      legDrift(
        {
          notional: { amountMinor: 1_000_000 }, // USD cents
          counterNotional: { amountMinor: 18_500_000 }, // ZAR cents
          rate: { amount: 18.5 },
        },
        "sell",
      ),
    ).toBe(0);
  });

  it("BUY: zero drift when notional / rate = counterNotional exactly", () => {
    // BUY on USD/ZAR: pay=ZAR (quote), receive=USD (base). notional in ZAR,
    // counter in USD, rate = quote-per-base = ZAR/USD.
    expect(
      legDrift(
        {
          notional: { amountMinor: 18_500_000 }, // ZAR cents
          counterNotional: { amountMinor: 1_000_000 }, // USD cents
          rate: { amount: 18.5 },
        },
        "buy",
      ),
    ).toBe(0);
  });

  it("returns null when fields are missing or non-numeric", () => {
    expect(legDrift({}, "buy")).toBeNull();
    expect(
      legDrift(
        {
          notional: { amountMinor: 100 },
          counterNotional: { amountMinor: 100 },
        },
        "sell",
      ),
    ).toBeNull();
  });

  it("returns null when counter is zero (degenerate)", () => {
    expect(
      legDrift(
        {
          notional: { amountMinor: 100 },
          counterNotional: { amountMinor: 0 },
          rate: { amount: 18.5 },
        },
        "buy",
      ),
    ).toBeNull();
  });

  it("BUY with wrongly-multiplied counter signals substantial drift", () => {
    // BUY: counter should be notional / rate. A counter computed as
    // notional × rate is the canonical legacy off-by-rate signature.
    // notional 18_500_000 (ZAR), counter mistakenly 342_250_000 (would be ZAR² nonsense),
    // expected counter = 18_500_000 / 18.5 = 1_000_000.
    // drift = |18_500_000/18.5 − 342_250_000| / 342_250_000 ≈ 0.997.
    const d = legDrift(
      {
        notional: { amountMinor: 18_500_000 },
        counterNotional: { amountMinor: 342_250_000 },
        rate: { amount: 18.5 },
      },
      "buy",
    );
    if (d === null) throw new Error("legDrift should return a number for fully-shaped input");
    expect(d).toBeGreaterThan(0.5); // way above 0.1%
  });
});

describe("fx-rate-magnitude recon", () => {
  it("empty event source → asserted=0, ok=true", () => {
    const r = run({ fxTradeEvents: [] });
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("on-magnitude SELL event → zero violations, ok=true", () => {
    const r = run({
      fxTradeEvents: [
        {
          event_id: "ev-good-sell",
          as_of: "2026-05-21T00:00:00.000Z",
          payload: {
            side: "sell",
            productTaxonomy: "FX-spot",
            legs: [
              {
                legKind: "near",
                notional: { amountMinor: 1_000_000 },
                counterNotional: { amountMinor: 18_500_000 },
                rate: { amount: 18.5 },
              },
            ],
          },
        },
      ],
    });
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("on-magnitude BUY event → zero violations, ok=true", () => {
    const r = run({
      fxTradeEvents: [
        {
          event_id: "ev-good-buy",
          as_of: "2026-05-21T00:00:00.000Z",
          payload: {
            side: "buy",
            productTaxonomy: "FX-spot",
            legs: [
              {
                legKind: "near",
                notional: { amountMinor: 18_500_000 },
                counterNotional: { amountMinor: 1_000_000 },
                rate: { amount: 18.5 },
              },
            ],
          },
        },
      ],
    });
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("inverted-rate BUY event (legacy pre-Slice-3b shape) → warn, advisory keeps ok=true", () => {
    // Legacy BUY signature: legRate = 1/mid encoded in rate.amount,
    // counter = notional × (1/mid). Under the new convention this looks
    // like an off-by-rate drift.
    const r = run({
      fxTradeEvents: [
        {
          event_id: "ev-inverted",
          as_of: "2026-05-21T00:00:00.000Z",
          payload: {
            side: "buy",
            productTaxonomy: "FX-spot",
            legs: [
              {
                legKind: "near",
                notional: { amountMinor: 18_500_000 },
                counterNotional: { amountMinor: 1_000_000 },
                rate: { amount: 1 / 18.5 }, // legacy inverted rate
              },
            ],
          },
        },
      ],
    });
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.ok).toBe(true);
  });

  it("within-tolerance rounding (SELL, 0.05%) → no violation", () => {
    // SELL on USD/ZAR. notional × rate = 1_000_000 × 18.5 = 18_500_000;
    // record 18_509_000 → drift ~0.049% < 0.1% tolerance.
    const r = run({
      fxTradeEvents: [
        {
          event_id: "ev-rounding",
          as_of: "2026-05-21T00:00:00.000Z",
          payload: {
            side: "sell",
            productTaxonomy: "FX-spot",
            legs: [
              {
                legKind: "near",
                notional: { amountMinor: 1_000_000 },
                counterNotional: { amountMinor: 18_509_000 },
                rate: { amount: 18.5 },
              },
            ],
          },
        },
      ],
    });
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("FX-swap far leg inverts side under refinement (v) — BUY swap far leg uses SELL math", () => {
    // BUY USD/ZAR swap: near leg buys USD; far leg sells USD.
    // Far leg: pay=USD (base), receive=ZAR (quote), so counter = notional × rate.
    const r = run({
      fxTradeEvents: [
        {
          event_id: "ev-swap",
          as_of: "2026-05-21T00:00:00.000Z",
          payload: {
            side: "buy",
            productTaxonomy: "FX-swap",
            legs: [
              {
                legKind: "near",
                notional: { amountMinor: 18_500_000 },
                counterNotional: { amountMinor: 1_000_000 },
                rate: { amount: 18.5 },
              },
              {
                legKind: "far",
                notional: { amountMinor: 1_000_000 },
                counterNotional: { amountMinor: 18_500_000 },
                rate: { amount: 18.5 },
              },
            ],
          },
        },
      ],
    });
    expect(r.asserted).toBe(2);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });
});
