// platform/product-control/eod-cohort-pnl-v2.test.ts
//
// Proof for D-FX-PNL-FCY-EXPOSURE-REVALUATION (CEO-approved 2026-06-25): the
// widened cohort revaluation marks EVERY open FCY monetary position to ZAR —
// open FX contracts AND settled FCY cash (Nostro) balances — and a settled FCY
// cash position is revalued IDENTICALLY to an open FX contract for the same spot
// move (the exposure stays open across settlement; settlement is a change of
// FORM, not of exposure).
//
// Worked example (the decision's): buy USD 7m / sell ZAR 129.95m @ 18.565. At a
// closing spot of 19.00 the unrealised P&L is 7m × (19.00 − 18.565) = +R3.045m,
// the SAME whether the position is the open forward or the settled USD cash.
//
// Test files using raw `new EventStore()` are carved out in
// CONSTRUCTION_CARVE_OUT_FILES (permission-gate-default.ts).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import {
  buildSettledCashPayloads,
  majorNumberToCashMoney,
} from "../../v2-core/fil-instances/cash-materialisation";
import { filInstrumentCreatedPayloadSchema } from "../../v2-core/fil-instances/events";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import { computeCohortPnL } from "./eod-cohort-pnl-v2";

const ACTOR: Actor = { type: "system", id: "bea:eod-cohort-pnl-v2-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = "LE-ZA-HOZ-BANK";
const CITES = ["D-FX-PNL-FCY-EXPOSURE-REVALUATION"];
const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "eod-cohort-pnl-v2-test" };
const FX_SPOT_TYPE = "fil:type:fx:spot:otc-vanilla@1.0";
const AS_OF = "2026-06-25T10:00:00.000Z";
const REPORT_DATE = "2026-06-25";

// The decision's worked example (buy USD 7m @ 18.565). The cost basis is the
// EXACT ZAR given up = 7m × 18.565 = 129,955,000, so the cash leg's derived
// booked rate (zarCostBasis/|notional|) equals the open forward's 18.565 exactly
// — the two paths then agree to the cent.
const USD_NOTIONAL = 7_000_000; // USD bought
const BOOKED_RATE = 18.565;
const ZAR_COST = USD_NOTIONAL * BOOKED_RATE; // ZAR sold (cost basis) = 129,955,000
const CLOSING_SPOT = 19.0;
// 7m × (19.00 − 18.565) = 3,045,000.00 ZAR.
const EXPECTED_UNREALISED = USD_NOTIONAL * (CLOSING_SPOT - BOOKED_RATE);

function appendOpenUsdSpot(store: EventStore, id: string): void {
  const ev = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: PROD_TAG,
    payload: filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance: `fil:inst:${ENTITY}:${id}`,
      type: FX_SPOT_TYPE,
      tenant: TENANT,
      asOf: AS_OF,
      originatingEvent: { eventType: "FxTradeExecuted", eventId: `evt-${id}` },
      initialStage: "active",
      economicTerms: {
        // The cohort engine reads the FOREIGN exposure off `currency` + the pair
        // tag (NOT the ZAR notional-leg shape the daily engine uses). Here the
        // notional currency IS the USD exposure; `bookedRateByInstance` carries
        // the booked rate.
        assetClass: "fx",
        notional: { currency: "USD", amount: String(USD_NOTIONAL) },
        direction: "long",
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-test-USD",
        currency: "USD",
        settlementDate: REPORT_DATE,
        hedgingSetTag: "USD/ZAR",
      },
    }),
  });
  store.append({ ...ev, provenance: PROD_TAG });
}

function appendSettledUsdCash(store: EventStore, tradeId: string): void {
  // The settlement materialisation grammar stamps the ZAR cost basis from the
  // counter (ZAR) leg. Both legs of the spot are passed so the USD leg's cost
  // basis resolves to the ZAR amount.
  const built = buildSettledCashPayloads({
    tradeId,
    tenant: TENANT,
    reporting: "ZAR",
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    nettingSetId: "NS-test-USD",
    settledAsOf: AS_OF,
    fxInstance: `fil:inst:${ENTITY}:${tradeId}`,
    legs: [
      { currency: "USD", signedMajor: USD_NOTIONAL, side: "received" },
      { currency: "ZAR", signedMajor: -ZAR_COST, side: "paid" },
    ],
    originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: `evt-settle-${tradeId}` },
  });
  for (const leg of built) {
    const ev = makeFilInstrumentCreated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROD_TAG,
      payload: leg.payload,
    });
    store.append({ ...ev, provenance: PROD_TAG });
  }
}

