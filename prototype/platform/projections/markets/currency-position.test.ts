// platform/projections/markets/currency-position.test.ts
//
// Unit tests for the FX cash-inventory model (CEO instruction 2026-05-31):
// settled FX legs fold into a per-desk per-currency cash instrument with
// weighted-average ZAR cost, and close-outs crystallise realised P&L.
//
// Uses a lightweight stub store (yields events by type) so the tests pin the
// ECONOMIC logic without constructing fully schema-valid CDM payloads.

import { describe, expect, it } from "bun:test";

import {
  type DeskCashPositionSet,
  computeDeskCashPositions,
} from "../../product-control/desk-cash-positions";
import { cashInstrumentId, computeCurrencyPositions } from "./currency-position";

interface StubEvent {
  type: string;
  entity: string;
  payload: Record<string, unknown>;
}

// Minimal store with the only method the compute functions call: replay({type}).
function stubStore(events: StubEvent[]): import("../../event-store/store").EventStore {
  return {
    replay({ type }: { type?: string } = {}) {
      return events.filter((e) => type === undefined || e.type === type);
    },
  } as unknown as import("../../event-store/store").EventStore;
}

const ENTITY = "LE-ZA-HOZ-BANK";
const BOOK = "BK-FX-MM-SIM-001";

// A USD/ZAR trade that settles: receive USD (FCY +), deliver ZAR (cost).
function settledUsdZar(
  tradeId: string,
  side: "buy" | "sell",
  usdMinor: number,
  zarMinor: number,
  settlementDate: string,
): StubEvent[] {
  // buy: receive USD (+), deliver ZAR (−). sell: deliver USD (−), receive ZAR (+).
  const usdNet = side === "buy" ? usdMinor : -usdMinor;
  const zarNet = side === "buy" ? -zarMinor : zarMinor;
  return [
    {
      type: "FxTradeExecuted",
      entity: ENTITY,
      payload: {
        tradeId: { value: tradeId },
        bookId: BOOK,
        side,
        currencyPair: { base: "USD", quote: "ZAR" },
      },
    },
    {
      type: "PrincipalPayment",
      entity: ENTITY,
      payload: { tradeId, legKind: "receive", currency: "USD", netCash: usdNet, settlementDate },
    },
    {
      type: "PrincipalPayment",
      entity: ENTITY,
      payload: { tradeId, legKind: "deliver", currency: "ZAR", netCash: zarNet, settlementDate },
    },
  ];
}

function usdZarMark(rate: number): StubEvent {
  return {
    type: "OfficialMarkAdopted",
    entity: ENTITY,
    payload: { markType: "fx-rate", instrumentKey: "USD/ZAR", mark: String(rate) },
  };
}

/** A settled GBP/USD CROSS trade (no ZAR leg): one GBP leg + one USD leg. */
function settledGbpUsd(
  tradeId: string,
  side: "buy" | "sell", // buy = buy GBP / pay USD
  gbpMinor: number,
  usdMinor: number,
  settlementDate: string,
): StubEvent[] {
  const gbpNet = side === "buy" ? gbpMinor : -gbpMinor;
  const usdNet = side === "buy" ? -usdMinor : usdMinor;
  return [
    {
      type: "FxTradeExecuted",
      entity: ENTITY,
      payload: {
        tradeId: { value: tradeId },
        bookId: BOOK,
        side,
        currencyPair: { base: "GBP", quote: "USD" },
      },
    },
    {
      type: "PrincipalPayment",
      entity: ENTITY,
      payload: { tradeId, legKind: "receive", currency: "GBP", netCash: gbpNet, settlementDate },
    },
    {
      type: "PrincipalPayment",
      entity: ENTITY,
      payload: { tradeId, legKind: "deliver", currency: "USD", netCash: usdNet, settlementDate },
    },
  ];
}

/** A dated CCY/ZAR mark for cross-pair cost-basis imputation. */
function datedMark(ccy: string, rate: number, markAsOf: string): StubEvent {
  return {
    type: "OfficialMarkAdopted",
    entity: ENTITY,
    payload: { markType: "fx-rate", instrumentKey: `${ccy}/ZAR`, mark: String(rate), markAsOf },
  };
}

