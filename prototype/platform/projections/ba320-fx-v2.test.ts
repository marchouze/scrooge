// platform/projections/ba320-fx-v2.test.ts
//
// Item-3 unit proof (D-FX-REALISATION-COMPLETION-V1): the BA-320 v2 net-open-
// position fold captures SETTLED FCY CASH holdings, not only open FX CONTRACTS.
//
// reg-28(5) covers ALL on-balance-sheet + off-balance-sheet FX positions — which
// includes spot FCY cash. Before Item 3 the NOP charge VANISHED at settlement (the
// open FX contract dropped out at its value date; the materialised FCY cash was
// invisible because the fold keyed only on `assetClass === "fx"`). These tests
// prove the exposure is now CONTINUOUS across settlement: contract → (settle) →
// FCY cash, both folded into the SAME per-currency open net position.
//
// Author: Kai (Trading systems engineer, engineering — Lane 5a).

import { describe, expect, test } from "bun:test";

import { filInstrumentCreatedPayloadSchema } from "../../v2-core/fil-instances/events";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../event-store/event-types/fil-instances";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import { computeBA320V2 } from "./ba320-fx-v2";

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = "tenant:za-bank";
const ACTOR: Actor = { type: "system", id: "kai:ba320-fx-v2-test" };
const CITES = ["D-FX-REALISATION-COMPLETION-V1"];
const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "ba320-fx-v2-test" };
const CASH_TYPE_URN = "fil:type:cash:balance:vanilla@1.0";
const FX_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";

// The specimen: BUY USD 1,000,000 / SELL ZAR @ 18.50. Trade date 2026-06-15,
// value (settlement) date 2026-06-17. After settlement the USD nostro is long
// USD 1,000,000 — a reg-28(5) open foreign-currency position carried as cash.
const TRADE_DATE = "2026-06-15T10:00:00.000Z";
const VALUE_DATE = "2026-06-17";
const USD_AMOUNT = "1000000.00";
const ZAR_COST = "18500000.00";
const RATE_USD_ZAR = 18.5;

/** Append the OPEN FX CONTRACT (anchor-book shape: ZAR notional + pair tag). */
function appendFxContract(store: EventStore): void {
  store.append(
    makeFilInstrumentCreated({
      asOf: TRADE_DATE,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROD_TAG,
      payload: filInstrumentCreatedPayloadSchema.parse({
        kind: "FilInstrumentCreated",
        instance: `fil:inst:${ENTITY}:TRADE-1`,
        type: FX_TYPE_URN,
        tenant: TENANT,
        asOf: TRADE_DATE,
        originatingEvent: { eventType: "FxTradeExecuted", eventId: "evt-TRADE-1" },
        initialStage: "active",
        economicTerms: {
          assetClass: "fx",
          notional: { currency: "ZAR", amount: ZAR_COST },
          direction: "long",
          counterpartyId: "urn:party:legal-entity:standard-bank-za",
          nettingSetId: "NS-test-ZAR",
          currency: "ZAR",
          settlementDate: VALUE_DATE,
          hedgingSetTag: "USD/ZAR",
        },
      }),
    }),
  );
}

/** Append the SETTLED FCY CASH holding (received-leg, USD long, carried at ZAR cost). */
function appendUsdCashHolding(store: EventStore): void {
  store.append(
    makeFilInstrumentCreated({
      asOf: `${VALUE_DATE}T00:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROD_TAG,
      payload: filInstrumentCreatedPayloadSchema.parse({
        kind: "FilInstrumentCreated",
        instance: `fil:inst:${ENTITY}:TRADE-1-cash-received`,
        type: CASH_TYPE_URN,
        tenant: TENANT,
        asOf: `${VALUE_DATE}T00:00:00.000Z`,
        originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: "evt-settle-1" },
        initialStage: "active",
        economicTerms: {
          assetClass: "cash",
          // FCY cash is denominated in its OWN (foreign) currency — USD.
          notional: { currency: "USD", amount: USD_AMOUNT },
          direction: "long",
          counterpartyId: "urn:party:legal-entity:standard-bank-za",
          nettingSetId: "NS-test-ZAR",
          currency: "USD",
          settlementDate: VALUE_DATE,
          hedgingSetTag: "USD/ZAR",
          originatingInstrument: `fil:inst:${ENTITY}:TRADE-1`,
          zarCostBasis: { currency: "ZAR", amount: ZAR_COST },
        },
      }),
    }),
  );
}

/** Append the FUNDING (paid) leg — ZAR cash. Domestic; must NOT count toward NOP. */
function appendZarCashHolding(store: EventStore): void {
  store.append(
    makeFilInstrumentCreated({
      asOf: `${VALUE_DATE}T00:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROD_TAG,
      payload: filInstrumentCreatedPayloadSchema.parse({
        kind: "FilInstrumentCreated",
        instance: `fil:inst:${ENTITY}:TRADE-1-cash-paid`,
        type: CASH_TYPE_URN,
        tenant: TENANT,
        asOf: `${VALUE_DATE}T00:00:00.000Z`,
        originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: "evt-settle-1" },
        initialStage: "active",
        economicTerms: {
          assetClass: "cash",
          notional: { currency: "ZAR", amount: ZAR_COST },
          direction: "short",
          counterpartyId: "urn:party:legal-entity:standard-bank-za",
          nettingSetId: "NS-test-ZAR",
          currency: "ZAR",
          settlementDate: VALUE_DATE,
          hedgingSetTag: "ZAR/ZAR",
          originatingInstrument: `fil:inst:${ENTITY}:TRADE-1`,
          zarCostBasis: { currency: "ZAR", amount: ZAR_COST },
        },
      }),
    }),
  );
}

