// platform/recon/fx-rate-magnitude.test.ts
//
// Unit tests for the fx-rate-magnitude advisory recon.
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - PR #654 (pair-direction precedent)
//
// Author: Kai (trading systems engineer)

import { describe, expect, it } from "bun:test";

import { legDrift, run } from "./fx-rate-magnitude";

describe("legDrift helper", () => {
  it("zero drift when notional × rate = counterNotional exactly", () => {
    expect(
      legDrift({
        notional: { amountMinor: 18_500_000 },
        counterNotional: { amountMinor: 18_500_000 * 18.5 },
        rate: { amount: 18.5 },
      }),
    ).toBe(0);
  });

  it("returns null when fields are missing or non-numeric", () => {
    expect(legDrift({})).toBeNull();
    expect(
      legDrift({
        notional: { amountMinor: 100 },
        counterNotional: { amountMinor: 100 },
      }),
    ).toBeNull();
  });

  it("returns null when counter is zero (degenerate)", () => {
    expect(
      legDrift({
        notional: { amountMinor: 100 },
        counterNotional: { amountMinor: 0 },
        rate: { amount: 18.5 },
      }),
    ).toBeNull();
  });

  it("computes substantial drift when rate is inverted (~342× off)", () => {
    // Recorded counter = 1_000_000 (USD minor). Notional = 18_500_000 (ZAR minor).
    // Correct rate.amount would be ~0.054 (USD/ZAR). Inverted rate is 18.5.
    // Implied = 18_500_000 × 18.5 = 342_250_000 vs recorded 1_000_000.
    const d = legDrift({
      notional: { amountMinor: 18_500_000 },
      counterNotional: { amountMinor: 1_000_000 },
      rate: { amount: 18.5 },
    });
    if (d === null) throw new Error("legDrift should return a number for fully-shaped input");
    expect(d).toBeGreaterThan(1); // way above 0.1%
  });
});

describe("fx-rate-magnitude recon", () => {
  it("empty event source → asserted=0, ok=true", () => {
    const r = run({ fxTradeEvents: [] });
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("on-magnitude event → zero violations, ok=true", () => {
    const r = run({
      fxTradeEvents: [
        {
          event_id: "ev-good",
          as_of: "2026-05-21T00:00:00.000Z",
          payload: {
            legs: [
              {
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

  it("inverted-rate event → warn, advisory keeps ok=true", () => {
    const r = run({
      fxTradeEvents: [
        {
          event_id: "ev-inverted",
          as_of: "2026-05-21T00:00:00.000Z",
          payload: {
            legs: [
              {
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
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.ok).toBe(true);
  });

  it("within-tolerance rounding (0.05%) → no violation", () => {
    // notional × rate = 18_500_000 × 18.5 = 342_250_000;
    // record 342_421_000 → drift ~0.05% < 0.1% tolerance.
    const r = run({
      fxTradeEvents: [
        {
          event_id: "ev-rounding",
          as_of: "2026-05-21T00:00:00.000Z",
          payload: {
            legs: [
              {
                notional: { amountMinor: 18_500_000 },
                counterNotional: { amountMinor: 342_421_000 },
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
});
