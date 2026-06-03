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
        tradeDate: { iso: settlementDate, calendar: "JIHCAL" },
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

describe("currency-position — cross-pair cost basis from executed trades (D-FX-CROSS-PAIR-CASH-COST-BASIS)", () => {
  it("costs each leg from the EXECUTED amounts, anchored on the reference (USD) mark at trade date — not a per-leg mark", () => {
    // Buy GBP 1,000.00 / pay USD 1,358.20 (executed cross 1.3582), USD/ZAR @ 16.00.
    // ZAR consideration = |USD leg| × 16.00 = 135820 × 16 = 2,173,120 ZAR minor.
    //   USD cost rate = 2,173,120 / 135,820 = 16.00 (the anchor)
    //   GBP cost rate = 2,173,120 / 100,000 = 21.7312 (= 16.00 × executed cross)
    const { rows, skipped } = computeCurrencyPositions(
      stubStore([
        ...settledGbpUsd("X1", "buy", 100_000, 135_820, "2026-06-02"),
        datedMark("USD", 16.0, "2026-06-02"),
        datedMark("GBP", 99.0, "2026-06-02"), // present but NOT used for cost (USD anchors)
      ]),
    );
    expect(skipped).toHaveLength(0);
    const gbp = rows.find((r) => r.currency === "GBP");
    const usd = rows.find((r) => r.currency === "USD");
    expect(usd?.fcyQuantityMinor).toBe(-135_820);
    expect(usd?.avgCostZarRate).toBeCloseTo(16.0, 6); // anchor leg = its own mark
    expect(gbp?.fcyQuantityMinor).toBe(100_000);
    expect(gbp?.avgCostZarRate).toBeCloseTo(16.0 * (135_820 / 100_000), 6); // executed-cross derived, NOT 99.0
  });

  it("falls back to the other leg as anchor when the reference currency is unmarked (both legs still price)", () => {
    // Only GBP marked, USD has none → GBP anchors; USD cost back-solved from executed amounts.
    const { rows, skipped } = computeCurrencyPositions(
      stubStore([
        ...settledGbpUsd("X1", "buy", 100_000, 135_820, "2026-06-02"),
        datedMark("GBP", 21.5, "2026-06-02"),
      ]),
    );
    expect(skipped).toHaveLength(0);
    const gbp = rows.find((r) => r.currency === "GBP");
    const usd = rows.find((r) => r.currency === "USD");
    expect(gbp?.avgCostZarRate).toBeCloseTo(21.5, 6); // anchor leg
    // ZAR consideration = 100000 × 21.5 = 2,150,000 → USD cost = 2,150,000 / 135,820.
    expect(usd?.avgCostZarRate).toBeCloseTo((100_000 * 21.5) / 135_820, 6);
  });

  it("skips the trade only when NEITHER leg currency has a mark (no silent fabrication)", () => {
    const { rows, skipped } = computeCurrencyPositions(
      stubStore([...settledGbpUsd("X1", "buy", 100_000, 135_820, "2026-06-02")]), // no marks at all
    );
    expect(rows).toHaveLength(0);
    expect(skipped.some((s) => s.tradeId === "X1")).toBe(true);
  });

  it("crystallises realised P&L on a cross-pair close-out from the executed entry/exit rates", () => {
    // Buy GBP 2,000 (06-02) then sell GBP 1,000 (06-03), USD/ZAR @ 16.00 both days.
    //   buy:  exec cross 1.360 → GBP cost = 16 × 1.360 = 21.76
    //   sell: exec cross 1.340 → GBP disposal = 16 × 1.340 = 21.44
    // realised on the 100k closed = (21.44 − 21.76) × 100000 = −32000 ZAR minor.
    const { rows } = computeCurrencyPositions(
      stubStore([
        ...settledGbpUsd("X1", "buy", 200_000, 272_000, "2026-06-02"), // cross 1.360
        ...settledGbpUsd("X2", "sell", 100_000, 134_000, "2026-06-03"), // cross 1.340
        datedMark("USD", 16.0, "2026-06-02"),
        datedMark("USD", 16.0, "2026-06-03"),
      ]),
    );
    const gbp = rows.find((r) => r.currency === "GBP");
    expect(gbp?.fcyQuantityMinor).toBe(100_000); // 200k − 100k
    const buyCost = 16.0 * (272_000 / 200_000); // 21.76
    const sellRate = 16.0 * (134_000 / 100_000); // 21.44
    expect(gbp?.realisedZarMinorCumulative).toBe(Math.round((sellRate - buyCost) * 100_000));
  });
});