function terminateCashHolding(store: EventStore): void {
  store.append(
    makeFilInstrumentTerminated({
      asOf: "2026-06-25T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROD_TAG,
      payload: {
        kind: "FilInstrumentTerminated",
        instance: `fil:inst:${ENTITY}:TRADE-1-cash-received`,
        type: CASH_TYPE_URN,
        tenant: TENANT,
        asOf: "2026-06-25T10:00:00.000Z",
        terminalStage: "settled",
        originatingEvent: { eventType: "FxConversionExecuted", eventId: "evt-convert-1" },
      },
    }),
  );
}

function appendUsdQuote(mds: MarketDataStore): void {
  mds.append({
    id: "tick-USD",
    source: "fx-test",
    instrument: "USD/ZAR",
    dataType: "fx-quote",
    provenance: "production",
    asOf: `${VALUE_DATE}T00:00:00.000Z`,
    payload: { mid: RATE_USD_ZAR },
  });
}

describe("computeBA320V2 — Item 3: settled FCY cash is in the reg-28(5) NOP", () => {
  test("a settled USD cash holding contributes a USD long open position (and the charge is non-zero)", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");
    appendUsdCashHolding(store);
    appendZarCashHolding(store);
    appendUsdQuote(mds);

    // As-of AFTER the value date: the FX contract (if any) would have dropped, but
    // the cash holding survives.
    const r = computeBA320V2({
      eventStore: store,
      entity: ENTITY,
      asOf: "2026-06-20T12:00:00.000Z",
      marketDataStore: mds,
    });

    const usd = r.fx.positions.find((p) => p.baseCurrency === "USD");
    expect(usd).toBeDefined();
    expect(usd?.openInstanceCount).toBe(1);
    // USD long 1,000,000 → functional ZAR minor = 1,000,000 × 18.5 × 100 = 1,850,000,000.
    expect(usd?.netPositionFunctionalMinor).toBe(1_850_000_000);
    // The ZAR funding leg is domestic — no ZAR open position.
    expect(r.fx.positions.find((p) => p.baseCurrency === "ZAR")).toBeUndefined();
    // reg-28(5) charge = 8% × 1,850,000,000 = 148,000,000 minor (ZAR 1,480,000).
    expect(r.fx.openPositionChargeMinor).toBe(148_000_000);
    expect(r.fx.coverageStatus).toBe("complete");
  });

  test("the FX exposure is CONTINUOUS across settlement: contract NOP == cash NOP (the charge does not vanish at settlement)", () => {
    const mds = new MarketDataStore(":memory:");
    appendUsdQuote(mds);

    // BEFORE settlement — the open FX contract carries the USD NOP.
    const preStore = new EventStore(":memory:");
    appendFxContract(preStore);
    const pre = computeBA320V2({
      eventStore: preStore,
      entity: ENTITY,
      asOf: "2026-06-16T12:00:00.000Z", // day before value date — contract still open
      marketDataStore: mds,
    });
    const preUsd = pre.fx.positions.find((p) => p.baseCurrency === "USD");
    expect(preUsd?.netPositionFunctionalMinor).toBe(1_850_000_000);

    // AFTER settlement — the SAME exposure now lives as the settled USD cash.
    const postStore = new EventStore(":memory:");
    appendFxContract(postStore);
    appendUsdCashHolding(postStore);
    appendZarCashHolding(postStore);
    const post = computeBA320V2({
      eventStore: postStore,
      entity: ENTITY,
      asOf: "2026-06-20T12:00:00.000Z", // after value date — contract dropped, cash survives
      marketDataStore: mds,
    });
    const postUsd = post.fx.positions.find((p) => p.baseCurrency === "USD");

    // The net open position + charge are IDENTICAL before and after settlement —
    // settlement changes the FORM (contract → cash) not the EXPOSURE.
    expect(postUsd?.netPositionFunctionalMinor).toBe(preUsd?.netPositionFunctionalMinor);
    expect(post.fx.openPositionChargeMinor).toBe(pre.fx.openPositionChargeMinor);
  });

  test("the cash holding survives the settlement-date drop (only termination closes it)", () => {
    const store = new EventStore(":memory:");
    const mds = new MarketDataStore(":memory:");
    appendUsdCashHolding(store);
    appendUsdQuote(mds);

    // As-of FAR after the value date — a contract would be long gone; the cash is open.
    const open = computeBA320V2({
      eventStore: store,
      entity: ENTITY,
      asOf: "2026-07-15T12:00:00.000Z",
      marketDataStore: mds,
    });
    expect(open.fx.positions.find((p) => p.baseCurrency === "USD")?.openInstanceCount).toBe(1);

    // After the FCY→ZAR conversion terminates the cash holding, the NOP closes.
    terminateCashHolding(store);
    const closed = computeBA320V2({
      eventStore: store,
      entity: ENTITY,
      asOf: "2026-07-15T12:00:00.000Z",
      marketDataStore: mds,
    });
    expect(closed.fx.positions.find((p) => p.baseCurrency === "USD")).toBeUndefined();
    expect(closed.meta.openFxInstanceCount).toBe(0);
  });
});