function appendUsdQuote(mds: MarketDataStore, rate: number): void {
  mds.append({
    id: "tick-USD",
    source: "fx-sim",
    instrument: "USD/ZAR",
    dataType: "fx-quote",
    provenance: "production",
    asOf: AS_OF,
    payload: { mid: rate },
  });
}

describe("computeCohortPnL — settled FCY cash revalues identically to the open contract", () => {
  test("the settlement materialisation stamps the ZAR cost basis from the counter leg", () => {
    const built = buildSettledCashPayloads({
      tradeId: "T-COST-BASIS",
      tenant: TENANT,
      reporting: "ZAR",
      counterpartyId: "cp",
      nettingSetId: "NS",
      settledAsOf: AS_OF,
      fxInstance: `fil:inst:${ENTITY}:T-COST-BASIS`,
      legs: [
        { currency: "USD", signedMajor: USD_NOTIONAL, side: "received" },
        { currency: "ZAR", signedMajor: -ZAR_COST, side: "paid" },
      ],
      originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: "e1" },
    });
    const usd = built.find((b) => b.payload.economicTerms.currency === "USD");
    const zar = built.find((b) => b.payload.economicTerms.currency === "ZAR");
    // The USD leg's cost basis is the ZAR (counter-leg) amount given up.
    expect(usd?.payload.economicTerms.zarCostBasis).toEqual(
      majorNumberToCashMoney(ZAR_COST, "ZAR"),
    );
    // The ZAR (domestic) leg's cost basis is its own amount (rate 1).
    expect(zar?.payload.economicTerms.zarCostBasis).toEqual(
      majorNumberToCashMoney(ZAR_COST, "ZAR"),
    );
  });

  test("open USD forward and settled USD cash produce the SAME unrealised P&L", () => {
    // (1) Open USD spot only.
    const openStore = new EventStore(":memory:");
    appendOpenUsdSpot(openStore, "FX-OPEN");
    const openMds = new MarketDataStore(":memory:");
    appendUsdQuote(openMds, CLOSING_SPOT);
    const openResult = computeCohortPnL({
      eventStore: openStore,
      marketDataStore: openMds,
      reporting: "ZAR",
      reportDate: REPORT_DATE,
      bookedRateByInstance: new Map([[`fil:inst:${ENTITY}:FX-OPEN`, BOOKED_RATE]]),
    });

    // (2) Settled USD cash only (the FX trade has settled into cash).
    const cashStore = new EventStore(":memory:");
    appendSettledUsdCash(cashStore, "FX-SETTLED");
    const cashMds = new MarketDataStore(":memory:");
    appendUsdQuote(cashMds, CLOSING_SPOT);
    const cashResult = computeCohortPnL({
      eventStore: cashStore,
      marketDataStore: cashMds,
      reporting: "ZAR",
      reportDate: REPORT_DATE,
      // Cash derives its booked rate from zarCostBasis/|notional| — no entry needed.
      bookedRateByInstance: new Map(),
    });

    // Both mark a single live USD position.
    const openUsd = openResult.rows.filter((r) => r.markStatus === "live");
    const cashUsd = cashResult.rows.filter(
      (r) => r.markStatus === "live" && r.positionKind === "cash",
    );
    expect(openUsd.length).toBe(1);
    expect(cashUsd.length).toBe(1);

    // The headline unrealised is the decision's worked example, +R3.045m, AND it
    // is IDENTICAL between the open contract and the settled cash.
    expect(openResult.totalUnrealisedReporting).toBeCloseTo(EXPECTED_UNREALISED, 2);
    expect(cashResult.totalUnrealisedReporting).toBeCloseTo(EXPECTED_UNREALISED, 2);
    expect(cashResult.totalUnrealisedReporting).toBeCloseTo(openResult.totalUnrealisedReporting, 6);
  });

  test("a domestic (ZAR) settled cash leg carries no FX exposure (no row)", () => {
    const store = new EventStore(":memory:");
    appendSettledUsdCash(store, "FX-SETTLED-2");
    const mds = new MarketDataStore(":memory:");
    appendUsdQuote(mds, CLOSING_SPOT);
    const result = computeCohortPnL({
      eventStore: store,
      marketDataStore: mds,
      reporting: "ZAR",
      reportDate: REPORT_DATE,
      bookedRateByInstance: new Map(),
    });
    // Only the USD leg is revalued; the ZAR (domestic) cash leg forms no row.
    expect(result.rows.every((r) => r.pair === "USD/ZAR")).toBe(true);
  });
});