describe("currency-position — FX cash inventory", () => {
  it("an opening buy adds FCY at the trade's ZAR cost and realises nothing", () => {
    // Buy USD 1,000.00 (100000 minor) for ZAR 18,500.00 (1850000 minor) → rate 18.50.
    const { rows, realisations } = computeCurrencyPositions(
      stubStore(settledUsdZar("T1", "buy", 100_000, 1_850_000, "2026-05-27")),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.instrumentId).toBe(cashInstrumentId("USD", BOOK));
    expect(rows[0]?.fcyQuantityMinor).toBe(100_000);
    expect(rows[0]?.avgCostZarRate).toBeCloseTo(18.5, 6);
    expect(realisations).toHaveLength(0); // opening settlement realises nothing
  });

  it("weighted-averages cost across two acquisitions", () => {
    const { rows } = computeCurrencyPositions(
      stubStore([
        ...settledUsdZar("T1", "buy", 100_000, 1_850_000, "2026-05-27"), // 18.50
        ...settledUsdZar("T2", "buy", 100_000, 1_650_000, "2026-05-28"), // 16.50
      ]),
    );
    expect(rows[0]?.fcyQuantityMinor).toBe(200_000);
    expect(rows[0]?.avgCostZarRate).toBeCloseTo(17.5, 6); // (18.50+16.50)/2
  });

  it("crystallises realised P&L on close-out (sell back below cost = loss)", () => {
    // Buy USD 1,000 @ 18.50, then sell USD 1,000 @ 16.25 → loss (16.25−18.50)×100000.
    const { rows, realisations } = computeCurrencyPositions(
      stubStore([
        ...settledUsdZar("T1", "buy", 100_000, 1_850_000, "2026-05-27"), // 18.50
        ...settledUsdZar("T2", "sell", 100_000, 1_625_000, "2026-05-28"), // 16.25
      ]),
    );
    expect(rows[0]?.fcyQuantityMinor).toBe(0); // flat
    expect(rows[0]?.avgCostZarRate).toBe(0);
    expect(realisations).toHaveLength(1);
    expect(realisations[0]?.realisedPnlZarMinor).toBe(Math.round((16.25 - 18.5) * 100_000)); // −225000 ZAR minor = −ZAR 2,250.00
    expect(rows[0]?.realisedZarMinorCumulative).toBe(Math.round((16.25 - 18.5) * 100_000));
  });

  it("excludes cancelled trades from the inventory", () => {
    const events = settledUsdZar("T1", "buy", 100_000, 1_850_000, "2026-05-27");
    events.push({
      type: "FxTradeCancelled",
      entity: ENTITY,
      payload: { tradeId: "T1" },
    });
    const { rows } = computeCurrencyPositions(stubStore(events));
    expect(rows).toHaveLength(0);
  });

  it("is replay-deterministic regardless of event array order within a day", () => {
    const base = [
      ...settledUsdZar("T1", "buy", 100_000, 1_850_000, "2026-05-27"),
      ...settledUsdZar("T2", "buy", 50_000, 900_000, "2026-05-27"),
    ];
    const a = computeCurrencyPositions(stubStore(base));
    const b = computeCurrencyPositions(stubStore([...base].reverse()));
    expect(a.rows[0]?.avgCostZarRate).toBeCloseTo(b.rows[0]?.avgCostZarRate ?? -1, 6);
    expect(a.rows[0]?.fcyQuantityMinor).toBe(b.rows[0]?.fcyQuantityMinor ?? -1);
  });
});

