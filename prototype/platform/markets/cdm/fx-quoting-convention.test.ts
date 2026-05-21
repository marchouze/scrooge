// platform/markets/cdm/fx-quoting-convention.test.ts
//
// Unit tests for the D-FX-QUOTING-CONVENTION Slice 1 Zod cross-field
// refinement on `fxTradeExecutedPayloadSchema`. Asserts the five-clause
// invariant: pay/receive ∈ pair, notional in pay-currency, counter-
// notional in receive-currency, rate.currency = pair quote, and side
// coherence (BUY → pay quote / receive base; SELL → pay base / receive
// quote).
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - PR #654 (pair-direction precedent — ACI Model Code §2)
//
// Author: Kai (trading systems engineer)

import { describe, expect, it } from "bun:test";

import { type FxTradeExecutedPayload, fxTradeExecutedPayloadSchema } from "./fx";

// ---------------------------------------------------------------------------
// Fixture builders — start from a known-good canonical USD/ZAR BUY payload
// and let each test mutate the field under test.
// ---------------------------------------------------------------------------

function baseBuyUsdZar(): FxTradeExecutedPayload {
  return {
    tradeId: { scheme: "internal-trade-id", value: "fx-quoting-test-001" },
    productTaxonomy: "FX-spot",
    currencyPair: { base: "USD", quote: "ZAR" },
    side: "buy",
    legs: [
      {
        legKind: "near",
        // BUY USD/ZAR → bank pays ZAR (quote), receives USD (base).
        payCurrency: "ZAR",
        receiveCurrency: "USD",
        notional: { currency: "ZAR", amountMinor: 185_000_00 }, // ZAR 185,000
        counterNotional: { currency: "USD", amountMinor: 10_000_00 }, // USD 10,000
        rate: { currency: "ZAR", amount: 18.5 }, // quote-per-base
        settlementDate: { iso: "2026-05-23", calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: "2026-05-21", calendar: "JIHCAL" },
    counterparty: { partyId: "cp-test", name: "Test CP", role: "counterparty" },
    venue: "OTC",
    trader: "kai-test",
    bookId: "FX-MM-ZAR-01",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    clientFlowRef: "client-trade:test-001",
  };
}

function baseSellUsdZar(): FxTradeExecutedPayload {
  return {
    tradeId: { scheme: "internal-trade-id", value: "fx-quoting-test-002" },
    productTaxonomy: "FX-spot",
    currencyPair: { base: "USD", quote: "ZAR" },
    side: "sell",
    legs: [
      {
        legKind: "near",
        // SELL USD/ZAR → bank pays USD (base), receives ZAR (quote).
        payCurrency: "USD",
        receiveCurrency: "ZAR",
        notional: { currency: "USD", amountMinor: 10_000_00 },
        counterNotional: { currency: "ZAR", amountMinor: 185_000_00 },
        rate: { currency: "ZAR", amount: 18.5 }, // still quote-per-base
        settlementDate: { iso: "2026-05-23", calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: "2026-05-21", calendar: "JIHCAL" },
    counterparty: { partyId: "cp-test", name: "Test CP", role: "counterparty" },
    venue: "OTC",
    trader: "kai-test",
    bookId: "FX-MM-ZAR-01",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    clientFlowRef: "client-trade:test-002",
  };
}

// ---------------------------------------------------------------------------
// Happy paths.
// ---------------------------------------------------------------------------

describe("fxTradeExecutedPayloadSchema — D-FX-QUOTING-CONVENTION happy paths", () => {
  it("accepts canonical BUY USD/ZAR (pay ZAR, receive USD, rate.currency=ZAR)", () => {
    const parsed = fxTradeExecutedPayloadSchema.safeParse(baseBuyUsdZar());
    expect(parsed.success).toBe(true);
  });

  it("accepts canonical SELL USD/ZAR (pay USD, receive ZAR, rate.currency=ZAR)", () => {
    const parsed = fxTradeExecutedPayloadSchema.safeParse(baseSellUsdZar());
    expect(parsed.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rejection paths — five-clause invariant.
// ---------------------------------------------------------------------------

type FxLegFixture = FxTradeExecutedPayload["legs"][number];

function withMutatedLeg(
  base: FxTradeExecutedPayload,
  mutate: (leg: FxLegFixture) => FxLegFixture,
): FxTradeExecutedPayload {
  const firstLeg = base.legs[0];
  if (!firstLeg) throw new Error("fixture must have at least one leg");
  return { ...base, legs: [mutate(firstLeg), ...base.legs.slice(1)] };
}

describe("fxTradeExecutedPayloadSchema — D-FX-QUOTING-CONVENTION rejections", () => {
  it("rejects pay-currency outside the pair", () => {
    const bad = withMutatedLeg(baseBuyUsdZar(), (leg) => ({
      ...leg,
      payCurrency: "GBP", // GBP not in {USD, ZAR}
      notional: { currency: "GBP", amountMinor: 100 },
    }));
    const parsed = fxTradeExecutedPayloadSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toContain("must be one of currencyPair");
    }
  });

  it("rejects notional in the wrong currency (not pay)", () => {
    const bad = withMutatedLeg(baseBuyUsdZar(), (leg) => ({
      ...leg,
      // Pay = ZAR, but notional says USD.
      notional: { currency: "USD", amountMinor: 10_000_00 },
    }));
    const parsed = fxTradeExecutedPayloadSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toContain("notional.currency 'USD' must equal payCurrency 'ZAR'");
    }
  });

  it("rejects counter-notional in the wrong currency (not receive)", () => {
    const bad = withMutatedLeg(baseBuyUsdZar(), (leg) => ({
      ...leg,
      // Receive = USD, but counter-notional says ZAR.
      counterNotional: { currency: "ZAR", amountMinor: 185_000_00 },
    }));
    const parsed = fxTradeExecutedPayloadSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toContain("counterNotional.currency 'ZAR' must equal receiveCurrency 'USD'");
    }
  });

  it("rejects rate.currency that is not the pair quote (inverted rate)", () => {
    const bad = withMutatedLeg(baseBuyUsdZar(), (leg) => ({
      ...leg,
      // Pair quote = ZAR, but rate is in USD (inverted, the sim-generator bug).
      rate: { currency: "USD", amount: 1 / 18.5 },
    }));
    const parsed = fxTradeExecutedPayloadSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toContain("rate.currency 'USD' must equal currencyPair.quote 'ZAR'");
    }
  });

  it("rejects side='buy' with pay/receive swapped (side coherence fail)", () => {
    const bad = withMutatedLeg(baseBuyUsdZar(), (leg) => ({
      ...leg,
      // BUY USD/ZAR must pay ZAR + receive USD; here pay USD + receive ZAR.
      payCurrency: "USD",
      receiveCurrency: "ZAR",
      notional: { currency: "USD", amountMinor: 10_000_00 },
      counterNotional: { currency: "ZAR", amountMinor: 185_000_00 },
    }));
    const parsed = fxTradeExecutedPayloadSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toContain("side 'buy' requires payCurrency 'ZAR'");
      expect(messages).toContain("side 'buy' requires receiveCurrency 'USD'");
    }
  });
});
