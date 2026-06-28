// platform/markets/settlement/fx-maturity-gate.test.ts
//
// Unit tests for the FX value-date maturity gate — the unsettled-commitment
// carry that distinguishes a forward (settlementDate > spot) from a spot. Built
// from REAL bookings (affirm → book the FIL FX instrument), not hand-crafted
// payloads, so the gate is exercised against the instrument-of-record the
// settlement path actually reads.
//
// Author: Kai (Trading systems engineer, engineering).

import { describe, expect, test } from "bun:test";

import { EventStore } from "../../event-store/store";
import type { ScenarioTradeAction } from "../../simulation-v2/scenario-manifest";
import { emitCounterpartyConfirmation } from "../../simulation-v2/sim-modules/trade-confirmation";
import { bookAffirmedFxTrade } from "../products/book-affirmed-fx-trade";
import {
  hasReachedValueDate,
  isCarriedUnsettledCommitment,
  maturedOpenFxTradeIds,
  readFxInstrumentMaturities,
  toCalendarDate,
} from "./fx-maturity-gate";

const REPORTING = "ZAR";
const SCENARIO_ID = "fx-maturity-gate-unit";

// A spot (T+2) and a 3-month forward booked on the SAME trade date. The forward's
// value date (2026-05-04) is three months past the spot's (2026-02-04) — the gate
// must carry the forward as an unsettled commitment until 2026-05-04.
const TRADE_DATE = "2026-02-02";
const SPOT_VALUE_DATE = "2026-02-04";
const FWD_VALUE_DATE = "2026-05-04";

const SPOT: ScenarioTradeAction = {
  tradeId: "T-SPOT-001",
  counterpartyId: "CP-SIM-RELIABLE-001",
  productTaxonomy: "FX-spot",
  pair: "USD/ZAR",
  side: "buy",
  baseNotionalMajor: 5_000_000,
  rate: 18.5,
  settlementDate: SPOT_VALUE_DATE,
};

const FORWARD: ScenarioTradeAction = {
  tradeId: "T-FWD-002",
  counterpartyId: "CP-SIM-RELIABLE-001",
  productTaxonomy: "FX-forward",
  pair: "USD/ZAR",
  side: "buy",
  baseNotionalMajor: 2_000_000,
  rate: 18.55, // forward all-in rate = spot + forward points (seeded, > spot)
  settlementDate: FWD_VALUE_DATE,
};

function bookBoth(store: EventStore): void {
  for (const trade of [SPOT, FORWARD]) {
    emitCounterpartyConfirmation({
      store,
      scenarioId: SCENARIO_ID,
      asOf: `${TRADE_DATE}T07:00:00.000Z`,
      trade,
      affirm: true,
    });
    const booked = bookAffirmedFxTrade({
      store,
      scenarioId: SCENARIO_ID,
      asOf: `${TRADE_DATE}T07:00:00.000Z`,
      reporting: REPORTING,
      trade,
    });
    expect(booked).toBe(true);
  }
}

describe("toCalendarDate", () => {
  test("reduces an instant to its calendar date", () => {
    expect(toCalendarDate("2026-05-04T17:00:00.000Z")).toBe("2026-05-04");
  });
  test("takes a bare date verbatim", () => {
    expect(toCalendarDate("2026-05-04")).toBe("2026-05-04");
  });
  test("fails closed on garbage", () => {
    expect(toCalendarDate("")).toBeUndefined();
    expect(toCalendarDate("not-a-date")).toBeUndefined();
    expect(toCalendarDate("2026-13-40")).toBeUndefined();
  });
});

describe("readFxInstrumentMaturities", () => {
  test("reads the value date (settlementDate) off each booked FX instrument", () => {
    const store = new EventStore(":memory:");
    bookBoth(store);
    const maturities = readFxInstrumentMaturities(store);
    expect(maturities.length).toBe(2);

    const spot = maturities.find((m) => m.tradeId === "T-SPOT-001");
    const fwd = maturities.find((m) => m.tradeId === "T-FWD-002");
    expect(spot?.valueDate).toBe(SPOT_VALUE_DATE);
    expect(fwd?.valueDate).toBe(FWD_VALUE_DATE);
    // Both freshly booked → both open (no termination yet).
    expect(spot?.open).toBe(true);
    expect(fwd?.open).toBe(true);
    store.close();
  });
});

describe("hasReachedValueDate — the value-date predicate", () => {
  test("a forward is NOT matured before its value date, matured on/after it", () => {
    const fwd = {
      instance: "fil:inst:LE-ZA-HOZ-BANK:T-FWD-002",
      tradeId: "T-FWD-002",
      valueDate: FWD_VALUE_DATE,
      open: true,
    };
    // Trade date: not matured (carried).
    expect(hasReachedValueDate(fwd, TRADE_DATE)).toBe(false);
    // Spot's value date — the forward is STILL carried (three months early).
    expect(hasReachedValueDate(fwd, SPOT_VALUE_DATE)).toBe(false);
    // The day before its own value date: still carried.
    expect(hasReachedValueDate(fwd, "2026-05-03")).toBe(false);
    // ON its value date: matured.
    expect(hasReachedValueDate(fwd, FWD_VALUE_DATE)).toBe(true);
    // After its value date: matured.
    expect(hasReachedValueDate(fwd, "2026-05-05")).toBe(true);
  });

  test("fails closed when the as-of cannot be dated", () => {
    const fwd = {
      instance: "fil:inst:LE-ZA-HOZ-BANK:T-FWD-002",
      tradeId: "T-FWD-002",
      valueDate: FWD_VALUE_DATE,
      open: true,
    };
    expect(hasReachedValueDate(fwd, "garbage")).toBe(false);
  });
});

describe("maturedOpenFxTradeIds — the settlement-driver gate", () => {
  test("on the spot value date, ONLY the spot is settle-eligible; the forward is carried", () => {
    const store = new EventStore(":memory:");
    bookBoth(store);
    const onSpotDate = maturedOpenFxTradeIds(store, SPOT_VALUE_DATE);
    expect(onSpotDate.has("T-SPOT-001")).toBe(true);
    // THE KEY ASSERTION: the forward is NOT settle-eligible on the spot date —
    // it is carried as an unsettled commitment to its own value date.
    expect(onSpotDate.has("T-FWD-002")).toBe(false);
    store.close();
  });

  test("on the forward value date, the forward becomes settle-eligible", () => {
    const store = new EventStore(":memory:");
    bookBoth(store);
    const onFwdDate = maturedOpenFxTradeIds(store, FWD_VALUE_DATE);
    expect(onFwdDate.has("T-FWD-002")).toBe(true);
    store.close();
  });

  test("isCarriedUnsettledCommitment tracks the carry across the forward's life", () => {
    const store = new EventStore(":memory:");
    bookBoth(store);
    // Carried before its value date…
    expect(isCarriedUnsettledCommitment(store, "T-FWD-002", TRADE_DATE)).toBe(true);
    expect(isCarriedUnsettledCommitment(store, "T-FWD-002", SPOT_VALUE_DATE)).toBe(true);
    // …no longer carried on/after its value date.
    expect(isCarriedUnsettledCommitment(store, "T-FWD-002", FWD_VALUE_DATE)).toBe(false);
    store.close();
  });
});