describe("desk-cash-positions — marking to ZAR (no silent zero)", () => {
  it("marks a held position to the current USD/ZAR rate", () => {
    const set: DeskCashPositionSet = computeDeskCashPositions(
      stubStore([
        ...settledUsdZar("T1", "buy", 100_000, 1_850_000, "2026-05-27"), // cost 18.50
        usdZarMark(16.25),
      ]),
    );
    expect(set.positions).toHaveLength(1);
    const p = set.positions[0];
    expect(p?.markRate).toBeCloseTo(16.25, 6);
    // unrealised = qty × (mark − avgCost) = 100000 × (16.25 − 18.50) = −225000
    expect(p?.unrealisedPnlZarMinor.present).toBe(true);
    if (p?.unrealisedPnlZarMinor.present) {
      expect(p.unrealisedPnlZarMinor.value).toBe(Math.round(100_000 * (16.25 - 18.5)));
    }
    expect(set.totalUnrealised.present).toBe(true);
  });

  it("surfaces an unmarkable held position as absent, never a silent 0", () => {
    const set = computeDeskCashPositions(
      stubStore(settledUsdZar("T1", "buy", 100_000, 1_850_000, "2026-05-27")), // no mark
    );
    expect(set.positions[0]?.unrealisedPnlZarMinor.present).toBe(false);
    expect(set.unmarkableKeys).toContain(cashInstrumentId("USD", BOOK));
    expect(set.totalUnrealised.present).toBe(false);
  });
});

describe("currency-position — cross-pair cost-basis imputation (D-FX-CROSS-PAIR-CASH-COST-BASIS)", () => {
  it("forms GBP + USD cash positions from a settled GBP/USD cross, costed at settlement-day CCY/ZAR marks", () => {
    // Buy GBP 1,000.00 / pay USD 1,358.20 (cross), with GBP/ZAR @ 21.50, USD/ZAR @ 16.00 on the settlement day.
    const { rows, skipped } = computeCurrencyPositions(
      stubStore([
        ...settledGbpUsd("X1", "buy", 100_000, 135_820, "2026-06-02"),
        datedMark("GBP", 21.5, "2026-06-02"),
        datedMark("USD", 16.0, "2026-06-02"),
      ]),
    );
    expect(skipped).toHaveLength(0); // no longer dropped
    const gbp = rows.find((r) => r.currency === "GBP");
    const usd = rows.find((r) => r.currency === "USD");
    expect(gbp?.fcyQuantityMinor).toBe(100_000); // received GBP
    expect(gbp?.avgCostZarRate).toBeCloseTo(21.5, 6); // imputed from the mark
    expect(usd?.fcyQuantityMinor).toBe(-135_820); // delivered USD (short)
    expect(usd?.avgCostZarRate).toBeCloseTo(16.0, 6);
  });

  it("still skips a cross-pair leg whose currency has NO mark at all (no silent fabrication)", () => {
    const { rows, skipped } = computeCurrencyPositions(
      stubStore([
        ...settledGbpUsd("X1", "buy", 100_000, 135_820, "2026-06-02"),
        datedMark("GBP", 21.5, "2026-06-02"), // only GBP marked; USD has none
      ]),
    );
    // GBP leg prices; USD leg is skipped — the trade is not fully dropped.
    expect(rows.find((r) => r.currency === "GBP")).toBeDefined();
    expect(rows.find((r) => r.currency === "USD")).toBeUndefined();
    expect(skipped.some((s) => s.reason.includes("USD/ZAR"))).toBe(true);
  });

  it("crystallises realised P&L on a cross-pair close-out across two settlement days", () => {
    // Buy GBP 2,000 @ 21.00 (06-02), sell GBP 1,000 @ 22.00 (06-03) → realised
    // (22.00−21.00)×100000 = +100000 on the GBP leg. USD just accumulates (no close-out).
    const { rows } = computeCurrencyPositions(
      stubStore([
        ...settledGbpUsd("X1", "buy", 200_000, 271_640, "2026-06-02"),
        ...settledGbpUsd("X2", "sell", 100_000, 136_000, "2026-06-03"),
        datedMark("GBP", 21.0, "2026-06-02"),
        datedMark("GBP", 22.0, "2026-06-03"),
        datedMark("USD", 16.0, "2026-06-02"),
        datedMark("USD", 16.0, "2026-06-03"),
      ]),
    );
    const gbp = rows.find((r) => r.currency === "GBP");
    expect(gbp?.fcyQuantityMinor).toBe(100_000); // 200k bought − 100k sold
    expect(gbp?.realisedZarMinorCumulative).toBe(Math.round((22.0 - 21.0) * 100_000));
  });
});
